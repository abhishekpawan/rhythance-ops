import { sendInvoiceEmail } from "../../../services/api/invoice";
import type { useInvoiceFormState } from "./useInvoiceFormState";
import type { useInvoicePageHooks } from "./useInvoicePageHooks";

export function createSuccessActions(
  ctx: ReturnType<typeof useInvoiceFormState> &
    ReturnType<typeof useInvoicePageHooks>
) {
  const {
    createdInvoice,
    emailToSend,
    pdfBlobUrl,
    pdfNumPages,
    setIsSendingInvoice,
    setPdfNumPages,
    setPdfPageNumber,
    setPdfScale,
    setSendInvoiceMessage,
    t,
  } = ctx;
  // Add PDF preview state for modal
  const onPdfLoadSuccess = ({ numPages }: { numPages: number }) => {
    setPdfNumPages(numPages);
    setPdfPageNumber(1);
  };
  const goToPrevPage = () => setPdfPageNumber((prev) => Math.max(prev - 1, 1));
  const goToNextPage = () =>
    setPdfPageNumber((prev) => Math.min(prev + 1, pdfNumPages || 1));
  const zoomIn = () => setPdfScale((prev) => Math.min(prev + 0.1, 2.0));
  const zoomOut = () => setPdfScale((prev) => Math.max(prev - 0.1, 0.5));
  const resetZoom = () => setPdfScale(1.0);

  // Function to send invoice to client
  async function sendInvoiceToClient() {
    if (!createdInvoice?.id || !emailToSend) {
      setSendInvoiceMessage(t("invoiceManagement.missingEmailForSend"));
      return;
    }

    setIsSendingInvoice(true);
    setSendInvoiceMessage("");

    try {
      // Call the new API to send the invoice email
      const response = await sendInvoiceEmail(createdInvoice.id, emailToSend);

      if (response.success) {
        setSendInvoiceMessage(`Invoice sent successfully to ${emailToSend}`);
        // Optionally, you could refetch the invoice or update local state
      } else {
        throw new Error(
          response.message || t("invoiceManagement.sendInvoiceFailed")
        );
      }
    } catch (err) {
      console.error("Error sending invoice:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to send invoice. Please try again.";
      setSendInvoiceMessage(errorMessage);
    } finally {
      setIsSendingInvoice(false);
    }
  }

  // Add download handler for invoice PDF
  function handleDownloadInvoice() {
    if (!pdfBlobUrl || !createdInvoice?.invoiceNumber) return;
    const link = document.createElement("a");
    link.href = pdfBlobUrl;
    link.download = `Invoice_${createdInvoice.invoiceNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return {
    onPdfLoadSuccess,
    goToPrevPage,
    goToNextPage,
    zoomIn,
    zoomOut,
    resetZoom,
    sendInvoiceToClient,
    handleDownloadInvoice,
  };
}
