interface BulkSendAllSectionProps {
  /** the "send to all" checkbox */
  sendEmail: boolean;
  onSendEmailChange: (checked: boolean) => void;
  sendToAllLabel: string;
  billingEmailNote: string;
  /** the generate button: its text, whether it is off, what it does */
  generateLabel: string;
  generateDisabled: boolean;
  onGenerate: () => void;
  /** writes `type="button"` on the generate button, for the page that always had it */
  buttonType?: "button";
}

/** The bottom of both bulk screens: "send to all" with its note, and the generate button. */
export function BulkSendAllSection({
  sendEmail,
  onSendEmailChange,
  sendToAllLabel,
  billingEmailNote,
  generateLabel,
  generateDisabled,
  onGenerate,
  buttonType,
}: BulkSendAllSectionProps) {
  return (
    <div className="timesheet-action-section">
      <div className="timesheet-email-option">
        <label className="timesheet-checkbox-label">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(e) => onSendEmailChange(e.target.checked)}
            className="timesheet-checkbox"
          />
          <span className="timesheet-checkbox-text">{sendToAllLabel}</span>
        </label>
        <p
          className="field-note"
          style={{ marginTop: "8px", marginLeft: "24px" }}
        >
          {billingEmailNote}
        </p>
      </div>
      <button
        type={buttonType}
        className="button"
        onClick={onGenerate}
        disabled={generateDisabled}
      >
        {generateLabel}
      </button>
    </div>
  );
}
