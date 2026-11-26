// API pins for DELETE /api/invoices/:id and PATCH /api/invoices/:id/document (R-5, recorded on the code as it is,
// before the split).
//
// Both are `authorizeRoles(["admin", "recruiter"])`: all eight staff accounts are let in (the route's comment says
// "Admin only" for the delete; every recruiter-type role passes too), a jobseeker is refused with a 403 even on an
// invoice they made. The delete removes the row for good (no soft delete); the document route records where the
// browser put the PDF in storage (it never touches storage itself) and does not change the version.
//
// Writes only on invoices this file makes (number "R5D…", note R5-PIN), put back in `beforeAll` and `afterAll`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { noTokenAnswers, pin, STAFF_ROLES } from "./module-helpers";
import {
  answerOfRun,
  call,
  generic,
  invoiceActivity,
  invoiceCount,
  invoiceRow,
  makeInvoice,
  NO_SUCH_ID,
  SEEDED_INVOICE,
  sweepInvoices,
  type Who,
} from "./invoice-helpers";

const DIR = "api-invoices-delete";
const DOC = "api-invoices-document";
beforeAll(() => sweepInvoices());
afterAll(() => sweepInvoices());

const del = (who: Who, id: string) =>
  call(who, `/api/invoices/${id}`, { method: "DELETE" });
const patch = (who: Who, id: string, body: unknown) =>
  call(who, `/api/invoices/${id}/document`, { method: "PATCH", body });
const tag = "D";

describe("DELETE /api/invoices/:id", () => {
  it("each staff account deletes an invoice it did not make: 200, the row is gone, the same answer", async () => {
    const out: Record<string, unknown> = {};
    for (const role of STAFF_ROLES) {
      const made = await makeInvoice(
        role === "admin" ? "recruiter" : "admin",
        tag
      );
      const count = await invoiceCount();
      const r = await del(role, made.id);
      expect(r.status, `${role}: ${r.text}`).toBe(200);
      expect(r.json.deletedId).toBe(made.id);
      expect(await invoiceRow(made.id), role).toBeNull();
      expect(await invoiceCount()).toBe(count - 1);
      out[role] = {
        ...answerOfRun(r),
        answer: { ...r.json, deletedId: "<id>" },
      };
    }
    for (const role of STAFF_ROLES) expect(out[role], role).toEqual(out.admin);
    await pin(DIR, 1, "deleted by each staff role", {
      roles: [...STAFF_ROLES],
      ...(out.admin as object),
    });
  });

  it("a delete leaves no activity row (its action type is not in the table)", async () => {
    const made = await makeInvoice("admin", tag, { grandTotal: 1999.99 });
    expect((await del("admin", made.id)).status).toBe(200);
    await new Promise((r) => setTimeout(r, 800));
    expect(
      (await invoiceActivity()).filter(
        (a) => a.action_type === "delete_invoice"
      )
    ).toEqual([]);
  });

  it("a second delete, an invoice nobody has, and something that is not an id are all a 404", async () => {
    const made = await makeInvoice("admin", tag);
    expect((await del("admin", made.id)).status).toBe(200);
    const out = {
      "the same invoice again": answerOfRun(await del("admin", made.id)),
      "an id nobody has": answerOfRun(await del("admin", NO_SUCH_ID)),
      "not an id": answerOfRun(await del("admin", "not-an-id")),
    };
    for (const v of Object.values(out)) expect((v as any).status).toBe(404);
    await pin(DIR, 2, "nothing to delete", out);
  });

  it("a jobseeker is refused (403), even on an invoice they made; nothing is deleted. No token is 401, a bad token 403", async () => {
    const mine = await makeInvoice("js:sin", tag);
    const other = await makeInvoice("admin", tag);
    const out = {
      "their own invoice": answerOfRun(await del("js:sin", mine.id)),
      "someone else's": answerOfRun(await del("js:sin", other.id)),
      "the sign-up jobseeker": answerOfRun(await del("js:signup", other.id)),
    };
    for (const v of Object.values(out)) expect((v as any).status).toBe(403);
    expect(await invoiceRow(mine.id)).not.toBeNull();
    expect(await invoiceRow(other.id)).not.toBeNull();
    await pin(DIR, 3, "jobseekers and no token", {
      ...out,
      ...(await noTokenAnswers(`/api/invoices/${other.id}`, {
        method: "DELETE",
      })),
    });
    expect(await invoiceRow(other.id)).not.toBeNull();
    // the seeded invoices are never deleted
    expect(await invoiceRow(SEEDED_INVOICE.ontario)).not.toBeNull();
  });
});

describe("PATCH /api/invoices/:id/document", () => {
  const doc = (n: string, over: Record<string, unknown> = {}) => ({
    documentPath: `00000000-0000-4000-8000-000000000001/${n}/documents/Invoice_${n}_Northwind.pdf`,
    documentFileName: `Invoice_${n}_Northwind.pdf`,
    documentFileSize: 18432,
    documentGeneratedAt: "2026-11-17T15:30:00.000Z",
    documentMimeType: "application/pdf",
    documentGenerated: true,
    ...over,
  });

  it("each staff account records the document of an invoice: 200, the same stored columns, the version does not move", async () => {
    const out: Record<string, unknown> = {};
    const rows: Record<string, unknown> = {};
    for (const role of STAFF_ROLES) {
      const made = await makeInvoice("admin", tag);
      const r = await patch(role, made.id, doc("N"));
      expect(r.status, `${role}: ${r.text}`).toBe(200);
      const stored = await invoiceRow(made.id);
      expect(stored.version, role).toBe(1);
      expect(stored.updated_by_user_id, role).toBe(
        r.json.invoice.updatedByUserId
      );
      rows[role] = { ...generic(stored), invoice_number: "<number>" };
      out[role] = generic({ ...r.json.invoice, invoiceNumber: "<number>" });
    }
    for (const role of STAFF_ROLES) {
      expect(rows[role], role).toEqual(rows.admin);
      expect(out[role], role).toEqual(out.admin);
    }
    await pin(
      DIR.replace("delete", "document"),
      1,
      "document recorded by each staff role",
      {
        roles: [...STAFF_ROLES],
        answer: out.admin,
        stored: rows.admin,
      }
    );
  });

  it("the fields it stores, and what it does with a body that leaves some out", async () => {
    const out: Record<string, unknown> = {};
    const cases: Record<string, Record<string, unknown>> = {
      "a path only": { documentPath: "some/path.pdf" },
      "a path and the flag": {
        documentPath: "some/path.pdf",
        documentGenerated: true,
      },
      "no generated date (the time of the call is stored)": doc("N", {
        documentGeneratedAt: undefined,
      }),
      "the flag false": doc("N", { documentGenerated: false }),
      "a size of zero": doc("N", { documentFileSize: 0 }),
      "a mime type left out (it is stored empty)": doc("N", {
        documentMimeType: undefined,
      }),
    };
    for (const [name, body] of Object.entries(cases)) {
      const made = await makeInvoice("admin", tag);
      const r = await patch("admin", made.id, body);
      const stored = await invoiceRow(made.id);
      out[name] = {
        status: r.status,
        columns: Object.fromEntries(
          [
            "document_generated",
            "document_path",
            "document_file_name",
            "document_file_size",
            "document_mime_type",
          ].map((k) => [k, stored[k]])
        ),
        // a stamp that was sent is stored as sent; one that was not is the time of the call
        generatedAt: body.documentGeneratedAt
          ? stored.document_generated_at
          : stored.document_generated_at
            ? "<now>"
            : null,
      };
    }
    await pin(DOC, 2, "what it stores", out);
  });

  it("a path is required (400); an invoice nobody has, and an id that is not an id, are a 404; nothing changes", async () => {
    const made = await makeInvoice("admin", tag);
    const out = {
      "no path": answerOfRun(
        await patch("admin", made.id, { documentFileName: "x.pdf" })
      ),
      "an empty path": answerOfRun(
        await patch("admin", made.id, { documentPath: "" })
      ),
      "an empty body": answerOfRun(await patch("admin", made.id, {})),
      "an id nobody has": answerOfRun(
        await patch("admin", NO_SUCH_ID, doc("N"))
      ),
      "not an id": answerOfRun(await patch("admin", "not-an-id", doc("N"))),
    };
    expect((out["no path"] as any).status).toBe(400);
    expect((out["an id nobody has"] as any).status).toBe(404);
    const stored = await invoiceRow(made.id);
    expect(stored.document_path).toBeNull();
    await pin(DOC, 3, "refused", out);
  });

  it("a jobseeker is refused (403), even on their own invoice. No token is 401, a bad token 403", async () => {
    const mine = await makeInvoice("js:sin", tag);
    const out = {
      "their own invoice": answerOfRun(
        await patch("js:sin", mine.id, doc("N"))
      ),
      "the sign-up jobseeker": answerOfRun(
        await patch("js:signup", mine.id, doc("N"))
      ),
    };
    for (const v of Object.values(out)) expect((v as any).status).toBe(403);
    expect((await invoiceRow(mine.id)).document_path).toBeNull();
    await pin(DOC, 4, "jobseekers and no token", {
      ...out,
      ...(await noTokenAnswers(`/api/invoices/${mine.id}/document`, {
        method: "PATCH",
        body: doc("N"),
      })),
    });
  });
});
