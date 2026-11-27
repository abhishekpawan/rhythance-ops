import { ChevronLeft, ChevronRight } from "lucide-react";
import type { useInvoiceListState } from "./useInvoiceListState";
import type { useInvoiceListHooks } from "./useInvoiceListHooks";
import type { createListFilters } from "./createListFilters";

export function PaginationBottom(
  props: Pick<
    ReturnType<typeof useInvoiceListState>,
    "loading" | "pagination"
  > &
    Pick<ReturnType<typeof useInvoiceListHooks>, "t"> &
    Pick<
      ReturnType<typeof createListFilters>,
      "handlePreviousPage" | "handlePageChange" | "handleNextPage"
    >
) {
  const {
    handleNextPage,
    handlePageChange,
    handlePreviousPage,
    loading,
    pagination,
    t,
  } = props;
  return (
    <>
      {/* Pagination Controls - Bottom */}
      {!loading && pagination.totalPages > 1 && (
        <div className="pagination-controls bottom">
          <div className="pagination-info">
            <span className="pagination-text">
              {t("invoiceManagement.list.pagination.pageOf", {
                current: pagination.page,
                total: pagination.totalPages,
              })}
            </span>
          </div>
          <div className="pagination-buttons">
            <button
              className="pagination-btn prev"
              onClick={handlePreviousPage}
              disabled={!pagination.hasPrevPage}
              title={t("invoiceManagement.previousPage")}
              aria-label={t("invoiceManagement.previousPage")}
            >
              <ChevronLeft size={16} />
              <span>{t("common.previous")}</span>
            </button>
            {/* Page numbers */}
            <div className="page-numbers">
              {Array.from(
                { length: Math.min(5, pagination.totalPages) },
                (_, i) => {
                  let pageNum;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      className={`page-number-btn ${
                        pageNum === pagination.page ? "active" : ""
                      }`}
                      onClick={() => handlePageChange(pageNum)}
                      aria-label={t(
                        "invoiceManagement.list.pagination.goToPage",
                        { page: pageNum }
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                }
              )}
            </div>
            <button
              className="pagination-btn next"
              onClick={handleNextPage}
              disabled={!pagination.hasNextPage}
              title={t("invoiceManagement.nextPage")}
              aria-label={t("invoiceManagement.nextPage")}
            >
              <span>{t("common.next")}</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
