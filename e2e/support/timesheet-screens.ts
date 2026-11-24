// Helpers for the Timesheets journeys (R-4): what the seed holds (ids worked out from server/tests/seed/data.sql), the
// weeks the journeys write to, a service-key sweep that puts the database back, and the readers for what the screens
// send and show. The expected request bodies are written by hand in the specs (never copied from a run).
import { expect, type Page, type Request } from "@playwright/test";
import { putBackTimesheetWrites } from "../../server/tests/support/put-back.mjs";
import { localStack } from "../../server/tests/support/stack.mjs";

const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const CLIENT = { northwind: uid(21), quebec: uid(22), pacific: uid(23) };
export const POSITION = {
  warehouse: uid(31), // pay 20, bill 35, markup 75, no overtime
  forklift: uid(32), // overtime after 40 h: pay 30, bill 52.50
  driver: uid(34), // premium pay 2.5, Quebec
  loader: uid(35), // Vancouver
};
export const PROFILE = {
  sin: uid(41),
  cash: uid(42),
  hybrid: uid(43),
  corp: uid(44),
  hybridEt: uid(45),
};
export const USER = {
  sin: uid(11),
  cash: uid(12),
  hybrid: uid(13),
  corp: uid(14),
  hybridEt: uid(15),
};
export const SEEDED_TIMESHEET = (n: number) => uid(n); // 51 to 59

/** Sunday-to-Saturday week `n` weeks after 2025-03-02: before every date the Reports journeys ask for, and before the seed. */
export function weekStart(n: number): string {
  return addDays("2025-03-02", n * 7);
}
export function addDays(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}
/** The seven days of a week, Sunday first, with the hours given for each. */
export const days = (start: string, hours: number[]) =>
  hours.map((h, i) => ({ date: addDays(start, i), hours: h }));

// ---- the database: put back what a journey wrote -----------------------------------------------------------------

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
 * Puts the database back: removes every timesheet written before June 2026 (the seed starts in September 2026) and what
 * the server logged and moved because of them (the activity rows, the clients' and jobseekers' last-activity dates:
 * `server/tests/support/put-back.mjs`). The server logs a write after it has answered, so it waits a moment first.
 */
export async function sweepTimesheets() {
  await new Promise((r) => setTimeout(r, 600));
  putBackTimesheetWrites(stack.dbUrl, "week_start_date < '2026-06-01'");
}

/** The rows written before June 2026 (what a journey saved), oldest week first, in the order of their segment. */
export async function savedRows() {
  const r = await rest(
    "/rest/v1/timesheets?week_start_date=lt.2026-06-01&select=*&order=week_start_date.asc,pay_split_segment.asc"
  );
  expect(r.status).toBe(200);
  return (await r.json()) as Array<Record<string, any>>;
}

/** Makes a timesheet through the server like the entry screen would (to open it for editing); returns its row. */
export async function createThroughServer(body: Record<string, unknown>) {
  const { signIn } = await import("../../server/tests/seed/users.mjs");
  const token = await signIn(stack, "admin@example.test");
  const res = await fetch(`${process.env.E2E_SERVER_URL}/api/timesheets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  expect(res.status, await res.clone().text()).toBe(201);
  return (await res.json()).timesheet as Record<string, any>;
}

// ---- driving the entry screen --------------------------------------------------------------------------------------

export function entryUrl(p: {
  profile: string;
  client: string;
  position: string;
  week: string;
}) {
  return `/timesheet-management?profileId=${p.profile}&clientId=${p.client}&positionId=${p.position}&weekStart=${p.week}`;
}

/** Types the hours of the seven days (Sunday first); a 0 is left empty. */
export async function typeHours(page: Page, hours: number[]) {
  const inputs = page.locator(
    ".timesheet-hours-section:not(.adjustments-section) .timesheet-hours-input"
  );
  await expect(inputs).toHaveCount(7);
  for (const [i, h] of hours.entries()) {
    if (h > 0) await inputs.nth(i).fill(String(h));
  }
}

export async function typePay(page: Page, bonus: number, deduction: number) {
  const inputs = page.locator(".adjustments-section .timesheet-hours-input");
  if (bonus > 0) await inputs.nth(0).fill(String(bonus));
  if (deduction > 0) await inputs.nth(1).fill(String(deduction));
}

/** The invoice lines and totals the form shows, as one line per text block. */
export async function invoiceText(
  page: Page,
  root = ".timesheet-invoice-table"
) {
  const raw = await page.locator(root).first().innerText();
  return (
    raw
      .split("\n")
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n") + "\n"
  );
}

/** The mutating requests a screen sends to /api/timesheets (create and update), in order. */
export function watchSaves(page: Page) {
  const sent: Request[] = [];
  page.on("request", (r) => {
    const { pathname } = new URL(r.url());
    if (
      /^\/api\/timesheets(\/[^/]+)?$/.test(pathname) &&
      (r.method() === "POST" || r.method() === "PUT")
    )
      sent.push(r);
  });
  return sent;
}

/** Waits until `n` saves were sent and answered, and returns their bodies; every answer must be a success. */
export async function savedBodies(sent: Request[], n: number) {
  await expect(async () => {
    expect(sent.length).toBe(n);
    for (const r of sent)
      expect((await r.response())?.status(), r.url()).toBeLessThan(300);
  }).toPass({ timeout: 20_000 });
  return sent.map((r) => ({
    method: r.method(),
    path: new URL(r.url()).pathname,
    body: r.postDataJSON() as Record<string, any>,
  }));
}

/** The invoice number the server handed out is a run-time value: it must be six digits, then it becomes a placeholder. */
export function maskInvoice<T extends Record<string, any>>(body: T): T {
  if (body.invoice_number === undefined) return body;
  expect(String(body.invoice_number)).toMatch(/^\d{6}$/);
  return { ...body, invoice_number: "<six digits>" };
}

// ---- the bulk screens ----------------------------------------------------------------------------------------------

/** Chooses an option of the n-th dropdown whose text matches `label` (a string or a pattern, for the two languages). */
export async function pick(page: Page, nth: number, label: string | RegExp) {
  const dropdown = page.locator(".custom-dropdown").nth(nth);
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

/** The week of 7 December 2025 as the dropdown writes it, in English and in French. */
export const DEC_7 = /Dec 7, 2025|7 déc\.? 2025/;
