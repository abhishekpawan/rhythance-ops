import {
  formatCalendarDate,
  formatDateTimeCanada,
} from "../../../utils/dateUtils";
import type { InvoiceData } from "./invoiceTypes";

/**
 * Helper function to format invoice data for display
 */
export const formatInvoiceForDisplay = (invoice: InvoiceData) => {
  return {
    ...invoice,
    formattedInvoiceDate: formatCalendarDate(invoice.invoiceDate),
    formattedDueDate: formatCalendarDate(invoice.dueDate),
    formattedCreatedAt: invoice.createdAt
      ? formatDateTimeCanada(invoice.createdAt)
      : null,
    formattedUpdatedAt: invoice.updatedAt
      ? formatDateTimeCanada(invoice.updatedAt)
      : null,
    formattedGrandTotal: `$${invoice.grandTotal.toFixed(2)}`,
    formattedSubtotal: `$${invoice.subtotal.toFixed(2)}`,
    formattedTotalTax: `$${invoice.totalTax.toFixed(2)}`,
    clientDisplayName:
      invoice.client?.companyName ||
      invoice.client?.shortCode ||
      "Unknown Client",
    statusDisplayName:
      (invoice.status?.charAt(0).toUpperCase() || "") +
        (invoice.status?.slice(1) || "") || "Draft",
  };
};
