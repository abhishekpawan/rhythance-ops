import { CheckCircle, Clock } from "lucide-react";
import type { useInvoiceViewState } from "./useInvoiceViewState";

export function InvoiceHeaderBar(props: {
  invoice: NonNullable<ReturnType<typeof useInvoiceViewState>["invoice"]>;
}) {
  const { invoice } = props;
  return (
    <>
      {/* Header Bar Banner */}
      <div className="invoice-view-header-bar">
        <div className="invoice-view-title-box">
          <h1 className="invoice-view-h1">
            Invoice #{invoice.invoiceNumber}
            {invoice.emailSent ? (
              <span className="invoice-status-badge sent">
                <CheckCircle size={14} /> Emailed
              </span>
            ) : (
              <span className="invoice-status-badge pending">
                <Clock size={14} /> Draft / Not Sent
              </span>
            )}
          </h1>
        </div>
      </div>
    </>
  );
}
