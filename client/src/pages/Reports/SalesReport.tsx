import { useEffect, useState } from "react";
import { getSalesReport, SalesReportRow } from "../../services/api/reports";
import { getJobseekerProfiles } from "../../services/api/jobseeker";
import { getClients, ClientData } from "../../services/api/client";
import { AppHeader } from "../../components/AppHeader";
import { DropdownOption } from "../../components/CustomDropdown";
import { useLanguage } from "../../contexts/language/language-provider";
import { Loader2 } from "lucide-react";
import { JobSeekerProfile } from "../../types/jobseeker";
import { formatDate as formatWeekDate } from "../TimesheetManagement/functions/weekUtils";
import "../../styles/pages/CommonReportsStyles.css";
import { exportToCSV } from '../../utils/csvExport';
import { useColumnSearch } from "../../hooks/useColumnSearch";
import { ReportTableToolbar } from "../../components/ReportTableToolbar";
import { ColumnSearchInput } from "../../components/ColumnSearchInput";
import { getTableColumns, getCsvColumns } from "./salesReportColumns";
import { SalesReportFilters } from "./SalesReportFilters";

export function SalesReport() {
  const { t } = useLanguage();
  const tableColumns = getTableColumns(t);
  const csvColumns = getCsvColumns(tableColumns);
  // Filter state
  const [clients, setClients] = useState<ClientData[]>([]);
  const [jobseekers, setJobseekers] = useState<JobSeekerProfile[]>([]);
  const [selectedClients, setSelectedClients] = useState<ClientData[]>([]);
  const [selectedJobseekers, setSelectedJobseekers] = useState<JobSeekerProfile[]>([]);
  const [selectedSalesPersons, setSelectedSalesPersons] = useState<string[]>([]);
  const [salesPersonOptions, setSalesPersonOptions] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Data state
  const [clientLoading, setClientLoading] = useState(false);
  const [jobseekerLoading, setJobseekerLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportRows, setReportRows] = useState<SalesReportRow[]>([]);
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
    if (columnKey === 'status') {
      const clientStatus = row.client_is_inactive ? 'Client Inactive' : 'Client Active';
      const jsStatus = row.jobseeker_is_inactive ? 'JS Inactive' : 'JS Active';
      return `${clientStatus} / ${jsStatus}`;
    }
    if (columnKey === 'from_to_date') {
      return `${formatWeekDate(String(row.from_date))} - ${formatWeekDate(String(row.to_date))}`;
    }
    const colDef = tableColumns.find(c => c.key === columnKey);
    const val = row[columnKey as keyof SalesReportRow];
    return colDef?.format ? colDef.format(val, row as unknown as Record<string, unknown>) : String(val ?? '');
  });

  // Fetch clients and jobseekers on mount
  useEffect(() => {
    setClientLoading(true);
    getClients({ limit: 10000 })
      .then((res) => {
        setClients(res.clients);
        
        // Extract unique sales persons from backend data
        const uniqueSalesPersons = [...new Set(res.clients.map(c => c.salesPerson).filter(Boolean) as string[])];
        setSalesPersonOptions(uniqueSalesPersons);
      })
      .catch(() => setClients([]))
      .finally(() => setClientLoading(false));

    setJobseekerLoading(true);
    getJobseekerProfiles({ limit: 10000 })
      .then((res) => setJobseekers(res.profiles || []))
      .catch(() => setJobseekers([]))
      .finally(() => setJobseekerLoading(false));
  }, []);

  // Fetch report when filters change
  useEffect(() => {
    if (selectedClients.length === 0) {
      setReportRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    const filter = {
      clientIds: selectedClients.map((c) => c.id ?? ""),
      startDate,
      endDate,
      jobseekerIds: selectedJobseekers.length > 0 ? selectedJobseekers.map((j) => j.id ?? "") : undefined,
      salesPersons: selectedSalesPersons.length > 0 ? selectedSalesPersons : undefined,
    };
    getSalesReport(filter)
      .then(setReportRows)
      .catch((e) => setError(e.message || "Failed to fetch report"))
      .finally(() => setLoading(false));
  }, [selectedClients, startDate, endDate, selectedJobseekers, selectedSalesPersons]);

  // Dropdown options
  const clientOptions: DropdownOption[] = clients.map((c) => ({
    id: c.id ?? "",
    label: c.companyName || "Unknown",
    sublabel: c.shortCode || "",
    value: c,
    isInactive: c.isInactive,
  }));

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

  const salesPersonDropdownOptions: DropdownOption[] = salesPersonOptions.map((sp) => ({
    id: sp,
    label: sp,
    value: sp,
  }));

  return (
    <div className="page-container common-report-container">
      <AppHeader title={t('reports.types.salesReport.title')} />
      <div className="common-report-card">
        <SalesReportFilters
          clientLoading={clientLoading}
          clientOptions={clientOptions}
          selectedClients={selectedClients}
          setSelectedClients={setSelectedClients}
          jobseekerLoading={jobseekerLoading}
          jobseekerOptions={jobseekerOptions}
          selectedJobseekers={selectedJobseekers}
          setSelectedJobseekers={setSelectedJobseekers}
          salesPersonDropdownOptions={salesPersonDropdownOptions}
          selectedSalesPersons={selectedSalesPersons}
          setSelectedSalesPersons={setSelectedSalesPersons}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
        />
        {reportRows.length > 0 && (
          <ReportTableToolbar
            hasActiveFilters={hasActiveFilters}
            totalCount={totalCount}
            filteredCount={filteredCount}
            onClearSearch={clearAllFilters}
            onDownloadCSV={() => {
              // Prepare CSV data to match the table exactly
              const statusLabel = t('reports.columns.status');
              const csvData = searchedReportRows.map((row, index) => {
                const csvRow: Record<string, unknown> = {
                  [t("reports.columns.serialNumber") || "S.No."]: index + 1,
                };
                const clientStatus = row.client_is_inactive ? 'Client Inactive' : 'Client Active';
                const jsStatus = row.jobseeker_is_inactive ? 'JS Inactive' : 'JS Active';
                csvRow[statusLabel] = `${clientStatus} / ${jsStatus}`;
                csvColumns.forEach(col => {
                  if (col.key === 'from_to_date') {
                    csvRow[col.label] = col.format ? col.format(undefined, row as unknown as Record<string, unknown>) : '';
                  } else {
                    const val = row[col.key as keyof typeof row];
                    csvRow[col.label] = col.format ? col.format(val) : (val !== undefined && val !== null ? String(val) : 'N/A');
                  }
                });
                return csvRow;
              });
              exportToCSV(
                csvData,
                'Sales Report.csv',
                [t("reports.columns.serialNumber") || "S.No.", statusLabel, ...csvColumns.map(col => col.label)]
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
                  <th className="th-header-cell">
                    <div className="column-header-content">
                      <span className="column-header-title">{t('reports.columns.status')}</span>
                      <ColumnSearchInput
                        value={columnFilters['status'] || ''}
                        onChange={(val) => setColumnFilter('status', val)}
                      />
                    </div>
                  </th>
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
                    <td colSpan={tableColumns.length + 1} className="empty-table-cell">
                      {t('reports.states.noMatchingRecords') || 'No matching records found.'}
                    </td>
                  </tr>
                ) : (
                  searchedReportRows.map((row, idx) => (
                    <tr key={idx} className={(row.client_is_inactive || row.jobseeker_is_inactive) ? 'inactive-row' : ''}>
                      <td className="status-cell">
                        {row.client_is_inactive
                          ? <span className="inactive-badge inactive-badge-sm">Client Inactive</span>
                          : <span className="active-badge">Client Active</span>
                        }
                        {row.jobseeker_is_inactive
                          ? <span className="inactive-badge inactive-badge-sm">JS Inactive</span>
                          : <span className="active-badge">JS Active</span>
                        }
                      </td>
                      {tableColumns.map((col, i) => {
                        if (col.key === 'from_to_date') {
                          const displayValue = col.format ? col.format(undefined, row as unknown as Record<string, unknown>) : '';
                          return <td key={i}>{displayValue}</td>;
                        } else {
                          const val = row[col.key as keyof typeof row];
                          const displayValue = col.format ? col.format(val) : (val !== undefined && val !== null ? String(val) : 'N/A');
                          return <td key={i}>{displayValue}</td>;
                        }
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

