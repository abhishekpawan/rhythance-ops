import React from "react";
import { Modal } from "../../components/Modal";
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
    <Modal
      classPrefix="support-preview-modal"
      ariaLabel={t("support.attachments.preview")}
      closeLabel={t("support.attachments.closePreview")}
      onClose={onClose}
      title={
        <>
          <span className="support-preview-filename" title={item.file.name}>
            {item.file.name}
          </span>
          <span className="support-preview-filesize">
            ({formatFileSize(item.file.size)})
          </span>
        </>
      }
    >
      <img
        src={item.previewUrl}
        alt={item.file.name}
        className="support-preview-full-img"
      />
    </Modal>
  );
};
