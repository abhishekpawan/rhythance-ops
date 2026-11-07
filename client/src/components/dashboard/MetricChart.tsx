import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useTheme } from "../theme-provider";
import { ChartDataPoint, ChartConfig } from "./types";
import { CustomLineTooltip, CustomPieTooltip } from "./MetricChartTooltips";

interface MetricChartProps {
  data: ChartDataPoint[];
  config: ChartConfig;
  width?: string | number;
  height?: number;
  className?: string;
}

// Color palette for pie charts
const PIE_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#F97316", // Orange
  "#EC4899", // Pink
  "#6B7280", // Gray
];

const MetricChart: React.FC<MetricChartProps> = ({
  data,
  config,
  width = "100%",
  height = 300,
  className = "",
}) => {
  const { 
    type, 
    color, 
    showGrid = true, 
    animate = true,
    innerRadius = 0,
    outerRadius,
    showLabels = true,
    showLegend = false,
    valueFormatter,
    inProgressLabel,
    seriesLabels,
  } = config;
  const formatTooltipValue =
    valueFormatter || ((value: number) => value.toLocaleString());
  // A comparison series (previous period) is drawn when the points carry one.
  const hasComparison = data.some((point) => point.previousValue !== undefined);
  const PREVIOUS_COLOR = "#9CA3AF";

  // Use theme provider to detect current theme
  const { theme } = useTheme();
  const isDarkMode =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  // Theme-based colors
  const themeColors = {
    grid: isDarkMode ? "#9ca3af" : "#2d3748",
    gridOpacity: 1,
    text: isDarkMode ? "#ffffff" : "#2d3748",
    axis: isDarkMode ? "#f7fafc" : "#1a202c",
  };

  // Prepare data for charts
  const chartData = data.map((point, index) => ({
    ...point,
    name: point.tick || point.label || point.period,
    fill: point.fill || PIE_COLORS[index % PIE_COLORS.length],
  }));

  // Format Y-axis values
  const formatYAxisTick = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  // Axis labels come ready-made from the data (tick); only fall back to
  // trimming "Jan 2024" to "Jan" for data without one.
  const formatXAxisTick = (value: string) =>
    data.some((point) => point.tick) ? value : value.split(" ")[0];

  // Render pie chart label
  const renderPieLabel = (entry: ChartDataPoint) => {
    if (!showLabels) return null;
    return `${entry.name}: ${entry.value}`;
  };

  // Switch between chart types
  const renderChart = () => {
    switch (type) {
      case "pie":
        return (
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={showLabels ? renderPieLabel : false}
              outerRadius={outerRadius || Math.min(height * 0.35, 120)}
              innerRadius={innerRadius}
              fill={color}
              dataKey="value"
              animationDuration={animate ? 1000 : 0}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomPieTooltip />} />
            {showLegend && (
              <Legend 
                wrapperStyle={{ 
                  fontSize: '12px', 
                  color: themeColors.text,
                  fontFamily: 'var(--font-family)'
                }} 
              />
            )}
          </PieChart>
        );

      case "line":
      default:
        return (
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
          >
            {showGrid && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={themeColors.grid}
                opacity={themeColors.gridOpacity}
              />
            )}
            <XAxis
              dataKey="name"
              tick={{
                fontSize: 11,
                fill: themeColors.text,
                fontFamily: "var(--font-family)",
              }}
              tickLine={{ stroke: themeColors.axis }}
              axisLine={{ stroke: themeColors.axis }}
              tickFormatter={formatXAxisTick}
              // 30 daily points cannot all carry a label; show about one a week.
              interval={chartData.length > 16 ? 6 : 0}
            />
            <YAxis
              tick={{
                fontSize: 11,
                fill: themeColors.text,
                fontFamily: "var(--font-family)",
              }}
              tickLine={{ stroke: themeColors.axis }}
              axisLine={{ stroke: themeColors.axis }}
              tickFormatter={formatYAxisTick}
              width={40}
            />
            <Tooltip
              content={
                <CustomLineTooltip
                  format={formatTooltipValue}
                  inProgressLabel={inProgressLabel}
                  color={color}
                />
              }
            />
            {hasComparison && seriesLabels && (
              <Legend
                verticalAlign="top"
                height={24}
                // Current period first, then the dashed previous period.
                payload={[
                  { id: "value", value: seriesLabels.current, type: "line", color },
                  {
                    id: "previousValue",
                    value: seriesLabels.previous,
                    type: "plainline",
                    color: PREVIOUS_COLOR,
                    payload: { strokeDasharray: "5 4" },
                  },
                ]}
                wrapperStyle={{
                  fontSize: "12px",
                  color: themeColors.text,
                  fontFamily: "var(--font-family)",
                }}
              />
            )}
            {hasComparison && (
              <Line
                type="monotone"
                dataKey="previousValue"
                name={seriesLabels?.previous}
                stroke={PREVIOUS_COLOR}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 3, fill: PREVIOUS_COLOR, stroke: PREVIOUS_COLOR }}
                animationDuration={animate ? 1000 : 0}
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              name={seriesLabels?.current}
              stroke={color}
              strokeWidth={2.5}
              // Daily series: no dots (30 of them would clutter). Monthly: a dot per
              // month, hollow on the month still in progress.
              dot={
                hasComparison
                  ? false
                  : (props: { cx?: number; cy?: number; index?: number }) => {
                      const { cx, cy, index = 0 } = props;
                      if (cx === undefined || cy === undefined) return <g key={index} />;
                      const inProgress = chartData[index]?.inProgress;
                      return (
                        <circle
                          key={index}
                          cx={cx}
                          cy={cy}
                          r={3}
                          stroke={color}
                          strokeWidth={2}
                          fill={inProgress ? "white" : color}
                          fillOpacity={inProgress ? 1 : 0.8}
                        />
                      );
                    }
              }
              activeDot={{
                r: 5,
                stroke: color,
                strokeWidth: 2,
                fill: "white",
              }}
              animationDuration={animate ? 1000 : 0}
              connectNulls={false}
            />
          </LineChart>
        );
    }
  };

  return (
    <ResponsiveContainer width={width} height={height} className={className}>
      {renderChart()}
    </ResponsiveContainer>
  );
};

export default MetricChart;
