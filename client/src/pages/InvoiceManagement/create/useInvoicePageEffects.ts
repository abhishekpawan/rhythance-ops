import { useEffect } from "react";
import { getTodayInCanada } from "../../../utils/dateUtils";
import { calculateDueDate } from "../invoiceCalculations";
import type { createInvoiceLoaders } from "./createInvoiceLoaders";
import type { useInvoiceFormState } from "./useInvoiceFormState";
import type { createLineHandlers } from "./createLineHandlers";
import type { useInvoicePageHooks } from "./useInvoicePageHooks";
import type { createInvoiceEditLoader } from "./createInvoiceEditLoader";

export function useInvoicePageEffects(
  ctx: ReturnType<typeof createInvoiceLoaders> &
    ReturnType<typeof useInvoiceFormState> &
    ReturnType<typeof createLineHandlers> &
    ReturnType<typeof useInvoicePageHooks> &
    ReturnType<typeof createInvoiceEditLoader>
) {
  const {
    addLineItem,
    addSupplierPOItem,
    createdInvoice,
    fetchAllJobseekers,
    fetchClientPositions,
    fetchClients,
    fetchInvoiceForEdit,
    invoiceDate,
    isEditMode,
    searchParams,
    selectedClient,
    setDueDate,
    setEditingInvoiceId,
    setEmailToSend,
    setInvoiceDate,
    setIsEditMode,
    setIsViewMode,
    setLineItems,
    setSelectedTerms,
    setSupplierPOItems,
    showInvoiceSuccessModal,
  } = ctx;
  useEffect(() => {
    // Fetch clients on component mount
    fetchClients();

    // Fetch all jobseekers on component mount
    fetchAllJobseekers();

    // Set default invoice date to today (Canadian timezone)
    setInvoiceDate(getTodayInCanada());

    // Initialize with one empty line item
    addLineItem();

    // Initialize with one empty supplier/PO item
    addSupplierPOItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the dependency list is the one the effect had in the page component
  }, []);

  // Fetch positions when client is selected
  useEffect(() => {
    if (selectedClient) {
      fetchClientPositions(selectedClient.id!);
      // Reset line items when client changes
      setLineItems([]);
      addLineItem();

      // Reset supplier/PO items when client changes
      setSupplierPOItems([]);
      addSupplierPOItem();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the dependency list is the one the effect had in the page component
  }, [selectedClient]);

  // Update currency and terms when client is selected
  useEffect(() => {
    if (selectedClient) {
      // Only set terms from client if not in edit mode
      if (!isEditMode) {
        const clientTerms = selectedClient.terms || "Net 30";
        setSelectedTerms(clientTerms);

        // Calculate due date based on terms
        if (invoiceDate) {
          calculateDueDate(invoiceDate, clientTerms, setDueDate);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the dependency list is the one the effect had in the page component
  }, [selectedClient, invoiceDate, isEditMode]);

  useEffect(() => {
    if (showInvoiceSuccessModal && createdInvoice) {
      const emailToSet =
        createdInvoice.invoice_sent_to ||
        createdInvoice.client?.emailAddress1 ||
        selectedClient?.emailAddress1 ||
        "";
      setEmailToSend(emailToSet);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the dependency list is the one the effect had in the page component
  }, [showInvoiceSuccessModal, createdInvoice, selectedClient?.emailAddress1]);

  // Initialize edit/view mode when invoice ID is present in query params
  useEffect(() => {
    const invoiceId = searchParams.get("id");
    const mode = searchParams.get("mode");
    if (invoiceId && invoiceId.trim() !== "") {
      const viewOnly = mode === "view";
      setIsViewMode(viewOnly);
      setIsEditMode(!viewOnly);
      setEditingInvoiceId(invoiceId);
      fetchInvoiceForEdit(invoiceId);
    } else {
      setIsViewMode(false);
      setIsEditMode(false);
      setEditingInvoiceId(null);
    }
  }, [searchParams]);

  return {};
}
