/**
 * Building blocks shared by the admin and recruiter dashboards.
 */
import { FileText, Target } from "lucide-react";
import { MetricCard } from "../../../components/dashboard/MetricCard";
import { MetricData } from "../../../components/dashboard/types";
import { type AIInsightsResponse } from "../../../services/api/aiInsights";
import { useLanguage } from "../../../contexts/language/language-provider";
import { MetricsState } from "./metricConfig";

interface DataViewToggleProps {
  id: string;
  checked?: boolean;
  /** Without a handler there is no "Show all" switch (admins always see all). */
  onChange?: () => void;
  label: string;
  description: string;
  /** The admin dashboard renders the label as a heading. */
  labelAs?: "h1" | "span";
}

export function DataViewToggle({
  id,
  checked = false,
  onChange,
  label,
  description,
  labelAs: Label = "span",
}: DataViewToggleProps) {
  const { t } = useLanguage();

  return (
    <div className="data-view-toggle">
      <div className="data-view-info">
        <Label className="data-view-label">{label}</Label>
        <p className="data-view-description">{description}</p>
      </div>
      <div className="data-view-controls">
        {onChange && (
          <>
            <input
              type="checkbox"
              id={id}
              className="toggle-form"
              checked={checked}
              onChange={onChange}
            />
            <label htmlFor={id} className="label-form toggle-label">
              {t("common.showAll")}
            </label>
          </>
        )}
      </div>
    </div>
  );
}

interface MetricGridProps {
  metricsState: MetricsState;
  expandedGraphs: Set<string>;
  onMetricClick: (metric: MetricData) => void;
  onToggleGraph: (show: boolean, metricId?: string) => void;
  onRetry: () => void;
  gridSize: number;
  /** Show every returned card even when there are more than gridSize. */
  growWithData?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  redirectToValue?: string;
}

export function MetricGrid({
  metricsState,
  expandedGraphs,
  onMetricClick,
  onToggleGraph,
  onRetry,
  gridSize,
  growWithData = false,
  size = "sm",
  className = "",
  redirectToValue,
}: MetricGridProps) {
  const displayCount = growWithData
    ? Math.max(gridSize || 0, metricsState.data.length)
    : gridSize;

  return (
    <div className={`metrics-grid compact ${className}`}>
      {Array.from({ length: displayCount }, (_, index) => {
        const metric = metricsState.data[index];
        const isExpanded = metric ? expandedGraphs.has(metric.id) : false;

        return (
          <div
            key={metric?.id || `loading-${index}`}
            className={`metric-card-container ${
              isExpanded ? "expanded-grid-item" : ""
            }`}
          >
            <MetricCard
              data={
                metric || {
                  id: `loading-${index}`,
                  label: "",
                  currentValue: 0,
                  previousValue: 0,
                  historicalData: [],
                }
              }
              size={size}
              showGraph={false}
              onClick={metric ? onMetricClick : undefined}
              onToggleGraph={
                metric ? (show) => onToggleGraph(show, metric.id) : undefined
              }
              loading={metricsState.loading || !metric}
              error={metricsState.error}
              onRetry={onRetry}
              className={`metric-transition-${index}`}
              redirectTo={metric?.redirectTo || redirectToValue}
            />
          </div>
        );
      })}
    </div>
  );
}

interface AISummaryProps {
  basicAiInsights: AIInsightsResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function AISummary({
  basicAiInsights,
  loading,
  error,
  onRetry,
}: AISummaryProps) {
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="ai-summary-loading">
        {/* Loading skeleton for AI summary stats */}
        <div className="ai-summary-stats">
          {[1, 2].map((index) => (
            <div key={index} className="ai-stat-item">
              <div className="ai-stat-icon-skeleton">
                <div className="skeleton-icon"></div>
              </div>
              <div className="ai-stat-details">
                <div
                  className="skeleton-text"
                  style={{
                    width: "180px",
                    height: "20px",
                    marginBottom: "var(--spacing-1)",
                  }}
                ></div>
                <div
                  className="skeleton-text"
                  style={{ width: "240px", height: "14px" }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ai-summary-error">
        <p className="error-text">{error}</p>
        <button className="retry-button" onClick={onRetry}>
          {t("buttons.tryAgain")}
        </button>
      </div>
    );
  }

  if (!basicAiInsights) {
    return null;
  }

  return (
    <div className="ai-summary-stats">
      <div className="ai-stat-item">
        <div className="ai-stat-icon documents">
          <FileText size={28} />
        </div>
        <div className="ai-stat-details">
          <p className="ai-stat-value">
            {basicAiInsights.totalDocumentsScanned.toLocaleString()}{" "}
            {t("dashboard.documentsScanned")}
          </p>
          <p className="ai-stat-description">
            {basicAiInsights.summary.documentsScanned.description}
          </p>
        </div>
      </div>

      <div className="ai-stat-item">
        <div className="ai-stat-icon positions">
          <Target size={28} />
        </div>
        <div className="ai-stat-details">
          <p className="ai-stat-value">
            {basicAiInsights.totalJobseekersMatched.toLocaleString()}{" "}
            {t("dashboard.positionSlots")}
          </p>
          <p className="ai-stat-description">
            {basicAiInsights.summary.jobseekersMatched.description}
          </p>
        </div>
      </div>
    </div>
  );
}
