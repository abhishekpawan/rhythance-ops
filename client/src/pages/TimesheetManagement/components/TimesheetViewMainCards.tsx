import { Clock, CheckCircle, FileText } from "lucide-react";
import { StatusBadge } from "../../../components/StatusBadge";
import { useLanguage } from "../../../contexts/language/language-provider";
import type { TimesheetWithJoins } from "../../../services/types/timesheet";
import { formatDateTimeCanada } from "../../../utils/dateUtils";

interface TimesheetViewMainCardsProps {
  timesheet: TimesheetWithJoins;
  dailyHoursList: TimesheetWithJoins["daily_hours"];
}

/** The left column of the timesheet view: overview, daily hours and notes. */
export function TimesheetViewMainCards({
  timesheet,
  dailyHoursList,
}: TimesheetViewMainCardsProps) {
  const { t } = useLanguage();
  return (
    <>
      {/* Overview / Header Card */}
      <div className="timesheet-view-card">
        <div className="timesheet-view-card-header">
          <h2 className="timesheet-view-card-title">
            <FileText size={20} /> {t("timesheetView.overview")}
          </h2>
          {timesheet.email_sent ? (
            <StatusBadge
              variant="plain"
              baseClass="badge"
              tone="badge-success"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
              icon={
                <>
                  <CheckCircle size={14} />{" "}
                </>
              }
              label={t("bulkTimesheetManagement.filters.emailSent")}
            />
          ) : (
            <StatusBadge
              variant="plain"
              baseClass="badge"
              tone="badge-warning"
              label={t("bulkTimesheetManagement.filters.emailNotSent")}
            />
          )}
        </div>

        <div className="timesheet-meta-grid">
          <div className="timesheet-meta-item">
            <span className="timesheet-meta-label">
              {t("timesheetForm.invoiceNumber")}
            </span>
            <span className="timesheet-meta-value">
              #{timesheet.invoice_number || "-"}
            </span>
          </div>
          <div className="timesheet-meta-item">
            <span className="timesheet-meta-label">
              {t("timesheetForm.selection.weekPeriod")}
            </span>
            <span className="timesheet-meta-value">
              {t("timesheetView.weekRange", {
                start: timesheet.week_start_date,
                end: timesheet.week_end_date,
              })}
            </span>
          </div>
          <div className="timesheet-meta-item">
            <span className="timesheet-meta-label">
              {t("timesheetForm.totalRegularHours")}
            </span>
            <span className="timesheet-meta-value">
              {t("timesheetView.hours", {
                hours: timesheet.total_regular_hours,
              })}
            </span>
          </div>
          <div className="timesheet-meta-item">
            <span className="timesheet-meta-label">
              {t("timesheetForm.totalOvertimeHours")}
            </span>
            <span className="timesheet-meta-value">
              {t("timesheetView.hours", {
                hours: timesheet.total_overtime_hours,
              })}
            </span>
          </div>
          {timesheet.created_at && (
            <div className="timesheet-meta-item">
              <span className="timesheet-meta-label">
                {t("timesheetView.createdAt")}
              </span>
              <span className="timesheet-meta-value">
                {formatDateTimeCanada(timesheet.created_at)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Daily Hours Breakdown Card */}
      <div className="timesheet-view-card">
        <div className="timesheet-view-card-header">
          <h3 className="timesheet-view-card-title">
            <Clock size={18} /> {t("timesheetView.dailyHoursEntry")}
          </h3>
        </div>
        <table className="timesheet-daily-table">
          <thead>
            <tr>
              <th>{t("timesheetView.date")}</th>
              <th>{t("timesheetView.hoursLogged")}</th>
            </tr>
          </thead>
          <tbody>
            {dailyHoursList.length > 0 ? (
              dailyHoursList.map((entry, index) => (
                <tr key={index}>
                  <td>{entry.date}</td>
                  <td>
                    <strong>
                      {t("timesheetView.hours", { hours: entry.hours })}
                    </strong>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={2}
                  style={{
                    textAlign: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  {t("timesheetView.noDailyHours")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Additional Notes Card */}
      {timesheet.notes && (
        <div className="timesheet-view-card">
          <div className="timesheet-view-card-header">
            <h3 className="timesheet-view-card-title">
              <FileText size={18} /> {t("timesheetForm.additionalNotes")}
            </h3>
          </div>
          <p style={{ margin: 0, color: "var(--text)" }}>{timesheet.notes}</p>
        </div>
      )}
    </>
  );
}
