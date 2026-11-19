import { Router, Request, Response } from "express";
import { validate as validateUuid } from "uuid";
import { authenticateToken } from "../../middleware/auth.js";
import { messageCreateLimiter } from "../../middleware/supportRateLimits.js";
import { supabase } from "../../services/support.db.js";
import {
  isSupportAgent,
  resolveUserDisplayName,
} from "../../services/support.permissions.js";
import { serializeMessage } from "../../services/support.serializers.js";
import {
  validateAttachments,
  insertAttachmentRows,
} from "../../services/support.attachments.js";
import {
  handleDbError,
  notFoundResponse,
} from "../../services/support.errors.js";
import {
  sendRequesterMessageEmail,
  sendAgentReplyEmail,
} from "../../services/support.email.js";

const router = Router();

/**
 * POST /api/support/tickets/:id/messages
 * Only owner (as requester) or agent (as agent) may post.
 * Validates attachments before RPC. Serializes response with allow-list.
 */
router.post(
  "/tickets/:id/messages",
  authenticateToken,
  messageCreateLimiter,
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

      const userIsAgent = isSupportAgent(req.user);
      const isOwner = dbTicket.requester_id === req.user!.id;

      if (!userIsAgent && !isOwner) {
        return notFoundResponse(res);
      }

      const { body, isInternal, attachments } = req.body || {};

      if (!body || typeof body !== "string" || body.trim().length === 0) {
        return res
          .status(400)
          .json({ success: false, error: "body is required" });
      }

      if (body.length > 10000) {
        return res
          .status(400)
          .json({ success: false, error: "body exceeds 10000 characters" });
      }

      // Validate ALL attachments BEFORE calling the RPC
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        const validation = await validateAttachments(attachments, req.user!.id);
        if (!validation.success) {
          return res
            .status(400)
            .json({ success: false, error: validation.error });
        }
      }

      let authorKind: string;
      let authorName: string;
      let safeIsInternal = false;

      if (userIsAgent) {
        authorKind = "agent";
        authorName = "Support Team";
        safeIsInternal = Boolean(isInternal);
      } else {
        authorKind = "requester";
        authorName = resolveUserDisplayName(req.user);
        safeIsInternal = false; // Requester can never post internal notes
      }

      const { data: message, error } = await supabase.rpc(
        "support_add_message",
        {
          p_ticket_id: dbTicket.id,
          p_author_id: req.user!.id,
          p_author_name: authorName,
          p_author_kind: authorKind,
          p_body: body.trim(),
          p_is_internal: safeIsInternal,
        }
      );

      if (error) {
        if (handleDbError(error, res)) return;
        console.error("support_add_message RPC error:", error);
        return res.status(400).json({ success: false, error: error.message });
      }

      // Insert attachment rows after RPC succeeds
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        const attResult = await insertAttachmentRows(
          dbTicket.id,
          message.id,
          req.user!.id,
          attachments
        );
        if (!attResult.success) {
          return res
            .status(400)
            .json({ success: false, error: attResult.error });
        }
      }

      // Email notifications (internal notes NEVER trigger an email)
      if (!safeIsInternal) {
        if (authorKind === "requester") {
          sendRequesterMessageEmail(
            dbTicket,
            authorName,
            body.trim(),
            attachments?.length || 0
          ).catch((err) => {
            console.error(
              "Fire-and-forget sendRequesterMessageEmail error:",
              err?.message || err
            );
          });
        } else if (authorKind === "agent") {
          sendAgentReplyEmail(
            dbTicket,
            body.trim(),
            attachments?.length || 0
          ).catch((err) => {
            console.error(
              "Fire-and-forget sendAgentReplyEmail error:",
              err?.message || err
            );
          });
        }
      }

      return res.json({
        success: true,
        message: serializeMessage(message, userIsAgent),
      });
    } catch (err: any) {
      console.error(
        "POST /tickets/:id/messages unhandled error:",
        err?.message || err
      );
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  }
);

export default router;
