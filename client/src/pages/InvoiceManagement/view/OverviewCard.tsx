import { FileText } from "lucide-react";
import type { useInvoiceViewState } from "./useInvoiceViewState";
import type { createInvoiceViewData } from "./createInvoiceViewData";

export function OverviewCard(
  props: {
    invoice: NonNullable<ReturnType<typeof useInvoiceViewState>["invoice"]>;
  } & Pick<ReturnType<typeof createInvoiceViewData>, "formatted">
) {
  const { formatted, invoice } = props;
  return (
    <>
      {/* Overview & Meta Card */}
      <div className="invoice-view-card">
        <div className="invoice-view-card-header">
          <h2 className="invoice-view-card-title">
            <FileText size={18} /> Overview & Dates
          </h2>
        </div>
        <div className="invoice-meta-grid">
          <div className="invoice-meta-item">
            <span className="invoice-meta-label">Invoice Number</span>
            <span className="invoice-meta-value">#{invoice.invoiceNumber}</span>
          </div>
          <div className="invoice-meta-item">
            <span className="invoice-meta-label">Invoice Date</span>
            <span className="invoice-meta-value">
              {formatted.formattedInvoiceDate}
            </span>
          </div>
          <div className="invoice-meta-item">
            <span className="invoice-meta-label">Due Date</span>
            <span className="invoice-meta-value">
              {formatted.formattedDueDate}
            </span>
          </div>
          <div className="invoice-meta-item">
            <span className="invoice-meta-label">Payment Terms</span>
            <span className="invoice-meta-value">
              {invoice.paymentTerms || "Net 30"}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
