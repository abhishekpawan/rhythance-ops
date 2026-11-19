import React from "react";
import {
  X,
  RefreshCw,
  FileText,
  AlertCircle,
  CheckCircle,
  Eye,
} from "lucide-react";
import { useLanguage } from "../../contexts/language/language-provider";
import { formatFileSize } from "./supportFormat";
import { UploadItem } from "./supportUploadItem";

interface SupportUploadItemRowProps {
  item: UploadItem;
  disabled: boolean;
  onPreview: (item: UploadItem) => void;
  onRetry: (item: UploadItem) => void;
  onRemove: (id: string) => void;
}

export const SupportUploadItemRow: React.FC<SupportUploadItemRowProps> = ({
  item,
  disabled,
  onPreview,
  onRetry,
  onRemove,
}) => {
  const { t } = useLanguage();

  return (
    <div className="support-file-item">
      <div className="support-file-info">
        {item.isImage && item.previewUrl ? (
          <div
            className="support-file-thumb-wrap"
            onClick={() => onPreview(item)}
            title={t("support.attachments.preview")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPreview(item);
              }
            }}
            aria-label={t("support.attachments.preview")}
          >
            <img
              src={item.previewUrl}
              alt={item.file.name}
              className="support-file-thumb-img"
            />
            <div className="support-file-thumb-overlay">
              <Eye size={16} />
            </div>
          </div>
        ) : (
          <div className="support-file-icon-badge">
            <FileText size={20} />
            <span className="support-file-ext-tag">
              {item.file.name.split(".").pop()?.slice(0, 4) || "FILE"}
            </span>
          </div>
        )}

        <div className="support-file-details">
          <div className="support-file-header-line">
            <span className="support-file-name" title={item.file.name}>
              {item.file.name}
            </span>
            <span className="support-file-size">
              ({formatFileSize(item.file.size)})
            </span>
          </div>

          <div className="support-file-meta-line">
            {item.status === "uploading" && (
              <span className="support-file-status uploading flex items-center gap-1">
                <RefreshCw size={12} className="spin" />
                <span>{t("support.attachments.uploading")}</span>
              </span>
            )}
            {item.status === "success" && (
              <span className="support-file-status success flex items-center gap-1">
                <CheckCircle size={13} />
                <span>{t("support.attachments.uploaded")}</span>
              </span>
            )}
            {item.status === "error" && (
              <span className="support-file-status error flex items-center gap-1">
                <AlertCircle size={13} />
                <span>{item.error || t("support.errors.uploadFailed")}</span>
                <button
                  type="button"
                  className="button secondary button-icon"
                  onClick={() => onRetry(item)}
                  title={t("support.attachments.retry")}
                  style={{
                    padding: "1px 6px",
                    fontSize: "11px",
                    height: "auto",
                  }}
                >
                  <RefreshCw size={10} />
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="support-file-actions">
        {item.isImage && item.previewUrl && (
          <button
            type="button"
            className="support-file-preview-btn"
            onClick={() => onPreview(item)}
            title={t("support.attachments.preview")}
            aria-label={t("support.attachments.preview")}
          >
            <Eye size={14} />
          </button>
        )}

        <button
          type="button"
          className="support-file-remove-btn"
          onClick={() => onRemove(item.id)}
          title={t("support.attachments.remove")}
          aria-label={t("support.attachments.remove")}
          disabled={disabled}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
