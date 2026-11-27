import { getInvoice } from "../../../services/api/invoice";
import { extractTimesheetDateRange } from "../invoiceDateRange";
import { getClient } from "../../../services/api/client";
import {
  InvoiceLineItem,
  TimesheetData,
  AssignedJobseeker,
  SupplierPOItem,
} from "../invoiceTypes";
import { PositionData } from "../../../services/api/position";
import { AttachmentFile } from "../../../components/InvoiceAttachments";
import type { useInvoiceFormState } from "./useInvoiceFormState";
import type { createInvoiceLoaders } from "./createInvoiceLoaders";

export function createInvoiceEditLoader(
  ctx: ReturnType<typeof useInvoiceFormState> &
    ReturnType<typeof createInvoiceLoaders>
) {
  const {
    fetchClientPositions,
    positions,
    setAttachments,
    setDueDate,
    setInvoiceDate,
    setInvoiceNumber,
    setLineItems,
    setLoadedInvoice,
    setMessageOnInvoice,
    setNotes,
    setSelectedClient,
    setSelectedTerms,
    setSupplierPOItems,
    setTermsOnInvoice,
    setTimesheetEndDate,
    setTimesheetStartDate,
  } = ctx;
  // Fetch existing invoice data for editing
  const fetchInvoiceForEdit = async (invoiceId: string) => {
    try {
      const invoiceData = await getInvoice(invoiceId);

      // Populate form with existing data
      setInvoiceNumber(invoiceData.invoiceNumber || "");
      setInvoiceDate(invoiceData.invoiceDate);
      setDueDate(invoiceData.dueDate);
      setMessageOnInvoice(
        (invoiceData.invoiceData?.messageOnInvoice as string) || ""
      );
      setTermsOnInvoice(
        (invoiceData.invoiceData?.termsOnInvoice as string) || ""
      );
      setNotes(invoiceData.notes || "");

      // Populate timesheet date range
      const { startDate: extractedStart, endDate: extractedEnd } =
        extractTimesheetDateRange(invoiceData);
      setTimesheetStartDate(extractedStart);
      setTimesheetEndDate(extractedEnd);

      // Set client data
      if (invoiceData.clientId) {
        const clientData = await getClient(invoiceData.clientId);

        setSelectedClient(clientData);

        // Prefer paymentTerms from invoiceData.invoiceData if present
        if (invoiceData.invoiceData?.paymentTerms) {
          setSelectedTerms(invoiceData.invoiceData.paymentTerms as string);
        } else {
          setSelectedTerms(clientData.terms || "Net 30");
        }

        // Fetch positions for this client
        await fetchClientPositions(invoiceData.clientId);
      }

      // Set line items from invoiceData.invoiceData.timesheets (not lineItems)
      if (
        invoiceData.invoiceData?.timesheets &&
        Array.isArray(invoiceData.invoiceData.timesheets)
      ) {
        const mappedLineItems: InvoiceLineItem[] = (
          invoiceData.invoiceData.timesheets as TimesheetData[]
        ).map((timesheet: TimesheetData) => {
          const totalRegularHours = timesheet.totalRegularHours || 0;
          const totalOvertimeHours = timesheet.totalOvertimeHours || 0;
          const totalHours = totalRegularHours + totalOvertimeHours;

          // Map position data with overtime information
          // Try to find the full position data from fetched positions, otherwise use timesheet data
          let position: PositionData | null = null;
          if (
            timesheet.position &&
            timesheet.position.positionCode !== "CUSTOM" &&
            timesheet.position.positionId &&
            timesheet.position.title?.trim()
          ) {
            const fetchedPosition = positions.find(
              (p) => p.id === timesheet.position?.positionId
            );
            if (fetchedPosition) {
              // Use fetched position data which has complete overtime information
              position = fetchedPosition;
            } else {
              // Fallback to timesheet position data only if it is a real position with an ID
              position = {
                id: timesheet.position.positionId,
                positionCode: timesheet.position.positionCode,
                title: timesheet.position.title,
                regularPayRate: timesheet.regularPayRate.toString(),
                premiumPayRate: (timesheet.premiumPayRate || 0).toString(),
                billRate: timesheet.regularBillRate.toString(),
                markup: "0",
                positionNumber: timesheet.position.positionNumber,
                overtimeEnabled: timesheet.overtimeEnabled || false,
                overtimeBillRate: timesheet.overtimeBillRate?.toString(),
                overtimePayRate: timesheet.overtimePayRate?.toString(),
              };
            }
          }

          // Map jobseeker data
          const rawJobseekerName = timesheet.jobseekerProfile
            ? `${timesheet.jobseekerProfile.firstName || ""} ${timesheet.jobseekerProfile.lastName || ""}`.trim()
            : "";

          const jobseeker: AssignedJobseeker | null =
            rawJobseekerName &&
            timesheet.jobseekerProfile &&
            timesheet.jobseekerProfile.jobseekerProfileId
              ? {
                  id: timesheet.jobseekerProfile.jobseekerProfileId,
                  positionCandidateAssignmentsId:
                    timesheet.position?.positionCandidateAssignmentsId,
                  candidateId: timesheet.jobseekerProfile.jobseekerUserId || "",
                  firstName: timesheet.jobseekerProfile.firstName,
                  lastName: timesheet.jobseekerProfile.lastName,
                  email: timesheet.jobseekerProfile.email,
                  mobile: "",
                  status: "active",
                  startDate: "",
                  endDate: "",
                  employeeId: timesheet.jobseekerProfile.employeeId,
                }
              : null;

          return {
            id:
              timesheet.id ||
              Date.now().toString() + Math.random().toString(36).substr(2, 9),
            position: position,
            jobseeker: jobseeker,
            description: timesheet.description || "",
            hours: totalHours.toString(),
            regularBillRate: timesheet.regularBillRate.toString(),
            regularPayRate: timesheet.regularPayRate.toString(),
            premiumPayRate: (timesheet.premiumPayRate || 0).toString(),
            salesTax: timesheet.salesTax || "13.00% [ON]",
            totalRegularHours: totalRegularHours,
            totalOvertimeHours: totalOvertimeHours,
          };
        });
        setLineItems(mappedLineItems);

        // All jobseekers are already fetched, no need to fetch per position
      }

      // Set supplier PO items from invoiceData.invoiceData
      if (
        invoiceData.invoiceData?.supplierPOItems &&
        Array.isArray(invoiceData.invoiceData.supplierPOItems)
      ) {
        setSupplierPOItems(
          invoiceData.invoiceData.supplierPOItems as SupplierPOItem[]
        );
      }

      // Set attachments from invoiceData.invoiceData
      if (
        invoiceData.invoiceData?.attachments &&
        Array.isArray(invoiceData.invoiceData.attachments)
      ) {
        const attachmentFiles: AttachmentFile[] =
          invoiceData.invoiceData.attachments.map((att) => ({
            id:
              att.id ||
              Date.now().toString() + Math.random().toString(36).substr(2, 9),
            fileName: att.fileName || att.name || "Unknown file",
            fileSize: att.fileSize || att.size || 0,
            fileType: att.fileType || att.type || "application/octet-stream",
            filePath: att.filePath || att.url,
            isUploaded: true,
            uploadStatus: "uploaded" as const,
          }));
        setAttachments(attachmentFiles);
      }

      // Set loaded invoice state
      setLoadedInvoice(invoiceData);
    } catch (error) {
      console.error("Error fetching invoice for edit:", error);
      alert("Failed to load invoice data for editing");
    }
  };

  return { fetchInvoiceForEdit };
}
