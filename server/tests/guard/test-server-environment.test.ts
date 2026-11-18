import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkAddress } from "../support/local-only.mjs";
import { serverEnvironment } from "../support/test-server.mjs";
import { SERVER_DIR } from "../support/stack.mjs";

const stack = {
  dbUrl: "postgresql://postgres:postgres@127.0.0.1:54422/postgres",
  apiUrl: "http://127.0.0.1:54421",
  anonKey: "local-anon",
  serviceKey: "local-service",
};

const env = serverEnvironment(stack, {
  port: 5999,
  aiUrl: "http://127.0.0.1:5998/analyze-profile-documents",
  outboundLog: "/tmp/outbound.jsonl",
  tsconfig: path.join(SERVER_DIR, "tsconfig.json"),
  fixedNow: "2026-11-17T15:00:00.000Z",
}) as Record<string, string>;

describe("the environment the test server gets", () => {
  it("is built from nothing in the developer's shell: only these variables exist", () => {
    expect(Object.keys(env).sort()).toEqual(
      [
        "AI_VERIFICATION_URL", "ASSIGNMENT_FROM_EMAIL", "CLIENT_URL", "DEFAULT_FROM_EMAIL", "HOME", "INVOICE_CC_EMAILS",
        "NODE_ENV", "NO_REPLY_FROM_EMAIL", "PATH", "PORTAL_NAME", "PORT", "SENDGRID_API_KEY", "SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_KEY", "SUPABASE_URL", "SUPPORT_NOTIFY_CC", "SUPPORT_NOTIFY_TO", "TEST_FIXED_NOW",
        "TEST_OUTBOUND_LOG", "TMPDIR", "TSX_TSCONFIG_PATH", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN",
        "TWILIO_VERIFY_SERVICE_SID", "TZ",
      ].sort()
    );
  });

  it("points the database and the AI check at this machine", () => {
    expect(checkAddress(env.SUPABASE_URL).ok).toBe(true);
    expect(checkAddress(env.AI_VERIFICATION_URL).ok).toBe(true);
    expect(env.CLIENT_URL).toBe("http://localhost:3000");
  });

  it("holds only fake vendor keys and synthetic addresses", () => {
    expect(env.SENDGRID_API_KEY).toMatch(/fake/);
    expect(env.TWILIO_AUTH_TOKEN).toMatch(/fake/);
    expect(env.TWILIO_ACCOUNT_SID).toMatch(/fake/);
    for (const name of ["NO_REPLY_FROM_EMAIL", "ASSIGNMENT_FROM_EMAIL", "DEFAULT_FROM_EMAIL", "SUPPORT_NOTIFY_TO"]) {
      expect(env[name], name).toMatch(/@example\.test$/);
    }
  });

  it("has no fixed clock unless one is asked for", () => {
    const real = serverEnvironment(stack, { port: 1, aiUrl: "http://127.0.0.1:2/x", outboundLog: "/tmp/o", tsconfig: "t", fixedNow: undefined }) as Record<string, string>;
    expect("TEST_FIXED_NOW" in real).toBe(false);
  });

  it("runs from the hosted server's timezone and a fixed clock, never from production mode", () => {
    expect(env.TZ).toBe("UTC");
    expect(env.NODE_ENV).toBe("test");
    expect(env.TEST_FIXED_NOW).toBe("2026-11-17T15:00:00.000Z");
  });
});
