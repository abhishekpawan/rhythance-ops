import { useEffect } from "react";
import type { useInvoiceFetch } from "./useInvoiceFetch";
import type { useInvoiceListState } from "./useInvoiceListState";
import type { useInvoiceListHooks } from "./useInvoiceListHooks";

export function useInvoiceListEffects(
  ctx: ReturnType<typeof useInvoiceFetch> &
    ReturnType<typeof useInvoiceListState> &
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
    fetchInvoices,
    invoiceNumberFilter,
    invoiceSentFilter,
    location,
    pagination,
    paymentTermsFilter,
    searchTerm,
    setClientEmailFilter,
    setClientFilter,
    setDateRangeEnd,
    setDateRangeStart,
    setDocumentGeneratedFilter,
    setDueDateEnd,
    setDueDateStart,
    setEmailSentFilter,
    setInvoiceNumberFilter,
    setInvoiceSentFilter,
    setPagination,
    setPaymentTermsFilter,
    setSearchTerm,
  } = ctx;
  // Debounced fetch effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchInvoices();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [fetchInvoices]);

  // Reset to first page when filters change
  useEffect(() => {
    if (pagination.page !== 1) {
      setPagination((prev) => ({ ...prev, page: 1 }));
    }
  }, [
    searchTerm,
    invoiceNumberFilter,
    clientFilter,
    clientEmailFilter,
    dateRangeStart,
    dateRangeEnd,
    dueDateStart,
    dueDateEnd,
    emailSentFilter,
    invoiceSentFilter,
    documentGeneratedFilter,
    paymentTermsFilter,
  ]);

  // --- New: Initialize filters from query params on mount ---
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchTerm(params.get("searchTerm") || "");
    setInvoiceNumberFilter(params.get("invoiceNumber") || "");
    setClientFilter(params.get("client") || "");
    setClientEmailFilter(params.get("clientEmail") || "");
    setDateRangeStart(params.get("dateRangeStart") || "");
    setDateRangeEnd(params.get("dateRangeEnd") || "");
    setDueDateStart(params.get("dueDateStart") || "");
    setDueDateEnd(params.get("dueDateEnd") || "");
    setEmailSentFilter(params.get("emailSent") || "");
    setInvoiceSentFilter(params.get("invoiceSent") || "");
    setDocumentGeneratedFilter(params.get("documentGenerated") || "");
    setPaymentTermsFilter(
      params.get("paymentTerms") || params.get("paymentTermsFilter") || ""
    );
    // Example: How to use filter params in the URL
    //
    //   /invoice-management/list?searchTerm=Acme&invoiceNumber=INV-123&client=Acme%20Corp&clientEmail=acme%40email.com&dateRangeStart=2024-07-01&dateRangeEnd=2024-07-31&dueDateStart=2024-08-01&dueDateEnd=2024-08-31&emailSent=true&invoiceSent=true&documentGenerated=true
    //
    // Any combination of these params can be used to pre-populate filters on page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the dependency list is the one the effect had in the page component
  }, [location.search]);
  // --- End new code ---

  return {};
}
