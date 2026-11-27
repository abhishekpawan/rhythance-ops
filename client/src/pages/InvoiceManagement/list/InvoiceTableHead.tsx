import { DateRangePicker } from "../../../components/DateRangePicker";
import { PAYMENT_TERMS } from "../../../constants/formOptions";
import type { useInvoiceListHooks } from "./useInvoiceListHooks";
import type { useInvoiceListState } from "./useInvoiceListState";

// the words of each payment term, from the keys the position and client forms use
const TERM_KEYS: Record<(typeof PAYMENT_TERMS)[number], string> = {
  "Due on Receipt": "dueOnReceipt",
  "Net 15": "net15",
  "Net 22": "net22",
  "Net 30": "net30",
  "Net 45": "net45",
  "Net 60": "net60",
  "Net 65": "net65",
  "Net 90": "net90",
};

export function InvoiceTableHead(
  props: Pick<ReturnType<typeof useInvoiceListHooks>, "t"> &
    Pick<
      ReturnType<typeof useInvoiceListState>,
      | "invoiceNumberFilter"
      | "setInvoiceNumberFilter"
      | "clientFilter"
      | "setClientFilter"
      | "clientEmailFilter"
      | "setClientEmailFilter"
      | "dateRangeStart"
      | "dateRangeEnd"
      | "setDateRangeStart"
      | "setDateRangeEnd"
      | "dueDateStart"
      | "dueDateEnd"
      | "setDueDateStart"
      | "setDueDateEnd"
      | "paymentTermsFilter"
      | "setPaymentTermsFilter"
      | "invoiceSentFilter"
      | "setInvoiceSentFilter"
    >
) {
  const {
    clientEmailFilter,
    clientFilter,
    dateRangeEnd,
    dateRangeStart,
    dueDateEnd,
    dueDateStart,
    invoiceNumberFilter,
    invoiceSentFilter,
    paymentTermsFilter,
    setClientEmailFilter,
    setClientFilter,
    setDateRangeEnd,
    setDateRangeStart,
    setDueDateEnd,
    setDueDateStart,
    setInvoiceNumberFilter,
    setInvoiceSentFilter,
    setPaymentTermsFilter,
    t,
  } = props;
  return (
    <>
      <thead>
        <tr>
          <th>
            <div className="column-filter">
              <div className="column-title">
                {t("invoiceManagement.list.invoiceHash")}
              </div>
              <div className="column-search">
                <input
                  type="text"
                  placeholder={t(
                    "invoiceManagement.list.searchInvoiceNumberPlaceholder"
                  )}
                  value={invoiceNumberFilter}
                  onChange={(e) => setInvoiceNumberFilter(e.target.value)}
                  className="column-search-input"
                />
              </div>
            </div>
          </th>
          <th>
            <div className="column-filter">
              <div className="column-title">
                {t("invoiceManagement.client")}
              </div>
              <div className="column-search">
                <input
                  type="text"
                  placeholder={t(
                    "invoiceManagement.list.searchClientPlaceholder"
                  )}
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="column-search-input"
                />
              </div>
            </div>
          </th>
          <th>
            <div className="column-filter">
              <div className="column-title">
                {t("invoiceManagement.clientEmail")}
              </div>
              <div className="column-search">
                <input
                  type="text"
                  placeholder={t(
                    "invoiceManagement.list.searchEmailPlaceholder"
                  )}
                  value={clientEmailFilter}
                  onChange={(e) => setClientEmailFilter(e.target.value)}
                  className="column-search-input"
                />
              </div>
            </div>
          </th>
          <th>
            <div className="column-filter" style={{ alignItems: "center" }}>
              <div className="column-title">
                {t("invoiceManagement.invoiceDate")}
              </div>
              <div className="column-search">
                <DateRangePicker
                  startDate={dateRangeStart}
                  endDate={dateRangeEnd}
                  onStartChange={setDateRangeStart}
                  onEndChange={setDateRangeEnd}
                  placeholder={
                    t("invoiceManagement.filterDateRange") || "Select Range"
                  }
                />
              </div>
            </div>
          </th>
          <th>
            <div className="column-filter" style={{ alignItems: "center" }}>
              <div className="column-title">
                {t("invoiceManagement.dueDate") || "Due Date"}
              </div>
              <div className="column-search">
                <DateRangePicker
                  startDate={dueDateStart}
                  endDate={dueDateEnd}
                  onStartChange={setDueDateStart}
                  onEndChange={setDueDateEnd}
                  placeholder={
                    t("invoiceManagement.filterDueDateRange") || "Select Range"
                  }
                />
              </div>
            </div>
          </th>
          <th>
            <div className="column-filter">
              <div className="column-title">
                {t("invoiceManagement.paymentTerms") || "Payment Terms"}
              </div>
              <div className="column-search">
                <select
                  value={paymentTermsFilter}
                  onChange={(e) => setPaymentTermsFilter(e.target.value)}
                  className="column-search-input"
                >
                  <option value="">
                    {t("invoiceManagement.filters.all") || "All"}
                  </option>
                  {PAYMENT_TERMS.map((term) => (
                    <option key={term} value={term}>
                      {t(`positionCreate.selectOptions.${TERM_KEYS[term]}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </th>
          <th>
            <div className="column-filter" style={{ alignItems: "flex-end" }}>
              <div className="column-title">
                {t("invoiceManagement.totalAmount") || "Total Amount"}
              </div>
              <div className="column-search">
                <div className="actions-info">
                  <span className="actions-help-text">
                    {t("invoiceManagement.list.totalAmountHelpText") ||
                      "Subtotal + Tax"}
                  </span>
                </div>
              </div>
            </div>
          </th>
          <th>
            <div className="column-filter">
              <div className="column-title">
                {t("invoiceManagement.list.invoiceEmailed")}
              </div>
              <div className="column-search">
                <select
                  value={invoiceSentFilter}
                  onChange={(e) => setInvoiceSentFilter(e.target.value)}
                  className="column-search-input"
                >
                  <option value="">{t("invoiceManagement.filters.all")}</option>
                  <option value="true">
                    {t("invoiceManagement.filters.yes")}
                  </option>
                  <option value="false">
                    {t("invoiceManagement.filters.no")}
                  </option>
                </select>
              </div>
            </div>
          </th>
          <th>
            <div className="column-filter" style={{ alignItems: "center" }}>
              <div className="column-title">
                {t("invoiceManagement.list.sendEmailColumn")}
              </div>
              <div className="column-search">
                <div className="actions-info">
                  <span className="actions-help-text">
                    {t("invoiceManagement.list.sendEmailAction")}
                  </span>
                </div>
              </div>
            </div>
          </th>
          <th>
            <div
              className="column-filter"
              style={{ alignItems: "flex-end", marginRight: "10px" }}
            >
              <div className="column-title">
                {t("invoiceManagement.actions")}
              </div>
              <div className="column-search">
                <div className="actions-info">
                  <span className="actions-help-text">
                    {t("invoiceManagement.list.viewDeleteAction")}
                  </span>
                </div>
              </div>
            </div>
          </th>
        </tr>
      </thead>
    </>
  );
}
