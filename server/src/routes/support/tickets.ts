import { Router, Request, Response } from "express";
import { validate as validateUuid } from "uuid";
import { authenticateToken } from "../../middleware/auth.js";
import { ticketCreateLimiter } from "../../middleware/supportRateLimits.js";
import { supabase } from "../../services/support.db.js";
import {
  isSupportAgent,
  isSupportRequester,
  isSupportSharedViewer,
  isSupportAdmin,
  resolveUserDisplayName,
  resolveSupportUserRoles,
} from "../../services/support.permissions.js";
import {
  convertObjectToCamelCase,
  serializeTicket,
  serializeMessage,
  serializeAttachment,
} from "../../services/support.serializers.js";
import {
  validateAttachments,
  insertAttachmentRows,
} from "../../services/support.attachments.js";
import { sanitizeSupportContext } from "../../services/support.context.js";
import {
  handleDbError,
  notFoundResponse,
} from "../../services/support.errors.js";
import { sendNewTicketEmail } from "../../services/support.email.js";
import { DbSupportTicket } from "../../types.js";

const router = Router();

/**
 * POST /api/support/tickets
 * Create new support ticket.
 * Replay-safe: checks idempotency_key before RPC. Validates attachments before RPC.
 */
router.post(
  "/tickets",
  authenticateToken,
  ticketCreateLimiter,
  async (req: Request, res: Response) => {
    try {
      if (!isSupportRequester(req.user)) {
        return notFoundResponse(res);
      }

      const {
        type,
        description,
        urgency,
        context,
        locale,
        idempotencyKey,
        attachments,
      } = req.body || {};

      // Validate required inputs
      const allowedTypes = ["bug", "change", "feature", "question"];
      if (!type || !allowedTypes.includes(type)) {
        return res.status(400).json({ success: false, error: "Valid ticket type is required" });
      }

      const allowedUrgencies = ["blocked", "annoying", "not_urgent"];
      if (!urgency || !allowedUrgencies.includes(urgency)) {
        return res.status(400).json({ success: false, error: "Valid urgency is required" });
      }

      if (!description || typeof description !== "string" || description.trim().length === 0) {
        return res.status(400).json({ success: false, error: "description is required" });
      }

      if (description.length > 10000) {
        return res.status(400).json({ success: false, error: "description exceeds maximum 10000 characters" });
      }

      if (!idempotencyKey || !validateUuid(idempotencyKey)) {
        return res.status(400).json({ success: false, error: "Valid idempotencyKey UUID is required" });
      }

      const requesterId = req.user!.id;

      // Replay check before calling support_create_ticket
      const { data: existingTicket, error: checkError } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking idempotency_key:", checkError);
        return res.status(500).json({ success: false, error: "Internal server error" });
      }

      if (existingTicket) {
        if (existingTicket.requester_id === requesterId) {
          // Replay by same requester: immediate return with NO attachment processing and NO email
          return res.json({
            success: true,
            ticket: serializeTicket(existingTicket, req.user),
          });
        } else {
          return res.status(409).json({
            success: false,
            error: "IDEMPOTENCY_CONFLICT: Ticket already exists with a different requester",
            code: "IDEMPOTENCY_CONFLICT",
          });
        }
      }

      // Validate ALL attachments BEFORE calling the RPC
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        const validation = await validateAttachments(attachments, requesterId);
        if (!validation.success) {
          return res.status(400).json({ success: false, error: validation.error });
        }
      }

      // title = first line of description, trimmed, max 80 chars
      const firstLine = description.trim().split("\n")[0].trim();
      const title = firstLine.slice(0, 80) || "Support Ticket";

      // Requester snapshot from authenticated user
      const requesterName = resolveUserDisplayName(req.user);
      const requesterEmail = req.user!.email || "";
      const requesterRoles = resolveSupportUserRoles(req.user);

      // Context & locale sanitizing
      const sanitizedContext = sanitizeSupportContext(context, req.user);
      const finalLocale = typeof locale === "string" && locale.trim() ? locale.trim().slice(0, 10) : "en";

      // Call RPC support_create_ticket
      const baseParams = {
        p_requester_id: requesterId,
        p_requester_name: requesterName,
        p_requester_email: requesterEmail,
        p_requester_roles: requesterRoles,
        p_type: type,
        p_title: title,
        p_description: description.trim(),
        p_urgency: urgency,
        p_context: sanitizedContext,
        p_locale: finalLocale,
        p_idempotency_key: idempotencyKey,
      };

      const { data: ticket, error } = await supabase.rpc("support_create_ticket", baseParams);

      if (error) {
        if (handleDbError(error, res)) return;
        console.error("support_create_ticket RPC error:", error);
        return res.status(400).json({ success: false, error: error.message });
      }

      // Insert attachment rows idempotently after RPC succeeds
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        const attResult = await insertAttachmentRows(ticket.id, null, requesterId, attachments);
        if (!attResult.success) {
          return res.status(400).json({ success: false, error: attResult.error });
        }
      }

      // Skip email notification if ticket's created_at is more than 30 seconds old (race replay)
      const ticketAgeMs = Date.now() - new Date(ticket.created_at).getTime();
      if (ticketAgeMs <= 30000) {
        sendNewTicketEmail(ticket, attachments?.length || 0, description.trim()).catch((err) => {
          console.error("Fire-and-forget sendNewTicketEmail error:", err?.message || err);
        });
      }

      return res.json({
        success: true,
        ticket: serializeTicket(ticket, req.user),
      });
    } catch (err: any) {
      console.error("POST /tickets unhandled error:", err?.message || err);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);

/**
 * GET /api/support/tickets?scope=mine|all&status=&page=&limit=
 * Default scope mine. scope=all only for sharedViewer or agent.
 * Sort updated_at desc. Uses allow-list ticket serialization.
 */
router.get(
  "/tickets",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      if (!isSupportRequester(req.user) && !isSupportAgent(req.user)) {
        return notFoundResponse(res);
      }

      let scope = (req.query.scope as string) || "mine";
      const userIsSharedViewer = isSupportSharedViewer(req.user);
      const userIsAgent = isSupportAgent(req.user);

      // scope=all only for sharedViewer or agent; silently fall back to mine
      if (scope === "all" && !userIsSharedViewer && !userIsAgent) {
        scope = "mine";
      }

      let query = supabase.from("support_tickets").select("*", { count: "exact" });

      if (scope === "mine") {
        query = query.eq("requester_id", req.user!.id);
      }

      if (req.query.status && typeof req.query.status === "string" && req.query.status.trim()) {
        query = query.eq("status", req.query.status.trim());
      }

      query = query.order("updated_at", { ascending: false });

      const pageNum = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limitNum = Math.max(1, Math.min(100, parseInt(req.query.limit as string, 10) || 10));
      const offset = (pageNum - 1) * limitNum;

      query = query.range(offset, offset + limitNum - 1);

      const { data: rawTickets, count, error } = await query;

      if (error) {
        console.error("Error fetching support tickets:", error);
        return res.status(500).json({ success: false, error: "Failed to fetch tickets" });
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      const tickets = (rawTickets || []).map((t: DbSupportTicket) => serializeTicket(t, req.user));

      return res.json({
        success: true,
        tickets,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      });
    } catch (err: any) {
      console.error("GET /tickets unhandled error:", err?.message || err);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);

/**
 * GET /api/support/tickets/:id
 * Allowed: owner, sharedViewer, agent; otherwise 404.
 * Returns ticket + messages + attachment metadata using allow-lists.
 * Excludes internal-note attachments from non-agents.
 */
router.get(
  "/tickets/:id",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!validateUuid(id)) {
        return notFoundResponse(res);
      }

      const { data: dbTicket, error: ticketError } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("id", id)
        .single();

      if (ticketError || !dbTicket) {
        return notFoundResponse(res);
      }

      const isOwner = dbTicket.requester_id === req.user!.id;
      const userIsSharedViewer = isSupportSharedViewer(req.user);
      const userIsAgent = isSupportAgent(req.user);
      const userIsAdmin = isSupportAdmin(req.user);

      if (!isOwner && !userIsSharedViewer && !userIsAgent) {
        return notFoundResponse(res);
      }

      // Fetch messages
      const { data: dbMessages } = await supabase
        .from("support_ticket_messages")
        .select("*")
        .eq("ticket_id", dbTicket.id)
        .order("created_at", { ascending: true });

      // Track internal message IDs to filter out their attachments from non-agents
      const internalMessageIds = new Set<string>(
        (dbMessages || []).filter((m) => m.is_internal).map((m) => m.id)
      );

      // Filter messages for non-agents
      const filteredMessages = userIsAgent
        ? (dbMessages || [])
        : (dbMessages || []).filter((m) => !m.is_internal);

      const messages = filteredMessages.map((m) => serializeMessage(m, userIsAgent));

      // Fetch attachments metadata (id, fileName, mimeType, sizeBytes, createdAt, messageId)
      // Attachments visible only to owner, admin, and agent; sharedViewers who are none get empty list
      let attachments: any[] = [];
      if (isOwner || userIsAdmin || userIsAgent) {
        const { data: dbAttachments } = await supabase
          .from("support_ticket_attachments")
          .select("id, file_name, mime_type, size_bytes, created_at, message_id")
          .eq("ticket_id", dbTicket.id)
          .order("created_at", { ascending: true });

        // Non-agents never receive internal-note attachments
        const visibleAttachments = (dbAttachments || []).filter((att) => {
          if (userIsAgent) return true;
          if (att.message_id && internalMessageIds.has(att.message_id)) return false;
          return true;
        });

        attachments = visibleAttachments.map((a) => serializeAttachment(a, userIsAgent));
      }

      const ticketObj = serializeTicket(dbTicket, req.user);

      let statusEvents: any[] = [];
      let elapsedMinutes: number | undefined;

      if (userIsAgent) {
        const { data: dbEvents } = await supabase
          .from("support_ticket_status_events")
          .select("*")
          .eq("ticket_id", dbTicket.id)
          .order("created_at", { ascending: true });

        statusEvents = (dbEvents || []).map((e) => {
          const item = convertObjectToCamelCase(e);
          const isRequester = Boolean(e.changed_by && e.changed_by === dbTicket.requester_id);
          const actorKind = !e.changed_by ? "system" : isRequester ? "requester" : "agent";
          const actorName = !e.changed_by
            ? "System"
            : isRequester
            ? (dbTicket.requester_name || "Requester")
            : req.user && e.changed_by === req.user.id
            ? (resolveUserDisplayName(req.user) || "Support Team")
            : "Support Team";

          return {
            ...item,
            fromStatus: item.fromStatus ?? item.from_status ?? null,
            toStatus: item.toStatus ?? item.to_status,
            oldStatus: item.fromStatus ?? item.from_status ?? null,
            newStatus: item.toStatus ?? item.to_status,
            actorKind,
            actorName,
          };
        });

        const { data: elapsed } = await supabase.rpc("support_elapsed_minutes", {
          p_ticket_id: dbTicket.id,
        });
        elapsedMinutes = typeof elapsed === "number" ? elapsed : 0;
      }

      return res.json({
        success: true,
        ticket: {
          ...ticketObj,
          messages,
          attachments,
          ...(userIsAgent ? { statusEvents, elapsedMinutes } : {}),
        },
        messages,
        attachments,
        ...(userIsAgent ? { statusEvents, elapsedMinutes } : {}),
      });
    } catch (err: any) {
      console.error("GET /tickets/:id unhandled error:", err?.message || err);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);

export default router;
