import { Router, Request, Response } from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import { supabase } from "./supabase.js";

const router = Router();

// POST /api/reports/deduction
router.post(
  "/deduction",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.body || {};

      if (!startDate || !endDate) {
        return res
          .status(400)
          .json({ error: "Start date and end date are required." });
      }

      // Query invoices between the date range
      const { data: invoices, error } = await supabase
        .from("invoices")
        .select(
          `
          id,
          invoice_number,
          invoice_date,
          client_id,
          subtotal,
          grand_total,
          invoice_data
        `
        )
        .gte("invoice_date", startDate)
        .lte("invoice_date", endDate)
        .order("invoice_date", { ascending: false });

      if (error) {
        console.error("Error fetching deduction report:", error);
        return res
          .status(500)
          .json({ error: "Failed to fetch deduction report." });
      }

      // Filter invoices that have deductions (negative bill rates) and transform the data
      const deductionData = (invoices || [])
        .map((invoice: any) => {
          const invoiceData = invoice.invoice_data || {};
          const client = invoiceData.client || {};
          const timesheets = invoiceData.timesheets || [];

          // Find timesheets with negative bill rates (deductions)
          const deductionTimesheets = timesheets.filter((ts: any) => {
            const billRate = Number(ts.regularBillRate) || 0;
            return billRate < 0;
          });

          if (deductionTimesheets.length === 0) {
            return null; // Skip invoices without deductions
          }

          // Calculate total deductions and format jobseeker details
          let totalDeductions = 0;
          const jobseekerDeductions: string[] = [];

          deductionTimesheets.forEach((ts: any) => {
            const deductionAmount = Math.abs(Number(ts.regularBillRate) || 0);
            totalDeductions += deductionAmount;

            const jobseekerProfile = ts.jobseekerProfile || {};
            const jobseekerName =
              `${jobseekerProfile.firstName || ""} ${
                jobseekerProfile.lastName || ""
              }`.trim() || "N/A";
            jobseekerDeductions.push(
              `${jobseekerName} (-$${deductionAmount.toFixed(2)})`
            );
          });

          // Calculate total amount (could be different from subtotal due to mixed positive/negative rates)
          const totalAmount = timesheets.reduce((sum: number, ts: any) => {
            return sum + (Number(ts.totalClientBill) || 0);
          }, 0);

          return {
            invoice_number: invoice.invoice_number,
            client_name: client.companyName || "N/A",
            accounting_person: client.accountingPerson || "N/A",
            total_amount: totalAmount.toFixed(2),
            jobseeker_deductions: jobseekerDeductions.join(", "),
            total_deductions_amount: totalDeductions.toFixed(2),
            invoice_date: invoice.invoice_date,
          };
        })
        .filter(Boolean); // Remove null entries (invoices without deductions)

      res.json(deductionData);
    } catch (error) {
      console.error("Unexpected error in deduction report:", error);
      return res.status(500).json({ error: "An unexpected error occurred." });
    }
  }
);

export default router;
