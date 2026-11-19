import React from "react";
import { Download, X } from "lucide-react";
import { useLanguage } from "../../contexts/language/language-provider";
import { formatFileSize } from "./supportFormat";

export interface PreviewModalData {
  id: string;
  fileName: string;
  sizeBytes: number;
  url: string;
}

interface SupportThreadPreviewModalProps {
  item: PreviewModalData;
  onClose: () => void;
  onDownloadAttachment: (attachmentId: string) => void;
}

export const SupportThreadPreviewModal: React.FC<
  SupportThreadPreviewModalProps
> = ({ item, onClose, onDownloadAttachment }) => {
  const { t } = useLanguage();

  return (
    <div
      className="support-preview-modal-backdrop"
      onClick={() => onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={t("support.attachments.preview")}
    >
      <div
        className="support-preview-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="support-preview-modal-header">
          <div className="support-preview-modal-title">
            <span className="support-preview-filename" title={item.fileName}>
              {item.fileName}
            </span>
            <span className="support-preview-filesize">
              ({formatFileSize(item.sizeBytes)})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="support-file-preview-btn"
              onClick={() => onDownloadAttachment(item.id)}
              title={t("support.ticket.downloadAttachment")}
            >
              <Download size={14} />
              <span>{t("support.ticket.downloadAttachment")}</span>
            </button>
            <button
              type="button"
              className="support-preview-modal-close"
              onClick={() => onClose()}
              title={t("support.attachments.closePreview")}
              aria-label={t("support.attachments.closePreview")}
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="support-preview-modal-body">
          <img
            src={item.url}
            alt={item.fileName}
            className="support-preview-full-img"
          />
        </div>
      </div>
    </div>
  );
};
