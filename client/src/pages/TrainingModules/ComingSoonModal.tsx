import { Clock, BookOpen } from "lucide-react";
import { Modal } from "../../components/Modal";
import { useLanguage } from "../../contexts/language/language-provider";
import "../../styles/components/training/ComingSoonModal.css";

interface Module {
  id: string;
  titleKey: string;
  descriptionKey: string;
  type: "document" | "video" | "interactive";
  duration: string;
  icon: JSX.Element;
  completed?: boolean;
  youtubeId?: string;
  comingSoon?: boolean;
}

interface ComingSoonModalProps {
  isOpen: boolean;
  module: Module | null;
  onClose: () => void;
}

export function ComingSoonModal({
  isOpen,
  module,
  onClose,
}: ComingSoonModalProps) {
  const { t } = useLanguage();

  if (!isOpen || !module) return null;

  const getModuleFeatures = () => {
    // Mock features based on module type
    const features = {
      document: [
        t("training.features.document.interactivePdf"),
        t("training.features.document.progressTracking"),
        t("training.features.document.downloadableResources"),
        t("training.features.document.quickReference"),
      ],
      interactive: [
        t("training.features.interactive.handsOnExercises"),
        t("training.features.interactive.realTimeFeedback"),
        t("training.features.interactive.practiceScenarios"),
        t("training.features.interactive.certificateCompletion"),
      ],
    };
    return features[module.type as keyof typeof features] || [];
  };

  return (
    <Modal
      classPrefix="coming-soon-modal"
      ariaLabel={t(module.titleKey)}
      closeLabel={t("training.closeModal")}
      closeIconSize={24}
      title={
        <div className="coming-soon-header-content">
          <div className="coming-soon-icon">
            <Clock size={32} />
          </div>
          <div>
            <h2 className="coming-soon-heading">{t(module.titleKey)}</h2>
            <p className="coming-soon-modal-subtitle">
              {t("training.comingSoon")}
            </p>
          </div>
        </div>
      }
      footer={<p>{t("training.notifyMessage")}</p>}
      onClose={onClose}
    >
      <div className="coming-soon-description">
        <p>{t(module.descriptionKey)}</p>
      </div>

      <div className="coming-soon-details">
        <div className="coming-soon-detail-item">
          <BookOpen size={20} />
          <div>
            <h4>{t("training.duration")}</h4>
            <p>{module.duration}</p>
          </div>
        </div>
      </div>

      <div className="coming-soon-features">
        <h4>{t("training.whatToExpect")}</h4>
        <ul>
          {getModuleFeatures().map((feature, index) => (
            <li key={index}>{feature}</li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
