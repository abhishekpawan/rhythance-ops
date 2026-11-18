import { describe, expect, it } from "vitest";
import {
  calculateTimesheetTotals,
  getBaseJobseekerPay,
  getDayName,
  getPayrollPreviewRows,
  resolvePositionRates,
  type PayrollComputationContext,
} from "../../../client/src/pages/TimesheetManagement/functions/timesheetCalculations";

// The screens pass richer objects; these carry only what the calculations read.
const asPosition = (p: Record<string, unknown>) => p as never;
const asJobseeker = (j: Record<string, unknown> | null) => j as never;

const position = asPosition({
  id: "pos-1",
  regularPayRate: "20",
  premiumPayRate: "2.5",
  billRate: "35",
  overtimeEnabled: true,
  overtimeHours: "40",
  overtimePayRate: "33",
  overtimeBillRate: "50",
});

const entries = (hours: number[]) => hours.map((h, i) => ({ date: `2026-11-0${i + 2}`, hours: h })) as never;

const ctx = (over: Partial<PayrollComputationContext> = {}): PayrollComputationContext => ({
  positions: [position],
  selectedPositionId: "pos-1",
  jobseeker: asJobseeker({ paymentMethod: "SIN-Direct Deposit" }),
  ...over,
});

describe("resolvePositionRates", () => {
  it("adds the premium to the pay rate and uses the overtime rates when overtime is on", () => {
    expect(resolvePositionRates(position)).toEqual({
      regularPayRate: 20,
      premiumPayRate: 2.5,
      effectivePayRate: 22.5,
      regularBillRate: 35,
      overtimePayRate: 33,
      overtimeBillRate: 50,
    });
  });
  it("overtime follows the regular rates when it is off, or when one overtime rate is missing", () => {
    const off = resolvePositionRates(asPosition({ regularPayRate: "20", premiumPayRate: "2.5", billRate: "35", overtimeEnabled: false, overtimePayRate: "33", overtimeBillRate: "50" }));
    expect(off.overtimePayRate).toBe(22.5);
    expect(off.overtimeBillRate).toBe(35);
    const half = resolvePositionRates(asPosition({ regularPayRate: "20", billRate: "35", overtimeEnabled: true, overtimePayRate: "33" }));
    expect(half.overtimePayRate).toBe(20);
    expect(half.overtimeBillRate).toBe(35);
  });
  it("treats missing rates as zero", () => {
    expect(resolvePositionRates(asPosition({}))).toEqual({
      regularPayRate: 0,
      premiumPayRate: 0,
      effectivePayRate: 0,
      regularBillRate: 0,
      overtimePayRate: 0,
      overtimeBillRate: 0,
    });
  });
});

describe("calculateTimesheetTotals", () => {
  it("is all zeros without a selected position", () => {
    const zero = { totalRegularHours: 0, totalOvertimeHours: 0, jobseekerPay: 0, clientBill: 0, taxAmount: 0 };
    expect(calculateTimesheetTotals(entries([8]), ctx({ selectedPositionId: undefined }))).toEqual(zero);
    expect(calculateTimesheetTotals(entries([8]), ctx({ selectedPositionId: "other" }))).toEqual(zero);
    expect(calculateTimesheetTotals(entries([0, 0]), ctx())).toEqual(zero);
  });

  it("pays and bills regular and overtime hours", () => {
    const totals = calculateTimesheetTotals(entries([10, 10, 10, 10, 10]), ctx());
    expect(totals).toEqual({
      totalRegularHours: 40,
      totalOvertimeHours: 10,
      jobseekerPay: 1230, // 40 x 22.50 + 10 x 33
      clientBill: 1900, // 40 x 35 + 10 x 50
      taxAmount: 0,
    });
  });

  it("passes bonus and deduction through", () => {
    const totals = calculateTimesheetTotals(entries([8, 8, 8, 8, 8]), ctx(), 100, 40);
    expect(totals.jobseekerPay).toBe(960); // 40 x 22.50 + 100 - 40
    expect(totals.clientBill).toBe(1400);
  });

  it("works without a jobseeker (plain pay)", () => {
    expect(calculateTimesheetTotals(entries([8, 8, 8, 8, 8]), ctx({ jobseeker: null })).jobseekerPay).toBe(900);
  });

  it("splits a hybrid jobseeker's week and adds the rows back together", () => {
    const hybrid = asJobseeker({ paymentMethod: "SIN and cash", sinPayrollHoursCap: "20", cashDeduction: "10" });
    const totals = calculateTimesheetTotals(entries([8, 8, 8, 8, 8]), ctx({ jobseeker: hybrid }));
    expect(totals.totalRegularHours).toBe(40);
    expect(totals.jobseekerPay).toBe(855); // 20 x 22.50 + (20 x 22.50) less 10%
    expect(totals.clientBill).toBe(1400);
  });

  it("treats a cap that is not a number as zero", () => {
    const hybrid = asJobseeker({ paymentMethod: "SIN and cash", sinPayrollHoursCap: "abc", cashDeduction: "0" });
    const rows = getPayrollPreviewRows({ entries: entries([8, 8, 8, 8, 8]) } as never, ctx({ jobseeker: hybrid }));
    expect(rows.map((r) => r.paySplitSegment)).toEqual(["cash"]);
  });

  it("adds HST/GST for a corporation and reports it", () => {
    const corp = asJobseeker({ paymentMethod: "Corporation-Direct Deposit", hstGst: "13%" });
    const totals = calculateTimesheetTotals(entries([8, 8, 8, 8, 8]), ctx({ jobseeker: corp }));
    expect(totals.taxAmount).toBe(117); // 900 x 13%
    expect(totals.jobseekerPay).toBe(1017);
  });
});

describe("getPayrollPreviewRows", () => {
  it("has no rows without a position or a jobseeker", () => {
    const ts = { entries: entries([8]) } as never;
    expect(getPayrollPreviewRows(ts, ctx({ selectedPositionId: undefined }))).toEqual([]);
    expect(getPayrollPreviewRows(ts, ctx({ jobseeker: null }))).toEqual([]);
  });
  it("uses the timesheet's own bonus and deduction", () => {
    const ts = { entries: entries([8, 8, 8, 8, 8]), bonusAmount: 10, deductionAmount: 5 } as never;
    const [row] = getPayrollPreviewRows(ts, ctx());
    expect(row.totalJobseekerPay).toBe(905);
    expect(row.bonusAmount).toBe(10);
    expect(row.deductionAmount).toBe(5);
  });
});

describe("getBaseJobseekerPay", () => {
  it("is stored hours times the rates, without bonus or deduction", () => {
    const ts = { totalRegularHours: 40, totalOvertimeHours: 10 } as never;
    expect(getBaseJobseekerPay(ts, position)).toBe(1230); // 40 x 22.50 + 10 x 33
  });
  it("overtime is paid at the regular rate when the position has none", () => {
    const ts = { totalRegularHours: 40, totalOvertimeHours: 10 } as never;
    expect(getBaseJobseekerPay(ts, asPosition({ regularPayRate: "20", premiumPayRate: "2.5" }))).toBe(1125);
  });
});

describe("getDayName", () => {
  it("gives the short weekday of a calendar date", () => {
    expect(getDayName("2026-11-02")).toBe("Mon");
    expect(getDayName("2026-11-08")).toBe("Sun");
  });
});
