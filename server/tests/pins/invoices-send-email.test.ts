// API pins for POST /api/invoices/:id/send-email (R-5, recorded on the code as it is, before the split).
//
// Who may call it, worked out from the route: `authorizeRoles(["admin", "recruiter"])` lets the eight staff accounts
// through, any invoice (the route never asks who made it), and refuses a jobseeker with a 403 before the invoice is
// read. The message is built from the stored invoice and client and goes to the address in the body, with these copies:
// the addresses of the `email.invoiceCc` portal setting, then the client's second and third addresses and its dispatch
// and accounts addresses, each only when its "copy invoices" flag is on and the address is filled in. The PDF the
// browser stored in the `invoices` bucket is attached, with each stored attachment of the invoice data that can be
// downloaded (one that cannot is skipped without a word). After the send the invoice is marked sent (flag, date and
// address) without a new version.
//
// The outbound recorder holds what would have been sent: the pins assert who, the subject, the copies, the file names
// and that html and text were built, never the body. Nothing leaves the machine. The SendGrid stand-in never fails, so
// "Failed to send invoice email" is not reachable here and not pinned.
//
// Writes only on rows this file makes: invoices numbered "R5E…" (note R5-PIN), one client "R5-PIN Copy Client", PDFs
// under `r5pin/` in the invoices bucket, and the setting `email.invoiceCc` (put back to "no stored value"). All of it is
// removed in `beforeAll` and `afterAll`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { noTokenAnswers, pin, STAFF_ROLES } from "./module-helpers";
import { stack, supabase } from "../support/api";
import {
  answerOfRun,
  call,
  CLIENT,
  emailsSent,
  invoiceActivity,
  invoiceRow,
  makeInvoice,
  mailOf,
  newEmails,
  NO_SUCH_ID,
  removeStored,
  storePdf,
  sweepInvoices,
  type Body,
  type Who,
} from "./invoice-helpers";

const DIR = "api-invoices-send-email";
const tag = "E";
const CC_SETTING = "accounts@example.test, billing@example.test";
const COPY_CLIENT = "00000000-0000-4000-8000-0000000005e1";
const key = () => stack().serviceKey;

const sql = async (method: string, path: string, body?: unknown) => {
  const r = await supabase(path, {
    token: key(),
    key: key(),
    method,
    body,
    headers: { Prefer: "return=minimal" },
  });
  expect(r.status, r.text).toBeLessThan(300);
};

async function clean() {
  await sweepInvoices();
  await sql("DELETE", `/rest/v1/clients?id=eq.${COPY_CLIENT}`);
  await removeStored(
    ...Array.from({ length: 40 }, (_, i) => `r5pin/${i}/invoice.pdf`),
    "r5pin/extra-a.txt",
    "r5pin/extra-b.txt",
    "r5pin/a/b/Invoice.pdf"
  ).catch(() => undefined);
  await call("superadmin", "/api/portal-settings", {
    method: "PUT",
    body: { values: { "email.invoiceCc": "" } },
  });
}
beforeAll(async () => {
  await clean();
  await call("superadmin", "/api/portal-settings", {
    method: "PUT",
    body: { values: { "email.invoiceCc": CC_SETTING } },
  });
  await sql("POST", "/rest/v1/clients", {
    id: COPY_CLIENT,
    company_name: "R5-PIN Copy Client",
    billing_name: "R5-PIN Copy Billing",
    short_code: "R5C",
    currency: "CAD",
    work_province: "ON",
    contact_person_name1: "Casey Copy",
    email_address1: "casey.copy@example.test",
    mobile1: "+15555550199",
    email_address2: "second@example.test",
    invoice_cc2: true,
    email_address3: "third@example.test",
    invoice_cc3: false,
    dispatch_dept_email: "dispatch@example.test",
    invoice_cc_dispatch: true,
    accounts_dept_email: null,
    invoice_cc_accounts: true,
    street_address1: "1 Copy Street",
    city1: "Toronto",
    province1: "ON",
    postal_code1: "M5V 0A1",
    preferred_payment_method: "Cheque",
    terms: "Net 30",
    pay_cycle: "Weekly - 1 week hold",
    credit_limit: "1000",
    created_by_user_id: "00000000-0000-4000-8000-000000000001",
    updated_by_user_id: "00000000-0000-4000-8000-000000000001",
  });
});
afterAll(clean);

let pdfCounter = 0;
/** An invoice with its stand-in PDF in storage and the document recorded, ready to send. */
async function ready(
  over: Body = {},
  attachments: unknown[] = [],
  who: Who = "admin"
) {
  const n = pdfCounter++;
  const path = await storePdf(`r5pin/${n}/invoice.pdf`);
  const made = await makeInvoice(who, tag, {
    invoiceData: {
      client: { id: CLIENT.northwind },
      timesheets: [],
      attachments,
    },
    ...over,
  });
  const r = await call("admin", `/api/invoices/${made.id}/document`, {
    method: "PATCH",
    body: {
      documentPath: path,
      documentFileName: `Invoice_${made.invoiceNumber}.pdf`,
      documentFileSize: 14,
      documentGenerated: true,
      documentMimeType: "application/pdf",
    },
  });
  expect(r.status, r.text).toBe(200);
  return made;
}

const send = (
  who: Who,
  id: string,
  body: unknown = { email: "nora.north@example.test" }
) => call(who, `/api/invoices/${id}/send-email`, { method: "POST", body });

const messageOf = (m: Record<string, any>, number: string) => ({
  ...mailOf(m),
  subject: String(m.subject).replace(number, "<number>"),
  cc: m.cc,
  attachments: (m.attachments as string[]).map((a) =>
    a.replace(number, "<number>")
  ),
});

describe("POST /api/invoices/:id/send-email", () => {
  it("each staff account sends it: one message to the address, the copies of the setting, the PDF attached; the invoice is marked sent", async () => {
    const out: Record<string, unknown> = {};
    for (const role of STAFF_ROLES) {
      const made = await ready(
        {},
        [],
        role === "admin" ? "recruiter" : "admin"
      );
      const before = emailsSent().length;
      const r = await send(role, made.id);
      expect(r.status, `${role}: ${r.text}`).toBe(200);
      const sent = await newEmails(before, 1);
      expect(sent, role).toHaveLength(1);
      expect(sent[0].to).toEqual(["nora.north@example.test"]);
      expect(sent[0].cc).toEqual([
        "accounts@example.test",
        "billing@example.test",
      ]);
      expect(sent[0].subject).toBe(
        `Invoice #${made.invoiceNumber} for Northwind Test Staffing Client`
      );
      expect(sent[0].attachments).toEqual([
        `Invoice_${made.invoiceNumber}.pdf`,
      ]);
      const stored = await invoiceRow(made.id);
      expect(stored.email_sent, role).toBe(true);
      expect(stored.invoice_sent_to).toBe("nora.north@example.test");
      expect(stored.email_sent_date).not.toBeNull();
      expect(
        stored.version,
        "neither the document nor the send adds a version"
      ).toBe(1);
      out[role] = {
        status: r.status,
        answer: r.json,
        message: messageOf(sent[0], made.invoiceNumber),
      };
    }
    for (const role of STAFF_ROLES) expect(out[role], role).toEqual(out.admin);
    await pin(DIR, 1, "the send, the same from every role", {
      roles: [...STAFF_ROLES],
      ...(out.admin as object),
    });
  });

  it("a send leaves no activity row (its action type is not in the table)", async () => {
    const made = await ready();
    expect(
      (await send("admin", made.id, { email: "someone.else@example.test" }))
        .status
    ).toBe(200);
    await new Promise((r) => setTimeout(r, 800));
    expect(
      (await invoiceActivity()).filter(
        (a) => a.action_type === "send_invoice_email"
      )
    ).toEqual([]);
  });

  it("the copies: the setting first, then the client's second, third, dispatch and accounts addresses, each only with its flag and an address", async () => {
    const made = await ready({ clientId: COPY_CLIENT });
    const before = emailsSent().length;
    const r = await send("admin", made.id, {
      email: "casey.copy@example.test",
    });
    expect(r.status, r.text).toBe(200);
    const sent = await newEmails(before, 1);
    // second (flag on), third (flag off: left out), dispatch (flag on), accounts (flag on, no address: left out)
    expect(sent[0].cc).toEqual([
      "accounts@example.test",
      "billing@example.test",
      "second@example.test",
      "dispatch@example.test",
    ]);
    expect(sent[0].subject).toBe(
      `Invoice #${made.invoiceNumber} for R5-PIN Copy Client`
    );
    await pin(
      DIR,
      2,
      "the copies of a client with several",
      messageOf(sent[0], made.invoiceNumber)
    );
  });

  it("the third contact is copied when its flag is on (R-5b, inbox 87): in the order second, third, dispatch", async () => {
    await sql("PATCH", `/rest/v1/clients?id=eq.${COPY_CLIENT}`, {
      invoice_cc3: true,
    });
    try {
      const made = await ready({ clientId: COPY_CLIENT });
      const before = emailsSent().length;
      const r = await send("admin", made.id, {
        email: "casey.copy@example.test",
      });
      expect(r.status, r.text).toBe(200);
      const sent = await newEmails(before, 1);
      // second (flag on), third (flag now on), dispatch (flag on), accounts (flag on, no address: left out)
      expect(sent[0].cc).toEqual([
        "accounts@example.test",
        "billing@example.test",
        "second@example.test",
        "third@example.test",
        "dispatch@example.test",
      ]);
      await pin(
        DIR,
        5,
        "the copies with the third contact's flag on",
        messageOf(sent[0], made.invoiceNumber)
      );
    } finally {
      await sql("PATCH", `/rest/v1/clients?id=eq.${COPY_CLIENT}`, {
        invoice_cc3: false,
      });
    }
  });

  it("with no copy setting there are no copies; the address in the body is used as it is (nothing checks it)", async () => {
    await call("superadmin", "/api/portal-settings", {
      method: "PUT",
      body: { values: { "email.invoiceCc": "" } },
    });
    try {
      const made = await ready();
      const before = emailsSent().length;
      const r = await send("admin", made.id, {
        email: "not an address@example.test",
      });
      const sent = await newEmails(before, r.status === 200 ? 1 : 0);
      await pin(DIR, 3, "no copy setting, an address with a space in it", {
        status: r.status,
        answer: r.json,
        message: sent[0] ? messageOf(sent[0], made.invoiceNumber) : null,
        stored:
          r.status === 200
            ? { email_sent: (await invoiceRow(made.id)).email_sent }
            : "refused by the table",
      });
    } finally {
      await call("superadmin", "/api/portal-settings", {
        method: "PUT",
        body: { values: { "email.invoiceCc": CC_SETTING } },
      });
    }
  });

  it("the invoice's stored attachments are attached when they can be downloaded; one that cannot is skipped", async () => {
    await storePdf("r5pin/extra-a.txt", "extra a");
    const made = await ready({}, [
      {
        uploadStatus: "uploaded",
        filePath: "r5pin/extra-a.txt",
        fileName: "Timesheet A.txt",
        fileType: "text/plain",
        bucketName: "invoices",
      },
      {
        uploadStatus: "uploaded",
        filePath: "r5pin/missing.txt",
        fileName: "Not there.txt",
        fileType: "text/plain",
        bucketName: "invoices",
      },
      {
        uploadStatus: "error",
        filePath: "r5pin/extra-a.txt",
        fileName: "Failed upload.txt",
        fileType: "text/plain",
        bucketName: "invoices",
      },
      {
        uploadStatus: "uploaded",
        fileName: "No path.txt",
        fileType: "text/plain",
        bucketName: "invoices",
      },
    ]);
    const before = emailsSent().length;
    const r = await send("admin", made.id);
    expect(r.status, r.text).toBe(200);
    const sent = await newEmails(before, 1);
    expect(sent[0].attachments).toEqual([
      `Invoice_${made.invoiceNumber}.pdf`,
      "Timesheet A.txt",
    ]);
    await pin(
      DIR,
      4,
      "stored attachments",
      messageOf(sent[0], made.invoiceNumber)
    );
  });

  it("sending again sends again, and keeps the new date and address", async () => {
    const made = await ready();
    const before = emailsSent().length;
    expect(
      (await send("admin", made.id, { email: "first@example.test" })).status
    ).toBe(200);
    expect(
      (await send("admin", made.id, { email: "second@example.test" })).status
    ).toBe(200);
    expect(await newEmails(before, 2)).toHaveLength(2);
    expect((await invoiceRow(made.id)).invoice_sent_to).toBe(
      "second@example.test"
    );
  });

  it("an HTML-escaped path is read back (the route undoes &#x2F;), and the file name is decoded", async () => {
    const made = await makeInvoice("admin", tag);
    await storePdf("r5pin/a/b/Invoice.pdf");
    const patched = await call("admin", `/api/invoices/${made.id}/document`, {
      method: "PATCH",
      body: {
        documentPath: "r5pin/a&#x2F;b/Invoice.pdf",
        documentFileName: "Tom &amp; Jerry.pdf",
        documentGenerated: true,
      },
    });
    expect(patched.status, patched.text).toBe(200);
    const before = emailsSent().length;
    const r = await send("admin", made.id);
    expect(r.status, r.text).toBe(200);
    const sent = await newEmails(before, 1);
    expect(sent[0].attachments).toEqual(["Tom & Jerry.pdf"]);
  });

  describe("what is refused, each with nothing sent", () => {
    it("no address 400; an invoice nobody has 404; an invoice with no PDF 400; a PDF that is not in storage 500", async () => {
      const before = emailsSent().length;
      const ok = await ready();
      const noPdf = await makeInvoice("admin", tag);
      const lost = await makeInvoice("admin", tag);
      await call("admin", `/api/invoices/${lost.id}/document`, {
        method: "PATCH",
        body: {
          documentPath: "r5pin/not-stored.pdf",
          documentFileName: "Lost.pdf",
          documentGenerated: true,
        },
      });
      const out = {
        "no address": answerOfRun(await send("admin", ok.id, {})),
        "an empty address": answerOfRun(
          await send("admin", ok.id, { email: "" })
        ),
        "no body at all": answerOfRun(
          await call("admin", `/api/invoices/${ok.id}/send-email`, {
            method: "POST",
          })
        ),
        "an invoice nobody has": answerOfRun(await send("admin", NO_SUCH_ID)),
        "not an id": answerOfRun(await send("admin", "not-an-id")),
        "an invoice with no PDF": answerOfRun(await send("admin", noPdf.id)),
        "a PDF that is not in storage": answerOfRun(
          await send("admin", lost.id)
        ),
      };
      expect(await newEmails(before, 0)).toEqual([]);
      for (const id of [ok.id, noPdf.id, lost.id])
        expect((await invoiceRow(id)).email_sent).toBe(false);
      await pin(DIR, 10, "refused", out);
    });

    it("a jobseeker is refused (403), on their own invoice too; no token is 401, a bad token 403", async () => {
      const mine = await ready({}, [], "js:sin");
      const before = emailsSent().length;
      const out = {
        "their own invoice": answerOfRun(await send("js:sin", mine.id)),
        "the sign-up jobseeker": answerOfRun(await send("js:signup", mine.id)),
        ...(await noTokenAnswers(`/api/invoices/${mine.id}/send-email`, {
          method: "POST",
          body: { email: "a@example.test" },
        })),
      };
      expect((out["their own invoice"] as any).status).toBe(403);
      expect(await newEmails(before, 0)).toEqual([]);
      expect((await invoiceRow(mine.id)).email_sent).toBe(false);
      await pin(DIR, 11, "jobseekers and no token", out);
    });
  });
});
