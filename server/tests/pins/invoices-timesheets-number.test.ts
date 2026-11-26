// API pins for GET /api/invoices/timesheets-by-client/:clientId and GET /api/invoices/generate-invoice-number
// (R-5, recorded on the code as it is, before the split).
//
// Both are `authorizeRoles(["admin", "recruiter"])`: all eight staff accounts are let in and give the same answer, a
// jobseeker is refused with a 403 before anything is read. timesheets-by-client is what the invoice page pulls in when
// a date range is chosen: the timesheets of the client's positions whose week lies inside the range, as the page reads
// them (numbers parsed, `bulkBreakdown` handed on as stored). generate-invoice-number answers the lowest free number
// starting from 1 (a six-digit string); the seeded invoices are 9000xx, so the first free number is 000001.
//
// Writes only on rows this file makes: timesheets of 2024 (note R5-PIN, removed in `afterAll`) and invoices numbered
// 000001 to 000003 (removed in `afterAll`). Inbox 42's limit of 1,000 rows is not tested.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { noTokenAnswers, pin, STAFF_ROLES } from "./module-helpers";
import { bodyFor, POSITION, PROFILE, weekStarting } from "./timesheet-helpers";
import { stack } from "../support/api";
import { putBackTimesheetWrites } from "../support/put-back.mjs";
import {
  call,
  CLIENT,
  invoiceBody,
  invoiceRowByNumber,
  sweepInvoices,
  type Who,
} from "./invoice-helpers";

const BY_CLIENT = "api-invoices-timesheets-by-client";
const NUMBER = "api-invoices-generate-number";
const TS_NOTE = "R5-PIN";

const sweepAll = async () => {
  await sweepInvoices(`invoice_number IN ('000001', '000002', 'INV-000003')`);
  await new Promise((r) => setTimeout(r, 300));
  putBackTimesheetWrites(stack().dbUrl, `notes LIKE '${TS_NOTE}%'`);
};
beforeAll(sweepAll);
afterAll(sweepAll);

const byClient = (who: Who, client: string, query: string) =>
  call(who, `/api/invoices/timesheets-by-client/${client}${query}`);

/** The rows of equal week start come back in no fixed order: by week, then jobseeker, then position (never by id, which is new every run). */
const tidy = (answer: any) => ({
  ...answer,
  timesheets: [...(answer.timesheets ?? [])].sort((a: any, b: any) => {
    const key = (t: any) =>
      `${t.weekStartDate}|${t.jobseekerProfileId}|${t.positionId}|${t.totalOvertimeHours}`;
    return key(a) < key(b) ? -1 : 1;
  }),
});

describe("GET /api/invoices/timesheets-by-client/:clientId", () => {
  const cases: Array<[string, string, string]> = [
    [
      "Northwind, all of November 2026",
      CLIENT.northwind,
      "?startDate=2026-11-01&endDate=2026-11-30",
    ],
    [
      "Northwind, the first week only",
      CLIENT.northwind,
      "?startDate=2026-11-01&endDate=2026-11-07",
    ],
    [
      "Northwind, a range that cuts a week in half",
      CLIENT.northwind,
      "?startDate=2026-11-03&endDate=2026-11-10",
    ],
    [
      "Northwind, a range with nothing in it",
      CLIENT.northwind,
      "?startDate=2020-01-01&endDate=2020-01-31",
    ],
    [
      "Quebec (premium pay rate)",
      CLIENT.quebec,
      "?startDate=2026-11-01&endDate=2026-11-30",
    ],
    [
      "British Columbia (two rows of one week)",
      CLIENT.pacific,
      "?startDate=2026-10-01&endDate=2026-10-31",
    ],
    [
      "Alberta (USD client)",
      CLIENT.prairie,
      "?startDate=2026-09-01&endDate=2026-09-30",
    ],
    [
      "a client nobody has",
      "00000000-0000-4000-8000-0000000000ee",
      "?startDate=2026-01-01&endDate=2026-12-31",
    ],
    [
      "the end before the start",
      CLIENT.northwind,
      "?startDate=2026-11-30&endDate=2026-11-01",
    ],
  ];
  cases.forEach(([name, client, query], i) => {
    it(`${name}: every staff account the same`, async () => {
      const admin = await byClient("admin", client, query);
      expect(admin.status, admin.text).toBe(200);
      for (const role of STAFF_ROLES.filter((r) => r !== "admin")) {
        const r = await byClient(role, client, query);
        expect(r.status, role).toBe(200);
        expect(tidy(r.json), role).toEqual(tidy(admin.json));
      }
      await pin(BY_CLIENT, i + 1, name, {
        query,
        status: admin.status,
        answer: tidy(admin.json),
      });
    });
  });

  it("a missing date is a 400, an id that is not an id is a 500", async () => {
    const out = {
      "no dates": await byClient("admin", CLIENT.northwind, ""),
      "no start": await byClient(
        "admin",
        CLIENT.northwind,
        "?endDate=2026-11-30"
      ),
      "no end": await byClient(
        "admin",
        CLIENT.northwind,
        "?startDate=2026-11-01"
      ),
      "empty dates": await byClient(
        "admin",
        CLIENT.northwind,
        "?startDate=&endDate="
      ),
      "not a uuid": await byClient(
        "admin",
        "not-an-id",
        "?startDate=2026-11-01&endDate=2026-11-30"
      ),
      "dates that are not dates": await byClient(
        "admin",
        CLIENT.northwind,
        "?startDate=abc&endDate=def"
      ),
    };
    await pin(
      BY_CLIENT,
      cases.length + 1,
      "missing and bad input",
      Object.fromEntries(
        Object.entries(out).map(([k, r]) => [
          k,
          { status: r.status, answer: r.json },
        ])
      )
    );
  });

  it("a jobseeker is refused (403), no token is 401, a bad token 403", async () => {
    const r = await byClient(
      "js:sin",
      CLIENT.northwind,
      "?startDate=2026-11-01&endDate=2026-11-30"
    );
    expect(r.status).toBe(403);
    await pin(BY_CLIENT, cases.length + 2, "who is refused", {
      jobseeker: { status: r.status, answer: r.json },
      ...(await noTokenAnswers(
        `/api/invoices/timesheets-by-client/${CLIENT.northwind}?startDate=2026-11-01&endDate=2026-11-30`
      )),
    });
  });

  it("the rows the invoice page needs from money-shaped timesheets: a bulk one with a breakdown, a bonus and a deduction, an overtime week", async () => {
    // Timesheets of weeks in 2024 on the Northwind position (Warehouse Associate), made through the timesheet route.
    const wk = (n: number) => weekStarting(n);
    const made: Record<string, any> = {};
    const post = async (key: string, body: Record<string, unknown>) => {
      const r = await call("admin", "/api/timesheets", {
        method: "POST",
        body,
      });
      expect(r.status, `${key}: ${r.text}`).toBe(201);
      made[key] = r.json.timesheet;
    };
    await post(
      "overtime",
      bodyFor("sin", wk(40), {
        notes: TS_NOTE,
        total_regular_hours: 40,
        total_overtime_hours: 10,
        overtime_enabled: true,
        overtime_pay_rate: 30,
        overtime_bill_rate: 52.5,
        total_jobseeker_pay: 1100,
        total_client_bill: 1925,
        invoice_number: "R5OT",
      })
    );
    await post(
      "bonus and deduction",
      bodyFor("cash", wk(40), {
        notes: TS_NOTE,
        bonus_amount: 50,
        deduction_amount: 20.5,
        total_jobseeker_pay: 829.5,
        total_client_bill: 1450,
        invoice_number: "R5BD",
      })
    );
    const bulk = bodyFor("hybrid", wk(41), {
      notes: TS_NOTE,
      is_bulk: true,
      bulk_breakdown: [
        {
          position_id: POSITION.warehouse,
          position_code: "NW001",
          position_title: "Warehouse Associate",
          regular_hours: 30,
          overtime_hours: 0,
          regular_pay_rate: 20,
          regular_bill_rate: 35,
          bonus_amount: 10,
          deduction_amount: 0,
        },
        {
          position_id: POSITION.forklift,
          position_code: "NW002",
          position_title: "Forklift Operator",
          regular_hours: 10,
          overtime_hours: 0,
          regular_pay_rate: 30,
          regular_bill_rate: 52.5,
          bonus_amount: 0,
          deduction_amount: 5,
        },
      ],
      total_regular_hours: 40,
      total_jobseeker_pay: 910,
      total_client_bill: 1575,
      invoice_number: "R5BK",
    });
    delete bulk.position_id;
    await post("bulk", bulk);
    expect(made.bulk.jobseeker_profile_id).toBe(PROFILE.hybrid);

    const query = "?startDate=2024-01-01&endDate=2025-12-31";
    const admin = await byClient("admin", CLIENT.northwind, query);
    expect(admin.status, admin.text).toBe(200);
    for (const role of STAFF_ROLES.filter((r) => r !== "admin")) {
      expect(
        tidy((await byClient(role, CLIENT.northwind, query)).json),
        role
      ).toEqual(tidy(admin.json));
    }
    // the ids, jobseeker ids and timestamps are the ones the server made
    await pin(BY_CLIENT, cases.length + 3, "money-shaped timesheets of 2024", {
      query,
      answer: tidy(admin.json),
    });
  });
});

describe("GET /api/invoices/generate-invoice-number", () => {
  const next = async (who: Who = "admin") => {
    const r = await call(who, "/api/invoices/generate-invoice-number");
    expect(r.status, r.text).toBe(200);
    return r.json.invoiceNumber as string;
  };

  it("every staff account gets the same number, the lowest free one: 000001 (the seeded ones are 9000xx)", async () => {
    const answers = [];
    for (const role of STAFF_ROLES) {
      const r = await call(role, "/api/invoices/generate-invoice-number");
      answers.push({ role, status: r.status, answer: r.json });
    }
    for (const a of answers)
      expect(a, a.role).toEqual({ ...answers[0], role: a.role });
    await pin(NUMBER, 1, "the first free number", {
      roles: [...STAFF_ROLES],
      ...answers[0],
      role: undefined,
    });
  });

  it("it moves on as numbers are taken, fills a gap, and reads both 'INV-000003' and '000003'", async () => {
    const steps: Record<string, string> = {};
    steps["nothing taken"] = await next();
    const create = async (number: string) => {
      const r = await call("admin", "/api/invoices", {
        method: "POST",
        body: invoiceBody(number, { notes: "R5-PIN" }),
      });
      expect(r.status, r.text).toBe(201);
    };
    await create("000001");
    steps["after 000001"] = await next();
    await create("000002");
    steps["after 000001 and 000002"] = await next();
    await create("INV-000003");
    steps["after 000001, 000002 and INV-000003 (the prefix is read)"] =
      await next();
    const del = await call(
      "admin",
      `/api/invoices/${(await invoiceRowByNumber("000001")).id}`,
      { method: "DELETE" }
    );
    expect(del.status).toBe(200);
    steps["after 000001 is deleted (the gap is filled)"] = await next();
    // a number that is not a number (a pin's own "R5…") never counts
    await call("admin", "/api/invoices", {
      method: "POST",
      body: invoiceBody("R5NUM01", { notes: "R5-PIN" }),
    });
    steps["after a number that is not digits"] = await next();
    await pin(NUMBER, 2, "it moves on", steps);
  });

  it("a jobseeker is refused (403), no token is 401, a bad token 403", async () => {
    const r = await call("js:sin", "/api/invoices/generate-invoice-number");
    expect(r.status).toBe(403);
    await pin(NUMBER, 3, "who is refused", {
      jobseeker: { status: r.status, answer: r.json },
      ...(await noTokenAnswers("/api/invoices/generate-invoice-number")),
    });
  });
});
