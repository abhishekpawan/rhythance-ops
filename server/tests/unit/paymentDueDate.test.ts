import { describe, expect, it } from "vitest";
import { computePaymentDueDate } from "../../src/utils/paymentDueDate.js";

// Weeks run Sunday to Saturday. A "N week hold" is paid 6 (1 week) or 13 (2 weeks) days after the end of the worked period.
describe("computePaymentDueDate: weekly cycles", () => {
  it("1 week hold: six days after the week ends", () => {
    expect(computePaymentDueDate("Weekly - 1 week hold", "2026-11-01", "2026-11-07")).toBe("2026-11-13");
  });
  it("2 week hold: thirteen days after the week ends", () => {
    expect(computePaymentDueDate("Weekly - 2 week hold", "2026-11-01", "2026-11-07")).toBe("2026-11-20");
  });
  it("crosses the year end", () => {
    expect(computePaymentDueDate("Weekly - 1 week hold", "2026-12-27", "2027-01-02")).toBe("2027-01-08");
  });
  it("crosses a leap day", () => {
    expect(computePaymentDueDate("Weekly - 2 week hold", "2028-02-20", "2028-02-26")).toBe("2028-03-10");
  });
  it("ignores case and surrounding spaces", () => {
    expect(computePaymentDueDate("  WEEKLY - 1 WEEK HOLD ", "2026-11-01", "2026-11-07")).toBe("2026-11-13");
  });
});

describe("computePaymentDueDate: biweekly cycles", () => {
  // Sunday-weeks are counted from the first Sunday on or before 1 January: 2026-11-01 is week 44 (even), 2026-11-08 is week 45 (odd).
  it("both weeks of a pair are due on the same day", () => {
    const first = computePaymentDueDate("Biweekly - 2 week hold", "2026-11-01", "2026-11-07");
    const second = computePaymentDueDate("Biweekly - 2 week hold", "2026-11-08", "2026-11-14");
    expect(first).toBe("2026-11-27");
    expect(second).toBe("2026-11-27");
  });
  it("the next pair is two weeks later", () => {
    expect(computePaymentDueDate("Biweekly - 2 week hold", "2026-11-15", "2026-11-21")).toBe("2026-12-11");
    expect(computePaymentDueDate("Biweekly - 2 week hold", "2026-11-22", "2026-11-28")).toBe("2026-12-11");
  });
  it("1 week hold, biweekly", () => {
    expect(computePaymentDueDate("Biweekly - 1 week hold", "2026-11-01", "2026-11-07")).toBe("2026-11-20");
    expect(computePaymentDueDate("Biweekly - 1 week hold", "2026-11-08", "2026-11-14")).toBe("2026-11-20");
  });
});

describe("computePaymentDueDate: no answer", () => {
  it("returns null without a usable pay cycle", () => {
    expect(computePaymentDueDate(null, "2026-11-01", "2026-11-07")).toBeNull();
    expect(computePaymentDueDate(undefined, "2026-11-01", "2026-11-07")).toBeNull();
    expect(computePaymentDueDate("", "2026-11-01", "2026-11-07")).toBeNull();
    expect(computePaymentDueDate("   ", "2026-11-01", "2026-11-07")).toBeNull();
    expect(computePaymentDueDate("Monthly", "2026-11-01", "2026-11-07")).toBeNull();
    expect(computePaymentDueDate("Weekly - no hold", "2026-11-01", "2026-11-07")).toBeNull();
  });
  it("returns null without both dates", () => {
    expect(computePaymentDueDate("Weekly - 1 week hold", "", "2026-11-07")).toBeNull();
    expect(computePaymentDueDate("Weekly - 1 week hold", "2026-11-01", "")).toBeNull();
  });
});
