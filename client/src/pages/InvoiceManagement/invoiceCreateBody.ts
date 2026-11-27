// The request body of "save invoice" when a new invoice is created, moved out of InvoiceManagement.tsx unchanged
// (R-5s); the page's state it reads is the parameter.
import type { CreateInvoiceInput } from "./invoiceBodyTypes";

export function buildCreateInvoiceData(input: CreateInvoiceInput) {
  const {
    selectedClient,
    invoiceNumber,
    invoiceDate,
    dueDate,
    selectedTerms,
    lineItemTotals,
    uploadedAttachments,
    supplierPOItems,
    messageOnInvoice,
    termsOnInvoice,
    timesheetStartDate,
    timesheetEndDate,
    subtotal,
    totalTax,
    totalHST,
    totalGST,
    totalQST,
    grandTotal,
    lineItems,
    notes,
  } = input;
  return {
    client: {
      id: selectedClient.id!,
      companyName: selectedClient.companyName!,
      shortCode: selectedClient.shortCode!,
      emailAddress1: selectedClient.emailAddress1!,
      streetAddress1: selectedClient.streetAddress1,
      city1: selectedClient.city1,
      province1: selectedClient.province1,
      postalCode1: selectedClient.postalCode1,
      clientManager: selectedClient.clientManager,
      accountingPerson: selectedClient.accountingPerson,
      salesPerson: selectedClient.salesPerson,
    },
    invoiceNumber: invoiceNumber,
    invoiceDate: invoiceDate,
    dueDate: dueDate,
    status: "draft" as const,
    currency: selectedClient.currency || "CAD",
    paymentTerms: selectedTerms,
    timesheets: lineItemTotals.map((item) => {
      const regularHours = item.totalRegularHours || 0;
      const overtimeHours = item.totalOvertimeHours || 0;
      const regularBillRate =
        typeof item.regularBillRate === "string"
          ? parseFloat(item.regularBillRate)
          : item.regularBillRate || 0;
      const overtimeBillRate = item.overtimeBillRate || regularBillRate;
      const totalClientBill = item.regularAmount + item.overtimeAmount;

      const regularPayRate = parseFloat(item.regularPayRate) || 0;
      const premiumPayRate =
        parseFloat(
          item.position?.premiumPayRate || item.premiumPayRate || "0"
        ) || 0;
      const effectivePayRate = regularPayRate + premiumPayRate;
      const overtimePayRateValue =
        item.position?.overtimeEnabled && item.position?.overtimePayRate
          ? parseFloat(item.position.overtimePayRate)
          : effectivePayRate;
      const totalJobseekerPay =
        regularHours * effectivePayRate + overtimeHours * overtimePayRateValue;

      const candidateFullName = item.jobseeker
        ? `${item.jobseeker.firstName || ""} ${item.jobseeker.lastName || ""}`.trim()
        : "";

      const jobseekerProfileData =
        item.jobseeker && candidateFullName
          ? {
              firstName: item.jobseeker.firstName,
              lastName: item.jobseeker.lastName,
              email: item.jobseeker.email,
              jobseekerUserId: item.jobseeker.candidateId,
              jobseekerProfileId: item.jobseeker.id,
              employeeId: item.jobseeker.employeeId,
            }
          : undefined;

      const positionData =
        item.position &&
        item.position.positionCode !== "CUSTOM" &&
        item.position.title?.trim()
          ? {
              title: item.position.title.trim(),
              positionCode: item.position.positionCode ?? "",
              positionId: item.position.id,
              positionCandidateAssignmentsId:
                item.jobseeker?.positionCandidateAssignmentsId,
              positionNumber: item.position.positionNumber,
            }
          : undefined;

      return {
        id: item.id,
        invoiceNumber: invoiceNumber,
        weekStartDate: timesheetStartDate || invoiceDate,
        weekEndDate: timesheetEndDate || dueDate,
        totalRegularHours: regularHours,
        totalOvertimeHours: overtimeHours,
        regularBillRate: regularBillRate,
        overtimeBillRate: overtimeBillRate,
        regularPayRate: regularPayRate,
        overtimePayRate: overtimePayRateValue,
        totalClientBill: totalClientBill,
        totalJobseekerPay: totalJobseekerPay,
        overtimeEnabled: item.position?.overtimeEnabled || false,
        description: item.description, // Add description field
        salesTax: item.salesTax, // Add salesTax field
        jobseekerProfile: jobseekerProfileData,
        position: positionData,
      };
    }),
    attachments: uploadedAttachments,
    supplierPOItems: supplierPOItems,
    messageOnInvoice: messageOnInvoice,
    termsOnInvoice: termsOnInvoice,
    timesheetStartDate: timesheetStartDate || undefined,
    timesheetEndDate: timesheetEndDate || undefined,
    subtotal: subtotal,
    totalTax: totalTax,
    totalHst: totalHST,
    totalGst: totalGST,
    totalQst: totalQST,
    grandTotal: grandTotal,
    totalHours: lineItems.reduce(
      (total, item) => total + (parseFloat(item.hours) || 0),
      0
    ),
    notes: notes,
    emailSent: false,
    emailSentDate: undefined,
    // summary and document are intentionally omitted
  };
}
