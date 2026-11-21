import React from "react";
import { Download } from "lucide-react";
import { Modal } from "../../components/Modal";
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
    <Modal
      classPrefix="support-preview-modal"
      ariaLabel={t("support.attachments.preview")}
      closeLabel={t("support.attachments.closePreview")}
      onClose={onClose}
      title={
        <>
          <span className="support-preview-filename" title={item.fileName}>
            {item.fileName}
          </span>
          <span className="support-preview-filesize">
            ({formatFileSize(item.sizeBytes)})
          </span>
        </>
      }
      actions={
        <button
          type="button"
          className="support-file-preview-btn"
          onClick={() => onDownloadAttachment(item.id)}
          title={t("support.ticket.downloadAttachment")}
        >
          <Download size={14} />
          <span>{t("support.ticket.downloadAttachment")}</span>
        </button>
      }
    >
      <img
        src={item.url}
        alt={item.fileName}
        className="support-preview-full-img"
      />
    </Modal>
  );
};
