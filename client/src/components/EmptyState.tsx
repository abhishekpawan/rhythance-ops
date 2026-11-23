import React from "react";

interface EmptyStateProps {
  /** the picture above the title, already sized and coloured by the page */
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  /** a button or link under the text */
  action?: React.ReactNode;
  /**
   * The page's own class. The block then carries only that class: no inline styles, and the page's stylesheet draws it
   * (the admin pages, the email preview and the training list have always styled their empty blocks that way).
   */
  className?: string;
}

/**
 * The friendly "nothing here yet" block inside a card: centred icon, title, a line of text and an optional action.
 * Its inline styles are the ones the Support list wrote by hand, kept so that page looks the same. With a `className`
 * it is only the markup (icon, title, text, action) under the page's own class.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) =>
  className ? (
    <div className={className}>
      {icon}
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
      {action}
    </div>
  ) : (
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
