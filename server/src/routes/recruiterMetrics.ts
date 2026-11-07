import { Router, Request, Response } from "express";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";
import {
  buildClientMetrics,
  buildPositionMetrics,
  buildProfileMetrics,
} from "../services/recruiterMetrics.js";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const router = Router();

// How each card is calculated: see services/recruiterMetrics.ts.

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/** Number of chart months requested by the client (default 12). */
const parseMonthsBack = (req: Request): number => {
  const { timeRange = "12" } = req.query as { timeRange?: string };
  const months = parseInt(timeRange);
  return Number.isFinite(months) && months > 0 ? Math.min(months, 60) : 12;
};

const timeRangeInfo = (monthsBack: number) => {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsBack);
  return {
    months: monthsBack,
    startDate: startDate.toISOString(),
    endDate: new Date().toISOString(),
  };
};

/** Looks the recruiter up in Supabase Auth; null when the id does not exist. */
async function getRecruiterInfo(recruiterId: string) {
  const { data, error } = await supabase.auth.admin.getUserById(recruiterId);
  if (error || !data?.user) return null;
  const user = data.user;
  return {
    id: user.id,
    email: user.email || "",
    name:
      user.user_metadata?.name ||
      `${user.user_metadata?.firstName || ""} ${
        user.user_metadata?.lastName || ""
      }`.trim() ||
      "Unknown",
  };
}

/* ------------------------------------ Routes ------------------------------------ */

type MetricsBuilder = (
  monthsBack: number,
  recruiterId?: string
) => Promise<unknown[]>;

/** One handler for the "all recruiters" and "one recruiter" variant of a route. */
const metricsHandler =
  (build: MetricsBuilder, errorLabel: string) =>
  async (req: Request, res: Response) => {
    try {
      const { recruiterId } = req.params;
      const monthsBack = parseMonthsBack(req);

      let recruiter = null;
      if (recruiterId) {
        recruiter = await getRecruiterInfo(recruiterId);
        if (!recruiter) {
          return res.status(404).json({ error: "Recruiter not found" });
        }
      }

      const metrics = await build(monthsBack, recruiterId);

      res.json({
        metrics,
        timeRange: timeRangeInfo(monthsBack),
        scope: recruiterId ? "recruiter-specific" : "all-recruiters",
        ...(recruiter ? { recruiter } : {}),
      });
    } catch (error) {
      console.error(`Unexpected error fetching ${errorLabel} metrics:`, error);
      res.status(500).json({
        error: `An unexpected error occurred while fetching ${errorLabel} metrics`,
      });
    }
  };

const guard = [authenticateToken, authorizeRoles(["admin", "recruiter"])];

/**
 * GET /api/metrics/recruiters/clients           (all recruiters)
 * GET /api/metrics/recruiters/clients/:recruiterId
 * @access Private (Admin, Recruiter)
 */
router.get("/clients", ...guard, metricsHandler(buildClientMetrics, "client"));
router.get(
  "/clients/:recruiterId",
  ...guard,
  metricsHandler(buildClientMetrics, "client")
);

/**
 * GET /api/metrics/recruiters/positions           (all recruiters)
 * GET /api/metrics/recruiters/positions/:recruiterId
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/positions",
  ...guard,
  metricsHandler(buildPositionMetrics, "position")
);
router.get(
  "/positions/:recruiterId",
  ...guard,
  metricsHandler(buildPositionMetrics, "position")
);

/**
 * GET /api/metrics/recruiters                    (all recruiters)
 * GET /api/metrics/recruiters/:recruiterId       (one recruiter)
 * Declared last so it does not swallow "clients" and "positions".
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/:recruiterId?",
  ...guard,
  metricsHandler(buildProfileMetrics, "recruiter")
);

export default router;
