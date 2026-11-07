import { Router, Request, Response } from "express";
import {
  authenticateToken,
  authorizeRoles,
  hasAccessRole,
} from "../middleware/auth.js";
import {
  countExpiryStatuses,
  type ExpiryProfile,
} from "../services/expiryStatusCounts.js";
import {
  fetchAllRows,
  metricFromSummary,
  summarizeMonthly,
} from "../utils/metricMonths.js";
import { isFeatureEnabled } from "../services/featureFlags.js";
import {
  buildPayrollMetrics,
  summarizePayroll,
  type DashboardMetric,
} from "../services/jobseekerPayroll.js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const router = Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Type definitions
interface Assignment {
  id: string;
  status: string;
  end_date: string | null;
  created_at: string;
}

/**
 * Get expiry status counts for SIN and Work Permit documents
 * GET /api/metrics/jobseekers/expiry-status-counts
 * @access Private (Admin, Recruiter only)
 */
router.get(
  "/expiry-status-counts",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      console.log("Fetching expiry status counts...");

      // Get current date for calculations
      // Every profile's SIN and work permit expiry (paged past the 1000-row cap).
      const profiles = await fetchAllRows<ExpiryProfile>((from, to) =>
        supabase
          .from("jobseeker_profiles")
          .select("id, sin_expiry, work_permit_expiry")
          .order("id", { ascending: true })
          .range(from, to)
      );

      const counts = countExpiryStatuses(profiles);
      console.log("Expiry status counts calculated successfully");

      res.json({ ...counts, generatedAt: new Date().toISOString() });

    } catch (error) {
      console.error("Unexpected error fetching expiry status counts:", error);
      res.status(500).json({
        error: "An unexpected error occurred while fetching expiry status counts"
      });
    }
  }
);

/**
 * Get dashboard metrics for a specific jobseeker
 * GET /api/jobseeker-metrics/:candidateId
 * @access Private (Admin, Recruiter, JobSeeker - limited access for jobseekers)
 */
router.get(
  "/:candidateId",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  async (req: Request, res: Response) => {
    try {
      const { candidateId } = req.params;
      const { timeRange = "12" } = req.query as { timeRange?: string };

      // Jobseekers may only read their own metrics (candidateId is the auth user
      // id). Admins and recruiters can read anyone's.
      const isStaff =
        hasAccessRole(req.user, "admin") || hasAccessRole(req.user, "recruiter");
      if (!isStaff && req.user?.id !== candidateId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const monthsBack = parseInt(timeRange) || 12;

      // Verify candidate exists
      const { data: candidate, error: candidateError } = await supabase
        .from("jobseeker_profiles")
        .select("id, first_name, last_name")
        .eq("user_id", candidateId)
        .single();

      if (candidateError || !candidate) {
        return res.status(404).json({ error: "Candidate not found" });
      }

      // Every assignment of this candidate (paged: Supabase caps a request at 1000
      // rows). The cards are running totals, so they must not be cut to a window.
      const assignments = await fetchAllRows<Assignment>((from, to) =>
        supabase
          .from("position_candidate_assignments")
          .select("id, status, end_date, created_at")
          .eq("candidate_id", candidateId)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to)
      );

      const countStatus = (status: string) =>
        assignments.filter((a) => a.status === status).length;

      // Jobs completed: running total as the headline; the trend compares jobs ended
      // in the last 30 days with the 30 days before (by end date); the chart is monthly.
      const completed = metricFromSummary(
        summarizeMonthly(assignments, {
          getDate: (a) => a.end_date,
          include: (a) => a.status === "completed",
          monthsBack,
        })
      );

      // Build metrics response
      const metrics: DashboardMetric[] = [
        {
          id: "jobs_completed",
          label: "Jobs Completed",
          ...completed,
          unit: "jobs",
          formatType: "number",
          description: "Total number of completed job assignments",
          redirectTo: "/my-positions?status=past"
        },
        {
          id: "active_jobs",
          label: "Active Jobs",
          currentValue: countStatus("active"),
          previousValue: 0, // Active jobs are current state, no historical comparison
          unit: "jobs",
          formatType: "number",
          description: "Currently active job assignments",
          historicalData: [],
          redirectTo: "/my-positions?status=current"
        },
        {
          id: "upcoming_jobs",
          label: "Upcoming Jobs",
          currentValue: countStatus("upcoming"),
          previousValue: 0, // Upcoming jobs are current state
          unit: "jobs",
          formatType: "number",
          description: "Scheduled upcoming job assignments",
          historicalData: [],
          redirectTo: "/my-positions?status=future"
        },
        {
          id: "total_assignments",
          label: "Total Assignments",
          currentValue: assignments.length,
          previousValue: 0, // No month-by-month history kept for this card
          unit: "jobs",
          formatType: "number",
          description: "Total number of job assignments",
          historicalData: [],
          redirectTo: "/my-positions"
        },
      ];

      // "Total No. Hours" and "Gross Amount": only for portals where the
      // jobseeker_payroll_summary feature flag is on.
      if (await isFeatureEnabled("jobseeker_payroll_summary")) {
        const { data: timesheetRows, error: timesheetError } = await supabase
          .from("timesheets")
          .select(
            "week_end_date, total_regular_hours, total_overtime_hours, regular_pay_rate, premium_pay_rate, overtime_pay_rate, bonus_amount, is_bulk, bulk_breakdown"
          )
          .eq("jobseeker_profile_id", candidate.id);

        if (timesheetError) {
          // Do not fail the whole dashboard because of the two payroll cards.
          console.error("Error fetching timesheets for payroll summary:", timesheetError);
        } else {
          metrics.push(
            ...buildPayrollMetrics(summarizePayroll(timesheetRows || []))
          );
        }
      }

      res.json({
        candidate: {
          id: candidate.id,
          firstName: candidate.first_name,
          lastName: candidate.last_name,
        },
        metrics,
      });
    } catch (error) {
      console.error("Unexpected error fetching jobseeker metrics:", error);
      res.status(500).json({
        error: "An unexpected error occurred while fetching metrics",
      });
    }
  }
);

export default router;
