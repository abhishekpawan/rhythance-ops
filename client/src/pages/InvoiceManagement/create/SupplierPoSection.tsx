import { Building, FileText, Plus, Minus } from "lucide-react";
import { CustomDropdown } from "../../../components/CustomDropdown";
import type { useInvoicePageHooks } from "./useInvoicePageHooks";
import type { useInvoiceFormState } from "./useInvoiceFormState";
import type { createInvoiceOptions } from "./createInvoiceOptions";
import type { createInvoiceHandlers } from "./createInvoiceHandlers";
import type { createLineHandlers } from "./createLineHandlers";

export function SupplierPoSection(
  props: Pick<ReturnType<typeof useInvoicePageHooks>, "t"> &
    Pick<
      ReturnType<typeof useInvoiceFormState>,
      | "supplierPOItems"
      | "messageOnInvoice"
      | "setMessageOnInvoice"
      | "termsOnInvoice"
      | "setTermsOnInvoice"
    > &
    Pick<ReturnType<typeof createInvoiceOptions>, "combinedOptions"> &
    Pick<
      ReturnType<typeof createInvoiceHandlers>,
      "handleCombinedOptionSelect" | "handleSupplierPONumberChange"
    > &
    Pick<
      ReturnType<typeof createLineHandlers>,
      "addSupplierPOItem" | "removeSupplierPOItem"
    >
) {
  const {
    addSupplierPOItem,
    combinedOptions,
    handleCombinedOptionSelect,
    handleSupplierPONumberChange,
    messageOnInvoice,
    removeSupplierPOItem,
    setMessageOnInvoice,
    setTermsOnInvoice,
    supplierPOItems,
    t,
    termsOnInvoice,
  } = props;
  return (
    <>
      {/* Supplier/PO Number Details Section */}
      <div className="invoice-bottom-sections-container">
        <div className="invoice-line-items-container supplier-po-section">
          <div className="invoice-line-items-header">
            <h3>{t("invoiceManagement.supplierPODetails")}</h3>
          </div>

          <div className="invoice-line-items-list">
            {supplierPOItems.map((supplierPOItem) => (
              <div key={supplierPOItem.id} className="invoice-line-item-group">
                <div className="invoice-line-item-fields">
                  {/* All fields in one row with add/remove buttons at the end */}
                  <div className="invoice-field-row single-row">
                    <div className="selection-section combined-selection">
                      <label className="selection-label">
                        <Building size={16} />
                        {t("invoiceManagement.supplierNoPONo")}
                      </label>
                      <CustomDropdown
                        options={combinedOptions}
                        selectedOption={
                          supplierPOItem.selectedOption
                            ? combinedOptions.find(
                                (opt) =>
                                  opt.id === supplierPOItem.selectedOption
                              )
                            : null
                        }
                        onSelect={(option) =>
                          handleCombinedOptionSelect(supplierPOItem.id, option)
                        }
                        placeholder={t("invoiceManagement.selectSupplierOrPO")}
                        loading={false}
                        icon={<Building size={16} />}
                        emptyMessage={t("invoiceManagement.noOptionsFound")}
                      />
                    </div>

                    <div className="selection-section supplier-po-number-selection">
                      <label className="selection-label">
                        <FileText size={16} />
                        {t("invoiceManagement.supplierPONumber")}
                      </label>
                      <input
                        type="text"
                        value={supplierPOItem.supplierPoNumber}
                        onChange={(e) =>
                          handleSupplierPONumberChange(
                            supplierPOItem.id,
                            e.target.value
                          )
                        }
                        placeholder={t(
                          "invoiceManagement.enterSupplierPONumber"
                        )}
                        className="invoice-text-input"
                      />
                    </div>

                    {/* Action buttons section */}
                    <div className="selection-section line-item-actions">
                      <label className="selection-label">
                        {t("invoiceManagement.actions")}
                      </label>
                      <div className="line-item-buttons">
                        <button
                          className="button secondary"
                          onClick={addSupplierPOItem}
                          title={t("invoiceManagement.addSupplierPOItem")}
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          className="button danger"
                          onClick={() =>
                            removeSupplierPOItem(supplierPOItem.id)
                          }
                          title={t("invoiceManagement.removeSupplierPOItem")}
                          disabled={supplierPOItems.length === 1}
                        >
                          <Minus size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Message and Terms Section */}
        <div className="invoice-message-terms-container">
          <div className="invoice-line-items-header">
            <h3>{t("invoiceManagement.additionalInformation")}</h3>
          </div>

          <div className="message-terms-grid">
            <div className="selection-section message-section">
              <label className="selection-label">
                <FileText size={16} />
                {t("invoiceManagement.messageOnInvoice")}
              </label>
              <textarea
                className="invoice-textarea"
                placeholder={t("invoiceManagement.enterMessageOnInvoice")}
                rows={6}
                value={messageOnInvoice}
                onChange={(e) => setMessageOnInvoice(e.target.value)}
              />
            </div>

            <div className="selection-section terms-section">
              <label className="selection-label">
                <FileText size={16} />
                {t("invoiceManagement.terms")}
              </label>
              <textarea
                className="invoice-textarea"
                placeholder={t("invoiceManagement.enterAdditionalTerms")}
                rows={6}
                value={termsOnInvoice}
                onChange={(e) => setTermsOnInvoice(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
