import { Clock, CheckCircle, FileText } from "lucide-react";
import { StatusBadge } from "../../../components/StatusBadge";
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
  return (
    <>
      {/* Overview / Header Card */}
      <div className="timesheet-view-card">
        <div className="timesheet-view-card-header">
          <h2 className="timesheet-view-card-title">
            <FileText size={20} /> Timesheet Overview
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
              label="Email Sent"
            />
          ) : (
            <StatusBadge
              variant="plain"
              baseClass="badge"
              tone="badge-warning"
              label="Email Not Sent"
            />
          )}
        </div>

        <div className="timesheet-meta-grid">
          <div className="timesheet-meta-item">
            <span className="timesheet-meta-label">Invoice Number</span>
            <span className="timesheet-meta-value">
              #{timesheet.invoice_number || "-"}
            </span>
          </div>
          <div className="timesheet-meta-item">
            <span className="timesheet-meta-label">Week Period</span>
            <span className="timesheet-meta-value">
              {timesheet.week_start_date} to {timesheet.week_end_date}
            </span>
          </div>
          <div className="timesheet-meta-item">
            <span className="timesheet-meta-label">Total Regular Hours</span>
            <span className="timesheet-meta-value">
              {timesheet.total_regular_hours} hrs
            </span>
          </div>
          <div className="timesheet-meta-item">
            <span className="timesheet-meta-label">Total Overtime Hours</span>
            <span className="timesheet-meta-value">
              {timesheet.total_overtime_hours} hrs
            </span>
          </div>
          {timesheet.created_at && (
            <div className="timesheet-meta-item">
              <span className="timesheet-meta-label">Created At</span>
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
            <Clock size={18} /> Daily Hours Entry
          </h3>
        </div>
        <table className="timesheet-daily-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Hours Logged</th>
            </tr>
          </thead>
          <tbody>
            {dailyHoursList.length > 0 ? (
              dailyHoursList.map((entry, index) => (
                <tr key={index}>
                  <td>{entry.date}</td>
                  <td>
                    <strong>{entry.hours} hrs</strong>
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
                  No daily hours recorded.
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
              <FileText size={18} /> Additional Notes
            </h3>
          </div>
          <p style={{ margin: 0, color: "var(--text)" }}>{timesheet.notes}</p>
        </div>
      )}
    </>
  );
}
