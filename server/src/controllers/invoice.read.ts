import { Request, Response } from "express";
import { supabase } from "../services/invoice.client.js";
import { transformToFrontendFormat } from "../services/invoice.format.js";

export const getInvoiceById = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userId = req.user.id;
    const userType = req.user.user_metadata?.user_type;
    const { id } = req.params;

    // Build query with role-based filtering
    let query = supabase
      .from("invoices")
      .select(
        `
        *,
        clients!inner(id, company_name, short_code, email_address1, street_address1, city1, province1, postal_code1)
      `
      )
      .eq("id", id);

    if (userType === "jobseeker") {
      query = query.eq("created_by_user_id", userId);
    }

    const { data: invoice, error } = await query.maybeSingle();

    if (error) {
      console.error("Error fetching invoice:", error);
      return res.status(500).json({ error: "Failed to fetch invoice" });
    }

    if (!invoice) {
      return res
        .status(404)
        .json({ error: "Invoice not found or access denied" });
    }

    // Transform to frontend format
    const formatted = transformToFrontendFormat(invoice);
    formatted.client = invoice.clients;

    // Clean up joined data
    delete formatted.clients;

    return res.status(200).json(formatted);
  } catch (error) {
    console.error("Unexpected error fetching invoice:", error);
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
};
