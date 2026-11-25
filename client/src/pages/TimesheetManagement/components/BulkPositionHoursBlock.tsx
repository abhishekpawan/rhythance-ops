import type { ReactNode } from "react";
import { getDayOfWeekCanada } from "../../../utils/dateUtils";
import type { BulkPositionRow, PositionWithOvertime } from "../types";

export interface BulkTimesheetT {
  (key: string, params?: Record<string, string | number>): string;
}

interface BulkPositionHoursBlockProps {
  rowId: string;
  form: NonNullable<BulkPositionRow["form"]>;
  position: PositionWithOvertime;
  isSubcategory: boolean;
  dailyTitle: string;
  rateUnit: string;
  t: BulkTimesheetT;
  removeButton: ReactNode;
  updateEntry: (rowId: string, date: string, hours: number) => void;
  updateBonus: (rowId: string, amount: number) => void;
  updateDeduction: (rowId: string, amount: number) => void;
}

/** Daily hours, pay adjustments and pay details of one position row. */
export function BulkPositionHoursBlock({
  rowId,
  form,
  position,
  isSubcategory,
  dailyTitle,
  rateUnit,
  t,
  removeButton,
  updateEntry,
  updateBonus,
  updateDeduction,
}: BulkPositionHoursBlockProps) {
  return (
    <div className="timesheet-hours-adjustments-container bulk-position-hours-block">
      <div className="timesheet-hours-section">
        <h4 className="timesheet-hours-title">{dailyTitle}</h4>
        <div className="timesheet-days-grid">
          {form.entries.map((entry) => (
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
                {...(!isSubcategory
                  ? { max: "99", step: "0.5" }
                  : { step: "0.01" })}
                value={entry.hours === 0 ? "" : entry.hours}
                onChange={(e) => {
                  const rawValue = e.target.value;
                  if (rawValue === "") {
                    updateEntry(rowId, entry.date, 0);
                    return;
                  }
                  const [intPart, decPart] = rawValue.split(".");
                  let limitedValue = rawValue;
                  if (decPart && decPart.length > 2) {
                    limitedValue = `${intPart}.${decPart.slice(0, 2)}`;
                  }
                  const hours = parseFloat(limitedValue) || 0;
                  updateEntry(rowId, entry.date, hours);
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
              value={form.bonusAmount === 0 ? "" : form.bonusAmount}
              onChange={(e) => {
                const rawValue = e.target.value;
                if (rawValue === "") {
                  updateBonus(rowId, 0);
                  return;
                }
                const [intPart, decPart] = rawValue.split(".");
                let limitedValue = rawValue;
                if (decPart && decPart.length > 2) {
                  limitedValue = `${intPart}.${decPart.slice(0, 2)}`;
                }
                const amount = parseFloat(limitedValue) || 0;
                updateBonus(rowId, amount);
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
              value={form.deductionAmount === 0 ? "" : form.deductionAmount}
              onChange={(e) => {
                const rawValue = e.target.value;
                if (rawValue === "") {
                  updateDeduction(rowId, 0);
                  return;
                }
                const [intPart, decPart] = rawValue.split(".");
                let limitedValue = rawValue;
                if (decPart && decPart.length > 2) {
                  limitedValue = `${intPart}.${decPart.slice(0, 2)}`;
                }
                const amount = parseFloat(limitedValue) || 0;
                updateDeduction(rowId, amount);
              }}
              placeholder="0.00"
              className="timesheet-hours-input"
            />
          </div>
        </div>
      </div>

      <div className="timesheet-pay-info-section bulk-position-pay-info">
        <div className="bulk-position-pay-details-header">
          <h4 className="timesheet-hours-title bulk-position-pay-details-title">
            {t("bulkJobseekerTimesheetManagement.labels.payDetails")}
          </h4>
          {removeButton}
        </div>
        <div className="timesheet-pay-info-grid">
          <div className="timesheet-pay-info-item">
            <span className="timesheet-pay-label">
              {t("timesheetForm.regularPayRate")}
            </span>
            <span className="timesheet-pay-value">
              $
              {position.regularPayRate ||
                t("bulkTimesheetManagement.constants.na")}
              {rateUnit}
            </span>
          </div>
          {parseFloat(position.premiumPayRate || "0") > 0 && (
            <div className="timesheet-pay-info-item">
              <span className="timesheet-pay-label">
                {t("timesheetForm.premiumPayRate")}
              </span>
              <span className="timesheet-pay-value">
                ${position.premiumPayRate}
                {rateUnit}
              </span>
            </div>
          )}
          {position.overtimeEnabled && (
            <div className="timesheet-pay-info-item">
              <span className="timesheet-pay-label">
                {t("timesheetForm.overtimePayRate")}
              </span>
              <span className="timesheet-pay-value">
                $
                {position.overtimePayRate ||
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
              {position.overtimeHours || "40"} {t("timesheetForm.hours")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
