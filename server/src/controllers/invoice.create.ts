import { Request, Response } from "express";
import { supabase } from "../services/invoice.client.js";
import {
  createVersionEntry,
  transformToDbFormat,
  transformToFrontendFormat,
} from "../services/invoice.format.js";
import type { InvoiceData, DbInvoiceData } from "../services/invoice.types.js";

export const createInvoice = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userId = req.user.id;
    const invoiceData: InvoiceData = req.body;

    // Validate required fields
    const requiredFields = [
      "clientId",
      "invoiceDate",
      "dueDate",
      "subtotal",
      "totalTax",
      "grandTotal",
      "totalHours",
      "invoiceData",
    ];

    for (const field of requiredFields) {
      if (
        invoiceData[field as keyof InvoiceData] === undefined ||
        invoiceData[field as keyof InvoiceData] === null
      ) {
        return res
          .status(400)
          .json({ error: `Missing required field: ${field}` });
      }
    }

    // Validate client exists
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("id", invoiceData.clientId)
      .maybeSingle();

    if (clientError || !client) {
      return res.status(400).json({ error: "Invalid client ID" });
    }

    // Prepare invoice data for database
    const dbInvoiceData: Omit<
      DbInvoiceData,
      "id" | "created_at" | "updated_at"
    > = {
      ...transformToDbFormat(invoiceData),
      // Use the invoice number from the request if provided, otherwise let DB generate
      invoice_number: invoiceData.invoiceNumber || undefined,
      created_by_user_id: userId,
      updated_by_user_id: userId,
      version: 1,
      version_history: [createVersionEntry(userId, 1, "created")],
    };

    // Insert invoice into database
    const { data: newInvoice, error: insertError } = await supabase
      .from("invoices")
      .insert([dbInvoiceData])
      .select("*")
      .single();

    if (insertError) {
      console.error("Error creating invoice:", insertError);
      return res.status(500).json({ error: "Failed to create invoice" });
    }

    // Store for activity logging
    res.locals.newInvoice = newInvoice;

    // Transform response to frontend format
    const formatted = transformToFrontendFormat(newInvoice);

    return res.status(201).json({
      success: true,
      message: "Invoice created successfully",
      invoice: formatted,
    });
  } catch (error) {
    console.error("Unexpected error creating invoice:", error);
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
};
