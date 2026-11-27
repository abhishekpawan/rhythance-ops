import axios from "axios";
import { api, clearCacheFor } from "../index";
import type { InvoiceData, InvoiceResponse } from "./invoiceTypes";

/**
 * Create a new invoice
 */
const createInvoice = async (
  invoiceData: Omit<
    InvoiceData,
    | "id"
    | "createdAt"
    | "updatedAt"
    | "createdByUserId"
    | "updatedByUserId"
    | "version"
  >
): Promise<InvoiceResponse> => {
  try {
    const response = await api.post("/api/invoices", invoiceData);

    // Clear cache for invoice list
    clearCacheFor("/api/invoices");

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to create invoice");
    }
    throw error;
  }
};

/**
 * Helper function to create invoice data from frontend format
 * This matches the generateInvoiceData function in InvoiceManagement.tsx
 */
export const createInvoiceFromFrontendData = async (frontendData: {
  client: {
    id: string;
    companyName: string;
    shortCode: string;
    emailAddress1: string;
    streetAddress1?: string;
    city1?: string;
    province1?: string;
    postalCode1?: string;
  };
  invoiceNumber?: string;
  invoiceDate: string;
  dueDate: string;
  status?: string;
  currency?: string;
  paymentTerms?: string;
  timesheets: Array<{
    id: string;
    invoiceNumber: string;
    weekStartDate: string;
    weekEndDate: string;
    totalRegularHours: number;
    regularBillRate: number;
    totalClientBill: number;
    jobseekerProfile?: {
      firstName: string;
      lastName: string;
      email: string;
    };
    position?: {
      title: string;
      positionCode: string;
    };
  }>;
  attachments?: Array<{
    fileName: string;
    fileSize: number;
    fileType: string;
    uploadStatus: string;
    filePath: string;
    bucketName: string;
  }>;
  supplierPOItems?: Array<{
    id: string;
    selectedOption: string;
    supplierPoNumber: string;
  }>;
  subtotal: number;
  totalTax: number;
  totalHst?: number;
  totalGst?: number;
  totalQst?: number;
  grandTotal: number;
  totalHours: number;
  emailSent?: boolean;
  emailSentDate?: string;
  messageOnInvoice?: string;
  termsOnInvoice?: string;
  notes?: string;
}): Promise<InvoiceResponse> => {
  try {
    const invoiceData: Omit<
      InvoiceData,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "createdByUserId"
      | "updatedByUserId"
      | "version"
    > = {
      ...(frontendData.invoiceNumber && {
        invoiceNumber: frontendData.invoiceNumber,
      }),
      clientId: frontendData.client.id,
      invoiceDate: frontendData.invoiceDate,
      dueDate: frontendData.dueDate,
      status: frontendData.status || "draft",
      currency: frontendData.currency || "CAD",
      paymentTerms: frontendData.paymentTerms,
      subtotal: frontendData.subtotal,
      totalTax: frontendData.totalTax,
      totalHst: frontendData.totalHst || 0,
      totalGst: frontendData.totalGst || 0,
      totalQst: frontendData.totalQst || 0,
      grandTotal: frontendData.grandTotal,
      totalHours: frontendData.totalHours,
      emailSent: frontendData.emailSent || false,
      emailSentDate: frontendData.emailSentDate,
      notes: frontendData.notes,
      documentGenerated: false, // Will be updated when PDF is generated
      invoiceData: {
        client: frontendData.client,
        timesheets: frontendData.timesheets,
        attachments: frontendData.attachments || [],
        supplierPOItems: frontendData.supplierPOItems || [],
        messageOnInvoice: frontendData.messageOnInvoice,
        termsOnInvoice: frontendData.termsOnInvoice,
        document: {
          generated: false,
          filePath: null,
          fileName: null,
          fileSize: null,
          generatedAt: null,
          bucketName: "invoices",
        },
        summary: {
          subtotal: frontendData.subtotal,
          totalTax: frontendData.totalTax,
          totalHst: frontendData.totalHst || 0,
          totalGst: frontendData.totalGst || 0,
          totalQst: frontendData.totalQst || 0,
          grandTotal: frontendData.grandTotal,
          totalHours: frontendData.totalHours,
          currency: frontendData.currency || "CAD",
        },
      },
    };

    const result = await createInvoice(invoiceData);
    return result;
  } catch (error) {
    console.error("Error creating invoice from frontend data:", error);
    throw error;
  }
};
