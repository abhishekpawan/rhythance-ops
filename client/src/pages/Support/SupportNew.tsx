import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  AlertTriangle,
  Bug,
  Sparkles,
  FileEdit,
  ShieldAlert,
  Send,
} from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { useLanguage } from "../../contexts/language/language-provider";
import { createTicket } from "../../services/api/support";
import { SupportAttachmentUploader } from "./SupportAttachmentUploader";
import { buildSupportContext } from "../../lib/supportContext";
import { SUPPORT_MODULES, matchAreaFromPath } from "../../constants/supportAreas";
import {
  SupportTicketType,
  PendingAttachmentUpload,
} from "../../types/support";
import "../../styles/pages/Support.css";

const newTicketSchema = z.object({
  type: z.enum(["bug", "change", "feature"] as const, {
    required_error: "Please select what you need",
  }),
  moduleKey: z.string().min(1, "Please select which part of the portal"),
  pageKey: z.string().optional(),
  pageUrl: z
    .string({ required_error: "Please provide the link of the page" })
    .trim()
    .min(1, "Please provide the link of the page")
    .max(500, "URL must be 500 characters or less"),
  description: z
    .string()
    .min(10, "Please provide at least 10 characters to describe what happened")
    .max(10000, "Description is too long"),
  urgency: z.enum(["blocked", "annoying", "not_urgent"] as const, {
    required_error: "Please indicate how urgent this is",
  }),
});

type NewTicketFormData = z.infer<typeof newTicketSchema>;

export const SupportNew: React.FC = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  // Generate idempotencyKey once per component mount and keep in ref for retries
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const [attachments, setAttachments] = useState<PendingAttachmentUpload[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Stored last page from sessionStorage
  const [storedLastPage, setStoredLastPage] = useState<string>("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<NewTicketFormData>({
    resolver: zodResolver(newTicketSchema),
    defaultValues: {
      type: "bug",
      moduleKey: "",
      pageKey: "",
      pageUrl: "",
      description: "",
      urgency: undefined,
    },
  });

  const selectedType = watch("type");
  const selectedModuleKey = watch("moduleKey");
  const selectedUrgency = watch("urgency");

  // On mount: read sessionStorage 'support.lastPage', populate pageUrl & auto-match area
  useEffect(() => {
    const lastPage = sessionStorage.getItem("support.lastPage") || "";
    if (lastPage) {
      setStoredLastPage(lastPage);
      setValue("pageUrl", lastPage);

      const matched = matchAreaFromPath(lastPage);
      if (matched) {
        setValue("moduleKey", matched.moduleKey);
        setValue("pageKey", matched.pageKey);
      }
    }
  }, [setValue]);

  // Find currently selected module object to get its available pages
  const currentModule = SUPPORT_MODULES.find((m) => m.key === selectedModuleKey);

  const getPlaceholder = (type: SupportTicketType): string => {
    switch (type) {
      case "bug":
        return t("support.new.placeholderBug");
      case "change":
        return t("support.new.placeholderChange");
      case "feature":
        return t("support.new.placeholderFeature");
      default:
        return t("support.new.descriptionPlaceholder");
    }
  };

  const onSubmit = async (data: NewTicketFormData) => {
    if (isUploading) {
      setSubmitError(t("support.new.uploadInProgress"));
      return;
    }

    if (attachments.length === 0) {
      const msg = t("support.new.screenshotsRequired");
      setAttachmentError(msg);
      setSubmitError(msg);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setAttachmentError(null);

    try {
      // Resolve areaKey & areaLabel
      let areaKey = data.moduleKey;
      let areaLabel = currentModule?.labelEn || data.moduleKey;

      if (data.pageKey && data.pageKey !== "" && data.pageKey !== "not_sure") {
        areaKey = `${data.moduleKey}.${data.pageKey}`;
        const pageObj = currentModule?.pages.find((p) => p.key === data.pageKey);
        if (pageObj) {
          areaLabel = `${currentModule?.labelEn} > ${pageObj.labelEn}`;
        }
      }

      const context = buildSupportContext(
        window.location.pathname,
        storedLastPage,
        language
      );

      const res = await createTicket({
        type: data.type,
        areaKey,
        areaLabel,
        pageUrl: data.pageUrl?.trim() || undefined,
        description: data.description.trim(),
        urgency: data.urgency,
        context,
        locale: language,
        idempotencyKey: idempotencyKeyRef.current,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      const formattedNum = `SUP-${String(res.ticket.ticketNumber).padStart(4, "0")}`;
      navigate(`/support/${res.ticket.id}`, {
        state: { message: t("support.new.ticketCreated").replace("{number}", formattedNum) },
      });
    } catch (err: any) {
      console.error("Failed to submit ticket:", err);
      if (err?.status === 429) {
        setSubmitError(t("support.errors.rateLimited"));
      } else {
        setSubmitError(err?.message || t("support.errors.createFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <AppHeader
        title={t("support.new.title")}
        actions={
          <button
            type="button"
            className="button secondary button-icon"
            onClick={() => navigate("/support")}
          >
            <ArrowLeft size={16} />
            <span>{t("support.backToList")}</span>
          </button>
        }
        statusMessage={submitError}
        statusType="error"
      />

      <div className="content-container">
        {submitError && (
          <div className="error-message mb-4 flex items-center gap-2" role="alert">
            <AlertTriangle size={16} />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="client-form" noValidate>
          <div className="card">
            {/* 1. What do you need? (Choice cards) */}
            <div className="form-section">
              <h2 className="form-section-title">
                <span>{t("support.new.whatDoYouNeed")}</span>
                <span className="required-star">*</span>
              </h2>

              <div className="support-choice-grid" role="radiogroup" aria-label={t("support.new.whatDoYouNeed")}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedType === "bug"}
                  tabIndex={0}
                  className={`support-choice-card ${selectedType === "bug" ? "selected" : ""}`}
                  onClick={() => setValue("type", "bug")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setValue("type", "bug");
                    }
                  }}
                >
                  <Bug size={24} className="support-choice-icon" />
                  <span className="support-choice-title">{t("support.new.typeBugTitle")}</span>
                  <span className="support-choice-desc">{t("support.new.typeBugDesc")}</span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedType === "change"}
                  tabIndex={0}
                  className={`support-choice-card ${selectedType === "change" ? "selected" : ""}`}
                  onClick={() => setValue("type", "change")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setValue("type", "change");
                    }
                  }}
                >
                  <FileEdit size={24} className="support-choice-icon" />
                  <span className="support-choice-title">{t("support.new.typeChangeTitle")}</span>
                  <span className="support-choice-desc">{t("support.new.typeChangeDesc")}</span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedType === "feature"}
                  tabIndex={0}
                  className={`support-choice-card ${selectedType === "feature" ? "selected" : ""}`}
                  onClick={() => setValue("type", "feature")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setValue("type", "feature");
                    }
                  }}
                >
                  <Sparkles size={24} className="support-choice-icon" />
                  <span className="support-choice-title">{t("support.new.typeFeatureTitle")}</span>
                  <span className="support-choice-desc">{t("support.new.typeFeatureDesc")}</span>
                </button>
              </div>
              {errors.type && <span className="form-error">{errors.type.message}</span>}
            </div>

            {/* 2. Which part of the portal? */}
            <div className="form-section">
              <h2 className="form-section-title">
                <span>{t("support.new.whichPart")}</span>
              </h2>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="support-module-select" className="form-label" data-required="*">
                    {t("support.new.moduleLabel")}
                  </label>
                  <select
                    id="support-module-select"
                    className="form-input"
                    {...register("moduleKey")}
                    onChange={(e) => {
                      setValue("moduleKey", e.target.value);
                      setValue("pageKey", "");
                    }}
                  >
                    <option value="">{t("support.new.selectModule")}</option>
                    {SUPPORT_MODULES.map((mod) => (
                      <option key={mod.key} value={mod.key}>
                        {t(mod.labelKey) || mod.labelEn}
                      </option>
                    ))}
                  </select>
                  {errors.moduleKey && (
                    <span className="form-error">{errors.moduleKey.message}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="support-page-select" className="form-label">
                    {t("support.new.pageLabel")}
                  </label>
                  <select
                    id="support-page-select"
                    className="form-input"
                    {...register("pageKey")}
                    disabled={!currentModule || currentModule.pages.length === 0}
                  >
                    <option value="">{t("support.new.notSure")}</option>
                    {currentModule?.pages.map((p) => (
                      <option key={p.key} value={p.key}>
                        {t(p.labelKey) || p.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Link of the page */}
            <div className="form-section">
              <div className="form-group">
                <label htmlFor="support-page-url" className="form-label" data-required="*">
                  {t("support.new.linkOfPage")}
                </label>
                <input
                  id="support-page-url"
                  type="text"
                  className="form-input"
                  maxLength={500}
                  placeholder="/client-management/list"
                  {...register("pageUrl")}
                />
                <div className="form-hint">
                  {t("support.new.linkHelper")}
                </div>
                {errors.pageUrl && (
                  <span className="form-error">{errors.pageUrl.message}</span>
                )}
              </div>
            </div>

            {/* 4. Tell us what happened */}
            <div className="form-section">
              <div className="form-group">
                <label htmlFor="support-description" className="form-section-title">
                  <span>{t("support.new.tellUsWhatHappened")}</span>
                  <span className="required-star">*</span>
                </label>
                <textarea
                  id="support-description"
                  className="form-textarea"
                  rows={5}
                  placeholder={getPlaceholder(selectedType)}
                  {...register("description")}
                />
                {errors.description && (
                  <span className="form-error">{errors.description.message}</span>
                )}
              </div>
            </div>

            {/* 5. Screenshots or files */}
            <div className="form-section">
              <h2 className="form-section-title">
                <span>{t("support.new.screenshotsOrFiles")}</span>
                <span className="required-star">*</span>
              </h2>
              <SupportAttachmentUploader
                onAttachmentsChange={(atts) => {
                  setAttachments(atts);
                  if (atts.length > 0) {
                    setAttachmentError(null);
                    setSubmitError(null);
                  }
                }}
                onUploadingChange={setIsUploading}
                disabled={submitting}
              />
              {attachmentError && (
                <span className="form-error" style={{ display: "block", marginTop: "8px" }}>
                  {attachmentError}
                </span>
              )}
            </div>

            {/* 6. How urgent is this? */}
            <div className="form-section">
              <h2 className="form-section-title">
                <span>{t("support.new.howUrgent")}</span>
                <span className="required-star">*</span>
              </h2>

              <div className="support-urgency-grid" role="radiogroup" aria-label={t("support.new.howUrgent")}>
                <label
                  className={`support-urgency-card ${selectedUrgency === "blocked" ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    value="blocked"
                    {...register("urgency")}
                    style={{ accentColor: "var(--primary)" }}
                  />
                  <span className="support-urgency-label">{t("support.new.urgencyBlocked")}</span>
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
                  <span className="support-urgency-label">{t("support.new.urgencyAnnoying")}</span>
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
                  <span className="support-urgency-label">{t("support.new.urgencyNotUrgent")}</span>
                </label>
              </div>
              {errors.urgency && (
                <span className="form-error">{errors.urgency.message}</span>
              )}
            </div>

            {/* Privacy notice */}
            <div className="support-notice-box" role="note">
              <ShieldAlert size={20} className="support-notice-icon" />
              <div>{t("support.new.privacyNotice")}</div>
            </div>

            {/* Form actions */}
            <div className="form-footer">
              <button
                type="button"
                className="button secondary"
                onClick={() => navigate("/support")}
                disabled={submitting}
              >
                {t("support.commonCancel")}
              </button>

              <button
                type="submit"
                className="button primary button-icon"
                disabled={submitting || isUploading}
              >
                <Send size={16} />
                <span>
                  {submitting
                    ? t("support.new.sending")
                    : isUploading
                    ? t("support.new.uploadingFiles")
                    : t("support.new.submitButton")}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
