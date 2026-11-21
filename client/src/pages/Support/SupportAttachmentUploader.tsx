import React, { useState, useRef, useEffect, useCallback } from "react";
import { AlertCircle } from "lucide-react";
import { uploadSupportAttachment } from "../../services/api/support";
import { useLanguage } from "../../contexts/language/language-provider";
import { CreateAttachmentInput } from "../../types/support";
import { SupportDropzone } from "./SupportDropzone";
import { SupportUploadItemRow } from "./SupportUploadItemRow";
import { SupportUploadPreviewModal } from "./SupportUploadPreviewModal";
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILES,
  MAX_FILE_SIZE,
  UploadItem,
} from "./supportUploadItem";

interface SupportAttachmentUploaderProps {
  onAttachmentsChange: (attachments: CreateAttachmentInput[]) => void;
  onUploadingChange?: (isUploading: boolean) => void;
  disabled?: boolean;
}

export const SupportAttachmentUploader: React.FC<
  SupportAttachmentUploaderProps
> = ({ onAttachmentsChange, onUploadingChange, disabled = false }) => {
  const { t } = useLanguage();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [previewModalItem, setPreviewModalItem] = useState<UploadItem | null>(
    null
  );
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

  const uploadSingleFile = useCallback(
    async (item: UploadItem) => {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: "uploading", error: undefined } : i
        )
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
        const msg =
          err instanceof Error ? err.message : t("support.errors.uploadFailed");
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: "error", error: msg } : i
          )
        );
      }
    },
    [t]
  );

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
          ALLOWED_MIME_TYPES.includes(file.type) ||
          ALLOWED_EXTENSIONS.includes(ext);

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
        <SupportDropzone
          isDragActive={isDragActive}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onOpen={() => fileInputRef.current?.click()}
        />
      )}

      {generalError && (
        <div className="form-error flex items-center gap-2 mt-2" role="alert">
          <AlertCircle size={14} />
          <span>{generalError}</span>
        </div>
      )}

      <div className="support-file-list" aria-live="polite">
        {items.map((item) => (
          <SupportUploadItemRow
            key={item.id}
            item={item}
            disabled={disabled}
            onPreview={setPreviewModalItem}
            onRetry={handleRetry}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {previewModalItem && previewModalItem.previewUrl && (
        <SupportUploadPreviewModal
          item={previewModalItem}
          onClose={() => setPreviewModalItem(null)}
        />
      )}
    </div>
  );
};
