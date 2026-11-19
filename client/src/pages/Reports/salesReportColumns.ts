import { formatDate as formatWeekDate } from "../TimesheetManagement/functions/weekUtils";

// Define the columns and headers as used in the UI table
export const getTableColumns = (
  t: (key: string) => string
): {
  key: string;
  label: string;
  format?: (val: unknown, row?: Record<string, unknown>) => string;
}[] => [
  {
    key: "client_name",
    label: t("reports.columns.clientName"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "contact_person_name",
    label: t("reports.columns.contactPerson"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "sales_person",
    label: t("reports.columns.salesPersonCol"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "invoice_number",
    label: t("reports.columns.invoiceNumber"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "from_to_date",
    label: t("reports.columns.fromToDate"),
    format: (_val, row) => {
      if (
        row &&
        typeof row === "object" &&
        "from_date" in row &&
        "to_date" in row
      ) {
        return `${formatWeekDate(String((row as Record<string, unknown>).from_date))} - ${formatWeekDate(String((row as Record<string, unknown>).to_date))}`;
      }
      return "";
    },
  },
  {
    key: "invoice_date",
    label: t("reports.columns.invoiceDate"),
    format: (val) => formatWeekDate(String(val ?? "")),
  },
  {
    key: "due_date",
    label: t("reports.columns.dueDate"),
    format: (val) => formatWeekDate(String(val ?? "")),
  },
  {
    key: "terms",
    label: t("reports.columns.terms"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "item_position",
    label: t("reports.columns.itemPosition"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "position_category",
    label: t("reports.columns.positionCategory"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "jobseeker_number",
    label: t("reports.columns.jobseekerNumberCol"),
    format: (val) => (val ? `#${val}` : ""),
  },
  {
    key: "jobseeker_name",
    label: t("reports.columns.nameOfJobseeker"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "description",
    label: t("reports.columns.description"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "hours",
    label: t("reports.columns.hours"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "bill_rate",
    label: t("reports.columns.billRate"),
    format: (val) =>
      val !== undefined && val !== "N/A" ? `$${val}` : String(val ?? ""),
  },
  {
    key: "amount",
    label: t("reports.columns.amount"),
    format: (val) =>
      val !== undefined && val !== "N/A" ? `$${val}` : String(val ?? ""),
  },
  {
    key: "discount",
    label: t("reports.columns.discount"),
    format: (val) =>
      val !== undefined && val !== "N/A" ? `$${val}` : String(val ?? ""),
  },
  {
    key: "tax_rate",
    label: t("reports.columns.taxRate"),
    format: (val) =>
      val !== undefined && val !== "N/A" ? `${val}%` : String(val ?? ""),
  },
  {
    key: "gst_hst",
    label: t("reports.columns.gstHst"),
    format: (val) =>
      val !== undefined && val !== "N/A" ? `$${val}` : String(val ?? ""),
  },
  {
    key: "total",
    label: t("reports.columns.total"),
    format: (val) =>
      val !== undefined && val !== "N/A" ? `$${val}` : String(val ?? ""),
  },
  {
    key: "currency",
    label: t("reports.columns.currency"),
    format: (val) => String(val ?? ""),
  },
];

// For CSV: Match UI table order
export const getCsvColumns = (
  tableColumns: ReturnType<typeof getTableColumns>
) => [...tableColumns];
