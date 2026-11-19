import { Router, Request, Response } from "express";
import { validate as validateUuid } from "uuid";
import { authenticateToken } from "../../middleware/auth.js";
import { supabase } from "../../services/support.db.js";
import { isSupportAgent } from "../../services/support.permissions.js";
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
 * Validates ALL fields before any RPC or update.
 * effort_minutes = round(hours * 60). Status goes through support_change_status.
 * If effortHours is provided and status is undefined or unchanged, saves effort_minutes as plain update.
 */
router.patch(
  "/tickets/:id",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      if (!isSupportAgent(req.user)) {
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

      const { status, priority, title, assignedTo, effortHours } =
        req.body || {};

      // 1. Validate status (must be one of the five statuses)
      const allowedStatuses = [
        "open",
        "in_progress",
        "waiting_on_client",
        "resolved",
        "closed",
      ];
      if (
        status !== undefined &&
        status !== null &&
        !allowedStatuses.includes(status)
      ) {
        return res.status(400).json({
          success: false,
          error:
            "status must be one of: open, in_progress, waiting_on_client, resolved, closed",
        });
      }

      // 2. Validate priority (p1, p2, p3)
      const allowedPriorities = ["p1", "p2", "p3"];
      if (
        priority !== undefined &&
        priority !== null &&
        !allowedPriorities.includes(priority)
      ) {
        return res.status(400).json({
          success: false,
          error: "priority must be p1, p2, or p3",
        });
      }

      // 3. Validate title (1-200 chars)
      if (title !== undefined && title !== null) {
        if (
          typeof title !== "string" ||
          title.trim().length === 0 ||
          title.length > 200
        ) {
          return res.status(400).json({
            success: false,
            error: "title must be between 1 and 200 characters",
          });
        }
      }

      // 4. Validate assignedTo (valid UUID or null)
      if (assignedTo !== undefined) {
        if (assignedTo !== null && !validateUuid(assignedTo)) {
          return res.status(400).json({
            success: false,
            error: "assignedTo must be a valid UUID or null",
          });
        }
      }

      // 5. Validate effortHours (number between 0 and 1000)
      let effortMinutes: number | undefined;
      if (effortHours !== undefined && effortHours !== null) {
        const hours = Number(effortHours);
        if (isNaN(hours) || hours < 0 || hours > 1000) {
          return res.status(400).json({
            success: false,
            error: "effortHours must be a number between 0 and 1000",
          });
        }
        effortMinutes = Math.round(hours * 60);
      }

      // ALL validations passed. Apply mutations.
      let currentTicket = dbTicket;

      // Handle status change through support_change_status
      if (
        status !== undefined &&
        status !== null &&
        status !== dbTicket.status
      ) {
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
        if (status === "waiting_on_client" || status === "resolved") {
          sendStatusChangedEmail(currentTicket, status).catch((err) => {
            console.error(
              "Fire-and-forget sendStatusChangedEmail error:",
              err?.message || err
            );
          });
        }
      }

      // Handle plain field updates
      const plainUpdates: Record<string, any> = {};

      if (priority !== undefined && priority !== null) {
        plainUpdates.priority = priority;
      }

      if (title !== undefined && title !== null) {
        plainUpdates.title = title.trim();
      }

      if (assignedTo !== undefined) {
        plainUpdates.assigned_to = assignedTo;
      }

      // If effortHours is provided and status is undefined OR equal to ticket's current status,
      // save effort_minutes as a plain update
      if (
        effortMinutes !== undefined &&
        (status === undefined || status === null || status === dbTicket.status)
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
