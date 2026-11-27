import axios from "axios";
import { api } from "../index";
import type { TimesheetsResponse } from "./invoiceTypes";

/**
 * Fetch timesheets for a client within a date range
 */
export const getTimesheetsByClientAndDateRange = async (
  clientId: string,
  startDate: string,
  endDate: string
): Promise<TimesheetsResponse> => {
  try {
    const response = await api.get(
      `/api/invoices/timesheets-by-client/${clientId}`,
      {
        params: { startDate, endDate },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch timesheets"
      );
    }
    throw error;
  }
};
