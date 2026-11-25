import { Loader } from "../../../components/Loader";
import type { BulkT } from "./bulkClientTypes";

interface BulkGeneratingOverlayProps {
  t: BulkT;
  generationMessage: string;
  currentInvoiceNumber: string | null;
}

/** Full-screen loader while the timesheets are being generated. */
export function BulkGeneratingOverlay({
  t,
  generationMessage,
  currentInvoiceNumber,
}: BulkGeneratingOverlayProps) {
  return (
    <Loader
      variant="fullscreen"
      size="lg"
      message={t("bulkTimesheetManagement.messages.generating")}
    >
      <p className="app-loader-submessage">
        {generationMessage || t("bulkTimesheetManagement.messages.pleaseWait")}
      </p>
      <div className="app-loader-details">
        <p>{t("bulkTimesheetManagement.messages.processingMultiple")}</p>
        <p>{t("bulkTimesheetManagement.messages.generatingInvoices")}</p>
        {currentInvoiceNumber ? (
          <p className="app-loader-highlight">
            {t("bulkTimesheetManagement.messages.currentInvoice")}: #
            {currentInvoiceNumber}
          </p>
        ) : null}
        <p>{t("bulkTimesheetManagement.messages.doNotClose")}</p>
      </div>
    </Loader>
  );
}
