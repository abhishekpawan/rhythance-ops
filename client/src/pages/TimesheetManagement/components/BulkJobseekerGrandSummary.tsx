import { useMemo } from "react";
import type { BulkJsRows, BulkJsT, BulkJsTf } from "./bulkJobseekerTypes";

interface BulkJobseekerGrandSummaryProps {
  t: BulkJsT;
  tf: BulkJsTf;
  rows: BulkJsRows;
}

/** The totals of every position row. */
export function BulkJobseekerGrandSummary({
  t,
  tf,
  rows,
}: BulkJobseekerGrandSummaryProps) {
  const grandTotalRegularHours = rows.reduce(
    (sum, row) =>
      sum +
      (!row.position?.isSubcategory ? (row.form?.totalRegularHours ?? 0) : 0),
    0
  );

  const grandTotalOvertimeHours = rows.reduce(
    (sum, row) =>
      sum +
      (!row.position?.isSubcategory ? (row.form?.totalOvertimeHours ?? 0) : 0),
    0
  );

  const grandTotalMiles = rows.reduce((sum, row) => {
    const isMiles =
      row.position?.isSubcategory &&
      String(row.position?.subcategoryPosition || "")
        .toLowerCase()
        .startsWith("miles");
    return sum + (isMiles ? (row.form?.totalRegularHours ?? 0) : 0);
  }, 0);

  const grandTotalPay = rows.reduce(
    (sum, row) => sum + (row.form?.jobseekerPay ?? 0),

    0
  );

  const grandTotalBonus = rows.reduce(
    (sum, row) => sum + (row.form?.bonusAmount ?? 0),

    0
  );

  const grandTotalDeduction = rows.reduce(
    (sum, row) => sum + (row.form?.deductionAmount ?? 0),

    0
  );

  const hasRegularPositions = rows.some(
    (r) => r.position && !r.position.isSubcategory
  );
  const hasMilesPositions = rows.some(
    (r) =>
      r.position?.isSubcategory &&
      String(r.position?.subcategoryPosition || "")
        .toLowerCase()
        .startsWith("miles")
  );
  const hasOtherSubcatPositions = rows.some(
    (r) =>
      r.position?.isSubcategory &&
      !String(r.position?.subcategoryPosition || "")
        .toLowerCase()
        .startsWith("miles")
  );

  const subcatGroups = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      if (
        r.position?.isSubcategory &&
        !String(r.position?.subcategoryPosition || "")
          .toLowerCase()
          .startsWith("miles")
      ) {
        const raw = r.position.subcategoryPosition;
        const label = Array.isArray(raw)
          ? raw[0] || "Units"
          : raw
            ? String(raw)
            : "Units";
        const current = map.get(label) || 0;
        map.set(label, current + (r.form?.totalRegularHours ?? 0));
      }
    });
    return map;
  }, [rows]);

  const finalSummaryUnitHeader = hasRegularPositions
    ? hasMilesPositions || hasOtherSubcatPositions
      ? "HOURS / UNITS"
      : tf("colHours")
    : hasMilesPositions && !hasOtherSubcatPositions
      ? "MILES"
      : hasOtherSubcatPositions
        ? "QTY / UNITS"
        : tf("colHours");

  return (
    <div className="timesheet-invoice-container bulk-jobseeker-grand-summary">
      <div className="timesheet-invoice-table">
        <div className="timesheet-invoice-table-header">
          <div className="timesheet-col-description">
            {t("timesheetForm.finalSummary")}
          </div>

          <div className="timesheet-col-hours">{finalSummaryUnitHeader}</div>

          <div className="timesheet-col-rate">
            {t("bulkJobseekerTimesheetManagement.summary.variousRates")}
          </div>

          <div className="timesheet-col-amount">{tf("amount")}</div>
        </div>

        <div className="timesheet-invoice-table-body">
          {(hasRegularPositions ||
            grandTotalRegularHours > 0 ||
            (!hasMilesPositions && !hasOtherSubcatPositions)) && (
            <div className="timesheet-invoice-line-item">
              <div className="timesheet-col-description">
                <div className="timesheet-item-title">
                  {t("timesheetForm.totalRegularHours")}
                </div>
              </div>

              <div className="timesheet-col-hours">
                {grandTotalRegularHours.toFixed(2)}
              </div>

              <div className="timesheet-col-rate">{t("timesheetForm.na")}</div>

              <div className="timesheet-col-amount">
                {t("timesheetForm.na")}
              </div>
            </div>
          )}

          {grandTotalOvertimeHours > 0 ? (
            <div className="timesheet-invoice-line-item">
              <div className="timesheet-col-description">
                <div className="timesheet-item-title">
                  {t("timesheetForm.totalOvertimeHours")}
                </div>
              </div>

              <div className="timesheet-col-hours">
                {grandTotalOvertimeHours.toFixed(2)}
              </div>

              <div className="timesheet-col-rate">{t("timesheetForm.na")}</div>

              <div className="timesheet-col-amount">
                {t("timesheetForm.na")}
              </div>
            </div>
          ) : null}

          {hasMilesPositions || grandTotalMiles > 0 ? (
            <div className="timesheet-invoice-line-item">
              <div className="timesheet-col-description">
                <div className="timesheet-item-title">Total Miles Logged</div>
              </div>

              <div className="timesheet-col-hours">
                {grandTotalMiles.toFixed(2)} mi
              </div>

              <div className="timesheet-col-rate">{t("timesheetForm.na")}</div>

              <div className="timesheet-col-amount">
                {t("timesheetForm.na")}
              </div>
            </div>
          ) : null}

          {Array.from(subcatGroups.entries()).map(([label, total]) => (
            <div className="timesheet-invoice-line-item" key={label}>
              <div className="timesheet-col-description">
                <div className="timesheet-item-title">
                  {`Total Units (${label})`}
                </div>
              </div>

              <div className="timesheet-col-hours">{total.toFixed(2)}</div>

              <div className="timesheet-col-rate">{t("timesheetForm.na")}</div>

              <div className="timesheet-col-amount">
                {t("timesheetForm.na")}
              </div>
            </div>
          ))}
        </div>

        <div className="timesheet-invoice-totals">
          {(hasRegularPositions ||
            grandTotalRegularHours > 0 ||
            (!hasMilesPositions && !hasOtherSubcatPositions)) && (
            <div className="timesheet-total-line">
              <div className="timesheet-total-label">
                {t("timesheetForm.grandTotalHours")}:
              </div>

              <div className="timesheet-total-value">
                {(grandTotalRegularHours + grandTotalOvertimeHours).toFixed(2)}
              </div>
            </div>
          )}

          {hasMilesPositions || grandTotalMiles > 0 ? (
            <div className="timesheet-total-line">
              <div className="timesheet-total-label">Total Miles:</div>

              <div className="timesheet-total-value">
                {grandTotalMiles.toFixed(2)} mi
              </div>
            </div>
          ) : null}

          {Array.from(subcatGroups.entries()).map(([label, total]) => (
            <div className="timesheet-total-line" key={label}>
              <div className="timesheet-total-label">
                {`Total Units (${label}):`}
              </div>

              <div className="timesheet-total-value">{total.toFixed(2)}</div>
            </div>
          ))}

          {grandTotalBonus > 0 ? (
            <div className="timesheet-total-line">
              <div className="timesheet-total-label">
                {t("timesheetForm.grandTotalBonus")}:
              </div>

              <div className="timesheet-total-value">
                +${grandTotalBonus.toFixed(2)}
              </div>
            </div>
          ) : null}

          {grandTotalDeduction > 0 ? (
            <div className="timesheet-total-line">
              <div className="timesheet-total-label">
                {t("timesheetForm.grandTotalDeduction")}:
              </div>

              <div className="timesheet-total-value">
                -${grandTotalDeduction.toFixed(2)}
              </div>
            </div>
          ) : null}

          <div className="timesheet-total-line timesheet-grand-total">
            <div className="timesheet-total-label">
              {t("timesheetForm.grandTotalPay")}:
            </div>

            <div className="timesheet-total-value">
              ${grandTotalPay.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
