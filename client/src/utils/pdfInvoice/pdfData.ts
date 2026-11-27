// The invoice PDF's data type and small helpers, moved out of pdfGenerator.tsx unchanged (R-5s).

// Helper function to format date with ordinal suffix without timezone shift
export const formatDateWithOrdinal = (dateString: string): string => {
  if (!dateString) return "";

  let day: number;
  let monthStr: string;
  let year: number;

  if (dateString.includes("-")) {
    const parts = dateString.split("T")[0].split("-");
    if (parts.length === 3) {
      year = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      monthStr = monthNames[monthIdx] || "";
    } else {
      const date = new Date(dateString);
      day = date.getUTCDate();
      monthStr = date.toLocaleDateString("en-US", {
        month: "short",
        timeZone: "UTC",
      });
      year = date.getUTCFullYear();
    }
  } else {
    const date = new Date(dateString);
    day = date.getUTCDate();
    monthStr = date.toLocaleDateString("en-US", {
      month: "short",
      timeZone: "UTC",
    });
    year = date.getUTCFullYear();
  }

  // Get ordinal suffix
  const suffix = (d: number) => {
    if (d > 3 && d < 21) return "th";
    switch (d % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };

  return `${day}${suffix(day)} ${monthStr} ${year}`;
};

// Interfaces
export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  client: {
    companyName: string;
    address?: string[];
    email?: string;
  };
  lineItems: Array<{
    positionName?: string;
    description: string;
    candidate?: string;
    hours: number;
    rate: number;
    taxType: string;
    amount: number;
  }>;
  summary: {
    subtotal: number;
    totalHST: number;
    totalGST: number;
    totalQST: number;
    totalTax: number;
    grandTotal: number;
    totalHours: number;
    // Add tax percentage information
    hstPercentage?: number;
    gstPercentage?: number;
    qstPercentage?: number;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
  /** Company details printed in the header (portal settings). */
  company: {
    name: string;
    address: string;
    address2: string;
    taxNumber: string;
  };
  terms: string;
  messageOnInvoice?: string;
  termsOnInvoice?: string;
}

// Helper to check if a value has data
export const hasValue = (val?: string | null): boolean => {
  return Boolean(val && val.trim() !== "");
};

// The props of the invoice PDF document component.
export interface InvoicePdfDocumentProps {
  data: InvoiceData;
}
