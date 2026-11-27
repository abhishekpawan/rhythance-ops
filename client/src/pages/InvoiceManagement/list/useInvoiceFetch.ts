import { useCallback } from "react";
import { getInvoices } from "../../../services/api/invoice";
import type { useInvoiceListState } from "./useInvoiceListState";
import type { useInvoiceListHooks } from "./useInvoiceListHooks";

export function useInvoiceFetch(
  ctx: ReturnType<typeof useInvoiceListState> &
    ReturnType<typeof useInvoiceListHooks>
) {
  const {
    clientEmailFilter,
    clientFilter,
    dateRangeEnd,
    dateRangeStart,
    documentGeneratedFilter,
    dueDateEnd,
    dueDateStart,
    emailSentFilter,
    invoiceNumberFilter,
    invoiceSentFilter,
    pagination,
    paymentTermsFilter,
    searchTerm,
    setError,
    setInvoices,
    setLoading,
    setPagination,
    t,
  } = ctx;
  // Fetch invoices with filters
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        searchTerm: searchTerm,
        clientFilter: clientFilter,
        clientEmailFilter: clientEmailFilter,
        invoiceNumberFilter: invoiceNumberFilter,
        dateRangeStart: dateRangeStart,
        dateRangeEnd: dateRangeEnd,
        dueDateStart: dueDateStart,
        dueDateEnd: dueDateEnd,
        emailSentFilter: emailSentFilter,
        invoiceSentFilter: invoiceSentFilter,
        documentGeneratedFilter: documentGeneratedFilter,
        paymentTermsFilter: paymentTermsFilter,
      };
      const response = await getInvoices(params);
      setInvoices(response.invoices);
      setPagination(response.pagination);
    } catch (err) {
      setError(t("invoiceManagement.list.fetchFailed"));
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    searchTerm,
    clientFilter,
    clientEmailFilter,
    invoiceNumberFilter,
    dateRangeStart,
    dateRangeEnd,
    dueDateStart,
    dueDateEnd,
    emailSentFilter,
    invoiceSentFilter,
    documentGeneratedFilter,
    paymentTermsFilter,
  ]);

  return { fetchInvoices };
}
