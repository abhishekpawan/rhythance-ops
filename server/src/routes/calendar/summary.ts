import { Router, Request, Response } from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import { sanitizeInputs } from "../../middleware/security.js";
import { supabase } from "./supabase.js";

const router = Router();

/**
 * GET /api/calendar/summary
 * Fetch calendar summary statistics for a date range
 * Query parameters:
 * - startDate: string (YYYY-MM-DD) - required
 * - endDate: string (YYYY-MM-DD) - required
 * - clientId: string (UUID) - optional filter
 * - jobseekerId: string (UUID) - optional filter
 */
router.get(
  "/summary",
  // apiRateLimiter,
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  sanitizeInputs,
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, clientId, jobseekerId } = req.query;

      // Validate required parameters
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: "startDate and endDate are required parameters",
        });
      }

      // Validate date format (basic check)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (
        !dateRegex.test(startDate as string) ||
        !dateRegex.test(endDate as string)
      ) {
        return res.status(400).json({
          success: false,
          message: "Dates must be in YYYY-MM-DD format",
        });
      }

      // Build the query to get positions with their assignments (exclude subcategories)
      let positionsQuery = supabase
        .from("positions")
        .select(
          `
          id,
          title,
          start_date,
          end_date,
          number_of_positions,
          client:clients!positions_client_fkey (
            id,
            company_name
          )
        `
        )
        .eq("is_draft", false)
        .eq("is_subcategory", false)
        .gte("end_date", startDate)
        .lte("start_date", endDate);

      // Apply client filter if provided
      if (clientId) {
        positionsQuery = positionsQuery.eq("client", clientId);
      }

      const { data: positions, error: positionsError } = await positionsQuery;

      if (positionsError) {
        console.error("Error fetching positions:", positionsError);
        return res.status(500).json({
          success: false,
          message: "Failed to fetch calendar summary data",
        });
      }

      if (!positions || positions.length === 0) {
        return res.json({
          success: true,
          data: {
            totalPositions: 0,
            totalJobseekers: 0,
            activeAssignments: 0,
            availablePositions: 0,
            fillRate: 0,
            statusBreakdown: {
              active: 0,
              upcoming: 0,
              completed: 0,
              cancelled: 0,
            },
            dateRange: {
              startDate: startDate as string,
              endDate: endDate as string,
            },
          },
        });
      }

      // Get position IDs for fetching assignments
      const positionIds = positions.map((p) => p.id);

      // Fetch assignments from position_candidate_assignments table
      let assignmentsQuery = supabase
        .from("position_candidate_assignments")
        .select(
          `
          id,
          position_id,
          candidate_id,
          start_date,
          end_date,
          status
        `
        )
        .in("position_id", positionIds)
        .gte("end_date", startDate)
        .lte("start_date", endDate);

      // Apply jobseeker filter if provided
      if (jobseekerId) {
        assignmentsQuery = assignmentsQuery.eq("candidate_id", jobseekerId);
      }

      const { data: assignments, error: assignmentsError } =
        await assignmentsQuery;

      if (assignmentsError) {
        console.error("Error fetching assignments:", assignmentsError);
        return res.status(500).json({
          success: false,
          message: "Failed to fetch assignment summary data",
        });
      }

      // Calculate summary statistics
      const totalPositionCapacity = positions.reduce((total, position) => {
        return total + (position.number_of_positions || 1);
      }, 0);

      const totalAssignments = assignments ? assignments.length : 0;
      const uniqueJobseekers = assignments
        ? new Set(assignments.map((a) => a.candidate_id)).size
        : 0;
      const availablePositions = Math.max(
        0,
        totalPositionCapacity - totalAssignments
      );
      const fillRate =
        totalPositionCapacity > 0
          ? Math.round((totalAssignments / totalPositionCapacity) * 100)
          : 0;

      // Calculate status breakdown
      const statusBreakdown = {
        active: 0,
        upcoming: 0,
        completed: 0,
        cancelled: 0,
      };

      if (assignments) {
        assignments.forEach((assignment) => {
          const status = assignment.status as keyof typeof statusBreakdown;
          if (statusBreakdown.hasOwnProperty(status)) {
            statusBreakdown[status]++;
          }
        });
      }

      const summary = {
        totalPositions: totalPositionCapacity,
        totalJobseekers: uniqueJobseekers,
        activeAssignments: totalAssignments,
        availablePositions,
        fillRate,
        statusBreakdown,
        dateRange: {
          startDate: startDate as string,
          endDate: endDate as string,
        },
      };

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error("Calendar summary endpoint error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

export default router;
