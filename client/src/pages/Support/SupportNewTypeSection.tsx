import React from "react";
import { Bug, Sparkles, FileEdit } from "lucide-react";
import { useLanguage } from "../../contexts/language/language-provider";
import { SupportTicketType } from "../../types/support";

interface SupportNewTypeSectionProps {
  selectedType: SupportTicketType | undefined;
  onSelect: (type: "bug" | "change" | "feature") => void;
  error?: string;
}

export const SupportNewTypeSection: React.FC<SupportNewTypeSectionProps> = ({
  selectedType,
  onSelect,
  error,
}) => {
  const { t } = useLanguage();

  return (
    <div className="form-section">
      <h2 className="form-section-title">
        <span>{t("support.new.whatDoYouNeed")}</span>
        <span className="required-star">*</span>
      </h2>

      <div
        className="support-choice-grid"
        role="radiogroup"
        aria-label={t("support.new.whatDoYouNeed")}
      >
        <button
          type="button"
          role="radio"
          aria-checked={selectedType === "bug"}
          tabIndex={0}
          className={`support-choice-card ${selectedType === "bug" ? "selected" : ""}`}
          onClick={() => onSelect("bug")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect("bug");
            }
          }}
        >
          <Bug size={24} className="support-choice-icon" />
          <span className="support-choice-title">
            {t("support.new.typeBugTitle")}
          </span>
          <span className="support-choice-desc">
            {t("support.new.typeBugDesc")}
          </span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={selectedType === "change"}
          tabIndex={0}
          className={`support-choice-card ${selectedType === "change" ? "selected" : ""}`}
          onClick={() => onSelect("change")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect("change");
            }
          }}
        >
          <FileEdit size={24} className="support-choice-icon" />
          <span className="support-choice-title">
            {t("support.new.typeChangeTitle")}
          </span>
          <span className="support-choice-desc">
            {t("support.new.typeChangeDesc")}
          </span>
        </button>

        <button
          type="button"
          role="radio"
          aria-checked={selectedType === "feature"}
          tabIndex={0}
          className={`support-choice-card ${selectedType === "feature" ? "selected" : ""}`}
          onClick={() => onSelect("feature")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect("feature");
            }
          }}
        >
          <Sparkles size={24} className="support-choice-icon" />
          <span className="support-choice-title">
            {t("support.new.typeFeatureTitle")}
          </span>
          <span className="support-choice-desc">
            {t("support.new.typeFeatureDesc")}
          </span>
        </button>
      </div>
      {error && <span className="form-error">{error}</span>}
    </div>
  );
};
