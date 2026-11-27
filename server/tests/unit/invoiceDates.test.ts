// R-5, step 1 (the invoice gate, unit cases). What the invoice screens use that is already a pure function:
// the client's calendar-date helpers (`client/src/utils/dateUtils.ts`: the due date is the invoice date plus the
// payment term's days, and every date on the list, the view and the PDF is written by `formatCalendarDate`) and the
// invoice email's text. Expected values are worked out by hand.
//
// NOT here: the money of the invoice page (line amount, each line's tax by province, subtotal, grand total, the overtime
// split, the due-date rule "Net N" / "Due on Receipt"). R-5s moved those functions out of `InvoiceManagement.tsx` into
// `client/src/pages/InvoiceManagement/invoiceCalculations.ts`; their cases are in `invoiceCalculations.test.ts`.
import { describe, expect, it, vi } from "vitest";

// The email template reads the portal name through `services/portalSettings.ts`, which exits the process when the
// Supabase address or key is unset (CI runs the unit step with no environment). Fake local values, set before the
// imports below run, so the file loads anywhere and `dotenv` never fills them from `server/.env`: the settings read
// in the background then fails quietly and the name falls back, and no test here depends on it.
vi.hoisted(() => {
  process.env.SUPABASE_URL = "http://127.0.0.1:9";
  process.env.SUPABASE_SERVICE_KEY = "unit-test-fake-key";
});

import { PAYMENT_TERMS } from "../../../client/src/constants/formOptions";
import {
  addDaysToDateStr,
  formatCalendarDate,
  formatCalendarDateRange,
  parseCalendarDate,
  parseCalendarParts,
} from "../../../client/src/utils/dateUtils";
import {
  invoiceHtmlTemplate,
  invoiceTextTemplate,
} from "../../src/email-templates/invoice-html.js";

describe("due date = invoice date + the days of the payment term (addDaysToDateStr)", () => {
  // The page calls addDaysToDateStr(invoiceDate, N) for "Net N" and uses the invoice date itself for "Due on Receipt".
  const worked: Array<[string, string, number, string]> = [
    // [term, invoice date, days, due date worked out on a calendar]
    ["Net 15", "2026-11-17", 15, "2026-12-02"], // the seed's Quebec invoice (900003)
    ["Net 22", "2026-11-17", 22, "2026-12-09"],
    ["Net 30", "2026-11-10", 30, "2026-12-10"], // the seed's Ontario invoice (900001)
    ["Net 45", "2026-11-17", 45, "2027-01-01"], // 13 days left in November + 31 in December = 44, so 45 is 1 January
    ["Net 60", "2026-11-17", 60, "2027-01-16"],
    ["Net 65", "2026-11-17", 65, "2027-01-21"],
    ["Net 90", "2026-11-17", 90, "2027-02-15"],
  ];
  it.each(worked)("%s from %s is %s days later: %s", (_t, from, days, due) => {
    expect(addDaysToDateStr(from, days)).toBe(due);
  });

  it("every Net term of the page's list is covered above, and the other term is the one without days", () => {
    const nets = PAYMENT_TERMS.filter((t) => t.startsWith("Net "));
    expect(nets.map((t) => Number(t.slice(4)))).toEqual(
      worked.map(([, , days]) => days)
    );
    expect(PAYMENT_TERMS.filter((t) => !t.startsWith("Net "))).toEqual([
      "Due on Receipt",
    ]);
  });

  it("crosses a month end, a year end and a leap day", () => {
    expect(addDaysToDateStr("2026-01-31", 30)).toBe("2026-03-02");
    expect(addDaysToDateStr("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateStr("2027-12-15", 30)).toBe("2028-01-14");
    expect(addDaysToDateStr("2028-02-15", 30)).toBe("2028-03-16"); // 2028 has a 29 February
    expect(addDaysToDateStr("2027-02-15", 30)).toBe("2027-03-17");
  });

  it("zero days is the same day, and a negative number goes back", () => {
    expect(addDaysToDateStr("2026-11-17", 0)).toBe("2026-11-17");
    expect(addDaysToDateStr("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysToDateStr("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("a date it cannot read is returned as it was", () => {
    expect(addDaysToDateStr("", 30)).toBe("");
    expect(addDaysToDateStr("not a date", 30)).toBe("not a date");
    expect(addDaysToDateStr("2026-13-01", 30)).toBe("2026-13-01");
  });

  it("gives the same answer in any timezone (the daylight-saving change does not move a calendar date)", () => {
    // Toronto changes its clocks on 8 March and 1 November 2026; the answer is a calendar date either way
    expect(addDaysToDateStr("2026-03-01", 15)).toBe("2026-03-16");
    expect(addDaysToDateStr("2026-10-25", 15)).toBe("2026-11-09");
  });
});

describe("parseCalendarParts", () => {
  it("reads a date and the date part of a timestamp, with no timezone", () => {
    expect(parseCalendarParts("2026-11-17")).toEqual({
      year: 2026,
      month: 11,
      day: 17,
    });
    expect(parseCalendarParts("2026-11-17T23:59:59.000Z")).toEqual({
      year: 2026,
      month: 11,
      day: 17,
    });
    expect(parseCalendarParts("2026-11-17 08:00:00")).toEqual({
      year: 2026,
      month: 11,
      day: 17,
    });
    expect(parseCalendarParts("  2026-01-05 ")).toEqual({
      year: 2026,
      month: 1,
      day: 5,
    });
  });
  it("gives null for anything it cannot read", () => {
    for (const bad of [
      null,
      undefined,
      "",
      "  ",
      "N/A",
      "2026-11",
      "17/11/2026",
      "2026-13-01",
      "2026-00-10",
      "2026-11-00",
      "2026-11-32",
      "x-y-z",
    ]) {
      expect(
        parseCalendarParts(bad as string | null | undefined),
        String(bad)
      ).toBeNull();
    }
  });
});

describe("formatCalendarDate (the date on the invoice list, view and PDF)", () => {
  it("writes the short form by default, and the long, iso and slash forms on request", () => {
    expect(formatCalendarDate("2026-12-02")).toBe("Dec 2, 2026");
    expect(formatCalendarDate("2026-12-02", "short")).toBe("Dec 2, 2026");
    expect(formatCalendarDate("2026-12-02", "default")).toBe("Dec 2, 2026");
    expect(formatCalendarDate("2026-12-02", "long")).toBe("December 2, 2026");
    expect(formatCalendarDate("2026-12-02", "iso")).toBe("2026-12-02");
    expect(formatCalendarDate("2026-12-02", "slash")).toBe("2/12/2026");
  });
  it("never shifts a date (the first day of a month, the last day of a year, a timestamp near midnight)", () => {
    expect(formatCalendarDate("2026-11-01")).toBe("Nov 1, 2026");
    expect(formatCalendarDate("2026-12-31")).toBe("Dec 31, 2026");
    expect(formatCalendarDate("2026-11-10T00:00:00.000Z")).toBe("Nov 10, 2026");
    expect(formatCalendarDate("2026-11-10T23:59:59.999Z")).toBe("Nov 10, 2026");
  });
  it("gives the fallback (N/A unless one is given) when there is no date", () => {
    expect(formatCalendarDate(null)).toBe("N/A");
    expect(formatCalendarDate(undefined)).toBe("N/A");
    expect(formatCalendarDate("")).toBe("N/A");
    expect(formatCalendarDate("", "short", "-")).toBe("-");
  });
});

describe("formatCalendarDateRange (the work period of a line)", () => {
  it("one year: the year once at the end", () => {
    expect(formatCalendarDateRange("2026-11-01", "2026-11-07")).toBe(
      "Nov 1 – Nov 7, 2026"
    );
  });
  it("two years: both years", () => {
    expect(formatCalendarDateRange("2026-12-27", "2027-01-02")).toBe(
      "Dec 27, 2026 – Jan 2, 2027"
    );
  });
  it("one end only: that date; neither: the fallback", () => {
    expect(formatCalendarDateRange("2026-11-01", null)).toBe("Nov 1, 2026");
    expect(formatCalendarDateRange(undefined, "2026-11-07")).toBe(
      "Nov 7, 2026"
    );
    expect(formatCalendarDateRange(null, null)).toBe("N/A");
    expect(formatCalendarDateRange("", "", "none")).toBe("none");
  });
});

describe("parseCalendarDate", () => {
  it("is local noon of that day, so a zone never moves the day", () => {
    const d = parseCalendarDate("2026-11-17");
    expect(d).not.toBeNull();
    expect([
      d!.getFullYear(),
      d!.getMonth(),
      d!.getDate(),
      d!.getHours(),
    ]).toEqual([2026, 10, 17, 12]);
    expect(parseCalendarDate("nope")).toBeNull();
  });
});

describe("the invoice email's text (what the client reads next to the PDF)", () => {
  const vars = {
    invoiceNumber: "900003",
    invoiceDate: "2026-11-17",
    dueDate: "2026-12-02",
    clientName: "Quebec Test Logistics Client",
    clientEmail: "quentin.quebec@example.test",
    grandTotal: "1609.65",
    currency: "CAD",
  };
  it("names the invoice, the dates, the client and the amount due", () => {
    const text = invoiceTextTemplate(vars);
    expect(text).toContain("Invoice #900003");
    expect(text).toContain("Hi Quebec Test Logistics Client,");
    expect(text).toContain("Issued: 2026-11-17");
    expect(text).toContain("Due Date: 2026-12-02");
    expect(text).toContain("Amount Due: $1609.65");
    expect(text).toContain("A detailed PDF invoice is attached");
    expect(text).not.toContain("Note:");
  });
  it("adds the message on the invoice when there is one, in the text and in the html", () => {
    const withNote = {
      ...vars,
      messageOnInvoice: "Thank you for your business",
    };
    expect(invoiceTextTemplate(withNote)).toContain(
      "Note: Thank you for your business"
    );
    expect(invoiceHtmlTemplate(withNote)).toContain(
      "Thank you for your business"
    );
    expect(invoiceHtmlTemplate(vars)).not.toContain(
      "Thank you for your business"
    );
  });
  it("shows the amount as it is given, with no rounding of its own (a number is written without a zero)", () => {
    // The route passes the stored number (invoice.grand_total), not a string with two decimals: 1400 reads "$ 1400".
    // Pinned as it is; see the inbox row filed by R-5.
    expect(
      invoiceTextTemplate({ ...vars, grandTotal: 1400 as unknown as string })
    ).toContain("Amount Due: $1400\n");
    expect(
      invoiceHtmlTemplate({ ...vars, grandTotal: 1400 as unknown as string })
    ).toContain("$ 1400");
  });
});
