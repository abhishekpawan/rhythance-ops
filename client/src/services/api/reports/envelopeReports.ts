import axios from "axios";
import { api } from "../index";

export interface EnvelopePrintingReportFilter {
  clientIds: string[];
  startDate: string;
  endDate: string;
  listName?: string | string[];
  payCycle?: string | string[];
}

export interface EnvelopePrintingReportRow {
  sequence_number: number;
  sr_no: string;
  city: string;
  list_name: string;
  week_ending: string;
  client_name: string;
  sales_person: string;
  short_code: string;
  work_province: string;
  pay_cycle: string;
  jobseeker_id: string;
  license_number: string;
  passport_number: string;
  jobseeker_name: string;
  phone_number: string;
  email_id: string;
  billing_email: string;
  pay_method: string;
  position_category: string;
  position_name: string;
  hours: string;
  overtime_hours: string;
  regular_pay_rate: string;
  premium_pay_rate: string;
  overtime_pay_rate: string;
  total_amount: string;
  tax_rate: string;
  hst_gst: string;
  line_amount: string;
  invoice_number: string;
  invoice_date: string;
  payment_due_date: string;
  currency: string;
  client_is_inactive?: boolean;
  jobseeker_is_inactive?: boolean;
}

export const getEnvelopePrintingReport = async (
  filters: EnvelopePrintingReportFilter
): Promise<EnvelopePrintingReportRow[]> => {
  try {
    const response = await api.post(
      "/api/reports/envelope-printing-position",
      filters
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch envelope printing report"
      );
    }
    throw error;
  }
};

export interface EnvelopePrintingByDueDateReportFilter {
  clientIds: string[];
  dueDate: string;
  payCycle?: string | string[];
}

export const getEnvelopePrintingByDueDateReport = async (
  filters: EnvelopePrintingByDueDateReportFilter
): Promise<EnvelopePrintingReportRow[]> => {
  try {
    const response = await api.post(
      "/api/reports/envelope-printing-by-due-date",
      filters
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error ||
          "Failed to fetch envelope printing report by due date"
      );
    }
    throw error;
  }
};
