import React from "react";
import { UseFormRegister } from "react-hook-form";
import { useLanguage } from "../../contexts/language/language-provider";
import { NewTicketFormData } from "./supportNewForm";

interface SupportNewUrgencySectionProps {
  register: UseFormRegister<NewTicketFormData>;
  selectedUrgency: NewTicketFormData["urgency"] | undefined;
  error?: string;
}

export const SupportNewUrgencySection: React.FC<
  SupportNewUrgencySectionProps
> = ({ register, selectedUrgency, error }) => {
  const { t } = useLanguage();

  return (
    <div className="form-section">
      <h2 className="form-section-title">
        <span>{t("support.new.howUrgent")}</span>
        <span className="required-star">*</span>
      </h2>

      <div
        className="support-urgency-grid"
        role="radiogroup"
        aria-label={t("support.new.howUrgent")}
      >
        <label
          className={`support-urgency-card ${selectedUrgency === "blocked" ? "selected" : ""}`}
        >
          <input
            type="radio"
            value="blocked"
            {...register("urgency")}
            style={{ accentColor: "var(--primary)" }}
          />
          <span className="support-urgency-label">
            {t("support.new.urgencyBlocked")}
          </span>
        </label>

        <label
          className={`support-urgency-card ${selectedUrgency === "annoying" ? "selected" : ""}`}
        >
          <input
            type="radio"
            value="annoying"
            {...register("urgency")}
            style={{ accentColor: "var(--primary)" }}
          />
          <span className="support-urgency-label">
            {t("support.new.urgencyAnnoying")}
          </span>
        </label>

        <label
          className={`support-urgency-card ${selectedUrgency === "not_urgent" ? "selected" : ""}`}
        >
          <input
            type="radio"
            value="not_urgent"
            {...register("urgency")}
            style={{ accentColor: "var(--primary)" }}
          />
          <span className="support-urgency-label">
            {t("support.new.urgencyNotUrgent")}
          </span>
        </label>
      </div>
      {error && <span className="form-error">{error}</span>}
    </div>
  );
};
