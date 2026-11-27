import { Paperclip } from "lucide-react";
import type { createInvoiceViewData } from "./createInvoiceViewData";

export function AttachmentsCard(
  props: Pick<ReturnType<typeof createInvoiceViewData>, "attachments">
) {
  const { attachments } = props;
  return (
    <>
      {/* Attachments Card (if present) */}
      {attachments.length > 0 && (
        <div className="invoice-view-card">
          <div className="invoice-view-card-header">
            <h2 className="invoice-view-card-title">
              <Paperclip size={18} /> Attachments ({attachments.length})
            </h2>
          </div>
          <ul style={{ paddingLeft: "0", listStyle: "none", margin: 0 }}>
            {attachments.map((att, idx) => (
              <li
                key={att.id || idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <Paperclip size={16} color="var(--text-muted)" />
                <span
                  style={{
                    fontSize: "0.875rem",
                    flex: 1,
                    wordBreak: "break-all",
                  }}
                >
                  {att.fileName || "Attachment"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
