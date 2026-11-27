// Helpers for the Invoices journeys (R-5): what the seed holds, the requests a screen sends (the body of the save, the
// document record, the PDF upload, the send), the PDF the browser made (read back from storage and turned into plain
// content with the client's own pdfjs-dist), and a sweep that puts the database and storage back.
//
// The expected request bodies are written by hand in the specs (never copied from a run). Money in a body is compared
// number by number to the value worked out by hand (`sameMoney`): the page never rounds, so a total can be a long
// float, but never a different cent.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import {
  expect,
  type Locator,
  type Page,
  type Request,
} from "@playwright/test";
import { putBackInvoiceWrites } from "../../server/tests/support/put-back.mjs";
import { localStack, psql } from "../../server/tests/support/stack.mjs";

const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const CLIENT = {
  northwind: uid(21), // Ontario, CAD: HST 13%
  quebec: uid(22), // Quebec, CAD: GST 5% + QST 9.975%
  pacific: uid(23), // British Columbia, CAD: GST 5%
  prairie: uid(24), // Alberta, USD: zero rated
};
export const SEEDED_INVOICE = {
  ontario: uid(61),
  quebec: uid(62),
  britishColumbia: uid(63),
  alberta: uid(64),
  ontarioDeduction: uid(65),
};
const SEEDED_IDS = Object.values(SEEDED_INVOICE);
/** The one stored file the seed puts in the invoices bucket. */
const SEEDED_OBJECT = "00000000-0000-4000-8000-000000000003/invoice-900001.pdf";

export const TAX = {
  ON: "13.00% [ON]",
  QC: "14.975% [QC]",
  BC: "5.00% [BC]",
  AB: "5.00% [AB]",
  ZERO: "0.00% [ZERO RATED]",
};

// ---- the database and storage: put back what a journey wrote -----------------------------------------------------

const stack = localStack();
const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${stack.apiUrl}${path}`, {
    ...init,
    headers: {
      apikey: stack.serviceKey,
      Authorization: `Bearer ${stack.serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string>),
    },
  });

/**
 * Puts the database back: removes every invoice that is not one of the five the seed made, what the server logged and
 * moved because of them (`server/tests/support/put-back.mjs`), and every file the browser put in the invoices bucket
 * except the seed's own. The server logs after it has answered, so it waits a moment first.
 */
export async function sweepInvoices() {
  await new Promise((r) => setTimeout(r, 600));
  putBackInvoiceWrites(
    stack.dbUrl,
    `id NOT IN (${SEEDED_IDS.map((i) => `'${i}'`).join(", ")})`
  );
  // the files go through the storage API (a direct delete from the storage tables is refused)
  const listed = psql(stack.dbUrl, {
    sql: `SELECT name FROM storage.objects WHERE bucket_id = 'invoices' AND name <> '${SEEDED_OBJECT}'`,
    file: undefined,
    singleTransaction: false,
    tuplesOnly: true,
  });
  if (listed.status !== 0)
    throw new Error(`could not list storage: ${listed.stderr}`);
  const names = String(listed.stdout).split("\n").filter(Boolean);
  if (names.length) {
    const r = await fetch(`${stack.apiUrl}/storage/v1/object/invoices`, {
      method: "DELETE",
      headers: {
        apikey: stack.serviceKey,
        Authorization: `Bearer ${stack.serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prefixes: names }),
    });
    if (r.status >= 300)
      throw new Error(`could not clean storage: ${await r.text()}`);
  }
}

/**
 * Gives invoices made one after another a clear order in time: `created_at` one second apart, in the order given. The
 * list is ordered by `created_at`, and the local database clock can step back by about 100 ms between two connections
 * (seen on the Mac's Docker VM), more than the gap between two quick creates, so two rows could swap.
 */
export async function spreadCreatedAt(invoiceNumbers: string[]) {
  const start = Date.now();
  for (const [i, number] of invoiceNumbers.entries()) {
    const r = await rest(`/rest/v1/invoices?invoice_number=eq.${number}`, {
      method: "PATCH",
      body: JSON.stringify({
        created_at: new Date(start + i * 1000).toISOString(),
      }),
    });
    if (r.status >= 300)
      throw new Error(`could not set created_at: ${await r.text()}`);
  }
}

/** Every invoice row that is not a seeded one, oldest first. */
export async function savedInvoices() {
  const r = await rest(
    `/rest/v1/invoices?id=not.in.(${SEEDED_IDS.join(",")})&select=*&order=created_at.asc`
  );
  expect(r.status).toBe(200);
  return (await r.json()) as Array<Record<string, any>>;
}

export async function invoiceById(id: string) {
  const r = await rest(`/rest/v1/invoices?id=eq.${id}&select=*`);
  expect(r.status).toBe(200);
  return ((await r.json()) as Array<Record<string, any>>)[0];
}

/** Makes an invoice through the server like the page would (to open it for editing); returns its row. */
export async function createThroughServer(body: Record<string, unknown>) {
  const { signIn } = await import("../../server/tests/seed/users.mjs");
  const token = await signIn(stack, "admin@example.test");
  const res = await fetch(`${process.env.E2E_SERVER_URL}/api/invoices`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  expect(res.status, await res.clone().text()).toBe(201);
  return (await res.json()).invoice as Record<string, any>;
}

// ---- the requests a screen sends -----------------------------------------------------------------------------------

export interface Calls {
  creates: Request[];
  updates: Request[];
  documents: Request[];
  sends: Request[];
  uploads: Request[];
}

/** The invoice requests of a page: create, update, document record, send, and the PDF upload to storage. */
export function watchInvoiceCalls(page: Page): Calls {
  const calls: Calls = {
    creates: [],
    updates: [],
    documents: [],
    sends: [],
    uploads: [],
  };
  page.on("request", (r) => {
    const { pathname } = new URL(r.url());
    const m = r.method();
    if (m === "POST" && pathname === "/api/invoices") calls.creates.push(r);
    else if (m === "PUT" && /^\/api\/invoices\/[^/]+$/.test(pathname))
      calls.updates.push(r);
    else if (
      m === "PATCH" &&
      /^\/api\/invoices\/[^/]+\/document$/.test(pathname)
    )
      calls.documents.push(r);
    else if (
      m === "POST" &&
      /^\/api\/invoices\/[^/]+\/send-email$/.test(pathname)
    )
      calls.sends.push(r);
    else if (
      m === "POST" &&
      /^\/storage\/v1\/object\/invoices\/.+\.pdf$/.test(pathname)
    )
      calls.uploads.push(r);
  });
  return calls;
}

/** Waits until a request has been sent and answered with a success, and returns it. */
export async function answered(list: Request[], n = 1) {
  await expect(async () => {
    expect(list.length).toBeGreaterThanOrEqual(n);
    for (const r of list)
      expect((await r.response())?.status(), r.url()).toBeLessThan(300);
  }).toPass({ timeout: 40_000 });
  return list[n - 1];
}

/** The body of a JSON request. */
export const bodyOf = (r: Request) => r.postDataJSON() as Record<string, any>;

/** The messages the test server recorded whose subject starts "Invoice #": who, copies, subject, file names. */
export function invoiceMails() {
  const file = process.env.E2E_OUTBOUND_LOG;
  if (!file) throw new Error("the test server's message log is not known");
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
    .filter((e) => e.kind === "email" && /^Invoice #/.test(e.subject))
    .map((e) => ({
      to: e.to,
      cc: e.cc,
      subject: e.subject as string,
      attachments: e.attachments as string[],
    }));
}

/**
 * Compares a request body with the one worked out by hand. Every number must be the hand-worked value (to 8 decimals:
 * the page does not round, so 1400 x 9.975 / 100 may come as 139.65000000000003 and that is the same cent), every
 * other value exactly equal, keys and all.
 */
export function sameMoney(actual: unknown, expected: unknown, where = "body") {
  if (typeof expected === "number") {
    expect(typeof actual, where).toBe("number");
    expect(actual as number, where).toBeCloseTo(expected, 8);
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual), where).toBe(true);
    expect((actual as unknown[]).length, `${where} length`).toBe(
      expected.length
    );
    expected.forEach((e, i) =>
      sameMoney((actual as unknown[])[i], e, `${where}[${i}]`)
    );
  } else if (expected && typeof expected === "object") {
    expect(actual && typeof actual === "object", where).toBeTruthy();
    const a = actual as Record<string, unknown>;
    const e = expected as Record<string, unknown>;
    // a key with an undefined value is not sent at all
    const aKeys = Object.keys(a).sort();
    const eKeys = Object.keys(e)
      .filter((k) => e[k] !== undefined)
      .sort();
    expect(aKeys, `${where} keys`).toEqual(eKeys);
    for (const k of eKeys) sameMoney(a[k], e[k], `${where}.${k}`);
  } else {
    expect(actual, where).toEqual(expected);
  }
}

// ---- driving the create page ---------------------------------------------------------------------------------------

const LINES =
  ".invoice-line-items-container:not(.supplier-po-section) .invoice-line-item-group";

/** Chooses an option in one dropdown (a locator of `.custom-dropdown`) by the text inside it. */
export async function pickIn(
  page: Page,
  dropdown: Locator,
  label: string | RegExp
) {
  const menu = dropdown.locator(".custom-dropdown-menu");
  const options = menu.locator(".custom-dropdown-option");
  await expect(async () => {
    await expect(page.locator(".invoice-dropdown-skeleton")).toHaveCount(0, {
      timeout: 1_000,
    });
    if (!(await menu.isVisible()))
      await dropdown.locator(".custom-dropdown-trigger").click();
    await expect(options.first()).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  await options.filter({ hasText: label }).first().click();
  await page.mouse.click(2, 2);
  await expect(menu).toBeHidden();
}

/** Opens the create page, chooses the client, and waits for the invoice number the page asks the server for. */
export async function startInvoice(page: Page, client: string | RegExp) {
  await page.goto("/invoice-management/create");
  const dropdowns = page.locator(".custom-dropdown");
  await expect(dropdowns.first()).toBeVisible();
  await pickIn(page, dropdowns.first(), client);
  await expect(
    page.locator(".timesheet-detail-value").filter({ hasText: /^\d{6}$/ })
  ).toBeVisible();
}

/** Fills the date range and loads the timesheets of the chosen client into lines. */
export async function loadTimesheets(
  page: Page,
  from: string,
  to: string,
  lines: number
) {
  await page.locator("#timesheet-start-date").fill(from);
  await page.locator("#timesheet-end-date").fill(to);
  const answer = page.waitForResponse(
    /\/api\/invoices\/timesheets-by-client\//
  );
  await page
    .locator("button.button")
    .filter({ hasText: /load timesheets|charger/i })
    .click();
  await answer;
  // the page keeps one empty line until the answer comes: wait for the lines the range holds
  await expect(lineGroups(page)).toHaveCount(lines);
  await expect(
    lineGroups(page).first().locator(".custom-dropdown-trigger").first()
  ).not.toContainText(/select|sélection/i);
}

export const lineGroups = (page: Page) => page.locator(LINES);

/** Sets the sales tax of line `n` (0 first). */
export async function setTax(page: Page, n: number, tax: string) {
  await pickIn(
    page,
    lineGroups(page).nth(n).locator(".custom-dropdown").nth(2),
    tax
  );
}

/** Types hours and rate of line `n`. */
export async function typeLine(
  page: Page,
  n: number,
  hours: string,
  rate: string
) {
  const inputs = lineGroups(page).nth(n).locator("input.invoice-number-input");
  await inputs.nth(0).fill(hours);
  await inputs.nth(1).fill(rate);
}

/** The invoice lines and totals the page shows, as one line per text block. */
export async function totalsText(page: Page) {
  const raw = await page
    .locator(".timesheet-invoice-table")
    .first()
    .innerText();
  return (
    raw
      .split("\n")
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n") + "\n"
  );
}

// ---- the PDF -------------------------------------------------------------------------------------------------------

/** The stored object of the invoices bucket (service key), as bytes. */
export async function storedObject(path: string): Promise<Buffer> {
  const r = await fetch(`${stack.apiUrl}/storage/v1/object/invoices/${path}`, {
    headers: {
      apikey: stack.serviceKey,
      Authorization: `Bearer ${stack.serviceKey}`,
    },
  });
  expect(r.status, path).toBe(200);
  return Buffer.from(await r.arrayBuffer());
}

/**
 * A PDF as content: the number of pages, each page's size, and every text item with its position rounded to 0.1 point,
 * one per line, in the order the file draws them. The creation date lives in the file's information, not in the
 * content, so nothing needs hiding; `hide` replaces what a run makes (the invoice number) with a placeholder.
 */
export async function pdfContent(
  bytes: Buffer,
  hide: Record<string, string> = {}
) {
  const require = createRequire(import.meta.url);
  const pdfjs = require("../../client/node_modules/pdfjs-dist/legacy/build/pdf.js");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;
  const lines: string[] = [`pages: ${doc.numPages}`];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const [x0, y0, x1, y1] = page.view as number[];
    lines.push(
      `page ${p}: ${(x1 - x0).toFixed(1)} x ${(y1 - y0).toFixed(1)} pt`
    );
    const text = await page.getTextContent();
    for (const item of text.items as Array<{
      str: string;
      transform: number[];
    }>) {
      if (!item.str.trim()) continue;
      let s = item.str;
      for (const [from, to] of Object.entries(hide)) s = s.split(from).join(to);
      lines.push(
        `${item.transform[4].toFixed(1)}, ${item.transform[5].toFixed(1)}: ${s}`
      );
    }
  }
  await doc.destroy();
  return lines.join("\n") + "\n";
}
