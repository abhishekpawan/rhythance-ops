import { calculateLineItemTotals } from "../invoiceCalculations";
import { buildUpdateInvoiceData } from "../invoiceUpdateBody";
import { buildCreateInvoiceData } from "../invoiceCreateBody";
import {
  updateInvoice,
  createInvoiceFromFrontendData,
  updateInvoiceDocument,
} from "../../../services/api/invoice";
import {
  InvoiceData as PDFInvoiceData,
  loadPdfMaker,
} from "../../../utils/loadPdfMaker";
import { buildInvoicePdfData } from "../invoicePdfData";
import { supabase } from "../../../lib/supabaseClient";
import type { useInvoiceFormState } from "./useInvoiceFormState";
import type { useInvoicePageHooks } from "./useInvoicePageHooks";
import type { createAttachmentUploader } from "./createAttachmentUploader";

export function createInvoiceSubmit(
  ctx: ReturnType<typeof useInvoiceFormState> &
    ReturnType<typeof useInvoicePageHooks> &
    ReturnType<typeof createAttachmentUploader>
) {
  const {
    attachments,
    dueDate,
    editingInvoiceId,
    invoiceDate,
    invoiceNumber,
    isEditMode,
    lineItems,
    messageOnInvoice,
    notes,
    portalSettings,
    portalSettingsReady,
    selectedClient,
    selectedTerms,
    setCreatedInvoice,
    setEmailToSend,
    setGenerationError,
    setGenerationMessage,
    setIsGeneratingInvoice,
    setPdfBlobUrl,
    setShowInvoiceSuccessModal,
    supplierPOItems,
    t,
    termsOnInvoice,
    timesheetEndDate,
    timesheetStartDate,
    uploadAttachments,
    user,
  } = ctx;
  // Generate/Update invoice function
  const handleInvoiceSubmit = async () => {
    if (!selectedClient || lineItems.length === 0) {
      setGenerationError(t("invoiceManagement.missingClientAndLineItems"));
      return;
    }

    if (!invoiceNumber) {
      setGenerationError(t("invoiceManagement.missingInvoiceNumber"));
      return;
    }

    // The invoice header uses this portal's company details (portal settings). Check
    // before anything is created so an invoice is never issued with the wrong ones.
    if (!portalSettingsReady || !portalSettings["company.name"]) {
      setGenerationError(t("invoiceManagement.companyDetailsNotLoaded"));
      return;
    }

    // Check if at least one line item has hours > 0
    const hasValidLineItems = lineItems.some(
      (item) =>
        parseFloat(item.hours) > 0 && parseFloat(item.regularBillRate) > 0
    );

    if (!hasValidLineItems) {
      setGenerationError(t("invoiceManagement.lineItemNeedsHoursAndRate"));
      return;
    }

    const missingFields = [];
    if (!selectedClient.id)
      missingFields.push(t("invoiceManagement.clientFieldId"));
    if (!selectedClient.companyName)
      missingFields.push(t("invoiceManagement.clientFieldCompanyName"));
    if (!selectedClient.shortCode)
      missingFields.push(t("invoiceManagement.clientFieldShortCode"));
    if (!selectedClient.emailAddress1)
      missingFields.push(t("invoiceManagement.clientFieldEmail"));

    if (missingFields.length > 0) {
      const errorMessage = t("invoiceManagement.clientMissingInfo", {
        fields: missingFields.join(", "),
      });
      setGenerationError(errorMessage);
      return;
    }

    // Check for attachment upload status before proceeding
    if (attachments.some((att) => att.uploadStatus === "uploading")) {
      setGenerationError(t("invoiceManagement.attachmentsStillUploading"));
      return;
    }
    if (attachments.some((att) => att.uploadStatus === "error")) {
      setGenerationError(
        t(
          isEditMode
            ? "invoiceManagement.attachmentsFailedBeforeUpdate"
            : "invoiceManagement.attachmentsFailedBeforeGenerate"
        )
      );
      return;
    }
    setIsGeneratingInvoice(true);
    setGenerationMessage("");
    setGenerationError("");

    try {
      if (!user || !user.id) {
        setGenerationError(t("invoiceManagement.userNotAuthenticated"));
        return;
      }
      // Calculate totals for the invoice
      const {
        lineItemTotals,
        subtotal,
        totalTax,
        totalHST,
        totalGST,
        totalQST,
        grandTotal,
      } = calculateLineItemTotals(lineItems);

      // Upload attachments after PDF generation succeeds
      const uploadedAttachments = await uploadAttachments();

      let result;
      let pdfInvoiceId: string;
      let pdfInvoiceNumber: string;

      if (isEditMode && editingInvoiceId) {
        // Update existing invoice
        const updateData = buildUpdateInvoiceData({
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
        });

        result = await updateInvoice(editingInvoiceId, updateData);
        pdfInvoiceId = editingInvoiceId;
        pdfInvoiceNumber = invoiceNumber;
      } else {
        // Create new invoice
        const invoiceApiData = buildCreateInvoiceData({
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
        });

        // Call the API to create the invoice
        result = await createInvoiceFromFrontendData(invoiceApiData);
        pdfInvoiceId = result.invoice.id || "";
        pdfInvoiceNumber = result.invoice.invoiceNumber || "";
      }

      // Generate the PDF Blob
      const { lineItemTotals: pdfLineItemTotals } =
        calculateLineItemTotals(lineItems);

      const pdfData: PDFInvoiceData = buildInvoicePdfData({
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
      });
      const { generateInvoicePDF: generatePDF } = await loadPdfMaker();
      const pdfBlob = await generatePDF(pdfData);
      const pdfObjectUrl = URL.createObjectURL(pdfBlob);
      setPdfBlobUrl(pdfObjectUrl);

      // Upload PDF to Supabase Storage
      const safeCompanyName = selectedClient.companyName
        ? selectedClient.companyName.replace(/\s+/g, "_")
        : "";
      const pdfFileName = `Invoice_${pdfInvoiceNumber}_${safeCompanyName}.pdf`;
      const pdfPath = `${user.id}/${pdfInvoiceNumber}/documents/${pdfFileName}`;
      const { data: pdfUploadData, error: pdfUploadError } =
        await supabase.storage.from("invoices").upload(pdfPath, pdfBlob, {
          cacheControl: "3600",
          upsert: true,
          contentType: "application/pdf",
        });
      if (pdfUploadError || !pdfUploadData || !pdfUploadData.path) {
        setGenerationError(t("invoiceManagement.pdfUploadFailed"));
        return;
      }

      // Update invoice record with PDF metadata (document PATCH route)
      await updateInvoiceDocument(pdfInvoiceId, {
        documentPath: pdfUploadData.path || "",
        documentFileName: pdfFileName,
        documentFileSize: pdfBlob.size,
        documentGeneratedAt: new Date().toISOString(),
        documentGenerated: true,
        documentMimeType: "application/pdf",
      });

      // Only use the new message for PDF upload success
      const message = t(
        isEditMode
          ? "invoiceManagement.invoiceUpdatedPdfUploaded"
          : "invoiceManagement.invoiceCreatedPdfUploaded",
        { number: pdfInvoiceNumber, client: selectedClient.companyName ?? "" }
      );
      setGenerationMessage(message);

      // Set created invoice and email states after successful invoice creation/upload
      setCreatedInvoice(result.invoice);
      const emailToSet =
        result.invoice.invoice_sent_to ||
        result.invoice.client?.emailAddress1 ||
        selectedClient?.emailAddress1 ||
        "";
      setEmailToSend(emailToSet);
      setShowInvoiceSuccessModal(true);
    } catch (error) {
      console.error(
        "Error " + (isEditMode ? "updating" : "creating") + " invoice:",
        error
      );
      setGenerationError(
        error instanceof Error
          ? error.message
          : isEditMode
            ? t("invoiceManagement.updateInvoiceFailed")
            : t("invoiceManagement.createInvoiceFailed")
      );
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  return { handleInvoiceSubmit };
}
