import { AlertCircle, CheckSquare, CircleAlert, Shield } from "lucide-react";
import { useLanguage } from "../../contexts/language/language-provider";
import type { AIValidationResponse } from "../../types/jobseeker";
import {
  isNotChecked,
  notCheckedReasonKey,
  scoreColorClass,
} from "../../utils/aiValidation";

interface DocumentValidationProps {
  /** null: no answer from the AI service yet */
  validation: AIValidationResponse | null | undefined;
  notesExpanded: boolean;
  onToggleNotes: () => void;
}

interface StatusItemProps {
  ok: boolean;
  okText: string;
  badText: string;
}

const StatusItem = ({ ok, okText, badText }: StatusItemProps) => (
  <div className={`validation-status-item ${ok ? "valid" : "invalid"}`}>
    {ok ? <CheckSquare size={16} /> : <CircleAlert size={16} />}
    <span>{ok ? okText : badText}</span>
  </div>
);

/** The "AI Document Validation" panel of one document on the staff jobseeker profile. */
const DocumentValidation = ({
  validation,
  notesExpanded,
  onToggleNotes,
}: DocumentValidationProps) => {
  const { t } = useLanguage();

  const renderBody = () => {
    if (validation === null || validation === undefined) {
      // No answer yet
      return (
        <div className="validation-in-progress">
          <div className="validation-loading">
            <div className="validation-spinner">
              <div className="validation-spinner-inner"></div>
            </div>
          </div>
          <h4 className="validation-progress-title">
            {t("jobSeekerProfile.aiValidationInProgress")}
          </h4>
          <p className="validation-progress-message">
            {t("jobSeekerProfile.aiValidationInProgressMessage")}
          </p>
          <p className="validation-progress-note">
            {t("jobSeekerProfile.aiValidationInProgressNote")}
          </p>
        </div>
      );
    }

    if (isNotChecked(validation)) {
      // The check failed: never a verdict, so no percentage and no flags
      return (
        <div className="validation-in-progress validation-not-checked">
          <h4 className="validation-progress-title">
            {t("jobSeekerProfile.notChecked")}
          </h4>
          <p className="validation-progress-message">
            {t(notCheckedReasonKey(validation.not_checked_reason))}
          </p>
          <p className="validation-progress-note">
            {t("jobSeekerProfile.notCheckedNote")}
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="authentication-score">
          <div className="score-gauge">
            <div
              className={`score-fill ${scoreColorClass(validation.document_authentication_percentage || 0)}`}
              style={{
                width: `${validation.document_authentication_percentage}%`,
              }}
            ></div>
            <span className="score-value">
              {validation.document_authentication_percentage}%
            </span>
          </div>
          <span className="score-label">
            {t("jobSeekerProfile.authenticationScore")}
          </span>
        </div>

        <div className="validation-status-list">
          <StatusItem
            ok={!validation.is_tampered}
            okText={t("jobSeekerProfile.notTampered")}
            badText={t("jobSeekerProfile.tampered")}
          />
          <StatusItem
            ok={!validation.is_blurry}
            okText={t("jobSeekerProfile.notBlurry")}
            badText={t("jobSeekerProfile.blurry")}
          />
          <StatusItem
            ok={!!validation.is_text_clear}
            okText={t("jobSeekerProfile.textClear")}
            badText={t("jobSeekerProfile.textUnclear")}
          />
          <StatusItem
            ok={!validation.is_resubmission_required}
            okText={t("jobSeekerProfile.noResubmissionRequired")}
            badText={t("jobSeekerProfile.resubmissionRequired")}
          />
        </div>

        <div className="validation-notes">
          <div className="validation-notes-header">
            <AlertCircle size={14} />
            <span>{t("jobSeekerProfile.aiAnalysisNotes")}</span>
          </div>
          <p
            className={`validation-notes-content ${notesExpanded ? "expanded" : ""}`}
          >
            {validation.notes}
          </p>
          <button className="toggle-notes-btn" onClick={onToggleNotes}>
            {notesExpanded
              ? t("jobSeekerProfile.showLess")
              : t("jobSeekerProfile.showFullNotes")}
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="document-validation">
      <div className="validation-header">
        <Shield size={16} />
        <h3>{t("jobSeekerProfile.aiDocumentValidation")}</h3>
      </div>
      {renderBody()}
    </div>
  );
};

export default DocumentValidation;
