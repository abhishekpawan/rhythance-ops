import { Router, Request, Response } from "express";
import { validate as validateUuid } from "uuid";
import { authenticateToken } from "../../middleware/auth.js";
import { supabase } from "../../services/support.db.js";
import {
  isSupportAgent,
  resolveUserDisplayName,
} from "../../services/support.permissions.js";
import { serializeTicket } from "../../services/support.serializers.js";
import {
  handleDbError,
  notFoundResponse,
} from "../../services/support.errors.js";
import { sendTicketReopenedEmail } from "../../services/support.email.js";

const router = Router();

/**
 * POST /api/support/tickets/:id/reopen (owner or agent)
 * If owner + body: call support_add_message ONCE (reopens atomically with 14-day window).
 * If owner + no body: call support_change_status.
 * If agent: call support_change_status; if follow-up message fails, return error immediately.
 */
router.post(
  "/tickets/:id/reopen",
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

      const userIsAgent = isSupportAgent(req.user);
      const isOwner = dbTicket.requester_id === req.user!.id;

      if (!userIsAgent && !isOwner) {
        return notFoundResponse(res);
      }

      if (dbTicket.status !== "resolved" && dbTicket.status !== "closed") {
        return res.status(409).json({
          success: false,
          error: "Ticket is not resolved or closed",
          code: "INVALID_TRANSITION",
        });
      }

      const { body } = req.body || {};
      const hasBody = Boolean(
        body && typeof body === "string" && body.trim().length > 0
      );

      if (isOwner) {
        const authorName = resolveUserDisplayName(req.user);

        if (hasBody) {
          // Reopen atomically via support_add_message (enforces 14-day window in DB function)
          const { error: msgError } = await supabase.rpc(
            "support_add_message",
            {
              p_ticket_id: dbTicket.id,
              p_author_id: req.user!.id,
              p_author_name: authorName,
              p_author_kind: "requester",
              p_body: body.trim(),
              p_is_internal: false,
            }
          );

          if (msgError) {
            if (handleDbError(msgError, res)) return;
            console.error("support_add_message reopen RPC error:", msgError);
            return res
              .status(400)
              .json({ success: false, error: msgError.message });
          }

          // Reload the updated ticket to return in response
          const { data: updatedTicket, error: reloadError } = await supabase
            .from("support_tickets")
            .select("*")
            .eq("id", dbTicket.id)
            .single();

          if (reloadError || !updatedTicket) {
            return res.status(500).json({
              success: false,
              error: "Failed to reload ticket after reopen",
            });
          }

          // Email the agent when owner reopens
          sendTicketReopenedEmail(updatedTicket, authorName, body.trim()).catch(
            (err) => {
              console.error(
                "Fire-and-forget sendTicketReopenedEmail error:",
                err?.message || err
              );
            }
          );

          return res.json({
            success: true,
            ticket: serializeTicket(updatedTicket, req.user),
          });
        } else {
          // Owner with no body: support_change_status to 'in_progress'
          const { data: updatedTicket, error: statusError } =
            await supabase.rpc("support_change_status", {
              p_ticket_id: dbTicket.id,
              p_to_status: "in_progress",
              p_actor_id: req.user!.id,
              p_actor_kind: "requester",
              p_effort_minutes: null,
            });

          if (statusError) {
            if (handleDbError(statusError, res)) return;
            console.error(
              "support_change_status reopen RPC error:",
              statusError
            );
            return res
              .status(400)
              .json({ success: false, error: statusError.message });
          }

          // Email the agent when owner reopens
          sendTicketReopenedEmail(updatedTicket, authorName, null).catch(
            (err) => {
              console.error(
                "Fire-and-forget sendTicketReopenedEmail error:",
                err?.message || err
              );
            }
          );

          return res.json({
            success: true,
            ticket: serializeTicket(updatedTicket, req.user),
          });
        }
      }

      // Agent reopen
      const { data: updatedTicket, error: statusError } = await supabase.rpc(
        "support_change_status",
        {
          p_ticket_id: dbTicket.id,
          p_to_status: "in_progress",
          p_actor_id: req.user!.id,
          p_actor_kind: "agent",
          p_effort_minutes: null,
        }
      );

      if (statusError) {
        if (handleDbError(statusError, res)) return;
        console.error("support_change_status reopen RPC error:", statusError);
        return res
          .status(400)
          .json({ success: false, error: statusError.message });
      }

      // If follow-up message fails for agent, return error instead of swallowing it
      if (hasBody) {
        const authorName = "Support Team";
        const { error: msgError } = await supabase.rpc("support_add_message", {
          p_ticket_id: dbTicket.id,
          p_author_id: req.user!.id,
          p_author_name: authorName,
          p_author_kind: "agent",
          p_body: body.trim(),
          p_is_internal: false,
        });

        if (msgError) {
          if (handleDbError(msgError, res)) return;
          console.error("Error adding message on agent reopen:", msgError);
          return res
            .status(400)
            .json({ success: false, error: msgError.message });
        }
      }

      return res.json({
        success: true,
        ticket: serializeTicket(updatedTicket, req.user),
      });
    } catch (err: any) {
      console.error(
        "POST /tickets/:id/reopen unhandled error:",
        err?.message || err
      );
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  }
);

export default router;
