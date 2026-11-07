import { formatMonthName } from "../utils/dateUtils.js";
import { dayKeyOf, monthKeyOf, shiftDay, shiftMonth } from "../utils/metricMonths.js";

/**
 * Payroll totals shown on the Jobseeker dashboard ("Total No. Hours" and
 * "Gross Amount"). Pure functions so they can be tested without a database.
 */

export interface PayrollTimesheetRow {
  /** YYYY-MM-DD */
  week_end_date?: string | null;
  total_regular_hours?: unknown;
  total_overtime_hours?: unknown;
  regular_pay_rate?: unknown;
  premium_pay_rate?: unknown;
  overtime_pay_rate?: unknown;
  bonus_amount?: unknown;
  is_bulk?: boolean | null;
  bulk_breakdown?: unknown;
}

interface BulkBreakdownEntry {
  regular_hours?: unknown;
  regular_pay_rate?: unknown;
}

export interface PayrollMonth {
  /** YYYY-MM */
  month: string;
  hours: number;
  gross: number;
}

export interface PayrollSummary {
  totalHours: number;
  grossAmount: number;
  /** Last 30 days, and the 30 days before that (for the trend). */
  recentHours: number;
  recentGross: number;
  priorHours: number;
  priorGross: number;
  /** Oldest to newest, last `monthsBack` months plus the current one. */
  monthly: PayrollMonth[];
}

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

/** Regular + overtime hours of one timesheet. */
export function hoursForTimesheet(row: PayrollTimesheetRow): number {
  return num(row.total_regular_hours) + num(row.total_overtime_hours);
}

/**
 * Gross pay of one timesheet: regular + overtime pay + bonus, BEFORE the
 * deduction amount, the cash/e-Transfer deduction and any tax. It is calculated
 * from hours x rates, not from `total_jobseeker_pay`, which already has
 * deductions applied.
 *
 * Multi-position (bulk) timesheets store each position's effective rate (regular
 * + premium) in `bulk_breakdown`; single-position ones store regular and
 * premium separately.
 */
export function grossForTimesheet(row: PayrollTimesheetRow): number {
  const overtimePay =
    num(row.total_overtime_hours) * num(row.overtime_pay_rate);

  const breakdown = Array.isArray(row.bulk_breakdown)
    ? (row.bulk_breakdown as BulkBreakdownEntry[])
    : [];
  const breakdownHours = breakdown.reduce(
    (sum, entry) => sum + num(entry.regular_hours),
    0
  );

  // Use the per-position breakdown only when it adds up to the timesheet's own
  // hours. A timesheet edited after it was created can carry a stale breakdown
  // (for example 1.5h in the breakdown but 3h on the timesheet); then the
  // timesheet-level hours x rate is the trustworthy figure and keeps Gross
  // Amount consistent with Total No. Hours.
  const breakdownIsCurrent =
    row.is_bulk &&
    breakdown.length > 0 &&
    Math.abs(breakdownHours - num(row.total_regular_hours)) < 0.01;

  const regularPay = breakdownIsCurrent
    ? breakdown.reduce(
        (sum, entry) =>
          sum + num(entry.regular_hours) * num(entry.regular_pay_rate),
        0
      )
    : num(row.total_regular_hours) *
      (num(row.regular_pay_rate) + num(row.premium_pay_rate));

  return regularPay + overtimePay + num(row.bonus_amount);
}

export function summarizePayroll(
  rows: PayrollTimesheetRow[],
  now: Date = new Date(),
  monthsBack = 12
): PayrollSummary {
  // Toronto calendar months, not the server machine's timezone.
  const currentMonth = monthKeyOf(now);

  const buckets = new Map<string, PayrollMonth>();
  for (let i = monthsBack; i >= 0; i--) {
    const key = shiftMonth(currentMonth, -i);
    buckets.set(key, { month: key, hours: 0, gross: 0 });
  }

  let totalHours = 0;
  let grossAmount = 0;
  let recentHours = 0;
  let recentGross = 0;
  let priorHours = 0;
  let priorGross = 0;
  // Same whole-day windows as every other card (see utils/metricMonths.ts).
  const today = dayKeyOf(now);
  const recentStart = shiftDay(today, -29);
  const priorStart = shiftDay(today, -59);

  for (const row of rows) {
    const hours = hoursForTimesheet(row);
    const gross = grossForTimesheet(row);
    const key = row.week_end_date ? String(row.week_end_date).slice(0, 7) : "";

    totalHours += hours;
    grossAmount += gross;

    // Trend windows, by the week-ending date: last 30 days vs the 30 days before.
    const day = dayKeyOf(row.week_end_date ? String(row.week_end_date) : null);
    if (day >= recentStart && day <= today) {
      recentHours += hours;
      recentGross += gross;
    } else if (day >= priorStart && day < recentStart) {
      priorHours += hours;
      priorGross += gross;
    }

    const bucket = buckets.get(key);
    if (bucket) {
      bucket.hours += hours;
      bucket.gross += gross;
    }
  }

  return {
    totalHours: round2(totalHours),
    grossAmount: round2(grossAmount),
    recentHours: round2(recentHours),
    recentGross: round2(recentGross),
    priorHours: round2(priorHours),
    priorGross: round2(priorGross),
    monthly: [...buckets.values()].map((bucket) => ({
      month: bucket.month,
      hours: round2(bucket.hours),
      gross: round2(bucket.gross),
    })),
  };
}

export interface DashboardMetric {
  id: string;
  label: string;
  /** Running total (the headline number). */
  currentValue: number;
  /** Added in the last 30 days; previousValue is the 30 days before. The trend compares these. */
  currentPeriodValue?: number;
  dailyData?: Array<{ date: string; value: number; previousValue: number }>;
  previousValue: number;
  unit: string;
  formatType: string;
  description: string;
  historicalData: Array<{ period: string; value: number; date: string }>;
  /** Cards that open a page when clicked. The payroll cards are not clickable. */
  redirectTo?: string;
}

/** The two dashboard cards built from a payroll summary. */
export function buildPayrollMetrics(
  summary: PayrollSummary
): DashboardMetric[] {
  const series = (pick: (month: PayrollMonth) => number) =>
    summary.monthly.map((month) => ({
      period: formatMonthName(month.month),
      value: pick(month),
      date: month.month,
    }));

  return [
    {
      id: "total_hours",
      label: "Total No. Hours",
      currentValue: summary.totalHours,
      currentPeriodValue: summary.recentHours,
      previousValue: summary.priorHours,
      unit: "hrs",
      formatType: "decimal",
      description:
        "Total regular and overtime hours across all your timesheets",
      historicalData: series((month) => month.hours),
    },
    {
      id: "gross_amount",
      label: "Gross Amount",
      currentValue: summary.grossAmount,
      currentPeriodValue: summary.recentGross,
      previousValue: summary.priorGross,
      unit: "CAD",
      formatType: "currency_precise",
      description:
        "Total pay before deductions (regular and overtime pay plus bonuses)",
      historicalData: series((month) => month.gross),
    },
  ];
}
