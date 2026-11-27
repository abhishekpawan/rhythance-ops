import { Building, FileText, Calendar } from "lucide-react";
import { CustomDropdown } from "../../../components/CustomDropdown";
import type { useInvoicePageHooks } from "./useInvoicePageHooks";
import type { useInvoiceFormState } from "./useInvoiceFormState";
import type { createInvoiceOptions } from "./createInvoiceOptions";
import type { createInvoiceHandlers } from "./createInvoiceHandlers";

export function InvoiceSelectionBar(
  props: Pick<ReturnType<typeof useInvoicePageHooks>, "t"> &
    Pick<
      ReturnType<typeof useInvoiceFormState>,
      "clientLoading" | "selectedClient" | "invoiceDate" | "dueDate"
    > &
    Pick<
      ReturnType<typeof createInvoiceOptions>,
      | "clientOptions"
      | "selectedClientOption"
      | "termsOptions"
      | "selectedTermsOption"
    > &
    Pick<
      ReturnType<typeof createInvoiceHandlers>,
      | "handleClientSelect"
      | "handleTermsSelect"
      | "handleInvoiceDateClick"
      | "handleInvoiceDateChange"
      | "handleDueDateClick"
      | "handleDueDateChange"
    >
) {
  const {
    clientLoading,
    clientOptions,
    dueDate,
    handleClientSelect,
    handleDueDateChange,
    handleDueDateClick,
    handleInvoiceDateChange,
    handleInvoiceDateClick,
    handleTermsSelect,
    invoiceDate,
    selectedClient,
    selectedClientOption,
    selectedTermsOption,
    t,
    termsOptions,
  } = props;
  return (
    <>
      {/* Client and Payment Terms Selection */}
      <div className="invoice-selection-bar">
        <div className="selection-section">
          <label className="selection-label">
            <Building size={16} />
            {t("invoiceManagement.client")}
          </label>
          {clientLoading ? (
            <div className="invoice-dropdown-skeleton">
              <div className="skeleton-dropdown-trigger">
                <div className="skeleton-icon"></div>
                <div className="skeleton-text skeleton-dropdown-text"></div>
                <div className="skeleton-icon skeleton-chevron"></div>
              </div>
            </div>
          ) : (
            <CustomDropdown
              options={clientOptions}
              selectedOption={selectedClientOption}
              onSelect={handleClientSelect}
              placeholder={t("invoiceManagement.searchSelectClient")}
              loading={false}
              icon={<Building size={16} />}
              emptyMessage={t("invoiceManagement.noClientsFound")}
            />
          )}
        </div>

        <div className="selection-section">
          <label className="selection-label">
            <FileText size={16} />
            {t("invoiceManagement.paymentTerms")}
          </label>
          <CustomDropdown
            options={termsOptions}
            selectedOption={selectedTermsOption}
            onSelect={handleTermsSelect}
            placeholder={
              selectedClient
                ? t("invoiceManagement.selectPaymentTerms")
                : t("invoiceManagement.pleaseSelectClientFirst")
            }
            disabled={!selectedClient}
            loading={false}
            icon={<FileText size={16} />}
            emptyMessage={t("invoiceManagement.noPaymentTermsAvailable")}
          />
        </div>

        <div className="selection-section">
          <label
            className="selection-label"
            htmlFor="invoice-date-input"
            onClick={handleInvoiceDateClick}
          >
            <Calendar size={16} />
            {t("invoiceManagement.invoiceDate")}
          </label>
          <input
            id="invoice-date-input"
            type="date"
            value={invoiceDate}
            onChange={(e) => handleInvoiceDateChange(e.target.value)}
            className="invoice-date-input"
          />
        </div>

        <div className="selection-section">
          <label
            className="selection-label"
            htmlFor="due-date-input"
            onClick={handleDueDateClick}
          >
            <Calendar size={16} />
            {t("invoiceManagement.dueDate")}
          </label>
          <input
            id="due-date-input"
            type="date"
            value={dueDate}
            onChange={(e) => handleDueDateChange(e.target.value)}
            className="invoice-date-input"
            title={t("invoiceManagement.dueDateAdjustable")}
          />
        </div>
      </div>
    </>
  );
}
