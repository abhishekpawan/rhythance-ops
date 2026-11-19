import axios from "axios";
import { api } from "../index";

export interface RateListFilter {
  clientIds?: string[];
}

export interface RateListRow {
  client_name: string;
  position_details: string;
  position_category: string;
  bill_rate: string;
  pay_rate: string;
  premium_pay_rate: string;
  overtime_hours: string;
  overtime_bill_rate: string;
  overtime_pay_rate: string;
  client_is_inactive?: boolean;
}

/**
 * Fetches the rate list report with client filters.
 * @param filters Rate list report filter object
 * @returns Array of rate list rows
 */
export const getRateListReport = async (
  filters: RateListFilter
): Promise<RateListRow[]> => {
  try {
    const response = await api.post("/api/reports/rate-list", filters);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(error.response.data.error || "Failed to fetch rate list");
    }
    throw error;
  }
};
