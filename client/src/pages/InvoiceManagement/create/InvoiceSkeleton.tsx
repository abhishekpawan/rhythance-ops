import type { useInvoiceFormState } from "./useInvoiceFormState";

export function InvoiceSkeleton(
  props: Pick<
    ReturnType<typeof useInvoiceFormState>,
    "selectedClient" | "positionLoading"
  >
) {
  const { positionLoading, selectedClient } = props;
  return (
    <>
      {/* Skeleton Loading for Invoice Content */}
      {selectedClient && positionLoading && (
        <div className="invoice-skeleton-container">
          {/* Line Items Skeleton */}
          <div className="invoice-line-items-container">
            <div className="invoice-line-items-header">
              <div
                className="skeleton-text"
                style={{ width: "150px", height: "20px" }}
              ></div>
            </div>
            <div className="invoice-line-items-list">
              <div className="invoice-line-item-group">
                <div className="invoice-line-item-fields">
                  <div className="invoice-field-row single-row">
                    {[1, 2, 3, 4, 5, 6].map((index) => (
                      <div key={index} className="selection-section">
                        <div
                          className="skeleton-text"
                          style={{
                            width: "80px",
                            height: "14px",
                            marginBottom: "8px",
                          }}
                        ></div>
                        <div
                          className="skeleton-text"
                          style={{ width: "100%", height: "40px" }}
                        ></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Supplier/PO and Message Sections Skeleton */}
          <div className="invoice-bottom-sections-container">
            <div className="invoice-line-items-container supplier-po-section">
              <div className="invoice-line-items-header">
                <div
                  className="skeleton-text"
                  style={{ width: "200px", height: "20px" }}
                ></div>
              </div>
              <div className="invoice-line-items-list">
                <div className="invoice-line-item-group">
                  <div className="invoice-line-item-fields">
                    <div className="invoice-field-row single-row">
                      {[1, 2, 3].map((index) => (
                        <div key={index} className="selection-section">
                          <div
                            className="skeleton-text"
                            style={{
                              width: "80px",
                              height: "14px",
                              marginBottom: "8px",
                            }}
                          ></div>
                          <div
                            className="skeleton-text"
                            style={{ width: "100%", height: "40px" }}
                          ></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="invoice-message-terms-container">
              <div className="invoice-line-items-header">
                <div
                  className="skeleton-text"
                  style={{ width: "180px", height: "20px" }}
                ></div>
              </div>
              <div className="message-terms-grid">
                <div className="selection-section">
                  <div
                    className="skeleton-text"
                    style={{
                      width: "120px",
                      height: "14px",
                      marginBottom: "8px",
                    }}
                  ></div>
                  <div
                    className="skeleton-text"
                    style={{ width: "100%", height: "120px" }}
                  ></div>
                </div>
                <div className="selection-section">
                  <div
                    className="skeleton-text"
                    style={{
                      width: "80px",
                      height: "14px",
                      marginBottom: "8px",
                    }}
                  ></div>
                  <div
                    className="skeleton-text"
                    style={{ width: "100%", height: "120px" }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice Calculations Skeleton */}
          <div className="timesheet-invoice-container">
            <div className="timesheet-invoice-table">
              <div className="timesheet-invoice-table-header">
                {[1, 2, 3, 4, 5].map((index) => (
                  <div key={index} className="timesheet-col">
                    <div
                      className="skeleton-text"
                      style={{ width: "80px", height: "14px" }}
                    ></div>
                  </div>
                ))}
              </div>
              <div className="timesheet-invoice-table-body">
                <div className="timesheet-invoice-line-item">
                  {[1, 2, 3, 4, 5].map((index) => (
                    <div key={index} className="timesheet-col">
                      <div
                        className="skeleton-text"
                        style={{
                          width: "90%",
                          height: "16px",
                          marginBottom: "4px",
                        }}
                      ></div>
                      <div
                        className="skeleton-text"
                        style={{ width: "70%", height: "12px" }}
                      ></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="timesheet-invoice-totals">
                {[1, 2, 3, 4].map((index) => (
                  <div key={index} className="timesheet-total-line">
                    <div
                      className="skeleton-text"
                      style={{ width: "100px", height: "14px" }}
                    ></div>
                    <div
                      className="skeleton-text"
                      style={{ width: "80px", height: "14px" }}
                    ></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Attachments Skeleton */}
          <div className="invoice-attachments-section">
            <div
              className="skeleton-text"
              style={{ width: "140px", height: "20px", marginBottom: "16px" }}
            ></div>
            <div
              className="skeleton-text"
              style={{ width: "100%", height: "80px" }}
            ></div>
          </div>

          {/* Generate Button Skeleton */}
          <div className="timesheet-action-section">
            <div className="timesheet-email-option">
              <div
                className="skeleton-text"
                style={{ width: "150px", height: "16px" }}
              ></div>
            </div>
            <div
              className="skeleton-text"
              style={{ width: "140px", height: "40px" }}
            ></div>
          </div>
        </div>
      )}
    </>
  );
}
