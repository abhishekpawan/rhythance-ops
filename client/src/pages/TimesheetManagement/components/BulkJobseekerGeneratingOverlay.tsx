import { Loader } from "../../../components/Loader";
import type { BulkJsT } from "./bulkJobseekerTypes";

interface BulkJobseekerGeneratingOverlayProps {
  t: BulkJsT;
  generationMessage: string;
  currentInvoiceNumber: string | null;
}

/** Full-screen loader while the timesheets are being generated. */
export function BulkJobseekerGeneratingOverlay({
  t,
  generationMessage,
  currentInvoiceNumber,
}: BulkJobseekerGeneratingOverlayProps) {
  return (
    <Loader
      variant="fullscreen"
      size="lg"
      message={t("bulkJobseekerTimesheetManagement.messages.generating")}
    >
      <p className="app-loader-submessage">
        {generationMessage ||
          t("bulkJobseekerTimesheetManagement.messages.pleaseWait")}
      </p>

      <div className="app-loader-details">
        <p>
          {t("bulkJobseekerTimesheetManagement.messages.processingMultiple")}
        </p>

        <p>
          {t("bulkJobseekerTimesheetManagement.messages.generatingInvoices")}
        </p>

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
