/**
 * Cache keys and the API-to-card mapping shared by the admin and recruiter
 * dashboards (kept apart from metricConfig.tsx, which holds only constants).
 */
import { createElement } from "react";
import { BarChart3 } from "lucide-react";
import { MetricData } from "../../../components/dashboard/types";
import {
  APIResponse,
  CACHE_DURATION,
  METRIC_CONFIGS,
  MetricsType,
} from "./metricConfig";

export const getCacheKey = (
  type: MetricsType,
  showAll?: boolean,
  userId?: string
) => {
  if (type === "aiInsights") {
    return "aiInsights_all";
  }
  return showAll ? `${type}_all` : `${type}_${userId}`;
};

export const isCacheValid = (timestamp: number) =>
  Date.now() - timestamp < CACHE_DURATION;

export const transformMetricsResponse = (
  response: APIResponse,
  configType: keyof typeof METRIC_CONFIGS
): MetricData[] => {
  const config = METRIC_CONFIGS[configType] as Record<
    string,
    { color: string; icon: JSX.Element }
  >;

  return response.metrics.map((metric) => {
    const metricInfo = config[metric.id];
    return {
      id: metric.id,
      label: metric.label,
      currentValue: metric.currentValue,
      currentPeriodValue: metric.currentPeriodValue,
      dailyData: metric.dailyData,
      previousValue: metric.previousValue,
      unit: metric.unit,
      formatType: metric.formatType as
        "number" | "currency" | "percentage" | "duration",
      color: metricInfo?.color || "#666666",
      icon: metricInfo?.icon || createElement(BarChart3, { size: 20 }),
      description: metric.description,
      historicalData: metric.historicalData.map((point) => ({
        period: point.period,
        value: point.value,
        date:
          typeof point.date === "string" ? new Date(point.date) : point.date,
      })),
      redirectTo: metric.redirectTo,
    };
  });
};
