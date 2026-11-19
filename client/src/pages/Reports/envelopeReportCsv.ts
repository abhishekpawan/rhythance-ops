import type { EnvelopePrintingReportRow } from "../../services/api/reports";
import { exportToCSV } from "../../utils/csvExport";
import { formatCalendarDate, getTodayInCanada } from "../../utils/dateUtils";
import {
  sortEnvelopeRowsForCsv,
  envelopeCsvNumbers,
} from "./envelopeReportShared";
import type { getCsvColumns } from "./envelopeReportColumns";

export function downloadEnvelopeCsv(
  searchedReportRows: EnvelopePrintingReportRow[],
  csvColumns: ReturnType<typeof getCsvColumns>,
  t: (key: string) => string,
  fileName: string
) {
  const reportGeneratedDate = formatCalendarDate(getTodayInCanada());
  const sortedRows = sortEnvelopeRowsForCsv(searchedReportRows);
  const csvData = sortedRows.map((row, index) => {
    const { newSequenceNumber, newSrNo } = envelopeCsvNumbers(row, index);

    const csvRow: Record<string, unknown> = {};
    csvColumns.forEach((col) => {
      if (col.key === "report_generated_date") return;
      let val: unknown = row[col.key as keyof EnvelopePrintingReportRow];
      if (col.key === "sequence_number") {
        val = newSequenceNumber;
      } else if (col.key === "sr_no") {
        val = newSrNo;
      }
      csvRow[col.label] = col.format
        ? col.format(val, row)
        : val !== undefined && val !== null
          ? String(val)
          : "N/A";
    });
    csvRow[
      t("reports.columns.reportGeneratedDate") || "Report Generated Date"
    ] = reportGeneratedDate;
    return csvRow;
  });
  exportToCSV(csvData, fileName, [
    ...csvColumns
      .filter((col) => col.key !== "report_generated_date")
      .map((col) => col.label),
    t("reports.columns.reportGeneratedDate") || "Report Generated Date",
  ]);
}
