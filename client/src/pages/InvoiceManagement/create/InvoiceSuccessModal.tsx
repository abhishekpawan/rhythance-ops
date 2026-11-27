import { Document, Page } from "react-pdf";
import { pdfDocumentOptions } from "../../../utils/pdfViewer";
import { Download } from "lucide-react";
import type { useInvoiceFormState } from "./useInvoiceFormState";
import type { createSuccessActions } from "./createSuccessActions";
import type { useInvoicePageHooks } from "./useInvoicePageHooks";

export function InvoiceSuccessModal(
  props: Pick<
    ReturnType<typeof useInvoiceFormState>,
    | "showInvoiceSuccessModal"
    | "createdInvoice"
    | "setShowInvoiceSuccessModal"
    | "pdfBlobUrl"
    | "pdfPageNumber"
    | "pdfScale"
    | "pdfNumPages"
    | "selectedClient"
    | "emailToSend"
    | "setEmailToSend"
    | "setEmailUpdateMessage"
    | "isSendingInvoice"
    | "sendInvoiceMessage"
    | "emailUpdateMessage"
  > &
    Pick<
      ReturnType<typeof createSuccessActions>,
      | "zoomOut"
      | "resetZoom"
      | "zoomIn"
      | "onPdfLoadSuccess"
      | "goToPrevPage"
      | "goToNextPage"
      | "handleDownloadInvoice"
      | "sendInvoiceToClient"
    > &
    Pick<ReturnType<typeof useInvoicePageHooks>, "t">
) {
  const {
    createdInvoice,
    emailToSend,
    emailUpdateMessage,
    goToNextPage,
    goToPrevPage,
    handleDownloadInvoice,
    isSendingInvoice,
    onPdfLoadSuccess,
    pdfBlobUrl,
    pdfNumPages,
    pdfPageNumber,
    pdfScale,
    resetZoom,
    selectedClient,
    sendInvoiceMessage,
    sendInvoiceToClient,
    setEmailToSend,
    setEmailUpdateMessage,
    setShowInvoiceSuccessModal,
    showInvoiceSuccessModal,
    t,
    zoomIn,
    zoomOut,
  } = props;
  return (
    <>
      {/* Show Invoice Success Modal */}
      {showInvoiceSuccessModal && createdInvoice && (
        <div className="invoice-success-modal-overlay">
          <div className="invoice-success-modal-content">
            <button
              className="invoice-success-modal-close-btn"
              onClick={() => {
                setShowInvoiceSuccessModal(false);
                window.location.reload();
              }}
            >
              &times;
            </button>

            {/* PDF Preview Left Side */}
            <div className="invoice-success-modal-pdf-preview">
              <div className="invoice-success-modal-pdf-controls">
                <button onClick={zoomOut}>-</button>
                <button onClick={resetZoom}>100%</button>
                <button onClick={zoomIn}>+</button>
              </div>
              <div className="invoice-success-modal-pdf-page-container">
                <Document
                  file={pdfBlobUrl || ""}
                  options={pdfDocumentOptions}
                  onLoadSuccess={onPdfLoadSuccess}
                  loading={<div>{t("invoiceManagement.loadingPDF")}</div>}
                  error={<div>{t("invoiceManagement.failedToLoadPDF")}</div>}
                >
                  <Page
                    pageNumber={pdfPageNumber}
                    width={400}
                    scale={pdfScale}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </Document>
              </div>
              {pdfNumPages && (
                <div className="invoice-success-modal-pdf-navigation">
                  <button onClick={goToPrevPage} disabled={pdfPageNumber <= 1}>
                    {t("invoiceManagement.previous")}
                  </button>
                  <span>
                    {t("invoiceManagement.page")} {pdfPageNumber}{" "}
                    {t("invoiceManagement.of")} {pdfNumPages}
                  </span>
                  <button
                    onClick={goToNextPage}
                    disabled={pdfPageNumber >= pdfNumPages}
                  >
                    {t("invoiceManagement.next")}
                  </button>
                </div>
              )}
            </div>

            {/* Info Right Side */}
            <div className="invoice-success-modal-info-panel">
              <h2>{t("invoiceManagement.invoiceCreatedSuccessfully")}</h2>
              <button
                className="button"
                style={{ alignSelf: "center", width: "fit-content" }}
                onClick={handleDownloadInvoice}
                disabled={!pdfBlobUrl}
              >
                <Download /> {t("invoiceManagement.downloadInvoice")}
              </button>
              <div className="invoice-success-modal-details">
                <div className="invoice-success-modal-detail-item">
                  <span className="invoice-success-modal-detail-label">
                    {t("invoiceManagement.invoiceNumberLabel")}
                  </span>
                  <span className="invoice-success-modal-detail-value">
                    #{createdInvoice.invoiceNumber}
                  </span>
                </div>
                <div className="invoice-success-modal-detail-item">
                  <span className="invoice-success-modal-detail-label">
                    {t("invoiceManagement.clientLabel")}
                  </span>
                  <span className="invoice-success-modal-detail-value">
                    {createdInvoice.client?.companyName ||
                      selectedClient?.companyName ||
                      "N/A"}
                  </span>
                </div>
                <div className="invoice-success-modal-detail-item">
                  <span className="invoice-success-modal-detail-label">
                    {t("invoiceManagement.dateLabel")}
                  </span>
                  <span className="invoice-success-modal-detail-value">
                    {createdInvoice.invoiceDate}
                  </span>
                </div>
                <div className="invoice-success-modal-detail-item">
                  <span className="invoice-success-modal-detail-label">
                    {t("invoiceManagement.totalLabel")}
                  </span>
                  <span className="invoice-success-modal-detail-value">
                    $
                    {(
                      parseFloat(
                        createdInvoice.grandTotal?.toString() || "0"
                      ) || 0
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="invoice-success-modal-email-section">
                <label>
                  {t("invoiceManagement.sendToEmail")}
                  <input
                    type="email"
                    value={emailToSend}
                    onChange={(e) => {
                      setEmailToSend(e.target.value);
                      setEmailUpdateMessage("");
                    }}
                  />
                </label>
                <button
                  className="button"
                  style={{ marginTop: 16, minWidth: 180 }}
                  onClick={sendInvoiceToClient}
                  disabled={
                    isSendingInvoice || !emailToSend || !emailToSend.trim()
                  }
                >
                  {isSendingInvoice
                    ? t("invoiceManagement.sending")
                    : t("invoiceManagement.sendInvoiceToClient")}
                </button>
                {/* Wrap both messages in a fragment to avoid adjacent JSX errors */}
                <>
                  {sendInvoiceMessage && (
                    <div className="invoice-success-modal-message">
                      {sendInvoiceMessage}
                    </div>
                  )}
                  {emailUpdateMessage && (
                    <div className="invoice-success-modal-message">
                      {emailUpdateMessage}
                    </div>
                  )}
                </>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
