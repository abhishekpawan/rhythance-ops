import { Loader2 } from "lucide-react";
import { formatCalendarDate } from "../../../utils/dateUtils";
import type { useInvoiceFormState } from "./useInvoiceFormState";
import type { useInvoicePageHooks } from "./useInvoicePageHooks";

export function InvoiceDetailsHeader(
  props: Pick<
    ReturnType<typeof useInvoiceFormState>,
    | "selectedClient"
    | "selectedTerms"
    | "invoiceNumberLoading"
    | "invoiceNumber"
    | "invoiceDate"
    | "dueDate"
  > &
    Pick<ReturnType<typeof useInvoicePageHooks>, "t">
) {
  const {
    dueDate,
    invoiceDate,
    invoiceNumber,
    invoiceNumberLoading,
    selectedClient,
    selectedTerms,
    t,
  } = props;
  return (
    <>
      {/* Invoice Details Section - Similar to Timesheet Unified Header */}
      {selectedClient && (
        <div className="timesheet-unified-header">
          <div className="timesheet-header-sections">
            <div className="timesheet-section timesheet-client-section">
              <h4 className="timesheet-section-title">
                {t("invoiceManagement.clientInformation")}
              </h4>
              <div className="timesheet-section-content">
                <div className="timesheet-detail-item">
                  <span className="timesheet-detail-label">
                    {t("invoiceManagement.companyName")}
                  </span>
                  <span className="timesheet-detail-value">
                    {selectedClient.companyName}
                  </span>
                </div>
                <div className="timesheet-detail-item">
                  <span className="timesheet-detail-label">
                    {t("invoiceManagement.shortCode")}
                  </span>
                  <span className="timesheet-detail-value">
                    {selectedClient.shortCode || "N/A"}
                  </span>
                </div>
                <div className="timesheet-detail-item">
                  <span className="timesheet-detail-label">
                    {t("invoiceManagement.primaryEmail")}
                  </span>
                  <span className="timesheet-detail-value">
                    {selectedClient.emailAddress1}
                  </span>
                </div>
                <div className="timesheet-detail-item">
                  <span className="timesheet-detail-label">Address</span>
                  <span className="timesheet-detail-value">
                    {[
                      selectedClient.streetAddress1,
                      selectedClient.city1,
                      selectedClient.province1,
                      selectedClient.postalCode1,
                    ]
                      .filter(Boolean)
                      .join(", ") || "N/A"}
                  </span>
                </div>
              </div>
            </div>

            <div className="timesheet-section timesheet-payment-section">
              <h4 className="timesheet-section-title">
                {t("invoiceManagement.paymentDetails")}
              </h4>
              <div className="timesheet-section-content">
                <div className="timesheet-detail-item">
                  <span className="timesheet-detail-label">
                    {t("invoiceManagement.currencyLabel")}
                  </span>
                  <span className="timesheet-detail-value">
                    {selectedClient.currency || "CAD"}
                  </span>
                </div>
                <div className="timesheet-detail-item">
                  <span className="timesheet-detail-label">
                    {t("invoiceManagement.paymentTerms")}
                  </span>
                  <span className="timesheet-detail-value">
                    {selectedTerms || t("invoiceManagement.notSet")}
                  </span>
                </div>
                <div className="timesheet-detail-item">
                  <span className="timesheet-detail-label">
                    {t("invoiceManagement.paymentMethod")}
                  </span>
                  <span className="timesheet-detail-value">
                    {selectedClient.preferredPaymentMethod ||
                      t("invoiceManagement.notSpecified")}
                  </span>
                </div>
              </div>
            </div>

            <div className="timesheet-section timesheet-dates-section">
              <h4 className="timesheet-section-title">
                {t("invoiceManagement.invoiceAndDates")}
              </h4>
              <div className="timesheet-section-content">
                <div className="timesheet-detail-item">
                  <span className="timesheet-detail-label">
                    {t("invoiceManagement.invoiceNumber")}
                  </span>
                  <span className="timesheet-detail-value">
                    {invoiceNumberLoading ? (
                      <span className="invoice-number-loading">
                        <Loader2
                          size={14}
                          className="timesheet-loading-spinner"
                        />
                        {t("invoiceManagement.generatingInvoiceNumber")}
                      </span>
                    ) : invoiceNumber ? (
                      <strong>{invoiceNumber}</strong>
                    ) : (
                      t("invoiceManagement.notGenerated")
                    )}
                  </span>
                </div>
                <div className="timesheet-detail-item">
                  <span className="timesheet-detail-label">
                    {t("invoiceManagement.invoiceDate")}
                  </span>
                  <span className="timesheet-detail-value">
                    {invoiceDate
                      ? formatCalendarDate(invoiceDate)
                      : t("invoiceManagement.notSet")}
                  </span>
                </div>
                <div className="timesheet-detail-item">
                  <span className="timesheet-detail-label">
                    {t("invoiceManagement.dueDate")}
                  </span>
                  <span className="timesheet-detail-value">
                    {dueDate
                      ? formatCalendarDate(dueDate)
                      : t("invoiceManagement.notCalculated")}
                  </span>
                </div>

                <div className="timesheet-detail-item">
                  <span className="timesheet-detail-label">
                    {t("invoiceManagement.payCycle")}
                  </span>
                  <span className="timesheet-detail-value">
                    {selectedClient.payCycle ||
                      t("invoiceManagement.notSpecified")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
