// What a jobseeker can read and write on /api/invoices (R-5 recorded the code as it was, before the split; DEV-7
// closed the writes, inbox 79).
//
// A jobseeker READS only invoices they made themselves (list and get are scoped by `created_by_user_id`; another's
// invoice, a staff-made one and the seeded ones are a 404 and absent from the list). They WRITE nothing: create and
// update are staff-only since DEV-7, like delete, the document record, send-email, the number and a client's timesheets,
// so every one of them answers a jobseeker 403 before it reads the body, their own drafts included, and nothing is
// stored, changed or logged. (Before DEV-7 a jobseeker could create an invoice for any client with any money and status,
// and change their own drafts, money and status included; no screen offered it and the four live databases held no
// invoice made by a jobseeker.) No screen offers invoices to a jobseeker (`INVOICE_MANAGEMENT_ROLES` are staff roles).
//
// A jobseeker can no longer make an invoice, so the read cases use invoices the admin makes and the database then
// records as the jobseeker's (`makeInvoice` with a jobseeker, `invoice-helpers.ts`), as the old create route stored them.
//
// Writes only on invoices this file makes (number "R5J…", note R5-PIN), put back in `beforeAll` and `afterAll`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pin } from "./module-helpers";
import {
  answerOfRun,
  call,
  CLIENT,
  invoiceActivity,
  invoiceBody,
  invoiceCount,
  invoiceRow,
  invoiceRowByNumber,
  makeInvoice,
  nextNumber,
  SEEDED_INVOICE,
  sweepInvoices,
  type Body,
  type Who,
} from "./invoice-helpers";

const DIR = "api-invoices-jobseeker";
beforeAll(() => sweepInvoices());
afterAll(() => sweepInvoices());
const tag = "J";

const numbersIn = (r: { json: any }) =>
  (r.json.invoices as any[]).map((i) => i.invoiceNumber);
const list = (who: Who, query = "") => call(who, `/api/invoices${query}`);

describe("a jobseeker and invoices", () => {
  it("is refused creating an invoice for any client with any money: 403, nothing stored or logged", async () => {
    const count = await invoiceCount();
    const logged = (await invoiceActivity()).length;
    const out: Record<string, unknown> = {};
    for (const [name, clientId] of Object.entries(CLIENT)) {
      const number = nextNumber(tag);
      const r = await call("js:sin", "/api/invoices", {
        method: "POST",
        body: invoiceBody(number, {
          clientId,
          subtotal: 999999.99,
          totalTax: 0,
          totalHst: 0,
          grandTotal: 1,
          status: "paid",
          currency: "USD",
        }),
      });
      expect(r.status, `${name}: ${r.text}`).toBe(403);
      expect(await invoiceRowByNumber(number)).toBeNull();
      out[name] = answerOfRun(r);
    }
    expect(await invoiceCount()).toBe(count);
    expect((await invoiceActivity()).length).toBe(logged);
    await pin(DIR, 1, "refused for every client with any money", out);
  });

  it("no kind of jobseeker (profile, no profile) may create one: 403 each, nothing stored", async () => {
    const count = await invoiceCount();
    const out: Record<string, unknown> = {};
    for (const who of [
      "js:sin",
      "js:cash",
      "js:hybrid",
      "js:corp",
      "js:hybridEt",
      "js:signup",
    ] as Who[]) {
      const r = await call(who, "/api/invoices", {
        method: "POST",
        body: invoiceBody(nextNumber(tag)),
      });
      out[who] = { status: r.status };
      expect(r.status, `${who}: ${r.text}`).toBe(403);
    }
    expect(await invoiceCount()).toBe(count);
    await pin(DIR, 2, "who may create", out);
  });

  it("reads only their own invoices: the list, the totals, and one by id; another's, a staff-made one and the seeded ones are not theirs", async () => {
    await sweepInvoices();
    const mineSin = await makeInvoice("js:sin", tag);
    const mineCash = await makeInvoice("js:cash", tag);
    const staffMade = await makeInvoice("admin", tag);
    const label = (n: string) =>
      n === mineSin.invoiceNumber
        ? "sin's"
        : n === mineCash.invoiceNumber
          ? "cash's"
          : n === staffMade.invoiceNumber
            ? "admin's"
            : n;

    const seen: Record<string, unknown> = {};
    for (const who of [
      "admin",
      "js:sin",
      "js:cash",
      "js:hybrid",
      "js:signup",
    ] as Who[]) {
      const r = await list(who);
      expect(r.status).toBe(200);
      seen[who] = {
        invoices: numbersIn(r).map(label),
        pagination: {
          total: r.json.pagination.total,
          totalFiltered: r.json.pagination.totalFiltered,
        },
      };
    }
    const byId: Record<string, unknown> = {};
    for (const who of ["js:sin", "js:cash"] as Who[]) {
      const row: Record<string, number> = {};
      for (const [name, id] of [
        ["sin's", mineSin.id],
        ["cash's", mineCash.id],
        ["admin's", staffMade.id],
        ["a seeded one", SEEDED_INVOICE.ontario],
      ] as const) {
        row[name] = (await call(who, `/api/invoices/${id}`)).status;
      }
      byId[who] = row;
    }
    expect(byId["js:sin"]).toEqual({
      "sin's": 200,
      "cash's": 404,
      "admin's": 404,
      "a seeded one": 404,
    });
    await pin(DIR, 3, "reads", { list: seen, byId });
  });

  it("no search or filter reaches past their own invoices (the filter text of the list is passed to the database as it is)", async () => {
    await sweepInvoices();
    const mine = await makeInvoice("js:sin", tag);
    const attempts = [
      "?searchTerm=900001",
      "?searchTerm=Northwind",
      `?searchTerm=%25,created_by_user_id.neq.00000000-0000-4000-8000-000000000011`,
      `?searchTerm=a),created_by_user_id.neq.x,(b`,
      "?clientFilter=Northwind",
      "?invoiceNumberFilter=9",
      "?limit=1000",
    ];
    const out: Record<string, unknown> = {};
    for (const q of attempts) {
      const r = await list("js:sin", q);
      out[q] = {
        status: r.status,
        invoices:
          r.status === 200
            ? numbersIn(r).map((n) =>
                n === mine.invoiceNumber ? "their own" : n
              )
            : r.json,
      };
      if (r.status === 200)
        expect(numbersIn(r).filter((n) => n !== mine.invoiceNumber)).toEqual(
          []
        );
    }
    await pin(DIR, 4, "filters stay inside their own", out);
  });

  it("cannot update their own draft, money and status included: 403, nothing changes", async () => {
    await sweepInvoices();
    const mine = await makeInvoice("js:sin", tag);
    const before = await invoiceRow(mine.id);
    expect(before).toMatchObject({ status: "draft", version: 1 });
    const r = await call("js:sin", `/api/invoices/${mine.id}`, {
      method: "PUT",
      body: {
        clientId: CLIENT.prairie,
        subtotal: 1,
        totalTax: 0,
        grandTotal: 1,
        status: "paid",
        currency: "USD",
      },
    });
    expect(r.status, r.text).toBe(403);
    expect(await invoiceRow(mine.id)).toEqual(before);
    await pin(DIR, 5, "cannot update their own draft", answerOfRun(r));
  });

  it("cannot update another's invoice, a staff-made one, a seeded one, nor their own that is not a draft: 403 each, nothing changes", async () => {
    await sweepInvoices();
    const cash = await makeInvoice("js:cash", tag);
    const staff = await makeInvoice("admin", tag);
    const sentOwn = await makeInvoice("js:sin", tag, { status: "sent" });
    const out: Record<string, unknown> = {};
    for (const [name, id] of [
      ["another jobseeker's draft", cash.id],
      ["a staff-made draft", staff.id],
      ["a seeded draft (Quebec)", SEEDED_INVOICE.quebec],
      ["their own invoice that is sent", sentOwn.id],
    ] as const) {
      out[name] = answerOfRun(
        await call("js:sin", `/api/invoices/${id}`, {
          method: "PUT",
          body: { grandTotal: 5 },
        })
      );
      expect((out[name] as any).status, name).toBe(403);
    }
    expect((await invoiceRow(cash.id)).grand_total).toBe(1582);
    expect((await invoiceRow(staff.id)).grand_total).toBe(1582);
    expect((await invoiceRow(SEEDED_INVOICE.quebec)).grand_total).toBe(1609.65);
    expect((await invoiceRow(sentOwn.id)).grand_total).toBe(1582);
    await pin(DIR, 6, "cannot update what is not theirs", out);
  });

  it("every other endpoint refuses a jobseeker (403) and changes nothing", async () => {
    await sweepInvoices();
    const mine = await makeInvoice("js:sin", tag);
    const count = await invoiceCount();
    const calls: Array<[string, string, string, Body | undefined]> = [
      ["a number", "GET", "/api/invoices/generate-invoice-number", undefined],
      [
        "a client's timesheets",
        "GET",
        `/api/invoices/timesheets-by-client/${CLIENT.northwind}?startDate=2026-11-01&endDate=2026-11-30`,
        undefined,
      ],
      ["delete their own", "DELETE", `/api/invoices/${mine.id}`, undefined],
      [
        "record a document on their own",
        "PATCH",
        `/api/invoices/${mine.id}/document`,
        { documentPath: "x/y.pdf" },
      ],
      [
        "send their own",
        "POST",
        `/api/invoices/${mine.id}/send-email`,
        { email: "a@example.test" },
      ],
    ];
    const out: Record<string, unknown> = {};
    for (const [name, method, path, body] of calls) {
      const r = await call("js:sin", path, { method, body });
      expect(r.status, name).toBe(403);
      out[name] = answerOfRun(r);
    }
    expect(await invoiceCount()).toBe(count);
    expect((await invoiceRow(mine.id)).document_path).toBeNull();
    await pin(DIR, 7, "the other endpoints", out);
  });

  it("a refused create takes no number (staff can use it after), and a seeded number gets the same 403", async () => {
    await sweepInvoices();
    const n = nextNumber(tag);
    const tried = await call("js:sin", "/api/invoices", {
      method: "POST",
      body: invoiceBody(n),
    });
    expect(tried.status).toBe(403);
    const same = await call("admin", "/api/invoices", {
      method: "POST",
      body: invoiceBody(n),
    });
    expect(same.status, same.text).toBe(201);
    const seeded = await call("js:sin", "/api/invoices", {
      method: "POST",
      body: invoiceBody("900001"),
    });
    await pin(DIR, 8, "numbers", {
      "a new number by a jobseeker": answerOfRun(tried),
      "the same number by staff after": { status: same.status },
      "a seeded number by a jobseeker": answerOfRun(seeded),
    });
  });
});
