// API pins for POST /api/invoices (R-5, recorded on the code as it is, before the split).
//
// Who may call it, worked out from the route: `authorizeRoles(["admin", "recruiter", "jobseeker"])`, so all eight staff
// accounts and every jobseeker are let in (what a jobseeker can do is in invoices-jobseeker.test.ts). The server stores
// what the invoice page sends: it checks that the required fields are there and that the client exists, never that the
// totals add up, so the money is pinned as stored (numeric(12,2): a longer number is rounded by the table). The table
// refuses what its checks refuse (a negative total, a due date before the invoice date, an unknown status or currency, a
// number longer than ten characters or already used, a sent flag without its date and address) with a bare 500.
//
// Writes only on invoices this file makes (number "R5C…", note R5-PIN), removed in `beforeAll` and `afterAll`
// (`put-back.mjs`: the rows, the activity rows the server logged, the clients' and jobseekers' last-activity dates that
// the invoice triggers move). Nothing is sent: the create route sends no message.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { noTokenAnswers, pin, STAFF_ROLES } from "./module-helpers";
import {
  answerOfRun,
  call,
  CLIENT,
  emailsSent,
  generic,
  invoiceActivity,
  invoiceBody,
  invoiceCount,
  invoiceRow,
  invoiceRowByNumber,
  nextNumber,
  NOTE,
  sweepInvoices,
  type Body,
} from "./invoice-helpers";

const DIR = "api-invoices-create";
beforeAll(() => sweepInvoices());
afterAll(() => sweepInvoices());

const post = (who: Parameters<typeof call>[0], body: unknown) =>
  call(who, "/api/invoices", { method: "POST", body });
const tag = "C";

describe("POST /api/invoices", () => {
  it("each staff account creates one: 201, version 1 with its history, the same stored row, no activity row", async () => {
    const before = emailsSent().length;
    const out: Record<string, unknown> = {};
    const rows: Record<string, unknown> = {};
    for (const role of STAFF_ROLES) {
      const number = nextNumber(tag);
      const r = await post(role, invoiceBody(number));
      expect(r.status, `${role}: ${r.text}`).toBe(201);
      const stored = await invoiceRowByNumber(number);
      expect(stored.created_by_user_id, role).toBe(
        r.json.invoice.createdByUserId
      );
      expect(stored.version).toBe(1);
      expect(stored.version_history).toHaveLength(1);
      expect(stored.version_history[0]).toMatchObject({
        version: 1,
        action: "created",
      });
      rows[role] = { ...generic(stored), invoice_number: "<number>" };
      out[role] = generic({ ...r.json.invoice, invoiceNumber: "<number>" });
    }
    for (const role of STAFF_ROLES) {
      expect(rows[role], role).toEqual(rows.admin);
      expect(out[role], role).toEqual(out.admin);
    }
    // the server tries to log "create_invoice", a type the activity table does not know (only "update_invoice" is
    // there), so no activity row is written: pinned as it is (inbox row from R-5)
    await new Promise((r) => setTimeout(r, 800));
    expect(
      (await invoiceActivity()).filter(
        (a) => a.action_type === "create_invoice"
      )
    ).toEqual([]);
    expect(emailsSent().length, "a create sends no message").toBe(before);
    await pin(DIR, 1, "created by each staff role", {
      roles: [...STAFF_ROLES],
      answer: out.admin,
      stored: rows.admin,
    });
  });

  it("a create leaves no activity row (its action type is not in the table)", async () => {
    const number = nextNumber(tag);
    expect((await post("admin", invoiceBody(number))).status).toBe(201);
    await new Promise((r) => setTimeout(r, 800));
    expect(
      (await invoiceActivity()).filter(
        (a) => a.primary_entity_name === `Invoice ${number}`
      )
    ).toEqual([]);
  });

  describe("the money, as stored (the server stores what the page sends; each tax case worked out by hand)", () => {
    // The page works the numbers out in the browser. Each case is the body it sends for one line, worked by hand.
    const cases: Array<[string, Body]> = [
      [
        "Ontario HST 13%: 40 h x 35.00 = 1400.00, HST 182.00, total 1582.00",
        {},
      ],
      [
        "Quebec GST 5% + QST 9.975%: 1400.00, GST 70.00, QST 139.65, tax 209.65, total 1609.65",
        {
          clientId: CLIENT.quebec,
          dueDate: "2026-12-02",
          subtotal: 1400,
          totalTax: 209.65,
          totalHst: 0,
          totalGst: 70,
          totalQst: 139.65,
          grandTotal: 1609.65,
        },
      ],
      [
        "British Columbia GST 5%: 1400.00, GST 70.00, total 1470.00",
        {
          clientId: CLIENT.pacific,
          totalTax: 70,
          totalHst: 0,
          totalGst: 70,
          grandTotal: 1470,
        },
      ],
      [
        "Alberta zero rated in USD: 1400.00, no tax, total 1400.00",
        {
          clientId: CLIENT.prairie,
          currency: "USD",
          totalTax: 0,
          totalHst: 0,
          grandTotal: 1400,
        },
      ],
      [
        "a discount line: 1400.00 less 50.00 = 1350.00, HST 175.50, total 1525.50",
        {
          subtotal: 1350,
          totalTax: 175.5,
          totalHst: 175.5,
          grandTotal: 1525.5,
        },
      ],
      [
        "sub-cent amounts the page does not round: 11.275, tax 1.46575, total 12.74075 are stored 11.28, 1.47, 12.74 (the parts add up to 12.75)",
        {
          subtotal: 11.275,
          totalTax: 1.46575,
          totalHst: 1.46575,
          grandTotal: 12.74075,
          totalHours: 0.5,
        },
      ],
      [
        "numbers as text are stored as numbers",
        {
          subtotal: "1400.00",
          totalTax: "182.00",
          totalHst: "182.00",
          grandTotal: "1582.00",
          totalHours: "40.00",
        },
      ],
      [
        "a grand total that is not the subtotal plus the tax is stored as sent (nothing checks it)",
        { grandTotal: 1599 },
      ],
      [
        "zero everywhere is allowed",
        { subtotal: 0, totalTax: 0, totalHst: 0, grandTotal: 0, totalHours: 0 },
      ],
    ];
    cases.forEach(([name, over], i) => {
      it(name, async () => {
        const number = nextNumber(tag);
        const r = await post("admin", invoiceBody(number, over));
        expect(r.status, r.text).toBe(201);
        const stored = await invoiceRowByNumber(number);
        await pin(DIR, 10 + i, name, {
          answer: generic({ ...r.json.invoice, invoiceNumber: "<number>" }),
          money: Object.fromEntries(
            [
              "subtotal",
              "total_tax",
              "total_hst",
              "total_gst",
              "total_qst",
              "grand_total",
              "total_hours",
              "currency",
              "client_id",
              "due_date",
            ].map((k) => [k, stored[k]])
          ),
        });
      });
    });
  });

  describe("what is refused", () => {
    const required = [
      "clientId",
      "invoiceDate",
      "dueDate",
      "subtotal",
      "totalTax",
      "grandTotal",
      "totalHours",
      "invoiceData",
    ];
    it("each required field, missing or null, is a 400 that names it; nothing is stored", async () => {
      const count = await invoiceCount();
      const out: Record<string, unknown> = {};
      for (const field of required) {
        const missing = invoiceBody(nextNumber(tag));
        delete missing[field];
        const nulled = invoiceBody(nextNumber(tag), { [field]: null });
        const [a, b] = [
          await post("admin", missing),
          await post("admin", nulled),
        ];
        expect(a.status, field).toBe(400);
        expect(b.status, field).toBe(400);
        out[field] = { missing: answerOfRun(a), null: answerOfRun(b) };
      }
      expect(await invoiceCount()).toBe(count);
      await pin(DIR, 30, "required fields", out);
    });

    it("a client that does not exist, or is not an id, is a 400", async () => {
      const count = await invoiceCount();
      const out = {
        "no such client": answerOfRun(
          await post(
            "admin",
            invoiceBody(nextNumber(tag), {
              clientId: "00000000-0000-4000-8000-0000000000ee",
            })
          )
        ),
        "not an id": answerOfRun(
          await post(
            "admin",
            invoiceBody(nextNumber(tag), { clientId: "not-an-id" })
          )
        ),
      };
      expect(await invoiceCount()).toBe(count);
      await pin(DIR, 31, "client", out);
    });

    it("what the table refuses is a bare 500 and nothing is stored", async () => {
      const count = await invoiceCount();
      const taken = nextNumber(tag);
      expect((await post("admin", invoiceBody(taken))).status).toBe(201);
      const cases: Record<string, Body> = {
        "a negative subtotal": { subtotal: -1 },
        "a negative tax": { totalTax: -0.01 },
        "a negative grand total": { grandTotal: -1 },
        "negative hours": { totalHours: -1 },
        "the due date before the invoice date": { dueDate: "2026-11-16" },
        "a date that is not a date": { invoiceDate: "not-a-date" },
        "a status the table does not know": { status: "bogus" },
        "a currency the table does not know": { currency: "EUR" },
        "a number of eleven characters": { invoiceNumber: "R5C12345678" },
        "a number that is taken": { invoiceNumber: taken },
        "sent with no date and address": { emailSent: true },
        "an address that is not an address": {
          invoice_sent_to: "not-an-address",
          emailSent: true,
          emailSentDate: "2026-11-17T15:00:00Z",
        },
        "the three tax split fields left out (the table needs them, the page always sends them)":
          {
            totalHst: undefined,
            totalGst: undefined,
            totalQst: undefined,
          },
        "money that is not a number": { subtotal: "abc" },
        "more than the table holds": { subtotal: 1e12, grandTotal: 1e12 },
      };
      const out: Record<string, unknown> = {};
      for (const [name, over] of Object.entries(cases)) {
        const r = await post(
          "admin",
          invoiceBody(
            over.invoiceNumber
              ? (over.invoiceNumber as string)
              : nextNumber(tag),
            over
          )
        );
        expect(r.status, `${name}: ${r.text}`).toBe(500);
        out[name] = answerOfRun(r);
      }
      expect(await invoiceCount()).toBe(count + 1);
      await pin(DIR, 32, "refused by the table", out);
    });

    it("no token is 401, a bad token 403, and nothing is stored", async () => {
      const count = await invoiceCount();
      await pin(
        DIR,
        33,
        "without a token",
        await noTokenAnswers("/api/invoices", {
          method: "POST",
          body: invoiceBody(nextNumber(tag)),
        })
      );
      expect(await invoiceCount()).toBe(count);
    });
  });

  describe("what is filled in, ignored and kept", () => {
    it("a body with only the required fields: status draft, CAD, no tax lines, no message, sent flag off", async () => {
      const number = nextNumber(tag);
      const body = {
        invoiceNumber: number,
        clientId: CLIENT.northwind,
        invoiceDate: "2026-11-17",
        dueDate: "2026-12-17",
        subtotal: 100,
        totalTax: 13,
        totalHst: 13,
        totalGst: 0,
        totalQst: 0,
        grandTotal: 113,
        totalHours: 4,
        invoiceData: {},
      };
      const r = await post("admin", body);
      expect(r.status, r.text).toBe(201);
      await pin(
        DIR,
        40,
        "only the required fields",
        generic({
          ...(await invoiceRowByNumber(number)),
          invoice_number: "<number>",
        })
      );
    });

    it("the account, the version and the history are the server's: what the body says about them is ignored", async () => {
      const number = nextNumber(tag);
      const r = await post("recruiter", {
        ...invoiceBody(number),
        id: "00000000-0000-4000-8000-0000000000aa",
        version: 9,
        createdByUserId: "00000000-0000-4000-8000-000000000001",
        created_by_user_id: "00000000-0000-4000-8000-000000000001",
        version_history: [],
      });
      expect(r.status, r.text).toBe(201);
      const stored = await invoiceRowByNumber(number);
      expect(stored.id).not.toBe("00000000-0000-4000-8000-0000000000aa");
      expect(stored.version).toBe(1);
      expect(stored.created_by_user_id).toBe(
        "00000000-0000-4000-8000-000000000003"
      );
      expect(stored.version_history).toHaveLength(1);
    });

    it("the payment term joins the stored invoice data; the rest of the invoice data is stored as sent", async () => {
      const number = nextNumber(tag);
      const r = await post(
        "admin",
        invoiceBody(number, {
          paymentTerms: "Net 15",
          notes: `${NOTE} café & <b>`,
        })
      );
      expect(r.status, r.text).toBe(201);
      const stored = await invoiceRowByNumber(number);
      expect(stored.invoice_data.paymentTerms).toBe("Net 15");
      expect(stored.invoice_data.timesheets).toHaveLength(1);
      expect(stored.notes).toBe(`${NOTE} café & <b>`);
      await pin(
        DIR,
        41,
        "invoice data",
        generic({ ...stored, invoice_number: "<number>" })
      );
    });

    it("a sent invoice is stored with its date and address when all three are given", async () => {
      const number = nextNumber(tag);
      const r = await post(
        "admin",
        invoiceBody(number, {
          emailSent: true,
          emailSentDate: "2026-11-17T15:00:00Z",
          invoice_sent_to: "nora.north@example.test",
        })
      );
      expect(r.status, r.text).toBe(201);
      const stored = await invoiceRow(r.json.invoice.id);
      expect(stored.email_sent).toBe(true);
      expect(stored.invoice_sent_to).toBe("nora.north@example.test");
    });

    it("an invoice number left out is made by the table (the first free one)", async () => {
      const body = invoiceBody("x");
      delete body.invoiceNumber;
      const r = await post("admin", body);
      // pinned whatever the answer is: 201 with a number from the table, or a refusal
      await pin(DIR, 42, "no invoice number", {
        status: r.status,
        number: r.json?.invoice?.invoiceNumber ? "<made>" : r.json,
      });
      if (r.status === 201) {
        const row = await invoiceRow(r.json.invoice.id);
        expect(row.invoice_number).toBe(r.json.invoice.invoiceNumber);
        // remove it here: its number does not start with R5
        const del = await call("admin", `/api/invoices/${row.id}`, {
          method: "DELETE",
        });
        expect(del.status).toBe(200);
      }
    });
  });
});
