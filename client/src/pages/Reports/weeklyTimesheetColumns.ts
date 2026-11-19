import { formatDate as formatWeekDate } from "../TimesheetManagement/functions/weekUtils";
import { weeklyTimesheetSubTotal } from "./weeklyTimesheetCalc";

// Define the columns and headers as used in the UI table and CSV export (matching old CSV structure)
export const getTableColumns = (
  _t: (key: string) => string
): {
  key: string;
  label: string;
  format?: (
    val: unknown,
    row?: Record<string, unknown>,
    index?: number
  ) => string;
}[] => [
  {
    key: "sr_no",
    label: "Sr.",
    format: (_val, _row, index) => String((index ?? 0) + 1),
  },
  {
    key: "employee_id",
    label: "Jobseeker #",
    format: (val) => (val ? `#${val}` : ""),
  },
  {
    key: "license_passport",
    label: "Driver License/Passport No.",
    format: (_val, row) =>
      (row as any)?.license_number || (row as any)?.passport_number || "N/A",
  },
  { key: "name", label: "Jobseeker Name", format: (val) => String(val ?? "") },
  { key: "mobile", label: "Mobile", format: (val) => String(val ?? "") },
  { key: "email", label: "Email", format: (val) => String(val ?? "") },
  {
    key: "company_name",
    label: "Customer",
    format: (val) => String(val ?? ""),
  },
  { key: "list_name", label: "List Name", format: (val) => String(val ?? "") },
  {
    key: "title",
    label: "Position details",
    format: (val, row) => {
      const code = (row as any)?.position_code;
      return val ? `${val}${code ? ` [#${code}]` : ""}` : "";
    },
  },
  {
    key: "position_category",
    label: "Position Category",
    format: (val) => String(val ?? ""),
  },
  {
    key: "client_manager",
    label: "Client Manager",
    format: (val) => String(val ?? ""),
  },
  {
    key: "week_period",
    label: "Date",
    format: (_val, row) => {
      if (
        row &&
        typeof row === "object" &&
        "week_start_date" in row &&
        "week_end_date" in row
      ) {
        return `${formatWeekDate(String((row as Record<string, unknown>).week_start_date))} - ${formatWeekDate(String((row as Record<string, unknown>).week_end_date))}`;
      }
      return "";
    },
  },
  {
    key: "total_regular_hours",
    label: "Reg. Hrs.",
    format: (val) => String(val ?? "0"),
  },
  {
    key: "total_overtime_hours",
    label: "OT. Hrs",
    format: (val) => String(val ?? "0"),
  },
  {
    key: "regular_pay_rate",
    label: "Reg. Pay",
    format: (val) =>
      val !== undefined && val !== null && val !== "N/A" && val !== ""
        ? `$${val}`
        : "$0.00",
  },
  {
    key: "overtime_pay_rate",
    label: "OT Pay",
    format: (val) =>
      val !== undefined && val !== null && val !== "N/A" && val !== ""
        ? `$${val}`
        : "$0.00",
  },
  {
    key: "sub_total",
    label: "Sub Total",
    format: (_val, row) => weeklyTimesheetSubTotal(row),
  },
  {
    key: "bonus_amount",
    label: "Bonus",
    format: (val) =>
      val !== undefined &&
      val !== null &&
      val !== "N/A" &&
      val !== "" &&
      Number(val) > 0
        ? `+$${val}`
        : "$0.00",
  },
  {
    key: "deduction_amount",
    label: "Deductions",
    format: (val) =>
      val !== undefined &&
      val !== null &&
      val !== "N/A" &&
      val !== "" &&
      Number(val) > 0
        ? `-$${val}`
        : "$0.00",
  },
  {
    key: "hst_gst",
    label: "HST",
    format: (val) =>
      val !== undefined && val !== null && val !== "N/A" && val !== ""
        ? `${val}%`
        : "N/A",
  },
  {
    key: "total_jobseeker_pay",
    label: "Total Pay",
    format: (val) =>
      val !== undefined && val !== null && val !== "N/A" && val !== ""
        ? `$${val}`
        : "$0.00",
  },
  {
    key: "status",
    label: "Status",
    format: (_val, row) => {
      const clientStatus = (row as any)?.client_is_inactive
        ? "Client Inactive"
        : "Client Active";
      const jsStatus = (row as any)?.jobseeker_is_inactive
        ? "JS Inactive"
        : "JS Active";
      return `${clientStatus} / ${jsStatus}`;
    },
  },
  { key: "on_hold", label: "On Hold", format: () => "" },
  {
    key: "payment_method",
    label: "Payment Method",
    format: (val) => String(val ?? "N/A"),
  },
  {
    key: "pay_cycle",
    label: "Pay Cycle",
    format: (val) => String(val ?? "N/A"),
  },
  {
    key: "sin_hours",
    label: "SIN Hrs",
    format: (_val, row) => {
      const pm = String((row as any)?.payment_method || "").toLowerCase();
      if (pm.includes("sin"))
        return String((row as any)?.total_regular_hours || "0");
      return "0";
    },
  },
  {
    key: "cash_hours",
    label: "Cash Hrs",
    format: (_val, row) => {
      const pm = String((row as any)?.payment_method || "").toLowerCase();
      if (pm.includes("cash"))
        return String((row as any)?.total_regular_hours || "0");
      return "0";
    },
  },
  { key: "notes", label: "Notes", format: (val) => String(val ?? "") },
  {
    key: "supporting_document",
    label: "Supporting Document",
    format: () => "",
  },
  { key: "remarks", label: "Remarks", format: () => "" },
];

export const getCsvColumns = (
  tableColumns: ReturnType<typeof getTableColumns>
) => [...tableColumns];
