// What a jobseeker can read and write on /api/invoices (R-5, recorded on the code as it is, before the split).
//
// SECURITY FINDING (inbox row from R-5, nothing fixed here): the routes for list, get, create and update let the
// jobseeker role in, and the create route asks nothing more of it than of staff. So a jobseeker can
//   * READ only invoices they made themselves (list and get are scoped by `created_by_user_id`; another's invoice,
//     a staff-made one and the seeded ones are a 404 and absent from the list),
//   * CREATE an invoice for ANY client with ANY money, status, currency and date (201), and
//   * UPDATE their own drafts, money fields included, and set the status (so they can mark it "paid"); after that
//     the invoice is no longer a draft and they cannot touch it again (404).
// They cannot delete (403), record a document (403), send an email (403), ask for a number (403) or list a client's
// timesheets (403). No screen offers invoices to a jobseeker (`INVOICE_MANAGEMENT_ROLES` are staff roles only).
//
// Writes only on invoices this file makes (number "R5J…", note R5-PIN), put back in `beforeAll` and `afterAll`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pin } from "./module-helpers";
import {
  answerOfRun,
  call,
  CLIENT,
  generic,
  invoiceBody,
  invoiceCount,
  invoiceRow,
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
  it("creates an invoice for any client with any money: 201, stored as theirs, the same row as a staff-made one", async () => {
    const out: Record<string, unknown> = {};
    for (const [name, clientId] of Object.entries(CLIENT)) {
      const r = await call("js:sin", "/api/invoices", {
        method: "POST",
        body: invoiceBody(nextNumber(tag), {
          clientId,
          subtotal: 999999.99,
          totalTax: 0,
          totalHst: 0,
          grandTotal: 1,
          status: "paid",
          currency: "USD",
        }),
      });
      expect(r.status, `${name}: ${r.text}`).toBe(201);
      const stored = await invoiceRow(r.json.invoice.id);
      expect(stored.created_by_user_id).toBe(
        "00000000-0000-4000-8000-000000000011"
      );
      expect(stored.status).toBe("paid");
      out[name] = {
        status: r.status,
        stored: { ...generic(stored), invoice_number: "<number>" },
      };
    }
    // the same body from a staff account stores the same row (apart from who made it)
    const staff = await makeInvoice("admin", tag, {
      subtotal: 999999.99,
      totalTax: 0,
      totalHst: 0,
      grandTotal: 1,
      status: "paid",
      currency: "USD",
      clientId: CLIENT.prairie,
    });
    expect({
      ...generic(await invoiceRow(staff.id)),
      invoice_number: "<number>",
    }).toEqual((out.prairie as any).stored);
    await pin(DIR, 1, "created for every client with any money", out);
  });

  it("each kind of jobseeker (profile, no profile) creates one", async () => {
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
      expect(r.status, `${who}: ${r.text}`).toBe(201);
    }
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

  it("updates their own draft, money and status included; then it is no longer a draft and they cannot touch it again", async () => {
    await sweepInvoices();
    const mine = await makeInvoice("js:sin", tag);
    const first = await call("js:sin", `/api/invoices/${mine.id}`, {
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
    expect(first.status, first.text).toBe(200);
    const stored = await invoiceRow(mine.id);
    expect(stored).toMatchObject({
      status: "paid",
      grand_total: 1,
      client_id: CLIENT.prairie,
      version: 2,
    });
    const again = await call("js:sin", `/api/invoices/${mine.id}`, {
      method: "PUT",
      body: { grandTotal: 2 },
    });
    expect(again.status).toBe(404);
    expect((await invoiceRow(mine.id)).grand_total).toBe(1);
    await pin(DIR, 5, "updates their own draft", {
      first: generic({
        ...answerOfRun(first).answer.invoice,
        invoiceNumber: "<number>",
      }),
      again: answerOfRun(again),
    });
  });

  it("cannot update another's invoice, a staff-made one or a seeded one (404), nor their own that is not a draft; nothing changes", async () => {
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
      expect((out[name] as any).status, name).toBe(404);
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

  it("an invoice number a jobseeker takes is taken for staff too, and a seeded number cannot be taken again", async () => {
    await sweepInvoices();
    const n = nextNumber(tag);
    expect(
      (
        await call("js:sin", "/api/invoices", {
          method: "POST",
          body: invoiceBody(n),
        })
      ).status
    ).toBe(201);
    const same = await call("admin", "/api/invoices", {
      method: "POST",
      body: invoiceBody(n),
    });
    const seeded = await call("js:sin", "/api/invoices", {
      method: "POST",
      body: invoiceBody("900001"),
    });
    await pin(DIR, 8, "numbers", {
      "the same number by staff": answerOfRun(same),
      "a seeded number by a jobseeker": answerOfRun(seeded),
    });
  });
});
