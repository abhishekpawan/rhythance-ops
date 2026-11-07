/**
 * Timesheet and invoice cards on the admin dashboard: fetching plus the mapping
 * from the API's metrics to card data (colour and icon per card).
 */
import { useState, useCallback, useEffect } from "react";
import {
  BarChart3,
  FileText,
  DollarSign,
  Gift,
  MinusCircle,
  Clock,
  Timer,
  Navigation,
  Layers,
} from "lucide-react";
import { MetricData } from "../../../components/dashboard/types";
import {
  getTimesheetMetrics,
  TimesheetMetric,
} from "../../../services/api/timesheetMetrics";
import {
  getInvoiceMetrics,
  InvoiceMetric,
} from "../../../services/api/invoiceMetrics";
import { MetricsState } from "./metricConfig";

type CardConfig = Record<string, { color: string; icon: JSX.Element }>;

const TIMESHEET_CONFIG: CardConfig = {
  total_timesheets: { color: "#6366F1", icon: <FileText size={20} /> },
  total_jobseeker_pay: { color: "#10B981", icon: <DollarSign size={20} /> },
  total_bonus_paid: { color: "#F59E0B", icon: <Gift size={20} /> },
  total_deduction: { color: "#EF4444", icon: <MinusCircle size={20} /> },
  total_regular_hours: { color: "#3B82F6", icon: <Clock size={20} /> },
  total_overtime_hours: { color: "#8B5CF6", icon: <Timer size={20} /> },
  total_miles_logged: { color: "#06B6D4", icon: <Navigation size={20} /> },
  total_non_hourly_units: { color: "#F43F5E", icon: <Layers size={20} /> },
};

const INVOICE_CONFIG: CardConfig = {
  total_invoices: { color: "#6366F1", icon: <FileText size={20} /> },
  total_billed: { color: "#10B981", icon: <DollarSign size={20} /> },
  total_hours_billed: { color: "#3B82F6", icon: <Clock size={20} /> },
  invoices_with_email: { color: "#F59E0B", icon: <Gift size={20} /> },
};

const toMetricData = (
  metric: TimesheetMetric | InvoiceMetric,
  configs: CardConfig,
  withRedirect: boolean
): MetricData => {
  const config = configs[metric.id] || {
    color: "#666666",
    icon: <BarChart3 size={20} />,
  };
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
    color: config.color,
    icon: config.icon,
    description: metric.description,
    historicalData: metric.historicalData.map((point) => ({
      ...point,
      date: typeof point.date === "string" ? new Date(point.date) : point.date,
    })),
    ...(withRedirect
      ? { redirectTo: (metric as InvoiceMetric).redirectTo }
      : {}),
  };
};

/** Fetches one card group once `enabled` turns true; `refetch` is the retry. */
function useCardGroup<T extends TimesheetMetric | InvoiceMetric>(
  enabled: boolean,
  load: () => Promise<{ metrics: T[] }>,
  configs: CardConfig,
  withRedirect: boolean,
  fallbackError: string
) {
  const [metrics, setMetrics] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await load();
      setMetrics(response.metrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackError);
    } finally {
      setLoading(false);
    }
  }, [load, fallbackError]);

  useEffect(() => {
    if (enabled) refetch();
  }, [enabled, refetch]);

  const state: MetricsState = {
    data: metrics.map((metric) => toMetricData(metric, configs, withRedirect)),
    loading,
    error,
  };
  return { state, refetch };
}

export function useTimesheetMetrics(enabled: boolean) {
  return useCardGroup<TimesheetMetric>(
    enabled,
    getTimesheetMetrics,
    TIMESHEET_CONFIG,
    false,
    "Failed to fetch timesheet metrics"
  );
}

export function useInvoiceMetrics(enabled: boolean) {
  return useCardGroup<InvoiceMetric>(
    enabled,
    getInvoiceMetrics,
    INVOICE_CONFIG,
    true,
    "Failed to fetch invoice metrics"
  );
}
