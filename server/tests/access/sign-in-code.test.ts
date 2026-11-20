// DEV-4 (inbox 28): the sign-in phone code is sent only after the email and password check out, and only to
// the number on file. Before, the two-step screen asked the public `send-verification` (any number, shared
// per-number limit), so anyone who knew a staff number could use up its sends and delay that person's sign-in.
// Runs on the third test server (two-step login enforced). The Twilio stand-in records every send and approves
// only the code 000000; no SMS leaves the machine.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it, inject } from "vitest";
import { PASSWORD, server, supabase } from "../support/api";

const SEND = "/api/auth/send-sign-in-code";
const GOOD_CODE = "000000";

const authAdmin = (method: string, path: string, body?: unknown) =>
  supabase(`/auth/v1/admin/users${path}`, {
    key: inject("stack").serviceKey,
    method,
    body,
  });

const sent = () =>
  readFileSync(inject("twoFactorOutboundLog"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, any>)
    .filter((e) => e.kind === "sms");
const sentTo = (phone: string) => sent().filter((e) => e.to === phone).length;

// numbers no other test uses; the digits are fresh per run
const freshNumber = () =>
  `+1555556${String(Math.floor(1000 + Math.random() * 8999))}`;

const make = async (
  label: string,
  type: "recruiter" | "jobseeker",
  phone?: string,
  profilePhone?: string
) => {
  const email = `${label}-${randomUUID().slice(0, 8)}@example.test`;
  const r = await authAdmin("POST", "", {
    email,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: {
      user_type: type,
      user_role: type === "recruiter" ? ["recruiter"] : [],
      ...(phone ? { twofa_phone: phone } : {}),
    },
    user_metadata: {
      name: label,
      ...(profilePhone ? { phoneNumber: profilePhone } : {}),
    },
  });
  expect(r.status, r.text).toBeLessThan(300);
  return { id: r.json.id as string, email };
};

const ask = (body: Record<string, unknown>) =>
  server(SEND, { method: "POST", twoFactor: true, body });

let victimPhone = "";
let victim: { id: string; email: string };
let limited: { id: string; email: string };
let limitedPhone = "";

beforeAll(async () => {
  victimPhone = freshNumber();
  victim = await make("victim", "recruiter", victimPhone);
  limitedPhone = freshNumber();
  limited = await make("limited", "recruiter", limitedPhone);
});

describe("send-sign-in-code", () => {
  it("needs an email and a password, and texts nobody without them", async () => {
    const before = sent().length;
    const r = await ask({ email: victim.email });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("EMAIL_AND_PASSWORD_REQUIRED");
    expect(sent().length).toBe(before);
  });

  it("a wrong password gets 401 INVALID_CREDENTIALS and no text, even with the right number in the body", async () => {
    const before = sent().length;
    const r = await ask({
      email: victim.email,
      password: "not-the-password",
      phoneNumber: victimPhone,
    });
    expect(r.status).toBe(401);
    expect(r.json.code).toBe("INVALID_CREDENTIALS");
    expect(sent().length).toBe(before);
  });

  it("with the right password it texts the number on file, whatever number the caller names", async () => {
    const attacker = freshNumber();
    const r = await ask({
      email: victim.email,
      password: PASSWORD,
      phoneNumber: attacker,
    });
    expect(r.status, r.text).toBe(200);
    expect(sentTo(victimPhone)).toBe(1);
    expect(sentTo(attacker)).toBe(0);
  });

  it("asking for a code does not sign the account out elsewhere (another device, a sign-in that just finished)", async () => {
    const other = await make("other-device", "recruiter", freshNumber());
    const token = (
      await supabase("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: { email: other.email, password: PASSWORD },
      })
    ).json.access_token as string;
    const before = await supabase("/auth/v1/user", { token });
    expect(before.status).toBe(200);
    const r = await ask({ email: other.email, password: PASSWORD });
    expect(r.status, r.text).toBe(200);
    expect((await supabase("/auth/v1/user", { token })).status).toBe(200);
  });

  it("the code it sends completes the sign-in", async () => {
    const r = await server("/api/auth/complete-2fa", {
      method: "POST",
      twoFactor: true,
      body: { email: victim.email, password: PASSWORD, code: GOOD_CODE },
    });
    expect(r.status, r.text).toBe(200);
    expect(r.json.session.access_token).toBeTruthy();
  });

  it("an account that does not use a code (a jobseeker) gets no text, so the route cannot text anyone's profile number", async () => {
    const profilePhone = freshNumber();
    const seeker = await make("seeker", "jobseeker", undefined, profilePhone);
    const r = await ask({ email: seeker.email, password: PASSWORD });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("TWO_FACTOR_NOT_REQUIRED");
    expect(sentTo(profilePhone)).toBe(0);
  });

  it("a staff account with no number on file gets 400 NO_2FA_PHONE and no text", async () => {
    const before = sent().length;
    const bare = await make("bare", "recruiter");
    const r = await ask({ email: bare.email, password: PASSWORD });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("NO_2FA_PHONE");
    expect(sent().length).toBe(before);
  });
});

describe("someone who knows only the number or the email cannot use up the sign-in codes", () => {
  it("using up the public per-number limit does not stop the sign-in code", async () => {
    // the public endpoint allows 8 sends per number per hour on this server: use them all
    let last = 0;
    for (let i = 0; i < 9; i++) {
      last = (
        await server("/api/auth/send-verification", {
          method: "POST",
          twoFactor: true,
          body: { phoneNumber: limitedPhone },
        })
      ).status;
    }
    expect(last).toBe(429);
    const r = await ask({ email: limited.email, password: PASSWORD });
    expect(r.status, r.text).toBe(200);
  });

  it("wrong-password tries with the email do not count against the account", async () => {
    for (let i = 0; i < 12; i++) {
      expect(
        (await ask({ email: limited.email, password: "guess" })).status
      ).toBe(401);
    }
    const r = await ask({ email: limited.email, password: PASSWORD });
    expect(r.status, r.text).toBe(200);
  });

  it("the account itself is limited: after 8 real sends in the hour the next is 429 RATE_LIMITED and nothing is sent", async () => {
    // 2 sends already used by the two tests above
    for (let i = 0; i < 6; i++) {
      expect(
        (await ask({ email: limited.email, password: PASSWORD })).status
      ).toBe(200);
    }
    const before = sentTo(limitedPhone);
    const r = await ask({ email: limited.email, password: PASSWORD });
    expect(r.status).toBe(429);
    expect(r.json.code).toBe("RATE_LIMITED");
    expect(sentTo(limitedPhone)).toBe(before);
    // another account is not affected
    expect(
      (await ask({ email: victim.email, password: PASSWORD })).status
    ).toBe(200);
  });
});

describe("while the server does not enforce the code (the demo databases)", () => {
  const mainSent = () =>
    readFileSync(inject("outboundLog"), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Record<string, any>)
      .filter((e) => e.kind === "sms");

  it("a staff account still gets its code (the screen asks for one), a jobseeker still does not", async () => {
    const phone = freshNumber();
    const staff = await make("demo-staff", "recruiter", phone);
    const seeker = await make("demo-seeker", "jobseeker", undefined, phone);
    const ok = await server(SEND, {
      method: "POST",
      body: { email: staff.email, password: PASSWORD },
    });
    expect(ok.status, ok.text).toBe(200);
    expect(mainSent().filter((e) => e.to === phone).length).toBe(1);
    const no = await server(SEND, {
      method: "POST",
      body: { email: seeker.email, password: PASSWORD },
    });
    expect(no.status).toBe(400);
    expect(mainSent().filter((e) => e.to === phone).length).toBe(1);
  });
});
