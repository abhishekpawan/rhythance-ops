import {
  InvoiceData,
  deleteInvoice,
  sendInvoiceEmail,
} from "../../../services/api/invoice";
import { getClientEmail } from "./invoiceListHelpers";
import type { useInvoiceListHooks } from "./useInvoiceListHooks";
import type { useInvoiceListState } from "./useInvoiceListState";

export function createListActions(
  ctx: ReturnType<typeof useInvoiceListHooks> &
    ReturnType<typeof useInvoiceListState>
) {
  const {
    invoiceToDelete,
    invoices,
    navigate,
    setDeleteError,
    setInvoiceToDelete,
    setInvoices,
    setIsDeleteModalOpen,
    setIsDeleting,
    setMessage,
    setSendEmailMessage,
    setSendEmailStatus,
    setSendingEmailInvoiceId,
    t,
  } = ctx;
  // Event handlers
  const handleCreateInvoice = () => {
    navigate("/invoice-management/create");
  };

  const handleViewInvoice = (id: string) => {
    navigate(`/invoice-management/view/${id}`);
  };

  const handleEditInvoice = (id: string) => {
    navigate(`/invoice-management/create?id=${id}`);
  };

  const handleDeleteClick = (invoice: InvoiceData) => {
    setInvoiceToDelete(invoice);
    setIsDeleteModalOpen(true);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!invoiceToDelete?.id) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await deleteInvoice(invoiceToDelete.id as string);
      setInvoices(invoices.filter((i) => i.id !== invoiceToDelete.id));
      setMessage(
        t("invoiceManagement.list.deleteSuccess", {
          invoiceNumber:
            invoiceToDelete.invoiceNumber || t("invoiceManagement.unknown"),
        })
      );

      // Close modal and reset state after successful deletion
      setIsDeleteModalOpen(false);
      setInvoiceToDelete(null);
      setDeleteError(null);

      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : t("invoiceManagement.list.deleteFailed");
      setDeleteError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
    setInvoiceToDelete(null);
    setDeleteError(null);
  };

  // Function to send invoice to client (robust, like InvoiceManagement)
  const sendInvoiceToClient = async (invoice: InvoiceData) => {
    if (!invoice.id) {
      setSendEmailMessage(t("invoiceManagement.missingEmailForSend"));
      setSendEmailStatus("error");
      return;
    }

    const emailToSend =
      invoice.invoice_sent_to || getClientEmail(invoice.client) || "";
    if (!emailToSend) {
      setSendEmailMessage(t("invoiceManagement.noEmailAddress"));
      setSendEmailStatus("error");
      return;
    }

    setSendingEmailInvoiceId(invoice.id as string);
    setSendEmailMessage(null);
    setSendEmailStatus(null);
    try {
      const response = await sendInvoiceEmail(invoice.id, emailToSend);
      if (response.success) {
        setSendEmailMessage(
          t("invoiceManagement.list.sendSuccess", { email: emailToSend })
        );
        setSendEmailStatus("success");
        // Optionally update local invoice state
        setInvoices((prevInvoices) =>
          prevInvoices.map((inv) =>
            inv.id === invoice.id
              ? {
                  ...inv,
                  emailSent: true,
                  emailSentDate: new Date().toISOString(),
                  invoice_sent_to: emailToSend,
                }
              : inv
          )
        );
      } else {
        setSendEmailMessage(
          response.message || t("invoiceManagement.sendInvoiceFailed")
        );
        setSendEmailStatus("error");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : t("invoiceManagement.sendInvoiceFailed");
      setSendEmailMessage(errorMessage);
      setSendEmailStatus("error");
    } finally {
      setSendingEmailInvoiceId(null);
      setTimeout(() => {
        setSendEmailMessage(null);
        setSendEmailStatus(null);
      }, 5000);
    }
  };

  return {
    handleCreateInvoice,
    handleViewInvoice,
    handleEditInvoice,
    handleDeleteClick,
    handleConfirmDelete,
    handleCancelDelete,
    sendInvoiceToClient,
  };
}
