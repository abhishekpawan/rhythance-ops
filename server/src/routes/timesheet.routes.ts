import { Router, Request, Response } from "express";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";
import { sanitizeInputs } from "../middleware/security.js";
import { emailNotifier } from "../middleware/emailNotifier.js";
import {
  generateInvoiceNumber,
  getAllTimesheets,
  sendTimesheetEmail,
  getTimesheetById,
  createTimesheet,
  updateTimesheet,
  deleteTimesheet,
  getJobseekerTimesheets,
  updateTimesheetDocument,
} from "../controllers/timesheet.controller.js";
import {
  buildCreateTimesheetNotifierEmail,
  buildUpdateTimesheetNotifierEmail,
} from "../services/timesheet.email.js";
import type { TimesheetInput } from "../types/timesheet.types.js";
import {
  sendEmailActivity,
  createActivity,
  updateActivity,
  deleteActivity,
} from "./timesheet.activity.js";

const router = Router();

router.get(
  "/generate-invoice-number",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  generateInvoiceNumber
);

router.get(
  "/jobseeker/:jobseekerUserId",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  getJobseekerTimesheets
);

router.post(
  "/send-email/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  sendEmailActivity,
  sendTimesheetEmail
);

router.get(
  "/",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  getAllTimesheets
);

router.post(
  "/",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  sanitizeInputs,
  createActivity,
  emailNotifier({
    onSuccessEmail: async (req: Request, res: Response) => {
      if (!req.body.email_sent) return null;
      return buildCreateTimesheetNotifierEmail(
        req.body as TimesheetInput,
        res.locals.newTimesheet
      );
    },
  }),
  createTimesheet
);

router.patch(
  "/:id/document",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  sanitizeInputs,
  updateTimesheetDocument
);

router.put(
  "/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  sanitizeInputs,
  updateActivity,
  emailNotifier({
    onSuccessEmail: async (req: Request, res: Response) => {
      if (!req.body.email_sent) return null;
      return buildUpdateTimesheetNotifierEmail(
        req.body as TimesheetInput,
        res.locals.updatedTimesheet
      );
    },
  }),
  updateTimesheet
);

router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  deleteActivity,
  deleteTimesheet
);

router.get(
  "/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  getTimesheetById
);

export default router;
