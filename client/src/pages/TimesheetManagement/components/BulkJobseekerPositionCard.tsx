import { FileText, Minus } from "lucide-react";
import {
  CustomDropdown,
  type DropdownOption,
} from "../../../components/CustomDropdown";
import { Loader } from "../../../components/Loader";
import { DropdownSkeleton } from "./DropdownSkeleton";
import {
  BulkPositionHoursBlock,
  type BulkTimesheetT,
} from "./BulkPositionHoursBlock";
import type { PayrollComputationContext } from "../functions/timesheetCalculations";
import { getPayrollPreviewRows } from "../functions/timesheetCalculations";
import { useTimesheetFormTranslation } from "../hooks/useTimesheetFormTranslation";
import { TimesheetInvoiceSummary } from "./TimesheetInvoiceSummary";
import { TimesheetInvoiceTotals } from "./TimesheetInvoiceTotals";
import type {
  BulkPositionRow,
  ClientPosition,
  PositionWithOvertime,
} from "../types";

type TimesheetFormTf = ReturnType<typeof useTimesheetFormTranslation>;

export interface BulkJobseekerPositionCardProps {
  row: BulkPositionRow;
  positionOptions: DropdownOption[];
  selectedPositionOption: DropdownOption | null | undefined;
  onPositionSelect: (option: DropdownOption | DropdownOption[]) => void;
  positionLoading: boolean;
  payrollCtx: PayrollComputationContext | null;
  formLoading: boolean;
  tf: TimesheetFormTf;
  t: BulkTimesheetT;
  labels: {
    removePositionTooltip: string;
    positionLabel: string;
    selectPositionHint: string;
    buildingForm: string;
  };
  onRemove: (rowId: string) => void;
  removeDisabled: boolean;
  updateEntry: (rowId: string, date: string, hours: number) => void;
  updateBonus: (rowId: string, amount: number) => void;
  updateDeduction: (rowId: string, amount: number) => void;
  updateNotes: (rowId: string, notes: string) => void;
  updateEmailSent: (rowId: string, sent: boolean) => void;
}

export function BulkJobseekerPositionCard({
  row,
  positionOptions,
  selectedPositionOption,
  onPositionSelect,
  positionLoading,
  payrollCtx,
  formLoading,
  tf,
  t,
  labels,
  onRemove,
  removeDisabled,
  updateEntry,
  updateBonus,
  updateDeduction,
  updateNotes,
  updateEmailSent,
}: BulkJobseekerPositionCardProps) {
  const position = row.position as PositionWithOvertime | null;
  const form = row.form;
  const previewRows =
    payrollCtx && form ? getPayrollPreviewRows(form, payrollCtx) : [];

  const showPayDetails = Boolean(form && position);
  const isSubcategory = Boolean(position?.isSubcategory);
  const subcatLabel = String(position?.subcategoryPosition || "").trim();
  const isMiles =
    isSubcategory && subcatLabel.toLowerCase().startsWith("miles");
  const dailyTitle = isMiles
    ? "Daily Miles"
    : isSubcategory
      ? `Daily Units (${subcatLabel || "Subcategory"})`
      : t("timesheetForm.dailyHours");
  const rateUnit = isMiles ? "/mi" : isSubcategory ? "/unit" : "/h";
  const colUnitHeader = isMiles
    ? "MILES"
    : isSubcategory
      ? "QTY / UNITS"
      : tf("colHours");

  const removeButton = (variant: "floating" | "pay-header") => (
    <button
      type="button"
      className={`button danger bulk-position-remove-btn bulk-position-remove-btn--${variant}`}
      onClick={() => onRemove(row.rowId)}
      title={labels.removePositionTooltip}
      disabled={removeDisabled}
      aria-label={labels.removePositionTooltip}
    >
      <Minus size={variant === "pay-header" ? 14 : 16} />
    </button>
  );

  return (
    <div className="timesheet-assignment-card bulk-jobseeker-position-card">
      {!showPayDetails ? removeButton("floating") : null}

      <div className="bulk-position-inline-row">
        <div className="bulk-position-field bulk-position-field--dropdown">
          <label className="selection-label">
            <FileText size={16} />
            {labels.positionLabel}
          </label>
          {positionLoading ? (
            <DropdownSkeleton />
          ) : (
            <CustomDropdown
              options={positionOptions}
              selectedOption={selectedPositionOption}
              onSelect={onPositionSelect}
              placeholder={labels.selectPositionHint}
              disabled={positionOptions.length === 0}
              loading={false}
              icon={<FileText size={16} />}
              emptyMessage={labels.selectPositionHint}
            />
          )}
        </div>

        {formLoading ? (
          <div className="bulk-position-field bulk-position-field--loading">
            <Loader variant="inline" message={labels.buildingForm} />
          </div>
        ) : null}

        {form && position ? (
          <BulkPositionHoursBlock
            rowId={row.rowId}
            form={form}
            position={position}
            isSubcategory={isSubcategory}
            dailyTitle={dailyTitle}
            rateUnit={rateUnit}
            t={t}
            removeButton={removeButton("pay-header")}
            updateEntry={updateEntry}
            updateBonus={updateBonus}
            updateDeduction={updateDeduction}
          />
        ) : null}
      </div>

      {!row.position && !formLoading ? (
        <p className="field-note bulk-jobseeker-select-position-hint">
          {labels.selectPositionHint}
        </p>
      ) : null}

      {form && position ? (
        <>
          <div className="bulk-position-notes-email-shell">
            <div className="bulk-position-email-card">
              <label className="timesheet-checkbox-label">
                <input
                  type="checkbox"
                  checked={row.emailSent}
                  onChange={(e) => updateEmailSent(row.rowId, e.target.checked)}
                  className="timesheet-checkbox"
                />
                <span className="timesheet-checkbox-text">
                  {t("bulkTimesheetManagement.email.sendToJobseeker")}
                </span>
              </label>
              <p className="field-note bulk-position-email-billing-note">
                {t("bulkTimesheetManagement.email.billingEmailNote")}
              </p>
            </div>

            <div className="timesheet-notes-section bulk-position-notes bulk-position-notes-card">
              <h4 className="timesheet-notes-title">
                {t("timesheetForm.additionalNotes")}
              </h4>
              <textarea
                value={form.notes}
                onChange={(e) => updateNotes(row.rowId, e.target.value)}
                placeholder={t("timesheetForm.notesPlaceholder")}
                className="timesheet-notes-textarea"
                rows={2}
              />
            </div>
          </div>

          {payrollCtx ? (
            <div className="timesheet-invoice-container">
              <div className="timesheet-invoice-table">
                <div className="timesheet-invoice-table-header">
                  <div className="timesheet-col-description">
                    {tf("description")}
                  </div>
                  <div className="timesheet-col-hours">{colUnitHeader}</div>
                  <div className="timesheet-col-rate">{tf("rate")}</div>
                  <div className="timesheet-col-amount">{tf("amount")}</div>
                </div>

                <TimesheetInvoiceSummary
                  timesheet={form}
                  previewRows={previewRows}
                  selectedPosition={position as ClientPosition}
                  jobseeker={payrollCtx.jobseeker ?? null}
                  rowKeyPrefix={`${row.rowId}-`}
                />

                <div className="timesheet-invoice-totals">
                  <TimesheetInvoiceTotals
                    timesheet={form}
                    position={position as ClientPosition}
                    jobseeker={payrollCtx.jobseeker}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
