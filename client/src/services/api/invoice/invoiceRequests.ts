import axios from "axios";
import { api, API_URL, clearCacheFor } from "../index";
import type {
  InvoiceData,
  InvoiceResponse,
  InvoicePaginationParams,
  PaginatedInvoiceResponse,
  InvoiceDocumentUpdateData,
} from "./invoiceTypes";

/**
 * Get a single invoice by ID
 */
export const getInvoice = async (id: string): Promise<InvoiceData> => {
  try {
    const response = await api.get(`/api/invoices/${id}`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch invoice");
    }
    throw error;
  }
};

/**
 * Get all invoices with pagination and filtering
 */
export const getInvoices = async (
  params: InvoicePaginationParams = {}
): Promise<PaginatedInvoiceResponse> => {
  try {
    const url = new URL("/api/invoices", API_URL);

    // Add pagination and filter parameters
    if (params.page) url.searchParams.append("page", params.page.toString());
    if (params.limit) url.searchParams.append("limit", params.limit.toString());
    if (params.searchTerm)
      url.searchParams.append("searchTerm", params.searchTerm);
    if (params.clientFilter)
      url.searchParams.append("clientFilter", params.clientFilter);
    if (params.clientEmailFilter)
      url.searchParams.append("clientEmailFilter", params.clientEmailFilter);
    if (params.invoiceNumberFilter)
      url.searchParams.append(
        "invoiceNumberFilter",
        params.invoiceNumberFilter
      );
    if (params.dateRangeStart)
      url.searchParams.append("dateRangeStart", params.dateRangeStart);
    if (params.dateRangeEnd)
      url.searchParams.append("dateRangeEnd", params.dateRangeEnd);
    if (params.emailSentFilter)
      url.searchParams.append("emailSentFilter", params.emailSentFilter);
    if (params.invoiceSentFilter)
      url.searchParams.append("invoiceSentFilter", params.invoiceSentFilter);
    if (params.documentGeneratedFilter)
      url.searchParams.append(
        "documentGeneratedFilter",
        params.documentGeneratedFilter
      );
    if (params.paymentTermsFilter)
      url.searchParams.append("paymentTermsFilter", params.paymentTermsFilter);

    const response = await api.get(url.pathname + url.search);
    return response.data;
  } catch (error) {
    console.error("Error fetching invoices:", error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch invoices");
    }
    throw error;
  }
};

/**
 * Update an existing invoice
 */
export const updateInvoice = async (
  id: string,
  invoiceData: Partial<
    Omit<
      InvoiceData,
      | "id"
      | "invoiceNumber"
      | "createdAt"
      | "updatedAt"
      | "createdByUserId"
      | "updatedByUserId"
      | "version"
    >
  >
): Promise<InvoiceResponse> => {
  try {
    const response = await api.put(`/api/invoices/${id}`, invoiceData);

    // Clear cache for invoice list and specific invoice
    clearCacheFor("/api/invoices");
    clearCacheFor(`/api/invoices/${id}`);

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to update invoice");
    }
    throw error;
  }
};

/**
 * Delete an invoice (Admin only)
 */
export const deleteInvoice = async (
  id: string
): Promise<{ success: boolean; message: string; deletedId: string }> => {
  try {
    const response = await api.delete(`/api/invoices/${id}`);

    // Clear cache for invoice list and specific invoice
    clearCacheFor("/api/invoices");
    clearCacheFor(`/api/invoices/${id}`);

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to delete invoice");
    }
    throw error;
  }
};

/**
 * Update invoice document information (for PDF generation)
 */
export const updateInvoiceDocument = async (
  id: string,
  documentData: InvoiceDocumentUpdateData
): Promise<InvoiceResponse> => {
  try {
    const response = await api.patch(
      `/api/invoices/${id}/document`,
      documentData
    );

    // Clear cache for invoice list and specific invoice
    clearCacheFor("/api/invoices");
    clearCacheFor(`/api/invoices/${id}`);

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to update invoice document"
      );
    }
    throw error;
  }
};

/**
 * Generate next available invoice number
 */
export const generateInvoiceNumber = async (): Promise<string> => {
  try {
    const response = await api.get("/api/invoices/generate-invoice-number");
    return response.data.invoiceNumber;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to generate invoice number"
      );
    }
    throw error;
  }
};

/**
 * Send invoice email to a recipient
 */
export const sendInvoiceEmail = async (
  invoiceId: string,
  email: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await api.post(`/api/invoices/${invoiceId}/send-email`, {
      email,
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to send invoice email"
      );
    }
    throw error;
  }
};
