import type { BulkJsForms, BulkJsRows, BulkJsT } from "./bulkJobseekerTypes";

interface BulkJobseekerActionSectionProps {
  t: BulkJsT;
  rows: BulkJsRows;
  isGenerating: boolean;
  sendEmail: boolean;
  setSendEmail: (value: boolean) => void;
  updateAllRowsEmailSent: BulkJsForms["updateAllRowsEmailSent"];
  handleGenerate: () => void;
}

/** "Send to all" and the generate button. */
export function BulkJobseekerActionSection({
  t,
  rows,
  isGenerating,
  sendEmail,
  setSendEmail,
  updateAllRowsEmailSent,
  handleGenerate,
}: BulkJobseekerActionSectionProps) {
  /** Block generate while weekly forms are building for any chosen position */
  const hasRowHydratingForm = rows.some((r) => !!r.formLoading);

  const hasSubmissionReady = rows.some(
    (row) =>
      row.position &&
      row.form &&
      row.form.totalRegularHours + row.form.totalOvertimeHours > 0
  );

  return (
    <div className="timesheet-action-section">
      <div className="timesheet-email-option">
        <label className="timesheet-checkbox-label">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(e) => {
              setSendEmail(e.target.checked);

              updateAllRowsEmailSent(e.target.checked);
            }}
            className="timesheet-checkbox"
          />

          <span className="timesheet-checkbox-text">
            {t("bulkJobseekerTimesheetManagement.email.sendToAll")}
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
        type="button"
        className="button"
        onClick={handleGenerate}
        disabled={
          rows.length === 0 ||
          isGenerating ||
          !!hasRowHydratingForm ||
          !hasSubmissionReady
        }
      >
        {isGenerating
          ? t("bulkJobseekerTimesheetManagement.buttons.generating")
          : t("bulkJobseekerTimesheetManagement.buttons.generateBulk")}
      </button>
    </div>
  );
}
