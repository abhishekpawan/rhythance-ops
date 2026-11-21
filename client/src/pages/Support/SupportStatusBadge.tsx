import React from "react";
import { useLanguage } from "../../contexts/language/language-provider";
import { StatusBadge } from "../../components/StatusBadge";
import { SupportTicketStatus } from "../../types/support";

interface SupportStatusBadgeProps {
  status: SupportTicketStatus;
  className?: string;
}

export const SupportStatusBadge: React.FC<SupportStatusBadgeProps> = ({
  status,
  className = "",
}) => {
  const { t } = useLanguage();

  const getStatusLabel = (s: SupportTicketStatus): string => {
    switch (s) {
      case "open":
        return t("support.status.open");
      case "in_progress":
        return t("support.status.in_progress");
      case "waiting_on_client":
        return t("support.status.waiting_on_client");
      case "resolved":
        return t("support.status.resolved");
      case "closed":
        return t("support.status.closed");
      default:
        return s;
    }
  };

  return (
    <StatusBadge
      baseClass="support-badge"
      tone={`support-badge-${status}`}
      label={getStatusLabel(status)}
      className={className}
    />
  );
};
