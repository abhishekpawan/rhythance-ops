import { describe, expect, it } from "vitest";
import {
  envelopeCsvNumbers,
  formatCurrency,
  formatPhoneNumber,
  sortEnvelopeRowsForCsv,
} from "../../../client/src/pages/Reports/envelopeReportShared";
import { weeklyTimesheetSubTotal } from "../../../client/src/pages/Reports/weeklyTimesheetCalc";
import type { EnvelopePrintingReportRow } from "../../../client/src/services/api/reports";

// The numbers the Reports screens work out in the browser instead of showing what the server sent.
// Expected values are worked out by hand, not copied from the code's output.

describe("weekly timesheet report: Sub Total", () => {
  it("is regular hours x regular pay plus overtime hours x overtime pay, in dollars and cents", () => {
    // 40 x 20.50 = 820.00; 5 x 30.75 = 153.75
    expect(
      weeklyTimesheetSubTotal({
        total_regular_hours: 40,
        regular_pay_rate: 20.5,
        total_overtime_hours: 5,
        overtime_pay_rate: 30.75,
      })
    ).toBe("$973.75");
  });

  it("reads hours and rates the server sends as strings", () => {
    // 37.5 x 18.00 = 675.00; 2.25 x 27.00 = 60.75
    expect(
      weeklyTimesheetSubTotal({
        total_regular_hours: "37.5",
        regular_pay_rate: "18.00",
        total_overtime_hours: "2.25",
        overtime_pay_rate: "27.00",
      })
    ).toBe("$735.75");
  });

  it("is $0.00 when nothing is there, whatever is missing", () => {
    expect(weeklyTimesheetSubTotal(undefined)).toBe("$0.00");
    expect(weeklyTimesheetSubTotal({})).toBe("$0.00");
    expect(
      weeklyTimesheetSubTotal({
        total_regular_hours: null,
        regular_pay_rate: null,
        total_overtime_hours: "",
        overtime_pay_rate: undefined,
      })
    ).toBe("$0.00");
  });

  it("shows $NaN when a rate is text that is not a number (today's behaviour; the timesheet endpoint sends numbers only, so the screen cannot show it today)", () => {
    expect(
      weeklyTimesheetSubTotal({
        total_regular_hours: 8,
        regular_pay_rate: "N/A",
      })
    ).toBe("$NaN");
  });

  it("counts regular hours with no overtime", () => {
    expect(
      weeklyTimesheetSubTotal({
        total_regular_hours: 8,
        regular_pay_rate: 17.6,
      })
    ).toBe("$140.80");
  });

  it("rounds with toFixed on the floating-point product: a half cent that is stored just below stays down", () => {
    // 1 x 1.005 is $1.005 on paper; 1.005 is stored as 1.00499999999999989..., so the cell shows $1.00.
    // Pinned as today's behaviour (a display figure, not a stored total).
    expect(
      weeklyTimesheetSubTotal({
        total_regular_hours: 1,
        regular_pay_rate: 1.005,
      })
    ).toBe("$1.00");
    // 3 x 1.1 is 3.3000000000000003 in floating point and must still show $3.30.
    expect(
      weeklyTimesheetSubTotal({ total_regular_hours: 3, regular_pay_rate: 1.1 })
    ).toBe("$3.30");
  });
});

describe("envelope reports: formatCurrency", () => {
  it("shows N/A for nothing", () => {
    expect(formatCurrency(undefined)).toBe("N/A");
    expect(formatCurrency(null)).toBe("N/A");
    expect(formatCurrency("")).toBe("N/A");
    expect(formatCurrency("N/A")).toBe("N/A");
  });

  it("shows numbers and numeric strings with a dollar sign and two decimals", () => {
    expect(formatCurrency(12.5)).toBe("$12.50");
    expect(formatCurrency("23")).toBe("$23.00");
    expect(formatCurrency("1250.456")).toBe("$1250.46");
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("shows each rate of a multi-position row", () => {
    expect(formatCurrency("23.00, 24.5")).toBe("$23.00, $24.50");
  });

  it("returns text that is not a number as it is", () => {
    expect(formatCurrency("see invoice")).toBe("see invoice");
  });

  it("splits at every comma, so a thousands separator makes two amounts (today's behaviour)", () => {
    expect(formatCurrency("1,250")).toBe("$1.00, $250.00");
  });
});

describe("envelope reports: formatPhoneNumber", () => {
  it("formats eleven digits starting with 1, ten digits and seven digits", () => {
    expect(formatPhoneNumber("+1 416-555-0100")).toBe("+1 (416) 555-0100");
    expect(formatPhoneNumber("14165550100")).toBe("+1 (416) 555-0100");
    expect(formatPhoneNumber("4165550100")).toBe("(416) 555-0100");
    expect(formatPhoneNumber("555 0100")).toBe("555-0100");
  });

  it("returns other lengths trimmed but otherwise as they are", () => {
    expect(formatPhoneNumber("  12345  ")).toBe("12345");
    expect(formatPhoneNumber("24165550100")).toBe("24165550100");
  });

  it("returns an empty string for nothing", () => {
    expect(formatPhoneNumber(null)).toBe("");
    expect(formatPhoneNumber(undefined)).toBe("");
    expect(formatPhoneNumber("   ")).toBe("");
  });
});

const row = (
  client_name: string,
  jobseeker_name: string,
  sr_no = ""
): EnvelopePrintingReportRow =>
  ({ client_name, jobseeker_name, sr_no }) as EnvelopePrintingReportRow;

describe("envelope reports: the CSV download's order", () => {
  it("sorts by client, then jobseeker, ignoring case", () => {
    const sorted = sortEnvelopeRowsForCsv([
      row("beta Corp", "zoe"),
      row("Alpha Ltd", "Yan"),
      row("alpha ltd", "Adam"),
      row("Beta Corp", "Ann"),
    ]);
    expect(sorted.map((r) => `${r.client_name}/${r.jobseeker_name}`)).toEqual([
      "alpha ltd/Adam",
      "Alpha Ltd/Yan",
      "Beta Corp/Ann",
      "beta Corp/zoe",
    ]);
  });

  it("keeps rows with the same client and jobseeker in the order they came in, and does not change the input", () => {
    const input = [
      row("A", "X", "first"),
      row("A", "X", "second"),
      row("A", "X", "third"),
    ];
    const sorted = sortEnvelopeRowsForCsv(input);
    expect(sorted.map((r) => r.sr_no)).toEqual(["first", "second", "third"]);
    expect(sorted).not.toBe(input);
    expect(input.map((r) => r.sr_no)).toEqual(["first", "second", "third"]);
  });

  it("puts a row with no client name first", () => {
    const sorted = sortEnvelopeRowsForCsv([row("Acme", "Eve"), row("", "Bob")]);
    expect(sorted.map((r) => r.jobseeker_name)).toEqual(["Bob", "Eve"]);
  });
});

describe("envelope reports: the numbers in the CSV download", () => {
  it("numbers the rows from 1 and replaces the running part of the serial, keeping its prefix", () => {
    expect(envelopeCsvNumbers(row("A", "B", "NW-20261107-004"), 0)).toEqual({
      newSequenceNumber: 1,
      newSrNo: "NW-20261107-001",
    });
    expect(envelopeCsvNumbers(row("A", "B", "NW-20261107-004"), 11)).toEqual({
      newSequenceNumber: 12,
      newSrNo: "NW-20261107-012",
    });
  });

  it("does not cut a number past three digits", () => {
    expect(
      envelopeCsvNumbers(row("A", "B", "NW-20261107-004"), 999).newSrNo
    ).toBe("NW-20261107-1000");
  });

  it("uses NA-NA when the row has no serial", () => {
    expect(envelopeCsvNumbers(row("A", "B", ""), 2)).toEqual({
      newSequenceNumber: 3,
      newSrNo: "NA-NA-003",
    });
  });

  it("drops the whole serial when it has no dash (today's behaviour)", () => {
    expect(envelopeCsvNumbers(row("A", "B", "ABC123"), 4).newSrNo).toBe("005");
  });
});
