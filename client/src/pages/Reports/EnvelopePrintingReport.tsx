import { useEffect, useState } from "react";
import {
  getEnvelopePrintingReport,
  EnvelopePrintingReportRow,
  EnvelopePrintingReportFilter,
} from "../../services/api/reports";
import { getClients, ClientData } from "../../services/api/client";
import { AppHeader } from "../../components/AppHeader";
import { DropdownOption } from "../../components/CustomDropdown";
import { useLanguage } from "../../contexts/language/language-provider";
import { PAY_CYCLES } from "../../constants/formOptions";
import { getDropdownOptions } from "../../services/api/dropdownOptions";
import { useColumnSearch } from "../../hooks/useColumnSearch";
import { ReportTableToolbar } from "../../components/ReportTableToolbar";
import { EnvelopePrintingFilters } from "./EnvelopePrintingFilters";
import { EnvelopeReportTable } from "./EnvelopeReportTable";
import { getTableColumns, getCsvColumns } from "./envelopeReportColumns";
import { downloadEnvelopeCsv } from "./envelopeReportCsv";
import { formatCalendarDate, getTodayInCanada, addDaysToDateStr } from "../../utils/dateUtils";

export function EnvelopePrintingReport() {
  const { t } = useLanguage();
  const tableColumns = getTableColumns(t);
  const csvColumns = getCsvColumns(tableColumns);

  // Calculate default dates: end date = today, start date = 1 month ago
  const getDefaultDates = () => {
    const today = getTodayInCanada();
    return {
      endDate: today,
      startDate: addDaysToDateStr(today, -30),
    };
  };


  const defaultDates = getDefaultDates();

  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClients, setSelectedClients] = useState<ClientData[]>([]);
  const [availableListNames, setAvailableListNames] = useState<string[]>([]);
  const [selectedListNames, setSelectedListNames] = useState<string[]>([]);
  const [selectedPayCycles, setSelectedPayCycles] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>(defaultDates.startDate);
  const [endDate, setEndDate] = useState<string>(defaultDates.endDate);
  const [clientLoading, setClientLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportRows, setReportRows] = useState<EnvelopePrintingReportRow[]>([]);
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
    if (columnKey === 'report_generated_date') return formatCalendarDate(getTodayInCanada());
    const colDef = tableColumns.find(c => c.key === columnKey);
    const val = row[columnKey as keyof EnvelopePrintingReportRow];
    return colDef?.format ? colDef.format(val, row) : String(val ?? '');
  });

  useEffect(() => {
    setClientLoading(true);
    getClients({ limit: 10000 })
      .then((res) => {
        setClients(res.clients);
      })
      .catch(() => setClients([]))
      .finally(() => setClientLoading(false));
  }, []);

  useEffect(() => {
    getDropdownOptions('list_name')
      .then((opts) => {
        const names = opts.map((o) => o.name);
        setAvailableListNames(names);
      })
      .catch(() => setAvailableListNames([]));
  }, []);

  useEffect(() => {
    if (selectedClients.length === 0) {
      setReportRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    const filter: EnvelopePrintingReportFilter = {
      clientIds: selectedClients.map((c) => c.id ?? ""),
      startDate,
      endDate,
      listName: selectedListNames.length > 0 ? selectedListNames : undefined,
      payCycle: selectedPayCycles.length > 0 ? selectedPayCycles : undefined,
    };
    getEnvelopePrintingReport(filter)
      .then(setReportRows)
      .catch((e) => setError(e.message || "Failed to fetch report"))
      .finally(() => setLoading(false));
  }, [
    selectedClients,
    startDate,
    endDate,
    selectedListNames,
    selectedPayCycles,
  ]);

  const clientOptions: DropdownOption[] = clients.map((c) => ({
    id: c.id ?? "",
    label: c.companyName || "Unknown",
    sublabel: c.shortCode || "",
    value: c,
    isInactive: c.isInactive,
  }));

  const listNameOptions: DropdownOption[] = availableListNames.map((ln) => ({
    id: ln,
    label: ln,
    value: ln,
  }));

  const payCycleOptions: DropdownOption[] = PAY_CYCLES.map((pc) => ({
    id: pc,
    label: pc,
    value: pc,
  }));

  return (
    <div className="page-container common-report-container">
      <AppHeader title={t("reports.types.envelopePrinting.title")} />
      <div className="common-report-card">
        <EnvelopePrintingFilters
          clientLoading={clientLoading}
          clientOptions={clientOptions}
          selectedClients={selectedClients}
          setSelectedClients={setSelectedClients}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          listNameOptions={listNameOptions}
          selectedListNames={selectedListNames}
          setSelectedListNames={setSelectedListNames}
          payCycleOptions={payCycleOptions}
          selectedPayCycles={selectedPayCycles}
          setSelectedPayCycles={setSelectedPayCycles}
        />
        {reportRows.length > 0 && (
          <ReportTableToolbar
            hasActiveFilters={hasActiveFilters}
            totalCount={totalCount}
            filteredCount={filteredCount}
            onClearSearch={clearAllFilters}
            onDownloadCSV={() => {
              downloadEnvelopeCsv(searchedReportRows, csvColumns, t, "Envelope Printing Report.csv");
            }}
          />
        )}
        <EnvelopeReportTable
          loading={loading}
          error={error}
          reportRows={reportRows}
          searchedReportRows={searchedReportRows}
          tableColumns={tableColumns}
          columnFilters={columnFilters}
          setColumnFilter={setColumnFilter}
        />
      </div>
    </div>
  );
}
