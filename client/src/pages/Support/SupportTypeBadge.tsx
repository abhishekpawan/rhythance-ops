import React from "react";
import { Bug, FileEdit, Sparkles, HelpCircle } from "lucide-react";
import { useLanguage } from "../../contexts/language/language-provider";
import { StatusBadge } from "../../components/StatusBadge";
import { SupportTicketType } from "../../types/support";

interface SupportTypeBadgeProps {
  type: SupportTicketType;
  className?: string;
  showIcon?: boolean;
}

export const SupportTypeBadge: React.FC<SupportTypeBadgeProps> = ({
  type,
  className = "",
  showIcon = true,
}) => {
  const { t } = useLanguage();

  const renderIcon = () => {
    if (!showIcon) return null;
    switch (type) {
      case "bug":
        return (
          <Bug size={13} className="support-type-icon" aria-hidden="true" />
        );
      case "change":
        return (
          <FileEdit
            size={13}
            className="support-type-icon"
            aria-hidden="true"
          />
        );
      case "feature":
        return (
          <Sparkles
            size={13}
            className="support-type-icon"
            aria-hidden="true"
          />
        );
      case "question":
        return (
          <HelpCircle
            size={13}
            className="support-type-icon"
            aria-hidden="true"
          />
        );
      default:
        return null;
    }
  };

  return (
    <StatusBadge
      baseClass="support-type-tag"
      tone={`support-type-${type}`}
      label={t(`support.types.${type}`)}
      className={className}
      variant="tag"
      icon={renderIcon()}
    />
  );
};
