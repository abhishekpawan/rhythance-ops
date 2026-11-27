import { formatInvoiceForDisplay } from "../../../services/api/invoice";
import { getClientEmail, getClientDisplayName } from "./invoiceListHelpers";
import { Mail, Eye, Pencil, Trash2 } from "lucide-react";
import type { useInvoiceListState } from "./useInvoiceListState";
import type { useInvoiceListHooks } from "./useInvoiceListHooks";
import type { createListActions } from "./createListActions";

export function InvoiceTableBody(
  props: Pick<
    ReturnType<typeof useInvoiceListState>,
    "loading" | "pagination" | "invoices" | "sendingEmailInvoiceId"
  > &
    Pick<ReturnType<typeof useInvoiceListHooks>, "t"> &
    Pick<
      ReturnType<typeof createListActions>,
      | "sendInvoiceToClient"
      | "handleViewInvoice"
      | "handleEditInvoice"
      | "handleDeleteClick"
    >
) {
  const {
    handleDeleteClick,
    handleEditInvoice,
    handleViewInvoice,
    invoices,
    loading,
    pagination,
    sendInvoiceToClient,
    sendingEmailInvoiceId,
    t,
  } = props;
  return (
    <>
      <tbody>
        {loading ? (
          // Skeleton loading rows
          <>
            {Array.from({ length: pagination.limit || 10 }, (_, index) => (
              <tr key={`skeleton-${index}`} className="skeleton-row">
                {/* Regular columns - using generic skeleton-text */}
                <td className="skeleton-cell">
                  <div className="skeleton-text"></div>
                </td>
                <td className="skeleton-cell">
                  <div className="skeleton-text"></div>
                </td>
                <td className="skeleton-cell">
                  <div className="skeleton-text"></div>
                </td>
                <td className="skeleton-cell">
                  <div className="skeleton-text"></div>
                </td>
                <td className="skeleton-cell">
                  <div className="skeleton-text"></div>
                </td>
                <td className="skeleton-cell">
                  <div className="skeleton-text"></div>
                </td>
                <td className="skeleton-cell">
                  <div className="skeleton-text"></div>
                </td>
                <td className="skeleton-cell">
                  <div className="skeleton-text"></div>
                </td>
                <td className="skeleton-cell">
                  <div className="skeleton-text"></div>
                </td>

                {/* Actions skeleton - needs special styling */}
                <td className="skeleton-cell">
                  <div className="skeleton-actions">
                    <div className="skeleton-icon skeleton-action-btn"></div>
                    <div className="skeleton-icon skeleton-action-btn"></div>
                    <div className="skeleton-icon skeleton-action-btn"></div>
                  </div>
                </td>
              </tr>
            ))}
          </>
        ) : invoices.length === 0 ? (
          <tr>
            <td colSpan={10} className="empty-state-cell">
              <div className="empty-state">
                <p>{t("invoiceManagement.list.noInvoicesMatch")}</p>
              </div>
            </td>
          </tr>
        ) : (
          invoices.map((invoice) => {
            const formatted = formatInvoiceForDisplay(invoice);
            const clientEmail =
              invoice.invoice_sent_to || getClientEmail(invoice.client);
            const isCurrentlySending = sendingEmailInvoiceId === invoice.id;
            const hasEmail = !!clientEmail;

            return (
              <tr key={String(invoice.id)}>
                <td className="invoice-number-cell">
                  # {invoice.invoiceNumber}
                </td>
                <td className="client-cell">
                  {getClientDisplayName(invoice.client, t)}
                </td>
                <td className="client-email-cell">
                  {getClientEmail(invoice.client)}
                </td>
                <td className="date-cell" style={{ textAlign: "center" }}>
                  {formatted.formattedInvoiceDate}
                </td>
                <td className="date-cell" style={{ textAlign: "center" }}>
                  {formatted.formattedDueDate}
                </td>
                <td className="terms-cell" style={{ textAlign: "center" }}>
                  {invoice.paymentTerms ||
                    (invoice.invoiceData as any)?.paymentTerms ||
                    (invoice.client as any)?.terms ||
                    "N/A"}
                </td>
                <td
                  className="amount-cell"
                  style={{ textAlign: "right", fontWeight: "bold" }}
                >
                  {formatted.formattedGrandTotal}
                </td>
                <td className="email-sent-cell">
                  {invoice.emailSent
                    ? t("invoiceManagement.filters.yes")
                    : t("invoiceManagement.filters.no")}
                </td>
                <td className="send-email-cell">
                  <button
                    className={`button button-xs send-email-cell ${
                      invoice.emailSent ? "resend-email" : "send-email"
                    }`}
                    onClick={() => sendInvoiceToClient(invoice)}
                    disabled={
                      isCurrentlySending ||
                      !hasEmail ||
                      !invoice.documentGenerated
                    }
                    title={
                      !hasEmail
                        ? t("invoiceManagement.noEmailAddress")
                        : !invoice.documentGenerated
                          ? t("invoiceManagement.pdfNotGenerated")
                          : invoice.emailSent
                            ? t("invoiceManagement.list.sendAgainTo", {
                                email: clientEmail,
                              })
                            : t("invoiceManagement.list.sendTo", {
                                email: clientEmail,
                              })
                    }
                  >
                    {isCurrentlySending ? (
                      <>
                        <Mail size={14} className="mail-icon" />{" "}
                        {t("invoiceManagement.sending")}
                      </>
                    ) : invoice.emailSent ? (
                      <>
                        <Mail size={14} className="mail-icon" />{" "}
                        {t("invoiceManagement.list.resend")}
                      </>
                    ) : (
                      <>
                        <Mail size={14} className="mail-icon" />{" "}
                        {t("invoiceManagement.list.sendEmail")}
                      </>
                    )}
                  </button>
                </td>
                <td className="actions-cell">
                  <div className="action-buttons">
                    <button
                      className="action-icon-btn view-btn"
                      onClick={() => handleViewInvoice(String(invoice.id))}
                      title={t("invoiceManagement.viewInvoice")}
                      aria-label={t("invoiceManagement.viewInvoice")}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      className="action-icon-btn edit-btn"
                      onClick={() => handleEditInvoice(String(invoice.id))}
                      title={t("invoiceManagement.editInvoiceDetails")}
                      aria-label={t("invoiceManagement.editInvoice")}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="action-icon-btn delete-btn"
                      onClick={() => handleDeleteClick(invoice)}
                      title={t("invoiceManagement.deleteInvoice")}
                      aria-label={t("invoiceManagement.deleteInvoice")}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </>
  );
}
