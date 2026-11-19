import { Router, Request, Response } from "express";
import { validate as validateUuid } from "uuid";
import { authenticateToken } from "../../middleware/auth.js";
import { supabase } from "../../services/support.db.js";
import {
  isSupportAgent,
  isSupportSharedViewer,
  isSupportAdmin,
  resolveUserDisplayName,
} from "../../services/support.permissions.js";
import {
  convertObjectToCamelCase,
  serializeTicket,
  serializeMessage,
  serializeAttachment,
} from "../../services/support.serializers.js";
import { notFoundResponse } from "../../services/support.errors.js";

const router = Router();

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
        ? dbMessages || []
        : (dbMessages || []).filter((m) => !m.is_internal);

      const messages = filteredMessages.map((m) =>
        serializeMessage(m, userIsAgent)
      );

      // Fetch attachments metadata (id, fileName, mimeType, sizeBytes, createdAt, messageId)
      // Attachments visible only to owner, admin, and agent; sharedViewers who are none get empty list
      let attachments: any[] = [];
      if (isOwner || userIsAdmin || userIsAgent) {
        const { data: dbAttachments } = await supabase
          .from("support_ticket_attachments")
          .select(
            "id, file_name, mime_type, size_bytes, created_at, message_id"
          )
          .eq("ticket_id", dbTicket.id)
          .order("created_at", { ascending: true });

        // Non-agents never receive internal-note attachments
        const visibleAttachments = (dbAttachments || []).filter((att) => {
          if (userIsAgent) return true;
          if (att.message_id && internalMessageIds.has(att.message_id))
            return false;
          return true;
        });

        attachments = visibleAttachments.map((a) =>
          serializeAttachment(a, userIsAgent)
        );
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
          const isRequester = Boolean(
            e.changed_by && e.changed_by === dbTicket.requester_id
          );
          const actorKind = !e.changed_by
            ? "system"
            : isRequester
              ? "requester"
              : "agent";
          const actorName = !e.changed_by
            ? "System"
            : isRequester
              ? dbTicket.requester_name || "Requester"
              : req.user && e.changed_by === req.user.id
                ? resolveUserDisplayName(req.user) || "Support Team"
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

        const { data: elapsed } = await supabase.rpc(
          "support_elapsed_minutes",
          {
            p_ticket_id: dbTicket.id,
          }
        );
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
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  }
);

export default router;
