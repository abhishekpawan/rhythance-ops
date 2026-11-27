import { Request, Response } from "express";
import { supabase } from "../services/invoice.client.js";

export const deleteInvoice = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { id } = req.params;

    // Check if invoice exists
    const { data: existingInvoice, error: invoiceCheckError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (invoiceCheckError || !existingInvoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Store for activity logging
    res.locals.deletedInvoice = existingInvoice;

    // Delete invoice
    const { error: deleteError } = await supabase
      .from("invoices")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting invoice:", deleteError);
      return res.status(500).json({ error: "Failed to delete invoice" });
    }

    return res.status(200).json({
      success: true,
      message: "Invoice deleted successfully",
      deletedId: id,
    });
  } catch (error) {
    console.error("Unexpected error deleting invoice:", error);
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
};
