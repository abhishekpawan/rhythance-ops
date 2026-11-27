import { FileText } from "lucide-react";
import type { useInvoiceFormState } from "./useInvoiceFormState";
import type { useInvoicePageHooks } from "./useInvoicePageHooks";

export function NoPositionsState(
  props: Pick<
    ReturnType<typeof useInvoiceFormState>,
    "selectedClient" | "positionLoading" | "positions"
  > &
    Pick<ReturnType<typeof useInvoicePageHooks>, "t">
) {
  const { positionLoading, positions, selectedClient, t } = props;
  return (
    <>
      {/* No Positions State */}
      {selectedClient && !positionLoading && positions.length === 0 && (
        <div className="invoice-card empty-state-card">
          <div className="invoice-empty-state">
            <FileText size={48} />
            <h3>{t("invoiceManagement.noPositionsAvailable")}</h3>
            <p>{t("invoiceManagement.noPositionsForClient")}</p>
          </div>
        </div>
      )}
    </>
  );
}
