import React from "react";

// Reusable Activity Skeleton Component
export const ActivitySkeleton: React.FC<{
  index: number;
  keyPrefix?: string;
}> = ({ index, keyPrefix = "" }) => (
  <div key={`${keyPrefix}${index}`} className="activity-item activity-skeleton">
    <div className="activity-icon activity-icon-skeleton">
      <div className="skeleton-icon"></div>
    </div>

    <div className="activity-content">
      <div className="activity-main">
        <div className="activity-message-skeleton">
          <div
            className="skeleton-text"
            style={{
              width: `${60 + index * 8}%`,
              height: "14px",
              marginBottom: "var(--spacing-1)",
            }}
          ></div>
          <div
            className="skeleton-text"
            style={{ width: `${40 + index * 6}%`, height: "14px" }}
          ></div>
        </div>
        <div className="activity-meta activity-meta-skeleton">
          <div
            className="skeleton-text"
            style={{ width: "60px", height: "12px" }}
          ></div>
          <div className="skeleton-icon-small"></div>
        </div>
      </div>
    </div>

    <div className="activity-category">
      <div
        className="skeleton-text category-badge-skeleton"
        style={{ width: "70px", height: "16px" }}
      ></div>
    </div>
  </div>
);
