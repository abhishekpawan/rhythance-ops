import { describe, expect, it } from "vitest";
import { timesheetWeekWithinRange } from "../../src/utils/timesheetDateRange.js";

describe("timesheetWeekWithinRange", () => {
  const range = ["2026-11-01", "2026-11-30"] as const;
  it("accepts a week fully inside the range, edges included", () => {
    expect(timesheetWeekWithinRange("2026-11-08", "2026-11-14", ...range)).toBe(
      true
    );
    expect(timesheetWeekWithinRange("2026-11-01", "2026-11-07", ...range)).toBe(
      true
    );
    expect(timesheetWeekWithinRange("2026-11-24", "2026-11-30", ...range)).toBe(
      true
    );
  });
  it("rejects a week that starts before or ends after the range", () => {
    expect(timesheetWeekWithinRange("2026-10-25", "2026-10-31", ...range)).toBe(
      false
    );
    expect(timesheetWeekWithinRange("2026-10-28", "2026-11-03", ...range)).toBe(
      false
    );
    expect(timesheetWeekWithinRange("2026-11-29", "2026-12-05", ...range)).toBe(
      false
    );
  });
  it("compares as dates across a year end", () => {
    expect(
      timesheetWeekWithinRange(
        "2026-12-27",
        "2027-01-02",
        "2026-12-01",
        "2027-01-31"
      )
    ).toBe(true);
    expect(
      timesheetWeekWithinRange(
        "2026-12-27",
        "2027-01-02",
        "2026-12-01",
        "2026-12-31"
      )
    ).toBe(false);
  });
});
