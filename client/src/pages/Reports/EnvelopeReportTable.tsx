import { Loader2 } from "lucide-react";
import type { EnvelopePrintingReportRow } from "../../services/api/reports";
import { useLanguage } from "../../contexts/language/language-provider";
import { ColumnSearchInput } from "../../components/ColumnSearchInput";
import { formatCalendarDate, getTodayInCanada } from "../../utils/dateUtils";
import type { getTableColumns } from "./envelopeReportColumns";

type Props = {
  loading: boolean;
  error: string | null;
  reportRows: EnvelopePrintingReportRow[];
  searchedReportRows: EnvelopePrintingReportRow[];
  tableColumns: ReturnType<typeof getTableColumns>;
  columnFilters: Record<string, string>;
  setColumnFilter: (columnKey: string, value: string) => void;
};

export function EnvelopeReportTable({
  loading,
  error,
  reportRows,
  searchedReportRows,
  tableColumns,
  columnFilters,
  setColumnFilter,
}: Props) {
  const { t } = useLanguage();
  return (
    <div className="report-table-container timesheet-selection-bar">
      {loading ? (
        <div className="loading-indicator">
          <Loader2 size={24} className="spin" /> {t("reports.states.loading")}
        </div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : reportRows.length === 0 ? (
        <div className="empty-state">{t("reports.states.noDataFound")}</div>
      ) : (
        <table className="common-table">
          <thead>
            <tr>
              {tableColumns.map((col) => (
                <th key={col.key} className="th-header-cell">
                  <div className="column-header-content">
                    <span className="column-header-title">{col.label}</span>
                    <ColumnSearchInput
                      value={columnFilters[col.key] || ""}
                      onChange={(val) => setColumnFilter(col.key, val)}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {searchedReportRows.length === 0 ? (
              <tr>
                <td colSpan={tableColumns.length} className="empty-table-cell">
                  {t("reports.states.noMatchingRecords") ||
                    "No matching records found."}
                </td>
              </tr>
            ) : (
              searchedReportRows.map((row, idx) => (
                <tr
                  key={idx}
                  className={
                    row.client_is_inactive || row.jobseeker_is_inactive
                      ? "inactive-row"
                      : ""
                  }
                >
                  {tableColumns.map((col, i) => {
                    let displayValue: string;
                    if (col.key === "report_generated_date") {
                      displayValue = formatCalendarDate(getTodayInCanada());
                    } else {
                      const val =
                        row[col.key as keyof EnvelopePrintingReportRow];
                      displayValue = col.format
                        ? col.format(val, row)
                        : val !== undefined && val !== null
                          ? String(val)
                          : "N/A";
                    }
                    return <td key={i}>{displayValue}</td>;
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
