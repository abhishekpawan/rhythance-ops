// Migration 040 (inbox 49): through Supabase's data API, with a user's own token,
//   - timesheets and invoices answer nobody: a jobseeker, a verified admin and a verified recruiter are refused
//     for want of a table grant on read, insert, update and delete (the own-row policies beside the old dead
//     staff policies would otherwise have let a jobseeker edit their own timesheet), and nothing changes;
//   - the eight tables whose only policies read user_metadata through auth.users (now dropped) have no policy
//     for a signed-in user left: reads return no rows and no write gets in.
// The browser never reads these tables (the server uses the service key), so this changes nothing for anyone.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, inject } from "vitest";
import {
  JOBSEEKERS,
  STAFF,
  freshToken,
  jobseekerEmails,
  staffEmails,
  supabase,
} from "../support/api";
import { expectNoGrant } from "../support/data-api";

const service = () => ({ key: inject("stack").serviceKey });
const sessionOf = (token: string) =>
  JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())
    .session_id as string;
const flag = (enabled: boolean) =>
  supabase("/rest/v1/feature_flags?on_conflict=key", {
    ...service(),
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: [{ key: "staff_two_factor_enforced", enabled }],
  });
const recordSession = (session: string, user: string) =>
  supabase("/rest/v1/staff_2fa_sessions?on_conflict=session_id", {
    ...service(),
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: [
      {
        session_id: session,
        user_id: user,
        verified_at: new Date().toISOString(),
      },
    ],
  });
/** What the table holds, read with the service key (which skips grants and row security). */
const snapshot = async (table: string) => {
  const r = await supabase(`/rest/v1/${table}?select=*`, service());
  expect(r.status, `${table}: ${r.text}`).toBe(200);
  return r.text;
};

const sessions: string[] = [];
let callers: { who: string; token: string }[] = [];

beforeAll(async () => {
  // staff are checked with the two-step rule on and a verified sign-in, so the grant is all that stops them
  expect((await flag(true)).status).toBeLessThan(300);
  const admin = await freshToken(staffEmails.admin);
  const recruiter = await freshToken(staffEmails.recruiter);
  for (const [token, id] of [
    [admin, STAFF.admin.id],
    [recruiter, STAFF.recruiter.id],
  ]) {
    sessions.push(sessionOf(token));
    expect((await recordSession(sessionOf(token), id)).status).toBeLessThan(
      300
    );
  }
  callers = [
    { who: "verified admin", token: admin },
    { who: "verified recruiter", token: recruiter },
    { who: "jobseeker", token: await freshToken(jobseekerEmails.sin) },
  ];
});

afterAll(async () => {
  for (const s of sessions) {
    await supabase(`/rest/v1/staff_2fa_sessions?session_id=eq.${s}`, {
      ...service(),
      method: "DELETE",
    });
  }
  await flag(false);
});

const ret = { Prefer: "return=representation" };

describe("timesheets and invoices are closed to the data API", () => {
  for (const table of ["timesheets", "invoices"]) {
    it(`${table}: read, insert, update and delete are refused for a jobseeker, a verified admin and a verified recruiter, and nothing changes`, async () => {
      const before = await snapshot(table);
      for (const { who, token } of callers) {
        const calls: [string, string, unknown][] = [
          ["GET", `/rest/v1/${table}?select=id&limit=1`, undefined],
          ["POST", `/rest/v1/${table}`, { id: randomUUID() }],
          ["PATCH", `/rest/v1/${table}?id=not.is.null`, { notes: "changed" }],
          ["DELETE", `/rest/v1/${table}?id=not.is.null`, undefined],
        ];
        for (const [method, path, body] of calls) {
          const r = await supabase(path, { token, method, headers: ret, body });
          expectNoGrant(r, table, `${who} ${method} ${table}`);
        }
      }
      expect(await snapshot(table)).toBe(before);
    });
  }

  it("a jobseeker cannot change the pay rate of their own timesheet (the case that made the grant necessary)", async () => {
    const jobseeker = callers[2].token;
    const before = await snapshot("timesheets");
    const own = JSON.parse(before).find(
      (t: { jobseeker_user_id: string }) =>
        t.jobseeker_user_id === JOBSEEKERS.sin.id
    );
    expect(own, "the seed has a timesheet of this jobseeker").toBeDefined();
    const r = await supabase(`/rest/v1/timesheets?id=eq.${own.id}`, {
      token: jobseeker,
      method: "PATCH",
      headers: ret,
      body: { regular_pay_rate: 999, total_jobseeker_pay: 99999 },
    });
    expectNoGrant(r, "timesheets", "jobseeker edits their own timesheet");
    expect(await snapshot("timesheets")).toBe(before);
  });
});

describe("the tables whose staff policies read auth.users answer nobody", () => {
  const CLOSED = [
    "clients",
    "positions",
    "position_candidate_assignments",
    "consent_records",
    "consent_documents",
    "consent_document_templates",
    "client_dropdown_options",
    "email_checkpoint",
  ];
  for (const table of CLOSED) {
    it(`${table}: no rows for a jobseeker, a verified admin or a verified recruiter, no write gets in`, async () => {
      const before = await snapshot(table);
      for (const { who, token } of callers) {
        const read = await supabase(`/rest/v1/${table}?select=*&limit=5`, {
          token,
        });
        expect(read.status, `${who} reads ${table}: ${read.text}`).toBe(200);
        expect(read.json, `${who} reads ${table}`).toEqual([]);
        const insert = await supabase(`/rest/v1/${table}`, {
          token,
          method: "POST",
          headers: ret,
          body: {},
        });
        expect([401, 403], `${who} inserts ${table}: ${insert.text}`).toContain(
          insert.status
        );
        for (const method of ["PATCH", "DELETE"]) {
          const r = await supabase(`/rest/v1/${table}?id=not.is.null`, {
            token,
            method,
            headers: ret,
            ...(method === "PATCH" ? { body: { created_at: null } } : {}),
          });
          const changed = r.status < 300 ? ((r.json as unknown[]) ?? []) : [];
          expect(changed, `${who} ${method} ${table}: ${r.text}`).toEqual([]);
        }
      }
      expect(await snapshot(table)).toBe(before);
    });
  }
});
