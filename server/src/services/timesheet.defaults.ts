import type { TimesheetInput, TimesheetRow } from "../types/timesheet.types.js";

export const CREATE_REQUIRED_FIELDS: (keyof TimesheetInput)[] = [
  "jobseeker_profile_id",
  "jobseeker_user_id",
  "week_start_date",
  "week_end_date",
  "daily_hours",
  "total_regular_hours",
  "total_overtime_hours",
  "regular_pay_rate",
  "overtime_pay_rate",
  "regular_bill_rate",
  "overtime_bill_rate",
  "total_jobseeker_pay",
  "total_client_bill",
  "overtime_enabled",
];

export function withTimesheetDefaults(
  data: TimesheetInput
): Omit<TimesheetRow, "id" | "created_at" | "updated_at"> {
  return {
    ...data,
    premium_pay_rate: data.premium_pay_rate ?? 0,
    tax_amount: data.tax_amount ?? 0,
    email_sent: data.email_sent ?? false,
    pay_split_segment: data.pay_split_segment ?? "single",
    line_payment_method:
      data.line_payment_method === undefined ? null : data.line_payment_method,
  };
}
