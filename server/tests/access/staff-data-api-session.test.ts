// DEV-4 (inbox 30): the database's own staff checks.
//   - With the two-step login enforced, a staff password alone must not open the data API (PostgREST and storage)
//     as that staff user; a session whose phone code the server verified must.
//   - Nobody becomes staff by editing their own user_metadata (the helpers read app_metadata).
//   - The tables whose old policies read user_metadata through auth.users (migration 040, inbox 49) answer nobody
//     through the data API: see data-api-closed-tables.test.ts.
// The checks call Supabase's data API with a user's own token, the way a browser (or an attacker) does. The
// enforcement flag is a row in the test database; this file switches it on and puts it back off (the test seed
// stores it off, like stage) when it ends. Files run one at a time, so no other file sees it on.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, inject } from "vitest";
import {
  FILES,
  JOBSEEKERS,
  STAFF,
  freshToken,
  jobseekerEmails,
  staffEmails,
  supabase,
} from "../support/api";
import { PROFILES } from "../seed/ids.mjs";
import { expectReadRefused } from "../support/data-api";
import { rolledBack } from "../support/rolled-back";

const service = () => ({ key: inject("stack").serviceKey });
const OTHER_USER = "00000000-0000-4000-8000-0000000000aa";

const flag = (enabled: boolean) =>
  supabase("/rest/v1/feature_flags?on_conflict=key", {
    ...service(),
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: [{ key: "staff_two_factor_enforced", enabled }],
  });
const sessionOf = (token: string) =>
  JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())
    .session_id as string;
const record = (session: string, user: string, daysAgo = 0) =>
  supabase("/rest/v1/staff_2fa_sessions?on_conflict=session_id", {
    ...service(),
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: [
      {
        session_id: session,
        user_id: user,
        verified_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
      },
    ],
  });
const unrecord = (session: string) =>
  supabase(`/rest/v1/staff_2fa_sessions?session_id=eq.${session}`, {
    ...service(),
    method: "DELETE",
  });

/** Rows of a table the data API shows this token (row security applies); an error counts as no rows. */
const visible = async (table: string, token: string) => {
  const r = await supabase(`/rest/v1/${table}?select=id&limit=5`, { token });
  return r.status === 200 ? (r.json as unknown[]).length : 0;
};
/** Profiles the staff rule shows (a jobseeker sees only their own, so a staff view is more than one). */
const profiles = (token: string) => visible("jobseeker_profiles", token);
/** Files of the staff-only prefix the storage rule shows. */
const files = async (token: string) => {
  const r = await supabase("/storage/v1/object/list/consent-documents", {
    token,
    method: "POST",
    body: { prefix: "filled-consents", limit: 5 },
  });
  expect(r.status, r.text).toBe(200);
  return (r.json as unknown[]).length;
};
const documents = async (token: string) => {
  const r = await supabase("/storage/v1/object/list/jobseeker-documents", {
    token,
    method: "POST",
    body: { prefix: JOBSEEKER_FOLDER, limit: 5 },
  });
  expect(r.status, r.text).toBe(200);
  return (r.json as unknown[]).length;
};
const verificationOf = async (id: string) =>
  (
    await supabase(
      `/rest/v1/jobseeker_profiles?id=eq.${id}&select=verification_status`,
      { ...service() }
    )
  ).json[0].verification_status as string;
const JOBSEEKER_FOLDER = FILES.sinDocument.name.split("/")[0];

const adminId = STAFF.admin.id;
const recruiterId = STAFF.recruiter.id;

afterAll(async () => {
  await flag(false);
});

describe("with the flag off (the demo databases)", () => {
  it("a staff password alone still works on the data API and storage, as before", async () => {
    expect((await flag(false)).status).toBeLessThan(300);
    const token = await freshToken(staffEmails.recruiter);
    expect(await profiles(token)).toBeGreaterThan(1);
    expect(await files(token)).toBeGreaterThan(0);
    expect(await documents(token)).toBeGreaterThan(0);
  });
});

describe("with the flag on: staff", () => {
  beforeAll(async () => {
    expect((await flag(true)).status).toBeLessThan(300);
  });

  it("a password alone sees no profiles and no staff-only files, as admin and as recruiter", async () => {
    for (const email of [staffEmails.admin, staffEmails.recruiter]) {
      const token = await freshToken(email); // Supabase's own sign-in, no phone code
      expect(await profiles(token), email).toBe(0);
      expect(await files(token), email).toBe(0);
      expect(await documents(token), email).toBe(0);
    }
  });

  it("a password alone cannot change a profile's verification status", async () => {
    const token = await freshToken(staffEmails.recruiter);
    const before = await verificationOf(PROFILES.sin);
    const r = await supabase(
      `/rest/v1/jobseeker_profiles?id=eq.${PROFILES.sin}`,
      {
        token,
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: { verification_status: "verified-by-password-only" },
      }
    );
    expect(r.status).toBeLessThan(500);
    expect(r.json).toEqual([]); // row security hides the row from the update
    expect(await verificationOf(PROFILES.sin)).toBe(before);
  });

  it("a session whose phone code the server verified sees what it saw before", async () => {
    for (const [email, id] of [
      [staffEmails.admin, adminId],
      [staffEmails.recruiter, recruiterId],
    ] as const) {
      const token = await freshToken(email);
      expect((await record(sessionOf(token), id)).status).toBeLessThan(300);
      try {
        expect(await profiles(token), email).toBeGreaterThan(1);
        expect(await files(token), email).toBeGreaterThan(0);
        expect(await documents(token), email).toBeGreaterThan(0);
      } finally {
        await unrecord(sessionOf(token));
      }
    }
  });

  it("a verified staff session can change the verification status", async () => {
    const token = await freshToken(staffEmails.recruiter);
    await record(sessionOf(token), recruiterId);
    const before = await verificationOf(PROFILES.sin);
    try {
      const r = await supabase(
        `/rest/v1/jobseeker_profiles?id=eq.${PROFILES.sin}`,
        {
          token,
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: { verification_status: before },
        }
      );
      expect(r.status, r.text).toBeLessThan(300);
      expect((r.json as unknown[]).length).toBe(1);
    } finally {
      await unrecord(sessionOf(token));
    }
  });

  it("a session recorded for someone else, or older than 90 days, does not count", async () => {
    const token = await freshToken(staffEmails.recruiter);
    const session = sessionOf(token);
    try {
      await record(session, OTHER_USER);
      expect(await profiles(token)).toBe(0);
      await record(session, recruiterId, 100);
      expect(await profiles(token)).toBe(0);
      await record(session, recruiterId, 89);
      expect(await profiles(token)).toBeGreaterThan(1);
    } finally {
      await unrecord(session);
    }
  });

  it("a second sign-in of a verified account is its own session: it needs its own code", async () => {
    const first = await freshToken(staffEmails.recruiter);
    const second = await freshToken(staffEmails.recruiter);
    try {
      await record(sessionOf(first), recruiterId);
      expect(await profiles(first)).toBeGreaterThan(1);
      expect(await profiles(second)).toBe(0);
    } finally {
      await unrecord(sessionOf(first));
    }
  });

  it("the role helpers themselves: is_admin, is_recruiter, has_user_role and has_scope follow the same rule", () => {
    const claims = (session: string, user: string) =>
      `select set_config('request.jwt.claims', '{"sub":"${user}","role":"authenticated","session_id":"${session}"}', true)`;
    const query =
      "select public.is_admin(), public.is_recruiter(), public.has_user_role('recruiter'), public.has_scope('anything')";
    const without = rolledBack(`${claims(randomUUID(), adminId)}; ${query};`);
    expect(without.trim().split("\n").at(-1)).toBe("f|f|f|f");
    const verified = randomUUID();
    const withSession = rolledBack(
      `insert into public.staff_2fa_sessions (session_id, user_id) values ('${verified}', '${adminId}');
       ${claims(verified, adminId)}; ${query};`
    );
    expect(withSession.trim().split("\n").at(-1)).toBe("t|t|t|t");
  });

  it("is_jobseeker is unchanged: a jobseeker needs no session, and is neither admin nor recruiter", () => {
    const out = rolledBack(
      `update public.feature_flags set enabled = true where key = 'staff_two_factor_enforced';
       select set_config('request.jwt.claims', '{"sub":"${JOBSEEKERS.sin.id}","role":"authenticated","session_id":"${randomUUID()}"}', true);
       select public.is_jobseeker(), public.is_admin(), public.is_recruiter(), public.has_role('jobseeker');`
    );
    expect(out.trim().split("\n").at(-1)).toBe("t|f|f|t");
  });
});

describe("jobseekers are untouched by the two-step rule", () => {
  beforeAll(async () => {
    expect((await flag(true)).status).toBeLessThan(300);
  });

  it("a jobseeker's password session still reads their own profile and sees no staff data", async () => {
    const token = await freshToken(jobseekerEmails.sin);
    expect(await profiles(token)).toBe(1);
    expect(await files(token)).toBe(0);
    expect(await documents(token)).toBeGreaterThan(0); // their own folder
    for (const table of ["clients", "positions"]) {
      expect(await visible(table, token), table).toBe(0);
    }
    await expectReadRefused("timesheets", token, "jobseeker");
  });
});

describe("nobody becomes staff by editing their own profile fields", () => {
  const edit = async (email: string, data: Record<string, unknown>) => {
    const token = await freshToken(email);
    const put = await supabase("/auth/v1/user", {
      token,
      method: "PUT",
      body: { data },
    });
    expect(put.status, put.text).toBeLessThan(300);
    return freshToken(email); // a token carries the metadata it was issued with
  };

  for (const enforced of [false, true]) {
    it(`a jobseeker who writes user_type admin into their own metadata still sees no staff data (flag ${enforced ? "on" : "off"})`, async () => {
      expect((await flag(enforced)).status).toBeLessThan(300);
      const email = jobseekerEmails.cash;
      const token = await edit(email, {
        user_type: "admin",
        role: "admin",
        user_role: ["admin"],
      });
      try {
        expect(await profiles(token)).toBe(1); // only their own
        expect(await files(token)).toBe(0);
        for (const table of ["clients", "positions"]) {
          expect(await visible(table, token), table).toBe(0);
        }
        await expectReadRefused("timesheets", token, "jobseeker");
      } finally {
        await edit(email, {
          user_type: "jobseeker",
          role: null,
          user_role: [],
        });
        await flag(false);
      }
    });
  }
});
