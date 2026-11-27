import type { useInvoicePageHooks } from "./useInvoicePageHooks";
import type { useInvoiceFormState } from "./useInvoiceFormState";

export function NotesSection(
  props: Pick<ReturnType<typeof useInvoicePageHooks>, "t"> &
    Pick<ReturnType<typeof useInvoiceFormState>, "notes" | "setNotes">
) {
  const { notes, setNotes, t } = props;
  return (
    <>
      {/* Notes Section */}
      <div className="invoice-notes-section">
        <div className="invoice-line-items-header">
          <h3>{t("invoiceManagement.additionalNotes")}</h3>
        </div>
        <textarea
          className="invoice-textarea invoice-notes-textarea"
          placeholder={t("invoiceManagement.notesPlaceholder")}
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </>
  );
}
