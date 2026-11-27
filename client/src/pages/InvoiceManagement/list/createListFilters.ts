import type { useInvoiceListState } from "./useInvoiceListState";

export function createListFilters(ctx: ReturnType<typeof useInvoiceListState>) {
  const {
    pagination,
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
  // Utility functions
  const resetFilters = () => {
    setSearchTerm("");
    setInvoiceNumberFilter("");
    setClientFilter("");
    setClientEmailFilter("");
    setDateRangeStart("");
    setDateRangeEnd("");
    setDueDateStart("");
    setDueDateEnd("");
    setEmailSentFilter("");
    setInvoiceSentFilter("");
    setDocumentGeneratedFilter("");
    setPaymentTermsFilter("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleLimitChange = (newLimit: number) => {
    setPagination((prev) => ({ ...prev, limit: newLimit, page: 1 }));
  };

  const handlePreviousPage = () => {
    if (pagination.hasPrevPage) {
      setPagination((prev) => ({ ...prev, page: prev.page - 1 }));
    }
  };

  const handleNextPage = () => {
    if (pagination.hasNextPage) {
      setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
    }
  };

  return {
    resetFilters,
    handlePageChange,
    handleLimitChange,
    handlePreviousPage,
    handleNextPage,
  };
}
