import { Modal } from "../../components/Modal";
import { useLanguage } from "../../contexts/language/language-provider";
import "../../styles/components/training/VideoModal.css";

interface VideoModalProps {
  isOpen: boolean;
  videoId: string;
  title: string;
  onClose: () => void;
}

export function VideoModal({
  isOpen,
  videoId,
  title,
  onClose,
}: VideoModalProps) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <Modal
      classPrefix="video-modal"
      ariaLabel={title}
      closeLabel={t("training.closeVideo")}
      closeIconSize={24}
      title={<h2 className="video-modal-heading">{title}</h2>}
      onClose={onClose}
    >
      <div className="video-container">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
          title={title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="video-iframe"
        ></iframe>
      </div>
    </Modal>
  );
}
