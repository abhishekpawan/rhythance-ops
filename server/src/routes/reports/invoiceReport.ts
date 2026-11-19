import { Router, Request, Response } from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import { supabase } from "./supabase.js";
import { checkClientInactive } from "./clientActivity.js";

const router = Router();

// POST /api/reports/invoice
router.post(
  "/invoice",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, clientIds } = req.body || {};

      if (!startDate || !endDate) {
        return res
          .status(400)
          .json({ error: "Start date and end date are required." });
      }

      // Build query with date range filter
      let query = supabase
        .from("invoices")
        .select(
          `
          id,
          invoice_number,
          invoice_date,
          due_date,
          currency,
          client_id,
          grand_total,
          email_sent,
          email_sent_date,
          invoice_data
        `
        )
        .gte("invoice_date", startDate)
        .lte("invoice_date", endDate);

      // Apply client filter if provided
      if (clientIds && Array.isArray(clientIds) && clientIds.length > 0) {
        query = query.in("client_id", clientIds);
      }

      query = query.order("invoice_date", { ascending: false });

      const { data: invoices, error } = await query;

      if (error) {
        console.error("Error fetching invoice report:", error);
        return res
          .status(500)
          .json({ error: "Failed to fetch invoice report." });
      }

      // Get unique client IDs to fetch client information
      const clientIdsSet = new Set(
        (invoices || [])
          .map((invoice: any) => invoice.client_id)
          .filter(Boolean)
      );
      let clientInfoMap: Record<string, any> = {};

      if (clientIdsSet.size > 0) {
        const { data: clientsData, error: clientsError } = await supabase
          .from("clients")
          .select(
            "id, company_name, contact_person_name1, terms, last_activity_at, created_at"
          )
          .in("id", Array.from(clientIdsSet));

        if (!clientsError && clientsData) {
          clientsData.forEach((client: any) => {
            clientInfoMap[client.id] = client;
          });
        }
      }

      // Transform the data for the frontend
      const invoiceData = (invoices || []).map((invoice: any) => {
        const invoiceData = invoice.invoice_data || {};
        const clientFromInvoice = invoiceData.client || {};
        const clientFromDB = clientInfoMap[invoice.client_id] || {};

        return {
          invoice_number: invoice.invoice_number,
          client_name:
            clientFromDB.company_name || clientFromInvoice.companyName || "N/A",
          contact_person:
            clientFromDB.contact_person_name1 ||
            clientFromInvoice.contactPersonName1 ||
            "N/A",
          terms: clientFromDB.terms || invoiceData.paymentTerms || "N/A",
          invoice_date: invoice.invoice_date,
          due_date: invoice.due_date,
          total_amount: (Number(invoice.grand_total) || 0).toFixed(2),
          currency: invoice.currency || "N/A",
          email_sent: invoice.email_sent ? "Yes" : "No",
          email_sent_date: invoice.email_sent_date || "N/A",
          client_is_inactive: checkClientInactive(
            clientFromDB.last_activity_at,
            clientFromDB.created_at
          ),
        };
      });

      res.json(invoiceData);
    } catch (error) {
      console.error("Unexpected error in invoice report:", error);
      return res.status(500).json({ error: "An unexpected error occurred." });
    }
  }
);

export default router;
