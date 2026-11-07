/** Hover boxes of the metric charts. */
import React from "react";
import { ChartDataPoint } from "./types";
import "./MetricChart.css";

// Custom tooltip component for line charts. Shows the period with its value and,
// when a comparison series is drawn, the matching earlier period with its value.
interface LineTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: ChartDataPoint }>;
  label?: string;
  format: (value: number) => string;
  inProgressLabel?: string;
  color: string;
}

export const CustomLineTooltip: React.FC<LineTooltipProps> = ({
  active,
  payload,
  label,
  format,
  inProgressLabel,
  color,
}) => {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload;
  const title = point.title || label;
  return (
    <div className="metric-chart-tooltip">
      <p className="metric-chart-tooltip-title">
        {title}
        {point.inProgress && inProgressLabel ? ` (${inProgressLabel})` : ""}
      </p>
      <p className="metric-chart-tooltip-value" style={{ color }}>
        <span className="metric-chart-tooltip-strong">
          {format(point.value)}
        </span>
      </p>
      {point.previousValue !== undefined && (
        <p className="metric-chart-tooltip-previous">
          {point.previousTitle}:{" "}
          <span className="metric-chart-tooltip-strong">
            {format(point.previousValue)}
          </span>
        </p>
      )}
    </div>
  );
};

// Custom tooltip component for pie charts
interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: ChartDataPoint }>;
}

export const CustomPieTooltip: React.FC<PieTooltipProps> = ({
  active,
  payload,
}) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="metric-chart-tooltip">
        <p className="metric-chart-tooltip-title">{data.name}</p>
        <p className="metric-chart-tooltip-previous">
          Value:{" "}
          <span className="metric-chart-tooltip-strong">
            {data.value.toLocaleString()}
          </span>
        </p>
      </div>
    );
  }
  return null;
};
