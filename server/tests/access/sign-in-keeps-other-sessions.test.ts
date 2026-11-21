// DEV-3 (inbox 52): the sign-in routes open a throwaway session to check the password and end it again. Ending
// it with the default (global) sign-out also ended every other session of that account, so anyone who knew a
// staff password could log the person out on every device by trying to sign in. Each route below must end only
// its own throwaway session. Runs on the third test server (two-step login enforced): the code the Twilio
// stand-in approves is 000000, nothing is sent.
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, inject } from "vitest";
import { PASSWORD, server, supabase } from "../support/api";

const email = `device-${randomUUID().slice(0, 8)}@example.test`;

const grant = async () =>
  (
    await supabase("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: { email, password: PASSWORD },
    })
  ).json as { access_token: string; refresh_token: string };

const stillSignedIn = async (token: string) =>
  (await supabase("/auth/v1/user", { token })).status === 200;

const post = (path: string, body: Record<string, unknown>) =>
  server(`/api/auth/${path}`, {
    method: "POST",
    twoFactor: true,
    body: { email, password: PASSWORD, ...body },
  });

beforeAll(async () => {
  const made = await supabase("/auth/v1/admin/users", {
    key: inject("stack").serviceKey,
    method: "POST",
    body: {
      email,
      password: PASSWORD,
      email_confirm: true,
      app_metadata: {
        user_type: "recruiter",
        user_role: ["recruiter"],
        twofa_phone: "+15555550177",
      },
      user_metadata: { name: "Device test" },
    },
  });
  expect(made.status, made.text).toBeLessThan(300);
});

describe("a sign-in attempt on a staff account leaves the person's other devices signed in", () => {
  const cases: Array<[string, string, Record<string, unknown>, number]> = [
    ["/login (refused: staff use the two-step login)", "login", {}, 403],
    [
      "validate-credentials (two-step required)",
      "validate-credentials",
      {},
      200,
    ],
    ["complete-2fa without a code (refused)", "complete-2fa", {}, 400],
    [
      "complete-2fa with a wrong code (refused)",
      "complete-2fa",
      { code: "123456" },
      400,
    ],
  ];

  it.each(cases)("%s", async (_name, route, body, status) => {
    const device = await grant(); // the person's phone, signed in earlier
    expect(await stillSignedIn(device.access_token)).toBe(true);

    const attempt = await post(route, body);
    expect(attempt.status, attempt.text).toBe(status);
    expect(attempt.json.session).toBeUndefined();

    expect(await stillSignedIn(device.access_token)).toBe(true);
    // the refresh token of that device still works too
    const refreshed = await supabase(
      "/auth/v1/token?grant_type=refresh_token",
      {
        method: "POST",
        body: { refresh_token: device.refresh_token },
      }
    );
    expect(refreshed.status, refreshed.text).toBe(200);
  });
});
