// DEV-2 (inbox 16): the two public phone-code endpoints.
//   - POST /api/auth/verify-otp with a `userId` writes the phone and `phone_verified` onto that account, so it
//     needs that account's own session (before: anyone holding a valid code for any phone could do it to any id).
//   - POST /api/auth/send-verification and /verify-otp are rate limited per phone number and per address.
// The Twilio stand-in records every send and check and approves only the code 000000; no SMS is sent.
// The limit tests run on the fourth test server (3 per number and 6 per address per hour).
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it, inject } from "vitest";
import { PASSWORD, server, supabase } from "../support/api";

const GOOD_CODE = "000000";
const WRONG_CODE = "111111";

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

const log = (file: string) =>
  readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, any>);
const count = (file: string, kind: "sms" | "sms-check") =>
  log(file).filter((e) => e.kind === kind).length;
const mainLog = () => inject("outboundLog");
const limitedLog = () => inject("limitedOutboundLog");

// a number no other test uses; the digits are fresh per run
const freshNumber = () =>
  `+1555555${String(Math.floor(1000 + Math.random() * 8999))}`;

const make = async (label: string) => {
  const email = `${label}-${randomUUID().slice(0, 8)}@example.test`;
  const r = await authAdmin("POST", "", {
    email,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { user_type: "jobseeker", user_role: [] },
    user_metadata: { name: label },
  });
  expect(r.status, r.text).toBeLessThan(300);
  return { id: r.json.id as string, email };
};
const read = async (id: string) => (await authAdmin("GET", `/${id}`)).json;

let alice: { id: string; email: string };
let bob: { id: string; email: string };

beforeAll(async () => {
  alice = await make("alice");
  bob = await make("bob");
});

describe("send-verification", () => {
  it("answers 400 PHONE_REQUIRED without a number and texts nobody", async () => {
    const before = count(mainLog(), "sms");
    const r = await server("/api/auth/send-verification", {
      method: "POST",
      body: {},
    });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("PHONE_REQUIRED");
    expect(count(mainLog(), "sms")).toBe(before);
  });

  it("still works without a session (sign-up has none): one SMS to the number, written with a +", async () => {
    const number = freshNumber();
    const before = count(mainLog(), "sms");
    const r = await server("/api/auth/send-verification", {
      method: "POST",
      body: { phoneNumber: number.slice(1) }, // sign-up sends it without the +
    });
    expect(r.status, r.text).toBe(200);
    const sms = log(mainLog()).filter((e) => e.kind === "sms");
    expect(sms.length).toBe(before + 1);
    expect(sms.at(-1)?.to).toBe(number);
  });
});

describe("verify-otp", () => {
  it("without a userId needs no session and writes nothing (the sign-up check)", async () => {
    const r = await server("/api/auth/verify-otp", {
      method: "POST",
      body: { phoneNumber: freshNumber(), code: GOOD_CODE },
    });
    expect(r.status, r.text).toBe(200);
    expect(r.json.verified).toBe(true);
  });

  it("a wrong code answers 400 INVALID_CODE", async () => {
    const r = await server("/api/auth/verify-otp", {
      method: "POST",
      body: { phoneNumber: freshNumber(), code: WRONG_CODE },
    });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("INVALID_CODE");
    expect(r.json.verified).toBe(false);
  });

  it("with a userId and no session: refused, the code is not even checked, the account is untouched", async () => {
    const number = freshNumber();
    const checks = count(mainLog(), "sms-check");
    const r = await server("/api/auth/verify-otp", {
      method: "POST",
      body: { phoneNumber: number, code: GOOD_CODE, userId: alice.id },
    });
    expect(r.status).toBe(401);
    expect(count(mainLog(), "sms-check")).toBe(checks);
    const user = await read(alice.id);
    expect(user.user_metadata?.phone_verified).toBeUndefined();
    expect(user.phone || "").toBe("");
  });

  it("with a userId and a token that is not valid: refused", async () => {
    const r = await server("/api/auth/verify-otp", {
      method: "POST",
      token: "not-a-token",
      body: { phoneNumber: freshNumber(), code: GOOD_CODE, userId: alice.id },
    });
    expect(r.status).toBeGreaterThanOrEqual(401);
    expect(r.status).toBeLessThan(500);
    expect((await read(alice.id)).user_metadata?.phone_verified).toBe(
      undefined
    );
  });

  it("with another account's userId: 403 NOT_YOUR_ACCOUNT, the code is not checked, neither account changes", async () => {
    const checks = count(mainLog(), "sms-check");
    const r = await server("/api/auth/verify-otp", {
      method: "POST",
      token: await signIn(bob.email),
      body: { phoneNumber: freshNumber(), code: GOOD_CODE, userId: alice.id },
    });
    expect(r.status).toBe(403);
    expect(r.json.code).toBe("NOT_YOUR_ACCOUNT");
    expect(count(mainLog(), "sms-check")).toBe(checks);
    for (const id of [alice.id, bob.id]) {
      const user = await read(id);
      expect(user.user_metadata?.phone_verified, id).toBeUndefined();
      expect(user.phone || "", id).toBe("");
    }
  });

  it("with the account's own session: the phone is written and marked verified", async () => {
    const number = freshNumber();
    const r = await server("/api/auth/verify-otp", {
      method: "POST",
      token: await signIn(alice.email),
      body: { phoneNumber: number, code: GOOD_CODE, userId: alice.id },
    });
    expect(r.status, r.text).toBe(200);
    const user = await read(alice.id);
    expect(user.phone).toBe(number.slice(1)); // Supabase stores it without the +
    expect(user.user_metadata.phone_verified).toBe(true);
    // and nothing happened to the other account
    expect((await read(bob.id)).user_metadata?.phone_verified).toBeUndefined();
  });

  it("a wrong code with the own session writes nothing", async () => {
    const r = await server("/api/auth/verify-otp", {
      method: "POST",
      token: await signIn(bob.email),
      body: { phoneNumber: freshNumber(), code: WRONG_CODE, userId: bob.id },
    });
    expect(r.status).toBe(400);
    const user = await read(bob.id);
    expect(user.user_metadata?.phone_verified).toBeUndefined();
    expect(user.phone || "").toBe("");
  });
});

describe("rate limits (fourth server: 3 per number, 6 per address, per hour)", () => {
  const N1 = freshNumber();
  const others = new Set<string>();
  while (others.size < 2) {
    const n = freshNumber();
    if (n !== N1) others.add(n);
  }
  const [N2, N3] = [...others];
  const post = (path: string, body: Record<string, unknown>) =>
    server(path, { method: "POST", limited: true, body });
  // the same number written the way people write it
  const spaced = (n: string) =>
    `${n.slice(0, 2)} ${n.slice(2, 5)}-${n.slice(5)}`;

  it("send-verification: the 4th text to one number is refused (also when the number is written differently), then the address runs out", async () => {
    const path = "/api/auth/send-verification";
    const sent = () => count(limitedLog(), "sms");
    expect(sent()).toBe(0);
    for (let i = 0; i < 3; i++) {
      const r = await post(path, { phoneNumber: N1 });
      expect(r.status, `send ${i + 1}: ${r.text}`).toBe(200);
    }
    expect(sent()).toBe(3);

    const fourth = await post(path, { phoneNumber: N1 });
    expect(fourth.status).toBe(429);
    expect(fourth.json.code).toBe("RATE_LIMITED");
    expect(sent()).toBe(3); // nothing was sent

    // another number is not affected (address count: 5 of 6 now)
    expect((await post(path, { phoneNumber: N2 })).status).toBe(200);
    expect(sent()).toBe(4);

    // the same number with spaces and a dash is the same number
    const variant = await post(path, { phoneNumber: spaced(N1) });
    expect(variant.status).toBe(429);
    expect(sent()).toBe(4);

    // 7th request from this address: refused although N3 was never used
    const address = await post(path, { phoneNumber: N3 });
    expect(address.status).toBe(429);
    expect(address.json.code).toBe("RATE_LIMITED");
    expect(sent()).toBe(4);
  });

  it("verify-otp: the 4th check on one number is refused, then the address runs out (its own counters)", async () => {
    const path = "/api/auth/verify-otp";
    const checked = () => count(limitedLog(), "sms-check");
    expect(checked()).toBe(0);
    for (let i = 0; i < 3; i++) {
      const r = await post(path, { phoneNumber: N1, code: WRONG_CODE });
      expect(r.status, `check ${i + 1}`).toBe(400);
    }
    expect(checked()).toBe(3);

    const fourth = await post(path, { phoneNumber: N1, code: GOOD_CODE });
    expect(fourth.status).toBe(429);
    expect(fourth.json.code).toBe("RATE_LIMITED");
    expect(checked()).toBe(3); // the code was not even checked

    expect(
      (await post(path, { phoneNumber: N2, code: WRONG_CODE })).status
    ).toBe(400);
    expect(
      (await post(path, { phoneNumber: spaced(N1), code: GOOD_CODE })).status
    ).toBe(429);

    const address = await post(path, { phoneNumber: N3, code: GOOD_CODE });
    expect(address.status).toBe(429);
    expect(checked()).toBe(4);
  });
});
