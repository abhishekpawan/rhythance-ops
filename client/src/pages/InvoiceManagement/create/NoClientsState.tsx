import { Building } from "lucide-react";
import { EmptyState } from "../../../components/EmptyState";
import type { useInvoiceFormState } from "./useInvoiceFormState";
import type { useInvoicePageHooks } from "./useInvoicePageHooks";

export function NoClientsState(
  props: Pick<
    ReturnType<typeof useInvoiceFormState>,
    "clientLoading" | "clients"
  > &
    Pick<ReturnType<typeof useInvoicePageHooks>, "t">
) {
  const { clientLoading, clients, t } = props;
  return (
    <>
      {/* No Clients State */}
      {!clientLoading && clients.length === 0 && (
        <div className="invoice-card empty-state-card">
          <EmptyState
            className="invoice-empty-state"
            icon={<Building size={48} />}
            title={t("invoiceManagement.noClientsAvailable")}
            description={t("invoiceManagement.noClientsForInvoice")}
          />
        </div>
      )}
    </>
  );
}
