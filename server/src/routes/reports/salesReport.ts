import { Router, Request, Response } from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import { supabase } from "./supabase.js";
import {
  checkClientInactive,
  checkJobseekerInactive,
} from "./clientActivity.js";

const router = Router();

// POST /api/reports/sales
router.post(
  "/sales",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { clientIds, startDate, endDate, jobseekerIds, salesPersons } =
        req.body || {};

      // Query invoices for selected clients and optional date range
      let query = supabase
        .from("invoices")
        .select(
          `
          id,
          invoice_number,
          invoice_date,
          due_date,
          client_id,
          subtotal,
          grand_total,
          currency,
          invoice_data
        `
        )
        .in("client_id", clientIds);
      if (startDate) {
        query = query.gte("invoice_date", startDate);
      }
      if (endDate) {
        query = query.lte("invoice_date", endDate);
      }
      query = query.order("invoice_date", { ascending: false });

      const { data: invoices, error } = await query;

      if (error) {
        console.error("Error fetching sales report:", error);
        return res.status(500).json({ error: "Failed to fetch sales report." });
      }

      // Get client information and position details
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select(
          "id, company_name, contact_person_name1, sales_person, terms, last_activity_at, created_at"
        )
        .in("id", clientIds);

      if (clientsError) {
        console.error("Error fetching clients:", clientsError);
        return res.status(500).json({ error: "Failed to fetch clients." });
      }

      const clientInfoMap: Record<string, any> = {};
      (clientsData || []).forEach((client: any) => {
        clientInfoMap[client.id] = client;
      });

      // Get all unique position IDs from timesheets to fetch position details
      const positionIds = new Set<string>();
      (invoices || []).forEach((invoice: any) => {
        const invoiceData = invoice.invoice_data || {};
        const timesheets = invoiceData.timesheets || [];
        timesheets.forEach((ts: any) => {
          if (ts.position && ts.position.positionId) {
            positionIds.add(ts.position.positionId);
          }
        });
      });
      // Fetch position details for start/end dates
      const { data: positionsData, error: positionsError } = await supabase
        .from("positions")
        .select(
          "id, title, position_code, position_number, position_category, start_date, end_date, notes"
        )
        .in("id", Array.from(positionIds));

      if (positionsError) {
        console.error("Error fetching positions:", positionsError);
        return res.status(500).json({ error: "Failed to fetch positions." });
      }

      const positionInfoMap: Record<string, any> = {};
      (positionsData || []).forEach((position: any) => {
        positionInfoMap[position.id] = position;
      });

      // Collect all unique jobseeker IDs from invoice timesheets for inactive check
      const salesJobseekerIds = new Set<string>();
      (invoices || []).forEach((invoice: any) => {
        const invoiceData = invoice.invoice_data || {};
        const timesheets = invoiceData.timesheets || [];
        timesheets.forEach((ts: any) => {
          const profileId =
            ts.jobseekerProfile?.jobseekerProfileId ||
            ts.jobseekerProfileId ||
            ts.jobseekerProfile?.id;
          if (profileId) salesJobseekerIds.add(profileId);
        });
      });
      let salesJobseekerInfoMap: Record<string, any> = {};
      if (salesJobseekerIds.size > 0) {
        const { data: jsData } = await supabase
          .from("jobseeker_profiles")
          .select("id, last_activity_at, created_at")
          .in("id", Array.from(salesJobseekerIds));
        if (jsData) {
          jsData.forEach((js: any) => {
            salesJobseekerInfoMap[js.id] = js;
          });
        }
      }

      // Process invoices and extract timesheets
      const salesData: any[] = [];
      let totalTimesheets = 0;
      let afterJobseekerFilter = 0;
      let afterSalesPersonFilter = 0;

      (invoices || []).forEach((invoice: any) => {
        const invoiceData = invoice.invoice_data || {};
        const timesheets = invoiceData.timesheets || [];
        const client = clientInfoMap[invoice.client_id] || {};
        totalTimesheets += timesheets.length;

        timesheets.forEach((ts: any) => {
          const profileId =
            ts.jobseekerProfile?.jobseekerProfileId ||
            ts.jobseekerProfileId ||
            ts.jobseekerProfile?.id;

          // Get positionId from nested position object
          const positionId = ts.position && ts.position.positionId;
          const position =
            positionId && positionInfoMap[positionId]
              ? positionInfoMap[positionId]
              : {};

          // Apply jobseeker filter
          if (
            jobseekerIds &&
            Array.isArray(jobseekerIds) &&
            jobseekerIds.length > 0
          ) {
            if (!jobseekerIds.includes(profileId)) return;
          }
          afterJobseekerFilter++;

          // Apply sales person filter
          if (
            salesPersons &&
            Array.isArray(salesPersons) &&
            salesPersons.length > 0
          ) {
            if (!salesPersons.includes(client.sales_person)) return;
          }
          afterSalesPersonFilter++;

          // Parse tax rate from salesTax string
          let taxRate = 0;
          if (typeof ts.salesTax === "string") {
            const match = ts.salesTax.match(/^([\d.]+)%/);
            if (match) {
              taxRate = parseFloat(match[1]);
            }
          }
          const amount = Number(ts.totalClientBill) || 0;
          const gstHst = (amount * taxRate) / 100;

          // Calculate values
          const hours = Number(ts.totalRegularHours || ts.regularHours) || 0;
          const billRate = Number(ts.regularBillRate) || 0;
          const discount = Number(ts.discount) || 0;
          const total = amount + gstHst - discount;

          // Use position fields from timesheet.position if available, else fallback to positions table
          const itemPosition =
            ts.position && ts.position.title
              ? `${ts.position.title} [${
                  ts.position.positionNumber ||
                  ts.position.position_number ||
                  ""
                }]`
              : "N/A";
          const positionCategory =
            ts.position &&
            (ts.position.positionCategory || ts.position.position_category)
              ? ts.position.positionCategory || ts.position.position_category
              : position.position_category || "N/A";

          // Always use employeeId from invoice data
          const employeeId =
            ts.jobseekerProfile && ts.jobseekerProfile.employeeId
              ? ts.jobseekerProfile.employeeId
              : "N/A";

          salesData.push({
            client_name: client.company_name || "N/A",
            contact_person_name: client.contact_person_name1 || "N/A",
            sales_person: client.sales_person || "N/A",
            invoice_number: invoice.invoice_number || "N/A",
            from_date: position.start_date || "N/A",
            to_date: position.end_date || "N/A",
            invoice_date: invoice.invoice_date || "N/A",
            due_date: invoice.due_date || "N/A",
            terms: client.terms || "N/A",
            item_position: itemPosition,
            position_category: positionCategory,
            jobseeker_number: employeeId || "N/A",
            jobseeker_name: ts.jobseekerProfile
              ? `${ts.jobseekerProfile.firstName || ""} ${
                  ts.jobseekerProfile.lastName || ""
                }`.trim() || "N/A"
              : "N/A",
            description: ts.description || position.notes || "N/A",
            hours: hours.toString(),
            bill_rate: billRate.toFixed(2),
            amount: amount.toFixed(2),
            discount: discount.toFixed(2),
            tax_rate: taxRate.toFixed(2),
            gst_hst: gstHst.toFixed(2),
            total: total.toFixed(2),
            currency: invoice.currency || "N/A",
            client_is_inactive: checkClientInactive(
              client.last_activity_at,
              client.created_at
            ),
            jobseeker_is_inactive: profileId
              ? checkJobseekerInactive(
                  (salesJobseekerInfoMap[profileId] || {}).last_activity_at,
                  (salesJobseekerInfoMap[profileId] || {}).created_at
                )
              : false,
          });
        });
      });
      res.json(salesData);
    } catch (error) {
      console.error("Unexpected error in sales report:", error);
      return res.status(500).json({ error: "An unexpected error occurred." });
    }
  }
);

export default router;
