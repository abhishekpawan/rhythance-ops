import { calculateLineItemTotals } from "../invoiceCalculations";
import type { useInvoiceFormState } from "./useInvoiceFormState";
import type { useInvoicePageHooks } from "./useInvoicePageHooks";

export function InvoiceTableBody(
  props: Pick<ReturnType<typeof useInvoiceFormState>, "lineItems"> &
    Pick<ReturnType<typeof useInvoicePageHooks>, "t">
) {
  const { lineItems, t } = props;
  return (
    <>
      <div className="timesheet-invoice-table-body">
        {(() => {
          const { lineItemTotals } = calculateLineItemTotals(lineItems);

          return lineItemTotals.map((item) => {
            const hasOvertime = (item.totalOvertimeHours || 0) > 0;

            return (
              <div key={item.id}>
                {/* Regular Hours Line Item */}
                <div
                  key={`${item.id}-regular`}
                  className="timesheet-invoice-line-item"
                >
                  <div className="timesheet-col-description">
                    <div className="timesheet-item-title">
                      {item.position?.title ||
                        item.description ||
                        t("invoiceManagement.noPositionSelected")}
                    </div>
                    <div className="timesheet-item-subtitle">
                      Regular Hours
                      {item.jobseeker
                        ? ` - ${item.jobseeker.firstName} ${item.jobseeker.lastName}`.trim()
                        : ""}
                      {item.position?.title &&
                        item.description &&
                        ` - ${item.description}`}
                    </div>
                  </div>
                  <div className="timesheet-col-hours">
                    {(item.totalRegularHours || 0).toFixed(2)}
                  </div>
                  <div className="timesheet-col-rate">
                    ${item.regularBillRate || "0.00"}
                  </div>
                  <div className="timesheet-col-tax">
                    {item.taxInfo.taxType === "HST" && (
                      <div className="timesheet-item-subtitle">
                        HST {item.taxInfo.hstPercentage}% on $
                        {(item.regularAmount || 0).toFixed(2)}:
                      </div>
                    )}

                    {item.taxInfo.taxType === "GST" && (
                      <div className="timesheet-item-subtitle">
                        GST {item.taxInfo.gstPercentage}% on $
                        {(item.regularAmount || 0).toFixed(2)}:
                      </div>
                    )}

                    {item.taxInfo.taxType === "GST_QST" && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          gap: "0.25rem",
                        }}
                      >
                        <div className="timesheet-item-subtitle">
                          GST {item.taxInfo.gstPercentage}% on $
                          {(item.regularAmount || 0).toFixed(2)}:
                        </div>
                        <div
                          className="timesheet-item-subtitle"
                          style={{
                            textWrap: "nowrap",
                          }}
                        >
                          QST {item.taxInfo.qstPercentage}% on $
                          {(item.regularAmount || 0).toFixed(2)}:
                        </div>
                      </div>
                    )}
                    {item.taxInfo.taxType !== "GST_QST" && (
                      <div className="timesheet-item-title">
                        $
                        {(
                          ((item.regularAmount || 0) *
                            item.taxInfo.totalTaxPercentage) /
                          100
                        ).toFixed(2)}
                      </div>
                    )}

                    {item.taxInfo.taxType === "GST_QST" && (
                      <div>
                        <div className="timesheet-item-title">
                          $
                          {(
                            ((item.regularAmount || 0) *
                              item.taxInfo.gstPercentage) /
                            100
                          ).toFixed(2)}
                        </div>
                        <div className="timesheet-item-title">
                          $
                          {(
                            ((item.regularAmount || 0) *
                              item.taxInfo.qstPercentage) /
                            100
                          ).toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="timesheet-col-amount">
                    ${(item.regularAmount || 0).toFixed(2)}
                  </div>
                </div>

                {/* Overtime Hours Line Item (if applicable) */}
                {hasOvertime && (
                  <div
                    key={`${item.id}-overtime`}
                    className="timesheet-invoice-line-item"
                  >
                    <div className="timesheet-col-description">
                      <div className="timesheet-item-title">
                        {item.position?.title ||
                          t("invoiceManagement.noPositionSelected")}
                      </div>
                      <div className="timesheet-item-subtitle">
                        Overtime Hours
                        {item.jobseeker
                          ? ` - ${item.jobseeker.firstName} ${item.jobseeker.lastName}`.trim()
                          : ""}
                        {item.description && ` - ${item.description}`}
                      </div>
                    </div>
                    <div className="timesheet-col-hours">
                      {(item.totalOvertimeHours || 0).toFixed(2)}
                    </div>
                    <div className="timesheet-col-rate">
                      ${item.overtimeBillRate || item.regularBillRate || "0.00"}
                    </div>
                    <div className="timesheet-col-tax">
                      {item.taxInfo.taxType === "HST" && (
                        <div className="timesheet-item-subtitle">
                          HST {item.taxInfo.hstPercentage}% on $
                          {(item.overtimeAmount || 0).toFixed(2)}:
                        </div>
                      )}

                      {item.taxInfo.taxType === "GST" && (
                        <div className="timesheet-item-subtitle">
                          GST {item.taxInfo.gstPercentage}% on $
                          {(item.overtimeAmount || 0).toFixed(2)}:
                        </div>
                      )}

                      {item.taxInfo.taxType === "GST_QST" && (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: "0.25rem",
                          }}
                        >
                          <div className="timesheet-item-subtitle">
                            GST {item.taxInfo.gstPercentage}% on $
                            {(item.overtimeAmount || 0).toFixed(2)}:
                          </div>
                          <div
                            className="timesheet-item-subtitle"
                            style={{
                              textWrap: "nowrap",
                            }}
                          >
                            QST {item.taxInfo.qstPercentage}% on $
                            {(item.overtimeAmount || 0).toFixed(2)}:
                          </div>
                        </div>
                      )}
                      {item.taxInfo.taxType !== "GST_QST" && (
                        <div className="timesheet-item-title">
                          $
                          {(
                            ((item.overtimeAmount || 0) *
                              item.taxInfo.totalTaxPercentage) /
                            100
                          ).toFixed(2)}
                        </div>
                      )}

                      {item.taxInfo.taxType === "GST_QST" && (
                        <div>
                          <div className="timesheet-item-title">
                            $
                            {(
                              ((item.overtimeAmount || 0) *
                                item.taxInfo.gstPercentage) /
                              100
                            ).toFixed(2)}
                          </div>
                          <div className="timesheet-item-title">
                            $
                            {(
                              ((item.overtimeAmount || 0) *
                                item.taxInfo.qstPercentage) /
                              100
                            ).toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="timesheet-col-amount">
                      ${(item.overtimeAmount || 0).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>
    </>
  );
}
