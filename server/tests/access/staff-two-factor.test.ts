// Inbox 6: the two-step login for staff (admin and recruiter) is enforced by the server, not only by the
// login screen. Feature flag `staff_two_factor_enforced`: the first test server has it off (today's behaviour),
// the third test server has it forced on (see tests/support/force-flags.mjs). The phone code the Twilio
// stand-in approves is 000000. Jobseekers must not be affected in either state.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it, inject } from "vitest";
import { PASSWORD, server, staffEmails, supabase } from "../support/api";

const STAFF_ONLY_GET = "/api/clients";
const PINNED_PHONE = "+15555550111";
const ATTACKER_PHONE = "+15555550999";
const GOOD_CODE = "000000";

const pinnedEmail = `pinned-${randomUUID().slice(0, 8)}@example.test`;
const jobseekerEmail = `jobseeker-${randomUUID().slice(0, 8)}@example.test`;
const inviteeEmail = `invitee-${randomUUID().slice(0, 8)}@example.test`;
let inviteeId = "";

const authAdmin = (method: string, path: string, body?: unknown) =>
  supabase(`/auth/v1/admin/users${path}`, {
    key: inject("stack").serviceKey,
    method,
    body,
  });

const signIn = async (email: string) =>
  (
    await supabase("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email, password: PASSWORD },
    })
  ).json.access_token as string;

const outbound = () =>
  readFileSync(inject("twoFactorOutboundLog"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, any>);

const complete2fa = (
  email: string,
  body: Record<string, unknown> = {},
  twoFactor = true
) =>
  server("/api/auth/complete-2fa", {
    method: "POST",
    twoFactor,
    body: { email, password: PASSWORD, ...body },
  });

beforeAll(async () => {
  const pinned = await authAdmin("POST", "", {
    email: pinnedEmail,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: {
      user_type: "recruiter",
      user_role: ["recruiter"],
      twofa_phone: PINNED_PHONE,
    },
    user_metadata: { name: "Pinned", phoneNumber: PINNED_PHONE },
  });
  expect(pinned.status, pinned.text).toBeLessThan(300);
  // an invited recruiter who has not finished onboarding: no phone number anywhere yet
  const invitee = await authAdmin("POST", "", {
    email: inviteeEmail,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { user_type: "recruiter", user_role: ["recruiter"] },
    user_metadata: { name: "Invitee", onboarding_complete: false },
  });
  expect(invitee.status, invitee.text).toBeLessThan(300);
  inviteeId = invitee.json.id;
  // a jobseeker made like the sign-up page makes one (role in app_metadata, plus a phone in the profile)
  const jobseeker = await authAdmin("POST", "", {
    email: jobseekerEmail,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { user_type: "jobseeker", user_role: [] },
    user_metadata: { name: "Jobseeker", phoneNumber: "+15555550222" },
  });
  expect(jobseeker.status, jobseeker.text).toBeLessThan(300);
});

describe("with enforcement off (today's behaviour)", () => {
  it("a staff session from a password alone works on the API", async () => {
    const token = await signIn(staffEmails.recruiter);
    expect((await server(STAFF_ONLY_GET, { token })).status).toBe(200);
  });

  it("complete-2fa still works without a code (the old screen sends none)", async () => {
    const r = await complete2fa(staffEmails.recruiter, {}, false);
    expect(r.status, r.text).toBe(200);
    expect(r.json.session.access_token).toBeTruthy();
  });

  it("a code that is sent is checked: a wrong one gets no session", async () => {
    const r = await complete2fa(
      staffEmails.recruiter,
      { code: "111111" },
      false
    );
    expect(r.status).toBe(400);
    expect(r.json.session).toBeUndefined();
  });
});

describe("with enforcement on: staff", () => {
  it("a password alone gives a session the API refuses (401 TWO_FACTOR_REQUIRED), whatever the way in", async () => {
    for (const email of [
      staffEmails.recruiter,
      staffEmails.admin,
      pinnedEmail,
    ]) {
      const token = await signIn(email); // Supabase's own sign-in, no code
      const refused = await server(STAFF_ONLY_GET, { token, twoFactor: true });
      expect(refused.status, email).toBe(401);
      expect(refused.json.code).toBe("TWO_FACTOR_REQUIRED");
      // the same token is fine on the server that does not enforce
      expect((await server(STAFF_ONLY_GET, { token })).status).toBe(200);
    }
  });

  it("/login refuses staff and hands out no session", async () => {
    const r = await server("/api/auth/login", {
      method: "POST",
      twoFactor: true,
      body: { email: staffEmails.recruiter, password: PASSWORD },
    });
    expect(r.status).toBe(403);
    expect(r.json.session).toBeUndefined();
  });

  it("validate-credentials: no session, the code goes to the number on file, not the editable one", async () => {
    const token = await signIn(pinnedEmail);
    // the attack: the user (or anyone with the password) puts their own phone in user_metadata
    const edit = await supabase("/auth/v1/user", {
      token,
      method: "PUT",
      body: { data: { phoneNumber: ATTACKER_PHONE } },
    });
    expect(edit.status).toBe(200);
    const r = await server("/api/auth/validate-credentials", {
      method: "POST",
      twoFactor: true,
      body: { email: pinnedEmail, password: PASSWORD },
    });
    expect(r.status).toBe(200);
    expect(r.json.requiresTwoFactor).toBe(true);
    expect(r.json.session).toBeUndefined();
    expect(r.json.user.user_metadata.phoneNumber).toBe(PINNED_PHONE);
  });

  it("complete-2fa: no code, or a wrong code, gets no session; the right code does", async () => {
    const none = await complete2fa(pinnedEmail);
    expect(none.status).toBe(400);
    expect(none.json.code).toBe("TWO_FACTOR_CODE_REQUIRED");
    expect(none.json.session).toBeUndefined();

    const wrong = await complete2fa(pinnedEmail, { code: "123456" });
    expect(wrong.status).toBe(400);
    expect(wrong.json.code).toBe("INVALID_2FA_CODE");
    expect(wrong.json.session).toBeUndefined();

    const badPassword = await server("/api/auth/complete-2fa", {
      method: "POST",
      twoFactor: true,
      body: { email: pinnedEmail, password: "wrong-password", code: GOOD_CODE },
    });
    expect(badPassword.status).toBe(401); // from the password check; no code was looked at
    expect(badPassword.json.session).toBeUndefined();

    const ok = await complete2fa(pinnedEmail, { code: GOOD_CODE });
    expect(ok.status, ok.text).toBe(200);
    const token = ok.json.session.access_token as string;
    expect(
      (await server(STAFF_ONLY_GET, { token, twoFactor: true })).status
    ).toBe(200);
  });

  it("the code is checked against the number on file, never against one the user edited", () => {
    const checks = outbound().filter((e) => e.kind === "sms-check");
    expect(checks.length).toBeGreaterThan(0);
    expect(checks.every((e) => e.to !== ATTACKER_PHONE)).toBe(true);
    expect(checks.some((e) => e.to === PINNED_PHONE)).toBe(true);
  });

  it("a verified session does not make another session of the same person valid", async () => {
    const verified = await complete2fa(pinnedEmail, { code: GOOD_CODE });
    const other = await signIn(pinnedEmail);
    expect(
      (
        await server(STAFF_ONLY_GET, {
          token: verified.json.session.access_token,
          twoFactor: true,
        })
      ).status
    ).toBe(200);
    expect(
      (await server(STAFF_ONLY_GET, { token: other, twoFactor: true })).status
    ).toBe(401);
  });

  it("an account without a pinned number falls back to its profile number", async () => {
    const ok = await complete2fa(staffEmails.admin, { code: GOOD_CODE });
    expect(ok.status, ok.text).toBe(200);
    expect(
      outbound().some((e) => e.kind === "sms-check" && e.to === "+15555550100")
    ).toBe(true);
  });

  it("an invited staff member can finish onboarding with a session from a link, and that session is then accepted", async () => {
    const token = await signIn(inviteeEmail);
    expect(
      (await server(STAFF_ONLY_GET, { token, twoFactor: true })).status
    ).toBe(401);

    const done = await server("/api/auth/complete-onboarding", {
      method: "POST",
      token,
      twoFactor: true,
      body: { phoneNumber: "+15555550123" },
    });
    expect(done.status, done.text).toBe(200);
    expect(
      (await server(STAFF_ONLY_GET, { token, twoFactor: true })).status
    ).toBe(200);

    const user = (await authAdmin("GET", `/${inviteeId}`)).json;
    expect(user.app_metadata.twofa_phone).toBe("+15555550123");
    expect(user.app_metadata.user_type).toBe("recruiter"); // role untouched

    // once pinned, another password-only session cannot re-pin a different number
    const again = await signIn(inviteeEmail);
    const retry = await server("/api/auth/complete-onboarding", {
      method: "POST",
      token: again,
      twoFactor: true,
      body: { phoneNumber: ATTACKER_PHONE },
    });
    expect(retry.status).toBe(401);
    const after = (await authAdmin("GET", `/${inviteeId}`)).json;
    expect(after.app_metadata.twofa_phone).toBe("+15555550123");
  });
});

describe("with enforcement on: jobseekers are not affected", () => {
  const email = jobseekerEmail;

  it("their own sign-in token works on the API", async () => {
    const token = await signIn(email);
    expect(
      (await server("/api/auth/me", { token, twoFactor: true })).status
    ).toBe(200);
    expect((await server("/api/auth/me", { token })).status).toBe(200);
  });

  it("/login, validate-credentials and complete-2fa (no code) give a session exactly as before", async () => {
    const login = await server("/api/auth/login", {
      method: "POST",
      twoFactor: true,
      body: { email, password: PASSWORD },
    });
    expect(login.status).toBe(200);
    expect(login.json.session.access_token).toBeTruthy();

    const validate = await server("/api/auth/validate-credentials", {
      method: "POST",
      twoFactor: true,
      body: { email, password: PASSWORD },
    });
    expect(validate.status).toBe(200);
    expect(validate.json.requiresTwoFactor).toBe(false);
    expect(validate.json.session.access_token).toBeTruthy();

    const complete = await complete2fa(email);
    expect(complete.status).toBe(200);
    expect(complete.json.session.access_token).toBeTruthy();
  });

  it("a jobseeker who edits their own user_metadata to say 'recruiter' is still a jobseeker here", async () => {
    const token = await signIn(email);
    await supabase("/auth/v1/user", {
      token,
      method: "PUT",
      body: { data: { user_type: "recruiter", user_role: ["recruiter"] } },
    });
    const fresh = await signIn(email);
    expect(
      (await server("/api/auth/me", { token: fresh, twoFactor: true })).status
    ).toBe(200);
    expect(
      (await server(STAFF_ONLY_GET, { token: fresh, twoFactor: true })).status
    ).toBe(403);
    const validate = await server("/api/auth/validate-credentials", {
      method: "POST",
      twoFactor: true,
      body: { email, password: PASSWORD },
    });
    expect(validate.json.requiresTwoFactor).toBe(false);
  });
});
