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
  const staffEndpoints = [
    "/api/jobseekers",
    "/api/clients",
    "/api/positions",
    "/api/users",
  ];

  for (const role of staffRoles) {
    it(`${role}: 200 on every staff endpoint`, async () => {
      const token = await tokenFor(staffEmails[role]);
      for (const path of staffEndpoints)
        expect((await server(path, { token })).status, path).toBe(200);
    });
  }

  for (const key of Object.keys(JOBSEEKERS) as Array<
    Extract<keyof typeof JOBSEEKERS, string>
  >) {
    it(`jobseeker ${key}: 403 on every staff endpoint`, async () => {
      const token = await tokenFor(jobseekerEmails[key]);
      for (const path of staffEndpoints)
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
    const tables = [
      "clients",
      "positions",
      "timesheets",
      "invoices",
      "consent_records",
      "consent_documents",
    ];
    for (const table of tables) {
      const asAnon = await supabase(`/rest/v1/${table}?select=id`);
      expect(asAnon.status, `${table} as anon`).toBe(401);
      expect(asAnon.json.code).toBe("42501");
      for (const email of [
        staffEmails.admin,
        staffEmails.recruiter,
        jobseekerEmails.sin,
      ]) {
        const r = await supabase(`/rest/v1/${table}?select=id`, {
          token: await tokenFor(email),
        });
        expect(r.status, `${table} as ${email}`).toBe(403);
        expect(r.json.code).toBe("42501");
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
      [
        "set_user_roles",
        {
          target_user_id: STAFF.admin.id,
          new_roles: ["admin"],
          changed_by: STAFF.admin.id,
        },
      ],
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
});
