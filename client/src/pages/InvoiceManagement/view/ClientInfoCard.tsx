import { Building } from "lucide-react";
import type { createInvoiceViewData } from "./createInvoiceViewData";
import type { useInvoiceViewState } from "./useInvoiceViewState";

export function ClientInfoCard(
  props: Pick<
    ReturnType<typeof createInvoiceViewData>,
    "clientData" | "fullAddress"
  > & {
    invoice: NonNullable<ReturnType<typeof useInvoiceViewState>["invoice"]>;
  }
) {
  const { clientData, fullAddress, invoice } = props;
  return (
    <>
      {/* Client Info Card */}
      <div className="invoice-view-card">
        <div className="invoice-view-card-header">
          <h2 className="invoice-view-card-title">
            <Building size={18} /> Client Information
          </h2>
        </div>
        <div className="invoice-client-details">
          <div className="invoice-client-name">
            {clientData?.companyName || "Unknown Client"}
          </div>
          {clientData?.shortCode && (
            <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
              Code: {clientData.shortCode}
            </div>
          )}
          <div>
            <span className="invoice-meta-label">Complete Address</span>
            <div className="invoice-client-address">{fullAddress}</div>
          </div>
          <div>
            <span className="invoice-meta-label">Client Email</span>
            <div style={{ fontSize: "0.9375rem", color: "var(--text)" }}>
              {invoice.invoice_sent_to ||
                clientData?.emailAddress1 ||
                "No email provided"}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
