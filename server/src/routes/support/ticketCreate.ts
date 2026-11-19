import { Router, Request, Response } from "express";
import { validate as validateUuid } from "uuid";
import { authenticateToken } from "../../middleware/auth.js";
import { ticketCreateLimiter } from "../../middleware/supportRateLimits.js";
import { supabase } from "../../services/support.db.js";
import {
  isSupportRequester,
  resolveUserDisplayName,
  resolveSupportUserRoles,
} from "../../services/support.permissions.js";
import { serializeTicket } from "../../services/support.serializers.js";
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
        return res
          .status(400)
          .json({ success: false, error: "Valid ticket type is required" });
      }

      const allowedUrgencies = ["blocked", "annoying", "not_urgent"];
      if (!urgency || !allowedUrgencies.includes(urgency)) {
        return res
          .status(400)
          .json({ success: false, error: "Valid urgency is required" });
      }

      if (
        !description ||
        typeof description !== "string" ||
        description.trim().length === 0
      ) {
        return res
          .status(400)
          .json({ success: false, error: "description is required" });
      }

      if (description.length > 10000) {
        return res.status(400).json({
          success: false,
          error: "description exceeds maximum 10000 characters",
        });
      }

      if (!idempotencyKey || !validateUuid(idempotencyKey)) {
        return res.status(400).json({
          success: false,
          error: "Valid idempotencyKey UUID is required",
        });
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
        return res
          .status(500)
          .json({ success: false, error: "Internal server error" });
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
            error:
              "IDEMPOTENCY_CONFLICT: Ticket already exists with a different requester",
            code: "IDEMPOTENCY_CONFLICT",
          });
        }
      }

      // Validate ALL attachments BEFORE calling the RPC
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        const validation = await validateAttachments(attachments, requesterId);
        if (!validation.success) {
          return res
            .status(400)
            .json({ success: false, error: validation.error });
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
      const finalLocale =
        typeof locale === "string" && locale.trim()
          ? locale.trim().slice(0, 10)
          : "en";

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

      const { data: ticket, error } = await supabase.rpc(
        "support_create_ticket",
        baseParams
      );

      if (error) {
        if (handleDbError(error, res)) return;
        console.error("support_create_ticket RPC error:", error);
        return res.status(400).json({ success: false, error: error.message });
      }

      // Insert attachment rows idempotently after RPC succeeds
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        const attResult = await insertAttachmentRows(
          ticket.id,
          null,
          requesterId,
          attachments
        );
        if (!attResult.success) {
          return res
            .status(400)
            .json({ success: false, error: attResult.error });
        }
      }

      // Skip email notification if ticket's created_at is more than 30 seconds old (race replay)
      const ticketAgeMs = Date.now() - new Date(ticket.created_at).getTime();
      if (ticketAgeMs <= 30000) {
        sendNewTicketEmail(
          ticket,
          attachments?.length || 0,
          description.trim()
        ).catch((err) => {
          console.error(
            "Fire-and-forget sendNewTicketEmail error:",
            err?.message || err
          );
        });
      }

      return res.json({
        success: true,
        ticket: serializeTicket(ticket, req.user),
      });
    } catch (err: any) {
      console.error("POST /tickets unhandled error:", err?.message || err);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  }
);

export default router;
