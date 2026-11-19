import { Router, Request, Response } from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import { supabase } from "./supabase.js";
import { timesheetWeekWithinRange } from "../../utils/timesheetDateRange.js";
import { checkClientInactive } from "./clientActivity.js";
import { mapTimesheetReportRows } from "./timesheetReportRows.js";

const router = Router();

// POST /api/reports/timesheet
router.post(
  "/timesheet",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { jobseekerIds, clientIds, weekPeriods, payCycles, listNames } =
        req.body || {};
      if (
        !jobseekerIds ||
        !Array.isArray(jobseekerIds) ||
        jobseekerIds.length === 0 ||
        !Array.isArray(weekPeriods) ||
        weekPeriods.length === 0
      ) {
        return res.status(400).json({
          error: "At least one jobseeker and one week period are required.",
        });
      }

      // Build week period filter (OR for each period)
      const weekClauses: string[] = [];
      const params: any[] = [jobseekerIds];
      let paramIdx = 2;
      weekPeriods.forEach((wp: any) => {
        if (wp && wp.start && wp.end) {
          weekClauses.push(
            `(t.week_start_date >= $${paramIdx} AND t.week_end_date <= $${
              paramIdx + 1
            })`
          );
          params.push(wp.start, wp.end);
          paramIdx += 2;
        }
      });
      if (weekClauses.length === 0) {
        return res
          .status(400)
          .json({ error: "At least one valid week period is required." });
      }

      // Additional filters
      let filterSql = "";
      if (clientIds && Array.isArray(clientIds) && clientIds.length > 0) {
        filterSql += ` AND c.id = ANY($${paramIdx}::uuid[])`;
        params.push(clientIds);
        paramIdx++;
      }
      if (payCycles && Array.isArray(payCycles) && payCycles.length > 0) {
        filterSql += ` AND c.pay_cycle = ANY($${paramIdx})`;
        params.push(payCycles);
        paramIdx++;
      }
      if (listNames && Array.isArray(listNames) && listNames.length > 0) {
        filterSql += ` AND c.list_name = ANY($${paramIdx})`;
        params.push(listNames);
        paramIdx++;
      }

      let positionIds: string[] = [];
      let positionsMap: Record<string, any> = {};
      if (clientIds && Array.isArray(clientIds) && clientIds.length > 0) {
        // Fetch full position details for the selected clients to handle bulk timesheets properly
        const { data: positionsData } = await supabase
          .from("positions")
          .select(
            "id, title, position_code, position_category, client_manager, notes, client"
          )
          .in("client", clientIds);
        if (positionsData) {
          positionIds = positionsData.map((p: any) => p.id);
          positionsData.forEach((p: any) => {
            positionsMap[p.id] = p;
          });
        }
      }

      // Use Supabase RPC to run raw SQL (if enabled), otherwise use supabase-js query builder (less flexible for OR logic)
      // For now, use supabase-js query builder for compatibility
      // Fallback: Use supabase-js for most filters, then filter week periods in JS
      const { data, error } = await supabase
        .from("timesheets")
        .select(
          `
          jobseeker_profiles:jobseeker_profile_id (
            employee_id, license_number, passport_number, first_name, last_name, mobile, email, hst_gst, payment_method, cash_deduction, last_activity_at, created_at
          ),
          positions:position_id (
            title, position_code, position_category, client_manager, notes, client
          ),
          week_start_date, week_end_date, total_regular_hours, total_overtime_hours, regular_pay_rate, premium_pay_rate, overtime_pay_rate, total_jobseeker_pay, bonus_amount, deduction_amount, created_at, invoice_number, position_id, line_payment_method, is_bulk, bulk_breakdown
        `
        )
        .in("jobseeker_profile_id", jobseekerIds)
        .order("week_start_date", { ascending: true });

      if (error) {
        console.error("Error fetching timesheet report:", error);
        return res
          .status(500)
          .json({ error: "Failed to fetch timesheet report." });
      }

      // Filter in JS for week periods and other filters
      let filtered = (data || []).filter((row: any) => {
        // Week period match
        const ws = row.week_start_date;
        const we = row.week_end_date;
        const weekMatch = weekPeriods.some((wp: any) =>
          timesheetWeekWithinRange(ws, we, wp.start, wp.end)
        );
        if (!weekMatch) return false;
        // Client filter
        if (clientIds && clientIds.length > 0) {
          let matchesClient = false;
          if (row.positions && clientIds.includes(row.positions.client)) {
            matchesClient = true;
          } else if (
            row.is_bulk &&
            row.bulk_breakdown &&
            Array.isArray(row.bulk_breakdown)
          ) {
            // Check if any position in the bulk breakdown belongs to the selected clients
            const hasMatchingPosition = row.bulk_breakdown.some((bd: any) =>
              positionIds.includes(bd.position_id)
            );
            if (hasMatchingPosition) {
              matchesClient = true;
            }
          }

          if (!matchesClient) return false;
        }
        // Pay cycle
        if (
          payCycles &&
          payCycles.length > 0 &&
          row.positions &&
          row.positions.client_manager
        ) {
          // pay_cycle is on client, not position, so skip here
        }
        // List name
        // (list_name is on client, not available in this join, so skip here)
        return true;
      });

      const result = mapTimesheetReportRows(
        filtered,
        positionIds,
        positionsMap
      );

      // To fill company_name, list_name, currency, pay_cycle, need to fetch client info for all unique client ids
      const clientIdsSet = new Set(
        result.map((row: any) => row.client_id).filter(Boolean)
      );
      let clientInfoMap: Record<string, any> = {};
      if (clientIdsSet.size > 0) {
        const { data: clientsData, error: clientsError } = await supabase
          .from("clients")
          .select(
            "id, company_name, list_name, currency, pay_cycle, last_activity_at, created_at"
          )
          .in("id", Array.from(clientIdsSet));
        if (!clientsError && clientsData) {
          clientsData.forEach((c: any) => {
            clientInfoMap[c.id] = c;
          });
        }
      }
      // Fill in the missing fields
      result.forEach((row: any) => {
        const client = clientInfoMap[row.client_id];
        if (client) {
          row.company_name = client.company_name;
          row.list_name = client.list_name;
          row.currency = client.currency;
          row.pay_cycle = client.pay_cycle;
          row.client_is_inactive = checkClientInactive(
            client.last_activity_at,
            client.created_at
          );
        }
        delete row.client_id; // remove from final output
      });

      // Apply payCycles and listNames filters after merging client info
      const finalFiltered = result.filter((row: any) => {
        if (
          payCycles &&
          payCycles.length > 0 &&
          !payCycles.includes(row.pay_cycle)
        )
          return false;
        if (
          listNames &&
          listNames.length > 0 &&
          !listNames.includes(row.list_name)
        )
          return false;
        return true;
      });

      res.json(finalFiltered);
    } catch (error) {
      console.error("Unexpected error in timesheet report:", error);
      return res.status(500).json({ error: "An unexpected error occurred." });
    }
  }
);

export default router;
