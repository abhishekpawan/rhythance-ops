import { Router, Request, Response } from "express";
import { validate as validateUuid } from "uuid";
import { authenticateToken } from "../../middleware/auth.js";
import { messageCreateLimiter } from "../../middleware/supportRateLimits.js";
import { supabase } from "../../services/support.db.js";
import {
  isSupportAgent,
  resolveUserDisplayName,
} from "../../services/support.permissions.js";
import {
  serializeTicket,
  serializeMessage,
} from "../../services/support.serializers.js";
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
  sendTicketReopenedEmail,
  sendStatusChangedEmail,
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
        return res.status(400).json({ success: false, error: "body is required" });
      }

      if (body.length > 10000) {
        return res.status(400).json({ success: false, error: "body exceeds 10000 characters" });
      }

      // Validate ALL attachments BEFORE calling the RPC
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        const validation = await validateAttachments(attachments, req.user!.id);
        if (!validation.success) {
          return res.status(400).json({ success: false, error: validation.error });
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

      const { data: message, error } = await supabase.rpc("support_add_message", {
        p_ticket_id: dbTicket.id,
        p_author_id: req.user!.id,
        p_author_name: authorName,
        p_author_kind: authorKind,
        p_body: body.trim(),
        p_is_internal: safeIsInternal,
      });

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
          return res.status(400).json({ success: false, error: attResult.error });
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
            console.error("Fire-and-forget sendRequesterMessageEmail error:", err?.message || err);
          });
        } else if (authorKind === "agent") {
          sendAgentReplyEmail(
            dbTicket,
            body.trim(),
            attachments?.length || 0
          ).catch((err) => {
            console.error("Fire-and-forget sendAgentReplyEmail error:", err?.message || err);
          });
        }
      }

      return res.json({
        success: true,
        message: serializeMessage(message, userIsAgent),
      });
    } catch (err: any) {
      console.error("POST /tickets/:id/messages unhandled error:", err?.message || err);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);

/**
 * POST /api/support/tickets/:id/confirm (owner only)
 * support_change_status -> 'closed', actor_kind 'requester'. Ticket must be resolved.
 */
router.post(
  "/tickets/:id/confirm",
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
      if (!isOwner) {
        return notFoundResponse(res);
      }

      if (dbTicket.status !== "resolved") {
        return res.status(400).json({
          success: false,
          error: "Ticket must be in resolved status to confirm resolution",
        });
      }

      const { data: updatedTicket, error } = await supabase.rpc("support_change_status", {
        p_ticket_id: dbTicket.id,
        p_to_status: "closed",
        p_actor_id: req.user!.id,
        p_actor_kind: "requester",
        p_effort_minutes: null,
      });

      if (error) {
        if (handleDbError(error, res)) return;
        console.error("support_change_status RPC error:", error);
        return res.status(400).json({ success: false, error: error.message });
      }

      return res.json({
        success: true,
        ticket: serializeTicket(updatedTicket, req.user),
      });
    } catch (err: any) {
      console.error("POST /tickets/:id/confirm unhandled error:", err?.message || err);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);

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
      const hasBody = Boolean(body && typeof body === "string" && body.trim().length > 0);

      if (isOwner) {
        const authorName = resolveUserDisplayName(req.user);

        if (hasBody) {
          // Reopen atomically via support_add_message (enforces 14-day window in DB function)
          const { error: msgError } = await supabase.rpc("support_add_message", {
            p_ticket_id: dbTicket.id,
            p_author_id: req.user!.id,
            p_author_name: authorName,
            p_author_kind: "requester",
            p_body: body.trim(),
            p_is_internal: false,
          });

          if (msgError) {
            if (handleDbError(msgError, res)) return;
            console.error("support_add_message reopen RPC error:", msgError);
            return res.status(400).json({ success: false, error: msgError.message });
          }

          // Reload the updated ticket to return in response
          const { data: updatedTicket, error: reloadError } = await supabase
            .from("support_tickets")
            .select("*")
            .eq("id", dbTicket.id)
            .single();

          if (reloadError || !updatedTicket) {
            return res.status(500).json({ success: false, error: "Failed to reload ticket after reopen" });
          }

          // Email the agent when owner reopens
          sendTicketReopenedEmail(
            updatedTicket,
            authorName,
            body.trim()
          ).catch((err) => {
            console.error("Fire-and-forget sendTicketReopenedEmail error:", err?.message || err);
          });

          return res.json({
            success: true,
            ticket: serializeTicket(updatedTicket, req.user),
          });
        } else {
          // Owner with no body: support_change_status to 'in_progress'
          const { data: updatedTicket, error: statusError } = await supabase.rpc("support_change_status", {
            p_ticket_id: dbTicket.id,
            p_to_status: "in_progress",
            p_actor_id: req.user!.id,
            p_actor_kind: "requester",
            p_effort_minutes: null,
          });

          if (statusError) {
            if (handleDbError(statusError, res)) return;
            console.error("support_change_status reopen RPC error:", statusError);
            return res.status(400).json({ success: false, error: statusError.message });
          }

          // Email the agent when owner reopens
          sendTicketReopenedEmail(
            updatedTicket,
            authorName,
            null
          ).catch((err) => {
            console.error("Fire-and-forget sendTicketReopenedEmail error:", err?.message || err);
          });

          return res.json({
            success: true,
            ticket: serializeTicket(updatedTicket, req.user),
          });
        }
      }

      // Agent reopen
      const { data: updatedTicket, error: statusError } = await supabase.rpc("support_change_status", {
        p_ticket_id: dbTicket.id,
        p_to_status: "in_progress",
        p_actor_id: req.user!.id,
        p_actor_kind: "agent",
        p_effort_minutes: null,
      });

      if (statusError) {
        if (handleDbError(statusError, res)) return;
        console.error("support_change_status reopen RPC error:", statusError);
        return res.status(400).json({ success: false, error: statusError.message });
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
          return res.status(400).json({ success: false, error: msgError.message });
        }
      }

      return res.json({
        success: true,
        ticket: serializeTicket(updatedTicket, req.user),
      });
    } catch (err: any) {
      console.error("POST /tickets/:id/reopen unhandled error:", err?.message || err);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);

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

      const { status, priority, title, assignedTo, effortHours } = req.body || {};

      // 1. Validate status (must be one of the five statuses)
      const allowedStatuses = ["open", "in_progress", "waiting_on_client", "resolved", "closed"];
      if (status !== undefined && status !== null && !allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: "status must be one of: open, in_progress, waiting_on_client, resolved, closed",
        });
      }

      // 2. Validate priority (p1, p2, p3)
      const allowedPriorities = ["p1", "p2", "p3"];
      if (priority !== undefined && priority !== null && !allowedPriorities.includes(priority)) {
        return res.status(400).json({
          success: false,
          error: "priority must be p1, p2, or p3",
        });
      }

      // 3. Validate title (1-200 chars)
      if (title !== undefined && title !== null) {
        if (typeof title !== "string" || title.trim().length === 0 || title.length > 200) {
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
      if (status !== undefined && status !== null && status !== dbTicket.status) {
        const { data: statusTicket, error: statusError } = await supabase.rpc("support_change_status", {
          p_ticket_id: dbTicket.id,
          p_to_status: status,
          p_actor_id: req.user!.id,
          p_actor_kind: "agent",
          p_effort_minutes: effortMinutes !== undefined ? effortMinutes : null,
        });

        if (statusError) {
          if (handleDbError(statusError, res)) return;
          console.error("support_change_status RPC error:", statusError);
          return res.status(400).json({ success: false, error: statusError.message });
        }

        currentTicket = statusTicket;

        // Email requester when status becomes waiting_on_client or resolved
        if (status === "waiting_on_client" || status === "resolved") {
          sendStatusChangedEmail(currentTicket, status).catch((err) => {
            console.error("Fire-and-forget sendStatusChangedEmail error:", err?.message || err);
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
      if (effortMinutes !== undefined && (status === undefined || status === null || status === dbTicket.status)) {
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
          return res.status(500).json({ success: false, error: "Failed to update ticket" });
        }

        currentTicket = updatedTicket;
      }

      return res.json({
        success: true,
        ticket: serializeTicket(currentTicket, req.user),
      });
    } catch (err: any) {
      console.error("PATCH /tickets/:id unhandled error:", err?.message || err);
      return res.status(500).json({ success: false, error: "Internal server error" });
    }
  }
);

export default router;
