import React, { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import MetricChart from "./MetricChart";
import {
  MetricCardError,
  MetricCardSkeleton,
  MetricRangeToggle,
} from "./MetricCardParts";
import { processMetricData } from "./utils";
import { useMetricCardChart } from "./useMetricCardChart";
import { useLanguage } from "../../contexts/language/language-provider";
import type { MetricData, FormattedMetric } from "./types";
import "./MetricCard.css";
import "./MetricCard.growth.css";
import "./MetricCard.states.css";
import { useNavigate } from "react-router-dom";

export interface MetricCardProps {
  data: MetricData;
  size?: "sm" | "md" | "lg";
  showGraph?: boolean;
  graphType?: "line" | "pie";
  timeRange?: "1m" | "3m" | "6m" | "1y";
  layout?: "vertical" | "horizontal";
  onClick?: (metric: MetricData) => void;
  onToggleGraph?: (show: boolean) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
  redirectTo?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  data,
  size = "md",
  showGraph = false,
  graphType = "line",
  timeRange = "1y",
  layout = "vertical",
  onClick,
  onToggleGraph,
  loading = false,
  error,
  onRetry,
  className = "",
  redirectTo,
}) => {
  const [graphVisible, setGraphVisible] = useState(showGraph);
  const cardRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const processedData: FormattedMetric = useMemo(() => {
    return processMetricData(data);
  }, [data]);

  const { hasDaily, activeRange, setRange, chartData, chartConfig, hasValidHistoricalData } =
    useMetricCardChart(data, graphType, timeRange, processedData.growth.trend);

  const handleToggleGraph = () => {
    const newState = !graphVisible;
    setGraphVisible(newState);
    onToggleGraph?.(newState);
    
    // Scroll into view when graph is expanded
    if (newState && cardRef.current) {
      // Use setTimeout to wait for the animation to start
      setTimeout(() => {
        cardRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }, 150); // Small delay to let the expansion animation begin
    }
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(data);
    }
    if (redirectTo) {
      navigate(redirectTo);
    }
  };

  const renderGrowthIcon = (isPositive: boolean) => {
    if (processedData.growth.trend === "stable")
      return <Minus className="metric-card-growth-icon" />;
    return isPositive ? (
      <TrendingUp className="metric-card-growth-icon" />
    ) : (
      <TrendingDown className="metric-card-growth-icon" />
    );
  };

  if (error) {
    return (
      <MetricCardError
        label={data.label}
        error={error}
        size={size}
        className={className}
        onRetry={onRetry}
      />
    );
  }

  if (loading) {
    return <MetricCardSkeleton size={size} className={className} />;
  }

  const cardClasses = [
    "metric-card",
    `size-${size}`,
    onClick ? "clickable" : "",
    loading ? "loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const contentClasses = [
    "metric-card-content",
    layout === "horizontal" ? "horizontal" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const valueSectionClasses = [
    "metric-card-value-section",
    layout === "horizontal" ? "horizontal" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const chartContainerClasses = [
    "metric-card-chart-container",
    layout === "horizontal" ? "horizontal" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClasses} onClick={handleCardClick} ref={cardRef}>
     

      {/* Content */}
      <div className={contentClasses}>
        <div className={valueSectionClasses}>
           {/* Header */}
      <div className="metric-card-header">
        <div className="metric-card-info">
          {data.icon && (
            <div
              className="metric-card-icon"
              style={{
                backgroundColor: `${data.color}20`,
                color: data.color,
              }}
            >
              {data.icon}
            </div>
          )}
          <div className="metric-card-title-section">
            <h3 className={`metric-card-title size-${size}`}>{data.label}</h3>
            {data.description && (
              <p className={`metric-card-description size-${size}`}>
                {data.description}
              </p>
            )}
          </div>
        </div>

        {hasValidHistoricalData && layout !== "horizontal" && (
          <div className="metric-card-controls">
            <button
              className={`chart-toggle-button ${graphVisible ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleGraph();
              }}
              title={graphVisible ? "Hide graph" : "Show graph"}
            >
              <BarChart3 size={16} />
            </button>
          </div>
        )}
      </div>
          {/* Growth Information */}
          {processedData.growth && (
            <div className="metric-card-growth-section">
              <div
                className={`metric-card-growth-badge ${
                  processedData.growth.trend === "stable"
                    ? "neutral"
                    : processedData.growth.isPositive
                    ? "positive"
                    : "negative"
                }`}
              >
                {renderGrowthIcon(processedData.growth.isPositive)}
                <span className={`metric-card-growth-text size-${size}`}>
                  {processedData.formattedGrowth}
                </span>
              </div>
              <span className={`metric-card-period-comparison size-${size}`}>
                {t("dashboard.metricVsPrevious30Days")}
              </span>
            </div>
          )}

          {/* Main Value */}
          <div className="metric-card-value-container">
            <h2 className={`metric-card-value size-${size}`}>
              {processedData.displayValue}
            </h2>
          </div>

          {/* The badge above is the last 30 days against the 30 days before */}
          <p className={`metric-card-previous size-${size} ${
            data.currentPeriodValue !== undefined || data.previousValue ? '' : 'invisible'
          }`}>
            {data.currentPeriodValue !== undefined && (
              <span style={{ display: 'block' }}>
                {t("dashboard.metricLast30Days")}: {processedData.displayCurrentPeriod}
              </span>
            )}
            <span style={{ display: 'block' }}>
              {t("dashboard.metricPrevious30Days")}:{" "}
              {data.previousValue ? processedData.displayPrevious : '--'}
            </span>
          </p>
        </div>

        {/* Chart */}
        <AnimatePresence>
          {((graphVisible && layout !== "horizontal") || layout === "horizontal") && chartData.length > 0 && (
            <motion.div
              className={chartContainerClasses}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
            >
              {hasDaily && (
                <MetricRangeToggle
                  value={activeRange}
                  onChange={setRange}
                  labels={{
                    "30d": t("dashboard.metricRange30Days"),
                    "12m": t("dashboard.metricRange12Months"),
                  }}
                />
              )}
              <div className="metric-card-chart-wrapper">
                <MetricChart
                  data={chartData}
                  config={chartConfig}
                  width="100%"
                  height={layout === "horizontal" ? 200 : 200}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MetricCard;
