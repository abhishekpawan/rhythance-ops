// API pins for the feature flag endpoints (server/src/routes/featureFlags.ts, five) and the portal settings endpoints
// (server/src/routes/portalSettings.ts, four), recorded on the code as it is (R-3).
//
// Who may call what, worked out from the routes, not from the answers:
//   * GET /api/feature-flags, GET /api/portal-settings: any signed-in person (jobseekers too);
//   * GET /api/portal-settings/public: anyone, no token;
//   * every other call (the two admin reads and every write): the super admin only (`requireSuperAdmin` reads the raw
//     `superadmin` role). The plain admin is refused with 403 like everyone else.
//
// Writes only touch rows this file makes itself: a flag with no stored row (`subcategory_positions`,
// `attach_handbook_to_assignment_email`) and portal settings the seed does not store (`company.address`,
// `access.staffEmailContains`). Each is put back (the stored row removed) at the end, and again in `afterAll`.
// The seeded rows (`staff_two_factor_enforced`, the eight portal settings) are never written.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { stack, supabase } from "../support/api";
import {
  as,
  everyRole,
  matrix,
  noTokenAnswers,
  pin,
  ROLES,
  STAFF_ROLES,
  type Role,
} from "./module-helpers";

const FLAGS = "api-feature-flags";
const SETTINGS = "api-portal-settings";
const SUPER: Role = "superadmin";
const NOT_SUPER = ROLES.filter((r) => r !== SUPER);

const FLAG = "subcategory_positions"; // no stored row, no settings, on by default, read by the browser
const FLAG_WITH_SETTINGS = "attach_handbook_to_assignment_email"; // no stored row, three text settings
const SEEDED_FLAG = "staff_two_factor_enforced"; // stored by the seed: never written here

const serviceDelete = async (table: string, filter: string) => {
  const s = stack();
  const r = await supabase(`/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    token: s.serviceKey,
    key: s.serviceKey,
    headers: { Prefer: "return=minimal" },
  });
  expect(r.status, r.text).toBeLessThan(300);
};

const clean = async () => {
  await serviceDelete(
    "feature_flags",
    `key=in.(${FLAG},${FLAG_WITH_SETTINGS})`
  );
  await serviceDelete(
    "portal_settings",
    "key=in.(company.address,access.staffEmailContains)"
  );
};
// (removes any row a failed earlier run left behind, straight in the database)
beforeAll(clean);
afterAll(clean);

const flagState = async (key: string) => {
  const r = await as(SUPER, "/api/feature-flags/admin");
  expect(r.status).toBe(200);
  return r.json.flags.find((f: any) => f.key === key);
};

describe("GET /api/feature-flags", () => {
  it("every signed-in account gets the same flags the browser reads", async () => {
    // worked out from the route: authenticateToken only, so all nine accounts are let in
    const m = await matrix("/api/feature-flags", ROLES);
    expect(m.refused).toEqual({});
    await pin(FLAGS, 1, "who may read the browser flags", m);
  });
  it("no token is 401, a bad token 403", async () => {
    await pin(
      FLAGS,
      2,
      "browser flags without a token",
      await noTokenAnswers("/api/feature-flags")
    );
  });
});

describe("GET /api/feature-flags/admin", () => {
  it("only the super admin sees the registry; the plain admin and everyone else get 403", async () => {
    const m = await matrix("/api/feature-flags/admin", [SUPER]);
    expect(Object.keys(m.refused).sort()).toEqual([...NOT_SUPER].sort());
    // The seeded row of staff_two_factor_enforced is rewritten by other test files (staff-data-api-session switches it
    // on and puts it back off), which leaves its "changed by" empty: who changed it last depends on the files that
    // ran before this one. Its on/off value and source stay in the stored answer; who and when do not.
    for (const flag of (m.answer.answer as any).flags) {
      if (flag.key === SEEDED_FLAG) {
        expect([flag.source, flag.enabled]).toEqual(["override", false]);
        flag.updatedByName = "<whoever changed it last>";
        flag.updatedAt = "<when>";
      }
    }
    await pin(FLAGS, 3, "admin registry by role", m);
  });
  it("no token is 401, a bad token 403", async () => {
    await pin(
      FLAGS,
      4,
      "admin registry without a token",
      await noTokenAnswers("/api/feature-flags/admin")
    );
  });
});

describe("PUT, config and DELETE of one flag (super admin)", () => {
  it("off, on, then back to the default by DELETE", async () => {
    const steps: Array<{ step: string; status: number; answer: unknown }> = [];
    const go = async (
      step: string,
      method: string,
      path: string,
      body?: unknown
    ) => {
      const r = await as(SUPER, path, { method, body });
      steps.push({ step, status: r.status, answer: r.json ?? r.text });
      return r;
    };
    // this flag's default (in the code) is on
    const before = await flagState(FLAG);
    expect([before.source, before.enabled]).toEqual(["default", true]);

    expect(
      (
        await go("switch off", "PUT", `/api/feature-flags/${FLAG}`, {
          enabled: false,
        })
      ).status
    ).toBe(200);
    const off = await flagState(FLAG);
    expect([off.source, off.enabled]).toEqual(["override", false]);
    // the browser's list carries it (clientVisible) with the new value, and a plain admin reads the same
    const seen = await as("admin", "/api/feature-flags");
    expect(seen.json.flags[FLAG]).toBe(false);
    await go(
      "switch on (a stored override that equals the default)",
      "PUT",
      `/api/feature-flags/${FLAG}`,
      { enabled: true }
    );
    const on = await flagState(FLAG);
    expect([on.source, on.enabled]).toEqual(["override", true]);
    await go("reset", "DELETE", `/api/feature-flags/${FLAG}`);
    await go(
      "reset again, nothing stored",
      "DELETE",
      `/api/feature-flags/${FLAG}`
    );
    const after = await flagState(FLAG);
    expect([after.source, after.enabled]).toEqual(["default", true]);
    await pin(FLAGS, 5, "put and delete one flag", steps);
  });

  it("refusals and validation of PUT /:key", async () => {
    const out: Record<string, { status: number; answer: unknown }> = {};
    const put = async (name: string, path: string, body: unknown) => {
      const r = await as(SUPER, path, { method: "PUT", body });
      out[name] = { status: r.status, answer: r.json ?? r.text };
    };
    await put("unknown key", "/api/feature-flags/not_a_flag", {
      enabled: true,
    });
    await put("no body", `/api/feature-flags/${FLAG}`, undefined);
    await put("enabled is text", `/api/feature-flags/${FLAG}`, {
      enabled: "true",
    });
    await put("enabled is a number", `/api/feature-flags/${FLAG}`, {
      enabled: 1,
    });
    // the unknown key is checked before the body
    await put("unknown key and bad body", "/api/feature-flags/not_a_flag", {
      enabled: "x",
    });
    expect(out["unknown key and bad body"].status).toBe(404);
    expect((await flagState(FLAG)).source).toBe("default");
    await pin(FLAGS, 6, "put validation", out);
  });

  it("nobody but the super admin may change a flag, and nothing changes", async () => {
    const out: Record<string, unknown> = {};
    for (const role of NOT_SUPER) {
      const put = await as(role, `/api/feature-flags/${FLAG}`, {
        method: "PUT",
        body: { enabled: true },
      });
      const config = await as(
        role,
        `/api/feature-flags/${FLAG_WITH_SETTINGS}/config`,
        {
          method: "PUT",
          body: { config: { bucket: "x" } },
        }
      );
      const del = await as(role, `/api/feature-flags/${SEEDED_FLAG}`, {
        method: "DELETE",
      });
      out[role] = {
        put: [put.status, put.json],
        config: [config.status, config.json],
        delete: [del.status, del.json],
      };
      expect([put.status, config.status, del.status]).toEqual([403, 403, 403]);
    }
    for (const key of [FLAG, FLAG_WITH_SETTINGS]) {
      expect((await flagState(key)).source).toBe("default");
    }
    // the seeded flag is still stored, still off
    const seeded = await flagState(SEEDED_FLAG);
    expect([seeded.source, seeded.enabled]).toEqual(["override", false]);
    await pin(FLAGS, 7, "writes by other roles", out);
  });

  it("no token and a bad token on the three writes", async () => {
    const out: Record<string, unknown> = {};
    for (const [name, method, path, body] of [
      ["put", "PUT", `/api/feature-flags/${FLAG}`, { enabled: true }],
      [
        "config",
        "PUT",
        `/api/feature-flags/${FLAG_WITH_SETTINGS}/config`,
        { config: {} },
      ],
      ["delete", "DELETE", `/api/feature-flags/${FLAG}`, undefined],
    ] as const) {
      out[name] = await noTokenAnswers(path, { method, body });
    }
    expect((await flagState(FLAG)).source).toBe("default");
    await pin(FLAGS, 8, "writes without a token", out);
  });

  it("PUT /:key/config: save, read back, empty value goes back to the default", async () => {
    const steps: Array<{ step: string; status: number; answer: unknown }> = [];
    const go = async (
      step: string,
      body: unknown,
      key = FLAG_WITH_SETTINGS
    ) => {
      const r = await as(SUPER, `/api/feature-flags/${key}/config`, {
        method: "PUT",
        body,
      });
      steps.push({ step, status: r.status, answer: r.json ?? r.text });
      return r;
    };
    await go("save two settings", {
      config: { bucket: "  pin-bucket  ", path: "pin/file.pdf" },
    });
    const saved = (await flagState(FLAG_WITH_SETTINGS)).settingValues;
    expect(saved.map((s: any) => [s.key, s.value, s.source])).toEqual([
      ["bucket", "pin-bucket", "database"],
      ["path", "pin/file.pdf", "database"],
      ["fileName", "Godspeed_Employee_Handbook_2024.pdf", "default"],
    ]);
    await go("an empty value removes it", {
      config: { bucket: "", path: "pin/file.pdf" },
    });
    await go("the on/off value is kept when settings change", {
      config: { fileName: "Pin.pdf" },
    });
    await go("an empty config clears all", { config: {} });
    expect(
      (await flagState(FLAG_WITH_SETTINGS)).settingValues.every(
        (s: any) => s.source === "default"
      )
    ).toBe(true);
    await go("unknown setting", { config: { nope: "x" } });
    await go("setting is a number", { config: { bucket: 5 } });
    await go("setting is longer than 300", {
      config: { bucket: "x".repeat(301) },
    });
    await go("setting is exactly 300", { config: { bucket: "y".repeat(300) } });
    await go("no config", {});
    await go("config is text", { config: "bucket" });
    await go("config is a list", { config: [] });
    await go("config is null", { config: null });
    await go("a flag with no settings", { config: { a: "b" } }, FLAG);
    await go("unknown flag", { config: {} }, "not_a_flag");
    await pin(FLAGS, 9, "config steps", steps);
    const r = await as(SUPER, `/api/feature-flags/${FLAG_WITH_SETTINGS}`, {
      method: "DELETE",
    });
    expect(r.status).toBe(200);
  });

  it("DELETE /:key on an unknown flag is 404", async () => {
    const r = await as(SUPER, "/api/feature-flags/not_a_flag", {
      method: "DELETE",
    });
    await pin(FLAGS, 10, "delete unknown", {
      status: r.status,
      answer: r.json,
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------

describe("GET /api/portal-settings/public", () => {
  it("anyone, with or without a token, gets only the public settings", async () => {
    const anon = await as("admin", "/api/portal-settings/public", {
      token: "anon",
    });
    const bad = await as("admin", "/api/portal-settings/public", {
      token: "bad",
    });
    const all = await everyRole("/api/portal-settings/public");
    for (const role of ROLES)
      expect(all[role]).toEqual({ status: 200, answer: anon.json });
    expect(bad.status).toBe(200);
    expect(bad.json).toEqual(anon.json);
    await pin(SETTINGS, 1, "public settings", {
      status: anon.status,
      answer: anon.json,
    });
  });
});

describe("GET /api/portal-settings", () => {
  it("every signed-in account gets every value", async () => {
    const m = await matrix("/api/portal-settings", ROLES);
    expect(m.refused).toEqual({});
    await pin(SETTINGS, 2, "all values by role", m);
  });
  it("no token is 401, a bad token 403", async () => {
    await pin(
      SETTINGS,
      3,
      "all values without a token",
      await noTokenAnswers("/api/portal-settings")
    );
  });
});

describe("GET /api/portal-settings/admin", () => {
  it("only the super admin", async () => {
    const m = await matrix("/api/portal-settings/admin", [SUPER]);
    expect(Object.keys(m.refused).sort()).toEqual([...NOT_SUPER].sort());
    await pin(SETTINGS, 4, "admin snapshot by role", m);
  });
  it("no token is 401, a bad token 403", async () => {
    await pin(
      SETTINGS,
      5,
      "admin snapshot without a token",
      await noTokenAnswers("/api/portal-settings/admin")
    );
  });
});

describe("PUT /api/portal-settings", () => {
  const put = (body: unknown, role: Role = SUPER) =>
    as(role, "/api/portal-settings", { method: "PUT", body });
  const stored = async (key: string) => {
    const r = await as(SUPER, "/api/portal-settings");
    return r.json.values[key];
  };
  // an empty value removes the stored one: the setting is then its default (the code's), not empty
  const DEFAULT_ADDRESS = "240 Humberline Dr";

  it("save, read back everywhere, and an empty value removes the stored value", async () => {
    const steps: Array<{ step: string; status: number; answer: unknown }> = [];
    const go = async (step: string, body: unknown, role: Role = SUPER) => {
      const r = await put(body, role);
      steps.push({ step, status: r.status, answer: r.json ?? r.text });
      return r;
    };
    expect(await stored("company.address")).toBe(DEFAULT_ADDRESS);
    await go("save two settings", {
      values: {
        "company.address": "  1 Pin Street  ",
        "access.staffEmailContains": "@example.test",
      },
    });
    expect(await stored("company.address")).toBe("1 Pin Street");
    // the other roles read the same new value
    for (const role of STAFF_ROLES) {
      const r = await as(role, "/api/portal-settings");
      expect(r.json.values["company.address"], role).toBe("1 Pin Street");
    }
    await go("an empty value clears one", {
      values: { "company.address": "   " },
    });
    expect(await stored("company.address")).toBe(DEFAULT_ADDRESS);
    await go("an empty object saves nothing", { values: {} });
    await go("a seeded setting is left as it is when not named", {
      values: { "access.staffEmailContains": "" },
    });
    await pin(SETTINGS, 6, "put steps", steps);
  });

  it("validation: nothing is saved when any value is refused", async () => {
    const out: Record<string, { status: number; answer: unknown }> = {};
    const go = async (name: string, body: unknown) => {
      const r = await put(body);
      out[name] = { status: r.status, answer: r.json ?? r.text };
    };
    await go("unknown key", { values: { "nope.nope": "x" } });
    await go("one good, one unknown", {
      values: { "company.address": "should not be saved", "nope.nope": "x" },
    });
    await go("a number", { values: { "company.address": 5 } });
    await go("longer than 300", {
      values: { "company.address": "x".repeat(301) },
    });
    await go("exactly 300", { values: { "company.address": "z".repeat(300) } });
    await go("no body", undefined);
    await go("no values", {});
    await go("values is text", { values: "x" });
    await go("values is a list", { values: [] });
    await go("values is null", { values: null });
    expect(out["one good, one unknown"].status).toBe(400);
    expect(out["exactly 300"].status).toBe(200);
    // exactly 300 was saved; clear it, and check the refused calls saved nothing
    expect(await stored("company.address")).toBe("z".repeat(300));
    await put({ values: { "company.address": "" } });
    expect(await stored("company.address")).toBe(DEFAULT_ADDRESS);
    await pin(SETTINGS, 7, "put validation", out);
  });

  it("nobody but the super admin may change a setting, and nothing changes", async () => {
    const out: Record<string, unknown> = {};
    for (const role of NOT_SUPER) {
      const r = await put(
        { values: { "company.address": "by " + role } },
        role
      );
      out[role] = { status: r.status, answer: r.json };
      expect(r.status).toBe(403);
    }
    expect(await stored("company.address")).toBe(DEFAULT_ADDRESS);
    out.noToken = await noTokenAnswers("/api/portal-settings", {
      method: "PUT",
      body: { values: {} },
    });
    await pin(SETTINGS, 8, "put by other roles", out);
  });
});
