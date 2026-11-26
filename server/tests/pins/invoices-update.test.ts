// API pins for PUT /api/invoices/:id (R-5, recorded on the code as it is, before the split).
//
// Who may call it: `authorizeRoles(["admin", "recruiter"])`, so all eight staff accounts pass the route and a jobseeker
// gets 403, their own drafts included (since DEV-7, inbox 79; invoices-jobseeker.test.ts). A staff account updates ANY
// invoice, whoever made it and whatever its status (a recruiter updates a paid invoice made by an admin).
//
// What the update does, worked out from the route: each field present in the body is copied to its column (a field
// that is absent, empty or zero-like is skipped by the `if (x)` fields, kept by the `!== undefined` ones: dates, status,
// currency, ids and texts need a value; money, hours and flags may be 0 or false). **`notes` is not copied: the update
// ignores it** (the edit page sends it; it is never saved: inbox row from R-5). The version goes up by one, with a
// history entry, when the body holds any of the money, dates, client, status, currency, document or invoice-data
// fields; a body with only the sent flag, its date or address, or the notes changes only `updated_by_user_id`.
// `invoiceData` replaces the stored invoice data as a whole (the top-level `paymentTerms` is not copied).
//
// Writes only on invoices this file makes (number "R5U…", note R5-PIN), put back in `beforeAll` and `afterAll`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { noTokenAnswers, pin, STAFF_ROLES } from "./module-helpers";
import {
  answerOfRun,
  call,
  CLIENT,
  generic,
  invoiceActivity,
  invoiceRow,
  makeInvoice,
  NO_SUCH_ID,
  SEEDED_INVOICE,
  sweepInvoices,
  type Body,
  type Who,
} from "./invoice-helpers";

const DIR = "api-invoices-update";
beforeAll(() => sweepInvoices());
afterAll(() => sweepInvoices());

const put = (who: Who, id: string, body: unknown) =>
  call(who, `/api/invoices/${id}`, { method: "PUT", body });
const tag = "U";

describe("PUT /api/invoices/:id", () => {
  it("each staff account updates an invoice it did not make: 200, the same stored row, the version up by one", async () => {
    const out: Record<string, unknown> = {};
    const rows: Record<string, unknown> = {};
    for (const role of STAFF_ROLES) {
      const made = await makeInvoice("admin", tag);
      const r = await put(role, made.id, {
        subtotal: 2000,
        totalTax: 260,
        totalHst: 260,
        grandTotal: 2260,
        totalHours: 57.14,
      });
      expect(r.status, `${role}: ${r.text}`).toBe(200);
      const stored = await invoiceRow(made.id);
      expect(stored.version, role).toBe(2);
      expect(stored.version_history, role).toHaveLength(2);
      expect(stored.updated_by_user_id, role).toBe(
        r.json.invoice.updatedByUserId
      );
      rows[role] = { ...generic(stored), invoice_number: "<number>" };
      out[role] = generic({ ...r.json.invoice, invoiceNumber: "<number>" });
    }
    for (const role of STAFF_ROLES) {
      // the history names who made each step: "<who>" for both, so the rows compare
      expect(rows[role], role).toEqual(rows.admin);
      expect(out[role], role).toEqual(out.admin);
    }
    await pin(DIR, 1, "updated by each staff role", {
      roles: [...STAFF_ROLES],
      answer: out.admin,
      stored: rows.admin,
    });
  });

  it("what the edit page sends: every field, and what of it is saved and what is not", async () => {
    const made = await makeInvoice("admin", tag);
    const r = await put("admin", made.id, {
      clientId: CLIENT.quebec,
      invoiceDate: "2026-11-18",
      dueDate: "2026-12-03",
      status: "draft",
      currency: "CAD",
      paymentTerms: "Net 15",
      subtotal: 1400,
      totalTax: 209.65,
      totalHst: 0,
      totalGst: 70,
      totalQst: 139.65,
      grandTotal: 1609.65,
      totalHours: 40,
      notes: "changed on the edit page",
      invoiceData: {
        client: { id: CLIENT.quebec },
        timesheets: [],
        paymentTerms: "Net 15",
      },
    });
    expect(r.status, r.text).toBe(200);
    const stored = await invoiceRow(made.id);
    expect(stored.notes, "notes are not saved by an update").toBe("R5-PIN");
    await pin(DIR, 2, "the edit page's body", {
      answer: generic({ ...r.json.invoice, invoiceNumber: "<number>" }),
      stored: { ...generic(stored), invoice_number: "<number>" },
    });
  });

  it("which fields change the version and which do not", async () => {
    const out: Record<string, unknown> = {};
    const cases: Record<string, Body> = {
      "the grand total only": { grandTotal: 1600 },
      "the invoice data only": {
        invoiceData: { client: { id: CLIENT.northwind }, timesheets: [] },
      },
      "the status only": { status: "sent" },
      "the due date only": { dueDate: "2026-12-30" },
      "a document path only": { documentPath: "x/y.pdf" },
      "the sent flag only": {
        emailSent: true,
        emailSentDate: "2026-11-18T15:00:00Z",
        invoice_sent_to: "nora.north@example.test",
      },
      "the notes only": { notes: "only the notes" },
      "an empty body": {},
      "a field the update does not know": {
        invoiceNumber: "R5UNEW0001",
        version: 7,
        createdByUserId: "x",
      },
    };
    for (const [name, body] of Object.entries(cases)) {
      const made = await makeInvoice("admin", tag);
      const r = await put("admin", made.id, body);
      expect(r.status, `${name}: ${r.text}`).toBe(200);
      const stored = await invoiceRow(made.id);
      out[name] = {
        status: r.status,
        version: stored.version,
        history: stored.version_history.length,
        changed: Object.fromEntries(
          Object.entries(stored).filter(
            ([k, v]) =>
              ![
                "id",
                "created_at",
                "updated_at",
                "version_history",
                "invoice_number",
                "version",
                "created_by_user_id",
                "updated_by_user_id",
                "search_vector",
              ].includes(k) &&
              JSON.stringify(v) !==
                JSON.stringify(
                  (made as any)[
                    k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
                  ]
                )
          )
        ),
      };
    }
    await pin(DIR, 3, "which fields move the version", out);
  });

  it("an empty value is skipped by the text fields and taken by the money fields (0); a sent flag cannot be switched off while the date stays", async () => {
    const made = await makeInvoice("admin", tag);
    const r = await put("admin", made.id, {
      dueDate: "",
      currency: "",
      status: "",
      subtotal: 0,
      totalTax: 0,
      totalHst: 0,
      grandTotal: 0,
      totalHours: 0,
      documentFileSize: 0,
    });
    const stored = await invoiceRow(made.id);
    // the sent flag: the table wants a date and an address with a true flag and none with a false one
    const sent = await makeInvoice("admin", tag, {
      emailSent: true,
      emailSentDate: "2026-11-17T15:00:00Z",
      invoice_sent_to: "nora.north@example.test",
    });
    const off = await put("admin", sent.id, { emailSent: false });
    await pin(DIR, 4, "empty and zero values", {
      status: r.status,
      stored: { ...generic(stored), invoice_number: "<number>" },
      "the sent flag switched off": answerOfRun(off),
    });
  });

  it("several updates add one history entry each; the version counts them", async () => {
    const made = await makeInvoice("recruiter", tag);
    for (const total of [1, 2, 3]) {
      expect(
        (await put("admin", made.id, { grandTotal: 1600 + total })).status
      ).toBe(200);
    }
    const stored = await invoiceRow(made.id);
    expect(stored.version).toBe(4);
    expect(
      stored.version_history.map((v: any) => [v.version, v.action])
    ).toEqual([
      [1, "created"],
      [2, "updated"],
      [3, "updated"],
      [4, "updated"],
    ]);
  });

  it("a staff account may update a sent or paid invoice, and one made by someone else", async () => {
    const paid = await makeInvoice("admin", tag, { status: "paid" });
    const r = await put("recruiter", paid.id, { grandTotal: 1700 });
    expect(r.status, r.text).toBe(200);
    expect((await invoiceRow(paid.id)).grand_total).toBe(1700);
    expect((await invoiceRow(paid.id)).status).toBe("paid");
  });

  it("the activity row of an update names the invoice, the client and the total", async () => {
    const made = await makeInvoice("admin", tag);
    expect((await put("admin", made.id, { grandTotal: 1650.5 })).status).toBe(
      200
    );
    const until = Date.now() + 5000;
    let row: any;
    while (!row && Date.now() < until) {
      row = (await invoiceActivity()).find(
        (a) =>
          a.action_type === "update_invoice" &&
          a.primary_entity_name === `Invoice ${made.invoiceNumber}`
      );
      if (!row) await new Promise((r) => setTimeout(r, 50));
    }
    expect(row?.display_message).toBe(
      `Updated invoice ${made.invoiceNumber} for Northwind Test Staffing Client - $1650.50 CAD`
    );
  });

  describe("what is refused", () => {
    it("an invoice that is not there, or an id that is not an id, is a 404; a seeded invoice is never written", async () => {
      const out = {
        "an id nobody has": answerOfRun(
          await put("admin", NO_SUCH_ID, { grandTotal: 1 })
        ),
        "not an id": answerOfRun(
          await put("admin", "not-an-id", { grandTotal: 1 })
        ),
      };
      expect(out["an id nobody has"].status).toBe(404);
      await pin(DIR, 10, "no such invoice", out);
      // (the seeded invoices are read here, never written)
      expect((await invoiceRow(SEEDED_INVOICE.ontario)).grand_total).toBe(4746);
    });

    it("a client that does not exist is a 400; what the table refuses is a bare 500; the row stays as it was", async () => {
      const made = await makeInvoice("admin", tag);
      const cases: Record<string, Body> = {
        "no such client": { clientId: NO_SUCH_ID },
        "a client that is not an id": { clientId: "not-an-id" },
        "a status the table does not know": { status: "bogus" },
        "a currency the table does not know": { currency: "EUR" },
        "a negative total": { grandTotal: -5 },
        "the due date before the invoice date": { dueDate: "2020-01-01" },
        "sent with no date": { emailSent: true },
        "the document flag with no path": { documentGenerated: true },
        "money that is not a number": { subtotal: "abc" },
      };
      const out: Record<string, unknown> = {};
      for (const [name, body] of Object.entries(cases)) {
        out[name] = answerOfRun(await put("admin", made.id, body));
      }
      const stored = await invoiceRow(made.id);
      expect(stored.version).toBe(1);
      expect(stored.grand_total).toBe(1582);
      await pin(DIR, 11, "refused", out);
    });

    it("no token is 401, a bad token 403", async () => {
      const made = await makeInvoice("admin", tag);
      await pin(
        DIR,
        12,
        "without a token",
        await noTokenAnswers(`/api/invoices/${made.id}`, {
          method: "PUT",
          body: { grandTotal: 1 },
        })
      );
      expect((await invoiceRow(made.id)).grand_total).toBe(1582);
    });
  });
});
