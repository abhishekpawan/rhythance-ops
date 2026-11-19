import type { EnvelopePrintingReportRow } from "../../services/api/reports";
import { formatDate as formatWeekDate } from "../TimesheetManagement/functions/weekUtils";
import { formatCalendarDate, getTodayInCanada } from "../../utils/dateUtils";
import { formatCurrency, formatPhoneNumber } from "./envelopeReportShared";

export const getTableColumns = (
  t: (key: string) => string
): {
  key: keyof EnvelopePrintingReportRow | "report_generated_date";
  label: string;
  format?: (val: unknown, row?: EnvelopePrintingReportRow) => string;
}[] => [
  { key: "sequence_number", label: t("reports.columns.sequenceNumber") || "#" },
  { key: "sr_no", label: t("reports.columns.srNo") || "SR. NO." },
  { key: "invoice_number", label: t("reports.columns.invoiceNumber") },
  { key: "city", label: t("reports.columns.city") },
  { key: "list_name", label: t("reports.columns.listName") },
  {
    key: "week_ending",
    label: t("reports.columns.weekEnding"),
    format: (val) => formatWeekDate(String(val ?? "")),
  },
  { key: "client_name", label: t("reports.columns.clientName") },
  { key: "sales_person", label: t("reports.columns.salesPersonCol") },
  { key: "short_code", label: t("reports.columns.shortCode") },
  { key: "work_province", label: t("reports.columns.workProvince") },
  { key: "pay_cycle", label: t("reports.columns.payCycle") },
  { key: "jobseeker_id", label: t("reports.columns.jobseekerId") },
  { key: "license_number", label: t("reports.columns.licenseNumber") },
  { key: "passport_number", label: t("reports.columns.passportNumber") },
  { key: "jobseeker_name", label: t("reports.columns.jobseekerName") },
  {
    key: "phone_number",
    label: t("reports.columns.phoneNumber"),
    format: (val) => formatPhoneNumber(val),
  },
  { key: "email_id", label: t("reports.columns.emailId") },
  {
    key: "billing_email",
    label: t("reports.columns.billingEmail"),
    format: (val, row) => {
      const billing = String(val ?? "").trim();
      if (billing) return billing;
      return String(row?.email_id ?? "").trim();
    },
  },
  { key: "pay_method", label: t("reports.columns.payMethod") },
  { key: "position_category", label: t("reports.columns.positionCategory") },
  { key: "position_name", label: t("reports.columns.positionName") },
  { key: "hours", label: t("reports.columns.hours") },
  { key: "overtime_hours", label: t("reports.columns.overtimeHours") },
  {
    key: "regular_pay_rate",
    label: t("reports.columns.regularPay"),
    format: (val) => formatCurrency(val),
  },
  {
    key: "premium_pay_rate",
    label: t("reports.columns.premiumPayRate"),
    format: (val) => formatCurrency(val),
  },
  {
    key: "overtime_pay_rate",
    label: t("reports.columns.overtimePayRate"),
    format: (val) => formatCurrency(val),
  },
  {
    key: "total_amount",
    label: t("reports.columns.totalAmount"),
    format: (val) => formatCurrency(val),
  },
  {
    key: "tax_rate",
    label: t("reports.columns.taxRate"),
    format: (val) =>
      val !== undefined && val !== null && val !== "" && val !== "N/A"
        ? `${Number.parseFloat(String(val)).toFixed(2)}%`
        : String(val ?? ""),
  },
  {
    key: "hst_gst",
    label: t("reports.columns.hstGst"),
    format: (val) => formatCurrency(val),
  },
  {
    key: "line_amount",
    label: t("reports.columns.lineAmount") || "Line Amount",
    format: (val) => formatCurrency(val),
  },
  {
    key: "invoice_date",
    label: t("reports.columns.invoiceDate"),
    format: (val) => {
      const s = String(val ?? "").trim();
      if (!s) return "";
      return formatWeekDate(s);
    },
  },
  {
    key: "payment_due_date",
    label: t("reports.columns.paymentDueDate"),
    format: (val) => {
      const s = String(val ?? "").trim();
      if (!s) return "";
      return formatWeekDate(s);
    },
  },
  { key: "currency", label: t("reports.columns.currency") },
  {
    key: "report_generated_date",
    label: t("reports.columns.reportGeneratedDate") || "Report Generated Date",
    format: () => formatCalendarDate(getTodayInCanada()),
  },
];

export const getCsvColumns = (
  tableColumns: ReturnType<typeof getTableColumns>
) => [...tableColumns];
