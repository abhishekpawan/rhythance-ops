import React from "react";
import { useLanguage } from "../../contexts/language/language-provider";
import { SupportTicket } from "../../types/support";
import { SupportStatusBadge } from "./SupportStatusBadge";
import { SupportTypeBadge } from "./SupportTypeBadge";
import { formatDate, formatTicketNumber } from "./supportTicketHelpers";

interface SupportTicketHeaderCardProps {
  ticket: SupportTicket;
}

export const SupportTicketHeaderCard: React.FC<
  SupportTicketHeaderCardProps
> = ({ ticket }) => {
  const { t } = useLanguage();

  return (
    <div className="support-ticket-header-card">
      <div className="support-ticket-title-row">
        <div className="support-ticket-title-left">
          <span className="support-ticket-id">
            {formatTicketNumber(ticket.ticketNumber)}
          </span>
          <SupportTypeBadge type={ticket.type} />
        </div>
        <div className="support-ticket-status-pill">
          <SupportStatusBadge status={ticket.status} />
        </div>
      </div>

      <div className="support-ticket-meta-grid">
        <div className="support-meta-item">
          <span className="support-meta-label">
            {t("support.ticket.urgency")}
          </span>
          <span className="support-meta-value">
            {t(`support.urgency.${ticket.urgency}`)}
          </span>
        </div>
        <div className="support-meta-item">
          <span className="support-meta-label">{t("support.raisedBy")}</span>
          <span className="support-meta-value">
            {ticket.requesterName || "User"}
          </span>
        </div>
        <div className="support-meta-item">
          <span className="support-meta-label">
            {t("support.ticket.openedOn")}
          </span>
          <span className="support-meta-value">
            {formatDate(ticket.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
};
