// What each of the eight roles (plus the super admin) and a jobseeker gets from the real server, and what
// anyone gets from the data API directly. Pins today's behaviour; the portal docs may say less (see the report).
import { describe, expect, it } from "vitest";
import {
  JOBSEEKERS,
  jobseekerEmails,
  server,
  staffEmails,
  STAFF,
  supabase,
  tokenFor,
} from "../support/api";

const staffRoles = Object.keys(STAFF) as Array<
  Extract<keyof typeof STAFF, string>
>;
const SIN_PROFILE = "00000000-0000-4000-8000-000000000041";
const CASH_PROFILE = "00000000-0000-4000-8000-000000000042";

describe("the server's staff endpoints", () => {
  const staffEndpoints = ["/api/jobseekers", "/api/clients", "/api/positions"];
  // DEV-3 (inbox 10): the staff user list and one user's record answer only the roles whose screens use them
  // (All users and Recruiter hierarchy: ALL_USERS_ROLES, RECRUITER_HIERARCHY_ROLES). Before, every staff role got them.
  const userListRoles = ["admin", "superadmin", "recruiter_director"];

  for (const role of staffRoles) {
    it(`${role}: 200 on every staff endpoint`, async () => {
      const token = await tokenFor(staffEmails[role]);
      for (const path of staffEndpoints)
        expect((await server(path, { token })).status, path).toBe(200);
    });

    it(`${role}: ${userListRoles.includes(role) ? "200" : "403"} on the staff user list and a user's record`, async () => {
      const token = await tokenFor(staffEmails[role]);
      const expected = userListRoles.includes(role) ? 200 : 403;
      const list = await server("/api/users", { token });
      expect(list.status, "/api/users").toBe(expected);
      const one = await server(`/api/users/${STAFF.admin.id}`, { token });
      expect(one.status, "/api/users/:id").toBe(expected);
      if (expected === 403) {
        expect(list.json.users).toBeUndefined();
        expect(one.json.email).toBeUndefined();
      }
    });
  }

  // DEV-3 (inbox 53): changing someone's manager is the All users screen's write, so the same two roles only.
  // Removing the manager of a seeded account (it has none) leaves it as it was.
  for (const role of staffRoles) {
    it(`${role}: ${userListRoles.includes(role) ? "may" : "may not"} change a user's manager`, async () => {
      const token = await tokenFor(staffEmails[role]);
      const res = await server(`/api/users/${STAFF.bookkeeper.id}/manager`, {
        token,
        method: "PATCH",
        body: { managerId: null },
      });
      expect(res.status, "PATCH /api/users/:id/manager").toBe(
        userListRoles.includes(role) ? 200 : 403
      );
    });
  }

  for (const key of Object.keys(JOBSEEKERS) as Array<
    Extract<keyof typeof JOBSEEKERS, string>
  >) {
    it(`jobseeker ${key}: 403 on every staff endpoint`, async () => {
      const token = await tokenFor(jobseekerEmails[key]);
      for (const path of [...staffEndpoints, "/api/users"])
        expect((await server(path, { token })).status, path).toBe(403);
    });
  }
});

describe("endpoints every signed-in user may call", () => {
  it("settings and flags need a sign-in", async () => {
    for (const path of [
      "/api/feature-flags",
      "/api/portal-settings",
      "/api/timesheets",
      "/api/invoices",
    ]) {
      expect((await server(path)).status, path).toBe(401);
      expect(
        (await server(path, { token: await tokenFor(staffEmails.admin) }))
          .status,
        path
      ).toBe(200);
      expect(
        (await server(path, { token: await tokenFor(jobseekerEmails.sin) }))
          .status,
        path
      ).toBe(200);
    }
  });

  it("a jobseeker's timesheet list holds only their own timesheets", async () => {
    const cash = await server("/api/timesheets", {
      token: await tokenFor(jobseekerEmails.cash),
    });
    expect(cash.json.timesheets.map((t: { id: string }) => t.id)).toEqual([
      "00000000-0000-4000-8000-000000000053",
    ]);
    const admin = await server("/api/timesheets", {
      token: await tokenFor(staffEmails.admin),
    });
    expect(admin.json.timesheets.length).toBe(9);
  });

  it("a jobseeker is shown no invoices; staff see all five", async () => {
    expect(
      (
        await server("/api/invoices", {
          token: await tokenFor(jobseekerEmails.sin),
        })
      ).json.invoices
    ).toEqual([]);
    expect(
      (
        await server("/api/invoices", {
          token: await tokenFor(staffEmails.accountant_manager),
        })
      ).json.invoices
    ).toHaveLength(5);
  });
});

describe("a jobseeker's profile through the server", () => {
  it("is readable by its owner and by every staff role, and refused to another jobseeker", async () => {
    expect(
      (
        await server(`/api/jobseekers/profile/${SIN_PROFILE}`, {
          token: await tokenFor(jobseekerEmails.sin),
        })
      ).status
    ).toBe(200);
    expect(
      (
        await server(`/api/jobseekers/profile/${SIN_PROFILE}`, {
          token: await tokenFor(jobseekerEmails.cash),
        })
      ).status
    ).toBe(403);
    expect(
      (
        await server(`/api/jobseekers/profile/${CASH_PROFILE}`, {
          token: await tokenFor(jobseekerEmails.sin),
        })
      ).status
    ).toBe(403);
    for (const role of staffRoles) {
      expect(
        (
          await server(`/api/jobseekers/profile/${SIN_PROFILE}`, {
            token: await tokenFor(staffEmails[role]),
          })
        ).status,
        role
      ).toBe(200);
    }
  });
});

describe("the data API, called directly with a user's own token", () => {
  it("staff see every jobseeker profile; a jobseeker sees only their own; the anon key sees none", async () => {
    for (const role of staffRoles) {
      const r = await supabase("/rest/v1/jobseeker_profiles?select=id", {
        token: await tokenFor(staffEmails[role]),
      });
      expect(r.status, role).toBe(200);
      expect(r.json, role).toHaveLength(5);
    }
    const own = await supabase("/rest/v1/jobseeker_profiles?select=id", {
      token: await tokenFor(jobseekerEmails.hybrid),
    });
    expect(own.json).toEqual([{ id: "00000000-0000-4000-8000-000000000043" }]);
    const anon = await supabase("/rest/v1/jobseeker_profiles?select=id");
    expect(anon.json).toEqual([]);
  });

  it("the activity feed is readable by staff only (033)", async () => {
    for (const role of staffRoles) {
      const r = await supabase("/rest/v1/recent_activities?select=id", {
        token: await tokenFor(staffEmails[role]),
      });
      expect(r.json, role).toEqual([
        { id: "00000000-0000-4000-8000-000000000091" },
      ]);
    }
    expect(
      (
        await supabase("/rest/v1/recent_activities?select=id", {
          token: await tokenFor(jobseekerEmails.sin),
        })
      ).json
    ).toEqual([]);
    expect(
      (await supabase("/rest/v1/recent_activities?select=id")).json
    ).toEqual([]);
  });

  it("business tables are not readable directly by anyone: only the server reads them with the service key", async () => {
    // timesheets and invoices have no grant for the data API roles (040): refused. The others have no policy left
    // for them (040 dropped the ones that read auth.users): an empty list (they used to fail with 42501).
    const refused = ["timesheets", "invoices"];
    const empty = [
      "clients",
      "positions",
      "consent_records",
      "consent_documents",
    ];
    const callers: [string, string | undefined][] = [
      ["anon", undefined],
      ...[staffEmails.admin, staffEmails.recruiter, jobseekerEmails.sin].map(
        (e): [string, string] => [e, e]
      ),
    ];
    for (const [who, email] of callers) {
      const token = email ? await tokenFor(email) : undefined;
      for (const table of refused) {
        const r = await supabase(`/rest/v1/${table}?select=id`, { token });
        expect(r.status, `${table} as ${who}`).toBe(email ? 403 : 401);
        expect(r.json.code).toBe("42501");
      }
      for (const table of empty) {
        const r = await supabase(`/rest/v1/${table}?select=id`, { token });
        expect(r.status, `${table} as ${who}`).toBe(200);
        expect(r.json, `${table} as ${who}`).toEqual([]);
      }
    }
  });

  it("the ai_validation table is closed to the anon key", async () => {
    expect((await supabase("/rest/v1/ai_validation?select=id")).status).toBe(
      401
    );
  });

  it("server-only functions cannot be called by a signed-in user (033)", async () => {
    const token = await tokenFor(staffEmails.admin);
    for (const [fn, body] of [
      ["list_auth_users", {}],
      ["get_user_role", { user_id: STAFF.admin.id }],
      ["get_table_info", {}],
      ["test_connection", {}],
    ] as const) {
      const r = await supabase(`/rest/v1/rpc/${fn}`, {
        token,
        method: "POST",
        body,
      });
      expect([401, 403, 404], `${fn} answered ${r.status}`).toContain(r.status);
      expect(r.json.code ?? "42501", fn).toMatch(/42501|PGRST202/);
    }
  });

  it("the functions 038 dropped do not exist for anyone", async () => {
    const token = await tokenFor(staffEmails.admin);
    for (const [fn, body] of [
      ["execute_sql", { query: "select 1" }],
      [
        "set_user_roles",
        {
          target_user_id: STAFF.admin.id,
          new_roles: ["admin"],
          changed_by: STAFF.admin.id,
        },
      ],
    ] as const) {
      for (const as of [token, undefined]) {
        const r = await supabase(`/rest/v1/rpc/${fn}`, {
          token: as,
          method: "POST",
          body,
        });
        expect(r.status, `${fn} answered ${r.status}`).toBe(404);
        expect(r.json.code, fn).toBe("PGRST202");
      }
    }
  });
});
