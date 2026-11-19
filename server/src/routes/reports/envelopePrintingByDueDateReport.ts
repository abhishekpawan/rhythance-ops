import { Router, Request, Response } from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import { supabase } from "./supabase.js";
import { computePaymentDueDate } from "../../utils/paymentDueDate.js";
import { resolveEnvelopeInvoice } from "./envelopeInvoiceLookup.js";
import { buildEnvelopeSrNo } from "./envelopeSrNo.js";
import { buildEnvelopeItemsForRow } from "./envelopeItems.js";
import { consolidateBiweeklyEnvelopeRows } from "./envelopeConsolidation.js";

const router = Router();

// POST /api/reports/envelope-printing-by-due-date
router.post(
  "/envelope-printing-by-due-date",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { clientIds, dueDate, payCycle } = req.body || {};

      if (!Array.isArray(clientIds) || clientIds.length === 0) {
        return res
          .status(400)
          .json({ error: "At least one client is required." });
      }

      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select(
          "id, company_name, short_code, list_name, city1, province1, pay_cycle, sales_person, currency, last_activity_at, created_at"
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

      const { data: positionsData, error: positionsError } = await supabase
        .from("positions")
        .select("id, title, position_number, position_category, client")
        .in("client", clientIds);

      if (positionsError) {
        console.error("Error fetching positions:", positionsError);
        return res.status(500).json({ error: "Failed to fetch positions." });
      }

      const positionIds = (positionsData || []).map(
        (p: { id: string }) => p.id
      );
      const positionsMap: Record<string, any> = {};
      (positionsData || []).forEach((p: any) => {
        positionsMap[p.id] = p;
      });
      if (positionIds.length === 0) {
        return res.json([]);
      }

      let timesheetQuery = supabase.from("timesheets").select(
        `
          id,
          jobseeker_profile_id,
          position_id,
          week_start_date,
          week_end_date,
          total_regular_hours,
          total_overtime_hours,
          regular_pay_rate,
          premium_pay_rate,
          overtime_pay_rate,
          total_jobseeker_pay,
          tax_amount,
          bonus_amount,
          deduction_amount,
          is_bulk,
          bulk_breakdown,
          line_payment_method,
          pay_split_segment,
          jobseeker_profiles:jobseeker_profile_id (
            employee_id,
            license_number,
            passport_number,
            first_name,
            last_name,
            mobile,
            email,
            billing_email,
            payment_method,
            cash_deduction,
            sin_payroll_hours_cap,
            hst_gst,
            last_activity_at,
            created_at
          ),
          positions:position_id (
            title,
            position_number,
            position_category,
            client
          )
        `
      );

      if (positionIds.length > 0) {
        timesheetQuery = timesheetQuery.or(
          `position_id.in.(${positionIds.join(",")}),is_bulk.eq.true`
        );
      } else {
        timesheetQuery = timesheetQuery.eq("is_bulk", true);
      }

      timesheetQuery = timesheetQuery.order("week_end_date", {
        ascending: true,
      });

      if (dueDate) {
        const d = new Date(dueDate);
        if (!isNaN(d.getTime())) {
          d.setDate(d.getDate() - 35);
          timesheetQuery = timesheetQuery.gte(
            "week_start_date",
            d.toISOString().split("T")[0]
          );
        }
        // Also limit the week_end_date to the dueDate itself, because a timesheet week_end_date cannot be after its own payment due date
        timesheetQuery = timesheetQuery.lte("week_end_date", dueDate);
      }

      const { data: timesheetRows, error: timesheetError } =
        await timesheetQuery;

      if (timesheetError) {
        console.error(
          "Error fetching envelope printing timesheets:",
          timesheetError
        );
        return res
          .status(500)
          .json({ error: "Failed to fetch envelope printing report." });
      }

      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices")
        .select(
          "invoice_number, invoice_date, due_date, client_id, invoice_data"
        )
        .in("client_id", clientIds);

      if (invoicesError) {
        console.error(
          "Error fetching invoices for envelope report:",
          invoicesError
        );
        return res.status(500).json({ error: "Failed to fetch invoices." });
      }

      const invoicesByClient: Record<string, typeof invoices> = {};
      (invoices || []).forEach((inv: any) => {
        if (!invoicesByClient[inv.client_id]) {
          invoicesByClient[inv.client_id] = [];
        }
        invoicesByClient[inv.client_id].push(inv);
      });

      const payCycleArray = payCycle
        ? Array.isArray(payCycle)
          ? payCycle
          : [payCycle]
        : [];

      const envelopeData: any[] = [];

      (timesheetRows || []).forEach((row: any) => {
        let position = row.positions || {};
        let clientId = position.client;

        if (!clientId || !clientInfoMap[clientId]) {
          if (
            row.is_bulk &&
            row.bulk_breakdown &&
            Array.isArray(row.bulk_breakdown)
          ) {
            // Find a valid client from the breakdown
            const validBreakdown = row.bulk_breakdown.find((bd: any) =>
              positionIds.includes(bd.position_id)
            );
            if (validBreakdown) {
              clientId = positionsData.find(
                (p: any) => p.id === validBreakdown.position_id
              )?.client;
              if (clientId && clientInfoMap[clientId]) {
                // We simulate that the primary position is the valid one for the envelope report group
                position = { client: clientId };
              } else {
                return;
              }
            } else {
              return;
            }
          } else {
            return;
          }
        }

        const client = clientInfoMap[clientId];
        const jp = row.jobseeker_profiles || {};

        if (
          payCycleArray.length > 0 &&
          !payCycleArray.includes(client.pay_cycle)
        ) {
          return;
        }

        if (!row.jobseeker_profile_id || !row.position_id) return;

        const paymentDueDate = computePaymentDueDate(
          client.pay_cycle,
          row.week_start_date,
          row.week_end_date
        );

        if (dueDate && paymentDueDate !== dueDate) {
          return;
        }

        const matchedInvoice = resolveEnvelopeInvoice(
          row.jobseeker_profile_id,
          row.position_id,
          invoicesByClient[clientId] || [],
          row.week_start_date,
          row.week_end_date
        );

        const items = buildEnvelopeItemsForRow(
          row,
          jp,
          client,
          position,
          positionIds,
          positionsMap,
          matchedInvoice,
          paymentDueDate
        );
        envelopeData.push(...items);
      });

      // Biweekly-pay clients are paid for both weeks together, so the by-due-date
      // report also shows ONE row per jobseeker (same rule as the position report).
      const consolidatedEnvelopeData =
        consolidateBiweeklyEnvelopeRows(envelopeData);

      const numberedEnvelopeData = consolidatedEnvelopeData.map(
        (row, index) => {
          const sequenceNumber = index + 1;
          return {
            sequence_number: sequenceNumber,
            sr_no: buildEnvelopeSrNo(
              row.short_code,
              row.week_ending,
              sequenceNumber
            ),
            ...row,
          };
        }
      );

      res.json(numberedEnvelopeData);
    } catch (error) {
      console.error(
        "Unexpected error in envelope printing report by due date:",
        error
      );
      return res.status(500).json({ error: "An unexpected error occurred." });
    }
  }
);

export default router;
