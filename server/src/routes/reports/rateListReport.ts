import { Router, Request, Response } from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import { supabase } from "./supabase.js";
import { checkClientInactive } from "./clientActivity.js";

const router = Router();

// POST /api/reports/rate-list
router.post(
  "/rate-list",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { clientIds } = req.body || {};

      // Build query with optional client filter
      let query = supabase
        .from("positions")
        .select(
          `
          id,
          title,
          position_code,
          position_number,
          position_category,
          regular_pay_rate,
          premium_pay_rate,
          bill_rate,
          overtime_hours,
          overtime_pay_rate,
          overtime_bill_rate,
          client_name,
          client:clients (
            id,
            company_name,
            last_activity_at,
            created_at
          )
        `
        )
        .eq("is_draft", false);

      // Apply client filter if provided
      if (clientIds && Array.isArray(clientIds) && clientIds.length > 0) {
        query = query.in("client", clientIds);
      }

      const { data: positions, error } = await query.order("client_name", {
        ascending: true,
      });

      if (error) {
        console.error("Error fetching rate list:", error);
        return res.status(500).json({ error: "Failed to fetch rate list." });
      }

      // Transform the data for the frontend
      const rateListData = (positions || []).map((position: any) => {
        const client = position.client || {};

        return {
          client_name: position.client_name || client.company_name || "N/A",
          position_details: `${position.title || "N/A"} [${
            position.position_code || "N/A"
          } - ${position.position_number || "N/A"}]`,
          position_category: position.position_category || "N/A",
          bill_rate: position.bill_rate || "N/A",
          pay_rate: position.regular_pay_rate || "N/A",
          premium_pay_rate: position.premium_pay_rate || "N/A",
          overtime_hours: position.overtime_hours || "N/A",
          overtime_bill_rate: position.overtime_bill_rate || "N/A",
          overtime_pay_rate: position.overtime_pay_rate || "N/A",
          client_is_inactive: checkClientInactive(
            client.last_activity_at,
            client.created_at
          ),
        };
      });

      res.json(rateListData);
    } catch (error) {
      console.error("Unexpected error in rate list:", error);
      return res.status(500).json({ error: "An unexpected error occurred." });
    }
  }
);

export default router;
