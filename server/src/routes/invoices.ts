import { Router } from "express";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";
import { sanitizeInputs } from "../middleware/security.js";
import {
  generateInvoiceNumber,
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  updateInvoiceDocument,
  getTimesheetsByClient,
  sendInvoiceEmail,
} from "../controllers/invoice.controller.js";
import {
  createActivity,
  updateActivity,
  deleteActivity,
  sendEmailActivity,
} from "./invoice.activity.js";

const router = Router();

/**
 * Generate next available invoice number
 * GET /api/invoices/generate-invoice-number
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/generate-invoice-number",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  // apiRateLimiter,
  generateInvoiceNumber
);

/**
 * Get all invoices with pagination and filtering
 * GET /api/invoices
 * @access Private (Admin, Recruiter, Jobseeker - own invoices only)
 */
router.get(
  "/",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  // apiRateLimiter,
  getInvoices
);

/**
 * Get a specific invoice by ID
 * GET /api/invoices/:id
 * @access Private (Admin, Recruiter, Jobseeker - own invoices only)
 */
router.get(
  "/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter", "jobseeker"]),
  // apiRateLimiter,
  getInvoiceById
);

/**
 * Create a new invoice
 * POST /api/invoices
 * @access Private (Admin, Recruiter)
 */
router.post(
  "/",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  sanitizeInputs,
  createActivity,
  createInvoice
);

/**
 * Update an existing invoice
 * PUT /api/invoices/:id
 * @access Private (Admin, Recruiter)
 */
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  sanitizeInputs,
  updateActivity,
  updateInvoice
);

/**
 * Delete an invoice
 * DELETE /api/invoices/:id
 * @access Private (Admin only)
 */
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  deleteActivity,
  deleteInvoice
);

/**
 * Update invoice document information (for PDF generation)
 * PATCH /api/invoices/:id/document
 * @access Private (Admin, Recruiter, System)
 */
router.patch(
  "/:id/document",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  sanitizeInputs,
  updateInvoiceDocument
);

/**
 * Fetch timesheets for a client within a date range
 * GET /api/invoices/timesheets-by-client/:clientId
 * @access Private (Admin, Recruiter)
 */
router.get(
  "/timesheets-by-client/:clientId",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  getTimesheetsByClient
);

/**
 * Send invoice email
 * POST /api/invoices/:id/send-email
 * @access Private (Admin, Recruiter)
 */
router.post(
  "/:id/send-email",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  // apiRateLimiter,
  sendEmailActivity,
  sendInvoiceEmail
);

export default router;
