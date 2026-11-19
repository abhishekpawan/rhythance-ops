import { useEffect, useState } from "react";
import { getTimesheetReport, TimesheetReportFilter, TimesheetReportRow } from "../../services/api/reports";
import { getJobseekerProfiles } from "../../services/api/jobseeker";
import { getClients, ClientData } from "../../services/api/client";
import { AppHeader } from "../../components/AppHeader";
import { DropdownOption } from "../../components/CustomDropdown";
import { useLanguage } from "../../contexts/language/language-provider";
import { Loader2 } from "lucide-react";
import { JobSeekerProfile } from "../../types/jobseeker";
import { generateWeekOptions, getWeekEndDate } from "../TimesheetManagement/functions/weekUtils";
import { PAY_CYCLES } from "../../constants/formOptions";
import "../../styles/pages/CommonReportsStyles.css";
import { exportToCSV } from '../../utils/csvExport';
import { getDropdownOptions } from '../../services/api/dropdownOptions';

import { useColumnSearch } from "../../hooks/useColumnSearch";
import { ReportTableToolbar } from "../../components/ReportTableToolbar";
import { ColumnSearchInput } from "../../components/ColumnSearchInput";
import { getTableColumns, getCsvColumns } from "./weeklyTimesheetColumns";
import { WeeklyTimesheetFilters } from "./WeeklyTimesheetFilters";


export function WeeklyTimesheet() {
  const { t } = useLanguage();
  const tableColumns = getTableColumns(t);
  const csvColumns = getCsvColumns(tableColumns);
  // Filter state
  const [jobseekers, setJobseekers] = useState<JobSeekerProfile[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedJobseekers, setSelectedJobseekers] = useState<JobSeekerProfile[]>([]);
  const [selectedClients, setSelectedClients] = useState<ClientData[]>([]);
  const [weekOptions, setWeekOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedWeeks, setSelectedWeeks] = useState<Array<{ start: string; end: string }>>([]);
  const [selectedPayCycles, setSelectedPayCycles] = useState<string[]>([]);
  const [selectedListNames, setSelectedListNames] = useState<string[]>([]);
  const [availableListNames, setAvailableListNames] = useState<string[]>([]);

  // Data state
  const [jobseekerLoading, setJobseekerLoading] = useState(false);
  const [clientLoading, setClientLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportRows, setReportRows] = useState<TimesheetReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const {
    columnFilters,
    setColumnFilter,
    clearAllFilters,
    hasActiveFilters,
    filteredData: searchedReportRows,
    totalCount,
    filteredCount,
  } = useColumnSearch(reportRows, (row, columnKey) => {
    const colDef = tableColumns.find(c => c.key === columnKey);
    const val = row[columnKey as keyof TimesheetReportRow];
    return colDef?.format ? colDef.format(val, row as unknown as Record<string, unknown>) : String(val ?? '');
  });

  // Fetch jobseekers and clients on mount
  useEffect(() => {
    setJobseekerLoading(true);
    getJobseekerProfiles({ limit: 10000 })
      .then((res) => setJobseekers(res.profiles || []))
      .catch(() => setJobseekers([]))
      .finally(() => setJobseekerLoading(false));
    setClientLoading(true);
    getClients({ limit: 10000 })
      .then((res) => {
        setClients(res.clients);
      })
      .catch(() => setClients([]))
      .finally(() => setClientLoading(false));
  }, []);

  // Set week options on mount
  useEffect(() => {
    setWeekOptions(generateWeekOptions());
  }, []);

  // Fetch list names from DB on mount
  useEffect(() => {
    getDropdownOptions('list_name')
      .then((opts) => setAvailableListNames(opts.map((o) => o.name)))
      .catch(() => setAvailableListNames([]));
  }, []);

  // Fetch report when filters change
  useEffect(() => {
    if (selectedJobseekers.length === 0 || selectedWeeks.length === 0) {
      setReportRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    const filter: TimesheetReportFilter = {
      jobseekerIds: selectedJobseekers.map(j => j.id ?? ""),
      clientIds: selectedClients.map((c) => c.id ?? ""),
      weekPeriods: selectedWeeks,
      payCycles: selectedPayCycles,
      listNames: selectedListNames,
    };
    getTimesheetReport(filter)
      .then(setReportRows)
      .catch((e) => setError(e.message || "Failed to fetch report"))
      .finally(() => setLoading(false));
  }, [selectedJobseekers, selectedClients, selectedWeeks, selectedPayCycles, selectedListNames]);

  // Dropdown options
  const jobseekerOptions: DropdownOption[] = jobseekers.map((j) => {
    const phoneNumber = (j as JobSeekerProfile & { mobile?: string; phone?: string; employeeId?: string }).phoneNumber;
    const employeeId = (j as JobSeekerProfile & { mobile?: string; phone?: string; employeeId?: string }).employeeId;
    return {
      id: j.id ?? "",
      label: j.name || j.email || "Unknown",
      sublabel: [
        j.email,
        phoneNumber,
        employeeId
      ].filter(Boolean).join(" - "),
      value: j,
      isInactive: j.isInactive,
    };
  });
  const clientOptions: DropdownOption[] = clients.map((c) => ({
    id: c.id ?? "",
    label: c.companyName || "Unknown",
    sublabel: c.shortCode || "",
    value: c,
    isInactive: c.isInactive,
  }));
  const weekDropdownOptions: DropdownOption[] = weekOptions.map((w) => {
    const start = w.value;
    const end = getWeekEndDate(start);
    return {
      id: start + "_" + end,
      label: w.label,
      value: { start, end },
    };
  });
  const payCycleOptions: DropdownOption[] = PAY_CYCLES.map((pc) => ({ id: pc, label: pc, value: pc }));
  const listNameOptions: DropdownOption[] = availableListNames.map((ln) => ({ id: ln, label: ln, value: ln }));

  return (
    <div className="page-container common-report-container">
      <AppHeader title={t('reports.types.weeklyTimesheet.title')} />
      <div className="common-report-card">
        <WeeklyTimesheetFilters
          jobseekerLoading={jobseekerLoading}
          jobseekerOptions={jobseekerOptions}
          selectedJobseekers={selectedJobseekers}
          setSelectedJobseekers={setSelectedJobseekers}
          clientLoading={clientLoading}
          clientOptions={clientOptions}
          selectedClients={selectedClients}
          setSelectedClients={setSelectedClients}
          weekDropdownOptions={weekDropdownOptions}
          selectedWeeks={selectedWeeks}
          setSelectedWeeks={setSelectedWeeks}
          payCycleOptions={payCycleOptions}
          selectedPayCycles={selectedPayCycles}
          setSelectedPayCycles={setSelectedPayCycles}
          listNameOptions={listNameOptions}
          selectedListNames={selectedListNames}
          setSelectedListNames={setSelectedListNames}
        />
        {reportRows.length > 0 && (
          <ReportTableToolbar
            hasActiveFilters={hasActiveFilters}
            totalCount={totalCount}
            filteredCount={filteredCount}
            onClearSearch={clearAllFilters}
            onDownloadCSV={() => {
              const csvData = searchedReportRows.map((row, index) => {
                const csvRow: Record<string, unknown> = {};
                csvColumns.forEach(col => {
                  const val = row[col.key as keyof typeof row];
                  csvRow[col.label] = col.format ? col.format(val, row as unknown as Record<string, unknown>, index) : (val !== undefined && val !== null ? String(val) : 'N/A');
                });
                return csvRow;
              });
              exportToCSV(
                csvData,
                'Weekly Timesheet Report.csv',
                csvColumns.map(col => col.label)
              );
            }}
          />
        )}
        <div className="report-table-container timesheet-selection-bar">
          {loading ? (
            <div className="loading-indicator"><Loader2 size={24} className="spin" /> {t('reports.states.loading')}</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : reportRows.length === 0 ? (
            <div className="empty-state">{t('reports.states.noDataFound')}</div>
          ) : (
            <table className="common-table">
              <thead>
                <tr>
                  {tableColumns.map(col => (
                    <th key={col.key} className="th-header-cell">
                      <div className="column-header-content">
                        <span className="column-header-title">{col.label}</span>
                        <ColumnSearchInput
                          value={columnFilters[col.key] || ''}
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
                      {t('reports.states.noMatchingRecords') || 'No matching records found.'}
                    </td>
                  </tr>
                ) : (
                  searchedReportRows.map((row, idx) => (
                    <tr key={idx} className={(row.client_is_inactive || row.jobseeker_is_inactive) ? 'inactive-row' : ''}>
                      {tableColumns.map((col, i) => {
                        const val = row[col.key as keyof typeof row];
                        const displayValue = col.format ? col.format(val, row as unknown as Record<string, unknown>) : (val !== undefined && val !== null ? String(val) : 'N/A');
                        return <td key={i}>{displayValue}</td>;
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

