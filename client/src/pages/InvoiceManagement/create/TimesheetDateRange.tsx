import { Calendar, Loader2, ClipboardList } from "lucide-react";
import type { useInvoiceFormState } from "./useInvoiceFormState";
import type { useInvoicePageHooks } from "./useInvoicePageHooks";
import type { createTimesheetLoader } from "./createTimesheetLoader";

export function TimesheetDateRange(
  props: Pick<
    ReturnType<typeof useInvoiceFormState>,
    | "selectedClient"
    | "timesheetStartDate"
    | "setTimesheetStartDate"
    | "timesheetEndDate"
    | "setTimesheetEndDate"
    | "isFetchingTimesheets"
  > &
    Pick<ReturnType<typeof useInvoicePageHooks>, "t"> &
    Pick<ReturnType<typeof createTimesheetLoader>, "fetchAndPopulateTimesheets">
) {
  const {
    fetchAndPopulateTimesheets,
    isFetchingTimesheets,
    selectedClient,
    setTimesheetEndDate,
    setTimesheetStartDate,
    t,
    timesheetEndDate,
    timesheetStartDate,
  } = props;
  return (
    <>
      {/* Timesheet Date Range Section */}
      {selectedClient && (
        <div className="invoice-selection-bar timesheet-date-range">
          <div className="selection-section">
            <label className="selection-label" htmlFor="timesheet-start-date">
              <Calendar size={16} />
              {t("invoiceManagement.timesheetStartDate")}
            </label>
            <input
              id="timesheet-start-date"
              type="date"
              value={timesheetStartDate}
              onChange={(e) => setTimesheetStartDate(e.target.value)}
              className="invoice-date-input"
            />
          </div>

          <div className="selection-section">
            <label className="selection-label" htmlFor="timesheet-end-date">
              <Calendar size={16} />
              {t("invoiceManagement.timesheetEndDate")}
            </label>
            <input
              id="timesheet-end-date"
              type="date"
              value={timesheetEndDate}
              onChange={(e) => setTimesheetEndDate(e.target.value)}
              className="invoice-date-input"
            />
          </div>

          <div className="selection-section">
            <label className="selection-label">&nbsp;</label>
            <button
              className={`button ${
                isFetchingTimesheets || !timesheetStartDate || !timesheetEndDate
                  ? "disabled"
                  : ""
              }`}
              onClick={fetchAndPopulateTimesheets}
              disabled={
                isFetchingTimesheets || !timesheetStartDate || !timesheetEndDate
              }
              style={{ width: "fit-content" }}
            >
              {isFetchingTimesheets ? (
                <>
                  <Loader2 size={16} className="timesheet-loading-spinner" />
                  {t("invoiceManagement.fetchingTimesheets")}
                </>
              ) : (
                <>
                  <ClipboardList size={16} />
                  {t("invoiceManagement.loadTimesheets")}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
