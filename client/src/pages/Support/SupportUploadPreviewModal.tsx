import React from "react";
import { X } from "lucide-react";
import { useLanguage } from "../../contexts/language/language-provider";
import { formatFileSize } from "./supportFormat";
import { UploadItem } from "./supportUploadItem";

interface SupportUploadPreviewModalProps {
  item: UploadItem;
  onClose: () => void;
}

export const SupportUploadPreviewModal: React.FC<
  SupportUploadPreviewModalProps
> = ({ item, onClose }) => {
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
            <span className="support-preview-filename" title={item.file.name}>
              {item.file.name}
            </span>
            <span className="support-preview-filesize">
              ({formatFileSize(item.file.size)})
            </span>
          </div>
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
        <div className="support-preview-modal-body">
          <img
            src={item.previewUrl}
            alt={item.file.name}
            className="support-preview-full-img"
          />
        </div>
      </div>
    </div>
  );
};
