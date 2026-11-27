import { Mail, Pencil, ArrowLeft, Download, AlertCircle } from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { Loader } from "../../components/Loader";
import "../../styles/pages/InvoiceView.css";
import { useInvoiceViewHooks } from "./view/useInvoiceViewHooks";
import { useInvoiceViewState } from "./view/useInvoiceViewState";
import { createInvoiceViewActions } from "./view/createInvoiceViewActions";
import { useInvoiceViewEffects } from "./view/useInvoiceViewEffects";
import { createInvoiceViewData } from "./view/createInvoiceViewData";
import { InvoiceHeaderBar } from "./view/InvoiceHeaderBar";
import { OverviewCard } from "./view/OverviewCard";
import { LineItemsCard } from "./view/LineItemsCard";
import { SupplierPoCard } from "./view/SupplierPoCard";
import { AdditionalInfoCard } from "./view/AdditionalInfoCard";
import { ClientInfoCard } from "./view/ClientInfoCard";
import { FinancialSummaryCard } from "./view/FinancialSummaryCard";
import { PdfPreviewCard } from "./view/PdfPreviewCard";
import { AttachmentsCard } from "./view/AttachmentsCard";
import { SendEmailModal } from "./view/SendEmailModal";

// The invoice view page. Its state and functions live in ./view: the hooks and factories below are called in the
// order the code stood in this component, then each card gets the whole view and reads what it uses.
export function InvoiceView() {
  const hooks = useInvoiceViewHooks();
  const state = useInvoiceViewState(hooks);
  const actions = createInvoiceViewActions(state);
  const effects = useInvoiceViewEffects({ ...state, ...actions });
  const view1 = { ...hooks, ...state, ...actions, ...effects };
  const {
    error,
    handleDownloadPdf,
    invoice,
    isGeneratingPdfUrl,
    loading,
    navigate,
    setIsEmailModalOpen,
    t,
  } = view1;

  if (loading) {
    return (
      <div className="invoice-view-page-container">
        <AppHeader
          title={t("invoiceManagement.viewInvoice") || "View Client Invoice"}
        />
        <div className="invoice-view-loading-container">
          <Loader variant="inline" size="lg" message={t("common.loading")} />
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="invoice-view-page-container">
        <AppHeader
          title={t("invoiceManagement.viewInvoice") || "View Client Invoice"}
        />
        <div className="invoice-view-content">
          <div
            className="invoice-view-card"
            style={{ textAlign: "center", padding: "40px 20px" }}
          >
            <AlertCircle
              size={48}
              color="#ef4444"
              style={{ marginBottom: "16px" }}
            />
            <h3>{error || t("invoiceManagement.invoiceNotFound")}</h3>
            <button
              className="button secondary"
              style={{ marginTop: "16px" }}
              onClick={() => navigate("/invoice-management/list")}
            >
              <ArrowLeft size={16} /> {t("invoiceManagement.backToInvoiceList")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const data = createInvoiceViewData({ ...state, invoice });
  const view = { ...view1, ...data, invoice };

  return (
    <div className="invoice-view-page-container">
      <AppHeader
        title={`${t("invoiceManagement.viewInvoice") || "View Invoice"} #${invoice.invoiceNumber}`}
        actions={
          <div className="invoice-view-actions-group">
            <button
              className="button secondary"
              onClick={() => navigate("/invoice-management/list")}
            >
              <ArrowLeft size={16} />
              {t("buttons.back") || "Back to Invoices"}
            </button>
            <button
              className="button secondary button-icon"
              onClick={() =>
                navigate(`/invoice-management/create?id=${invoice.id}`)
              }
            >
              <Pencil size={16} />
              {t("invoiceManagement.editInvoice") || "Edit Invoice"}
            </button>
            {invoice.documentPath && (
              <button
                className="button secondary button-icon"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdfUrl}
              >
                <Download size={16} />
                {t("invoiceManagement.download") || "Download PDF"}
              </button>
            )}
            <button
              className="button primary button-icon"
              onClick={() => setIsEmailModalOpen(true)}
            >
              <Mail size={16} />
              {invoice.emailSent
                ? t("invoiceManagement.resendEmail")
                : t("invoiceManagement.list.sendEmail")}
            </button>
          </div>
        }
      />

      <div className="invoice-view-content">
        <InvoiceHeaderBar invoice={view.invoice} />

        {/* Main Details Grid */}
        <div className="invoice-view-grid">
          {/* Left Column: Details & Line Items */}
          <div className="invoice-view-main-column">
            <OverviewCard formatted={view.formatted} invoice={view.invoice} />

            <LineItemsCard timesheets={view.timesheets} />

            <SupplierPoCard supplierPOItems={view.supplierPOItems} />

            <AdditionalInfoCard
              invoice={view.invoice}
              messageOnInvoice={view.messageOnInvoice}
              termsOnInvoice={view.termsOnInvoice}
            />
          </div>

          {/* Right Sidebar: Client Details & Financial Summary */}
          <div className="invoice-view-sidebar-column">
            <ClientInfoCard
              clientData={view.clientData}
              fullAddress={view.fullAddress}
              invoice={view.invoice}
            />

            <FinancialSummaryCard
              formatted={view.formatted}
              invoice={view.invoice}
            />

            <PdfPreviewCard
              handleDownloadPdf={view.handleDownloadPdf}
              invoice={view.invoice}
              pdfSignedUrl={view.pdfSignedUrl}
            />

            <AttachmentsCard attachments={view.attachments} />
          </div>
        </div>
      </div>

      <SendEmailModal
        emailInput={view.emailInput}
        emailStatusMessage={view.emailStatusMessage}
        handleSendEmailSubmit={view.handleSendEmailSubmit}
        invoice={view.invoice}
        isEmailModalOpen={view.isEmailModalOpen}
        isSendingEmail={view.isSendingEmail}
        setEmailInput={view.setEmailInput}
        setIsEmailModalOpen={view.setIsEmailModalOpen}
        t={view.t}
      />
    </div>
  );
}

export default InvoiceView;
