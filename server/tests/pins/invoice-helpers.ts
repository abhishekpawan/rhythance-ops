// Helpers for the R-5 invoice pins (tests/pins/invoices-*.test.ts): all nine endpoints of
// server/src/routes/invoices.ts, asked as the eight staff accounts, the five jobseekers and the open sign-up jobseeker.
//
// Who may call what, worked out from the route file (`authorizeRoles`, then `hasAccessRole`: the six recruiter-type
// roles all count as "recruiter", so every staff account passes a ["admin", "recruiter"] route):
//   generate-invoice-number, DELETE :id, PATCH :id/document, timesheets-by-client, POST :id/send-email:
//       admin + recruiter, so all eight staff accounts; a jobseeker gets 403.
//   GET /, GET :id, POST /, PUT :id: admin + recruiter + jobseeker. A jobseeker reads and updates only invoices they
//       made themselves (and updates only drafts); they may create any invoice.
import { expect } from "vitest";
import {
  JOBSEEKERS,
  jobseekerEmails,
  server,
  signupEmail,
  stack,
  staffEmails,
  supabase,
  tokenFor,
} from "../support/api";
import { putBackInvoiceWrites } from "../support/put-back.mjs";
import { settle } from "./module-helpers";
import {
  answerOf,
  answerOfRun,
  call,
  emailsSent,
  mailOf,
  newEmails,
  stampless,
  type Who,
} from "./timesheet-helpers";

export {
  answerOf,
  answerOfRun,
  call,
  emailsSent,
  mailOf,
  newEmails,
  stampless,
  type Who,
};
export { EVERYONE, JOBSEEKER_KEYS } from "./timesheet-helpers";
export type { JobseekerKey } from "./timesheet-helpers";

const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** The four seeded clients: one per tax case. */
export const CLIENT = {
  northwind: uid(21), // Ontario, CAD, Net 30: HST 13%
  quebec: uid(22), // Quebec, CAD, Net 15: GST 5% + QST 9.975%
  pacific: uid(23), // British Columbia, CAD: GST 5%
  prairie: uid(24), // Alberta, USD: zero rated
} as const;
/** The five seeded invoices (numbers 900001, 900003, 900004, 900005, 900006). */
export const SEEDED_INVOICE = {
  ontario: uid(61),
  quebec: uid(62),
  britishColumbia: uid(63),
  alberta: uid(64),
  ontarioDeduction: uid(65),
} as const;
export const SEEDED_IDS = Object.values(SEEDED_INVOICE);
export const SEEDED_NUMBERS = [
  "900001",
  "900003",
  "900004",
  "900005",
  "900006",
];
export const NO_SUCH_ID = "00000000-0000-4000-8000-0000000000ee";

/** Every invoice a pin makes has this note and a number starting with "R5" (the column holds ten characters). */
export const NOTE = "R5-PIN";
let counter = 0;
/** A number nobody else in the run uses, e.g. "R5-0001"; `tag` keeps two files from meeting. */
export const nextNumber = (tag: string) =>
  `R5${tag}${String(++counter).padStart(4, "0")}`;

export interface Body {
  [k: string]: unknown;
}

/**
 * What the invoice page sends to POST /api/invoices for one Ontario line of 40 regular hours at 35.00 an hour: the
 * subtotal 1400, HST 13% = 182, total 1582. Every required field, worked out by hand; a case overrides what it needs.
 */
export function invoiceBody(number: string, over: Body = {}): Body {
  return {
    invoiceNumber: number,
    clientId: CLIENT.northwind,
    invoiceDate: "2026-11-17",
    dueDate: "2026-12-17",
    status: "draft",
    currency: "CAD",
    paymentTerms: "Net 30",
    subtotal: 1400,
    totalTax: 182,
    totalHst: 182,
    totalGst: 0,
    totalQst: 0,
    grandTotal: 1582,
    totalHours: 40,
    emailSent: false,
    notes: NOTE,
    documentGenerated: false,
    invoiceData: {
      client: {
        id: CLIENT.northwind,
        companyName: "Northwind Test Staffing Client",
        shortCode: "NW",
      },
      timesheets: [
        {
          id: "line-1",
          description: "Work period: Nov 8 – Nov 14, 2026",
          weekStartDate: "2026-11-08",
          weekEndDate: "2026-11-14",
          totalRegularHours: 40,
          totalOvertimeHours: 0,
          regularBillRate: 35,
          overtimeBillRate: 35,
          totalClientBill: 1400,
          salesTax: "13.00% [ON]",
        },
      ],
      attachments: [],
      supplierPOItems: [],
      messageOnInvoice: "",
      termsOnInvoice: "",
      summary: {
        subtotal: 1400,
        totalTax: 182,
        grandTotal: 1582,
        totalHours: 40,
        currency: "CAD",
      },
    },
    ...over,
  };
}

/** Makes an invoice through the API and returns the stored row as the answer shows it (fails the test when it is not created). */
export async function makeInvoice(who: Who, tag: string, over: Body = {}) {
  const number = (over.invoiceNumber as string | undefined) ?? nextNumber(tag);
  const r = await call(who, "/api/invoices", {
    method: "POST",
    body: invoiceBody(number, over),
  });
  expect(r.status, r.text).toBe(201);
  return r.json.invoice as Record<string, any>;
}

// ---- clean-up ---------------------------------------------------------------------------------------------------

const serviceKey = () => stack().serviceKey;

/** Removes what the invoice storage holds under a pin's own folder (service key). */
export async function removeStored(...names: string[]) {
  if (!names.length) return;
  const r = await supabase(`/storage/v1/object/invoices`, {
    token: serviceKey(),
    key: serviceKey(),
    method: "DELETE",
    body: { prefixes: names },
  });
  expect(r.status, r.text).toBeLessThan(300);
}

/** Puts a small stand-in PDF into the invoices bucket (service key) and returns its path. */
export async function storePdf(name: string, content = "%PDF-1.4 R5 pin") {
  const r = await supabase(`/storage/v1/object/invoices/${name}`, {
    token: serviceKey(),
    key: serviceKey(),
    method: "POST",
    raw: content,
    headers: { "Content-Type": "application/pdf", "x-upsert": "true" },
  });
  expect(r.status, r.text).toBeLessThan(300);
  return name;
}

/**
 * Puts the database back after a pin wrote: removes every invoice it made (found by its number or its note) and what
 * the server logged and moved because of them (`support/put-back.mjs`). The server logs a write after it has answered,
 * so this waits a moment first for the last of those rows to arrive.
 */
export async function sweepInvoices(alsoWhere?: string) {
  await new Promise((r) => setTimeout(r, 600));
  putBackInvoiceWrites(
    stack().dbUrl,
    `invoice_number LIKE 'R5%' OR notes LIKE '${NOTE}%'${alsoWhere ? ` OR ${alsoWhere}` : ""}`
  );
}

/** The row as the database holds it (service key), or null. */
export async function invoiceRow(id: string) {
  const r = await supabase(`/rest/v1/invoices?id=eq.${id}&select=*`, {
    token: serviceKey(),
    key: serviceKey(),
  });
  expect(r.status, r.text).toBe(200);
  return (r.json as any[])[0] ?? null;
}

export async function invoiceRowByNumber(number: string) {
  const r = await supabase(
    `/rest/v1/invoices?invoice_number=eq.${encodeURIComponent(number)}&select=*`,
    { token: serviceKey(), key: serviceKey() }
  );
  expect(r.status, r.text).toBe(200);
  return (r.json as any[])[0] ?? null;
}

/** How many invoices the database holds (everyone's, service key). */
export async function invoiceCount() {
  const r = await supabase(`/rest/v1/invoices?select=id`, {
    token: serviceKey(),
    key: serviceKey(),
  });
  expect(r.status, r.text).toBe(200);
  return (r.json as any[]).length;
}

/** The activity rows the server logged for invoices (action types create / update / delete / send). */
export async function invoiceActivity() {
  const r = await supabase(
    `/rest/v1/recent_activities?action_type=like.*_invoice*&select=action_type,display_message,primary_entity_name,actor_id&order=created_at.asc`,
    { token: serviceKey(), key: serviceKey() }
  );
  expect(r.status, r.text).toBe(200);
  return r.json as any[];
}

// ---- storing an answer -------------------------------------------------------------------------------------------

/**
 * A stored invoice row (or the invoice an answer holds) with what differs between runs and between the accounts that
 * made it replaced: the id, who made it, the stamps, the version history's authors.
 */
export function generic(row: Record<string, any>) {
  const { id, ...rest } = row;
  const made = (v: any) => (v === null || v === undefined ? v : "<who>");
  const out: Record<string, any> = { ...rest, id: "<id>" };
  // the search text holds the invoice number
  for (const k of ["search_vector", "searchVector"]) {
    if (k in out) out[k] = "<search text>";
  }
  for (const k of [
    "created_by_user_id",
    "updated_by_user_id",
    "createdByUserId",
    "updatedByUserId",
  ]) {
    if (k in out) out[k] = made(out[k]);
  }
  for (const k of ["version_history", "versionHistory"]) {
    if (Array.isArray(out[k])) {
      out[k] = out[k].map((v: any) => ({ ...v, updated_by: "<who>" }));
    }
  }
  return settle(stampless(out)) as any;
}

export {
  JOBSEEKERS,
  jobseekerEmails,
  signupEmail,
  staffEmails,
  tokenFor,
  server,
};
