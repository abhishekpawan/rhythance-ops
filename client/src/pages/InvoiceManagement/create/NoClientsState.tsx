import { Building } from "lucide-react";
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
          <div className="invoice-empty-state">
            <Building size={48} />
            <h3>{t("invoiceManagement.noClientsAvailable")}</h3>
            <p>{t("invoiceManagement.noClientsForInvoice")}</p>
          </div>
        </div>
      )}
    </>
  );
}
