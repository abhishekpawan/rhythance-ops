import { Router, Request, Response } from "express";
import { authenticateToken } from "../../middleware/auth.js";
import { supabase } from "../../services/support.db.js";
import {
  isSupportAgent,
  isSupportRequester,
  isSupportSharedViewer,
} from "../../services/support.permissions.js";
import { serializeTicket } from "../../services/support.serializers.js";
import { notFoundResponse } from "../../services/support.errors.js";
import { DbSupportTicket } from "../../types.js";

const router = Router();

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

      let query = supabase
        .from("support_tickets")
        .select("*", { count: "exact" });

      if (scope === "mine") {
        query = query.eq("requester_id", req.user!.id);
      }

      if (
        req.query.status &&
        typeof req.query.status === "string" &&
        req.query.status.trim()
      ) {
        query = query.eq("status", req.query.status.trim());
      }

      query = query.order("updated_at", { ascending: false });

      const pageNum = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limitNum = Math.max(
        1,
        Math.min(100, parseInt(req.query.limit as string, 10) || 10)
      );
      const offset = (pageNum - 1) * limitNum;

      query = query.range(offset, offset + limitNum - 1);

      const { data: rawTickets, count, error } = await query;

      if (error) {
        console.error("Error fetching support tickets:", error);
        return res
          .status(500)
          .json({ success: false, error: "Failed to fetch tickets" });
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      const tickets = (rawTickets || []).map((t: DbSupportTicket) =>
        serializeTicket(t, req.user)
      );

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
      return res
        .status(500)
        .json({ success: false, error: "Internal server error" });
    }
  }
);

export default router;
