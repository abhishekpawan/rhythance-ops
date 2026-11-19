import type { EnvelopePrintingReportRow } from "../../services/api/reports";

export const formatCurrency = (value: unknown): string => {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    value === "N/A"
  ) {
    return "N/A";
  }

  // Multi-position rows carry several rates, e.g. "23.00, 24.00"
  if (typeof value === "string" && value.includes(",")) {
    return value
      .split(",")
      .map((part) => formatCurrency(part.trim()))
      .join(", ");
  }

  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(String(value));

  if (Number.isNaN(numericValue)) {
    return String(value);
  }

  return `$${numericValue.toFixed(2)}`;
};

export const formatPhoneNumber = (value: unknown): string => {
  const phone = String(value ?? "").trim();
  if (!phone) return "";

  const digits = phone.replace(/\D/g, "");

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(
      7,
      11
    )}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(
      6,
      10
    )}`;
  }

  if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}`;
  }

  return phone;
};

// The CSV download sorts the rows on the page by client, then jobseeker (case-insensitive) and
// numbers them again from 1 (moved verbatim from the two envelope pages).
export const sortEnvelopeRowsForCsv = (
  rows: EnvelopePrintingReportRow[]
): EnvelopePrintingReportRow[] =>
  [...rows].sort((a, b) => {
    const clientA = (a.client_name || "").toLowerCase();
    const clientB = (b.client_name || "").toLowerCase();
    if (clientA < clientB) return -1;
    if (clientA > clientB) return 1;
    const nameA = (a.jobseeker_name || "").toLowerCase();
    const nameB = (b.jobseeker_name || "").toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });

export const envelopeCsvNumbers = (
  row: EnvelopePrintingReportRow,
  index: number
): { newSequenceNumber: number; newSrNo: string } => {
  const newSequenceNumber = index + 1;
  const newSrNo = row.sr_no
    ? `${row.sr_no.substring(0, row.sr_no.lastIndexOf("-") + 1)}${String(newSequenceNumber).padStart(3, "0")}`
    : `NA-NA-${String(newSequenceNumber).padStart(3, "0")}`;
  return { newSequenceNumber, newSrNo };
};
