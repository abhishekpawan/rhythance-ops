import type { BulkForms, BulkRows, BulkT } from "./bulkClientTypes";

interface BulkActionSectionProps {
  t: BulkT;
  rows: BulkRows;
  isGenerating: boolean;
  sendEmail: boolean;
  setSendEmail: (value: boolean) => void;
  updateAllJobseekersEmailSent: BulkForms["updateAllJobseekersEmailSent"];
  handleGenerateBulk: () => void;
}

/** "Send to all" and the generate button. */
export function BulkActionSection({
  t,
  rows,
  isGenerating,
  sendEmail,
  setSendEmail,
  updateAllJobseekersEmailSent,
  handleGenerateBulk,
}: BulkActionSectionProps) {
  return (
    <div className="timesheet-action-section">
      <div className="timesheet-email-option">
        <label className="timesheet-checkbox-label">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(e) => {
              setSendEmail(e.target.checked);
              updateAllJobseekersEmailSent(e.target.checked);
            }}
            className="timesheet-checkbox"
          />
          <span className="timesheet-checkbox-text">
            {t("bulkTimesheetManagement.email.sendToAll")}
          </span>
        </label>
        <p
          className="field-note"
          style={{ marginTop: "8px", marginLeft: "24px" }}
        >
          {t("bulkTimesheetManagement.email.billingEmailNote")}
        </p>
      </div>
      <button
        className="button"
        onClick={handleGenerateBulk}
        disabled={
          rows.length === 0 ||
          isGenerating ||
          rows.every(
            (row) =>
              row.form.totalRegularHours + row.form.totalOvertimeHours === 0
          )
        }
      >
        {isGenerating
          ? t("bulkTimesheetManagement.buttons.generating")
          : t("bulkTimesheetManagement.buttons.generateBulkTimesheet")}
      </button>
    </div>
  );
}
