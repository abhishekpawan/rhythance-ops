import { Request, Response } from "express";
import { supabase } from "../services/invoice.client.js";
import { transformToFrontendFormat } from "../services/invoice.format.js";

export const updateInvoiceDocument = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { id } = req.params;
    const {
      documentPath,
      documentFileName,
      documentFileSize,
      documentGeneratedAt,
      documentMimeType,
      documentGenerated,
    } = req.body;

    if (!documentPath) {
      return res.status(400).json({ error: "Document path is required" });
    }

    // Check if invoice exists
    const { data: existingInvoice, error: invoiceCheckError } = await supabase
      .from("invoices")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (invoiceCheckError || !existingInvoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Update document information
    const { data: updatedInvoice, error: updateError } = await supabase
      .from("invoices")
      .update({
        document_generated: documentGenerated,
        document_path: documentPath,
        document_file_name: documentFileName,
        document_file_size: documentFileSize,
        document_mime_type: documentMimeType,
        document_generated_at: documentGeneratedAt || new Date().toISOString(),
        updated_by_user_id: req.user.id,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Error updating invoice document:", updateError);
      return res
        .status(500)
        .json({ error: "Failed to update invoice document" });
    }

    // Transform response to frontend format
    const formatted = transformToFrontendFormat(updatedInvoice);

    return res.status(200).json({
      success: true,
      message: "Invoice document updated successfully",
      invoice: formatted,
    });
  } catch (error) {
    console.error("Unexpected error updating invoice document:", error);
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
};
