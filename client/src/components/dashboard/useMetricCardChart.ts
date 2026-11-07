/**
 * Chart state of a metric card: which range is shown (the 30-day daily chart by
 * default, the 12-month chart on request), the points to draw and how to draw them.
 */
import { useMemo, useState } from "react";
import {
  transformToChartData,
  transformDailyToChartData,
  getChartColor,
  formatValue,
} from "./utils";
import { useLanguage } from "../../contexts/language/language-provider";
import type { ChartConfig, GrowthData, MetricData } from "./types";
import type { ChartRange } from "./MetricCardParts";

export function useMetricCardChart(
  data: MetricData,
  graphType: "line" | "pie",
  timeRange: "1m" | "3m" | "6m" | "1y",
  trend: GrowthData["trend"]
) {
  const { t, language } = useLanguage();

  // The chart opens on the same 30 days the badge measures (with the previous 30
  // days dashed behind it); "12 months" shows the longer monthly history.
  const hasDaily = Boolean(data.dailyData && data.dailyData.length > 0);
  const [range, setRange] = useState<ChartRange>("30d");
  const activeRange = hasDaily ? range : "12m";

  const chartData = useMemo(() => {
    if (activeRange === "30d" && data.dailyData) {
      return transformDailyToChartData(data.dailyData, language);
    }
    if (!data.historicalData || data.historicalData.length === 0) return [];
    return transformToChartData(data.historicalData, timeRange, language);
  }, [activeRange, data.dailyData, data.historicalData, timeRange, language]);

  const chartConfig: ChartConfig = useMemo(
    () => ({
      type: graphType,
      color: data.color || getChartColor(trend),
      showGrid: true,
      showAxes: false,
      animate: true,
      valueFormatter: (value: number) =>
        formatValue(value, data.formatType, data.unit),
      inProgressLabel: t("dashboard.metricInProgress"),
      seriesLabels: {
        current: t("dashboard.metricLast30Days"),
        previous: t("dashboard.metricPrevious30Days"),
      },
    }),
    [graphType, data.color, data.formatType, data.unit, trend, t]
  );

  // Check if historical data has any non-zero values
  const hasValidHistoricalData = useMemo(() => {
    const monthly = (data.historicalData || []).some(
      (point) => point.value > 0
    );
    const daily = (data.dailyData || []).some(
      (point) => point.value > 0 || point.previousValue > 0
    );
    return monthly || daily;
  }, [data.historicalData, data.dailyData]);

  return {
    hasDaily,
    activeRange,
    setRange,
    chartData,
    chartConfig,
    hasValidHistoricalData,
  };
}
