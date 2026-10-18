import React, { useState, useRef, useEffect, useCallback } from "react";
import { UploadCloud, X, RefreshCw, FileText, AlertCircle, CheckCircle, Eye } from "lucide-react";
import { uploadSupportAttachment } from "../../services/api/support";
import { useLanguage } from "../../contexts/language/language-provider";
import { CreateAttachmentInput } from "../../types/support";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/csv",
];
const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf", ".txt", ".csv"];

export interface UploadItem {
  id: string;
  file: File;
  status: "uploading" | "success" | "error";
  error?: string;
  attachment?: CreateAttachmentInput;
  previewUrl?: string;
  isImage: boolean;
}

interface SupportAttachmentUploaderProps {
  onAttachmentsChange: (attachments: CreateAttachmentInput[]) => void;
  onUploadingChange?: (isUploading: boolean) => void;
  disabled?: boolean;
}

export const SupportAttachmentUploader: React.FC<SupportAttachmentUploaderProps> = ({
  onAttachmentsChange,
  onUploadingChange,
  disabled = false,
}) => {
  const { t } = useLanguage();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [previewModalItem, setPreviewModalItem] = useState<UploadItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<UploadItem[]>(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Clean up any generated object URLs on unmount
  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

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

  // Sync state to parent whenever items change
  useEffect(() => {
    const isUploading = items.some((item) => item.status === "uploading");
    if (onUploadingChange) {
      onUploadingChange(isUploading);
    }

    const successfulAttachments = items
      .filter((item) => item.status === "success" && item.attachment)
      .map((item) => item.attachment as CreateAttachmentInput);

    onAttachmentsChange(successfulAttachments);
  }, [items, onAttachmentsChange, onUploadingChange]);

  const uploadSingleFile = useCallback(async (item: UploadItem) => {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: "uploading", error: undefined } : i))
    );

    try {
      const uploaded = await uploadSupportAttachment(item.file);
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                status: "success",
                attachment: {
                  path: uploaded.path,
                  fileName: uploaded.fileName,
                  mimeType: uploaded.mimeType,
                  sizeBytes: uploaded.sizeBytes,
                },
              }
            : i
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("support.errors.uploadFailed");
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "error", error: msg } : i))
      );
    }
  }, [t]);

  const processFiles = useCallback(
    (filesToAdd: File[]) => {
      setGeneralError(null);
      if (disabled) return;

      if (items.length + filesToAdd.length > MAX_FILES) {
        setGeneralError(t("support.errors.maxFilesExceeded"));
        return;
      }

      const validItems: UploadItem[] = [];

      for (const file of filesToAdd) {
        if (file.size > MAX_FILE_SIZE) {
          setGeneralError(t("support.errors.fileTooLarge"));
          continue;
        }

        const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
        const isTypeAllowed =
          ALLOWED_MIME_TYPES.includes(file.type) || ALLOWED_EXTENSIONS.includes(ext);

        if (!isTypeAllowed) {
          setGeneralError(t("support.errors.unsupportedFileType"));
          continue;
        }

        const isImage =
          file.type.startsWith("image/") ||
          [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext);
        const previewUrl = isImage ? URL.createObjectURL(file) : undefined;

        const newItem: UploadItem = {
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          status: "uploading",
          isImage,
          previewUrl,
        };
        validItems.push(newItem);
      }

      if (validItems.length > 0) {
        setItems((prev) => [...prev, ...validItems]);
        validItems.forEach((item) => {
          uploadSingleFile(item);
        });
      }
    },
    [disabled, items.length, t, uploadSingleFile]
  );

  // Paste listener for Ctrl+V
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled) return;
      if (!e.clipboardData?.items) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < e.clipboardData.items.length; i++) {
        const item = e.clipboardData.items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            pastedFiles.push(file);
          }
        }
      }

      if (pastedFiles.length > 0) {
        processFiles(pastedFiles);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [disabled, processFiles]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const handleRemove = (id: string) => {
    setItems((prev) => {
      const toRemove = prev.find((item) => item.id === id);
      if (toRemove?.previewUrl) {
        URL.revokeObjectURL(toRemove.previewUrl);
      }
      if (previewModalItem?.id === id) {
        setPreviewModalItem(null);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleRetry = (item: UploadItem) => {
    uploadSingleFile(item);
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="support-uploader">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ALLOWED_EXTENSIONS.join(",")}
        onChange={handleFileInputChange}
        style={{ display: "none" }}
        disabled={disabled}
      />

      {items.length < MAX_FILES && (
        <div
          className={`support-dropzone ${isDragActive ? "drag-active" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label={t("support.new.dropzoneHint")}
        >
          <UploadCloud size={28} className="support-dropzone-icon" />
          <div className="support-dropzone-text">
            <strong>{t("support.new.clickOrDrag")}</strong>
          </div>
          <div className="support-dropzone-hint">{t("support.new.dropzoneHint")}</div>
        </div>
      )}

      {generalError && (
        <div className="form-error flex items-center gap-2 mt-2" role="alert">
          <AlertCircle size={14} />
          <span>{generalError}</span>
        </div>
      )}

      <div className="support-file-list" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className="support-file-item">
            <div className="support-file-info">
              {item.isImage && item.previewUrl ? (
                <div
                  className="support-file-thumb-wrap"
                  onClick={() => setPreviewModalItem(item)}
                  title={t("support.attachments.preview")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setPreviewModalItem(item);
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
                  <span className="support-file-size">({formatSize(item.file.size)})</span>
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
                        onClick={() => handleRetry(item)}
                        title={t("support.attachments.retry")}
                        style={{ padding: "1px 6px", fontSize: "11px", height: "auto" }}
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
                  onClick={() => setPreviewModalItem(item)}
                  title={t("support.attachments.preview")}
                  aria-label={t("support.attachments.preview")}
                >
                  <Eye size={14} />
                </button>
              )}

              <button
                type="button"
                className="support-file-remove-btn"
                onClick={() => handleRemove(item.id)}
                title={t("support.attachments.remove")}
                aria-label={t("support.attachments.remove")}
                disabled={disabled}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {previewModalItem && previewModalItem.previewUrl && (
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
                <span className="support-preview-filename" title={previewModalItem.file.name}>
                  {previewModalItem.file.name}
                </span>
                <span className="support-preview-filesize">
                  ({formatSize(previewModalItem.file.size)})
                </span>
              </div>
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
            <div className="support-preview-modal-body">
              <img
                src={previewModalItem.previewUrl}
                alt={previewModalItem.file.name}
                className="support-preview-full-img"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
