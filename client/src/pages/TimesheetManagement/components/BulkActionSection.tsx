import { BulkSendAllSection } from "./BulkSendAllSection";
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
    <BulkSendAllSection
      sendEmail={sendEmail}
      onSendEmailChange={(checked) => {
        setSendEmail(checked);
        updateAllJobseekersEmailSent(checked);
      }}
      sendToAllLabel={t("bulkTimesheetManagement.email.sendToAll")}
      billingEmailNote={t("bulkTimesheetManagement.email.billingEmailNote")}
      generateLabel={
        isGenerating
          ? t("bulkTimesheetManagement.buttons.generating")
          : t("bulkTimesheetManagement.buttons.generateBulkTimesheet")
      }
      generateDisabled={
        rows.length === 0 ||
        isGenerating ||
        rows.every(
          (row) =>
            row.form.totalRegularHours + row.form.totalOvertimeHours === 0
        )
      }
      onGenerate={handleGenerateBulk}
    />
  );
}
