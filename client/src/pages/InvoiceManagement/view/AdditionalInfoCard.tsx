import { FileText } from "lucide-react";
import type { createInvoiceViewData } from "./createInvoiceViewData";
import type { useInvoiceViewState } from "./useInvoiceViewState";

export function AdditionalInfoCard(
  props: Pick<
    ReturnType<typeof createInvoiceViewData>,
    "messageOnInvoice" | "termsOnInvoice"
  > & {
    invoice: NonNullable<ReturnType<typeof useInvoiceViewState>["invoice"]>;
  }
) {
  const { invoice, messageOnInvoice, termsOnInvoice } = props;
  return (
    <>
      {/* Additional Info / Terms & Notes Card */}
      <div className="invoice-view-card">
        <div className="invoice-view-card-header">
          <h2 className="invoice-view-card-title">
            <FileText size={18} /> Messages & Terms
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {messageOnInvoice && (
            <div>
              <span className="invoice-meta-label">Message on Invoice</span>
              <p style={{ margin: "4px 0 0", color: "var(--text)" }}>
                {messageOnInvoice}
              </p>
            </div>
          )}
          {termsOnInvoice && (
            <div>
              <span className="invoice-meta-label">Terms on Invoice</span>
              <p style={{ margin: "4px 0 0", color: "var(--text)" }}>
                {termsOnInvoice}
              </p>
            </div>
          )}
          {invoice.notes && (
            <div>
              <span className="invoice-meta-label">Internal Notes</span>
              <p style={{ margin: "4px 0 0", color: "var(--text)" }}>
                {invoice.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
