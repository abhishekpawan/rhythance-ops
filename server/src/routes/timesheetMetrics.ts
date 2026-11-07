import { Router, Request, Response } from "express";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";
import {
  fetchAllRows,
  metricFromSummary,
  summarizeMonthly,
} from "../utils/metricMonths.js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface TimesheetRow {
  id: string;
  total_jobseeker_pay: number | string | null;
  bonus_amount: number | string | null;
  deduction_amount: number | string | null;
  total_regular_hours: number | string | null;
  total_overtime_hours: number | string | null;
  created_at: string;
  positions: {
    is_subcategory: boolean | null;
    subcategory_position: string | null;
  } | null;
}

// Metric type definition
interface Metric {
  id: string;
  label: string;
  currentValue: number;
  currentPeriodValue?: number;
  dailyData?: Array<{ date: string; value: number; previousValue: number }>;
  previousValue: number;
  unit: string;
  formatType: string;
  description: string;
  historicalData: Array<{
    period: string;
    value: number;
    date: Date | string;
  }>;
}

/**
 * Get aggregate timesheet metrics for admin/recruiter dashboard
 * GET /api/timesheet-metrics
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      // Every timesheet with its position's subcategory info (paged: Supabase
      // caps one request at 1000 rows).
      const timesheets = await fetchAllRows<TimesheetRow>((from, to) =>
        supabase
          .from("timesheets")
          .select(
            "id, total_jobseeker_pay, bonus_amount, deduction_amount, total_regular_hours, total_overtime_hours, created_at, positions(is_subcategory, subcategory_position)"
          )
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{
          data: TimesheetRow[] | null;
          error: { message: string } | null;
        }>
      );

      const num = (value: unknown) => Number(value) || 0;
      const isSubcategory = (ts: TimesheetRow) =>
        Boolean(ts.positions?.is_subcategory);
      const isMiles = (ts: TimesheetRow) =>
        isSubcategory(ts) &&
        String(ts.positions?.subcategory_position || "")
          .trim()
          .toLowerCase()
          .startsWith("miles");

      // Each card: running total over all time as the headline; the trend compares
      // what was added in the last 30 days with the 30 days before; the chart is monthly.
      const summarize = (
        getValue?: (ts: TimesheetRow) => number,
        include?: (ts: TimesheetRow) => boolean
      ) =>
        metricFromSummary(
          summarizeMonthly(timesheets, {
            getDate: (ts) => ts.created_at,
            getValue,
            include,
          })
        );

      // Labor hours are kept apart from subcategory mileage/allowance units.
      const metrics: Metric[] = [
        {
          id: "total_timesheets",
          label: "Total Timesheets Submitted",
          ...summarize(),
          unit: "timesheets",
          formatType: "number",
          description: "Total number of timesheets submitted",
        },
        {
          id: "total_jobseeker_pay",
          label: "Total Jobseeker Pay",
          ...summarize((ts) => num(ts.total_jobseeker_pay)),
          unit: "currency",
          formatType: "currency",
          description: "Sum of all jobseeker pay from timesheets",
        },
        {
          id: "total_bonus_paid",
          label: "Total Bonus Paid",
          ...summarize((ts) => num(ts.bonus_amount)),
          unit: "currency",
          formatType: "currency",
          description: "Sum of all bonuses paid from timesheets",
        },
        {
          id: "total_deduction",
          label: "Total Deduction",
          ...summarize((ts) => num(ts.deduction_amount)),
          unit: "currency",
          formatType: "currency",
          description: "Sum of all deductions from timesheets",
        },
        {
          id: "total_regular_hours",
          label: "Total Regular Hours",
          ...summarize((ts) => num(ts.total_regular_hours), (ts) => !isSubcategory(ts)),
          unit: "hours",
          formatType: "number",
          description: "Sum of all regular labor hours from timesheets (excludes subcategories)",
        },
        {
          id: "total_overtime_hours",
          label: "Total Overtime Hours",
          ...summarize((ts) => num(ts.total_overtime_hours), (ts) => !isSubcategory(ts)),
          unit: "hours",
          formatType: "number",
          description: "Sum of all overtime labor hours from timesheets",
        },
        {
          id: "total_miles_logged",
          label: "Total Miles Logged",
          ...summarize((ts) => num(ts.total_regular_hours), isMiles),
          unit: "miles",
          formatType: "number",
          description: "Total miles driven from mileage subcategory timesheets",
        },
        {
          id: "total_non_hourly_units",
          label: "Total Allowance / Stop Units",
          ...summarize(
            (ts) => num(ts.total_regular_hours),
            (ts) => isSubcategory(ts) && !isMiles(ts)
          ),
          unit: "units",
          formatType: "number",
          description: "Total non-hourly units (stops, layovers, meal credits) from subcategory timesheets",
        },
      ];

      res.json({ metrics });
    } catch (error) {
      console.error("Unexpected error fetching timesheet metrics:", error);
      res.status(500).json({ error: "An unexpected error occurred while fetching timesheet metrics" });
    }
  }
);

export default router;
