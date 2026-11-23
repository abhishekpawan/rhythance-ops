import React from "react";

interface StatusBadgeProps {
  /** the class every badge of this family has, for example `support-badge` */
  baseClass: string;
  /** the class that colours this one, for example `support-badge-open` */
  tone: string;
  /** the text, already translated */
  label: string;
  /** an extra class from the page that uses the badge */
  className?: string;
  /**
   * `dot`: a coloured dot before the text, announced as a status (`<baseClass>-dot` and `-label` spans); `tag`: an
   * optional icon before the text, the text in its own span; `plain`: the optional icon and the bare text in the one
   * span, with no extra class when `className` is empty
   */
  variant?: "dot" | "tag" | "plain";
  icon?: React.ReactNode;
}

/**
 * A small coloured pill with a text. It writes the classes a page passes in, in the order the page used to write
 * them, so that the page's stylesheet keeps applying; the colours themselves stay in that stylesheet.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  baseClass,
  tone,
  label,
  className = "",
  variant = "dot",
  icon,
}) =>
  variant === "plain" ? (
    <span className={`${baseClass} ${tone}${className && ` ${className}`}`}>
      {icon}
      {label}
    </span>
  ) : variant === "dot" ? (
    <span className={`${baseClass} ${tone} ${className}`} role="status">
      <span className={`${baseClass}-dot`} aria-hidden="true" />
      <span className={`${baseClass}-label`}>{label}</span>
    </span>
  ) : (
    <span className={`${baseClass} ${tone} ${className}`}>
      {icon}
      <span>{label}</span>
    </span>
  );
