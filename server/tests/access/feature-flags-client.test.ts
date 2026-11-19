// DEV-2: GET /api/feature-flags sends the browser only the flags it reads (marked `clientVisible` in the
// registry). Server-only flags stay on the server; the super-admin page (/admin) still lists everything.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FEATURE_FLAGS, PORTALS } from "../../src/config/featureFlags";
import {
  freshToken,
  jobseekerEmails,
  server,
  staffEmails,
  tokenFor,
} from "../support/api";

const READ_BY_THE_BROWSER = [
  "ai_chat",
  "hide_jobseeker_pay_rate",
  "jobseeker_payroll_summary",
  "jobseeker_profile_godspeed_rules",
  "subcategory_positions",
];
const SERVER_ONLY = [
  "attach_handbook_to_assignment_email",
  "staff_two_factor_enforced",
];

describe("GET /api/feature-flags", () => {
  for (const [label, email] of [
    ["a jobseeker", jobseekerEmails.sin],
    ["an admin", staffEmails.admin],
    ["a recruiter", staffEmails.recruiter],
  ] as const) {
    it(`${label} gets only the flags the browser reads`, async () => {
      const r = await server("/api/feature-flags", {
        token: await tokenFor(email),
      });
      expect(r.status).toBe(200);
      expect(Object.keys(r.json.flags).sort()).toEqual(READ_BY_THE_BROWSER);
      for (const value of Object.values(r.json.flags)) {
        expect(typeof value).toBe("boolean");
      }
      for (const key of SERVER_ONLY)
        expect(r.json.flags).not.toHaveProperty(key);
    });
  }

  it("needs a sign-in", async () => {
    expect((await server("/api/feature-flags")).status).toBe(401);
  });

  it("the super-admin page still lists every flag, server-only ones included", async () => {
    const r = await server("/api/feature-flags/admin", {
      token: await freshToken(staffEmails.superadmin),
    });
    expect(r.status, r.text).toBe(200);
    const keys = r.json.flags.map((f: { key: string }) => f.key);
    expect(keys).toEqual(expect.arrayContaining(SERVER_ONLY));
    expect(keys.sort()).toEqual(FEATURE_FLAGS.map((f) => f.key).sort());
  });
});

describe("the registry", () => {
  it("marks exactly the flags the browser reads (unmarked is the default for a new flag)", () => {
    expect(
      FEATURE_FLAGS.filter((f) => f.clientVisible)
        .map((f) => f.key)
        .sort()
    ).toEqual(READ_BY_THE_BROWSER);
  });

  it("every flag the client source reads is marked, so a new one cannot be forgotten", () => {
    const clientSrc = path.resolve(__dirname, "../../../client/src");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name)) files.push(full);
      }
    };
    walk(clientSrc);
    const read = new Set<string>();
    for (const file of files) {
      // not the examples in comments
      const text = readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join("\n");
      for (const m of text.matchAll(/useFeatureFlag\(\s*["']([a-z0-9_]+)["']/g))
        read.add(m[1]);
      for (const m of text.matchAll(
        /<FeatureGate\s+flag=["']([a-z0-9_]+)["']/g
      ))
        read.add(m[1]);
    }
    expect([...read].sort()).toEqual(READ_BY_THE_BROWSER);
  });

  it("the staff two-step login is on by default and intended on for all four portals", () => {
    const flag = FEATURE_FLAGS.find(
      (f) => f.key === "staff_two_factor_enforced"
    );
    expect(flag?.defaultEnabled).toBe(true);
    for (const portal of PORTALS) expect(flag?.intended[portal.id]).toBe(true);
  });
});
