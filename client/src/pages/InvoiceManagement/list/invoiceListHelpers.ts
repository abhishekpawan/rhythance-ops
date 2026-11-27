// The invoice list's paging type and client-name helpers, moved out of InvoiceList.tsx unchanged (R-5s).

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalFiltered: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function getClientDisplayName(
  client: Record<string, unknown> | undefined,
  t: (key: string) => string
): string {
  return String(
    client?.companyName ||
      client?.company_name ||
      client?.shortCode ||
      client?.short_code ||
      t("invoiceManagement.unknownClient")
  );
}

export function getClientEmail(
  client: Record<string, unknown> | undefined
): string {
  return String(client?.emailAddress1 || client?.email_address1 || "");
}
