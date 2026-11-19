import { useEffect, useState } from "react";
import {
  getEnvelopePrintingByDueDateReport,
  EnvelopePrintingReportRow,
  EnvelopePrintingByDueDateReportFilter,
} from "../../services/api/reports";
import { getClients, ClientData } from "../../services/api/client";
import { AppHeader } from "../../components/AppHeader";
import { DropdownOption } from "../../components/CustomDropdown";
import { useLanguage } from "../../contexts/language/language-provider";
import { PAY_CYCLES } from "../../constants/formOptions";
import { useColumnSearch } from "../../hooks/useColumnSearch";
import { ReportTableToolbar } from "../../components/ReportTableToolbar";
import { EnvelopePrintingByDueDateFilters } from "./EnvelopePrintingByDueDateFilters";
import { EnvelopeReportTable } from "./EnvelopeReportTable";
import { getTableColumns, getCsvColumns } from "./envelopeReportColumns";
import { downloadEnvelopeCsv } from "./envelopeReportCsv";
import { formatCalendarDate, getTodayInCanada } from "../../utils/dateUtils";


export function EnvelopePrintingByDueDateReport() {
  const { t } = useLanguage();
  const tableColumns = getTableColumns(t);
  const csvColumns = getCsvColumns(tableColumns);

  const getDefaultDate = () => {
    return getTodayInCanada();
  };


  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClients, setSelectedClients] = useState<ClientData[]>([]);
  const [selectedPayCycles, setSelectedPayCycles] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string>(getDefaultDate());
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
    if (selectedClients.length === 0) {
      setReportRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    const filter: EnvelopePrintingByDueDateReportFilter = {
      clientIds: selectedClients.map((c) => c.id ?? ""),
      dueDate,
      payCycle: selectedPayCycles.length > 0 ? selectedPayCycles : undefined,
    };
    getEnvelopePrintingByDueDateReport(filter)
      .then(setReportRows)
      .catch((e) => setError(e.message || "Failed to fetch report"))
      .finally(() => setLoading(false));
  }, [
    selectedClients,
    dueDate,
    selectedPayCycles,
  ]);

  const clientOptions: DropdownOption[] = clients.map((c) => ({
    id: c.id ?? "",
    label: c.companyName || "Unknown",
    sublabel: c.shortCode || "",
    value: c,
    isInactive: c.isInactive,
  }));

  const payCycleOptions: DropdownOption[] = PAY_CYCLES.map((pc) => ({
    id: pc,
    label: pc,
    value: pc,
  }));

  return (
    <div className="page-container common-report-container">
      <AppHeader title={t("reports.types.envelopePrintingByDueDate.title") || "Envelope Printing Report (By Due Date)"} />
      <div className="common-report-card">
        <EnvelopePrintingByDueDateFilters
          clientLoading={clientLoading}
          clientOptions={clientOptions}
          selectedClients={selectedClients}
          setSelectedClients={setSelectedClients}
          payCycleOptions={payCycleOptions}
          selectedPayCycles={selectedPayCycles}
          setSelectedPayCycles={setSelectedPayCycles}
          dueDate={dueDate}
          setDueDate={setDueDate}
        />
        {reportRows.length > 0 && (
          <ReportTableToolbar
            hasActiveFilters={hasActiveFilters}
            totalCount={totalCount}
            filteredCount={filteredCount}
            onClearSearch={clearAllFilters}
            onDownloadCSV={() => {
              downloadEnvelopeCsv(searchedReportRows, csvColumns, t, "Envelope Printing Report (By Due Date).csv");
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
