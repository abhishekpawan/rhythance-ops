import axios from "axios";
import { api } from "../index";

export interface SalesReportFilter {
  clientIds: string[];
  startDate: string;
  endDate: string;
  jobseekerIds?: string[];
  salesPersons?: string[];
}

export interface SalesReportRow {
  client_name: string;
  contact_person_name: string;
  sales_person: string;
  invoice_number: string;
  from_date: string;
  to_date: string;
  invoice_date: string;
  due_date: string;
  terms: string;
  item_position: string;
  position_category: string;
  jobseeker_number: string;
  jobseeker_name: string;
  description: string;
  hours: string;
  bill_rate: string;
  amount: string;
  discount: string;
  tax_rate: string;
  gst_hst: string;
  total: string;
  currency: string;
  client_is_inactive?: boolean;
  jobseeker_is_inactive?: boolean;
}

/**
 * Fetches the sales report with filters for clients, week periods, jobseekers, and sales persons.
 * @param filters Sales report filter object
 * @returns Array of sales report rows
 */
export const getSalesReport = async (
  filters: SalesReportFilter
): Promise<SalesReportRow[]> => {
  try {
    const response = await api.post("/api/reports/sales", filters);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch sales report"
      );
    }
    throw error;
  }
};
