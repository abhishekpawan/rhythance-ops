import { User } from "lucide-react";
import type { createInvoiceViewData } from "./createInvoiceViewData";

export function SupplierPoCard(
  props: Pick<ReturnType<typeof createInvoiceViewData>, "supplierPOItems">
) {
  const { supplierPOItems } = props;
  return (
    <>
      {/* Supplier PO Items Card (if present) */}
      {supplierPOItems.length > 0 && (
        <div className="invoice-view-card">
          <div className="invoice-view-card-header">
            <h2 className="invoice-view-card-title">
              <User size={18} /> Supplier & PO Numbers
            </h2>
          </div>
          <ul style={{ paddingLeft: "20px", margin: 0 }}>
            {supplierPOItems.map((po, idx) => (
              <li key={po.id || idx} style={{ marginBottom: "8px" }}>
                <strong>{po.selectedOption || "PO/Supplier"}:</strong>{" "}
                {po.supplierPoNumber || "N/A"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
