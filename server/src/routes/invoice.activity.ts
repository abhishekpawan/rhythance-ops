import { Request, Response } from "express";
import { activityLogger } from "../middleware/activityLogger.js";
import { supabase } from "../services/invoice.client.js";

// The activity-log entries of the invoice routes (moved out of invoices.ts unchanged).

// The client's name for an activity line (company name, else short code); "Unknown Client" with no id, no row or a
// failed read. Written three times before R-5b.
async function clientNameOf(clientId: string | null | undefined) {
  let clientName = "Unknown Client";
  if (clientId) {
    try {
      const { data: client } = await supabase
        .from("clients")
        .select("company_name, short_code")
        .eq("id", clientId)
        .single();
      if (client) {
        clientName =
          client.company_name || client.short_code || "Unknown Client";
      }
    } catch (error) {
      console.warn("Could not fetch client name for activity log");
    }
  }
  return clientName;
}

export const createActivity = activityLogger({
  onSuccess: async (req: Request, res: Response) => {
    const invoiceData = req.body;
    const newInvoice = res.locals.newInvoice;

    // Get client name for display
    const clientId = invoiceData.clientId || newInvoice?.client_id;
    const clientName = await clientNameOf(clientId);

    // Use created invoice data for accurate values, fallback to request data
    const finalGrandTotal =
      newInvoice?.grand_total ?? invoiceData.grandTotal ?? 0;
    const finalCurrency = newInvoice?.currency ?? invoiceData.currency ?? "CAD";

    return {
      actionType: "create_invoice",
      actionVerb: "created",
      primaryEntityType: "invoice",
      primaryEntityId: newInvoice?.id,
      primaryEntityName: `Invoice ${newInvoice?.invoice_number}`,
      secondaryEntityType: "client",
      secondaryEntityId: clientId || null,
      secondaryEntityName: clientName,
      displayMessage: `Created invoice ${
        newInvoice?.invoice_number
      } for ${clientName} - $${finalGrandTotal.toFixed(2)} ${finalCurrency}`,
      category: "financial",
      priority: "normal" as const,
      metadata: {
        invoiceNumber: newInvoice?.invoice_number,
        invoiceDate: newInvoice?.invoice_date ?? invoiceData.invoiceDate,
        dueDate: newInvoice?.due_date ?? invoiceData.dueDate,
        status: newInvoice?.status ?? invoiceData.status ?? "draft",
        currency: finalCurrency,
        subtotal: newInvoice?.subtotal ?? invoiceData.subtotal ?? 0,
        grandTotal: finalGrandTotal,
        totalHours: newInvoice?.total_hours ?? invoiceData.totalHours ?? 0,
      },
    };
  },
});

export const updateActivity = activityLogger({
  onSuccess: async (req: Request, res: Response) => {
    const invoiceData = req.body;
    const updatedInvoice = res.locals.updatedInvoice;
    const { id } = req.params;

    // Get client name for display - check multiple sources for client ID
    const clientId = invoiceData.clientId || updatedInvoice?.client_id;
    const clientName = await clientNameOf(clientId);

    // Use updated invoice data for accurate values, fallback to request data
    const finalGrandTotal =
      updatedInvoice?.grand_total ?? invoiceData.grandTotal ?? 0;
    const finalCurrency =
      updatedInvoice?.currency ?? invoiceData.currency ?? "CAD";
    const finalStatus = updatedInvoice?.status ?? invoiceData.status ?? "draft";

    return {
      actionType: "update_invoice",
      actionVerb: "updated",
      primaryEntityType: "invoice",
      primaryEntityId: id,
      primaryEntityName: `Invoice ${updatedInvoice?.invoice_number}`,
      secondaryEntityType: "client",
      secondaryEntityId: clientId || null,
      secondaryEntityName: clientName,
      displayMessage: `Updated invoice ${
        updatedInvoice?.invoice_number
      } for ${clientName} - $${finalGrandTotal.toFixed(2)} ${finalCurrency}`,
      category: "financial",
      priority: "normal" as const,
      metadata: {
        invoiceNumber: updatedInvoice?.invoice_number,
        invoiceDate: updatedInvoice?.invoice_date ?? invoiceData.invoiceDate,
        dueDate: updatedInvoice?.due_date ?? invoiceData.dueDate,
        status: finalStatus,
        currency: finalCurrency,
        subtotal: updatedInvoice?.subtotal ?? invoiceData.subtotal ?? 0,
        grandTotal: finalGrandTotal,
        totalHours: updatedInvoice?.total_hours ?? invoiceData.totalHours ?? 0,
      },
    };
  },
});

export const deleteActivity = activityLogger({
  onSuccess: async (req: Request, res: Response) => {
    const { id } = req.params;
    const deletedInvoice = res.locals.deletedInvoice;

    // Get client name for display
    const clientName = await clientNameOf(deletedInvoice?.client_id);

    return {
      actionType: "delete_invoice",
      actionVerb: "deleted",
      primaryEntityType: "invoice",
      primaryEntityId: id,
      primaryEntityName: `Invoice ${deletedInvoice?.invoice_number}`,
      secondaryEntityType: "client",
      secondaryEntityId: deletedInvoice?.client_id,
      secondaryEntityName: clientName,
      displayMessage: `Deleted invoice ${
        deletedInvoice?.invoice_number
      } for ${clientName} - $${(deletedInvoice?.grand_total ?? 0).toFixed(
        2
      )} ${deletedInvoice?.currency || "CAD"}`,
      category: "financial",
      priority: "high" as const,
      metadata: {
        invoiceNumber: deletedInvoice?.invoice_number,
        invoiceDate: deletedInvoice?.invoice_date,
        dueDate: deletedInvoice?.due_date,
        status: deletedInvoice?.status,
        currency: deletedInvoice?.currency,
        subtotal: deletedInvoice?.subtotal,
        grandTotal: deletedInvoice?.grand_total,
        totalHours: deletedInvoice?.total_hours,
      },
    };
  },
});

export const sendEmailActivity = activityLogger({
  onSuccess: (req, res) => {
    const { id } = req.params;
    const { email } = req.body;
    const result = res.locals.invoiceSendResult || {};
    return {
      actionType: "send_invoice_email",
      actionVerb: "sent invoice email",
      primaryEntityType: "invoice",
      primaryEntityId: id,
      primaryEntityName: result.invoiceNumber || result.invoice_number || id,
      secondaryEntityType: "client",
      secondaryEntityId: result.clientId,
      secondaryEntityName: result.clientName,
      displayMessage: `Sent invoice ${
        result.invoiceNumber || result.invoice_number || id
      } to ${email}`,
      category: "financial",
      priority: "normal",
      metadata: {
        invoiceNumber: result.invoiceNumber || result.invoice_number,
        recipient: email,
        cc: result.cc,
        clientName: result.clientName,
      },
    };
  },
});
