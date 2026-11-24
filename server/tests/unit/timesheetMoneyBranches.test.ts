// R-4, gate (c): the branches of the money code that the screens reach and the older unit tests leave out: the overtime
// threshold exactly, one cent rounded each way, the cash deduction on overtime pay, HST on overtime, a hybrid week
// paid by e-Transfer, and a hybrid jobseeker with an HST value on the profile. Every expected value is worked out by hand
// in the line beside it (pay 20/h, overtime pay 30/h, bill 35/h, overtime bill 52.50/h unless a case says otherwise).
import { describe, expect, it } from "vitest";
import {
  HYBRID_SIN_CASH,
  HYBRID_SIN_ETRANSFER,
  buildTimesheetRowsForPayroll,
  computeWeeklyRegularOvertime,
  type BuildHybridRowsInput,
} from "../../../client/src/lib/hybridPayrollSplit";
import { base, week } from "./payrollFixtures";

const overtime = (over: Partial<BuildHybridRowsInput>) =>
  base({ overtimeEnabled: true, overtimeHoursRaw: "40", ...over });

describe("the overtime threshold", () => {
  it("exactly at the threshold is all regular; half an hour over is half an hour of overtime", () => {
    const [atThreshold] = buildTimesheetRowsForPayroll(overtime({}));
    expect(atThreshold.totalRegularHours).toBe(40);
    expect(atThreshold.totalOvertimeHours).toBe(0);
    expect(atThreshold.totalJobseekerPay).toBe(800);
    expect(atThreshold.totalClientBill).toBe(1400);

    const [over] = buildTimesheetRowsForPayroll(
      overtime({ entries: week([8, 8, 8, 8, 8.5]) })
    );
    expect(over.totalRegularHours).toBe(40);
    expect(over.totalOvertimeHours).toBe(0.5);
    expect(over.totalJobseekerPay).toBe(815); // 40 x 20 + 0.5 x 30
    expect(over.totalClientBill).toBe(1426.25); // 40 x 35 + 0.5 x 52.50
  });

  it("a threshold of 44 hours moves the split, in the hours, the pay and the bill", () => {
    const [row] = buildTimesheetRowsForPayroll(
      overtime({
        overtimeHoursRaw: "44",
        entries: week([10, 10, 10, 10, 10]),
      })
    );
    expect(row.totalRegularHours).toBe(44);
    expect(row.totalOvertimeHours).toBe(6);
    expect(row.totalJobseekerPay).toBe(1060); // 44 x 20 + 6 x 30
    expect(row.totalClientBill).toBe(1855); // 44 x 35 + 6 x 52.50

    const [exact] = buildTimesheetRowsForPayroll(
      overtime({
        overtimeHoursRaw: "44",
        entries: week([11, 11, 11, 11]),
      })
    );
    expect(exact.totalOvertimeHours).toBe(0);
    expect(exact.totalJobseekerPay).toBe(880);
  });

  it("a threshold left empty is 40; without overtime 50 hours are all regular", () => {
    expect(
      computeWeeklyRegularOvertime({
        entries: week([10, 10, 10, 10, 10]),
        overtimeEnabled: true,
        overtimeHoursRaw: "",
      })
    ).toEqual({ weeklyRegularHours: 40, weeklyOvertimeHours: 10 });
    const [row] = buildTimesheetRowsForPayroll(
      base({ entries: week([10, 10, 10, 10, 10]) })
    );
    expect(row.totalRegularHours).toBe(50);
    expect(row.totalOvertimeHours).toBe(0);
    expect(row.totalJobseekerPay).toBe(1000);
    expect(row.totalClientBill).toBe(1750);
  });

  it("a threshold that is not a number gives a pay that is not a number (today's answer, inbox row)", () => {
    const [row] = buildTimesheetRowsForPayroll(
      overtime({ overtimeHoursRaw: "abc" })
    );
    expect(Number.isNaN(row.totalJobseekerPay)).toBe(true);
  });
});

describe("rounding to the cent", () => {
  it("pay and bill are rounded once, to the nearest cent, down below half a cent and up above it", () => {
    const rate = (effectiveRegularPayRate: number, regularBillRate: number) =>
      buildTimesheetRowsForPayroll(
        base({
          entries: week([10]),
          effectiveRegularPayRate,
          regularBillRate,
        })
      )[0];
    const down = rate(19.9944, 35.0044);
    expect(down.totalJobseekerPay).toBe(199.94); // 199.944
    expect(down.totalClientBill).toBe(350.04); // 350.044
    const up = rate(19.9946, 35.0046);
    expect(up.totalJobseekerPay).toBe(199.95); // 199.946
    expect(up.totalClientBill).toBe(350.05); // 350.046
  });

  it("the HST is reported to the cent and the pay includes it before the pay is rounded", () => {
    const [row] = buildTimesheetRowsForPayroll(
      base({
        entries: week([10]),
        effectiveRegularPayRate: 19.99,
        paymentMethod: "Corporation-Direct Deposit",
        hstGst: "13%",
      })
    );
    expect(row.taxAmount).toBe(25.99); // 199.90 x 13% = 25.987
    expect(row.totalJobseekerPay).toBe(225.89); // 199.90 + 25.987 = 225.887
  });

  it("the hours are rounded to hundredths before they are paid", () => {
    const [row] = buildTimesheetRowsForPayroll(
      base({ entries: week([2.666, 2.666, 2.666]) })
    );
    expect(row.totalRegularHours).toBe(8); // 7.998
    expect(row.totalJobseekerPay).toBe(160);
    expect(row.dailyHours.map((d) => d.hours)).toEqual([2.67, 2.67, 2.67]);
  });
});

describe("cash and e-Transfer deductions on overtime weeks", () => {
  it.each([
    ["Cash", 10, 990], // base 40 x 20 + 10 x 30 = 1100, less 10% = 110
    ["e-Transfer", 5, 1045], // 1100 less 5% = 55
    ["Cash", 0, 1100],
  ])(
    "%s at %i%% comes off regular and overtime pay together",
    (paymentMethod, cashDeductionPct, pay) => {
      const [row] = buildTimesheetRowsForPayroll(
        overtime({
          entries: week([10, 10, 10, 10, 10]),
          paymentMethod,
          cashDeductionPct,
        })
      );
      expect(row.totalJobseekerPay).toBe(pay);
      expect(row.totalClientBill).toBe(1925);
    }
  );

  it("the deduction percentage is taken from the base pay only, then bonus and deduction are applied", () => {
    const [row] = buildTimesheetRowsForPayroll(
      base({
        paymentMethod: "Cash",
        cashDeductionPct: 10,
        bonusAmount: 50,
        deductionAmount: 20,
      })
    );
    expect(row.totalJobseekerPay).toBe(750); // 800 - 80 + 50 - 20
  });
});

describe("a corporation's HST on overtime weeks", () => {
  it("is worked out on regular and overtime pay together, plus the bonus, less the deduction", () => {
    const [plain] = buildTimesheetRowsForPayroll(
      overtime({
        entries: week([10, 10, 10, 10, 10]),
        paymentMethod: "Corporation-Direct Deposit",
        hstGst: "13%",
      })
    );
    expect(plain.taxAmount).toBe(143); // 1100 x 13%
    expect(plain.totalJobseekerPay).toBe(1243);

    const [withBonus] = buildTimesheetRowsForPayroll(
      overtime({
        entries: week([10, 10, 10, 10, 10]),
        paymentMethod: "Corporation-Direct Deposit",
        hstGst: "13%",
        bonusAmount: 100,
      })
    );
    expect(withBonus.taxAmount).toBe(156); // (1100 + 100) x 13%
    expect(withBonus.totalJobseekerPay).toBe(1356); // 1100 + 156 + 100
  });

  it("reads 13.5%, 13 and '13 %' as numbers and anything with other words as no tax", () => {
    const tax = (hstGst: string) =>
      buildTimesheetRowsForPayroll(
        base({ paymentMethod: "Corporation-Cheque", hstGst })
      )[0].taxAmount;
    expect(tax("13.5%")).toBe(108); // 800 x 13.5%
    expect(tax("13")).toBe(104);
    expect(tax("13 %")).toBe(104);
    expect(tax("HST 13%")).toBe(0);
    expect(tax("")).toBe(0);
  });
});

describe("a hybrid week paid by e-Transfer", () => {
  const hybrid = (over: Partial<BuildHybridRowsInput>) =>
    base({
      paymentMethod: HYBRID_SIN_ETRANSFER,
      sinPayrollHoursCap: 30,
      cashDeductionPct: 5,
      ...over,
    });

  it("the first 30 hours are SIN, the other 10 are e-Transfer less 5%", () => {
    const [sin, second] = buildTimesheetRowsForPayroll(hybrid({}));
    expect(sin.totalRegularHours).toBe(30);
    expect(sin.totalJobseekerPay).toBe(600); // 30 x 20
    expect(sin.totalClientBill).toBe(1050);
    expect(second.paySplitSegment).toBe("e_transfer");
    expect(second.totalRegularHours).toBe(10);
    expect(second.totalJobseekerPay).toBe(190); // 10 x 20 less 5%
    expect(second.totalClientBill).toBe(350);
  });

  it("a deduction percentage of zero pays the second part in full", () => {
    const [, second] = buildTimesheetRowsForPayroll(
      hybrid({ cashDeductionPct: 0 })
    );
    expect(second.totalJobseekerPay).toBe(200);
  });

  it("an HST value on the profile adds no tax to a hybrid week (no row has a tax)", () => {
    const rows = buildTimesheetRowsForPayroll(hybrid({ hstGst: "13%" }));
    expect(rows.map((r) => r.taxAmount)).toEqual([undefined, undefined]);
    expect(rows.map((r) => r.totalJobseekerPay)).toEqual([600, 190]);
  });

  it("a cap that is not on a whole hour splits the pay at the fraction", () => {
    const [sin, second] = buildTimesheetRowsForPayroll(
      hybrid({
        paymentMethod: HYBRID_SIN_CASH,
        sinPayrollHoursCap: 19.5,
        cashDeductionPct: 10,
      })
    );
    expect(sin.totalRegularHours).toBe(19.5);
    expect(sin.totalJobseekerPay).toBe(390); // 19.5 x 20
    expect(second.totalRegularHours).toBe(20.5);
    expect(second.totalJobseekerPay).toBe(369); // 20.5 x 20 = 410 less 10%
    expect(sin.totalClientBill + second.totalClientBill).toBe(1400);
  });

  it("with a threshold of 44 the cap and the overtime both follow it", () => {
    const [sin, second] = buildTimesheetRowsForPayroll(
      hybrid({
        paymentMethod: HYBRID_SIN_CASH,
        sinPayrollHoursCap: 20,
        cashDeductionPct: 10,
        overtimeEnabled: true,
        overtimeHoursRaw: "44",
        entries: week([10, 10, 10, 10, 10]),
      })
    );
    expect(sin.totalRegularHours).toBe(20);
    expect(second.totalRegularHours).toBe(24);
    expect(second.totalOvertimeHours).toBe(6);
    expect(second.totalJobseekerPay).toBe(594); // (24 x 20 + 6 x 30) = 660 less 10%
    expect(second.totalClientBill).toBe(1155); // 24 x 35 + 6 x 52.50
  });
});

describe("the payment method names the screens send", () => {
  it("an unknown method is paid like direct deposit, with no deduction and no tax", () => {
    const [row] = buildTimesheetRowsForPayroll(
      base({
        paymentMethod: "Cheque",
        cashDeductionPct: 10,
        hstGst: "13%",
      })
    );
    expect(row.totalJobseekerPay).toBe(800);
    expect(row.taxAmount).toBe(0);
  });

  it("the hybrid names are matched exactly, so a lower-case name is not hybrid", () => {
    const rows = buildTimesheetRowsForPayroll(
      base({
        paymentMethod: HYBRID_SIN_CASH.toLowerCase(),
        sinPayrollHoursCap: 20,
      })
    );
    expect(rows.map((r) => r.paySplitSegment)).toEqual(["single"]);
  });
});
