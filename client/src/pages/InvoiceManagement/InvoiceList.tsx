import { Plus } from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import "../../styles/pages/InvoiceManagement.css";
import { useInvoiceListHooks } from "./list/useInvoiceListHooks";
import { useInvoiceListState } from "./list/useInvoiceListState";
import { createListFilters } from "./list/createListFilters";
import { useInvoiceFetch } from "./list/useInvoiceFetch";
import { createListActions } from "./list/createListActions";
import { useInvoiceListEffects } from "./list/useInvoiceListEffects";
import { InvoiceListHeader } from "./list/InvoiceListHeader";
import { Pagination } from "../../components/Pagination";
import { invoicePaginationLabels } from "./list/invoicePaginationLabels";
import { InvoiceTableHead } from "./list/InvoiceTableHead";
import { InvoiceTableBody } from "./list/InvoiceTableBody";
import { DeleteInvoiceModal } from "./list/DeleteInvoiceModal";

// The invoice list. Its state and functions live in ./list: the hooks and factories below are called in the order
// the code stood in this component, then each screen section gets the whole view and reads what it uses.
export function InvoiceList() {
  const hooks = useInvoiceListHooks();
  const state = useInvoiceListState();
  const filters = createListFilters(state);
  const fetcher = useInvoiceFetch({ ...state, ...hooks });
  const actions = createListActions({ ...hooks, ...state });
  const effects = useInvoiceListEffects({ ...fetcher, ...state, ...hooks });
  const view = {
    ...hooks,
    ...state,
    ...filters,
    ...fetcher,
    ...actions,
    ...effects,
  };
  const {
    error,
    handleCreateInvoice,
    handleLimitChange,
    handlePageChange,
    loading,
    message,
    pagination,
    sendEmailMessage,
    sendEmailStatus,
    t,
  } = view;

  const paginationLabels = invoicePaginationLabels(t, pagination);

  return (
    <div className="page-container">
      <AppHeader
        title={t("invoiceManagement.list.title")}
        actions={
          <>
            <button
              className="button primary button-icon"
              onClick={handleCreateInvoice}
            >
              <Plus size={16} />
              <span>{t("invoiceManagement.list.newInvoice")}</span>
            </button>
          </>
        }
        statusMessage={sendEmailMessage || message || error}
        statusType={
          sendEmailStatus === "error"
            ? "error"
            : sendEmailStatus === "success"
              ? "success"
              : error
                ? "error"
                : "success"
        }
      />
      <div className="content-container">
        <div className="card">
          <InvoiceListHeader {...view} />
          <Pagination
            position="top"
            pagination={pagination}
            labels={paginationLabels}
            onLimitChange={handleLimitChange}
          />
          <div className="table-container">
            <table className="common-table">
              <InvoiceTableHead {...view} />
              <InvoiceTableBody {...view} />
            </table>
          </div>
          {!loading && (
            <Pagination
              position="bottom"
              pagination={pagination}
              labels={paginationLabels}
              onPageChange={handlePageChange}
              pageLabel={(page) =>
                t("invoiceManagement.list.pagination.goToPage", { page })
              }
            />
          )}
        </div>
      </div>
      <DeleteInvoiceModal {...view} />
    </div>
  );
}
