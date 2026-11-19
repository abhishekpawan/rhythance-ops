import React from "react";
import { UploadCloud } from "lucide-react";
import { useLanguage } from "../../contexts/language/language-provider";

interface SupportDropzoneProps {
  isDragActive: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onOpen: () => void;
}

export const SupportDropzone: React.FC<SupportDropzoneProps> = ({
  isDragActive,
  onDragOver,
  onDragLeave,
  onDrop,
  onOpen,
}) => {
  const { t } = useLanguage();

  return (
    <div
      className={`support-dropzone ${isDragActive ? "drag-active" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => onOpen()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={t("support.new.dropzoneHint")}
    >
      <UploadCloud size={28} className="support-dropzone-icon" />
      <div className="support-dropzone-text">
        <strong>{t("support.new.clickOrDrag")}</strong>
      </div>
      <div className="support-dropzone-hint">
        {t("support.new.dropzoneHint")}
      </div>
    </div>
  );
};
