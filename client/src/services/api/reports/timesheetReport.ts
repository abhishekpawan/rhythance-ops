import axios from "axios";
import { api } from "../index";

export interface TimesheetReportFilter {
  jobseekerIds: string[];
  clientIds?: string[];
  weekPeriods: Array<{ start: string; end: string }>;
  payCycles?: string[];
  listNames?: string[];
}

export interface TimesheetReportRow {
  employee_id: string;
  license_number: string;
  passport_number: string;
  name: string;
  mobile: string;
  email: string;
  company_name: string;
  list_name: string;
  title: string;
  position_code: string;
  position_category: string;
  client_manager: string;
  week_start_date: string;
  week_end_date: string;
  total_regular_hours: string;
  total_overtime_hours: string;
  regular_pay_rate: string;
  premium_pay_rate: string;
  overtime_pay_rate: string;
  total_jobseeker_pay: string;
  bonus_amount: string;
  deduction_amount: string;
  cash_deduction_amount: string;
  hst_gst: string;
  currency: string;
  payment_method: string;
  pay_cycle: string;
  notes: string;
  timesheet_created_at: string;
  invoice_number: string;
  client_is_inactive?: boolean;
  jobseeker_is_inactive?: boolean;
}

/**
 * Fetches the timesheet report for a jobseeker with filters.
 * @param filters Timesheet report filter object
 * @returns Array of report rows
 */
export const getTimesheetReport = async (
  filters: TimesheetReportFilter
): Promise<TimesheetReportRow[]> => {
  try {
    const response = await api.post("/api/reports/timesheet", filters);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(
        error.response.data.error || "Failed to fetch timesheet report"
      );
    }
    throw error;
  }
};
