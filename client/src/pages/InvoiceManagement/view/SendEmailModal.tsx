import { Loader2, Mail } from "lucide-react";
import type { useInvoiceViewState } from "./useInvoiceViewState";
import type { createInvoiceViewActions } from "./createInvoiceViewActions";

export function SendEmailModal(
  props: Pick<
    ReturnType<typeof useInvoiceViewState>,
    | "isEmailModalOpen"
    | "emailInput"
    | "setEmailInput"
    | "emailStatusMessage"
    | "setIsEmailModalOpen"
    | "isSendingEmail"
  > & {
    invoice: NonNullable<ReturnType<typeof useInvoiceViewState>["invoice"]>;
  } & Pick<ReturnType<typeof createInvoiceViewActions>, "handleSendEmailSubmit">
) {
  const {
    emailInput,
    emailStatusMessage,
    handleSendEmailSubmit,
    invoice,
    isEmailModalOpen,
    isSendingEmail,
    setEmailInput,
    setIsEmailModalOpen,
  } = props;
  return (
    <>
      {/* Send Email Modal */}
      {isEmailModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "var(--card, #ffffff)",
              color: "var(--text)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "480px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              border: "1px solid var(--border)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "16px" }}>
              Send Invoice Email
            </h3>
            <p
              style={{
                color: "var(--text-muted)",
                fontSize: "0.875rem",
                marginBottom: "16px",
              }}
            >
              Specify the recipient email address to deliver Invoice #
              {invoice.invoiceNumber}.
            </p>
            <div style={{ marginBottom: "16px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  marginBottom: "6px",
                }}
              >
                Recipient Email
              </label>
              <input
                type="email"
                className="input"
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                }}
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="client@example.com"
              />
            </div>

            {emailStatusMessage && (
              <div
                style={{
                  padding: "10px",
                  borderRadius: "6px",
                  fontSize: "0.875rem",
                  marginBottom: "16px",
                  backgroundColor: emailStatusMessage.includes("successfully")
                    ? "rgba(34, 197, 94, 0.15)"
                    : "rgba(239, 68, 68, 0.15)",
                  color: emailStatusMessage.includes("successfully")
                    ? "#16a34a"
                    : "#dc2626",
                }}
              >
                {emailStatusMessage}
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                className="button secondary"
                onClick={() => setIsEmailModalOpen(false)}
                disabled={isSendingEmail}
              >
                Cancel
              </button>
              <button
                className="button primary button-icon"
                onClick={handleSendEmailSubmit}
                disabled={isSendingEmail || !emailInput.trim()}
              >
                {isSendingEmail ? (
                  <>
                    <Loader2 size={16} className="timesheet-loading-spinner" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail size={16} />
                    Send Invoice
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
