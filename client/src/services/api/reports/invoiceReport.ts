import axios from "axios";
import { api } from "../index";

export interface InvoiceReportFilter {
  startDate: string;
  endDate: string;
  clientIds?: string[];
}

export interface InvoiceReportRow {
  invoice_number: string;
  client_name: string;
  contact_person: string;
  terms: string;
  invoice_date: string;
  due_date: string;
  total_amount: string;
  currency: string;
  email_sent: string;
  email_sent_date: string;
  client_is_inactive?: boolean;
}

/**
 * Fetches the invoice report with date and client filters.
 * @param filters Invoice report filter object
 * @returns Array of invoice report rows
 */
export const getInvoiceReport = async (
  filters: InvoiceReportFilter
): Promise<InvoiceReportRow[]> => {
  try {
    const response = await api.post("/api/reports/invoice", filters);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch invoice report"
      );
    }
    throw error;
  }
};
