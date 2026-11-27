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
  const handlers = createInvoiceHandlers({ ...form, ...lines, t: hooks.t });
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
        <InvoiceSelectionBar
          clientLoading={view.clientLoading}
          clientOptions={view.clientOptions}
          dueDate={view.dueDate}
          handleClientSelect={view.handleClientSelect}
          handleDueDateChange={view.handleDueDateChange}
          handleDueDateClick={view.handleDueDateClick}
          handleInvoiceDateChange={view.handleInvoiceDateChange}
          handleInvoiceDateClick={view.handleInvoiceDateClick}
          handleTermsSelect={view.handleTermsSelect}
          invoiceDate={view.invoiceDate}
          selectedClient={view.selectedClient}
          selectedClientOption={view.selectedClientOption}
          selectedTermsOption={view.selectedTermsOption}
          t={view.t}
          termsOptions={view.termsOptions}
        />

        <TimesheetDateRange
          fetchAndPopulateTimesheets={view.fetchAndPopulateTimesheets}
          isFetchingTimesheets={view.isFetchingTimesheets}
          selectedClient={view.selectedClient}
          setTimesheetEndDate={view.setTimesheetEndDate}
          setTimesheetStartDate={view.setTimesheetStartDate}
          t={view.t}
          timesheetEndDate={view.timesheetEndDate}
          timesheetStartDate={view.timesheetStartDate}
        />

        <NoClientsState
          clientLoading={view.clientLoading}
          clients={view.clients}
          t={view.t}
        />

        <InvoiceDetailsHeader
          dueDate={view.dueDate}
          invoiceDate={view.invoiceDate}
          invoiceNumber={view.invoiceNumber}
          invoiceNumberLoading={view.invoiceNumberLoading}
          selectedClient={view.selectedClient}
          selectedTerms={view.selectedTerms}
          t={view.t}
        />

        <NoPositionsState
          positionLoading={view.positionLoading}
          positions={view.positions}
          selectedClient={view.selectedClient}
          t={view.t}
        />

        {selectedClient && !positionLoading && positions.length > 0 && (
          <>
            <LineItemsSection
              addLineItem={view.addLineItem}
              getJobseekerOptions={view.getJobseekerOptions}
              handleJobseekerSelect={view.handleJobseekerSelect}
              handlePositionSelect={view.handlePositionSelect}
              handleSalesTaxSelect={view.handleSalesTaxSelect}
              jobseekerLoading={view.jobseekerLoading}
              lineItems={view.lineItems}
              positionOptions={view.positionOptions}
              removeLineItem={view.removeLineItem}
              salesTaxOptions={view.salesTaxOptions}
              t={view.t}
              updateLineItem={view.updateLineItem}
            />

            <SupplierPoSection
              addSupplierPOItem={view.addSupplierPOItem}
              combinedOptions={view.combinedOptions}
              handleCombinedOptionSelect={view.handleCombinedOptionSelect}
              handleSupplierPONumberChange={view.handleSupplierPONumberChange}
              messageOnInvoice={view.messageOnInvoice}
              removeSupplierPOItem={view.removeSupplierPOItem}
              setMessageOnInvoice={view.setMessageOnInvoice}
              setTermsOnInvoice={view.setTermsOnInvoice}
              supplierPOItems={view.supplierPOItems}
              t={view.t}
              termsOnInvoice={view.termsOnInvoice}
            />

            <NotesSection
              notes={view.notes}
              setNotes={view.setNotes}
              t={view.t}
            />

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

                <InvoiceTableBody lineItems={view.lineItems} t={view.t} />

                <InvoiceTotals
                  lineItems={view.lineItems}
                  selectedClient={view.selectedClient}
                  t={view.t}
                />
              </div>
            </div>

            {/* Invoice Attachments Section */}
            <InvoiceAttachments
              value={attachments}
              onChange={setAttachments}
              disabled={false}
              bucketName="invoices"
            />

            <GeneratedInvoiceSection
              documentFileName={view.documentFileName}
              documentFileSize={view.documentFileSize}
              documentPath={view.documentPath}
              isEditMode={view.isEditMode}
              t={view.t}
            />

            <GenerateInvoiceAction
              editingInvoiceId={view.editingInvoiceId}
              handleInvoiceSubmit={view.handleInvoiceSubmit}
              invoiceNumber={view.invoiceNumber}
              isEditMode={view.isEditMode}
              isGeneratingInvoice={view.isGeneratingInvoice}
              isViewMode={view.isViewMode}
              lineItems={view.lineItems}
              navigate={view.navigate}
              selectedClient={view.selectedClient}
              t={view.t}
            />
          </>
        )}

        <InvoiceSkeleton
          positionLoading={view.positionLoading}
          selectedClient={view.selectedClient}
        />
      </div>

      <InvoiceSuccessModal
        createdInvoice={view.createdInvoice}
        emailToSend={view.emailToSend}
        emailUpdateMessage={view.emailUpdateMessage}
        goToNextPage={view.goToNextPage}
        goToPrevPage={view.goToPrevPage}
        handleDownloadInvoice={view.handleDownloadInvoice}
        isSendingInvoice={view.isSendingInvoice}
        onPdfLoadSuccess={view.onPdfLoadSuccess}
        pdfBlobUrl={view.pdfBlobUrl}
        pdfNumPages={view.pdfNumPages}
        pdfPageNumber={view.pdfPageNumber}
        pdfScale={view.pdfScale}
        resetZoom={view.resetZoom}
        selectedClient={view.selectedClient}
        sendInvoiceMessage={view.sendInvoiceMessage}
        sendInvoiceToClient={view.sendInvoiceToClient}
        setEmailToSend={view.setEmailToSend}
        setEmailUpdateMessage={view.setEmailUpdateMessage}
        setShowInvoiceSuccessModal={view.setShowInvoiceSuccessModal}
        showInvoiceSuccessModal={view.showInvoiceSuccessModal}
        t={view.t}
        zoomIn={view.zoomIn}
        zoomOut={view.zoomOut}
      />
    </div>
  );
}
