/**
 * Shared maths for the dashboard metric cards (the same idea as YouTube Studio).
 *
 * Every card shows:
 *  - a running total over all time as the headline ("Total Profiles Created: 456");
 *  - the trend: what was added in the LAST 30 DAYS against the 30 days BEFORE that.
 *    Two windows of equal length are what make the percentage fair; a calendar
 *    month so far against a whole last month always looks like a drop;
 *  - a monthly series for the chart.
 * The trend must never compare a total with a single period. This helper is the
 * only place that does the maths, so all metric routes agree.
 *
 * Months are calendar months in the portal's timezone (America/Toronto), the same
 * zone the rest of the portal displays. They are NOT UTC months and they do not
 * depend on the timezone of the machine the server runs on.
 */
import { CANADA_TIMEZONE, formatMonthName } from "./dateUtils.js";

const monthFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CANADA_TIMEZONE,
  year: "numeric",
  month: "2-digit",
});

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CANADA_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM" of a timestamp, in Toronto time. Returns "" for a missing/invalid date. */
export function monthKeyOf(date: Date | string | null | undefined): string {
  if (!date) return "";
  // A calendar date ("2026-11-01", e.g. an end_date or week_end_date) is already a
  // month label. Parsing it would read it as UTC midnight, which is the previous
  // evening in Toronto, and put it in the wrong month.
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date.slice(0, 7);
  }
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  const parts = monthFormatter.formatToParts(parsed);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return year && month ? `${year}-${month}` : "";
}

/** Moves a "YYYY-MM" key by whole months (negative = earlier). Pure arithmetic, no Date. */
export function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split("-").map(Number);
  const index = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(index / 12);
  const newMonth = (index % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" of a timestamp, in Toronto time. A calendar date passes through unchanged. */
export function dayKeyOf(date: Date | string | null | undefined): string {
  if (!date) return "";
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  const parts = dayFormatter.formatToParts(parsed);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  const [y, m, d] = [get("year"), get("month"), get("day")];
  return y && m && d ? `${y}-${m}-${d}` : "";
}

/** Moves a "YYYY-MM-DD" key by whole days. Pure UTC arithmetic, no timezone involved. */
export function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

const round2 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export interface MonthlySummary {
  /** Running total over all time. */
  total: number;
  /** Added in the last `windowDays` whole days, today included. */
  recent: number;
  /** Added in the `windowDays` days before that. */
  prior: number;
  /** One point per day of the recent window, each with the same day of the prior window. */
  daily: Array<{ date: string; value: number; previousValue: number }>;
  /** Oldest to newest; `monthsBack` earlier months plus the current one. Chart data. */
  monthly: Array<{ month: string; value: number }>;
}

export interface SummarizeOptions<T> {
  /** Which timestamp places the row in a month. */
  getDate: (row: T) => string | null | undefined;
  /** What the row adds to the total (default 1, i.e. a count). */
  getValue?: (row: T) => number;
  /** Rows to leave out entirely (default: keep all). */
  include?: (row: T) => boolean;
  /** Chart length: this many earlier months plus the current one (default 12). */
  monthsBack?: number;
  /** Length of each of the two trend windows in days (default 30). */
  windowDays?: number;
  /** Injectable clock for tests. */
  now?: Date;
}

export function summarizeMonthly<T>(
  rows: T[],
  options: SummarizeOptions<T>
): MonthlySummary {
  const {
    getDate,
    getValue = () => 1,
    include,
    monthsBack = 12,
    windowDays = 30,
  } = options;
  const now = options.now ?? new Date();
  const currentMonth = monthKeyOf(now);

  // Trend windows are whole Toronto days, so the card's percentage is exactly what
  // the daily chart draws: [today-(N-1) .. today] against the N days before it.
  const today = dayKeyOf(now);
  const recentStart = shiftDay(today, -(windowDays - 1));
  const priorStart = shiftDay(today, -(2 * windowDays - 1));
  const perDay = new Map<string, number>();

  const buckets = new Map<string, number>();
  for (let i = monthsBack; i >= 0; i--) {
    buckets.set(shiftMonth(currentMonth, -i), 0);
  }

  let total = 0;

  for (const row of rows) {
    if (include && !include(row)) continue;
    const value = getValue(row);
    if (!Number.isFinite(value)) continue;
    const date = getDate(row);
    const key = monthKeyOf(date);
    const day = dayKeyOf(date);

    total += value;
    // ISO date strings sort the same as the days they name. Future days are ignored.
    if (day >= priorStart && day <= today) {
      perDay.set(day, (perDay.get(day) ?? 0) + value);
    }
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + value);
  }

  const daily: MonthlySummary["daily"] = [];
  let recent = 0;
  let prior = 0;
  for (let i = 0; i < windowDays; i++) {
    const date = shiftDay(recentStart, i);
    const value = perDay.get(date) ?? 0;
    const previousValue = perDay.get(shiftDay(date, -windowDays)) ?? 0;
    recent += value;
    prior += previousValue;
    daily.push({
      date,
      value: round2(value),
      previousValue: round2(previousValue),
    });
  }
  // The prior window is exactly the previous-day series, so it can be checked by eye.

  return {
    total: round2(total),
    recent: round2(recent),
    prior: round2(prior),
    daily,
    monthly: [...buckets.entries()].map(([month, value]) => ({
      month,
      value: round2(value),
    })),
  };
}

/**
 * The numeric fields every metric card needs, built from a summary:
 *  - currentValue       the running total (the headline number)
 *  - currentPeriodValue added in the last 30 days
 *  - previousValue      added in the 30 days before that
 *  - dailyData          the same two windows day by day (the 30-day chart)
 * The trend percentage is currentPeriodValue against previousValue.
 */
export function metricFromSummary(summary: MonthlySummary) {
  return {
    currentValue: summary.total,
    currentPeriodValue: summary.recent,
    previousValue: summary.prior,
    dailyData: summary.daily,
    historicalData: summary.monthly.map((point) => ({
      period: formatMonthName(point.month),
      value: point.value,
      date: point.month,
    })),
  };
}

/**
 * Reads every row of a query. Supabase returns at most 1000 rows per request and
 * does not say when it cut the result off, so a plain `await query` silently
 * under-counts once a table grows past that. `page` must apply a stable order
 * (for example created_at then id) or pages can overlap or skip rows.
 */
export async function fetchAllRows<T>(
  page: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}
