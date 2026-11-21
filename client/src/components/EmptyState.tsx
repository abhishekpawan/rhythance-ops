import React from "react";

interface EmptyStateProps {
  /** the picture above the title, already sized and coloured by the page */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** a button or link under the text */
  action?: React.ReactNode;
}

/**
 * The friendly "nothing here yet" block inside a card: centred icon, title, a line of text and an optional action.
 * Its inline styles are the ones the Support list wrote by hand, kept so that page looks the same.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => (
  <div style={{ textAlign: "center", padding: "64px 20px" }}>
    {icon}
    <h3
      style={{
        fontSize: "18px",
        marginBottom: "8px",
        color: "var(--text)",
      }}
    >
      {title}
    </h3>
    {description && (
      <p
        style={{
          color: "var(--text-muted)",
          maxWidth: "420px",
          margin: "0 auto 24px",
        }}
      >
        {description}
      </p>
    )}
    {action}
  </div>
);
