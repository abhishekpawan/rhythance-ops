import type { PaginationLabels } from "../../../components/Pagination";
import type { PaginationInfo } from "./invoiceListHelpers";
import type { useInvoiceListHooks } from "./useInvoiceListHooks";

/** The words of the invoice list's two pagination bars, from the key set `invoiceManagement.list.pagination`. */
export function invoicePaginationLabels(
  t: ReturnType<typeof useInvoiceListHooks>["t"],
  pagination: PaginationInfo
): PaginationLabels {
  return {
    info: t("invoiceManagement.list.pagination.showing", {
      start: Math.min(
        (pagination.page - 1) * pagination.limit + 1,
        pagination.total
      ),
      end: Math.min(pagination.page * pagination.limit, pagination.total),
      total: pagination.total,
    }),
    filteredInfo:
      pagination.totalFiltered !== pagination.total
        ? t("invoiceManagement.list.pagination.filteredFrom", {
            total: pagination.total,
          })
        : undefined,
    show: t("invoiceManagement.list.pagination.show"),
    perPage: t("invoiceManagement.list.pagination.perPage"),
    pageInfo: t("invoiceManagement.list.pagination.pageOf", {
      current: pagination.page,
      total: pagination.totalPages,
    }),
    previous: t("common.previous"),
    next: t("common.next"),
    previousTitle: t("invoiceManagement.previousPage"),
    nextTitle: t("invoiceManagement.nextPage"),
  };
}
