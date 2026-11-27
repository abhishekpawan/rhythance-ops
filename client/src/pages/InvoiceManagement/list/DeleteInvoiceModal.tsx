import { ConfirmationModal } from "../../../components/ConfirmationModal";
import type { useInvoiceListState } from "./useInvoiceListState";
import type { useInvoiceListHooks } from "./useInvoiceListHooks";
import type { createListActions } from "./createListActions";

export function DeleteInvoiceModal(
  props: Pick<
    ReturnType<typeof useInvoiceListState>,
    "isDeleteModalOpen" | "invoiceToDelete" | "deleteError" | "isDeleting"
  > &
    Pick<ReturnType<typeof useInvoiceListHooks>, "t"> &
    Pick<
      ReturnType<typeof createListActions>,
      "handleConfirmDelete" | "handleCancelDelete"
    >
) {
  const {
    deleteError,
    handleCancelDelete,
    handleConfirmDelete,
    invoiceToDelete,
    isDeleteModalOpen,
    isDeleting,
    t,
  } = props;
  return (
    <>
      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        title={t("invoiceManagement.deleteInvoice")}
        message={`${t("invoiceManagement.deleteInvoiceConfirm").replace(
          "this invoice",
          `"${
            invoiceToDelete
              ? invoiceToDelete.invoiceNumber
              : t("invoiceManagement.unknown")
          }"`
        )}${deleteError ? `\n\nError: ${deleteError}` : ""}`}
        confirmText={
          isDeleting
            ? t("buttons.deleting")
            : t("invoiceManagement.deleteInvoice")
        }
        cancelText={t("buttons.cancel")}
        confirmButtonClass="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  );
}
