import { Router, Request, Response } from "express";
import { validate as validateUuid } from "uuid";
import { authenticateToken } from "../../middleware/auth.js";
import { supabase } from "../../services/support.db.js";
import { patchableTicketFields } from "../../services/support.permissions.js";
import {
  parseTicketPatch,
  STATUS_TELLS_REQUESTER,
} from "../../services/support.patchFields.js";
import { serializeTicket } from "../../services/support.serializers.js";
import {
  handleDbError,
  notFoundResponse,
} from "../../services/support.errors.js";
import { sendStatusChangedEmail } from "../../services/support.email.js";

const router = Router();

/**
 * PATCH /api/support/tickets/:id (agent only)
 * optional { status, priority, title, assignedTo, effortHours }.
 * Who may change which field is the table in support.permissions.ts, and what each field accepts is the table in
 * support.patchFields.ts. Validates ALL fields before any RPC or update.
 * effort_minutes = round(hours * 60). Status goes through support_change_status.
 * If effortHours is provided and status is undefined or unchanged, saves effort_minutes as plain update.
 */
router.patch(
  "/tickets/:id",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const allowedFields = patchableTicketFields(req.user);
      if (allowedFields.length === 0) {
        return notFoundResponse(res);
      }

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

      const patch = parseTicketPatch(req.body || {}, allowedFields);
      if (!patch.ok) {
        return res.status(400).json({ success: false, error: patch.error });
      }
      const { status, columns, effortMinutes } = patch;

      // ALL validations passed. Apply mutations.
      let currentTicket = dbTicket;

      // Handle status change through support_change_status
      if (status !== undefined && status !== dbTicket.status) {
        const { data: statusTicket, error: statusError } = await supabase.rpc(
          "support_change_status",
          {
            p_ticket_id: dbTicket.id,
            p_to_status: status,
            p_actor_id: req.user!.id,
            p_actor_kind: "agent",
            p_effort_minutes:
              effortMinutes !== undefined ? effortMinutes : null,
          }
        );

        if (statusError) {
          if (handleDbError(statusError, res)) return;
          console.error("support_change_status RPC error:", statusError);
          return res
            .status(400)
            .json({ success: false, error: statusError.message });
        }

        currentTicket = statusTicket;

        // Email requester when status becomes waiting_on_client or resolved
        if (STATUS_TELLS_REQUESTER.has(status)) {
          sendStatusChangedEmail(currentTicket, status).catch((err) => {
            console.error(
              "Fire-and-forget sendStatusChangedEmail error:",
              err?.message || err
            );
          });
        }
      }

      // Handle plain field updates. If effortHours is provided and status is undefined OR equal to the ticket's
      // current status, effort_minutes is saved as a plain update.
      const plainUpdates: Record<string, unknown> = { ...columns };
      if (
        effortMinutes !== undefined &&
        (status === undefined || status === dbTicket.status)
      ) {
        plainUpdates.effort_minutes = effortMinutes;
      }

      if (Object.keys(plainUpdates).length > 0) {
        const { data: updatedTicket, error: updateError } = await supabase
          .from("support_tickets")
          .update(plainUpdates)
          .eq("id", dbTicket.id)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating ticket fields:", updateError);
          return res
            .status(500)
            .json({ success: false, error: "Failed to update ticket" });
        }

        currentTicket = updatedTicket;
      }

      return res.json({
        success: true,
        ticket: serializeTicket(currentTicket, req.user),
      });
    } catch (err: any) {
      console.error("PATCH /tickets/:id unhandled error:", err?.message || err);
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  }
);

export default router;
