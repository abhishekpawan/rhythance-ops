// R-5s, step 3 (the invoice page's money functions, now in a file of their own). `getTaxInfo`,
// `calculateLineItemHours`, `calculateDueDate` and `calculateLineItemTotals` were written inline in
// `InvoiceManagement.tsx`; R-5s moved them out unchanged into `client/src/pages/InvoiceManagement/invoiceCalculations.ts`
// (the component's state they read became a parameter: `lineItems`, and `setDueDate`). These cases cover every branch.
//
// Expected values are worked out by hand (hours x rate, each line's tax from its province, sums). Where the page's
// floating point gives a number with noise (316.20000000000005) the case says so: the page never rounds (inbox 80,
// closed: no change), so today's sums are pinned as they are, to the last digit, with `toBe`.
import { describe, expect, it, vi } from "vitest";

import { PAYMENT_TERMS } from "../../../client/src/constants/formOptions";
import {
  calculateDueDate,
  calculateLineItemHours,
  calculateLineItemTotals,
  getTaxInfo,
} from "../../../client/src/pages/InvoiceManagement/invoiceCalculations";
import { SALES_TAX_OPTIONS } from "../../../client/src/pages/InvoiceManagement/invoiceTypes";
import type { InvoiceLineItem } from "../../../client/src/pages/InvoiceManagement/invoiceTypes";
import type { PositionData } from "../../../client/src/services/api/position";

const ON = "13.00% [ON]";
const QC = "14.975% [QC]";
const BC = "5.00% [BC]";
const AB = "5.00% [AB]";
const ZERO = "0.00% [ZERO RATED]";

function position(extra: Partial<PositionData>): PositionData {
  return { id: "p1", title: "Warehouse", ...extra } as PositionData;
}

function line(extra: Partial<InvoiceLineItem>): InvoiceLineItem {
  return {
    id: "l1",
    position: null,
    jobseeker: null,
    description: "",
    hours: "",
    regularBillRate: "",
    regularPayRate: "",
    salesTax: ON,
    ...extra,
  };
}

// 40 regular hours, then 60 an hour
const OVERTIME = position({
  overtimeEnabled: true,
  overtimeHours: "40",
  overtimeBillRate: "60",
});

describe("getTaxInfo: the tax type and split of a sales tax option", () => {
  it("Ontario is HST, the whole percentage", () => {
    expect(getTaxInfo(ON)).toEqual({
      taxType: "HST",
      hstPercentage: 13,
      gstPercentage: 0,
      qstPercentage: 0,
      totalTaxPercentage: 13,
    });
  });

  it("zero rated is HST at 0, whatever the percentage written before the bracket", () => {
    expect(getTaxInfo(ZERO)).toEqual({
      taxType: "HST",
      hstPercentage: 0,
      gstPercentage: 0,
      qstPercentage: 0,
      totalTaxPercentage: 0,
    });
    expect(getTaxInfo("7.00% [ZERO RATED]").hstPercentage).toBe(7);
  });

  it("Quebec at 14.975% is GST 5 plus QST 9.975", () => {
    expect(getTaxInfo(QC)).toEqual({
      taxType: "GST_QST",
      hstPercentage: 0,
      gstPercentage: 5,
      qstPercentage: 9.975,
      totalTaxPercentage: 14.975,
    });
  });

  it("Quebec at any other percentage is plain GST (5.00% [QC], 9.975% [QC])", () => {
    expect(getTaxInfo("5.00% [QC]")).toEqual({
      taxType: "GST",
      hstPercentage: 0,
      gstPercentage: 5,
      qstPercentage: 0,
      totalTaxPercentage: 5,
    });
    expect(getTaxInfo("9.975% [QC]").taxType).toBe("GST");
    expect(getTaxInfo("9.975% [QC]").gstPercentage).toBe(9.975);
  });

  it("Alberta and British Columbia are GST", () => {
    for (const option of [AB, BC]) {
      expect(getTaxInfo(option)).toEqual({
        taxType: "GST",
        hstPercentage: 0,
        gstPercentage: 5,
        qstPercentage: 0,
        totalTaxPercentage: 5,
      });
    }
  });

  it("an Ontario label with the Quebec percentage is still HST (the province decides first)", () => {
    expect(getTaxInfo("14.975% [ON]")).toEqual({
      taxType: "HST",
      hstPercentage: 14.975,
      gstPercentage: 0,
      qstPercentage: 0,
      totalTaxPercentage: 14.975,
    });
  });

  it("every option of the page's list gives the split the invoice and its PDF show", () => {
    expect(
      SALES_TAX_OPTIONS.map((o) => [
        o,
        getTaxInfo(o).taxType,
        getTaxInfo(o).totalTaxPercentage,
      ])
    ).toEqual([
      ["5.00% [AB]", "GST", 5],
      ["5.00% [BC]", "GST", 5],
      ["13.00% [ON]", "HST", 13],
      ["14.975% [QC]", "GST_QST", 14.975],
      ["0.00% [ZERO RATED]", "HST", 0],
      ["5.00% [QC]", "GST", 5],
    ]);
  });

  it("an unknown province is GST at the written percentage; no brackets means no province, also GST", () => {
    expect(getTaxInfo("7% [XX]")).toMatchObject({
      taxType: "GST",
      gstPercentage: 7,
      totalTaxPercentage: 7,
    });
    expect(getTaxInfo("13%")).toMatchObject({
      taxType: "GST",
      gstPercentage: 13,
      totalTaxPercentage: 13,
    });
    // province letters are case-sensitive: "[on]" is not Ontario
    expect(getTaxInfo("13.00% [on]").taxType).toBe("GST");
  });

  it("no readable percentage is 0 (GST), an empty text too", () => {
    for (const text of ["abc", ""]) {
      expect(getTaxInfo(text)).toEqual({
        taxType: "GST",
        hstPercentage: 0,
        gstPercentage: 0,
        qstPercentage: 0,
        totalTaxPercentage: 0,
      });
    }
  });

  it("the percentage is the first number before a % sign: a leading dot is not read (.5% reads as 5)", () => {
    expect(getTaxInfo(".5% [AB]").totalTaxPercentage).toBe(5);
  });
});

describe("calculateLineItemHours: regular and overtime hours of one line", () => {
  it("no position, or overtime off on the position: all regular", () => {
    expect(calculateLineItemHours(50, null)).toEqual({
      regularHours: 50,
      overtimeHours: 0,
    });
    expect(
      calculateLineItemHours(
        50,
        position({ overtimeEnabled: false, overtimeHours: "40" })
      )
    ).toEqual({
      regularHours: 50,
      overtimeHours: 0,
    });
    expect(calculateLineItemHours(50, position({}))).toEqual({
      regularHours: 50,
      overtimeHours: 0,
    });
  });

  it("overtime on: hours up to the position's threshold are regular, the rest overtime", () => {
    const p = position({ overtimeEnabled: true, overtimeHours: "44" });
    expect(calculateLineItemHours(50, p)).toEqual({
      regularHours: 44,
      overtimeHours: 6,
    });
    expect(calculateLineItemHours(44, p)).toEqual({
      regularHours: 44,
      overtimeHours: 0,
    });
    expect(calculateLineItemHours(30, p)).toEqual({
      regularHours: 30,
      overtimeHours: 0,
    });
    expect(calculateLineItemHours(0, p)).toEqual({
      regularHours: 0,
      overtimeHours: 0,
    });
  });

  it("overtime on with no threshold written: 40", () => {
    const p = position({ overtimeEnabled: true });
    expect(calculateLineItemHours(45, p)).toEqual({
      regularHours: 40,
      overtimeHours: 5,
    });
    expect(calculateLineItemHours(40, p)).toEqual({
      regularHours: 40,
      overtimeHours: 0,
    });
    expect(
      calculateLineItemHours(
        10,
        position({ overtimeEnabled: true, overtimeHours: "" })
      )
    ).toEqual({
      regularHours: 10,
      overtimeHours: 0,
    });
    expect(
      calculateLineItemHours(
        45,
        position({ overtimeEnabled: true, overtimeHours: "" })
      )
    ).toEqual({
      regularHours: 40,
      overtimeHours: 5,
    });
  });

  it("a decimal threshold and decimal hours", () => {
    const p = position({ overtimeEnabled: true, overtimeHours: "37.5" });
    expect(calculateLineItemHours(40.25, p)).toEqual({
      regularHours: 37.5,
      overtimeHours: 2.75,
    });
  });

  it("negative hours are all regular (the overtime part is never below 0)", () => {
    const p = position({ overtimeEnabled: true, overtimeHours: "40" });
    expect(calculateLineItemHours(-5, p)).toEqual({
      regularHours: -5,
      overtimeHours: 0,
    });
  });

  it("a threshold that is not a number makes both parts NaN (inbox 69, pinned as it is)", () => {
    const p = position({ overtimeEnabled: true, overtimeHours: "abc" });
    const r = calculateLineItemHours(50, p);
    expect(Number.isNaN(r.regularHours)).toBe(true);
    expect(Number.isNaN(r.overtimeHours)).toBe(true);
  });
});

describe("calculateDueDate: invoice date plus the payment term, written through the setter it is given", () => {
  function run(invoiceDate: string, terms: string) {
    const setDueDate = vi.fn();
    calculateDueDate(invoiceDate, terms, setDueDate);
    return setDueDate;
  }

  it("Due on Receipt is the invoice date itself", () => {
    const set = run("2026-03-15", "Due on Receipt");
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith("2026-03-15");
  });

  it("each Net term of the page's list adds its days (worked out by hand from 2026-01-15)", () => {
    const expected: Record<string, string> = {
      "Net 15": "2026-01-30",
      "Net 22": "2026-02-06",
      "Net 30": "2026-02-14",
      "Net 45": "2026-03-01",
      "Net 60": "2026-03-16",
      "Net 65": "2026-03-21",
      "Net 90": "2026-04-15",
    };
    for (const term of PAYMENT_TERMS) {
      if (term === "Due on Receipt") continue;
      const set = run("2026-01-15", term);
      expect(set, term).toHaveBeenCalledTimes(1);
      expect(set, term).toHaveBeenCalledWith(expected[term]);
    }
  });

  it("crosses a month, a year and a leap day", () => {
    expect(run("2026-12-20", "Net 15")).toHaveBeenCalledWith("2027-01-04");
    expect(run("2028-02-10", "Net 30")).toHaveBeenCalledWith("2028-03-11");
    expect(run("2026-02-10", "Net 30")).toHaveBeenCalledWith("2026-03-12");
  });

  it("Net 0 is the invoice date", () => {
    expect(run("2026-03-15", "Net 0")).toHaveBeenCalledWith("2026-03-15");
  });

  it("nothing is written for an empty date, an empty term or a term the rule does not know", () => {
    expect(run("", "Net 30")).not.toHaveBeenCalled();
    expect(run("2026-03-15", "")).not.toHaveBeenCalled();
    expect(run("2026-03-15", "Prepaid")).not.toHaveBeenCalled();
    expect(run("2026-03-15", "net 30")).not.toHaveBeenCalled();
    expect(run("2026-03-15", "Net abc")).not.toHaveBeenCalled();
    expect(run("2026-03-15", "Due on receipt")).not.toHaveBeenCalled();
  });
});

describe("calculateLineItemTotals: line amounts, taxes by province, sums", () => {
  it("Ontario: 100 h at 40 = 4,000, HST 520, total 4,520", () => {
    const r = calculateLineItemTotals([
      line({ hours: "100", regularBillRate: "40" }),
    ]);
    expect(r).toMatchObject({
      subtotal: 4000,
      totalTax: 520,
      totalHST: 520,
      totalGST: 0,
      totalQST: 0,
      grandTotal: 4520,
    });
    expect(r.lineItemTotals).toHaveLength(1);
    expect(r.lineItemTotals[0]).toMatchObject({
      totalRegularHours: 100,
      totalOvertimeHours: 0,
      regularBillRate: 40,
      overtimeBillRate: 40,
      regularAmount: 4000,
      overtimeAmount: 0,
      lineSubtotal: 4000,
      lineTax: 520,
      lineHST: 520,
      lineGST: 0,
      lineQST: 0,
      lineTotal: 4520,
    });
    expect(r.lineItemTotals[0].taxInfo).toEqual(getTaxInfo(ON));
  });

  it("Quebec: 4,000 gives GST 200 and QST 399 (14.975%: 599), total 4,599", () => {
    const r = calculateLineItemTotals([
      line({ hours: "100", regularBillRate: "40", salesTax: QC }),
    ]);
    expect(r).toMatchObject({
      subtotal: 4000,
      totalTax: 599,
      totalHST: 0,
      totalGST: 200,
      totalQST: 399,
      grandTotal: 4599,
    });
  });

  it("Quebec at 5.00%: GST 200 only, no QST", () => {
    const r = calculateLineItemTotals([
      line({ hours: "100", regularBillRate: "40", salesTax: "5.00% [QC]" }),
    ]);
    expect(r).toMatchObject({
      totalTax: 200,
      totalGST: 200,
      totalQST: 0,
      totalHST: 0,
      grandTotal: 4200,
    });
  });

  it("British Columbia: 8.5 h at 37.20 = 316.20, GST 15.81, total 332.01 (floating point noise kept, as today)", () => {
    const r = calculateLineItemTotals([
      line({ hours: "8.5", regularBillRate: "37.2", salesTax: BC }),
    ]);
    expect(r.subtotal).toBe(316.20000000000005);
    expect(r.totalTax).toBe(15.810000000000002);
    expect(r.totalGST).toBe(15.810000000000002);
    expect(r.grandTotal).toBe(332.01000000000005);
    expect(r.subtotal).toBeCloseTo(316.2, 10);
    expect(r.grandTotal).toBeCloseTo(332.01, 10);
  });

  it("Alberta zero rated: 35 h at 40 = 1,400, no tax", () => {
    const r = calculateLineItemTotals([
      line({ hours: "35", regularBillRate: "40", salesTax: ZERO }),
    ]);
    expect(r).toMatchObject({
      subtotal: 1400,
      totalTax: 0,
      totalHST: 0,
      totalGST: 0,
      totalQST: 0,
      grandTotal: 1400,
    });
  });

  it("overtime: 50 h with a 40 h threshold and 60 an hour = 40 x 40 + 10 x 60 = 2,200, HST 286", () => {
    const r = calculateLineItemTotals([
      line({ hours: "50", regularBillRate: "40", position: OVERTIME }),
    ]);
    expect(r.lineItemTotals[0]).toMatchObject({
      totalRegularHours: 40,
      totalOvertimeHours: 10,
      overtimeBillRate: 60,
      regularAmount: 1600,
      overtimeAmount: 600,
      lineSubtotal: 2200,
    });
    expect(r).toMatchObject({
      subtotal: 2200,
      totalTax: 286,
      grandTotal: 2486,
    });
  });

  it("overtime on but no overtime rate on the position: overtime hours bill at the regular rate", () => {
    const p = position({ overtimeEnabled: true, overtimeHours: "40" });
    const r = calculateLineItemTotals([
      line({ hours: "50", regularBillRate: "40", position: p }),
    ]);
    expect(r.lineItemTotals[0]).toMatchObject({
      totalRegularHours: 40,
      totalOvertimeHours: 10,
      overtimeBillRate: 40,
      regularAmount: 1600,
      overtimeAmount: 400,
    });
    expect(r.subtotal).toBe(2000);
    expect(r.grandTotal).toBe(2260);
  });

  it("an overtime rate on a position with overtime off is ignored: all regular hours", () => {
    const p = position({
      overtimeEnabled: false,
      overtimeHours: "40",
      overtimeBillRate: "60",
    });
    const r = calculateLineItemTotals([
      line({ hours: "50", regularBillRate: "40", position: p }),
    ]);
    expect(r.lineItemTotals[0]).toMatchObject({
      totalRegularHours: 50,
      totalOvertimeHours: 0,
      overtimeBillRate: 40,
      regularAmount: 2000,
      overtimeAmount: 0,
    });
    expect(r.grandTotal).toBe(2260);
  });

  it("a split kept from a saved invoice wins over a new calculation (35 + 15 against 40 + 10)", () => {
    const r = calculateLineItemTotals([
      line({
        hours: "50",
        regularBillRate: "40",
        position: OVERTIME,
        totalRegularHours: 35,
        totalOvertimeHours: 15,
      }),
    ]);
    expect(r.lineItemTotals[0]).toMatchObject({
      totalRegularHours: 35,
      totalOvertimeHours: 15,
      regularAmount: 1400,
      overtimeAmount: 900,
      lineSubtotal: 2300,
    });
    expect(r).toMatchObject({
      subtotal: 2300,
      totalTax: 299,
      grandTotal: 2599,
    });
  });

  it("a kept split that does not add up to the hours is calculated again (35 + 14 against 50)", () => {
    const r = calculateLineItemTotals([
      line({
        hours: "50",
        regularBillRate: "40",
        position: OVERTIME,
        totalRegularHours: 35,
        totalOvertimeHours: 14,
      }),
    ]);
    expect(r.lineItemTotals[0]).toMatchObject({
      totalRegularHours: 40,
      totalOvertimeHours: 10,
      lineSubtotal: 2200,
    });
  });

  it("a kept split within a hundredth of the hours is still used (35 + 14.995 against 50)", () => {
    const r = calculateLineItemTotals([
      line({
        hours: "50",
        regularBillRate: "40",
        position: OVERTIME,
        totalRegularHours: 35,
        totalOvertimeHours: 14.995,
      }),
    ]);
    expect(r.lineItemTotals[0]).toMatchObject({
      totalRegularHours: 35,
      totalOvertimeHours: 14.995,
    });
    expect(r.lineItemTotals[0].overtimeAmount).toBe(899.6999999999999);
    expect(r.subtotal).toBe(2299.7);
    expect(r.totalTax).toBe(298.961);
    expect(r.grandTotal).toBe(2598.661);
  });

  it("a split with only one of the two hours kept is calculated again", () => {
    const r = calculateLineItemTotals([
      line({
        hours: "50",
        regularBillRate: "40",
        position: OVERTIME,
        totalRegularHours: 35,
      }),
    ]);
    expect(r.lineItemTotals[0]).toMatchObject({
      totalRegularHours: 40,
      totalOvertimeHours: 10,
    });
  });

  it("today's unrounded sums: a typed part of a cent stays (11.275 + 1.46575 = 12.74075)", () => {
    const r = calculateLineItemTotals([
      line({ hours: "1", regularBillRate: "11.275" }),
    ]);
    expect(r.subtotal).toBe(11.275);
    expect(r.totalTax).toBe(1.46575);
    expect(r.totalHST).toBe(1.46575);
    expect(r.grandTotal).toBe(12.74075);
  });

  it("today's unrounded sums: a typed overtime line, 40 x 40.25 + 5 x 43.50 = 1,827.50, HST 237.575", () => {
    const p = position({
      overtimeEnabled: true,
      overtimeHours: "40",
      overtimeBillRate: "43.5",
    });
    const r = calculateLineItemTotals([
      line({ hours: "45", regularBillRate: "40.25", position: p }),
    ]);
    expect(r.lineItemTotals[0]).toMatchObject({
      regularAmount: 1610,
      overtimeAmount: 217.5,
    });
    expect(r.subtotal).toBe(1827.5);
    expect(r.totalTax).toBe(237.575);
    expect(r.grandTotal).toBe(2065.075);
  });

  it("a discount line (a negative rate, zero rated) lowers the subtotal and carries no tax", () => {
    const r = calculateLineItemTotals([
      line({ id: "a", hours: "1", regularBillRate: "1500" }),
      line({ id: "b", hours: "1", regularBillRate: "-150", salesTax: ZERO }),
    ]);
    expect(
      r.lineItemTotals.map((l) => [l.lineSubtotal, l.lineTax, l.lineTotal])
    ).toEqual([
      [1500, 195, 1695],
      [-150, -0, -150], // the tax of a negative line at 0% is a negative zero, as today
    ]);
    expect(r).toMatchObject({
      subtotal: 1350,
      totalTax: 195,
      totalHST: 195,
      grandTotal: 1545,
    });
  });

  it("several provinces on one invoice: each tax adds into its own total (4 x 255)", () => {
    const r = calculateLineItemTotals([
      line({ id: "on", hours: "10", regularBillRate: "25.5", salesTax: ON }),
      line({ id: "qc", hours: "10", regularBillRate: "25.5", salesTax: QC }),
      line({ id: "bc", hours: "10", regularBillRate: "25.5", salesTax: BC }),
      line({ id: "ab", hours: "10", regularBillRate: "25.5", salesTax: ZERO }),
    ]);
    expect(r.subtotal).toBe(1020);
    expect(r.totalHST).toBe(33.15); // Ontario 13% of 255
    expect(r.totalGST).toBe(25.5); // Quebec 5% (12.75) + British Columbia 5% (12.75)
    expect(r.totalQST).toBe(25.43625); // Quebec 9.975% of 255
    expect(r.totalTax).toBe(84.08625); // 33.15 + 12.75 + 25.43625 + 12.75
    expect(r.grandTotal).toBe(1104.08625);
    expect(r.lineItemTotals.map((l) => l.id)).toEqual(["on", "qc", "bc", "ab"]);
    expect(r.lineItemTotals.map((l) => l.lineTotal)).toEqual([
      288.15, 293.18625, 267.75, 255,
    ]);
  });

  it("no lines: every total is 0", () => {
    expect(calculateLineItemTotals([])).toEqual({
      lineItemTotals: [],
      subtotal: 0,
      totalTax: 0,
      totalHST: 0,
      totalGST: 0,
      totalQST: 0,
      grandTotal: 0,
    });
  });

  it("hours or rate that are empty or not numbers count as 0", () => {
    const r = calculateLineItemTotals([
      line({ id: "a", hours: "abc", regularBillRate: "x" }),
      line({ id: "b", hours: "", regularBillRate: "40" }),
      line({ id: "c", hours: "10", regularBillRate: "" }),
    ]);
    expect(r.subtotal).toBe(0);
    expect(r.grandTotal).toBe(0);
    expect(r.lineItemTotals.map((l) => l.regularBillRate)).toEqual([0, 40, 0]);
  });

  it("a threshold that is not a number makes the totals NaN (inbox 69, pinned as it is)", () => {
    const p = position({ overtimeEnabled: true, overtimeHours: "abc" });
    const r = calculateLineItemTotals([
      line({ hours: "50", regularBillRate: "40", position: p }),
    ]);
    expect(Number.isNaN(r.subtotal)).toBe(true);
    expect(Number.isNaN(r.grandTotal)).toBe(true);
  });

  it("each returned line keeps the line's own fields and does not change the input", () => {
    const input = [
      line({
        id: "keep",
        description: "Work period",
        hours: "10",
        regularBillRate: "20",
      }),
    ];
    const before = JSON.stringify(input);
    const r = calculateLineItemTotals(input);
    expect(r.lineItemTotals[0]).toMatchObject({
      id: "keep",
      description: "Work period",
      hours: "10",
      salesTax: ON,
    });
    expect(JSON.stringify(input)).toBe(before);
  });
});
