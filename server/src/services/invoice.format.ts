import type { InvoiceData, DbInvoiceData } from "./invoice.types.js";

// Helper to build version history entry
export function createVersionEntry(
  userId: string,
  version: number,
  action: string
) {
  return {
    version,
    updated_by: userId,
    updated_at: new Date().toISOString(),
    action,
  };
}

/**
 * Convert snake_case to camelCase
 */
export function snakeToCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Transform invoice data from camelCase to snake_case for database
 */
export function transformToDbFormat(invoiceData: InvoiceData): DbInvoiceData {
  return {
    client_id: invoiceData.clientId,
    invoice_date: invoiceData.invoiceDate,
    due_date: invoiceData.dueDate,
    status: invoiceData.status || "draft",
    currency: invoiceData.currency || "CAD",
    subtotal: invoiceData.subtotal,
    total_tax: invoiceData.totalTax,
    total_hst: invoiceData.totalHst,
    total_gst: invoiceData.totalGst,
    total_qst: invoiceData.totalQst,
    grand_total: invoiceData.grandTotal,
    total_hours: invoiceData.totalHours,
    email_sent: invoiceData.emailSent || false,
    email_sent_date: invoiceData.emailSentDate,
    invoice_sent_to: invoiceData.invoice_sent_to,
    document_generated: invoiceData.documentGenerated || false,
    document_path: invoiceData.documentPath,
    document_file_name: invoiceData.documentFileName,
    document_file_size: invoiceData.documentFileSize,
    document_mime_type: invoiceData.documentMimeType,
    document_generated_at: invoiceData.documentGeneratedAt,
    notes: invoiceData.notes,
    invoice_data: {
      ...invoiceData.invoiceData,
      paymentTerms: invoiceData.paymentTerms,
    },
  };
}

/**
 * Transform invoice data from snake_case to camelCase for frontend
 */
export function transformToFrontendFormat(data: DbInvoiceData): any {
  const result: any = {};

  Object.entries(data).forEach(([key, value]) => {
    const camelKey = snakeToCamelCase(key);
    result[camelKey] = value;
  });

  return result;
}
