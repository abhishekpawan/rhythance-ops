import { Request, Response } from "express";
import { supabase } from "../services/invoice.client.js";

export const generateInvoiceNumber = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get all existing invoice numbers to find the lowest available number
    const { data: existingInvoices, error: fetchError } = await supabase
      .from("invoices")
      .select("invoice_number")
      .not("invoice_number", "is", null)
      .order("invoice_number", { ascending: true });

    if (fetchError) {
      console.error("Error fetching existing invoice numbers:", fetchError);
      return res
        .status(500)
        .json({ error: "Failed to generate invoice number" });
    }

    // Extract numeric parts from existing invoice numbers and sort them
    const existingNumbers: number[] = [];

    if (existingInvoices && existingInvoices.length > 0) {
      for (const invoice of existingInvoices) {
        const invoiceNumber = invoice.invoice_number;
        let numericPart: string;

        // Handle both formats: "INV-000001" and "000001"
        if (invoiceNumber.startsWith("INV-")) {
          numericPart = invoiceNumber.replace("INV-", "");
        } else {
          numericPart = invoiceNumber;
        }

        const number = parseInt(numericPart, 10);
        if (!isNaN(number)) {
          existingNumbers.push(number);
        }
      }
    }

    // Sort numbers to find gaps
    existingNumbers.sort((a, b) => a - b);

    // Find the lowest available number starting from 1
    let lowestAvailable = 1;

    for (const num of existingNumbers) {
      if (num === lowestAvailable) {
        lowestAvailable++;
      } else if (num > lowestAvailable) {
        // Found a gap, use the current lowestAvailable
        break;
      }
    }

    // Format as padded string without INV prefix
    const nextInvoiceNumber = lowestAvailable.toString().padStart(6, "0");

    // Double-check this number doesn't exist (race condition protection)
    const checkNumbers = [nextInvoiceNumber, `INV-${nextInvoiceNumber}`];

    for (const checkNumber of checkNumbers) {
      const { data: existingInvoice, error: existingError } = await supabase
        .from("invoices")
        .select("id")
        .eq("invoice_number", checkNumber)
        .maybeSingle();

      if (existingError) {
        console.error("Error checking existing invoice number:", existingError);
        return res
          .status(500)
          .json({ error: "Failed to validate invoice number" });
      }

      if (existingInvoice) {
        // If this number exists, increment and try again
        lowestAvailable++;
        const newNumber = lowestAvailable.toString().padStart(6, "0");

        return res.status(200).json({
          success: true,
          invoiceNumber: newNumber,
        });
      }
    }

    return res.status(200).json({
      success: true,
      invoiceNumber: nextInvoiceNumber,
    });
  } catch (error) {
    console.error("Unexpected error generating invoice number:", error);
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
};
