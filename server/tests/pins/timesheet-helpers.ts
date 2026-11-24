// Helpers for the R-4 timesheet pins (tests/pins/timesheets-*.test.ts, timesheet-metrics.test.ts).
//
// The routes of /api/timesheets are all `authorizeRoles(["admin", "recruiter", "jobseeker"])`, and `hasAccessRole`
// lets every one of the nine seeded accounts through, so no role is refused by the route: the difference between
// roles is only what a jobseeker's own user id lets them reach. /api/timesheet-metrics is admin and recruiter only.
import { expect, inject } from "vitest";
import { readFileSync } from "node:fs";
import {
  JOBSEEKERS,
  jobseekerEmails,
  server,
  signupEmail,
  stack,
  staffEmails,
  supabase,
  tokenFor,
  type Reply,
} from "../support/api";
import { settle, STAFF_ROLES, type Role } from "./module-helpers";

const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Seeded profiles (tests/seed/data.sql), by the jobseeker account that owns them. */
export const PROFILE = {
  sin: uid(41),
  cash: uid(42),
  hybrid: uid(43),
  corp: uid(44),
  hybridEt: uid(45),
} as const;
export type JobseekerKey = keyof typeof PROFILE;
export const POSITION = {
  warehouse: uid(31), // 20/h pay, 35/h bill, Northwind, Toronto
  forklift: uid(32), // overtime after 40 h: pay 30, bill 52.50
  training: uid(33), // invoicing-only subcategory
  driver: uid(34), // premium pay 2.5, Quebec
  loader: uid(35), // Vancouver
  lineCook: uid(36), // ended
} as const;
/** The nine seeded timesheets, by the number in their id (51 to 59). */
export const SEEDED = Array.from({ length: 9 }, (_, i) => uid(51 + i));
export const NO_SUCH_ID = "00000000-0000-4000-8000-0000000000ee";

/** Every note a timesheet pin writes starts with this, so a leftover row of a failed run can be found and removed. */
export const NOTE = "R4-PIN";

export const JOBSEEKER_KEYS = Object.keys(JOBSEEKERS) as JobseekerKey[];

/** One request as any seeded account (staff role, jobseeker key, or the open sign-up jobseeker). */
export type Who = Role | `js:${JobseekerKey}` | "js:signup";

const emailOf = (who: Who): string =>
  who === "js:signup"
    ? signupEmail
    : who.startsWith("js:")
      ? jobseekerEmails[who.slice(3) as JobseekerKey]
      : who === "jobseeker"
        ? jobseekerEmails.sin
        : staffEmails[who as keyof typeof staffEmails];

export const userIdOf = (who: Who): string | undefined =>
  who.startsWith("js:") && who !== "js:signup"
    ? JOBSEEKERS[who.slice(3) as JobseekerKey].id
    : undefined;

export async function call(
  who: Who | "anon" | "bad",
  path: string,
  opts: { method?: string; body?: unknown; fixedClock?: boolean } = {}
): Promise<Reply> {
  const token =
    who === "anon"
      ? undefined
      : who === "bad"
        ? "not-a-token"
        : await tokenFor(emailOf(who));
  return server(path, { ...opts, token });
}

/** Status and body, the way the pins store an answer. */
export const answerOf = (r: Reply) => ({
  status: r.status,
  answer: r.json ?? r.text,
});

const ANY_STAMP = /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{1,6}(?:Z|[+-]\d\d:\d\d)/g;
/**
 * Every timestamp of an answer replaced. The pins' own normaliser keeps a stamp whose milliseconds are 000 (the seed's
 * stamps all are), so a row made by a test at a moment that falls on a whole second would be stored as a date; the
 * rows the write pins make have no seeded stamp in them, so all of theirs are run-time values.
 */
export const stampless = (value: unknown) =>
  JSON.parse(
    JSON.stringify(value, (_k, v) =>
      typeof v === "string" ? v.replace(ANY_STAMP, "<timestamp>") : v
    )
  );
/** The answer to a request that wrote a row: status and body, every timestamp replaced. */
export const answerOfRun = (r: Reply) => stampless(answerOf(r));

/** The nine seeded accounts and the sign-up jobseeker: eight staff roles, five jobseekers with a profile, one without. */
export const EVERYONE: Who[] = [
  ...STAFF_ROLES,
  ...JOBSEEKER_KEYS.map((k) => `js:${k}` as Who),
  "js:signup",
];

/**
 * The same request as every staff role and every jobseeker. The eight staff answers must be equal (checked, stored once
 * as `staff`); each jobseeker's answer is stored under its name, because what a jobseeker reaches depends on who they
 * are. `tidy` puts rows whose order the database leaves open into a fixed order, for storing and for comparing.
 */
export async function staffAndJobseekers(
  path: string,
  tidy: (answer: any) => any = (a) => a,
  opts: { fixedClock?: boolean } = {}
) {
  const out = async (who: Who) => {
    const r = await call(who, path, opts);
    return { status: r.status, answer: tidy(r.json ?? r.text) };
  };
  const admin = await out("admin");
  for (const role of STAFF_ROLES) {
    expect(await out(role), `${role} on ${path}`).toEqual(admin);
  }
  const jobseekers: Record<string, unknown> = {};
  for (const k of JOBSEEKER_KEYS) jobseekers[k] = await out(`js:${k}`);
  jobseekers.signup = await out("js:signup");
  return { staff: { roles: [...STAFF_ROLES], ...admin }, jobseekers };
}

/** List rows come back in the order of one column; rows with the same value may swap. Fixed: by that column, then id. */
export const byIdWithin =
  (listKey: string, groupKey?: string, desc = true) =>
  (answer: any) => {
    const rows = answer?.[listKey];
    if (!Array.isArray(rows)) return answer;
    const sorted = [...rows].sort((a, b) => {
      if (groupKey && a[groupKey] !== b[groupKey]) {
        return (a[groupKey] < b[groupKey] ? -1 : 1) * (desc ? -1 : 1);
      }
      return a.id < b.id ? -1 : 1;
    });
    return { ...answer, [listKey]: sorted };
  };

/** Timestamps and ids made at run time replaced by placeholders (the stored form of an answer). */
export const settled = (value: unknown) => settle(value) as any;

// ---- the rows the writes make, and their clean-up ---------------------------------------------------------------

const serviceKey = () => stack().serviceKey;

/** Removes, straight in the database, every timesheet a pin made (found by its note). */
export async function sweep() {
  const r = await supabase(`/rest/v1/timesheets?notes=like.${NOTE}*`, {
    method: "DELETE",
    token: serviceKey(),
    key: serviceKey(),
    headers: { Prefer: "return=minimal" },
  });
  expect(r.status, r.text).toBeLessThan(300);
}

/** The row as the database holds it (service key), or null. */
export async function rowOf(id: string) {
  const r = await supabase(`/rest/v1/timesheets?id=eq.${id}&select=*`, {
    token: serviceKey(),
    key: serviceKey(),
  });
  expect(r.status, r.text).toBe(200);
  return (r.json as any[])[0] ?? null;
}

export async function rowsWithNote(note: string) {
  const r = await supabase(
    `/rest/v1/timesheets?notes=eq.${encodeURIComponent(note)}&select=id`,
    { token: serviceKey(), key: serviceKey() }
  );
  expect(r.status, r.text).toBe(200);
  return (r.json as any[]).map((x) => x.id as string);
}

/** Sunday-to-Saturday week `n` weeks after 2024-01-07, two years before the seed's autumn 2026 weeks (a row of the seed is never in the way). */
export function weekStarting(n: number): { start: string; end: string } {
  const day = (d: number) => {
    const t = new Date(Date.UTC(2024, 0, 7 + d));
    return t.toISOString().slice(0, 10);
  };
  return { start: day(n * 7), end: day(n * 7 + 6) };
}

/** The five weekdays of a week, 8 hours each, as the entry screen sends them. */
export const eightHours = (start: string) =>
  [1, 2, 3, 4, 5].map((i) => ({
    date: new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000)
      .toISOString()
      .slice(0, 10),
    hours: 8,
  }));

export interface Body {
  [k: string]: unknown;
}

/**
 * What the entry screen sends for an ordinary 40-hour week of the Warehouse Associate position (pay 20, bill 35):
 * every required field, worked out by hand. A case overrides what it needs.
 */
export function bodyFor(
  who: JobseekerKey,
  week: { start: string; end: string },
  over: Body = {}
): Body {
  return {
    jobseeker_profile_id: PROFILE[who],
    jobseeker_user_id: JOBSEEKERS[who].id,
    position_id: POSITION.warehouse,
    week_start_date: week.start,
    week_end_date: week.end,
    daily_hours: eightHours(week.start),
    total_regular_hours: 40,
    total_overtime_hours: 0,
    regular_pay_rate: 20,
    premium_pay_rate: 0,
    overtime_pay_rate: 20,
    regular_bill_rate: 35,
    overtime_bill_rate: 35,
    total_jobseeker_pay: 800,
    total_client_bill: 1400,
    bonus_amount: 0,
    deduction_amount: 0,
    tax_amount: 0,
    notes: NOTE,
    overtime_enabled: false,
    email_sent: false,
    pay_split_segment: "single",
    line_payment_method: null,
    invoice_number: "800000",
    ...over,
  };
}

/** The lines the test server's recorders have written so far (messages it tried to send). */
export const outbound = () =>
  readFileSync(inject("outboundLog"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, any>);

export const emailsSent = () => outbound().filter((l) => l.kind === "email");

/** The notifier sends after the answer has gone: wait (up to 5 s) until `n` more messages have been recorded. */
export async function newEmails(before: number, n: number) {
  const until = Date.now() + 5000;
  while (Date.now() < until && emailsSent().length < before + n) {
    await new Promise((r) => setTimeout(r, 50));
  }
  // a short pause, so that a message that should NOT be sent has a chance to show up too
  await new Promise((r) => setTimeout(r, n === 0 ? 400 : 50));
  return emailsSent().slice(before);
}

/** What a test needs of a recorded email: who, what, and that it has a body. Never the body itself. */
export const mailOf = (m: Record<string, any>) => ({
  to: m.to,
  subject: m.subject,
  hasHtml: m.htmlLength > 0,
  hasText: m.textLength > 0,
});

let weekCounter = 0;
/** A week no other row of this file uses, and none of the seed's (September to November 2026). */
export const freshWeek = () => weekStarting(weekCounter++);

/** Makes a timesheet through the API and returns the stored row (fails the test when it is not created). */
export async function make(
  who: Who,
  jobseeker: JobseekerKey,
  over: Body = {},
  week = freshWeek()
) {
  const r = await call(who, "/api/timesheets", {
    method: "POST",
    body: bodyFor(jobseeker, week, over),
  });
  expect(r.status, r.text).toBe(201);
  return r.json.timesheet as Record<string, any>;
}

/**
 * A stored row with what differs between runs and between the roles that made it replaced, so that the rows made by
 * eight roles can be compared with each other: the id, the week, the account that made it, the stamps.
 */
export function generic(row: Record<string, any>) {
  const { id, week_start_date, week_end_date, daily_hours, ...rest } = row;
  return settled(
    stampless({
      ...rest,
      id: "<id>",
      week_start_date: "<week>",
      week_end_date: "<week>",
      daily_hours: `<${daily_hours?.length ?? 0} days>`,
      created_by_user_id: "<who>",
      updated_by_user_id: "<who>",
      version_history: (row.version_history ?? []).map((v: any) => ({
        ...v,
        created_by: "<who>",
      })),
    })
  );
}
