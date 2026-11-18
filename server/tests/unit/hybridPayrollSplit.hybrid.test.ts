import { describe, expect, it } from "vitest";
import {
  HYBRID_SIN_CASH,
  HYBRID_SIN_ETRANSFER,
  SIN_DIRECT_DEPOSIT,
  buildTimesheetRowsForPayroll,
  type BuildHybridRowsInput,
} from "../../../client/src/lib/hybridPayrollSplit";
import { base, week } from "./payrollFixtures";

describe("buildTimesheetRowsForPayroll: hybrid SIN + cash / e-Transfer", () => {
  const hybrid = (over: Partial<BuildHybridRowsInput>) =>
    base({ paymentMethod: HYBRID_SIN_CASH, sinPayrollHoursCap: 20, cashDeductionPct: 10, ...over });

  it("the first hours up to the cap go to SIN, the rest to cash with the deduction", () => {
    const rows = buildTimesheetRowsForPayroll(hybrid({}));
    expect(rows).toHaveLength(2);
    const [sin, cash] = rows;
    expect(sin).toEqual({
      paySplitSegment: "sin",
      linePaymentMethod: SIN_DIRECT_DEPOSIT,
      dailyHours: week([8, 8, 4, 0, 0]),
      totalRegularHours: 20,
      totalOvertimeHours: 0,
      totalClientBill: 700,
      totalJobseekerPay: 400,
      bonusAmount: 0,
      deductionAmount: 0,
    });
    expect(cash).toEqual({
      paySplitSegment: "cash",
      linePaymentMethod: "Cash",
      dailyHours: week([0, 0, 4, 8, 8]),
      totalRegularHours: 20,
      totalOvertimeHours: 0,
      totalClientBill: 700,
      totalJobseekerPay: 360, // 20 x 20 less 10%
      bonusAmount: 0,
      deductionAmount: 0,
    });
  });

  it("e-Transfer names the second line and segment accordingly", () => {
    const [, second] = buildTimesheetRowsForPayroll(hybrid({ paymentMethod: HYBRID_SIN_ETRANSFER }));
    expect(second.paySplitSegment).toBe("e_transfer");
    expect(second.linePaymentMethod).toBe("e-Transfer");
  });

  it("overtime always goes to the cash part", () => {
    const [sin, cash] = buildTimesheetRowsForPayroll(
      hybrid({ entries: week([10, 10, 10, 10, 10]), overtimeEnabled: true, overtimeHoursRaw: "40" })
    );
    expect(sin.dailyHours).toEqual(week([10, 10, 0, 0, 0]));
    expect(sin.totalRegularHours).toBe(20);
    expect(sin.totalOvertimeHours).toBe(0);
    expect(sin.totalClientBill).toBe(700);
    expect(sin.totalJobseekerPay).toBe(400);
    expect(cash.dailyHours).toEqual(week([0, 0, 10, 10, 10]));
    expect(cash.totalRegularHours).toBe(20);
    expect(cash.totalOvertimeHours).toBe(10);
    expect(cash.totalClientBill).toBe(1225); // 20 x 35 + 10 x 52.50
    expect(cash.totalJobseekerPay).toBe(630); // (20 x 20 + 10 x 30) less 10%
  });

  it("bonus and deduction ride on the SIN row only", () => {
    const [sin, cash] = buildTimesheetRowsForPayroll(hybrid({ bonusAmount: 100, deductionAmount: 25 }));
    expect(sin.totalJobseekerPay).toBe(475); // 400 + 100 - 25
    expect(sin.bonusAmount).toBe(100);
    expect(sin.deductionAmount).toBe(25);
    expect(cash.totalJobseekerPay).toBe(360);
    expect(cash.bonusAmount).toBe(0);
    expect(cash.deductionAmount).toBe(0);
  });

  it("a cap of zero leaves only a cash row, unless there is a bonus or deduction for the SIN row", () => {
    const onlyCash = buildTimesheetRowsForPayroll(hybrid({ sinPayrollHoursCap: 0 }));
    expect(onlyCash.map((r) => r.paySplitSegment)).toEqual(["cash"]);
    expect(onlyCash[0].totalRegularHours).toBe(40);
    expect(onlyCash[0].totalJobseekerPay).toBe(720);

    const withBonus = buildTimesheetRowsForPayroll(hybrid({ sinPayrollHoursCap: 0, bonusAmount: 50 }));
    expect(withBonus.map((r) => r.paySplitSegment)).toEqual(["sin", "cash"]);
    expect(withBonus[0].totalRegularHours).toBe(0);
    expect(withBonus[0].totalJobseekerPay).toBe(50);
  });

  it("a cap above the regular hours puts everything on SIN", () => {
    const rows = buildTimesheetRowsForPayroll(hybrid({ sinPayrollHoursCap: 50 }));
    expect(rows.map((r) => r.paySplitSegment)).toEqual(["sin"]);
    expect(rows[0].totalRegularHours).toBe(40);
    expect(rows[0].totalJobseekerPay).toBe(800);
    expect(rows[0].totalClientBill).toBe(1400);
  });

  it("a negative cap counts as zero", () => {
    const rows = buildTimesheetRowsForPayroll(hybrid({ sinPayrollHoursCap: -5 }));
    expect(rows.map((r) => r.paySplitSegment)).toEqual(["cash"]);
  });

  it("the two rows always add up to the hours worked", () => {
    for (const cap of [0, 7.5, 20, 33.25, 40]) {
      const rows = buildTimesheetRowsForPayroll(hybrid({ sinPayrollHoursCap: cap, entries: week([9.5, 8.25, 7, 8, 7.5]) }));
      const hours = rows.reduce((s, r) => s + r.totalRegularHours + r.totalOvertimeHours, 0);
      expect(Math.round(hours * 100) / 100).toBe(40.25);
      const daily = rows.flatMap((r) => r.dailyHours).reduce((s, d) => s + d.hours, 0);
      expect(Math.round(daily * 100) / 100).toBe(40.25);
    }
  });
});
