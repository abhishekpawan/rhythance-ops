import type { PositionWithOvertime } from "../types";
import { BulkGrandTotalLines } from "./BulkGrandTotalLines";
import type { BulkRows, BulkSelection, BulkT } from "./bulkClientTypes";

interface BulkFinalSummaryProps {
  t: BulkT;
  rows: BulkRows;
  selectedPosition: BulkSelection["selectedPosition"];
  isPosMiles: boolean;
  isPosSubcat: boolean;
  posSubcatLabel: string;
  posColUnitHeader: string;
  posRateSuffix: string;
}

/** The totals of every jobseeker on the page. */
export function BulkFinalSummary({
  t,
  rows,
  selectedPosition,
  isPosMiles,
  isPosSubcat,
  posSubcatLabel,
  posColUnitHeader,
  posRateSuffix,
}: BulkFinalSummaryProps) {
  const grandTotalRegularHours = rows.reduce(
    (sum, row) => sum + row.form.totalRegularHours,
    0
  );
  const grandTotalOvertimeHours = rows.reduce(
    (sum, row) => sum + row.form.totalOvertimeHours,
    0
  );
  const grandTotalPay = rows.reduce(
    (sum, row) => sum + row.form.jobseekerPay,
    0
  );
  const grandTotalBonus = rows.reduce(
    (sum, row) => sum + row.form.bonusAmount,
    0
  );
  const grandTotalDeduction = rows.reduce(
    (sum, row) => sum + row.form.deductionAmount,
    0
  );

  return (
    <div className="timesheet-invoice-container">
      <div className="timesheet-invoice-table">
        <div className="timesheet-invoice-table-header">
          <div className="timesheet-col-description">
            {t("timesheetForm.finalSummary")}
          </div>
          <div className="timesheet-col-hours">{posColUnitHeader}</div>
          <div className="timesheet-col-rate">Rate</div>
          <div className="timesheet-col-amount">Amount</div>
        </div>
        <div className="timesheet-invoice-table-body">
          <div className="timesheet-invoice-line-item">
            <div className="timesheet-col-description">
              <div className="timesheet-item-title">
                {isPosMiles
                  ? "Total Miles Logged"
                  : isPosSubcat
                    ? `Total Units (${posSubcatLabel})`
                    : t("timesheetForm.totalRegularHours")}
              </div>
            </div>
            <div className="timesheet-col-hours">
              {grandTotalRegularHours.toFixed(2)}
              {isPosMiles ? " mi" : ""}
            </div>
            <div className="timesheet-col-rate">
              $
              {(
                parseFloat(selectedPosition?.regularPayRate || "0") +
                parseFloat(
                  (selectedPosition as PositionWithOvertime)?.premiumPayRate ||
                    "0"
                )
              ).toFixed(2)}
              {posRateSuffix}
            </div>
            <div className="timesheet-col-amount">
              $
              {(
                grandTotalRegularHours *
                (parseFloat(selectedPosition?.regularPayRate || "0") +
                  parseFloat(
                    (selectedPosition as PositionWithOvertime)
                      ?.premiumPayRate || "0"
                  ))
              ).toFixed(2)}
            </div>
          </div>
          {!isPosSubcat && grandTotalOvertimeHours > 0 && (
            <div className="timesheet-invoice-line-item">
              <div className="timesheet-col-description">
                <div className="timesheet-item-title">
                  {t("timesheetForm.totalOvertimeHours")}
                </div>
              </div>
              <div className="timesheet-col-hours">
                {grandTotalOvertimeHours.toFixed(2)}
              </div>
              <div className="timesheet-col-rate">
                $
                {(selectedPosition as PositionWithOvertime)?.overtimePayRate ||
                  selectedPosition?.regularPayRate ||
                  "0.00"}
              </div>
              <div className="timesheet-col-amount">
                $
                {(
                  grandTotalOvertimeHours *
                  parseFloat(
                    (selectedPosition as PositionWithOvertime)
                      ?.overtimePayRate ||
                      selectedPosition?.regularPayRate ||
                      "0"
                  )
                ).toFixed(2)}
              </div>
            </div>
          )}
        </div>
        <div className="timesheet-invoice-totals">
          <div className="timesheet-total-line">
            <div className="timesheet-total-label">
              {isPosMiles
                ? "Total Miles:"
                : isPosSubcat
                  ? `Total Units (${posSubcatLabel}):`
                  : `${t("timesheetForm.grandTotalHours")}:`}
            </div>
            <div className="timesheet-total-value">
              {isPosMiles
                ? `${grandTotalRegularHours.toFixed(2)} mi`
                : isPosSubcat
                  ? grandTotalRegularHours.toFixed(2)
                  : (grandTotalRegularHours + grandTotalOvertimeHours).toFixed(
                      2
                    )}
            </div>
          </div>
          <BulkGrandTotalLines
            t={t}
            bonus={grandTotalBonus}
            deduction={grandTotalDeduction}
            pay={grandTotalPay}
          />
        </div>
      </div>
    </div>
  );
}
