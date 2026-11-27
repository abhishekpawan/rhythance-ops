import { FileText, Eye, Download } from "lucide-react";
import type { useInvoiceViewState } from "./useInvoiceViewState";
import type { createInvoiceViewActions } from "./createInvoiceViewActions";

export function PdfPreviewCard(
  props: Pick<ReturnType<typeof useInvoiceViewState>, "pdfSignedUrl"> & {
    invoice: NonNullable<ReturnType<typeof useInvoiceViewState>["invoice"]>;
  } & Pick<ReturnType<typeof createInvoiceViewActions>, "handleDownloadPdf">
) {
  const { handleDownloadPdf, invoice, pdfSignedUrl } = props;
  return (
    <>
      {/* PDF Document Preview Card */}
      {invoice.documentPath && (
        <div className="invoice-view-card">
          <div className="invoice-view-card-header">
            <h2 className="invoice-view-card-title">
              <FileText size={18} /> PDF Document
            </h2>
          </div>
          <div className="invoice-pdf-preview-card">
            <div className="invoice-pdf-preview-icon">
              <FileText size={28} />
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>
                {invoice.documentFileName || "Invoice.pdf"}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {invoice.documentFileSize
                  ? `${(invoice.documentFileSize / 1024 / 1024).toFixed(2)} MB`
                  : "Generated PDF Document"}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: "8px",
                width: "100%",
                justifyContent: "center",
              }}
            >
              {pdfSignedUrl && (
                <button
                  className="button secondary button-icon"
                  style={{ fontSize: "0.8125rem" }}
                  onClick={() => window.open(pdfSignedUrl, "_blank")}
                >
                  <Eye size={14} /> Preview PDF
                </button>
              )}
              <button
                className="button primary button-icon"
                style={{ fontSize: "0.8125rem" }}
                onClick={handleDownloadPdf}
              >
                <Download size={14} /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
