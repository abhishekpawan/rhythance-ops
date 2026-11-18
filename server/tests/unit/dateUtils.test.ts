import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDaysToDateStr,
  formatCalendarDate,
  formatCanadaDate,
  formatMonthName,
  getTodayInCanada,
  getWeekEndDate,
  getWeekEndDateSafe,
} from "../../src/utils/dateUtils.js";

afterEach(() => vi.useRealTimers());

describe("formatMonthName", () => {
  it("reads the month from YYYY-MM and YYYY-MM-DD without any timezone", () => {
    expect(formatMonthName("2026-05")).toBe("May");
    expect(formatMonthName("2026-05-17")).toBe("May");
    expect(formatMonthName("2026-12-31")).toBe("Dec");
  });
  it("gives an empty string for anything it cannot read", () => {
    expect(formatMonthName(null)).toBe("");
    expect(formatMonthName(undefined)).toBe("");
    expect(formatMonthName("")).toBe("");
    expect(formatMonthName("2026")).toBe("");
    expect(formatMonthName("2026-13")).toBe("");
    expect(formatMonthName("2026-00")).toBe("");
  });
});

describe("formatCalendarDate", () => {
  it("formats a calendar date as 'MMM D, YYYY'", () => {
    expect(formatCalendarDate("2026-08-28")).toBe("Aug 28, 2026");
    expect(formatCalendarDate("2026-01-05")).toBe("Jan 5, 2026");
  });
  it("ignores a time part", () => {
    expect(formatCalendarDate("2026-08-28T23:59:00Z")).toBe("Aug 28, 2026");
    expect(formatCalendarDate("2026-08-28 10:00:00")).toBe("Aug 28, 2026");
  });
  it("returns the fallback for missing or invalid input", () => {
    expect(formatCalendarDate(null)).toBe("N/A");
    expect(formatCalendarDate("")).toBe("N/A");
    expect(formatCalendarDate("2026-13-01")).toBe("N/A");
    expect(formatCalendarDate("2026-00-10")).toBe("N/A");
    expect(formatCalendarDate("2026-05-32")).toBe("N/A");
    expect(formatCalendarDate("not a date", "-")).toBe("-");
    expect(formatCalendarDate("2026-05", "?")).toBe("?");
  });
  it("does not check that the day exists in the month (pinned as it is today)", () => {
    expect(formatCalendarDate("2026-02-31")).toBe("Feb 31, 2026");
  });
});

describe("formatCanadaDate", () => {
  it("uses Toronto time, not UTC and not the machine's zone", () => {
    const numeric = { year: "numeric", month: "2-digit", day: "2-digit" } as const;
    // 03:30 UTC on 1 Nov 2026 is 23:30 on 31 Oct in Toronto (daylight time ends later that night)
    expect(formatCanadaDate("2026-11-01T03:30:00Z", numeric)).toBe("2026-10-31");
    // 05:30 UTC is 01:30 on 1 Nov, still daylight time
    expect(formatCanadaDate("2026-11-01T05:30:00Z", numeric)).toBe("2026-11-01");
    // after the clocks go back: 06:30 UTC is 01:30 standard time, same day
    expect(formatCanadaDate("2026-11-01T06:30:00Z", numeric)).toBe("2026-11-01");
    expect(formatCanadaDate(new Date("2026-07-01T02:00:00Z"), numeric)).toBe("2026-06-30");
  });
  it("returns an empty string for an invalid date", () => {
    expect(formatCanadaDate("garbage")).toBe("");
  });
  it("uses the clock when no date is given", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T15:00:00Z"));
    expect(formatCanadaDate(undefined, { year: "numeric", month: "2-digit", day: "2-digit" })).toBe("2026-11-17");
  });
});

describe("addDaysToDateStr", () => {
  it("adds and subtracts days across month, year and leap days", () => {
    expect(addDaysToDateStr("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDaysToDateStr("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysToDateStr("2028-02-28", 2)).toBe("2028-03-01");
    expect(addDaysToDateStr("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDaysToDateStr("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateStr("2026-11-17", 0)).toBe("2026-11-17");
    expect(addDaysToDateStr("2026-11-17", 366)).toBe("2027-11-18");
  });
  it("is not moved by the clocks changing", () => {
    expect(addDaysToDateStr("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDaysToDateStr("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDaysToDateStr("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysToDateStr("2026-11-01", 1)).toBe("2026-11-02");
  });
});

describe("getWeekEndDate", () => {
  it("is the Sunday start plus six days", () => {
    expect(getWeekEndDate("2026-11-01")).toBe("2026-11-07");
    expect(getWeekEndDate("2026-12-27")).toBe("2027-01-02");
    expect(getWeekEndDate("2028-02-27")).toBe("2028-03-04");
  });
  it("is the same function under two names", () => {
    expect(getWeekEndDate).toBe(getWeekEndDateSafe);
  });
});

describe("getTodayInCanada", () => {
  it("is the Toronto calendar day at the fixed clock", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T03:00:00Z")); // 22:00 on the 16th in Toronto
    expect(getTodayInCanada()).toBe("2026-11-16");
    vi.setSystemTime(new Date("2026-11-17T05:00:00Z")); // 00:00 on the 17th
    expect(getTodayInCanada()).toBe("2026-11-17");
    vi.setSystemTime(new Date("2026-07-01T03:59:59Z")); // 23:59:59 on 30 June (daylight time)
    expect(getTodayInCanada()).toBe("2026-06-30");
    vi.setSystemTime(new Date("2026-07-01T04:00:00Z"));
    expect(getTodayInCanada()).toBe("2026-07-01");
  });
});
