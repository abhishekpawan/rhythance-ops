import { formatInvoiceForDisplay } from "../../../services/api/invoice";
import {
  TimesheetItem,
  SupplierPOItem,
  AttachmentItem,
} from "./invoiceViewTypes";
import type { useInvoiceViewState } from "./useInvoiceViewState";

type InvoiceViewState = ReturnType<typeof useInvoiceViewState>;

// Called after the page's "loading" and "not found" returns, so the invoice is known to be there.
export function createInvoiceViewData(
  ctx: Pick<InvoiceViewState, "client"> & {
    invoice: NonNullable<InvoiceViewState["invoice"]>;
  }
) {
  const { client, invoice } = ctx;
  const formatted = formatInvoiceForDisplay(invoice);
  const clientData = client || invoice.client;

  // Complete address format
  const addressParts = [
    clientData?.streetAddress1,
    clientData?.city1,
    clientData?.province1,
    clientData?.postalCode1,
  ].filter(Boolean);
  const fullAddress = addressParts.length > 0 ? addressParts.join(", ") : "N/A";

  // Parse invoice JSONB structure
  const rawData = invoice.invoiceData || {};
  const timesheets = (rawData.timesheets as TimesheetItem[]) || [];
  const supplierPOItems = (rawData.supplierPOItems as SupplierPOItem[]) || [];
  const attachments = (rawData.attachments as AttachmentItem[]) || [];
  const messageOnInvoice = (rawData.messageOnInvoice as string) || "";
  const termsOnInvoice = (rawData.termsOnInvoice as string) || "";

  return {
    formatted,
    clientData,
    addressParts,
    fullAddress,
    rawData,
    timesheets,
    supplierPOItems,
    attachments,
    messageOnInvoice,
    termsOnInvoice,
  };
}
