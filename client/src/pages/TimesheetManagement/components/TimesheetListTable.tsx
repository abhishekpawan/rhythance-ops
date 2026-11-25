import { DateRangePicker } from "../../../components/DateRangePicker";
import { EmptyState } from "../../../components/EmptyState";
import type { TimesheetListItem } from "../../../services/api/timesheet";
import type { TimesheetListT } from "../functions/timesheetListDisplay";
import {
  LIST_COLUMNS,
  SkeletonRows,
  TimesheetListRow,
} from "./TimesheetListRow";

interface TimesheetListTableProps {
  t: TimesheetListT;
  loading: boolean;
  timesheets: TimesheetListItem[];
  pagination: { limit: number; total: number };
  invoiceNumberFilter: string;
  setInvoiceNumberFilter: (v: string) => void;
  clientFilter: string;
  setClientFilter: (v: string) => void;
  positionFilter: string;
  setPositionFilter: (v: string) => void;
  jobseekerFilter: string;
  setJobseekerFilter: (v: string) => void;
  billingEmailFilter: string;
  setBillingEmailFilter: (v: string) => void;
  dateRangeStart: string;
  setDateRangeStart: (v: string) => void;
  dateRangeEnd: string;
  setDateRangeEnd: (v: string) => void;
  emailSentFilter: string;
  setEmailSentFilter: (v: string) => void;
  sendingJobseekerEmail: Record<string, boolean>;
  onSendEmail: (timesheetId: string, jobseekerName: string) => Promise<void>;
  onEditTimesheet: (timesheet: TimesheetListItem) => void;
  onViewTimesheet?: (timesheet: TimesheetListItem) => void;
  onDeleteTimesheet?: (timesheet: TimesheetListItem) => void;
}

export function TimesheetListTable(props: TimesheetListTableProps) {
  const {
    t,
    loading,
    timesheets,
    pagination,
    invoiceNumberFilter,
    setInvoiceNumberFilter,
    clientFilter,
    setClientFilter,
    positionFilter,
    setPositionFilter,
    jobseekerFilter,
    setJobseekerFilter,
    billingEmailFilter,
    setBillingEmailFilter,
    dateRangeStart,
    setDateRangeStart,
    dateRangeEnd,
    setDateRangeEnd,
    emailSentFilter,
    setEmailSentFilter,
    sendingJobseekerEmail,
    onSendEmail,
    onEditTimesheet,
    onViewTimesheet,
    onDeleteTimesheet,
  } = props;

  const rowSkeletonCount = pagination.limit || 10;

  return (
    <div className="table-container">
      <table className="common-table">
        <thead>
          <tr>
            <th style={{ width: "90px" }}>
              <div className="column-filter">
                <div className="column-title">
                  {t("bulkTimesheetManagement.columns.invoiceNumber")}
                </div>
                <div className="column-search">
                  <input
                    type="text"
                    placeholder={t(
                      "bulkTimesheetManagement.placeholders.searchInvoice"
                    )}
                    value={invoiceNumberFilter}
                    onChange={(e) => setInvoiceNumberFilter(e.target.value)}
                    className="column-search-input"
                  />
                </div>
              </div>
            </th>
            <th>
              <div className="column-filter">
                <div className="column-title">
                  {t("bulkTimesheetManagement.columns.client")}
                </div>
                <div className="column-search">
                  <input
                    type="text"
                    placeholder={t(
                      "bulkTimesheetManagement.placeholders.searchClient"
                    )}
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    className="column-search-input"
                  />
                </div>
              </div>
            </th>
            <th>
              <div className="column-filter">
                <div className="column-title">
                  {t("bulkTimesheetManagement.columns.position")}
                </div>
                <div className="column-search">
                  <input
                    type="text"
                    placeholder={t(
                      "bulkTimesheetManagement.placeholders.searchPosition"
                    )}
                    value={positionFilter}
                    onChange={(e) => setPositionFilter(e.target.value)}
                    className="column-search-input"
                  />
                </div>
              </div>
            </th>
            <th>
              <div className="column-filter" style={{ alignItems: "center" }}>
                <div className="column-title">
                  {t("bulkTimesheetManagement.columns.weekPeriod")}
                </div>
                <div className="column-search">
                  <DateRangePicker
                    startDate={dateRangeStart}
                    endDate={dateRangeEnd}
                    onStartChange={setDateRangeStart}
                    onEndChange={setDateRangeEnd}
                    placeholder={
                      t("invoiceManagement.filterDateRange") || "Select Range"
                    }
                  />
                </div>
              </div>
            </th>
            <th>
              <div className="column-filter" style={{ alignItems: "center" }}>
                <div className="column-title">
                  {t("bulkTimesheetManagement.columns.jobseekers")}
                </div>
                <div className="column-search">
                  <input
                    type="text"
                    placeholder={t(
                      "bulkTimesheetManagement.placeholders.searchJobseeker"
                    )}
                    value={jobseekerFilter}
                    onChange={(e) => setJobseekerFilter(e.target.value)}
                    className="column-search-input"
                  />
                </div>
              </div>
            </th>
            <th>
              <div className="column-filter">
                <div className="column-title">
                  {t("bulkTimesheetManagement.columns.billingEmail")}
                </div>
                <div className="column-search">
                  <input
                    type="text"
                    placeholder={t(
                      "bulkTimesheetManagement.placeholders.searchBillingEmail"
                    )}
                    value={billingEmailFilter}
                    onChange={(e) => setBillingEmailFilter(e.target.value)}
                    className="column-search-input"
                  />
                </div>
              </div>
            </th>
            <th style={{ minWidth: "130px" }}>
              <div className="column-filter" style={{ alignItems: "center" }}>
                <div className="column-title">Total Pay</div>
                <div className="column-search">
                  <div className="actions-info">
                    <span className="actions-help-text">Pay ($)</span>
                  </div>
                </div>
              </div>
            </th>
            <th>
              <div className="column-filter" style={{ alignItems: "center" }}>
                <div className="column-title">
                  {t("bulkTimesheetManagement.columns.emailStatus")}
                </div>
                <div className="column-search">
                  <select
                    value={emailSentFilter}
                    onChange={(e) => setEmailSentFilter(e.target.value)}
                    className="column-search-input"
                  >
                    <option value="">
                      {t("bulkTimesheetManagement.filters.allEmailStatus")}
                    </option>
                    <option value="true">
                      {t("bulkTimesheetManagement.filters.emailSent")}
                    </option>
                    <option value="false">
                      {t("bulkTimesheetManagement.filters.emailNotSent")}
                    </option>
                  </select>
                </div>
              </div>
            </th>
            <th>
              <div className="column-filter" style={{ alignItems: "center" }}>
                <div className="column-title">Actions</div>
                <div className="column-search">
                  <div className="actions-info">
                    <span className="actions-help-text">
                      View • Edit • Delete
                    </span>
                  </div>
                </div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows rowCount={rowSkeletonCount} />
          ) : timesheets.length === 0 ? (
            <tr>
              <td colSpan={LIST_COLUMNS} className="empty-state-cell">
                <EmptyState
                  className="empty-state"
                  description={t(
                    "bulkTimesheetManagement.messages.noBulkTimesheets"
                  )}
                />
              </td>
            </tr>
          ) : (
            timesheets.map((timesheet) => (
              <TimesheetListRow
                key={String(timesheet.id)}
                timesheet={timesheet}
                t={t}
                sendingJobseekerEmail={sendingJobseekerEmail}
                onSendEmail={onSendEmail}
                onEditTimesheet={onEditTimesheet}
                onViewTimesheet={onViewTimesheet}
                onDeleteTimesheet={onDeleteTimesheet}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
