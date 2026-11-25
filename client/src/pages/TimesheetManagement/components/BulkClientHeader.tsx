import { formatDate, getWeekEndDate } from "../functions/weekUtils";
import type { BulkSelection, BulkT } from "./bulkClientTypes";

interface BulkClientHeaderProps {
  t: BulkT;
  selectedClient: NonNullable<BulkSelection["selectedClient"]>;
  selectedPosition: BulkSelection["selectedPosition"];
  selectedWeekStart: BulkSelection["selectedWeekStart"];
}

/** Client, position, invoice and period of the week being filled. */
export function BulkClientHeader({
  t,
  selectedClient,
  selectedPosition,
  selectedWeekStart,
}: BulkClientHeaderProps) {
  return (
    <div className="timesheet-unified-header">
      <div className="timesheet-header-sections">
        <div className="timesheet-section timesheet-client-section">
          <h4 className="timesheet-section-title">
            {t("timesheetForm.clientAndPosition")}
          </h4>
          <div className="timesheet-section-content">
            <div className="timesheet-detail-item">
              <span className="timesheet-detail-label">
                {t("timesheetForm.clientName")}:
              </span>
              <span className="timesheet-detail-value">
                {selectedClient.companyName}
              </span>
            </div>
            <div className="timesheet-detail-item">
              <span className="timesheet-detail-label">
                {t("timesheetForm.positionTitle")}:
              </span>
              <span className="timesheet-detail-value">
                {selectedPosition?.title ||
                  t("bulkTimesheetManagement.constants.na")}
              </span>
            </div>
            <div className="timesheet-detail-item">
              <span className="timesheet-detail-label">
                {t("timesheetForm.positionCode")}:
              </span>
              <span className="timesheet-detail-value">
                {selectedPosition?.positionCode ||
                  t("bulkTimesheetManagement.constants.na")}
              </span>
            </div>
            <div className="timesheet-detail-item">
              <span className="timesheet-detail-label">
                {t("timesheetForm.positionNumber")}:
              </span>
              <span className="timesheet-detail-value">
                {selectedPosition?.positionNumber ||
                  t("bulkTimesheetManagement.constants.na")}
              </span>
            </div>
          </div>
        </div>

        <div className="timesheet-section timesheet-invoice-section">
          <h4 className="timesheet-section-title">
            {t("timesheetForm.invoiceAndPeriod")}
          </h4>
          <div className="timesheet-section-content">
            <div className="timesheet-detail-item">
              <span className="timesheet-detail-label">
                {t("timesheetForm.invoiceNumbers")}:
              </span>
              <span className="timesheet-detail-value">
                {t("timesheetForm.generatedIndividually")}
              </span>
            </div>
            <div className="timesheet-detail-item">
              <span className="timesheet-detail-label">
                {t("timesheetForm.period")}:
              </span>
              <span className="timesheet-detail-value">
                {selectedWeekStart ? (
                  <>
                    {formatDate(selectedWeekStart)} -{" "}
                    {formatDate(getWeekEndDate(selectedWeekStart))}
                  </>
                ) : (
                  t("bulkTimesheetManagement.constants.na")
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
