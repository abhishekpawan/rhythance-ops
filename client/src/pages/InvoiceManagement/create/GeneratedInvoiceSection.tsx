import { supabase } from "../../../lib/supabaseClient";
import { FileText, CheckCircle, Eye, Download } from "lucide-react";
import type { useInvoiceFormState } from "./useInvoiceFormState";
import type { useInvoicePageHooks } from "./useInvoicePageHooks";

export function GeneratedInvoiceSection(
  props: Pick<
    ReturnType<typeof useInvoiceFormState>,
    "isEditMode" | "documentPath" | "documentFileName" | "documentFileSize"
  > &
    Pick<ReturnType<typeof useInvoicePageHooks>, "t">
) {
  const { documentFileName, documentFileSize, documentPath, isEditMode, t } =
    props;
  return (
    <>
      {/* Generated Invoice Section (view/edit mode only) */}
      {isEditMode && documentPath && documentFileName && (
        <div className="attachment-list">
          <div className="attachment-item generated-invoice-item">
            <div className="attachment-thumbnail">
              <div
                className="attachment-file-placeholder"
                onClick={async () => {
                  const { data } = await supabase.storage
                    .from("invoices")
                    .createSignedUrl(documentPath.replace(/&#x2F;/g, "/"), 300);
                  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                }}
              >
                <FileText size={16} />
                <span className="attachment-file-type">
                  {documentFileName.split(".").pop()?.toUpperCase() || "PDF"}
                </span>
              </div>
            </div>
            <div className="attachment-info">
              <div className="attachment-name" title={documentFileName}>
                <FileText size={16} />
                <span>{documentFileName}</span>
              </div>
              <div className="attachment-details">
                <span className="attachment-size">
                  {documentFileSize
                    ? `${(documentFileSize / 1024 / 1024).toFixed(2)} MB`
                    : ""}
                </span>
                <div className="attachment-status uploaded">
                  <CheckCircle size={14} />
                  <span>{t("invoiceManagement.generated")}</span>
                </div>
              </div>
            </div>
            <div className="attachment-actions">
              <button
                type="button"
                className="attachment-action-btn preview"
                onClick={async () => {
                  const { data } = await supabase.storage
                    .from("invoices")
                    .createSignedUrl(documentPath.replace(/&#x2F;/g, "/"), 300);
                  if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                }}
                title={t("invoiceManagement.preview")}
              >
                <Eye size={16} />
              </button>
              <button
                type="button"
                className="attachment-action-btn download"
                onClick={async () => {
                  const { data } = await supabase.storage
                    .from("invoices")
                    .createSignedUrl(documentPath.replace(/&#x2F;/g, "/"), 300);
                  if (data?.signedUrl) {
                    const a = document.createElement("a");
                    a.href = data.signedUrl;
                    a.download = documentFileName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }
                }}
                title={t("invoiceManagement.download")}
              >
                <Download size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
