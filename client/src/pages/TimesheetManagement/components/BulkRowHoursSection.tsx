import { Minus } from "lucide-react";
import { getDayOfWeekCanada } from "../../../utils/dateUtils";
import type { PositionWithOvertime } from "../types";
import type {
  BulkForms,
  BulkRow,
  BulkSelection,
  BulkT,
} from "./bulkClientTypes";

interface BulkRowHoursSectionProps {
  t: BulkT;
  row: BulkRow;
  rowsCount: number;
  selectedPosition: BulkSelection["selectedPosition"];
  removeJobseeker: BulkForms["removeJobseeker"];
  updateEntry: BulkForms["updateEntry"];
  updateBonus: BulkForms["updateBonus"];
  updateDeduction: BulkForms["updateDeduction"];
}

/** Daily hours, pay adjustments and position pay rates of one jobseeker. */
export function BulkRowHoursSection({
  t,
  row,
  rowsCount,
  selectedPosition,
  removeJobseeker,
  updateEntry,
  updateBonus,
  updateDeduction,
}: BulkRowHoursSectionProps) {
  return (
    <div className="timesheet-hours-adjustments-container">
      <div className="timesheet-hours-section">
        <div className="timesheet-hours-header">
          <h4 className="timesheet-hours-title">
            {t("timesheetForm.dailyHours")}
          </h4>
          <button
            className="button danger"
            onClick={() => removeJobseeker(row.assignment.id)}
            title={t("bulkTimesheetManagement.buttons.removeJobseeker")}
            disabled={rowsCount === 1}
          >
            <Minus size={16} />
          </button>
        </div>
        <div className="timesheet-days-grid">
          {row.form.entries.map((entry) => (
            <div key={entry.date} className="timesheet-day-entry">
              <label className="timesheet-day-label">
                <div className="timesheet-day-name">
                  {getDayOfWeekCanada(entry.date)}
                </div>
                <div className="timesheet-day-date">({entry.date})</div>
              </label>
              <input
                type="number"
                min="0"
                max="99"
                step="0.5"
                value={entry.hours === 0 ? "" : entry.hours}
                onChange={(e) => {
                  const rawValue = e.target.value;
                  // Allow clearing the input
                  if (rawValue === "") {
                    updateEntry(row.assignment.id, entry.date, 0);
                    return;
                  }
                  // Limit to 2 decimal places
                  const [intPart, decPart] = rawValue.split(".");
                  let limitedValue = rawValue;
                  if (decPart && decPart.length > 2) {
                    limitedValue = `${intPart}.${decPart.slice(0, 2)}`;
                  }
                  const hours = parseFloat(limitedValue) || 0;
                  updateEntry(row.assignment.id, entry.date, hours);
                }}
                placeholder="0.00"
                className="timesheet-hours-input"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="timesheet-hours-section adjustments-section">
        <h4 className="timesheet-hours-title timesheet-pay-adjustments-title">
          {t("timesheetForm.payAdjustments")}
        </h4>
        <div className="timesheet-days-grid">
          <div className="timesheet-day-entry">
            <label className="timesheet-day-label">
              <div className="timesheet-day-name">
                {t("timesheetForm.bonus")}
              </div>
              <div className="timesheet-day-date">
                {t("timesheetForm.amount")}
              </div>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={row.form.bonusAmount === 0 ? "" : row.form.bonusAmount}
              onChange={(e) => {
                const rawValue = e.target.value;
                // Allow clearing the input
                if (rawValue === "") {
                  updateBonus(row.assignment.id, 0);
                  return;
                }
                // Limit to 2 decimal places
                const [intPart, decPart] = rawValue.split(".");
                let limitedValue = rawValue;
                if (decPart && decPart.length > 2) {
                  limitedValue = `${intPart}.${decPart.slice(0, 2)}`;
                }
                const amount = parseFloat(limitedValue) || 0;
                updateBonus(row.assignment.id, amount);
              }}
              placeholder="0.00"
              className="timesheet-hours-input"
            />
          </div>
          <div className="timesheet-day-entry">
            <label className="timesheet-day-label">
              <div className="timesheet-day-name">
                {t("timesheetForm.deduction")}
              </div>
              <div className="timesheet-day-date">
                {t("timesheetForm.amount")}
              </div>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={
                row.form.deductionAmount === 0 ? "" : row.form.deductionAmount
              }
              onChange={(e) => {
                const rawValue = e.target.value;
                // Allow clearing the input
                if (rawValue === "") {
                  updateDeduction(row.assignment.id, 0);
                  return;
                }
                // Limit to 2 decimal places
                const [intPart, decPart] = rawValue.split(".");
                let limitedValue = rawValue;
                if (decPart && decPart.length > 2) {
                  limitedValue = `${intPart}.${decPart.slice(0, 2)}`;
                }
                const amount = parseFloat(limitedValue) || 0;
                updateDeduction(row.assignment.id, amount);
              }}
              placeholder="0.00"
              className="timesheet-hours-input"
            />
          </div>
        </div>
      </div>
      {/* Position Pay Info */}
      <div className="timesheet-pay-info-section">
        <div className="timesheet-pay-info-grid">
          <div className="timesheet-pay-info-item">
            <span className="timesheet-pay-label">
              {t("timesheetForm.regularPayRate")}
            </span>
            <span className="timesheet-pay-value">
              $
              {selectedPosition?.regularPayRate ||
                t("bulkTimesheetManagement.constants.na")}
              /h
            </span>
          </div>
          {parseFloat(
            (selectedPosition as PositionWithOvertime)?.premiumPayRate || "0"
          ) > 0 && (
            <div className="timesheet-pay-info-item">
              <span className="timesheet-pay-label">
                {t("timesheetForm.premiumPayRate")}
              </span>
              <span className="timesheet-pay-value">
                ${(selectedPosition as PositionWithOvertime)?.premiumPayRate}
                /h
              </span>
            </div>
          )}
          {selectedPosition?.overtimeEnabled && (
            <div className="timesheet-pay-info-item">
              <span className="timesheet-pay-label">
                {t("timesheetForm.overtimePayRate")}
              </span>
              <span className="timesheet-pay-value">
                $
                {selectedPosition?.overtimePayRate ||
                  t("bulkTimesheetManagement.constants.na")}
                /h
              </span>
            </div>
          )}
          <div className="timesheet-pay-info-item">
            <span className="timesheet-pay-label">
              {t("timesheetForm.overtimeThreshold")}
            </span>
            <span className="timesheet-pay-value">
              {(selectedPosition as PositionWithOvertime)?.overtimeHours ||
                "40"}{" "}
              {t("timesheetForm.hours")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
