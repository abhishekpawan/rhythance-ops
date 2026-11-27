import { useEffect } from "react";
import { getInvoice } from "../../../services/api/invoice";
import { getClient } from "../../../services/api/client";
import type { useInvoiceViewState } from "./useInvoiceViewState";
import type { createInvoiceViewActions } from "./createInvoiceViewActions";

export function useInvoiceViewEffects(
  ctx: ReturnType<typeof useInvoiceViewState> &
    ReturnType<typeof createInvoiceViewActions>
) {
  const {
    fetchSignedPdfUrl,
    invoiceId,
    setClient,
    setEmailInput,
    setError,
    setInvoice,
    setLoading,
  } = ctx;
  useEffect(() => {
    const fetchInvoiceDetails = async () => {
      if (!invoiceId) {
        setError("Invoice ID is missing.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await getInvoice(invoiceId);
        setInvoice(data);

        // Fetch client details if client object not fully attached
        if (data.clientId) {
          try {
            const clientData = await getClient(data.clientId);
            setClient(clientData);
          } catch (clientErr) {
            console.error("Error loading detailed client data:", clientErr);
          }
        }

        // Set default email address for sending
        const recipientEmail =
          data.invoice_sent_to || data.client?.emailAddress1 || "";
        setEmailInput(recipientEmail);

        // Fetch PDF signed URL if document path exists
        if (data.documentPath) {
          fetchSignedPdfUrl(data.documentPath);
        }
      } catch (err) {
        console.error("Error fetching invoice details:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load invoice details"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchInvoiceDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the dependency list is the one the effect had in the page component
  }, [invoiceId]);

  return {};
}
