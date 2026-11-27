import { Request, Response } from "express";
import { supabase } from "../services/invoice.client.js";
import {
  createVersionEntry,
  transformToFrontendFormat,
} from "../services/invoice.format.js";
import type { InvoiceData } from "../services/invoice.types.js";

export const updateInvoice = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userId = req.user.id;
    const { id } = req.params;
    const invoiceData: Partial<InvoiceData> = req.body;

    // Check if invoice exists (staff only: admin and recruiter roles can update any invoice)
    const existingQuery = supabase.from("invoices").select("*").eq("id", id);

    const { data: existingInvoice, error: invoiceCheckError } =
      await existingQuery.maybeSingle();

    if (invoiceCheckError || !existingInvoice) {
      return res
        .status(404)
        .json({ error: "Invoice not found or access denied" });
    }

    // Validate client if provided
    if (invoiceData.clientId) {
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id")
        .eq("id", invoiceData.clientId)
        .maybeSingle();

      if (clientError || !client) {
        return res.status(400).json({ error: "Invalid client ID" });
      }
    }

    // Prepare invoice data for database update
    const updateData: any = {};

    if (invoiceData.clientId) updateData.client_id = invoiceData.clientId;
    if (invoiceData.invoiceDate)
      updateData.invoice_date = invoiceData.invoiceDate;
    if (invoiceData.dueDate) updateData.due_date = invoiceData.dueDate;
    if (invoiceData.status) updateData.status = invoiceData.status;
    if (invoiceData.currency) updateData.currency = invoiceData.currency;
    if (invoiceData.subtotal !== undefined)
      updateData.subtotal = invoiceData.subtotal;
    if (invoiceData.totalTax !== undefined)
      updateData.total_tax = invoiceData.totalTax;
    if (invoiceData.totalHst !== undefined)
      updateData.total_hst = invoiceData.totalHst;
    if (invoiceData.totalGst !== undefined)
      updateData.total_gst = invoiceData.totalGst;
    if (invoiceData.totalQst !== undefined)
      updateData.total_qst = invoiceData.totalQst;
    if (invoiceData.grandTotal !== undefined)
      updateData.grand_total = invoiceData.grandTotal;
    if (invoiceData.totalHours !== undefined)
      updateData.total_hours = invoiceData.totalHours;
    if (invoiceData.emailSent !== undefined)
      updateData.email_sent = invoiceData.emailSent;
    if (invoiceData.emailSentDate)
      updateData.email_sent_date = invoiceData.emailSentDate;
    if (invoiceData.invoice_sent_to)
      updateData.invoice_sent_to = invoiceData.invoice_sent_to;
    if (invoiceData.documentGenerated !== undefined)
      updateData.document_generated = invoiceData.documentGenerated;
    if (invoiceData.documentPath)
      updateData.document_path = invoiceData.documentPath;
    if (invoiceData.documentFileName)
      updateData.document_file_name = invoiceData.documentFileName;
    if (invoiceData.documentFileSize)
      updateData.document_file_size = invoiceData.documentFileSize;
    if (invoiceData.documentMimeType)
      updateData.document_mime_type = invoiceData.documentMimeType;
    if (invoiceData.documentGeneratedAt)
      updateData.document_generated_at = invoiceData.documentGeneratedAt;
    if (invoiceData.invoiceData)
      updateData.invoice_data = invoiceData.invoiceData;

    // Versioning logic
    const versionedFields = [
      "clientId",
      "invoiceDate",
      "dueDate",
      "status",
      "currency",
      "subtotal",
      "totalTax",
      "totalHst",
      "totalGst",
      "totalQst",
      "grandTotal",
      "totalHours",
      "documentGenerated",
      "documentPath",
      "documentFileName",
      "documentFileSize",
      "documentMimeType",
      "documentGeneratedAt",
      "invoiceData",
    ];
    const isVersionedUpdate = Object.keys(invoiceData).some((key) =>
      versionedFields.includes(key)
    );
    if (isVersionedUpdate) {
      const prevVersion = existingInvoice.version || 1;
      const newVersion = prevVersion + 1;
      updateData.version = newVersion;
      const prevHistory = Array.isArray(existingInvoice.version_history)
        ? existingInvoice.version_history
        : [];
      updateData.version_history = [
        ...prevHistory,
        createVersionEntry(userId, newVersion, "updated"),
      ];
    }

    updateData.updated_by_user_id = userId;

    // Update invoice in database
    const { data: updatedInvoice, error: updateError } = await supabase
      .from("invoices")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Error updating invoice:", updateError);
      return res.status(500).json({ error: "Failed to update invoice" });
    }

    // Store for activity logging
    res.locals.updatedInvoice = updatedInvoice;

    // Transform response to frontend format
    const formatted = transformToFrontendFormat(updatedInvoice);

    return res.status(200).json({
      success: true,
      message: "Invoice updated successfully",
      invoice: formatted,
    });
  } catch (error) {
    console.error("Unexpected error updating invoice:", error);
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
};
