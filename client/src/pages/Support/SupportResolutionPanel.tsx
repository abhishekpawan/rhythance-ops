import React from "react";
import { Check, RotateCcw } from "lucide-react";
import { useLanguage } from "../../contexts/language/language-provider";
import { SupportTicketStatus } from "../../types/support";

interface SupportResolutionPanelProps {
  status: SupportTicketStatus;
  isOwner: boolean;
  closedAt?: string | null;
  confirming: boolean;
  reopening: boolean;
  showReopenInput: boolean;
  onToggleShowReopenInput: () => void;
  reopenReason: string;
  onReopenReasonChange: (reason: string) => void;
  onConfirmResolution: () => void;
  onReopenTicket: () => void;
  onRaiseNewTicket: () => void;
}

export const SupportResolutionPanel: React.FC<SupportResolutionPanelProps> = ({
  status,
  isOwner,
  closedAt,
  confirming,
  reopening,
  showReopenInput,
  onToggleShowReopenInput,
  reopenReason,
  onReopenReasonChange,
  onConfirmResolution,
  onReopenTicket,
  onRaiseNewTicket,
}) => {
  const { t } = useLanguage();

  if (!isOwner) return null;

  // 14 days reopen check for closed tickets
  const isWithin14Days = closedAt
    ? Date.now() - new Date(closedAt).getTime() <= 14 * 24 * 60 * 60 * 1000
    : true;

  return (
    <>
      {/* Resolved Panel for Owner */}
      {status === "resolved" && (
        <div className="support-resolution-card" role="region" aria-label="Resolution confirmation">
          <h3 className="support-resolution-title">
            {t("support.ticket.resolvedBannerTitle")}
          </h3>
          <p className="support-resolution-desc">
            {t("support.ticket.resolvedBannerDesc")}
          </p>
          <div className="support-resolution-actions">
            <button
              type="button"
              className="button primary button-icon"
              onClick={onConfirmResolution}
              disabled={confirming}
            >
              <Check size={16} />
              <span>
                {confirming
                  ? t("support.ticket.confirming")
                  : t("support.ticket.btnConfirmFixed")}
              </span>
            </button>
            <button
              type="button"
              className="button secondary button-icon"
              onClick={onToggleShowReopenInput}
            >
              <RotateCcw size={16} />
              <span>{t("support.ticket.btnNotFixed")}</span>
            </button>
          </div>

          {showReopenInput && (
            <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
              <label htmlFor="reopen-reason" className="form-label" style={{ fontSize: "13px" }}>
                {t("support.ticket.reopenReasonPrompt")}
              </label>
              <textarea
                id="reopen-reason"
                className="form-textarea"
                rows={3}
                value={reopenReason}
                onChange={(e) => onReopenReasonChange(e.target.value)}
                placeholder={t("support.ticket.reopenReasonPlaceholder")}
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  className="button primary"
                  onClick={onReopenTicket}
                  disabled={reopening}
                >
                  {reopening ? t("support.ticket.reopening") : t("support.ticket.btnSubmitReopen")}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={onToggleShowReopenInput}
                >
                  {t("support.commonCancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Closed Panel / Reopen Rule */}
      {status === "closed" && (
        <div className="support-closed-notice">
          {isWithin14Days ? (
            <>
              <div>
                <strong>{t("support.ticket.closedNoticeTitle")}</strong>
                <p className="text-muted" style={{ fontSize: "13px", margin: "4px 0 0" }}>
                  {t("support.ticket.closedWithin14Days")}
                </p>
              </div>
              <button
                type="button"
                className="button secondary button-icon"
                onClick={onToggleShowReopenInput}
              >
                <RotateCcw size={16} />
                <span>{t("support.ticket.btnReopen")}</span>
              </button>
            </>
          ) : (
            <>
              <div>
                <strong>{t("support.ticket.closedExpiredTitle")}</strong>
                <p className="text-muted" style={{ fontSize: "13px", margin: "4px 0 0" }}>
                  {t("support.ticket.closedExpiredDesc")}
                </p>
              </div>
              <button
                type="button"
                className="button primary support-raise-btn"
                onClick={onRaiseNewTicket}
              >
                {t("support.raiseTicket")}
              </button>
            </>
          )}

          {showReopenInput && isWithin14Days && (
            <div className="w-full mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
              <label htmlFor="closed-reopen-reason" className="form-label" style={{ fontSize: "13px" }}>
                {t("support.ticket.reopenReasonPrompt")}
              </label>
              <textarea
                id="closed-reopen-reason"
                className="form-textarea"
                rows={3}
                value={reopenReason}
                onChange={(e) => onReopenReasonChange(e.target.value)}
                placeholder={t("support.ticket.reopenReasonPlaceholder")}
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  className="button primary"
                  onClick={onReopenTicket}
                  disabled={reopening}
                >
                  {reopening ? t("support.ticket.reopening") : t("support.ticket.btnSubmitReopen")}
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={onToggleShowReopenInput}
                >
                  {t("support.commonCancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
