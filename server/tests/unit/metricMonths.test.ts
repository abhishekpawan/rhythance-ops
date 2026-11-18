import { describe, expect, it } from "vitest";
import {
  dayKeyOf,
  metricFromSummary,
  monthKeyOf,
  shiftDay,
  shiftMonth,
  summarizeMonthly,
} from "../../src/utils/metricMonths.js";

// Fixed clock: 10:00 on Tuesday 17 November 2026 in Toronto.
const NOW = new Date("2026-11-17T15:00:00Z");

describe("monthKeyOf", () => {
  it("passes a calendar date through as its own month", () => {
    expect(monthKeyOf("2026-11-01")).toBe("2026-11");
    expect(monthKeyOf("2026-10-31")).toBe("2026-10");
  });
  it("places a timestamp in its Toronto month, not its UTC month", () => {
    expect(monthKeyOf("2026-11-01T03:00:00Z")).toBe("2026-10"); // 23:00 on 31 Oct in Toronto
    expect(monthKeyOf("2026-11-01T05:00:00Z")).toBe("2026-11"); // 01:00 on 1 Nov
    expect(monthKeyOf(new Date("2026-01-01T04:59:59Z"))).toBe("2025-12");
    expect(monthKeyOf(new Date("2026-01-01T05:00:00Z"))).toBe("2026-01");
  });
  it("returns an empty string for a missing or invalid date", () => {
    expect(monthKeyOf(null)).toBe("");
    expect(monthKeyOf(undefined)).toBe("");
    expect(monthKeyOf("")).toBe("");
    expect(monthKeyOf("garbage")).toBe("");
  });
});

describe("shiftMonth", () => {
  it("moves by whole months across year ends", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-11", 0)).toBe("2026-11");
    expect(shiftMonth("2026-03", -15)).toBe("2024-12");
    expect(shiftMonth("2026-11", -12)).toBe("2025-11");
    expect(shiftMonth("2026-01", 25)).toBe("2028-02");
  });
});

describe("dayKeyOf and shiftDay", () => {
  it("keeps a calendar date and converts a timestamp to its Toronto day", () => {
    expect(dayKeyOf("2026-11-17")).toBe("2026-11-17");
    expect(dayKeyOf("2026-11-17T03:00:00Z")).toBe("2026-11-16");
    expect(dayKeyOf(new Date("2026-11-17T05:00:00Z"))).toBe("2026-11-17");
    expect(dayKeyOf(null)).toBe("");
    expect(dayKeyOf("garbage")).toBe("");
  });
  it("shifts days by calendar arithmetic", () => {
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDay("2028-03-01", -1)).toBe("2028-02-29");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDay("2026-11-17", -29)).toBe("2026-10-19");
  });
});

describe("summarizeMonthly", () => {
  // Window edges for NOW: recent = 2026-10-19 .. 2026-11-17, prior = 2026-09-19 .. 2026-10-18.
  const rows = [
    { at: "2026-11-17" }, // today: recent
    { at: "2026-10-19" }, // first day of the recent window
    { at: "2026-10-18" }, // last day of the prior window
    { at: "2026-09-19" }, // first day of the prior window
    { at: "2026-09-18" }, // before both windows: total and month only
    { at: "2026-11-18" }, // tomorrow: in the total and the month, in no window
    { at: null }, // no date: in the total only
  ];

  it("counts rows into the total, the two 30-day windows and the months", () => {
    const s = summarizeMonthly(rows, { getDate: (r) => r.at, now: NOW });
    expect(s.total).toBe(7);
    expect(s.recent).toBe(2);
    expect(s.prior).toBe(2);
    expect(s.monthly).toHaveLength(13);
    expect(s.monthly[0]).toEqual({ month: "2025-11", value: 0 });
    expect(s.monthly.slice(-3)).toEqual([
      { month: "2026-09", value: 2 },
      { month: "2026-10", value: 2 },
      { month: "2026-11", value: 2 },
    ]);
  });

  it("draws the recent window day by day with the same day of the prior window beside it", () => {
    const s = summarizeMonthly(rows, { getDate: (r) => r.at, now: NOW });
    expect(s.daily).toHaveLength(30);
    expect(s.daily[0]).toEqual({ date: "2026-10-19", value: 1, previousValue: 1 });
    expect(s.daily[1]).toEqual({ date: "2026-10-20", value: 0, previousValue: 0 });
    expect(s.daily[29]).toEqual({ date: "2026-11-17", value: 1, previousValue: 1 });
    expect(s.daily.reduce((a, d) => a + d.value, 0)).toBe(s.recent);
    expect(s.daily.reduce((a, d) => a + d.previousValue, 0)).toBe(s.prior);
  });

  it("sums values instead of counting, rounding to cents", () => {
    const money = [
      { at: "2026-11-10", amount: 0.1 },
      { at: "2026-11-11", amount: 0.2 },
      { at: "2026-11-12", amount: 1.005 },
      { at: "2026-10-01", amount: 100.004 },
    ];
    const s = summarizeMonthly(money, { getDate: (r) => r.at, getValue: (r) => r.amount, now: NOW });
    expect(s.recent).toBe(1.31); // 0.1 + 0.2 + 1.005 = 1.305000..., rounded half up
    expect(s.total).toBe(101.31);
    expect(s.prior).toBe(100); // 100.004 rounded
    expect(s.daily.find((d) => d.date === "2026-11-12")?.value).toBe(1.01);
  });

  it("leaves out rows the include filter refuses, and values that are not numbers", () => {
    const mixed = [
      { at: "2026-11-10", n: 5, ok: true },
      { at: "2026-11-10", n: 7, ok: false },
      { at: "2026-11-10", n: Number.NaN, ok: true },
      { at: "2026-11-10", n: Number.POSITIVE_INFINITY, ok: true },
    ];
    const s = summarizeMonthly(mixed, {
      getDate: (r) => r.at,
      getValue: (r) => r.n,
      include: (r) => r.ok,
      now: NOW,
    });
    expect(s.total).toBe(5);
    expect(s.recent).toBe(5);
  });

  it("follows the clock around Toronto midnight", () => {
    const row = [{ at: "2026-11-16T03:30:00Z" }]; // 22:30 on 15 Nov in Toronto
    const early = summarizeMonthly(row, { getDate: (r) => r.at, now: new Date("2026-11-16T04:00:00Z") });
    expect(early.daily[29].date).toBe("2026-11-15");
    expect(early.daily[29].value).toBe(1);
    const later = summarizeMonthly(row, { getDate: (r) => r.at, now: new Date("2026-11-16T06:00:00Z") });
    expect(later.daily[29].date).toBe("2026-11-16");
    expect(later.daily[28].value).toBe(1); // yesterday now
  });

  it("supports other window and chart lengths", () => {
    const s = summarizeMonthly(rows, { getDate: (r) => r.at, now: NOW, windowDays: 7, monthsBack: 2 });
    expect(s.daily).toHaveLength(7);
    expect(s.monthly.map((m) => m.month)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(s.recent).toBe(1);
    expect(s.prior).toBe(0);
  });

  it("is empty for no rows", () => {
    const s = summarizeMonthly([], { getDate: () => null, now: NOW });
    expect(s.total).toBe(0);
    expect(s.recent).toBe(0);
    expect(s.prior).toBe(0);
    expect(s.daily).toHaveLength(30);
  });
});

describe("metricFromSummary", () => {
  it("builds the fields every metric card reads", () => {
    const s = summarizeMonthly([{ at: "2026-11-10" }, { at: "2026-10-25" }, { at: "2026-09-25" }], {
      getDate: (r) => r.at,
      now: NOW,
      monthsBack: 2,
    });
    const m = metricFromSummary(s);
    expect(m.currentValue).toBe(3);
    expect(m.currentPeriodValue).toBe(2);
    expect(m.previousValue).toBe(1);
    expect(m.dailyData).toBe(s.daily);
    expect(m.historicalData).toEqual([
      { period: "Sep", value: 1, date: "2026-09" },
      { period: "Oct", value: 1, date: "2026-10" },
      { period: "Nov", value: 1, date: "2026-11" },
    ]);
  });
});
