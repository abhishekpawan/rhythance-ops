import { supabase } from "../../../lib/supabaseClient";
import { sendInvoiceEmail } from "../../../services/api/invoice";
import type { useInvoiceViewState } from "./useInvoiceViewState";

export function createInvoiceViewActions(
  ctx: ReturnType<typeof useInvoiceViewState>
) {
  const {
    emailInput,
    invoice,
    invoiceId,
    pdfSignedUrl,
    setEmailStatusMessage,
    setInvoice,
    setIsEmailModalOpen,
    setIsGeneratingPdfUrl,
    setIsSendingEmail,
    setPdfSignedUrl,
  } = ctx;
  const fetchSignedPdfUrl = async (path: string) => {
    try {
      setIsGeneratingPdfUrl(true);
      const cleanPath = path.replace(/&#x2F;/g, "/");
      const { data, error: storageErr } = await supabase.storage
        .from("invoices")
        .createSignedUrl(cleanPath, 3600); // 1 hour expiration

      if (data?.signedUrl) {
        setPdfSignedUrl(data.signedUrl);
      } else if (storageErr) {
        console.error("Error creating signed URL for invoice PDF:", storageErr);
      }
    } catch (err) {
      console.error("Failed to generate PDF URL:", err);
    } finally {
      setIsGeneratingPdfUrl(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!pdfSignedUrl && invoice?.documentPath) {
      await fetchSignedPdfUrl(invoice.documentPath);
    }

    if (pdfSignedUrl) {
      const a = document.createElement("a");
      a.href = pdfSignedUrl;
      a.download =
        invoice?.documentFileName ||
        `Invoice_${invoice?.invoiceNumber || "document"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleSendEmailSubmit = async () => {
    if (!invoiceId || !emailInput.trim()) return;

    try {
      setIsSendingEmail(true);
      setEmailStatusMessage(null);
      const response = await sendInvoiceEmail(invoiceId, emailInput.trim());

      if (response.success) {
        setEmailStatusMessage(
          `Invoice successfully sent to ${emailInput.trim()}`
        );
        setInvoice((prev) => (prev ? { ...prev, emailSent: true } : prev));
        setTimeout(() => {
          setIsEmailModalOpen(false);
          setEmailStatusMessage(null);
        }, 2000);
      } else {
        throw new Error(response.message || "Failed to send invoice email");
      }
    } catch (err) {
      console.error("Error sending invoice email:", err);
      setEmailStatusMessage(
        err instanceof Error ? err.message : "Failed to send invoice email"
      );
    } finally {
      setIsSendingEmail(false);
    }
  };

  return { fetchSignedPdfUrl, handleDownloadPdf, handleSendEmailSubmit };
}
