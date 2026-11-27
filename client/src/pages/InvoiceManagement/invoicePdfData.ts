// The data of the invoice PDF, moved out of InvoiceManagement.tsx unchanged (R-5s). The page's state it reads became
// the parameter; the PDF itself is made by utils/pdfGenerator.tsx.
import type { ClientData } from "../../services/api/client";
import type { InvoiceData as PDFInvoiceData } from "../../utils/loadPdfMaker";
import { calculateLineItemTotals, getTaxInfo } from "./invoiceCalculations";
import type { InvoiceLineItem } from "./invoiceTypes";

interface InvoicePdfInput {
  pdfInvoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  selectedClient: ClientData;
  pdfLineItemTotals: ReturnType<
    typeof calculateLineItemTotals
  >["lineItemTotals"];
  subtotal: number;
  totalHST: number;
  totalGST: number;
  totalQST: number;
  totalTax: number;
  grandTotal: number;
  lineItems: InvoiceLineItem[];
  timesheetStartDate: string;
  timesheetEndDate: string;
  portalSettings: Record<string, string>;
  selectedTerms: string;
  messageOnInvoice: string;
  termsOnInvoice: string;
}

export function buildInvoicePdfData(input: InvoicePdfInput): PDFInvoiceData {
  const {
    pdfInvoiceNumber,
    invoiceDate,
    dueDate,
    selectedClient,
    pdfLineItemTotals,
    subtotal,
    totalHST,
    totalGST,
    totalQST,
    totalTax,
    grandTotal,
    lineItems,
    timesheetStartDate,
    timesheetEndDate,
    portalSettings,
    selectedTerms,
    messageOnInvoice,
    termsOnInvoice,
  } = input;
  return {
    invoiceNumber: pdfInvoiceNumber,
    invoiceDate: invoiceDate,
    dueDate: dueDate,
    client: {
      companyName: selectedClient.companyName || "",
      address: [
        selectedClient.streetAddress1 || "",
        selectedClient.city1 || "",
        selectedClient.province1 || "",
        selectedClient.postalCode1 || "",
      ].filter(Boolean),
      email: selectedClient.emailAddress1,
    },
    lineItems: pdfLineItemTotals.flatMap((item) => {
      const hasOvertime = (item.totalOvertimeHours || 0) > 0;
      const candidateFullName = item.jobseeker
        ? `${item.jobseeker.firstName || ""} ${item.jobseeker.lastName || ""}`.trim()
        : "";
      const candidate = candidateFullName || undefined;

      const positionName =
        item.position &&
        item.position.positionCode !== "CUSTOM" &&
        item.position.title?.trim()
          ? item.position.title.trim()
          : undefined;

      const regularDescription = item.description?.trim()
        ? `${item.description.trim()} - Regular Hours`
        : "Regular Hours";

      const items = [
        {
          positionName,
          description: regularDescription,
          candidate,
          hours: item.totalRegularHours || 0,
          rate: Number(item.regularBillRate) || 0,
          taxType: item.salesTax,
          amount: item.regularAmount || 0,
        },
      ];

      // Add overtime line item if applicable
      if (hasOvertime) {
        const overtimeDescription = item.description?.trim()
          ? `${item.description.trim()} - Overtime Hours`
          : "Overtime Hours";

        items.push({
          positionName,
          description: overtimeDescription,
          candidate,
          hours: item.totalOvertimeHours || 0,
          rate: Number(item.overtimeBillRate || item.regularBillRate) || 0,
          taxType: item.salesTax,
          amount: item.overtimeAmount || 0,
        });
      }

      return items;
    }),
    summary: {
      subtotal: subtotal,
      totalHST: totalHST,
      totalGST: totalGST,
      totalQST: totalQST,
      totalTax: totalTax,
      grandTotal: grandTotal,
      totalHours: lineItems.reduce(
        (total, item) => total + (parseFloat(item.hours) || 0),
        0
      ),
      hstPercentage:
        lineItems.length > 0
          ? getTaxInfo(lineItems[0].salesTax).hstPercentage
          : 0,
      gstPercentage:
        lineItems.length > 0
          ? getTaxInfo(lineItems[0].salesTax).gstPercentage
          : 0,
      qstPercentage:
        lineItems.length > 0
          ? getTaxInfo(lineItems[0].salesTax).qstPercentage
          : 0,
    },
    dateRange: {
      startDate: timesheetStartDate || invoiceDate,
      endDate: timesheetEndDate || dueDate,
    },
    company: {
      name: portalSettings["company.name"],
      address: portalSettings["company.address"] || "",
      address2: portalSettings["company.address2"] || "",
      taxNumber: portalSettings["company.taxNumber"] || "",
    },
    terms: selectedTerms,
    messageOnInvoice: messageOnInvoice,
    termsOnInvoice: termsOnInvoice,
  };
}
