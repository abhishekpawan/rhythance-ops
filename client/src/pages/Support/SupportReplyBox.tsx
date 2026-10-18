import React from "react";
import { Send, AlertCircle } from "lucide-react";
import { useLanguage } from "../../contexts/language/language-provider";
import { SupportAttachmentUploader } from "./SupportAttachmentUploader";
import { CreateAttachmentInput } from "../../types/support";

interface SupportReplyBoxProps {
  canReply: boolean;
  isSuperAdmin: boolean;
  replyBody: string;
  onReplyBodyChange: (body: string) => void;
  onAttachmentsChange: (attachments: CreateAttachmentInput[]) => void;
  replyIsUploading: boolean;
  onUploadingChange: (uploading: boolean) => void;
  replyIsInternal: boolean;
  onReplyIsInternalChange: (isInternal: boolean) => void;
  sendingReply: boolean;
  replyError: string | null;
  onSendReply: (e: React.FormEvent) => void;
}

export const SupportReplyBox: React.FC<SupportReplyBoxProps> = ({
  canReply,
  isSuperAdmin,
  replyBody,
  onReplyBodyChange,
  onAttachmentsChange,
  replyIsUploading,
  onUploadingChange,
  replyIsInternal,
  onReplyIsInternalChange,
  sendingReply,
  replyError,
  onSendReply,
}) => {
  const { t } = useLanguage();

  if (!canReply) {
    return (
      <div className="support-reply-card text-center" style={{ padding: "24px" }}>
        <p className="text-muted" style={{ margin: 0 }}>
          {t("support.ticket.readOnlyNote")}
        </p>
      </div>
    );
  }

  return (
    <div className="support-reply-card">
      <h3 className="support-reply-title">{t("support.ticket.replyTitle")}</h3>

      {replyError && (
        <div className="error-message mb-3 flex items-center gap-2" role="alert">
          <AlertCircle size={14} />
          <span>{replyError}</span>
        </div>
      )}

      <form onSubmit={onSendReply}>
        <div className="form-group mb-3">
          <textarea
            className="form-textarea"
            rows={4}
            value={replyBody}
            onChange={(e) => onReplyBodyChange(e.target.value)}
            placeholder={t("support.ticket.replyPlaceholder")}
            disabled={sendingReply}
          />
        </div>

        <div className="mb-4">
          <SupportAttachmentUploader
            onAttachmentsChange={onAttachmentsChange}
            onUploadingChange={onUploadingChange}
            disabled={sendingReply}
          />
        </div>

        <div className="flex justify-between items-center">
          {isSuperAdmin ? (
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="form-checkbox"
                checked={replyIsInternal}
                onChange={(e) => onReplyIsInternalChange(e.target.checked)}
                style={{ accentColor: "#d97706" }}
              />
              <span className="checkbox-label" style={{ fontSize: "13px", fontWeight: 500 }}>
                {t("support.ticket.checkboxInternalNote")}
              </span>
            </label>
          ) : (
            <div />
          )}

          <button
            type="submit"
            className="button primary button-icon"
            disabled={!replyBody.trim() || sendingReply || replyIsUploading}
          >
            <Send size={16} />
            <span>
              {sendingReply
                ? t("support.ticket.sendingReply")
                : t("support.ticket.sendReplyButton")}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
};
