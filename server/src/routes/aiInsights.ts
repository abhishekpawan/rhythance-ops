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

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface PositionRow {
  id: string;
  number_of_positions: number | null;
  is_subcategory: boolean | null;
  created_at: string;
}

/**
 * Every position, paged (Supabase caps one request at 1000 rows). Slots are
 * counted the same way as "Total Position Slots" on the position cards:
 * subcategory positions (mileage, allowances) have no matchable slots.
 */
const fetchAllPositions = () =>
  fetchAllRows<PositionRow>((from, to) =>
    supabase
      .from("positions")
      .select("id, number_of_positions, is_subcategory, created_at")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
  );

// Type definitions for AI insights
interface AIInsightsResponse {
  totalDocumentsScanned: number;
  totalJobseekersMatched: number;
  lastUpdated: string;
  summary: {
    documentsScanned: {
      description: string;
      source: string;
    };
    jobseekersMatched: {
      description: string;
      source: string;
    };
  };
}

interface HistoricalDataPoint {
  period: string;
  value: number;
  date: Date | string;
}

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
  historicalData: HistoricalDataPoint[];
}

interface TimeRange {
  months: number;
  startDate: string;
  endDate: string;
}

interface AIInsightsMetricsResponse {
  metrics: Metric[];
  timeRange: TimeRange;
  scope: string;
}

interface MonthlyAIStats {
  month: string;
  documentsScanned: number;
  jobseekersMatched: number;
}

/**
 * Get AI activity insights
 * GET /api/ai/insights
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/insights",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      // Get total documents scanned by AI from ai_validation table
      const { count: documentsScanned, error: documentsError } = await supabase
        .from("ai_validation")
        .select("*", { count: "exact", head: true });

      if (documentsError) {
        console.error("Error fetching AI validation data:", documentsError);
        return res.status(500).json({ 
          error: "Failed to fetch documents scanned data" 
        });
      }

      // Total position slots (jobseekers matched) from the positions table
      const positions = await fetchAllPositions();
      const totalJobseekersMatched = positions
        .filter((position) => !position.is_subcategory)
        .reduce((sum, position) => sum + (position.number_of_positions || 0), 0);

      const response: AIInsightsResponse = {
        totalDocumentsScanned: documentsScanned || 0,
        totalJobseekersMatched: totalJobseekersMatched,
        lastUpdated: new Date().toISOString(),
        summary: {
          documentsScanned: {
            description: "Total number of documents processed and validated by AI systems",
            source: "ai_validation table - total row count"
          },
          jobseekersMatched: {
            description: "Total number of jobseekers matched by our AI position matching system",
            source: "positions table - sum of number_of_positions field (excluding subcategory positions)"
          }
        }
      };

      res.json(response);
    } catch (error) {
      console.error("Unexpected error fetching AI insights:", error);
      res.status(500).json({
        error: "An unexpected error occurred while fetching AI insights"
      });
    }
  }
);

/**
 * Get AI activity insights with time-based filtering
 * GET /api/ai/insights/timerange?months=6
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/insights/timerange",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { months = "12" } = req.query as { months?: string };
      const monthsBack = parseInt(months) || 12;

      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);

      // Total documents scanned by AI (all time). ai_validation has no created_at,
      // so there is no month-by-month history: the previous value and the chart
      // stay at zero and the card shows "N/A" for the trend instead of a made-up one.
      const { count: totalDocumentsScanned, error: documentsError } = await supabase
        .from("ai_validation")
        .select("*", { count: "exact", head: true });

      if (documentsError) {
        console.error("Error fetching AI validation data:", documentsError);
        return res.status(500).json({
          error: "Failed to fetch documents scanned data"
        });
      }

      const positions = await fetchAllPositions();

      // Running total of position slots as the headline; the trend compares slots
      // added in the last 30 days with the 30 days before; the chart is monthly.
      const slots = metricFromSummary(
        summarizeMonthly(positions, {
          getDate: (position) => position.created_at,
          getValue: (position) => position.number_of_positions || 0,
          include: (position) => !position.is_subcategory,
          monthsBack,
        })
      );
      const documentsHistory = metricFromSummary(
        summarizeMonthly([], { getDate: () => null, monthsBack })
      ).historicalData;

      const metrics = [
        {
          id: "documents_scanned",
          label: "Total Documents Scanned",
          currentValue: totalDocumentsScanned || 0,
          previousValue: 0,
          unit: "documents",
          formatType: "number",
          description: "Total documents processed by AI",
          historicalData: documentsHistory,
        },
        {
          id: "jobseekers_matched",
          label: "Total Jobseekers Matched",
          ...slots,
          unit: "positions",
          formatType: "number",
          description: "Total jobseekers matched, by our AI position matching system",
        },
      ];

      const response: AIInsightsMetricsResponse = {
        metrics,
        timeRange: {
          months: monthsBack,
          startDate: startDate.toISOString(),
          endDate: new Date().toISOString()
        },
        scope: "ai-insights"
      };

      res.json(response);
    } catch (error) {
      console.error("Unexpected error fetching AI insights with time range:", error);
      res.status(500).json({
        error: "An unexpected error occurred while fetching AI insights"
      });
    }
  }
);

export default router; 