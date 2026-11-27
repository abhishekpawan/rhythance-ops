import { useState } from "react";
import { InvoiceData } from "../../../services/api/invoice";
import { PaginationInfo } from "./invoiceListHelpers";

export function useInvoiceListState() {
  // State management
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [invoiceNumberFilter, setInvoiceNumberFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [clientEmailFilter, setClientEmailFilter] = useState("");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [dueDateStart, setDueDateStart] = useState("");
  const [dueDateEnd, setDueDateEnd] = useState("");
  const [emailSentFilter, setEmailSentFilter] = useState("");
  const [invoiceSentFilter, setInvoiceSentFilter] = useState("");
  const [documentGeneratedFilter, setDocumentGeneratedFilter] = useState("");
  const [paymentTermsFilter, setPaymentTermsFilter] = useState("");

  // Pagination state
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 25,
    total: 0,
    totalFiltered: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Delete confirmation state
  const [invoiceToDelete, setInvoiceToDelete] = useState<InvoiceData | null>(
    null
  );
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Send email state
  const [sendingEmailInvoiceId, setSendingEmailInvoiceId] = useState<
    string | null
  >(null);
  const [sendEmailStatus, setSendEmailStatus] = useState<
    "success" | "error" | null
  >(null);
  const [sendEmailMessage, setSendEmailMessage] = useState<string | null>(null);

  return {
    invoices,
    setInvoices,
    loading,
    setLoading,
    error,
    setError,
    message,
    setMessage,
    searchTerm,
    setSearchTerm,
    invoiceNumberFilter,
    setInvoiceNumberFilter,
    clientFilter,
    setClientFilter,
    clientEmailFilter,
    setClientEmailFilter,
    dateRangeStart,
    setDateRangeStart,
    dateRangeEnd,
    setDateRangeEnd,
    dueDateStart,
    setDueDateStart,
    dueDateEnd,
    setDueDateEnd,
    emailSentFilter,
    setEmailSentFilter,
    invoiceSentFilter,
    setInvoiceSentFilter,
    documentGeneratedFilter,
    setDocumentGeneratedFilter,
    paymentTermsFilter,
    setPaymentTermsFilter,
    pagination,
    setPagination,
    invoiceToDelete,
    setInvoiceToDelete,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    isDeleting,
    setIsDeleting,
    deleteError,
    setDeleteError,
    sendingEmailInvoiceId,
    setSendingEmailInvoiceId,
    sendEmailStatus,
    setSendEmailStatus,
    sendEmailMessage,
    setSendEmailMessage,
  };
}
