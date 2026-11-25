interface BulkGrandTotalLinesProps {
  t: (key: string) => string;
  bonus: number;
  deduction: number;
  pay: number;
}

/** The last lines of both bulk screens' final summary: the bonus and deduction when there are some, and the grand pay. */
export function BulkGrandTotalLines({
  t,
  bonus,
  deduction,
  pay,
}: BulkGrandTotalLinesProps) {
  return (
    <>
      {bonus > 0 && (
        <div className="timesheet-total-line">
          <div className="timesheet-total-label">
            {t("timesheetForm.grandTotalBonus")}:
          </div>
          <div className="timesheet-total-value">+${bonus.toFixed(2)}</div>
        </div>
      )}
      {deduction > 0 && (
        <div className="timesheet-total-line">
          <div className="timesheet-total-label">
            {t("timesheetForm.grandTotalDeduction")}:
          </div>
          <div className="timesheet-total-value">-${deduction.toFixed(2)}</div>
        </div>
      )}
      <div className="timesheet-total-line timesheet-grand-total">
        <div className="timesheet-total-label">
          {t("timesheetForm.grandTotalPay")}:
        </div>
        <div className="timesheet-total-value">${pay.toFixed(2)}</div>
      </div>
    </>
  );
}
