// API pins for GET /api/invoices and GET /api/invoices/:id (R-5, recorded on the code as it is, before the split).
//
// Who may call them, worked out from the routes: `authorizeRoles(["admin", "recruiter", "jobseeker"])` lets all
// nine kinds of account in. Staff read every invoice (the eight staff answers are checked equal and stored once). A
// jobseeker reads only invoices they made themselves (`created_by_user_id`), and none of the five seeded ones was made
// by a jobseeker, so a jobseeker gets an empty list and a 404 on every seeded invoice (what a jobseeker sees of an
// invoice recorded as theirs is in invoices-jobseeker.test.ts; a jobseeker cannot create one since DEV-7). Reads only:
// nothing here writes.
import { describe, expect, it } from "vitest";
import { noTokenAnswers, pin } from "./module-helpers";
import { staffAndJobseekers } from "./timesheet-helpers";
import { call, NO_SUCH_ID, SEEDED_INVOICE } from "./invoice-helpers";

const LIST = "api-invoices-list";
const GET = "api-invoices-get";

/** The seeded invoices have different `created_at`, so the list has no ties: no re-ordering is needed. */
const LIST_CASES: Array<[string, string]> = [
  ["the first page, no filter", ""],
  ["two to a page, page 1", "?page=1&limit=2"],
  ["two to a page, page 2", "?page=2&limit=2"],
  ["two to a page, page 3", "?page=3&limit=2"],
  ["a page past the end", "?page=9&limit=2"],
  ["search by invoice number", "?searchTerm=900001"],
  ["search by client name", "?searchTerm=Quebec"],
  ["search by client email", "?searchTerm=paige"],
  ["search by client short code", "?searchTerm=NW"],
  ["search that finds nothing", "?searchTerm=nothing-has-this"],
  ["search with spaces around it", "?searchTerm=%20900004%20"],
  ["client filter by name", "?clientFilter=Pacific"],
  ["client filter that finds nothing", "?clientFilter=zzz"],
  ["client email filter", "?clientEmailFilter=nora"],
  ["invoice number filter", "?invoiceNumberFilter=90000"],
  ["invoice number filter, one", "?invoiceNumberFilter=900005"],
  ["from a date", "?dateRangeStart=2026-11-10"],
  ["up to a date", "?dateRangeEnd=2026-11-02"],
  ["between two dates", "?dateRangeStart=2026-11-01&dateRangeEnd=2026-11-12"],
  ["email sent: true", "?emailSentFilter=true"],
  ["email sent: false", "?emailSentFilter=false"],
  ["email sent: anything but true is false", "?emailSentFilter=yes"],
  [
    "invoice sent: true (it reads the email_sent column too)",
    "?invoiceSentFilter=true",
  ],
  ["document generated: false", "?documentGeneratedFilter=false"],
  ["document generated: true", "?documentGeneratedFilter=true"],
  [
    "payment terms (the seeded invoices store none)",
    "?paymentTermsFilter=Net%2030",
  ],
  [
    "a client filter and an email filter together",
    "?clientFilter=Northwind&emailSentFilter=false",
  ],
  ["page and limit that are not numbers", "?page=abc&limit=abc"],
  ["page 0", "?page=0&limit=2"],
  ["limit 0", "?limit=0"],
  ["a negative limit", "?limit=-1"],
  ["search text that is part of the filter syntax", "?searchTerm=a),b("],
];

describe("GET /api/invoices", () => {
  LIST_CASES.forEach(([name, query], i) => {
    it(`${name}: every staff account the same, a jobseeker none`, async () => {
      const result = await staffAndJobseekers(
        `/api/invoices${query}`,
        (a) => a
      );
      await pin(LIST, i + 1, name, { query, ...result });
    });
  });

  it("the list is the five seeded invoices, newest first, with the client beside each", async () => {
    const r = await call("admin", "/api/invoices");
    expect(r.status).toBe(200);
    expect(r.json.invoices.map((x: any) => x.invoiceNumber)).toEqual([
      "900003", // 17 Nov
      "900006", // 12 Nov
      "900001", // 10 Nov
      "900004", // 2 Nov
      "900005", // 28 Sep
    ]);
    expect(r.json.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 5,
      totalFiltered: 5,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
    expect(r.json.invoices[0].client.company_name).toBe(
      "Quebec Test Logistics Client"
    );
    expect(r.json.invoices[0]).not.toHaveProperty("clients");
  });

  it("no token is 401, a bad token 403", async () => {
    await pin(
      LIST,
      LIST_CASES.length + 1,
      "without a token",
      await noTokenAnswers("/api/invoices")
    );
  });
});

describe("GET /api/invoices/:id", () => {
  const seeded: Array<[string, string]> = [
    ["Ontario, HST", SEEDED_INVOICE.ontario],
    ["Quebec, GST and QST, a draft", SEEDED_INVOICE.quebec],
    ["British Columbia, GST, paid", SEEDED_INVOICE.britishColumbia],
    ["Alberta, zero rated, USD, overdue", SEEDED_INVOICE.alberta],
    ["Ontario with a deduction line, a draft", SEEDED_INVOICE.ontarioDeduction],
  ];
  seeded.forEach(([name, id], i) => {
    it(`${name}: every staff account the same, a jobseeker a 404`, async () => {
      const result = await staffAndJobseekers(`/api/invoices/${id}`);
      expect(result.jobseekers.sin).toEqual({
        status: 404,
        answer: { error: "Invoice not found or access denied" },
      });
      await pin(GET, i + 1, name, result);
    });
  });

  it("an id nobody has is 404; something that is not an id is a 500 with a fixed message", async () => {
    const nobody = await call("admin", `/api/invoices/${NO_SUCH_ID}`);
    const notAnId = await call("admin", "/api/invoices/not-an-id");
    expect(nobody.status).toBe(404);
    await pin(
      GET,
      seeded.length + 1,
      "an id nobody has, and one that is not an id",
      {
        "an id nobody has": { status: nobody.status, answer: nobody.json },
        "not an id": { status: notAnId.status, answer: notAnId.json },
      }
    );
  });

  it("no token is 401, a bad token 403", async () => {
    await pin(
      GET,
      seeded.length + 2,
      "without a token",
      await noTokenAnswers(`/api/invoices/${SEEDED_INVOICE.ontario}`)
    );
  });
});
