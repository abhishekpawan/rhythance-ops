import type { useInvoiceListHooks } from "./useInvoiceListHooks";
import type { useInvoiceListState } from "./useInvoiceListState";
import type { createListFilters } from "./createListFilters";

export function PaginationTop(
  props: Pick<ReturnType<typeof useInvoiceListHooks>, "t"> &
    Pick<ReturnType<typeof useInvoiceListState>, "pagination"> &
    Pick<ReturnType<typeof createListFilters>, "handleLimitChange">
) {
  const { handleLimitChange, pagination, t } = props;
  return (
    <>
      {/* Pagination Controls - Top */}
      <div className="pagination-controls top">
        <div className="pagination-info">
          <span className="pagination-text">
            {t("invoiceManagement.list.pagination.showing", {
              start: Math.min(
                (pagination.page - 1) * pagination.limit + 1,
                pagination.total
              ),
              end: Math.min(
                pagination.page * pagination.limit,
                pagination.total
              ),
              total: pagination.total,
            })}
            {pagination.totalFiltered !== pagination.total && (
              <span className="filtered-info">
                {" "}
                {t("invoiceManagement.list.pagination.filteredFrom", {
                  total: pagination.total,
                })}
              </span>
            )}
          </span>
        </div>
        <div className="pagination-size-selector">
          <label htmlFor="pageSize" className="page-size-label">
            {t("invoiceManagement.list.pagination.show")}
          </label>
          <select
            id="pageSize"
            value={pagination.limit}
            onChange={(e) => handleLimitChange(parseInt(e.target.value))}
            className="page-size-select"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="page-size-label">
            {t("invoiceManagement.list.pagination.perPage")}
          </span>
        </div>
      </div>
    </>
  );
}
