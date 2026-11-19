// DEV-2 (inbox 20): the sign-in endpoints answer with a stable `code` next to the English `error` text, so the
// screen can show the French or English translation. Statuses are unchanged (401 wrong password, 400, 403).
// The phone-code error codes are in phone-code-endpoints.test.ts.
import { describe, expect, it } from "vitest";
import { PASSWORD, server, staffEmails } from "../support/api";

const post = (path: string, body: unknown, twoFactor = false) =>
  server(path, { method: "POST", twoFactor, body });

const SIGN_IN = [
  "/api/auth/login",
  "/api/auth/validate-credentials",
  "/api/auth/complete-2fa",
];

describe("wrong password", () => {
  for (const path of SIGN_IN) {
    it(`${path}: 401 with code INVALID_CREDENTIALS and no session`, async () => {
      const r = await post(path, {
        email: staffEmails.admin,
        password: "not-the-password",
      });
      expect(r.status).toBe(401);
      expect(r.json.code).toBe("INVALID_CREDENTIALS");
      expect(r.json.error).toMatch(/invalid login credentials/i);
      expect(r.json.session).toBeUndefined();
    });
  }

  it("an unknown email gives the same answer (no way to tell the accounts apart)", async () => {
    const r = await post("/api/auth/validate-credentials", {
      email: "nobody-here@example.test",
      password: PASSWORD,
    });
    expect(r.status).toBe(401);
    expect(r.json.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("missing fields", () => {
  for (const path of SIGN_IN) {
    it(`${path}: 400 EMAIL_AND_PASSWORD_REQUIRED`, async () => {
      for (const body of [
        {},
        { email: staffEmails.admin },
        { password: "x" },
      ]) {
        const r = await post(path, body);
        expect(r.status).toBe(400);
        expect(r.json.code).toBe("EMAIL_AND_PASSWORD_REQUIRED");
      }
    });
  }
});

describe("staff two-step login (server that enforces it)", () => {
  it("/login for staff: 403 TWO_FACTOR_REQUIRED", async () => {
    const r = await post(
      "/api/auth/login",
      { email: staffEmails.recruiter, password: PASSWORD },
      true
    );
    expect(r.status).toBe(403);
    expect(r.json.code).toBe("TWO_FACTOR_REQUIRED");
  });

  it("complete-2fa without a code: 400 TWO_FACTOR_CODE_REQUIRED", async () => {
    const r = await post(
      "/api/auth/complete-2fa",
      { email: staffEmails.recruiter, password: PASSWORD },
      true
    );
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("TWO_FACTOR_CODE_REQUIRED");
  });

  it("complete-2fa with a wrong code: 400 INVALID_2FA_CODE (not 401: the screen would sign out)", async () => {
    const r = await post(
      "/api/auth/complete-2fa",
      { email: staffEmails.recruiter, password: PASSWORD, code: "111111" },
      true
    );
    expect(r.status).toBe(400);
    expect(r.json.code).toBe("INVALID_2FA_CODE");
    expect(r.json.session).toBeUndefined();
  });
});
