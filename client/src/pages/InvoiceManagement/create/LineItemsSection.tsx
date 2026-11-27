import { FileText, User, DollarSign, Plus, Minus } from "lucide-react";
import { CustomDropdown } from "../../../components/CustomDropdown";
import type { useInvoicePageHooks } from "./useInvoicePageHooks";
import type { useInvoiceFormState } from "./useInvoiceFormState";
import type { createInvoiceOptions } from "./createInvoiceOptions";
import type { createInvoiceHandlers } from "./createInvoiceHandlers";
import type { createLineHandlers } from "./createLineHandlers";

export function LineItemsSection(
  props: Pick<ReturnType<typeof useInvoicePageHooks>, "t"> &
    Pick<
      ReturnType<typeof useInvoiceFormState>,
      "lineItems" | "jobseekerLoading"
    > &
    Pick<
      ReturnType<typeof createInvoiceOptions>,
      "positionOptions" | "getJobseekerOptions" | "salesTaxOptions"
    > &
    Pick<
      ReturnType<typeof createInvoiceHandlers>,
      "handlePositionSelect" | "handleJobseekerSelect" | "handleSalesTaxSelect"
    > &
    Pick<
      ReturnType<typeof createLineHandlers>,
      "updateLineItem" | "addLineItem" | "removeLineItem"
    >
) {
  const {
    addLineItem,
    getJobseekerOptions,
    handleJobseekerSelect,
    handlePositionSelect,
    handleSalesTaxSelect,
    jobseekerLoading,
    lineItems,
    positionOptions,
    removeLineItem,
    salesTaxOptions,
    t,
    updateLineItem,
  } = props;
  return (
    <>
      {/* Line Items Section */}
      <div className="invoice-line-items-container">
        <div className="invoice-line-items-header">
          <h3>{t("invoiceManagement.invoiceLineItems")}</h3>
        </div>

        <div className="invoice-line-items-list">
          {lineItems.map((lineItem) => (
            <div key={lineItem.id} className="invoice-line-item-group">
              <div className="invoice-line-item-fields">
                {/* All fields in one row with add/remove buttons at the end */}
                <div className="invoice-field-row single-row">
                  <div className="selection-section position-selection">
                    <label className="selection-label">
                      <FileText size={16} />
                      {t("invoiceManagement.position")}
                    </label>
                    <CustomDropdown
                      options={positionOptions}
                      selectedOption={
                        lineItem.position
                          ? positionOptions.find(
                              (opt) => opt.id === lineItem.position?.id
                            )
                          : null
                      }
                      onSelect={(option) =>
                        handlePositionSelect(lineItem.id, option)
                      }
                      placeholder={t(
                        "invoiceManagement.selectPositionPlaceholder"
                      )}
                      loading={false}
                      icon={<FileText size={16} />}
                      emptyMessage={t(
                        "invoiceManagement.noPositionsFoundMessage"
                      )}
                    />
                  </div>

                  <div className="selection-section jobseeker-selection">
                    <label className="selection-label">
                      <User size={16} />
                      {t("invoiceManagement.jobSeeker")}
                    </label>
                    {jobseekerLoading ? (
                      <div className="invoice-dropdown-skeleton">
                        <div className="skeleton-dropdown-trigger">
                          <div className="skeleton-icon"></div>
                          <div className="skeleton-text skeleton-dropdown-text"></div>
                          <div className="skeleton-icon skeleton-chevron"></div>
                        </div>
                      </div>
                    ) : (
                      <CustomDropdown
                        options={getJobseekerOptions()}
                        selectedOption={
                          lineItem.jobseeker
                            ? getJobseekerOptions().find(
                                (opt) =>
                                  opt.id === lineItem.jobseeker?.candidateId
                              )
                            : null
                        }
                        onSelect={(option) =>
                          handleJobseekerSelect(lineItem.id, option)
                        }
                        placeholder={t(
                          "invoiceManagement.selectJobseekerPlaceholder"
                        )}
                        disabled={false}
                        loading={jobseekerLoading}
                        icon={<User size={16} />}
                        emptyMessage={t("invoiceManagement.noJobseekersFound")}
                      />
                    )}
                  </div>

                  <div className="selection-section description-selection">
                    <label className="selection-label">
                      <FileText size={16} />
                      {t("invoiceManagement.descriptionOptional")}
                    </label>
                    <input
                      type="text"
                      value={lineItem.description}
                      onChange={(e) =>
                        updateLineItem(lineItem.id, {
                          description: e.target.value,
                        })
                      }
                      placeholder={t("invoiceManagement.enterDescription")}
                      className="invoice-text-input"
                    />
                  </div>

                  <div className="selection-section hours-selection">
                    <label className="selection-label">
                      <FileText size={16} />
                      {t("invoiceManagement.hours")}
                    </label>
                    <input
                      type="number"
                      value={lineItem.hours}
                      onChange={(e) => {
                        const rawValue = e.target.value;
                        // Allow clearing the input
                        if (rawValue === "") {
                          updateLineItem(lineItem.id, { hours: "" });
                          return;
                        }
                        // Limit to 2 decimal places
                        const [intPart, decPart] = rawValue.split(".");
                        if (decPart && decPart.length > 2) {
                          updateLineItem(lineItem.id, {
                            hours: `${intPart}.${decPart.slice(0, 2)}`,
                          });
                        } else {
                          updateLineItem(lineItem.id, {
                            hours: rawValue,
                          });
                        }
                      }}
                      placeholder="0.00"
                      min="0"
                      step="0.25"
                      className="invoice-number-input"
                    />
                  </div>

                  <div className="selection-section rate-selection">
                    <label className="selection-label">
                      <DollarSign size={16} />
                      {t("invoiceManagement.rate")}
                    </label>
                    <input
                      type="number"
                      value={lineItem.regularBillRate}
                      onChange={(e) => {
                        const rawValue = e.target.value;
                        // Allow clearing the input
                        if (rawValue === "") {
                          updateLineItem(lineItem.id, {
                            regularBillRate: "",
                          });
                          return;
                        }
                        // Limit to 2 decimal places
                        const [intPart, decPart] = rawValue.split(".");
                        if (decPart && decPart.length > 2) {
                          updateLineItem(lineItem.id, {
                            regularBillRate: `${intPart}.${decPart.slice(
                              0,
                              2
                            )}`,
                          });
                        } else {
                          updateLineItem(lineItem.id, {
                            regularBillRate: rawValue,
                          });
                        }
                      }}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      className="invoice-number-input"
                    />
                  </div>

                  <div className="selection-section tax-selection">
                    <label className="selection-label">
                      <DollarSign size={16} />
                      {t("invoiceManagement.salesTax")}
                    </label>
                    <CustomDropdown
                      options={salesTaxOptions}
                      selectedOption={salesTaxOptions.find(
                        (opt) => opt.value === lineItem.salesTax
                      )}
                      onSelect={(option) =>
                        handleSalesTaxSelect(lineItem.id, option)
                      }
                      placeholder={t("invoiceManagement.selectTax")}
                      loading={false}
                      icon={<DollarSign size={16} />}
                      emptyMessage={t("invoiceManagement.noSalesTaxOptions")}
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
                        onClick={addLineItem}
                        title={t("invoiceManagement.addNewLineItem")}
                      >
                        <Plus size={16} />
                      </button>
                      <button
                        className="button danger"
                        onClick={() => removeLineItem(lineItem.id)}
                        title={t("invoiceManagement.removeLineItem")}
                        disabled={lineItems.length === 1}
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
    </>
  );
}
