import { DollarSign } from "lucide-react";
import type { createInvoiceViewData } from "./createInvoiceViewData";

export function LineItemsCard(
  props: Pick<ReturnType<typeof createInvoiceViewData>, "timesheets">
) {
  const { timesheets } = props;
  return (
    <>
      {/* Line Items Table Card */}
      <div className="invoice-view-card">
        <div className="invoice-view-card-header">
          <h2 className="invoice-view-card-title">
            <DollarSign size={18} /> Invoice Line Items ({timesheets.length})
          </h2>
        </div>
        <div className="invoice-table-wrapper">
          {(() => {
            const hasAnyPosition = timesheets.some(
              (item) =>
                item.position &&
                item.position.positionCode !== "CUSTOM" &&
                Boolean(item.position.title?.trim())
            );

            const hasAnyCandidate = timesheets.some((item) => {
              const fullName =
                `${item.jobseekerProfile?.firstName || ""} ${item.jobseekerProfile?.lastName || ""}`.trim();
              return Boolean(fullName);
            });

            const showPositionCandidateCol = hasAnyPosition || hasAnyCandidate;

            return (
              <table className="invoice-view-table">
                <thead>
                  <tr>
                    {showPositionCandidateCol && <th>Position / Candidate</th>}
                    <th>Description</th>
                    <th style={{ textAlign: "center" }}>Hours</th>
                    <th style={{ textAlign: "right" }}>Bill Rate</th>
                    <th style={{ textAlign: "center" }}>Tax Rate</th>
                    <th style={{ textAlign: "right" }}>Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {timesheets.length === 0 ? (
                    <tr>
                      <td
                        colSpan={showPositionCandidateCol ? 6 : 5}
                        style={{
                          textAlign: "center",
                          color: "var(--text-muted)",
                          padding: "24px",
                        }}
                      >
                        No line items available for this invoice.
                      </td>
                    </tr>
                  ) : (
                    timesheets.map((item, idx) => {
                      const regularHours = item.totalRegularHours || 0;
                      const overtimeHours = item.totalOvertimeHours || 0;
                      const totalHours = regularHours + overtimeHours;

                      const billRate =
                        typeof item.regularBillRate === "number"
                          ? item.regularBillRate
                          : parseFloat(item.regularBillRate || "0");

                      const lineTotal =
                        item.totalClientBill || totalHours * billRate;

                      const candidateRaw = item.jobseekerProfile
                        ? `${item.jobseekerProfile.firstName || ""} ${item.jobseekerProfile.lastName || ""}`.trim()
                        : "";

                      const positionTitle =
                        item.position &&
                        item.position.positionCode !== "CUSTOM" &&
                        item.position.title?.trim()
                          ? item.position.title.trim()
                          : "";

                      return (
                        <tr key={item.id || idx}>
                          {showPositionCandidateCol && (
                            <td>
                              {positionTitle && (
                                <div style={{ fontWeight: 600 }}>
                                  {positionTitle}
                                </div>
                              )}
                              {candidateRaw && (
                                <div
                                  style={{
                                    fontSize: "0.8rem",
                                    color: "var(--text-muted)",
                                  }}
                                >
                                  Candidate: {candidateRaw}
                                </div>
                              )}
                            </td>
                          )}
                          <td>{item.description || "—"}</td>
                          <td style={{ textAlign: "center" }}>
                            {totalHours.toFixed(2)} hrs
                            {overtimeHours > 0 && (
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--warning-color, #d97706)",
                                }}
                              >
                                ({overtimeHours.toFixed(2)} OT)
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            ${billRate.toFixed(2)} / hr
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {item.salesTax || "13.00% [ON]"}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>
                            ${lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            );
          })()}
        </div>
      </div>
    </>
  );
}
