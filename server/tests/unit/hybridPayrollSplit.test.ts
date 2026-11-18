import { describe, expect, it } from "vitest";
import {
  HYBRID_SIN_CASH,
  HYBRID_SIN_ETRANSFER,
  buildTimesheetRowsForPayroll,
  computeWeeklyRegularOvertime,
  hybridSecondLinePaymentMethod,
  hybridSecondSegment,
  isHybridPaymentMethod,
  parseHstGstPercentage,
  profileUsesCashDeductionField,
} from "../../../client/src/lib/hybridPayrollSplit";
import { base, week } from "./payrollFixtures";

describe("payment method helpers", () => {
  it("knows the two hybrid methods and what each pays the second part by", () => {
    expect(HYBRID_SIN_CASH).toBe("SIN and cash");
    expect(HYBRID_SIN_ETRANSFER).toBe("SIN and e-Transfer");
    expect(isHybridPaymentMethod("SIN and cash")).toBe(true);
    expect(isHybridPaymentMethod("SIN and e-Transfer")).toBe(true);
    expect(isHybridPaymentMethod("Cash")).toBe(false);
    expect(isHybridPaymentMethod(null)).toBe(false);
    expect(hybridSecondSegment("SIN and cash")).toBe("cash");
    expect(hybridSecondSegment("SIN and e-Transfer")).toBe("e_transfer");
    expect(hybridSecondSegment("Cash")).toBeNull();
    expect(hybridSecondLinePaymentMethod("SIN and cash")).toBe("Cash");
    expect(hybridSecondLinePaymentMethod("SIN and e-Transfer")).toBe("e-Transfer");
    expect(hybridSecondLinePaymentMethod("SIN-Direct Deposit")).toBeNull();
  });
  it("says which profiles carry a cash deduction percentage", () => {
    for (const pm of ["Cash", "e-Transfer", "SIN and cash", "SIN and e-Transfer"]) {
      expect(profileUsesCashDeductionField(pm)).toBe(true);
    }
    for (const pm of ["SIN-Direct Deposit", "Corporation-Direct Deposit", "", null, undefined]) {
      expect(profileUsesCashDeductionField(pm)).toBe(false);
    }
  });
});

describe("parseHstGstPercentage", () => {
  it("reads a number with an optional percent sign", () => {
    expect(parseHstGstPercentage("13")).toBe(13);
    expect(parseHstGstPercentage("13%")).toBe(13);
    expect(parseHstGstPercentage("13 %")).toBe(13);
    expect(parseHstGstPercentage("13.5")).toBe(13.5);
    expect(parseHstGstPercentage("5%")).toBe(5);
  });
  it("is zero for anything else", () => {
    for (const v of [null, undefined, "", "HST 13%", "abc", ".", "13 percent", "-5"]) {
      expect(parseHstGstPercentage(v as string | null | undefined)).toBe(0);
    }
  });
});

describe("computeWeeklyRegularOvertime", () => {
  it("is all regular without overtime", () => {
    expect(computeWeeklyRegularOvertime({ entries: week([8, 8, 8, 8, 8, 4]), overtimeEnabled: false })).toEqual({
      weeklyRegularHours: 44,
      weeklyOvertimeHours: 0,
    });
  });
  it("splits at the position's threshold, 40 when none is set", () => {
    const fifty = week([10, 10, 10, 10, 10]);
    expect(computeWeeklyRegularOvertime({ entries: fifty, overtimeEnabled: true })).toEqual({
      weeklyRegularHours: 40,
      weeklyOvertimeHours: 10,
    });
    expect(computeWeeklyRegularOvertime({ entries: fifty, overtimeEnabled: true, overtimeHoursRaw: "44" })).toEqual({
      weeklyRegularHours: 44,
      weeklyOvertimeHours: 6,
    });
    expect(computeWeeklyRegularOvertime({ entries: fifty, overtimeEnabled: true, overtimeHoursRaw: null })).toEqual({
      weeklyRegularHours: 40,
      weeklyOvertimeHours: 10,
    });
  });
  it("has no overtime below the threshold, and rounds to hundredths", () => {
    expect(computeWeeklyRegularOvertime({ entries: week([8, 8, 8]), overtimeEnabled: true })).toEqual({
      weeklyRegularHours: 24,
      weeklyOvertimeHours: 0,
    });
    expect(computeWeeklyRegularOvertime({ entries: week([7.333, 7.333]), overtimeEnabled: false })).toEqual({
      weeklyRegularHours: 14.67,
      weeklyOvertimeHours: 0,
    });
  });
});

describe("buildTimesheetRowsForPayroll: one row for ordinary payment methods", () => {
  it("regular hours only", () => {
    const [row, ...rest] = buildTimesheetRowsForPayroll(base({}));
    expect(rest).toEqual([]);
    expect(row).toEqual({
      paySplitSegment: "single",
      linePaymentMethod: null,
      dailyHours: week([8, 8, 8, 8, 8]),
      totalRegularHours: 40,
      totalOvertimeHours: 0,
      totalClientBill: 1400,
      totalJobseekerPay: 800,
      bonusAmount: 0,
      deductionAmount: 0,
      taxAmount: 0,
    });
  });

  it("overtime is paid and billed at its own rates", () => {
    const [row] = buildTimesheetRowsForPayroll(
      base({ entries: week([10, 10, 10, 10, 10]), overtimeEnabled: true, overtimeHoursRaw: "40" })
    );
    expect(row.totalRegularHours).toBe(40);
    expect(row.totalOvertimeHours).toBe(10);
    expect(row.totalJobseekerPay).toBe(1100); // 40 x 20 + 10 x 30
    expect(row.totalClientBill).toBe(1925); // 40 x 35 + 10 x 52.50
  });

  it("bonus is added and deduction taken off", () => {
    const [row] = buildTimesheetRowsForPayroll(base({ bonusAmount: 50, deductionAmount: 20 }));
    expect(row.totalJobseekerPay).toBe(830);
    expect(row.totalClientBill).toBe(1400); // the client is not billed for either
    expect(row.bonusAmount).toBe(50);
    expect(row.deductionAmount).toBe(20);
  });

  it.each(["Cash", "e-Transfer"])("%s: the cash deduction percentage comes off the base pay", (paymentMethod) => {
    const [row] = buildTimesheetRowsForPayroll(base({ paymentMethod, cashDeductionPct: 10 }));
    expect(row.totalJobseekerPay).toBe(720); // 800 - 80
    expect(row.taxAmount).toBe(0);
  });

  it("direct deposit ignores a deduction percentage", () => {
    const [row] = buildTimesheetRowsForPayroll(base({ cashDeductionPct: 10 }));
    expect(row.totalJobseekerPay).toBe(800);
  });

  it.each(["Corporation-Direct Deposit", "Corporation-Cheque", "Corporation-Wire"])(
    "%s: HST/GST is added on top of pay plus bonus minus deduction",
    (paymentMethod) => {
      const [row] = buildTimesheetRowsForPayroll(
        base({ paymentMethod, hstGst: "13%", bonusAmount: 50, deductionAmount: 20 })
      );
      expect(row.taxAmount).toBe(107.9); // (800 + 50 - 20) x 13%
      expect(row.totalJobseekerPay).toBe(937.9); // 800 + 107.90 + 50 - 20
    }
  );

  it("a corporation with no tax set is paid the base pay", () => {
    const [row] = buildTimesheetRowsForPayroll(base({ paymentMethod: "Corporation-Direct Deposit", hstGst: null }));
    expect(row.taxAmount).toBe(0);
    expect(row.totalJobseekerPay).toBe(800);
  });

  it("tax is never worked out on a negative base", () => {
    const [row] = buildTimesheetRowsForPayroll(
      base({ paymentMethod: "Corporation-Direct Deposit", hstGst: "13", entries: week([1]), deductionAmount: 500 })
    );
    expect(row.taxAmount).toBe(0);
    expect(row.totalJobseekerPay).toBe(-480); // 20 - 500: pay can go negative, as today
  });

  it("sorts days and rounds hours to hundredths", () => {
    const [row] = buildTimesheetRowsForPayroll(
      base({
        entries: [
          { date: "2026-11-04", hours: 7.333 },
          { date: "2026-11-02", hours: 7.333 },
        ],
      })
    );
    expect(row.dailyHours).toEqual([
      { date: "2026-11-02", hours: 7.33 },
      { date: "2026-11-04", hours: 7.33 },
    ]);
    expect(row.totalRegularHours).toBe(14.67);
    expect(row.totalJobseekerPay).toBe(293.4);
    expect(row.totalClientBill).toBe(513.45);
  });

  it("has no rows for no hours", () => {
    expect(buildTimesheetRowsForPayroll(base({ entries: [] }))).toEqual([]);
    expect(buildTimesheetRowsForPayroll(base({ entries: week([0, 0]) }))).toEqual([]);
  });
});
