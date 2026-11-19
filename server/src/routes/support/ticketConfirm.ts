import { Router, Request, Response } from "express";
import { validate as validateUuid } from "uuid";
import { authenticateToken } from "../../middleware/auth.js";
import { supabase } from "../../services/support.db.js";
import { serializeTicket } from "../../services/support.serializers.js";
import {
  handleDbError,
  notFoundResponse,
} from "../../services/support.errors.js";

const router = Router();

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

      const { data: updatedTicket, error } = await supabase.rpc(
        "support_change_status",
        {
          p_ticket_id: dbTicket.id,
          p_to_status: "closed",
          p_actor_id: req.user!.id,
          p_actor_kind: "requester",
          p_effort_minutes: null,
        }
      );

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
      console.error(
        "POST /tickets/:id/confirm unhandled error:",
        err?.message || err
      );
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  }
);

export default router;
