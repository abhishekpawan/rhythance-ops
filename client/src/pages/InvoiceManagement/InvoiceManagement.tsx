import { AppHeader } from "../../components/AppHeader";
import { InvoiceAttachments } from "../../components/InvoiceAttachments";
import "../../styles/pages/InvoiceManagement.css";
import "../../styles/components/InvoiceAttachments.css";
import { preloadPdfMaker } from "../../utils/loadPdfMaker";
import { useInvoicePageHooks } from "./create/useInvoicePageHooks";
import { useInvoiceFormState } from "./create/useInvoiceFormState";
import { createInvoiceLoaders } from "./create/createInvoiceLoaders";
import { createTimesheetLoader } from "./create/createTimesheetLoader";
import { createLineHandlers } from "./create/createLineHandlers";
import { createInvoiceOptions } from "./create/createInvoiceOptions";
import { createInvoiceHandlers } from "./create/createInvoiceHandlers";
import { createAttachmentUploader } from "./create/createAttachmentUploader";
import { createInvoiceSubmit } from "./create/createInvoiceSubmit";
import { createSuccessActions } from "./create/createSuccessActions";
import { createInvoiceEditLoader } from "./create/createInvoiceEditLoader";
import { useInvoicePageEffects } from "./create/useInvoicePageEffects";
import { InvoiceSelectionBar } from "./create/InvoiceSelectionBar";
import { TimesheetDateRange } from "./create/TimesheetDateRange";
import { NoClientsState } from "./create/NoClientsState";
import { InvoiceDetailsHeader } from "./create/InvoiceDetailsHeader";
import { NoPositionsState } from "./create/NoPositionsState";
import { LineItemsSection } from "./create/LineItemsSection";
import { SupplierPoSection } from "./create/SupplierPoSection";
import { NotesSection } from "./create/NotesSection";
import { InvoiceTableBody } from "./create/InvoiceTableBody";
import { InvoiceTotals } from "./create/InvoiceTotals";
import { GeneratedInvoiceSection } from "./create/GeneratedInvoiceSection";
import { GenerateInvoiceAction } from "./create/GenerateInvoiceAction";
import { InvoiceSkeleton } from "./create/InvoiceSkeleton";
import { InvoiceSuccessModal } from "./create/InvoiceSuccessModal";
preloadPdfMaker();

// The invoice page (create, edit and view of one invoice). Its state and functions live in ./create: the hooks and
// factories below are called in the order the code stood in this component, then each screen section gets the whole
// view and reads what it uses.
export function InvoiceManagement() {
  const hooks = useInvoicePageHooks();
  const form = useInvoiceFormState();
  const loaders = createInvoiceLoaders(form);
  const timesheetLoader = createTimesheetLoader({ ...form, ...hooks });
  const lines = createLineHandlers(form);
  const options = createInvoiceOptions({ ...hooks, ...form });
  const handlers = createInvoiceHandlers({ ...form, ...lines });
  const uploader = createAttachmentUploader({ ...form, ...hooks });
  const submit = createInvoiceSubmit({ ...form, ...hooks, ...uploader });
  const success = createSuccessActions({ ...form, ...hooks });
  const editLoader = createInvoiceEditLoader({ ...form, ...loaders });
  const effects = useInvoicePageEffects({
    ...loaders,
    ...form,
    ...lines,
    ...hooks,
    ...editLoader,
  });
  const view = {
    ...hooks,
    ...form,
    ...loaders,
    ...timesheetLoader,
    ...lines,
    ...options,
    ...handlers,
    ...uploader,
    ...submit,
    ...success,
    ...editLoader,
    ...effects,
  };
  const {
    attachments,
    generationError,
    generationMessage,
    isEditMode,
    isViewMode,
    positionLoading,
    positions,
    selectedClient,
    setAttachments,
    t,
    timesheetFetchMessage,
  } = view;

  return (
    <div className="invoice-page-container">
      <AppHeader
        title={
          isViewMode
            ? t("invoiceManagement.viewInvoice") || "View Client Invoice"
            : isEditMode
              ? t("navigation.editClientInvoice")
              : t("navigation.invoiceManagement")
        }
        hideHamburgerMenu={false}
        statusMessage={
          generationMessage || generationError || timesheetFetchMessage
        }
      />

      <div className="invoice-content-container">
        <InvoiceSelectionBar {...view} />

        <TimesheetDateRange {...view} />

        <NoClientsState {...view} />

        <InvoiceDetailsHeader {...view} />

        <NoPositionsState {...view} />

        {selectedClient && !positionLoading && positions.length > 0 && (
          <>
            <LineItemsSection {...view} />

            <SupplierPoSection {...view} />

            <NotesSection {...view} />

            {/* Invoice Calculations Container */}
            <div className="timesheet-invoice-container">
              <div className="timesheet-invoice-table">
                <div className="timesheet-invoice-table-header">
                  <div className="timesheet-col-description">
                    {t("invoiceManagement.description")}
                  </div>
                  <div className="timesheet-col-hours">
                    {t("invoiceManagement.hours")}
                  </div>
                  <div className="timesheet-col-rate">
                    {t("invoiceManagement.rate")}
                  </div>
                  <div className="timesheet-col-tax">
                    {t("invoiceManagement.tax")}
                  </div>
                  <div className="timesheet-col-amount">
                    {t("invoiceManagement.amount")}
                  </div>
                </div>

                <InvoiceTableBody {...view} />

                <InvoiceTotals {...view} />
              </div>
            </div>

            {/* Invoice Attachments Section */}
            <InvoiceAttachments
              value={attachments}
              onChange={setAttachments}
              disabled={false}
              bucketName="invoices"
            />

            <GeneratedInvoiceSection {...view} />

            <GenerateInvoiceAction {...view} />
          </>
        )}

        <InvoiceSkeleton {...view} />
      </div>

      <InvoiceSuccessModal {...view} />
    </div>
  );
}
