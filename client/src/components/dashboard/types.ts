export interface HistoricalDataPoint {
  period: string; // "2024-01", "2023-12", etc.
  value: number; // actual count/value for that period
  date: Date; // for proper chronological ordering
  label?: string; // optional display label
}

/** One day of the 30-day trend: this window's day and the same day 30 days earlier. */
export interface DailyDataPoint {
  date: string; // "YYYY-MM-DD", Toronto calendar day
  value: number;
  previousValue: number;
}

export interface MetricData {
  id: string; // unique identifier
  label: string; // display name
  currentValue: number; // headline value (the running total)
  currentPeriodValue?: number; // added in the last 30 days; the trend compares this with previousValue
  previousValue: number; // added in the 30 days before that
  dailyData?: DailyDataPoint[]; // the two 30-day windows day by day (the default chart)
  unit?: string; // 'jobs', '$', '%', 'days', etc.
  formatType?:
    | "number"
    | "currency"
    | "percentage"
    | "duration"
    | "decimal" // exact value with thousands separators, up to 2 decimals (no K/M)
    | "currency_precise"; // exact dollars and cents

  historicalData: HistoricalDataPoint[];
  redirectTo?: string;
  // Visual customization
  color?: string;
  icon?: string | React.ReactNode;
  description?: string;
}

export interface MetricCardProps {
  data: MetricData;

  // Display options (optional)
  size?: "sm" | "md" | "lg";
  showGraph?: boolean;
  graphType?: "line" | "pie";
  timeRange?: "1m" | "3m" | "6m" | "1y";

  // Layout options
  orientation?: "horizontal" | "vertical";
  showComparison?: boolean;
  showTrend?: boolean;

  // Interaction
  onToggleGraph?: () => void;
  onClick?: (metric: MetricData) => void;
  onTimeRangeChange?: (range: string) => void;

  // Styling
  className?: string;
  cardClassName?: string;

  // Loading state
  isLoading?: boolean;
}

export interface ChartConfig {
  type: "line" | "pie";
  color: string;
  height?: number;
  showGrid?: boolean;
  showAxes?: boolean;
  animate?: boolean;
  responsive?: boolean;
  // Pie chart specific options
  innerRadius?: number;
  outerRadius?: number;
  showLabels?: boolean;
  showLegend?: boolean;
  // Formats values in the tooltip (e.g. "$1,200" or "4 profiles")
  valueFormatter?: (value: number) => string;
  // Shown after the title of a period that is not finished (e.g. "in progress")
  inProgressLabel?: string;
  // Legend names when a comparison series is drawn
  seriesLabels?: { current: string; previous: string };
}

export interface GrowthData {
  value: number; // percentage change
  isPositive: boolean; // true for positive growth
  trend: "up" | "down" | "stable" | "unknown";
  notApplicable?: boolean; // no earlier value to compare with (previous was 0)
  periodComparison: string; // "vs last month", "vs last quarter"
}

export interface FormattedMetric {
  displayValue: string; // formatted current value
  displayPrevious: string; // formatted previous value
  displayCurrentPeriod: string; // formatted last-30-days value
  growth: GrowthData;
  formattedGrowth: string; // "+15%", "-5%", etc.
}

export type MetricFormatter = (
  value: number,
  formatType?: string,
  unit?: string
) => string;

export interface MetricConfig {
  id: string;
  label: string;
  formatType: "number" | "currency" | "percentage" | "duration";
  unit?: string;
  color: string;
  icon?: string;
  description?: string;
}

// Chart data interfaces
export interface ChartDataPoint {
  period: string;
  value: number;
  tick?: string; // short axis label
  title?: string; // tooltip heading
  previousValue?: number; // comparison series (drawn dashed)
  previousTitle?: string; // tooltip heading of the comparison point
  inProgress?: boolean; // period not finished yet (current month)
  label?: string;
  date?: Date;
  // Pie chart specific
  name?: string;
  fill?: string;
}

// Hook return types
export interface UseMetricReturn {
  formattedMetric: FormattedMetric;
  chartData: ChartDataPoint[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}
