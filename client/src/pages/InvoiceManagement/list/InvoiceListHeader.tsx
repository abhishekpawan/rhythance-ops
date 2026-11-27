import { Search } from "lucide-react";
import type { useInvoiceListHooks } from "./useInvoiceListHooks";
import type { useInvoiceListState } from "./useInvoiceListState";
import type { createListFilters } from "./createListFilters";

export function InvoiceListHeader(
  props: Pick<ReturnType<typeof useInvoiceListHooks>, "t"> &
    Pick<
      ReturnType<typeof useInvoiceListState>,
      "searchTerm" | "setSearchTerm"
    > &
    Pick<ReturnType<typeof createListFilters>, "resetFilters">
) {
  const { resetFilters, searchTerm, setSearchTerm, t } = props;
  return (
    <>
      <div className="card-header">
        <h2>{t("invoiceManagement.list.invoiceListTitle")}</h2>
        <div className="filter-container">
          <div className="search-box">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder={t("invoiceManagement.list.globalSearchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <button
              className="button secondary button-icon reset-filters-btn"
              onClick={resetFilters}
            >
              <span>{t("invoiceManagement.resetFilters")}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
