// The request body of "save invoice" when an invoice is being edited, moved out of InvoiceManagement.tsx unchanged
// (R-5s); the page's state it reads is the parameter.
import { calculateLineItemHours } from "./invoiceCalculations";
import { jobseekerPayOf, overtimeBillRateOf } from "./invoiceLineRates";
import type { UpdateInvoiceInput } from "./invoiceBodyTypes";

export function buildUpdateInvoiceData(input: UpdateInvoiceInput) {
  const {
    selectedClient,
    invoiceNumber,
    invoiceDate,
    dueDate,
    selectedTerms,
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
    clientId: selectedClient.id!,
    invoiceDate: invoiceDate,
    dueDate: dueDate,
    status: "draft" as const,
    currency: selectedClient.currency || "CAD",
    paymentTerms: selectedTerms,
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
    invoiceData: {
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
      timesheets: lineItems.map((item) => {
        const totalHours = parseFloat(item.hours) || 0;
        const { regularHours, overtimeHours } = calculateLineItemHours(
          totalHours,
          item.position
        );

        const regularBillRate = parseFloat(item.regularBillRate) || 0;
        const overtimeBillRate = overtimeBillRateOf(
          item.position,
          regularBillRate
        );

        const regularAmount = regularHours * regularBillRate;
        const overtimeAmount = overtimeHours * overtimeBillRate;
        const totalClientBill = regularAmount + overtimeAmount;

        const regularPayRate = parseFloat(item.regularPayRate) || 0;
        const premiumPayRate =
          parseFloat(item.position?.premiumPayRate || "0") || 0;
        const { overtimePayRate, totalJobseekerPay } = jobseekerPayOf(
          item.position,
          regularHours,
          overtimeHours,
          regularPayRate,
          premiumPayRate
        );

        const positionData =
          item.position &&
          item.position.positionCode !== "CUSTOM" &&
          item.position.title?.trim()
            ? {
                title: item.position.title.trim(),
                positionId: item.position.id,
                positionCode: item.position.positionCode,
                positionCandidateAssignmentsId:
                  item.jobseeker?.positionCandidateAssignmentsId,
                positionNumber: item.position.positionNumber,
              }
            : undefined;

        const candidateFullName = item.jobseeker
          ? `${item.jobseeker.firstName || ""} ${item.jobseeker.lastName || ""}`.trim()
          : "";

        const jobseekerData =
          item.jobseeker && candidateFullName
            ? {
                email: item.jobseeker.email,
                lastName: item.jobseeker.lastName,
                firstName: item.jobseeker.firstName,
                jobseekerUserId: item.jobseeker.candidateId,
                jobseekerProfileId: item.jobseeker.id,
                employeeId: item.jobseeker.employeeId,
              }
            : undefined;

        return {
          id: item.id,
          position: positionData,
          salesTax: item.salesTax,
          description: item.description,
          weekEndDate: timesheetEndDate || dueDate,
          invoiceNumber: invoiceNumber,
          weekStartDate: timesheetStartDate || invoiceDate,
          regularBillRate: regularBillRate,
          overtimeBillRate: overtimeBillRate,
          regularPayRate: regularPayRate,
          overtimePayRate: overtimePayRate,
          totalClientBill: totalClientBill,
          totalJobseekerPay: totalJobseekerPay,
          totalRegularHours: regularHours,
          totalOvertimeHours: overtimeHours,
          overtimeEnabled: item.position?.overtimeEnabled || false,
          jobseekerProfile: jobseekerData,
        };
      }),
      supplierPOItems: supplierPOItems,
      attachments: uploadedAttachments,
      messageOnInvoice: messageOnInvoice,
      termsOnInvoice: termsOnInvoice,
      paymentTerms: selectedTerms,
      timesheetStartDate: timesheetStartDate || undefined,
      timesheetEndDate: timesheetEndDate || undefined,
      // summary and document are intentionally omitted
    },
  };
}
