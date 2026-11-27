import { FileText } from "lucide-react";
import { EmptyState } from "../../../components/EmptyState";
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
          <EmptyState
            className="invoice-empty-state"
            icon={<FileText size={48} />}
            title={t("invoiceManagement.noPositionsAvailable")}
            description={t("invoiceManagement.noPositionsForClient")}
          />
        </div>
      )}
    </>
  );
}
