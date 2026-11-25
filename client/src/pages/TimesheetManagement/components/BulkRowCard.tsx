import { TimesheetInvoiceSummary } from "./TimesheetInvoiceSummary";
import { TimesheetInvoiceTotals } from "./TimesheetInvoiceTotals";
import { TimesheetJobseekerInfoPanel } from "./TimesheetJobseekerInfoPanel";
import { BulkRowHoursSection } from "./BulkRowHoursSection";
import { getPayrollPreviewRows } from "../functions/timesheetCalculations";
import type {
  BulkForms,
  BulkRow,
  BulkSelection,
  BulkT,
  BulkTf,
} from "./bulkClientTypes";

interface BulkRowCardProps {
  t: BulkT;
  tf: BulkTf;
  row: BulkRow;
  rowsCount: number;
  selectedPosition: BulkSelection["selectedPosition"];
  clientPosition: BulkSelection["clientPosition"];
  posColUnitHeader: string;
  payrollCtxForRow: BulkForms["payrollCtxForRow"];
  removeJobseeker: BulkForms["removeJobseeker"];
  updateEntry: BulkForms["updateEntry"];
  updateBonus: BulkForms["updateBonus"];
  updateDeduction: BulkForms["updateDeduction"];
  updateNotes: BulkForms["updateNotes"];
  updateJobseekerEmailSent: BulkForms["updateJobseekerEmailSent"];
}

/** One jobseeker's timesheet: hours, adjustments, notes, email choice and the invoice preview. */
export function BulkRowCard({
  t,
  tf,
  row,
  rowsCount,
  selectedPosition,
  clientPosition,
  posColUnitHeader,
  payrollCtxForRow,
  removeJobseeker,
  updateEntry,
  updateBonus,
  updateDeduction,
  updateNotes,
  updateJobseekerEmailSent,
}: BulkRowCardProps) {
  return (
    <div className="timesheet-assignment-card">
      {payrollCtxForRow(row.assignment).jobseeker && (
        <TimesheetJobseekerInfoPanel
          layout="row"
          jobseeker={payrollCtxForRow(row.assignment).jobseeker!}
          extras={{
            billingEmail: row.assignment.jobseekerProfile?.billing_email,
            employeeId: row.assignment.jobseekerProfile?.employee_id,
          }}
        />
      )}
      <BulkRowHoursSection
        t={t}
        row={row}
        rowsCount={rowsCount}
        selectedPosition={selectedPosition}
        removeJobseeker={removeJobseeker}
        updateEntry={updateEntry}
        updateBonus={updateBonus}
        updateDeduction={updateDeduction}
      />
      {/* Notes Section */}
      <div className="timesheet-notes-section">
        <h4 className="timesheet-notes-title">
          {t("timesheetForm.additionalNotes")}
        </h4>
        <textarea
          value={row.form.notes}
          onChange={(e) => updateNotes(row.assignment.id, e.target.value)}
          placeholder={t("timesheetForm.notesPlaceholder")}
          className="timesheet-notes-textarea"
          rows={4}
        />
      </div>
      {/* Individual Email Control */}
      <div className="timesheet-email-control">
        <label className="timesheet-checkbox-label">
          <input
            type="checkbox"
            checked={row.emailSent}
            onChange={(e) =>
              updateJobseekerEmailSent(row.assignment.id, e.target.checked)
            }
            className="timesheet-checkbox"
          />
          <span className="timesheet-checkbox-text">
            {t("bulkTimesheetManagement.email.sendToJobseeker")}
          </span>
        </label>
        <p
          className="field-note"
          style={{ marginTop: "8px", marginLeft: "24px" }}
        >
          {t("bulkTimesheetManagement.email.billingEmailNote")}
        </p>
      </div>
      {/* Invoice Style Summary - Exact same as TimesheetManagement */}
      <div className="timesheet-invoice-container">
        <div className="timesheet-invoice-table">
          <div className="timesheet-invoice-table-header">
            <div className="timesheet-col-description">{tf("description")}</div>
            <div className="timesheet-col-hours">{posColUnitHeader}</div>
            <div className="timesheet-col-rate">{tf("rate")}</div>
            <div className="timesheet-col-amount">{tf("amount")}</div>
          </div>

          <TimesheetInvoiceSummary
            timesheet={row.form}
            previewRows={getPayrollPreviewRows(
              row.form,
              payrollCtxForRow(row.assignment)
            )}
            selectedPosition={clientPosition!}
            jobseeker={payrollCtxForRow(row.assignment).jobseeker}
            rowKeyPrefix={`${row.assignment.id}-`}
          />

          <div className="timesheet-invoice-totals">
            <TimesheetInvoiceTotals
              timesheet={row.form}
              position={clientPosition!}
              jobseeker={payrollCtxForRow(row.assignment).jobseeker}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
