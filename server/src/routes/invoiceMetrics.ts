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

interface InvoiceRow {
  id: string;
  grand_total: number | string | null;
  total_hours: number | string | null;
  email_sent: boolean | null;
  created_at: string;
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
  redirectTo?: string;
}

/**
 * Get aggregate invoice metrics for admin/recruiter dashboard
 * GET /api/invoice-metrics
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      // Every invoice (paged: Supabase caps one request at 1000 rows).
      const invoices = await fetchAllRows<InvoiceRow>((from, to) =>
        supabase
          .from("invoices")
          .select("id, grand_total, total_hours, email_sent, created_at")
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to)
      );

      // Each card: running total over all time as the headline; the trend compares
      // what was added in the last 30 days with the 30 days before; the chart is monthly.
      const summarize = (
        getValue?: (inv: InvoiceRow) => number,
        include?: (inv: InvoiceRow) => boolean
      ) =>
        metricFromSummary(
          summarizeMonthly(invoices, {
            getDate: (inv) => inv.created_at,
            getValue,
            include,
          })
        );

      const metrics: Metric[] = [
        {
          id: "total_invoices",
          label: "Total Invoices Created",
          ...summarize(),
          unit: "invoices",
          formatType: "number",
          description: "Total number of invoices created",
          redirectTo: "/invoice-management/list",
        },
        {
          id: "total_billed",
          label: "Total Billed (Grand Total)",
          ...summarize((inv) => Number(inv.grand_total) || 0),
          unit: "currency",
          formatType: "currency",
          description: "Sum of all grand totals from invoices",
          redirectTo: "/invoice-management/list",
        },
        {
          id: "total_hours_billed",
          label: "Total Hours Billed",
          ...summarize((inv) => Number(inv.total_hours) || 0),
          unit: "hours",
          formatType: "number",
          description: "Sum of all hours billed from invoices",
          redirectTo: "/invoice-management/list",
        },
        {
          id: "invoices_with_email",
          label: "Invoices with Email Sent",
          ...summarize(undefined, (inv) => Boolean(inv.email_sent)),
          unit: "invoices",
          formatType: "number",
          description: "Total invoices sent to client via email",
          redirectTo: "/invoice-management/list?emailSent=true",
        },
        {
          id: "invoices_without_email",
          label: "Invoices with No Email Sent",
          ...summarize(undefined, (inv) => !inv.email_sent),
          unit: "invoices",
          formatType: "number",
          description: "Total Invoices not sent to client via email",
          redirectTo: "/invoice-management/list?emailSent=false",
        },
      ];

      res.json({ metrics });
    } catch (error) {
      console.error("Unexpected error fetching invoice metrics:", error);
      res.status(500).json({ error: "An unexpected error occurred while fetching invoice metrics" });
    }
  }
);

export default router;
