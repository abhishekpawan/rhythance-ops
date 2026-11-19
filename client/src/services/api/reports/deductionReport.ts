import axios from "axios";
import { api } from "../index";

export interface DeductionReportFilter {
  startDate: string;
  endDate: string;
}

export interface DeductionReportRow {
  invoice_number: string;
  client_name: string;
  accounting_person: string;
  total_amount: string;
  jobseeker_deductions: string;
  total_deductions_amount: string;
  invoice_date: string;
}

/**
 * Fetches the deduction report with date filters.
 * @param filters Deduction report filter object
 * @returns Array of deduction report rows
 */
export const getDeductionReport = async (
  filters: DeductionReportFilter
): Promise<DeductionReportRow[]> => {
  try {
    const response = await api.post("/api/reports/deduction", filters);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch deduction report"
      );
    }
    throw error;
  }
};
