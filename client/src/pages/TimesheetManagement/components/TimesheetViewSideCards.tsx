import { Building, DollarSign, MapPin, Receipt, User } from "lucide-react";
import type { TimesheetWithJoins } from "../../../services/types/timesheet";

interface TimesheetViewSideCardsProps {
  timesheet: TimesheetWithJoins;
  profile: TimesheetWithJoins["jobseeker_profiles"];
  position: TimesheetWithJoins["positions"];
  fullName: string;
  positionLocation: string;
}

/** The right column of the timesheet view: jobseeker, client and position, pay and billing. */
export function TimesheetViewSideCards({
  timesheet,
  profile,
  position,
  fullName,
  positionLocation,
}: TimesheetViewSideCardsProps) {
  return (
    <>
      {/* Jobseeker Info Card */}
      <div className="timesheet-view-card">
        <div className="timesheet-view-card-header">
          <h3 className="timesheet-view-card-title">
            <User size={18} /> Jobseeker Details
          </h3>
        </div>
        <div className="timesheet-meta-item" style={{ marginBottom: "1rem" }}>
          <span className="timesheet-meta-label">Full Name</span>
          <span className="timesheet-meta-value">{fullName}</span>
        </div>
        <div className="timesheet-meta-item" style={{ marginBottom: "1rem" }}>
          <span className="timesheet-meta-label">Primary Email</span>
          <span className="timesheet-meta-value">{profile?.email || "-"}</span>
        </div>
        <div className="timesheet-meta-item" style={{ marginBottom: "1rem" }}>
          <span className="timesheet-meta-label">Billing Email</span>
          <span className="timesheet-meta-value">
            {profile?.billing_email || "-"}
          </span>
        </div>
        <div className="timesheet-meta-item" style={{ marginBottom: "1rem" }}>
          <span className="timesheet-meta-label">Payment Method</span>
          <span className="timesheet-meta-value">
            {profile?.payment_method || "-"}
          </span>
        </div>
        {profile?.cash_deduction && (
          <div className="timesheet-meta-item" style={{ marginBottom: "1rem" }}>
            <span className="timesheet-meta-label">Cash Deduction</span>
            <span className="timesheet-meta-value">
              {profile.cash_deduction}%
            </span>
          </div>
        )}
        {profile?.hst_gst && (
          <div className="timesheet-meta-item">
            <span className="timesheet-meta-label">Tax Rate (HST/GST)</span>
            <span className="timesheet-meta-value">{profile.hst_gst}%</span>
          </div>
        )}
      </div>

      {/* Client & Position Details */}
      <div className="timesheet-view-card">
        <div className="timesheet-view-card-header">
          <h3 className="timesheet-view-card-title">
            <Building size={18} /> Client & Position
          </h3>
        </div>
        <div className="timesheet-meta-item" style={{ marginBottom: "1rem" }}>
          <span className="timesheet-meta-label">Client Name</span>
          <span className="timesheet-meta-value">
            {position?.client_name || "-"}
          </span>
        </div>
        <div className="timesheet-meta-item" style={{ marginBottom: "1rem" }}>
          <span className="timesheet-meta-label">Position Title</span>
          <span className="timesheet-meta-value">{position?.title || "-"}</span>
        </div>
        <div className="timesheet-meta-item" style={{ marginBottom: "1rem" }}>
          <span className="timesheet-meta-label">Position Code</span>
          <span className="timesheet-meta-value">
            {position?.position_code || "-"}
          </span>
        </div>
        {positionLocation && (
          <div className="timesheet-meta-item">
            <span className="timesheet-meta-label">Location</span>
            <span
              className="timesheet-meta-value"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <MapPin size={14} /> {positionLocation}
            </span>
          </div>
        )}
      </div>

      {/* Pay & Rates Summary Card */}
      <div className="timesheet-view-card">
        <div className="timesheet-view-card-header">
          <h3 className="timesheet-view-card-title">
            <DollarSign size={18} /> Jobseeker Pay & Rates
          </h3>
        </div>
        <table className="timesheet-pay-summary-table">
          <tbody>
            <tr>
              <td className="timesheet-pay-summary-label">Regular Pay Rate</td>
              <td className="timesheet-pay-summary-value">
                ${timesheet.regular_pay_rate?.toFixed(2)}/hr
              </td>
            </tr>
            {timesheet.premium_pay_rate > 0 && (
              <tr>
                <td className="timesheet-pay-summary-label">Premium Rate</td>
                <td className="timesheet-pay-summary-value">
                  ${timesheet.premium_pay_rate?.toFixed(2)}/hr
                </td>
              </tr>
            )}
            {timesheet.overtime_pay_rate > 0 && (
              <tr>
                <td className="timesheet-pay-summary-label">Overtime Rate</td>
                <td className="timesheet-pay-summary-value">
                  ${timesheet.overtime_pay_rate?.toFixed(2)}/hr
                </td>
              </tr>
            )}
            {Number(timesheet.bonus_amount) > 0 ? (
              <tr>
                <td className="timesheet-pay-summary-label">Bonus</td>
                <td className="timesheet-pay-summary-value">
                  +${Number(timesheet.bonus_amount).toFixed(2)}
                </td>
              </tr>
            ) : null}
            {Number(timesheet.deduction_amount) > 0 ? (
              <tr>
                <td className="timesheet-pay-summary-label">Deduction</td>
                <td className="timesheet-pay-summary-value">
                  -${Number(timesheet.deduction_amount).toFixed(2)}
                </td>
              </tr>
            ) : null}
            {Number(timesheet.tax_amount) > 0 ? (
              <tr>
                <td className="timesheet-pay-summary-label">Tax (HST/GST)</td>
                <td className="timesheet-pay-summary-value">
                  +${Number(timesheet.tax_amount).toFixed(2)}
                </td>
              </tr>
            ) : null}
            <tr className="timesheet-grand-total-row">
              <td
                className="timesheet-pay-summary-label"
                style={{ color: "var(--text)", fontWeight: 700 }}
              >
                Grand Total Pay
              </td>
              <td className="timesheet-pay-summary-value">
                ${timesheet.total_jobseeker_pay?.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Client Billing Summary Card (if bill rates available) */}
      {(timesheet.regular_bill_rate > 0 || timesheet.total_client_bill > 0) && (
        <div className="timesheet-view-card">
          <div className="timesheet-view-card-header">
            <h3 className="timesheet-view-card-title">
              <Receipt size={18} /> Client Billing Summary
            </h3>
          </div>
          <table className="timesheet-pay-summary-table">
            <tbody>
              {timesheet.regular_bill_rate > 0 && (
                <tr>
                  <td className="timesheet-pay-summary-label">
                    Regular Bill Rate
                  </td>
                  <td className="timesheet-pay-summary-value">
                    ${timesheet.regular_bill_rate?.toFixed(2)}/hr
                  </td>
                </tr>
              )}
              {timesheet.overtime_bill_rate > 0 && (
                <tr>
                  <td className="timesheet-pay-summary-label">
                    Overtime Bill Rate
                  </td>
                  <td className="timesheet-pay-summary-value">
                    ${timesheet.overtime_bill_rate?.toFixed(2)}/hr
                  </td>
                </tr>
              )}
              {timesheet.total_client_bill > 0 && (
                <tr className="timesheet-grand-total-row">
                  <td
                    className="timesheet-pay-summary-label"
                    style={{ color: "var(--text)", fontWeight: 700 }}
                  >
                    Total Client Bill
                  </td>
                  <td className="timesheet-pay-summary-value">
                    ${timesheet.total_client_bill?.toFixed(2)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
