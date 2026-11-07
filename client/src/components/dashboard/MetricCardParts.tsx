/**
 * The pieces of a metric card that stand on their own: its error and loading
 * versions, and the 30 days / 12 months switch above the chart.
 */
import React from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

type Size = "sm" | "md" | "lg";

interface MetricCardErrorProps {
  label?: string;
  error: string;
  size: Size;
  className: string;
  onRetry?: () => void;
}

export const MetricCardError: React.FC<MetricCardErrorProps> = ({
  label,
  error,
  size,
  className,
  onRetry,
}) => (
  <div className={`metric-card-error size-${size} ${className}`}>
    {/* Header */}
    <div className="metric-card-header">
      <div className="metric-card-info">
        <div className="metric-card-icon error-icon">
          <AlertCircle size={20} />
        </div>
        <div className="metric-card-title-section">
          <h3 className={`metric-card-title size-${size}`}>
            {label || "Metric"}
          </h3>
          <p className={`metric-card-description size-${size}`}>
            Failed to load data
          </p>
        </div>
      </div>
      {onRetry && (
        <div className="metric-card-controls">
          <button
            className="retry-button"
            onClick={onRetry}
            title="Retry loading data"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      )}
    </div>

    {/* Error Message */}
    <div className="metric-card-content">
      <div className="metric-card-error-content">
        <div className="metric-card-error-message">
          <p className={`metric-card-error-text size-${size}`}>{error}</p>
        </div>
      </div>
    </div>
  </div>
);

export const MetricCardSkeleton: React.FC<{
  size: Size;
  className: string;
}> = ({ size, className }) => (
  <div className={`metric-card-skeleton size-${size} ${className}`}>
    {/* Header Skeleton */}
    <div className="metric-card-header">
      <div className="metric-card-info">
        <div className="skeleton-icon metric-card-icon-skeleton"></div>
        <div className="metric-card-title-section">
          <div className="skeleton-text skeleton-title"></div>
          <div className="skeleton-text skeleton-description"></div>
        </div>
      </div>
      <div className="metric-card-controls">
        <div className="skeleton-icon skeleton-chart-toggle"></div>
      </div>
    </div>

    {/* Content Skeleton */}
    <div className="metric-card-content">
      <div className="metric-card-value-section">
        {/* Growth Section Skeleton */}
        <div className="metric-card-growth-section">
          <div className="skeleton-growth-badge">
            <div className="skeleton-icon skeleton-growth-icon"></div>
            <div className="skeleton-text skeleton-growth-text"></div>
          </div>
          <div className="skeleton-text skeleton-period-comparison"></div>
        </div>

        {/* Main Value Skeleton */}
        <div className="metric-card-value-container">
          <div className="skeleton-text skeleton-value"></div>
        </div>
      </div>
    </div>
  </div>
);

export type ChartRange = "30d" | "12m";

interface MetricRangeToggleProps {
  value: ChartRange;
  onChange: (range: ChartRange) => void;
  labels: Record<ChartRange, string>;
}

/** Switch between the 30-day daily chart and the 12-month chart. */
export const MetricRangeToggle: React.FC<MetricRangeToggleProps> = ({
  value,
  onChange,
  labels,
}) => (
  <div
    className="metric-range-toggle"
    role="group"
    // The card itself is clickable (it opens a page); the switch must not be.
    onClick={(e) => e.stopPropagation()}
  >
    {(["30d", "12m"] as const).map((option) => (
      <button
        key={option}
        type="button"
        className={value === option ? "active" : ""}
        aria-pressed={value === option}
        onClick={() => onChange(option)}
      >
        {labels[option]}
      </button>
    ))}
  </div>
);
