import axios from "axios";
import { api } from "../index";

export interface ClientsReportFilter {
  clientManagerIds?: string[];
  paymentMethods?: string[];
  terms?: string[];
}

export interface ClientsReportRow {
  company_name: string;
  billing_name: string;
  short_code: string;
  list_name: string;
  accounting_person: string;
  sales_person: string;
  client_manager: string;
  contact_person_name1: string;
  email_address1: string;
  mobile1: string;
  address: string;
  preferred_payment_method: string;
  pay_cycle: string;
  terms: string;
  notes: string;
  client_is_inactive?: boolean;
}

/**
 * Fetches the clients report with filters.
 * @param filters Clients report filter object
 * @returns Array of clients report rows
 */
export const getClientsReport = async (
  filters: ClientsReportFilter
): Promise<ClientsReportRow[]> => {
  try {
    const response = await api.post("/api/reports/clients", filters);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch clients report"
      );
    }
    throw error;
  }
};
