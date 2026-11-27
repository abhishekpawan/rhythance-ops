import { useState } from "react";
import { InvoiceData } from "../../../services/api/invoice";
import { ClientData } from "../../../services/api/client";
import type { useInvoiceViewHooks } from "./useInvoiceViewHooks";

export function useInvoiceViewState(
  ctx: ReturnType<typeof useInvoiceViewHooks>
) {
  const { paramId, searchParams } = ctx;
  const invoiceId = paramId || searchParams.get("id");

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [client, setClient] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Email modal state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);
  const [emailInput, setEmailInput] = useState<string>("");
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [emailStatusMessage, setEmailStatusMessage] = useState<string | null>(
    null
  );

  // Signed PDF URL
  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null);
  const [isGeneratingPdfUrl, setIsGeneratingPdfUrl] = useState<boolean>(false);

  return {
    invoiceId,
    invoice,
    setInvoice,
    client,
    setClient,
    loading,
    setLoading,
    error,
    setError,
    isEmailModalOpen,
    setIsEmailModalOpen,
    emailInput,
    setEmailInput,
    isSendingEmail,
    setIsSendingEmail,
    emailStatusMessage,
    setEmailStatusMessage,
    pdfSignedUrl,
    setPdfSignedUrl,
    isGeneratingPdfUrl,
    setIsGeneratingPdfUrl,
  };
}
