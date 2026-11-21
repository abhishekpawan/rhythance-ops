import React, { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, AlertTriangle, ShieldAlert, Send } from "lucide-react";
import { AppHeader } from "../../components/AppHeader";
import { useLanguage } from "../../contexts/language/language-provider";
import { createTicket } from "../../services/api/support";
import { SupportAttachmentUploader } from "./SupportAttachmentUploader";
import { SupportNewTypeSection } from "./SupportNewTypeSection";
import { SupportNewUrgencySection } from "./SupportNewUrgencySection";
import { newTicketSchema, NewTicketFormData } from "./supportNewForm";
import { buildSupportContext } from "../../lib/supportContext";
import {
  SupportTicketType,
  PendingAttachmentUpload,
} from "../../types/support";
import "../../styles/pages/Support.css";

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

  // Stable between renders: the uploader reports its files from an effect that depends on this function, so a new
  // function on every render made the two re-render each other without end (which kept the page busy, and with the
  // router's start-transition kept the next page from ever replacing this one).
  const onAttachmentsChange = useCallback((atts: PendingAttachmentUpload[]) => {
    setAttachments(atts);
    if (atts.length > 0) {
      setAttachmentError(null);
      setSubmitError(null);
    }
  }, []);

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
      description: "",
      urgency: undefined,
    },
  });

  const selectedType = watch("type");
  const selectedUrgency = watch("urgency");

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

    setSubmitting(true);
    setSubmitError(null);
    setAttachmentError(null);

    try {
      const context = buildSupportContext(
        window.location.pathname,
        undefined,
        language
      );

      const res = await createTicket({
        type: data.type,
        description: data.description.trim(),
        urgency: data.urgency,
        context,
        locale: language,
        idempotencyKey: idempotencyKeyRef.current,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      const formattedNum = `SUP-${String(res.ticket.ticketNumber).padStart(4, "0")}`;
      navigate(`/support/${res.ticket.id}`, {
        state: {
          message: t("support.new.ticketCreated").replace(
            "{number}",
            formattedNum
          ),
        },
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
          <div
            className="error-message mb-4 flex items-center gap-2"
            role="alert"
          >
            <AlertTriangle size={16} />
            <span>{submitError}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="client-form"
          noValidate
        >
          <div className="card">
            {/* 1. What do you need? (Choice cards) */}
            <SupportNewTypeSection
              selectedType={selectedType}
              onSelect={(type) => setValue("type", type)}
              error={errors.type?.message}
            />

            {/* 2. Tell us what happened */}
            <div className="form-section">
              <div className="form-group">
                <label
                  htmlFor="support-description"
                  className="form-section-title"
                >
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
                  <span className="form-error">
                    {errors.description.message}
                  </span>
                )}
              </div>
            </div>

            {/* 3. Screenshots or files */}
            <div className="form-section">
              <h2 className="form-section-title">
                <span>{t("support.new.screenshotsOrFiles")}</span>
              </h2>
              <SupportAttachmentUploader
                onAttachmentsChange={onAttachmentsChange}
                onUploadingChange={setIsUploading}
                disabled={submitting}
              />
              {attachmentError && (
                <span
                  className="form-error"
                  style={{ display: "block", marginTop: "8px" }}
                >
                  {attachmentError}
                </span>
              )}
            </div>

            {/* 4. How urgent is this? */}
            <SupportNewUrgencySection
              register={register}
              selectedUrgency={selectedUrgency}
              error={errors.urgency?.message}
            />

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
