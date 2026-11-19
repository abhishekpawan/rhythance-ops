import { Router, Request, Response } from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import { supabase } from "./supabase.js";
import { checkClientInactive } from "./clientActivity.js";

const router = Router();

// POST /api/reports/clients
router.post(
  "/clients",
  authenticateToken,
  authorizeRoles(["admin", "recruiter"]),
  async (req: Request, res: Response) => {
    try {
      const { clientManagerIds, paymentMethods, terms } = req.body || {};

      let query = supabase
        .from("clients")
        .select("*")
        .eq("is_draft", false)
        .order("company_name", { ascending: true });

      // Apply filters
      if (
        clientManagerIds &&
        Array.isArray(clientManagerIds) &&
        clientManagerIds.length > 0
      ) {
        query = query.in("client_manager", clientManagerIds);
      }

      if (
        paymentMethods &&
        Array.isArray(paymentMethods) &&
        paymentMethods.length > 0
      ) {
        query = query.in("preferred_payment_method", paymentMethods);
      }

      if (terms && Array.isArray(terms) && terms.length > 0) {
        query = query.in("terms", terms);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching clients report:", error);
        return res
          .status(500)
          .json({ error: "Failed to fetch clients report." });
      }

      // Map to response format and combine address fields
      const result = (data || []).map((row: any) => {
        // Combine address fields
        const addressParts = [
          row.street_address1,
          row.city1,
          row.province1,
          row.postal_code1,
        ].filter(Boolean);

        if (row.street_address2) {
          addressParts.push(row.street_address2);
          if (row.city2) addressParts.push(row.city2);
          if (row.province2) addressParts.push(row.province2);
          if (row.postal_code2) addressParts.push(row.postal_code2);
        }

        if (row.street_address3) {
          addressParts.push(row.street_address3);
          if (row.city3) addressParts.push(row.city3);
          if (row.province3) addressParts.push(row.province3);
          if (row.postal_code3) addressParts.push(row.postal_code3);
        }

        const address = addressParts.join(", ");

        return {
          company_name: row.company_name || "",
          billing_name: row.billing_name || "",
          short_code: row.short_code || "",
          list_name: row.list_name || "",
          accounting_person: row.accounting_person || "",
          sales_person: row.sales_person || "",
          client_manager: row.client_manager || "",
          contact_person_name1: row.contact_person_name1 || "",
          email_address1: row.email_address1 || "",
          mobile1: row.mobile1 || "",
          address: address,
          preferred_payment_method: row.preferred_payment_method || "",
          pay_cycle: row.pay_cycle || "",
          terms: row.terms || "",
          notes: row.notes || "",
          client_is_inactive: checkClientInactive(
            row.last_activity_at,
            row.created_at
          ),
        };
      });

      res.json(result);
    } catch (error) {
      console.error("Unexpected error in clients report:", error);
      return res.status(500).json({ error: "An unexpected error occurred." });
    }
  }
);

export default router;
