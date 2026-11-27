import { DollarSign } from "lucide-react";
import type { useInvoiceViewState } from "./useInvoiceViewState";
import type { createInvoiceViewData } from "./createInvoiceViewData";

export function FinancialSummaryCard(
  props: {
    invoice: NonNullable<ReturnType<typeof useInvoiceViewState>["invoice"]>;
  } & Pick<ReturnType<typeof createInvoiceViewData>, "formatted">
) {
  const { formatted, invoice } = props;
  return (
    <>
      {/* Financial Summary Card */}
      <div className="invoice-view-card">
        <div className="invoice-view-card-header">
          <h2 className="invoice-view-card-title">
            <DollarSign size={18} /> Financial Summary
          </h2>
        </div>
        <div className="invoice-summary-box">
          <div className="invoice-summary-row">
            <span>Total Billable Hours</span>
            <strong>{(invoice.totalHours || 0).toFixed(2)} hrs</strong>
          </div>
          <div className="invoice-summary-row">
            <span>Subtotal</span>
            <span>${(invoice.subtotal || 0).toFixed(2)}</span>
          </div>
          {invoice.totalHst ? (
            <div className="invoice-summary-row">
              <span>HST</span>
              <span>${invoice.totalHst.toFixed(2)}</span>
            </div>
          ) : null}
          {invoice.totalGst ? (
            <div className="invoice-summary-row">
              <span>GST</span>
              <span>${invoice.totalGst.toFixed(2)}</span>
            </div>
          ) : null}
          {invoice.totalQst ? (
            <div className="invoice-summary-row">
              <span>QST</span>
              <span>${invoice.totalQst.toFixed(2)}</span>
            </div>
          ) : null}
          <div className="invoice-summary-row">
            <span>Total Tax</span>
            <span>${(invoice.totalTax || 0).toFixed(2)}</span>
          </div>
          <div className="invoice-summary-row total">
            <span>Grand Total</span>
            <span>{formatted.formattedGrandTotal}</span>
          </div>
        </div>
      </div>
    </>
  );
}
