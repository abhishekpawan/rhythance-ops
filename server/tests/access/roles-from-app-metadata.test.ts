// SEC-1: the role is decided from app_metadata, which only the server can write. user_metadata can be edited
// by the user (PUT /auth/v1/user), so it decides nothing. Checked against the real server and directly
// against the local Supabase, with each user's own token.
import { describe, expect, it } from "vitest";
import {
  freshToken,
  jobseekerEmails,
  server,
  signupEmail,
  staffEmails,
  supabase,
  tokenFor,
  JOBSEEKERS,
} from "../support/api";

const SIN_PROFILE = "00000000-0000-4000-8000-000000000041";
const STAFF_ONLY_GET = [
  "/api/clients",
  "/api/jobseekers",
  "/api/positions",
  "/api/users",
  `/api/jobseekers/profile/${SIN_PROFILE}`,
];

const rpc = async (name: string, token: string) =>
  (await supabase(`/rest/v1/rpc/${name}`, { token, method: "POST", body: {} }))
    .json;
const me = async (token: string) =>
  (await supabase("/auth/v1/user", { token })).json;
const editOwnMetadata = (token: string, body: unknown) =>
  supabase("/auth/v1/user", { token, method: "PUT", body });

describe("a jobseeker who edits their own user_metadata to admin", () => {
  let before: string;
  let after: string;

  it("can make the edit (the attack is real) but the role in app_metadata does not change", async () => {
    before = await tokenFor(jobseekerEmails.cash);
    const edit = await editOwnMetadata(before, {
      data: { user_type: "admin", user_role: ["admin", "superadmin"] },
    });
    expect(edit.status).toBe(200);
    expect(edit.json.user_metadata).toMatchObject({
      user_type: "admin",
      user_role: ["admin", "superadmin"],
    });
    after = await freshToken(jobseekerEmails.cash);
    const user = await me(after);
    expect(user.user_metadata.user_type).toBe("admin");
    expect(user.app_metadata).toMatchObject({
      user_type: "jobseeker",
      user_role: [],
    });
  });

  it.each(STAFF_ONLY_GET)(
    "is still refused by the server on %s (403)",
    async (path) => {
      for (const token of [before, after]) {
        const r = await server(path, { token });
        expect(r.status).toBe(403);
      }
    }
  );

  it("is still refused when writing as staff (403)", async () => {
    expect(
      (await server("/api/clients", { token: after, method: "POST", body: {} }))
        .status
    ).toBe(403);
    expect(
      (
        await server("/api/feature-flags/subcategory_positions", {
          token: after,
          method: "PUT",
          body: { enabled: true },
        })
      ).status
    ).toBe(403);
  });

  it("is still a jobseeker to the database's own role helpers", async () => {
    expect(await rpc("is_admin", after)).toBe(false);
    expect(await rpc("is_recruiter", after)).toBe(false);
    expect(await rpc("is_jobseeker", after)).toBe(true);
  });

  it("sees only their own profile through the data API, never the others", async () => {
    const r = await supabase("/rest/v1/jobseeker_profiles?select=id,user_id", {
      token: after,
    });
    expect(r.status).toBe(200);
    expect(r.json).toEqual([
      {
        id: "00000000-0000-4000-8000-000000000042",
        user_id: JOBSEEKERS.cash.id,
      },
    ]);
  });

  it("does not see the activity feed, which has a row staff can read", async () => {
    const r = await supabase("/rest/v1/recent_activities?select=id", {
      token: after,
    });
    expect(r.status).toBe(200);
    expect(r.json).toEqual([]);
  });
});

describe("a user cannot grant themselves a role through the auth API", () => {
  it("app_metadata sent with the user's own token is ignored or refused, and the role does not change", async () => {
    const token = await freshToken(jobseekerEmails.corp);
    const edit = await editOwnMetadata(token, {
      app_metadata: { user_type: "admin", user_role: ["admin"] },
    });
    const user = await me(await freshToken(jobseekerEmails.corp));
    expect(user.app_metadata).toMatchObject({
      user_type: "jobseeker",
      user_role: [],
    });
    expect(
      (
        await server("/api/clients", {
          token: await freshToken(jobseekerEmails.corp),
        })
      ).status
    ).toBe(403);
    // whatever the auth API answered, it must not have been a success that changed the role
    expect([200, 400, 401, 403, 422]).toContain(edit.status);
  });
});

describe("the reverse: staff whose user_metadata says jobseeker keep their role", () => {
  it("a bookkeeper who edits their user_metadata to jobseeker is still staff", async () => {
    const token = await tokenFor(staffEmails.bookkeeper);
    expect(
      (
        await editOwnMetadata(token, {
          data: { user_type: "jobseeker", user_role: [] },
        })
      ).status
    ).toBe(200);
    const after = await freshToken(staffEmails.bookkeeper);
    expect((await me(after)).user_metadata.user_type).toBe("jobseeker");
    expect((await server("/api/jobseekers", { token: after })).status).toBe(
      200
    );
    expect((await server("/api/clients", { token: after })).status).toBe(200);
    expect(await rpc("is_recruiter", after)).toBe(true);
    expect(await rpc("is_jobseeker", after)).toBe(false);
  });
});

describe("a new account made through open sign-up", () => {
  it("is a jobseeker (the default-role trigger from 034) and has no staff access", async () => {
    const token = await tokenFor(signupEmail);
    const user = await me(token);
    expect(user.app_metadata).toMatchObject({
      user_type: "jobseeker",
      user_role: [],
    });
    expect(await rpc("is_jobseeker", token)).toBe(true);
    expect(await rpc("is_admin", token)).toBe(false);
    for (const path of STAFF_ONLY_GET)
      expect((await server(path, { token })).status).toBe(403);
  });
});

describe("without a valid sign-in", () => {
  it.each(STAFF_ONLY_GET)(
    "%s answers 401 with no token and 403 with a bad one",
    async (path) => {
      expect((await server(path)).status).toBe(401);
      expect((await server(path, { token: "not-a-token" })).status).toBe(403);
    }
  );

  it("the anon key alone is not a sign-in", async () => {
    const r = await server("/api/jobseekers", {
      token: (await import("../support/api")).stack().anonKey,
    });
    expect(r.status).toBe(403);
  });
});
