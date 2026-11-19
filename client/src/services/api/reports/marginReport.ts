import axios from "axios";
import { api } from "../index";

export interface MarginReportFilter {
  startDate: string;
  endDate: string;
}

export interface MarginReportRow {
  invoice_number: string;
  client_name: string;
  accounting_person: string;
  total_billed_amount: string;
  paid_amount: string;
  paid_amount_cash: string;
  paid_amount_corporation_cheque: string;
  paid_amount_corporation_direct_deposit: string;
  paid_amount_e_transfer: string;
  paid_amount_direct_deposit: string;
  paid_amount_cheque: string;
  margin_amount: string;
  margin_percentage: string;
  invoice_date: string;
}

/**
 * Fetches the margin report with date filters.
 * @param filters Margin report filter object
 * @returns Array of margin report rows
 */
export const getMarginReport = async (
  filters: MarginReportFilter
): Promise<MarginReportRow[]> => {
  try {
    const response = await api.post("/api/reports/margin", filters);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch margin report"
      );
    }
    throw error;
  }
};
