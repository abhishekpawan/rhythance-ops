import { BulkSendAllSection } from "./BulkSendAllSection";
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
    <BulkSendAllSection
      sendEmail={sendEmail}
      onSendEmailChange={(checked) => {
        setSendEmail(checked);
        updateAllRowsEmailSent(checked);
      }}
      sendToAllLabel={t("bulkJobseekerTimesheetManagement.email.sendToAll")}
      billingEmailNote={t("bulkTimesheetManagement.email.billingEmailNote")}
      generateLabel={
        isGenerating
          ? t("bulkJobseekerTimesheetManagement.buttons.generating")
          : t("bulkJobseekerTimesheetManagement.buttons.generateBulk")
      }
      generateDisabled={
        rows.length === 0 ||
        isGenerating ||
        !!hasRowHydratingForm ||
        !hasSubmissionReady
      }
      onGenerate={handleGenerate}
      buttonType="button"
    />
  );
}
