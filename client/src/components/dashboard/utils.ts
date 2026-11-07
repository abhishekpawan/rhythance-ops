import { MetricData, GrowthData, FormattedMetric, HistoricalDataPoint, ChartDataPoint, DailyDataPoint } from './types';

/**
 * Format numbers based on type and value
 */
export const formatValue = (
  value: number, 
  formatType: string = 'number', 
  unit: string = ''
): string => {
  if (isNaN(value) || value === null || value === undefined) {
    return '0';
  }
  // "1 profile", "1 hr", not "1 profiles"
  if (value === 1 && unit.endsWith('s')) unit = unit.slice(0, -1);

  switch (formatType) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: value >= 1000 ? 0 : 2,
        maximumFractionDigits: value >= 1000 ? 0 : 2,
      }).format(value);

    case 'currency_precise':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);

    case 'decimal':
      return `${new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 2,
      }).format(value)}${unit ? ` ${unit}` : ''}`;

    case 'percentage':
      return `${value.toFixed(1)}%`;

    case 'duration':
      if (value < 1) {
        return `${Math.round(value * 24)} hours`;
      } else if (value === 1) {
        return '1 day';
      } else if (value < 7) {
        return `${Math.round(value)} days`;
      } else if (value < 30) {
        return `${Math.round(value / 7)} weeks`;
      } else {
        return `${Math.round(value / 30)} months`;
      }

    case 'number':
    default: {
      const abs = Math.abs(value);
      if (abs >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M${unit ? ` ${unit}` : ''}`;
      } else if (abs >= 1000) {
        return `${(value / 1000).toFixed(1)}K${unit ? ` ${unit}` : ''}`;
      } else {
        return `${value.toLocaleString()}${unit ? ` ${unit}` : ''}`;
      }
    }
  }
};

/**
 * Calculate growth percentage and trend
 */
export const calculateGrowth = (
  currentValue: number, 
  previousValue: number,
  periodComparison: string = 'vs previous 30 days'
): GrowthData => {
  if (previousValue === 0) {
    // Nothing to compare against: a percentage of zero is undefined, so do not
    // invent one (it used to show a fixed +100%). 0 -> 0 is simply no change.
    return {
      value: 0,
      isPositive: true,
      trend: 'stable',
      notApplicable: currentValue > 0,
      periodComparison,
    };
  }

  const growthValue = ((currentValue - previousValue) / previousValue) * 100;
  const isPositive = growthValue >= 0;
  
  let trend: 'up' | 'down' | 'stable' | 'unknown';
  if (Math.abs(growthValue) < 1) {
    trend = 'stable';
  } else if (growthValue > 0) {
    trend = 'up';
  } else {
    trend = 'down';
  }

  return {
    value: Math.abs(growthValue),
    isPositive,
    trend,
    periodComparison,
  };
};

/**
 * Format growth percentage
 */
export const formatGrowth = (growth: GrowthData): string => {
  if (growth.notApplicable) return 'N/A';
  const text = growth.value.toFixed(1);
  // No change (0 of 0, or rounds to 0.0): show a plain 0.0% instead of "-0.0%".
  if (Number(text) === 0) return '0.0%';
  const sign = growth.isPositive ? '+' : '-';
  return `${sign}${text}%`;
};

/**
 * Process metric data for display
 */
export const processMetricData = (data: MetricData): FormattedMetric => {
  // The trend is this month against last month (the chart's last two points).
  // Cards without a monthly breakdown fall back to the headline value.
  const growth = calculateGrowth(
    data.currentPeriodValue ?? data.currentValue,
    data.previousValue
  );
  
  return {
    displayValue: formatValue(data.currentValue, data.formatType, data.unit),
    displayPrevious: formatValue(data.previousValue, data.formatType, data.unit),
    displayCurrentPeriod: formatValue(
      data.currentPeriodValue ?? data.currentValue,
      data.formatType,
      data.unit
    ),
    growth,
    formattedGrowth: formatGrowth(growth),
  };
};

/** Browser locale for dates in the portal's language. */
export const dateLocale = (language: string): string =>
  language === 'fr' ? 'fr-CA' : 'en-US';

const utcDate = (value: Date | string): Date =>
  value instanceof Date ? value : new Date(value);

/**
 * Monthly series for the 12-month chart. Months arrive as "YYYY-MM" (parsed to
 * UTC midnight on the 1st), so every date here is read in UTC.
 * Axis labels carry the year on the first point and on each January, so two
 * "Nov" points can no longer be confused; the last point is the current month
 * and is marked as still in progress.
 */
export const transformToChartData = (
  historicalData: HistoricalDataPoint[],
  timeRange?: string,
  language: string = 'en'
): ChartDataPoint[] => {
  let filteredData = [...historicalData];

  if (timeRange) {
    // Cut off in UTC to match the UTC dates above; a local cutoff is later than
    // that in Canada and silently drops the oldest month.
    const now = new Date();
    const monthsBack = {
      '1m': 1,
      '3m': 3,
      '6m': 6,
      '1y': 12,
    }[timeRange] || 12;

    const cutoffDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
    filteredData = historicalData.filter(point => utcDate(point.date) >= cutoffDate);
  }

  filteredData.sort((a, b) => utcDate(a.date).getTime() - utcDate(b.date).getTime());

  const locale = dateLocale(language);
  const month = (d: Date) => d.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' });
  const year = (d: Date) => String(d.getUTCFullYear()).slice(-2);

  return filteredData.map((point, index) => {
    const date = utcDate(point.date);
    const showYear = index === 0 || date.getUTCMonth() === 0;
    const isLast = index === filteredData.length - 1;
    return {
      period: point.period,
      value: point.value,
      label: point.label || point.period,
      date,
      tick: showYear ? `${month(date)} ’${year(date)}` : month(date),
      title: date.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      inProgress: isLast,
    };
  });
};

/**
 * Daily series for the 30-day chart: each day of the last 30 days, with the same
 * day of the previous 30 days alongside (drawn as a dashed comparison line).
 */
export const transformDailyToChartData = (
  dailyData: DailyDataPoint[],
  language: string = 'en'
): ChartDataPoint[] => {
  const locale = dateLocale(language);
  const parse = (key: string) => new Date(`${key}T00:00:00Z`);
  const short = (d: Date) => d.toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const long = (d: Date) => d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

  return dailyData.map((point, index) => {
    const date = parse(point.date);
    const previousDate = new Date(date.getTime() - dailyData.length * 24 * 60 * 60 * 1000);
    return {
      period: point.date,
      value: point.value,
      previousValue: point.previousValue,
      date,
      tick: short(date),
      title: long(date),
      previousTitle: long(previousDate),
      inProgress: index === dailyData.length - 1,
    };
  });
};

/**
 * Get appropriate chart color based on trend
 */
export const getChartColor = (
  trend: 'up' | 'down' | 'stable' | 'unknown',
  customColor?: string
): string => {
  if (customColor) return customColor;
  
  switch (trend) {
    case 'up':
      return '#10B981'; // green
    case 'down':
      return '#EF4444'; // red
    case 'stable':
      return '#6B7280'; // gray
    default:
      return '#3B82F6'; // blue
  }
};
