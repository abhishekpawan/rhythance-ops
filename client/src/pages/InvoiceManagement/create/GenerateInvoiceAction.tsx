import { Pencil, Loader2, Plus } from "lucide-react";
import type { useInvoiceFormState } from "./useInvoiceFormState";
import type { useInvoicePageHooks } from "./useInvoicePageHooks";
import type { createInvoiceSubmit } from "./createInvoiceSubmit";

export function GenerateInvoiceAction(
  props: Pick<
    ReturnType<typeof useInvoiceFormState>,
    | "isViewMode"
    | "editingInvoiceId"
    | "isGeneratingInvoice"
    | "selectedClient"
    | "invoiceNumber"
    | "lineItems"
    | "isEditMode"
  > &
    Pick<ReturnType<typeof useInvoicePageHooks>, "navigate" | "t"> &
    Pick<ReturnType<typeof createInvoiceSubmit>, "handleInvoiceSubmit">
) {
  const {
    editingInvoiceId,
    handleInvoiceSubmit,
    invoiceNumber,
    isEditMode,
    isGeneratingInvoice,
    isViewMode,
    lineItems,
    navigate,
    selectedClient,
    t,
  } = props;
  return (
    <>
      {/* Generate Invoice Section */}
      <div className="timesheet-action-section">
        {isViewMode ? (
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button
              className="button secondary"
              onClick={() => navigate("/invoice-management/list")}
            >
              {t("buttons.back") || "Back to List"}
            </button>
            <button
              className="button primary button-icon"
              onClick={() =>
                navigate(`/invoice-management/create?id=${editingInvoiceId}`)
              }
            >
              <Pencil size={16} />
              {t("invoiceManagement.editInvoice") || "Edit Invoice"}
            </button>
          </div>
        ) : (
          <button
            className={`button ${
              isGeneratingInvoice ||
              !selectedClient ||
              !invoiceNumber ||
              lineItems.length === 0 ||
              !lineItems.some(
                (item) =>
                  parseFloat(item.hours) > 0 &&
                  parseFloat(item.regularBillRate) > 0
              )
                ? "disabled"
                : ""
            }`}
            onClick={() => {
              handleInvoiceSubmit();
            }}
            disabled={
              isGeneratingInvoice ||
              !selectedClient ||
              !invoiceNumber ||
              lineItems.length === 0 ||
              !lineItems.some(
                (item) =>
                  parseFloat(item.hours) > 0 &&
                  parseFloat(item.regularBillRate) > 0
              )
            }
          >
            {isGeneratingInvoice ? (
              <>
                <Loader2 size={16} className="timesheet-loading-spinner" />
                {isEditMode
                  ? t("invoiceManagement.updating")
                  : t("invoiceManagement.generating")}
              </>
            ) : (
              <>
                <Plus size={16} />
                {isEditMode
                  ? t("invoiceManagement.updateInvoice")
                  : t("invoiceManagement.generateInvoice")}
              </>
            )}
          </button>
        )}
      </div>
    </>
  );
}
