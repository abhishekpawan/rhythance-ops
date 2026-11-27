import { calculateLineItemTotals } from "../invoiceCalculations";
import type { useInvoiceFormState } from "./useInvoiceFormState";
import type { useInvoicePageHooks } from "./useInvoicePageHooks";

export function InvoiceTotals(
  props: Pick<
    ReturnType<typeof useInvoiceFormState>,
    "lineItems" | "selectedClient"
  > &
    Pick<ReturnType<typeof useInvoicePageHooks>, "t">
) {
  const { lineItems, selectedClient, t } = props;
  return (
    <>
      <div className="timesheet-invoice-totals">
        {(() => {
          const {
            subtotal,
            totalTax,
            totalHST,
            totalGST,
            totalQST,
            grandTotal,
          } = calculateLineItemTotals(lineItems);

          return (
            <>
              <div className="timesheet-total-line">
                <div className="timesheet-total-label">
                  {t("invoiceManagement.totalHours")}:
                </div>
                <div className="timesheet-total-value">
                  {lineItems
                    .reduce(
                      (total, item) => total + (parseFloat(item.hours) || 0),
                      0
                    )
                    .toFixed(2)}
                </div>
              </div>
              <div className="timesheet-total-line timesheet-subtotal">
                <div className="timesheet-total-label">
                  {t("invoiceManagement.subtotal")}:
                </div>
                <div className="timesheet-total-value">
                  ${subtotal.toFixed(2)}
                </div>
              </div>
              {totalHST > 0 && (
                <div className="timesheet-total-line">
                  <div className="timesheet-total-label">
                    {t("invoiceManagement.totalHST")}:
                  </div>
                  <div className="timesheet-total-value">
                    ${totalHST.toFixed(2)}
                  </div>
                </div>
              )}
              {totalGST > 0 && (
                <div className="timesheet-total-line">
                  <div className="timesheet-total-label">
                    {t("invoiceManagement.totalGST")}:
                  </div>
                  <div className="timesheet-total-value">
                    ${totalGST.toFixed(2)}
                  </div>
                </div>
              )}
              {totalQST > 0 && (
                <div className="timesheet-total-line">
                  <div className="timesheet-total-label">
                    {t("invoiceManagement.totalQST")}:
                  </div>
                  <div className="timesheet-total-value">
                    ${totalQST.toFixed(2)}
                  </div>
                </div>
              )}
              <div className="timesheet-total-line">
                <div className="timesheet-total-label">
                  {t("invoiceManagement.totalTax")}:
                </div>
                <div className="timesheet-total-value">
                  ${totalTax.toFixed(2)}
                </div>
              </div>
              <div className="timesheet-total-line timesheet-grand-total">
                <div className="timesheet-total-label">
                  {t("invoiceManagement.grandTotal")}:
                </div>
                <div className="timesheet-total-value">
                  ${grandTotal.toFixed(2)} {selectedClient?.currency || "CAD"}
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </>
  );
}
