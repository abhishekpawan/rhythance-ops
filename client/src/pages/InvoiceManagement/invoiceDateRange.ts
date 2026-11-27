// The invoice page's date-range helpers, moved out of InvoiceManagement.tsx unchanged (R-5s).

// Helper to parse date string like "8/2/2026" or "2026-08-02" into YYYY-MM-DD format for date input without timezone shift
const formatToInputDate = (dateStr: string): string => {
  if (!dateStr) return "";
  if (dateStr.includes("-")) {
    return dateStr.split("T")[0];
  }
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const month = parts[0].padStart(2, "0");
      const day = parts[1].padStart(2, "0");
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
  }
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) return "";
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Helper to extract timesheet date range from invoice data or line items
export const extractTimesheetDateRange = (
  invData: any
): { startDate: string; endDate: string } => {
  const topStart = (invData?.invoiceData?.timesheetStartDate ||
    invData?.timesheetStartDate) as string;
  const topEnd = (invData?.invoiceData?.timesheetEndDate ||
    invData?.timesheetEndDate) as string;
  if (topStart && topEnd) {
    return {
      startDate: formatToInputDate(topStart),
      endDate: formatToInputDate(topEnd),
    };
  }

  // Fallback: try parsing from saved timesheets
  const timesheets = invData?.invoiceData?.timesheets || invData?.timesheets;
  if (Array.isArray(timesheets) && timesheets.length > 0) {
    for (const ts of timesheets) {
      if (ts.weekStartDate && ts.weekEndDate) {
        const parsedStart = formatToInputDate(ts.weekStartDate);
        const parsedEnd = formatToInputDate(ts.weekEndDate);
        if (parsedStart && parsedEnd) {
          return { startDate: parsedStart, endDate: parsedEnd };
        }
      }
      if (ts.description) {
        const match = ts.description.match(
          /Work period:\s*([0-9\/\-]+)\s*-\s*([0-9\/\-]+)/i
        );
        if (match && match[1] && match[2]) {
          const parsedStart = formatToInputDate(match[1]);
          const parsedEnd = formatToInputDate(match[2]);
          if (parsedStart && parsedEnd) {
            return { startDate: parsedStart, endDate: parsedEnd };
          }
        }
      }
    }
  }

  return {
    startDate: formatToInputDate(topStart) || "",
    endDate: formatToInputDate(topEnd) || "",
  };
};
