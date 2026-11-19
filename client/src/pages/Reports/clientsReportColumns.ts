// Define the columns for the clients report
export const getTableColumns = (
  t: (key: string) => string
): {
  key: string;
  label: string;
  format?: (val: unknown) => string;
  className?: string;
}[] => [
  {
    key: "company_name",
    label: t("reports.columns.companyName"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "billing_name",
    label: t("reports.columns.billingName"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "short_code",
    label: t("reports.columns.shortCode"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "list_name",
    label: t("reports.columns.listName"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "accounting_person",
    label: t("reports.columns.accountingPerson"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "sales_person",
    label: t("reports.columns.salesPersonCol"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "client_manager",
    label: t("reports.columns.clientManager"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "contact_person_name1",
    label: t("reports.columns.contactPersonName"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "email_address1",
    label: t("reports.columns.emailAddress"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "mobile1",
    label: t("reports.columns.mobile"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "address",
    label: t("reports.columns.address"),
    format: (val) => String(val ?? ""),
    className: "address-column",
  },
  {
    key: "preferred_payment_method",
    label: t("reports.columns.preferredPaymentMethod"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "pay_cycle",
    label: t("reports.columns.paymentCycle"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "terms",
    label: t("reports.columns.terms"),
    format: (val) => String(val ?? ""),
  },
  {
    key: "notes",
    label: t("reports.columns.notes"),
    format: (val) => String(val ?? ""),
    className: "notes-column",
  },
];

// For CSV export
export const getCsvColumns = (
  tableColumns: ReturnType<typeof getTableColumns>
) =>
  tableColumns.map((col) => ({
    ...col,
    format: (val: unknown) => String(val ?? ""),
  }));
