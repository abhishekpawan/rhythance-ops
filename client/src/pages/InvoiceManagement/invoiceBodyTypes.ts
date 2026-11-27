// The input of the two request-body builders of "save invoice" (R-5s). The page's state they read became these
// parameters; the numbers come from calculateLineItemTotals.
import type { ClientData } from "../../services/api/client";
import type { calculateLineItemTotals } from "./invoiceCalculations";
import type { InvoiceLineItem, SupplierPOItem } from "./invoiceTypes";

export type LineItemTotals = ReturnType<typeof calculateLineItemTotals>;

// What uploadAttachments returns for the attachments that are stored.
export interface UploadedAttachment {
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadStatus: string;
  filePath: string;
  bucketName: string;
}

export interface UpdateInvoiceInput {
  selectedClient: ClientData;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  selectedTerms: string;
  uploadedAttachments: UploadedAttachment[];
  supplierPOItems: SupplierPOItem[];
  messageOnInvoice: string;
  termsOnInvoice: string;
  timesheetStartDate: string;
  timesheetEndDate: string;
  subtotal: number;
  totalTax: number;
  totalHST: number;
  totalGST: number;
  totalQST: number;
  grandTotal: number;
  lineItems: InvoiceLineItem[];
  notes: string;
}

export interface CreateInvoiceInput extends UpdateInvoiceInput {
  lineItemTotals: LineItemTotals["lineItemTotals"];
}
