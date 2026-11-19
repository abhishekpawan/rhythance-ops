import { Router, Request, Response } from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import { supabase } from "./supabase.js";

const router = Router();

// POST /api/reports/margin
router.post(
  "/margin",
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
        console.error("Error fetching margin report:", error);
        return res
          .status(500)
          .json({ error: "Failed to fetch margin report." });
      }

      // Collect all unique jobseeker profile IDs across all invoices
      const allProfileIds = new Set<string>();
      (invoices || []).forEach((invoice: any) => {
        const timesheets = invoice.invoice_data?.timesheets || [];
        timesheets.forEach((ts: any) => {
          const profileId =
            ts.jobseekerProfile?.jobseekerProfileId ||
            ts.jobseekerProfileId ||
            ts.jobseekerProfile?.id;
          if (profileId) allProfileIds.add(profileId);
        });
      });

      // Batch-fetch payment methods for all jobseeker profiles
      const paymentMethodMap: Record<string, string> = {};
      if (allProfileIds.size > 0) {
        const { data: profiles } = await supabase
          .from("jobseeker_profiles")
          .select("id, payment_method")
          .in("id", Array.from(allProfileIds));
        (profiles || []).forEach((p: any) => {
          paymentMethodMap[p.id] = p.payment_method || "";
        });
      }

      // Payment method keys (must match PAYMENT_METHODS constant order)
      const PAYMENT_METHOD_KEYS: Record<string, string> = {
        Cash: "paid_amount_cash",
        "Corporation-Cheque": "paid_amount_corporation_cheque",
        "Corporation-Direct Deposit": "paid_amount_corporation_direct_deposit",
        "e-Transfer": "paid_amount_e_transfer",
        "Direct Deposit": "paid_amount_direct_deposit",
        "SIN-Direct Deposit": "paid_amount_direct_deposit",
        Cheque: "paid_amount_cheque",
      };

      // Transform the data for the frontend
      const marginData = (invoices || []).map((invoice: any) => {
        const invoiceData = invoice.invoice_data || {};
        const client = invoiceData.client || {};
        const timesheets = invoiceData.timesheets || [];

        // Initialize breakdown per payment method
        const paymentBreakdown: Record<string, number> = {
          paid_amount_cash: 0,
          paid_amount_corporation_cheque: 0,
          paid_amount_corporation_direct_deposit: 0,
          paid_amount_e_transfer: 0,
          paid_amount_direct_deposit: 0,
          paid_amount_cheque: 0,
        };

        // Calculate total jobseeker pay and payment method breakdown
        let totalJobseekerPay = 0;
        timesheets.forEach((ts: any) => {
          const pay = Number(ts.totalJobseekerPay) || 0;
          totalJobseekerPay += pay;

          const profileId =
            ts.jobseekerProfile?.jobseekerProfileId ||
            ts.jobseekerProfileId ||
            ts.jobseekerProfile?.id;
          const linePmRaw =
            ts.linePaymentMethod ?? ts.line_payment_method ?? "";
          const linePm = typeof linePmRaw === "string" ? linePmRaw.trim() : "";
          const method =
            linePm !== ""
              ? linePm
              : profileId
                ? paymentMethodMap[profileId] || ""
                : "";
          const methodKey = PAYMENT_METHOD_KEYS[method];
          if (methodKey) {
            paymentBreakdown[methodKey] += pay;
          }
        });

        // Calculate margin
        const totalBilledAmount = Number(invoice.subtotal) || 0;
        const paidAmount = totalJobseekerPay;
        const marginAmount = totalBilledAmount - paidAmount;
        const marginPercentage =
          totalBilledAmount > 0
            ? ((marginAmount / totalBilledAmount) * 100).toFixed(2)
            : "0.00";

        return {
          invoice_number: invoice.invoice_number,
          client_name: client.companyName || "N/A",
          accounting_person: client.accountingPerson || "N/A",
          total_billed_amount: totalBilledAmount.toFixed(2),
          paid_amount: paidAmount.toFixed(2),
          paid_amount_cash: paymentBreakdown.paid_amount_cash.toFixed(2),
          paid_amount_corporation_cheque:
            paymentBreakdown.paid_amount_corporation_cheque.toFixed(2),
          paid_amount_corporation_direct_deposit:
            paymentBreakdown.paid_amount_corporation_direct_deposit.toFixed(2),
          paid_amount_e_transfer:
            paymentBreakdown.paid_amount_e_transfer.toFixed(2),
          paid_amount_direct_deposit:
            paymentBreakdown.paid_amount_direct_deposit.toFixed(2),
          paid_amount_cheque: paymentBreakdown.paid_amount_cheque.toFixed(2),
          margin_amount: marginAmount.toFixed(2),
          margin_percentage: marginPercentage + "%",
          invoice_date: invoice.invoice_date,
        };
      });

      res.json(marginData);
    } catch (error) {
      console.error("Unexpected error in margin report:", error);
      return res.status(500).json({ error: "An unexpected error occurred." });
    }
  }
);

export default router;
