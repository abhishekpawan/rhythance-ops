import type { PositionData } from "../../services/api/position";
import { addDaysToDateStr } from "../../utils/dateUtils";
import type { InvoiceLineItem } from "./invoiceTypes";

// The invoice page's money and date rules, moved out of InvoiceManagement.tsx unchanged (R-5s). The component's state
// they read became a parameter: calculateLineItemTotals(lineItems) and calculateDueDate(.., .., setDueDate).

// Calculate regular and overtime hours for a line item
export const calculateLineItemHours = (
  hours: number,
  position: PositionData | null
): { regularHours: number; overtimeHours: number } => {
  if (!position || !position.overtimeEnabled) {
    return {
      regularHours: hours,
      overtimeHours: 0,
    };
  }

  const overtimeThreshold = position.overtimeHours
    ? parseFloat(position.overtimeHours)
    : 40;

  const regularHours = Math.min(hours, overtimeThreshold);
  const overtimeHours = Math.max(0, hours - overtimeThreshold);

  return { regularHours, overtimeHours };
};

export const calculateDueDate = (
  invoiceDate: string,
  terms: string,
  setDueDate: (dueDate: string) => void
) => {
  if (!invoiceDate || !terms) return;

  if (terms === "Due on Receipt") {
    setDueDate(invoiceDate);
  } else if (terms.startsWith("Net ")) {
    const days = parseInt(terms.replace("Net ", ""), 10);
    if (!isNaN(days)) {
      setDueDate(addDaysToDateStr(invoiceDate, days));
    }
  }
};

// Helper function to determine tax types based on sales tax selection
export const getTaxInfo = (salesTax: string) => {
  // Extract province from the sales tax string (e.g., "13.00% [ON]" -> "ON")
  const provinceMatch = salesTax.match(/\[([^\]]+)\]/);
  const province = provinceMatch ? provinceMatch[1] : "";

  // Extract tax percentage
  const taxMatch = salesTax.match(/(\d+\.?\d*)%/);
  const totalTaxPercentage = taxMatch ? parseFloat(taxMatch[1]) : 0;

  // Determine tax type and breakdown
  if (province === "ON" || province === "ZERO RATED") {
    // HST for Ontario and Zero Rated
    return {
      taxType: "HST",
      hstPercentage: totalTaxPercentage,
      gstPercentage: 0,
      qstPercentage: 0,
      totalTaxPercentage,
    };
  } else if (province === "QC" && totalTaxPercentage === 14.975) {
    // GST + QST for Quebec (14.975% = 5% GST + 9.975% QST)
    return {
      taxType: "GST_QST",
      hstPercentage: 0,
      gstPercentage: 5,
      qstPercentage: 9.975,
      totalTaxPercentage,
    };
  } else {
    // GST for all other provinces (AB, BC, QC 5%)
    return {
      taxType: "GST",
      hstPercentage: 0,
      gstPercentage: totalTaxPercentage,
      qstPercentage: 0,
      totalTaxPercentage,
    };
  }
};

// Calculate line item totals helper function
export const calculateLineItemTotals = (lineItems: InvoiceLineItem[]) => {
  let subtotal = 0;
  let totalTax = 0;
  let totalHST = 0;
  let totalGST = 0;
  let totalQST = 0;

  const lineItemTotals = lineItems.map((item) => {
    const totalHours = parseFloat(item.hours) || 0;
    const regularBillRate = parseFloat(item.regularBillRate) || 0;

    // Use pre-set values if available (from edit mode), otherwise calculate
    let regularHours: number;
    let overtimeHours: number;

    if (
      item.totalRegularHours !== undefined &&
      item.totalOvertimeHours !== undefined &&
      // Only use preserved values if they sum to the total hours (consistency check)
      Math.abs(item.totalRegularHours + item.totalOvertimeHours - totalHours) <
        0.01
    ) {
      // Preserve the original split from loaded invoice data
      regularHours = item.totalRegularHours;
      overtimeHours = item.totalOvertimeHours;
    } else {
      // Calculate regular and overtime hours for new line items or when values don't match
      const calculated = calculateLineItemHours(totalHours, item.position);
      regularHours = calculated.regularHours;
      overtimeHours = calculated.overtimeHours;
    }

    // Get overtime bill rate (use regular rate if not specified)
    const overtimeBillRate =
      item.position?.overtimeEnabled && item.position?.overtimeBillRate
        ? parseFloat(item.position.overtimeBillRate)
        : regularBillRate;

    // Calculate line subtotal with overtime
    const regularAmount = regularHours * regularBillRate;
    const overtimeAmount = overtimeHours * overtimeBillRate;
    const lineSubtotal = regularAmount + overtimeAmount;

    const taxInfo = getTaxInfo(item.salesTax);
    const lineTax = (lineSubtotal * taxInfo.totalTaxPercentage) / 100;
    const lineHST = (lineSubtotal * taxInfo.hstPercentage) / 100;
    const lineGST = (lineSubtotal * taxInfo.gstPercentage) / 100;
    const lineQST = (lineSubtotal * taxInfo.qstPercentage) / 100;
    const lineTotal = lineSubtotal + lineTax;

    subtotal += lineSubtotal;
    totalTax += lineTax;
    totalHST += lineHST;
    totalGST += lineGST;
    totalQST += lineQST;

    return {
      ...item,
      totalRegularHours: regularHours,
      totalOvertimeHours: overtimeHours,
      regularBillRate,
      overtimeBillRate,
      regularAmount,
      overtimeAmount,
      lineSubtotal,
      lineTax,
      lineHST,
      lineGST,
      lineQST,
      lineTotal,
      taxInfo,
    };
  });

  const grandTotal = subtotal + totalTax;

  return {
    lineItemTotals,
    subtotal,
    totalTax,
    totalHST,
    totalGST,
    totalQST,
    grandTotal,
  };
};
