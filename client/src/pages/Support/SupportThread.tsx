import React, { useState, useEffect } from "react";
import { Download, FileText, Eye, RefreshCw, Image as ImageIcon, X } from "lucide-react";
import { useLanguage } from "../../contexts/language/language-provider";
import { getAttachmentDownloadUrl } from "../../services/api/support";
import { SupportMessage, SupportAttachment } from "../../types/support";

interface SupportThreadProps {
  messages: SupportMessage[];
  attachments: SupportAttachment[];
  onDownloadAttachment: (attachmentId: string) => void;
}

interface PreviewModalData {
  id: string;
  fileName: string;
  sizeBytes: number;
  url: string;
}

export const SupportThread: React.FC<SupportThreadProps> = ({
  messages,
  attachments,
  onDownloadAttachment,
}) => {
  const { t } = useLanguage();
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState<Record<string, boolean>>({});
  const [previewModalItem, setPreviewModalItem] = useState<PreviewModalData | null>(null);

  // Close preview modal on ESC key
  useEffect(() => {
    if (!previewModalItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreviewModalItem(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewModalItem]);

  // Preload signed preview URLs for image attachments
  useEffect(() => {
    const imageAttachments = attachments.filter(
      (att) =>
        att.mimeType?.startsWith("image/") ||
        /\.(png|jpe?g|webp|gif)$/i.test(att.fileName)
    );

    imageAttachments.forEach(async (att) => {
      if (imageUrls[att.id] || loadingUrls[att.id]) return;

      setLoadingUrls((prev) => ({ ...prev, [att.id]: true }));
      try {
        const url = await getAttachmentDownloadUrl(att.id);
        setImageUrls((prev) => ({ ...prev, [att.id]: url }));
      } catch (err) {
        console.error("Failed to load image preview url for attachment:", att.id, err);
      } finally {
        setLoadingUrls((prev) => ({ ...prev, [att.id]: false }));
      }
    });
  }, [attachments, imageUrls, loadingUrls]);

  const formatDate = (isoStr?: string | null): string => {
    if (!isoStr) return "—";
    try {
      return new Date(isoStr).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="support-thread">
      {messages.map((msg, index) => {
        const isRequesterMsg = msg.authorKind === "requester";
        const isSystemMsg = msg.authorKind === "system";
        const isInternalMsg = Boolean(msg.isInternal);

        let bubbleClass = "requester";
        if (isSystemMsg) bubbleClass = "system";
        else if (isInternalMsg) bubbleClass = "internal-note";
        else if (!isRequesterMsg) bubbleClass = "support-team";

        // Attachments belonging to this message
        const msgAttachments = attachments.filter(
          (att) => att.messageId === msg.id || (index === 0 && !att.messageId)
        );

        return (
          <div
            key={msg.id || index}
            className={`support-message-bubble ${bubbleClass}`}
          >
            <div className="support-message-header">
              <div className="flex items-center gap-1">
                <span className="support-message-author">
                  {isSystemMsg
                    ? t("support.ticket.systemAuthor")
                    : isRequesterMsg
                    ? msg.authorName || t("support.ticket.requesterAuthor")
                    : t("support.ticket.supportTeamAuthor")}
                </span>
                {isInternalMsg && (
                  <span className="support-internal-badge">
                    {t("support.ticket.internalNoteBadge")}
                  </span>
                )}
              </div>
              <span className="support-message-time">
                {formatDate(msg.createdAt)}
              </span>
            </div>

            <div className="support-message-body">{msg.body}</div>

            {msgAttachments.length > 0 && (
              <div className="support-message-attachments">
                <div className="support-file-list">
                  {msgAttachments.map((att) => {
                    const isImage =
                      att.mimeType?.startsWith("image/") ||
                      /\.(png|jpe?g|webp|gif)$/i.test(att.fileName);
                    const previewUrl = imageUrls[att.id];
                    const isLoading = loadingUrls[att.id];

                    return (
                      <div key={att.id} className="support-file-item">
                        <div className="support-file-info">
                          {isImage ? (
                            <div
                              className="support-file-thumb-wrap"
                              onClick={() => {
                                if (previewUrl) {
                                  setPreviewModalItem({
                                    id: att.id,
                                    fileName: att.fileName,
                                    sizeBytes: att.sizeBytes,
                                    url: previewUrl,
                                  });
                                } else {
                                  onDownloadAttachment(att.id);
                                }
                              }}
                              title={t("support.attachments.preview")}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  if (previewUrl) {
                                    setPreviewModalItem({
                                      id: att.id,
                                      fileName: att.fileName,
                                      sizeBytes: att.sizeBytes,
                                      url: previewUrl,
                                    });
                                  } else {
                                    onDownloadAttachment(att.id);
                                  }
                                }
                              }}
                              aria-label={t("support.attachments.preview")}
                            >
                              {previewUrl ? (
                                <img
                                  src={previewUrl}
                                  alt={att.fileName}
                                  className="support-file-thumb-img"
                                />
                              ) : isLoading ? (
                                <RefreshCw size={14} className="spin text-muted" />
                              ) : (
                                <ImageIcon size={20} className="text-muted" />
                              )}
                              {previewUrl && (
                                <div className="support-file-thumb-overlay">
                                  <Eye size={16} />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="support-file-icon-badge">
                              <FileText size={20} />
                              <span className="support-file-ext-tag">
                                {att.fileName.split(".").pop()?.slice(0, 4) || "FILE"}
                              </span>
                            </div>
                          )}

                          <div className="support-file-details">
                            <div className="support-file-header-line">
                              <span className="support-file-name" title={att.fileName}>
                                {att.fileName}
                              </span>
                              <span className="support-file-size">
                                ({formatFileSize(att.sizeBytes)})
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="support-file-actions">
                          {isImage && previewUrl && (
                            <button
                              type="button"
                              className="support-file-preview-btn"
                              onClick={() =>
                                setPreviewModalItem({
                                  id: att.id,
                                  fileName: att.fileName,
                                  sizeBytes: att.sizeBytes,
                                  url: previewUrl,
                                })
                              }
                              title={t("support.attachments.preview")}
                              aria-label={t("support.attachments.preview")}
                            >
                              <Eye size={14} />
                            </button>
                          )}

                          <button
                            type="button"
                            className="support-file-preview-btn"
                            onClick={() => onDownloadAttachment(att.id)}
                            title={t("support.ticket.downloadAttachment")}
                            aria-label={t("support.ticket.downloadAttachment")}
                          >
                            <Download size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {previewModalItem && (
        <div
          className="support-preview-modal-backdrop"
          onClick={() => setPreviewModalItem(null)}
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
                <span className="support-preview-filename" title={previewModalItem.fileName}>
                  {previewModalItem.fileName}
                </span>
                <span className="support-preview-filesize">
                  ({formatFileSize(previewModalItem.sizeBytes)})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="support-file-preview-btn"
                  onClick={() => onDownloadAttachment(previewModalItem.id)}
                  title={t("support.ticket.downloadAttachment")}
                >
                  <Download size={14} />
                  <span>{t("support.ticket.downloadAttachment")}</span>
                </button>
                <button
                  type="button"
                  className="support-preview-modal-close"
                  onClick={() => setPreviewModalItem(null)}
                  title={t("support.attachments.closePreview")}
                  aria-label={t("support.attachments.closePreview")}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="support-preview-modal-body">
              <img
                src={previewModalItem.url}
                alt={previewModalItem.fileName}
                className="support-preview-full-img"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
