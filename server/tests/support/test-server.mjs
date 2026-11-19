// Starts the real server (unchanged source) for the tests: from a folder without .env, with an explicit
// environment of local addresses and fake keys, the outbound guard and the fixed clock preloaded.
// Nothing from the developer's shell or from server/.env (which points at stage) can reach it.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { requireLocal } from "./local-only.mjs";
import { SERVER_DIR } from "./stack.mjs";
import { startAiStub } from "./ai-stub.mjs";

/** The tsx loader as an absolute file URL, so it resolves although the server runs from another folder. */
function tsxLoader() {
  const require = createRequire(import.meta.url);
  const dir = path.dirname(require.resolve("tsx/package.json"));
  return pathToFileURL(path.join(dir, "dist/esm/index.mjs")).href;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

/** The only variables the test server gets. Keys for vendors are fake; the database keys are the local demo keys. */
export function serverEnvironment(
  stack,
  { port, aiUrl, outboundLog, tsconfig, fixedNow, forceFlags }
) {
  return {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    TMPDIR: process.env.TMPDIR ?? os.tmpdir(),
    TZ: "UTC", // like the hosted server; the code must not depend on it
    NODE_ENV: "test",
    PORT: String(port),
    SUPABASE_URL: stack.apiUrl,
    SUPABASE_ANON_KEY: stack.anonKey,
    SUPABASE_SERVICE_KEY: stack.serviceKey,
    CLIENT_URL: "http://localhost:3000",
    SENDGRID_API_KEY: "SG.fake-test-key",
    NO_REPLY_FROM_EMAIL: "no-reply@example.test",
    ASSIGNMENT_FROM_EMAIL: "assignments@example.test",
    DEFAULT_FROM_EMAIL: "no-reply@example.test",
    INVOICE_CC_EMAILS: "",
    PORTAL_NAME: "Test Portal",
    SUPPORT_NOTIFY_TO: "support@example.test",
    SUPPORT_NOTIFY_CC: "",
    TWILIO_ACCOUNT_SID: "ACfaketestsid",
    TWILIO_AUTH_TOKEN: "faketesttoken",
    TWILIO_VERIFY_SERVICE_SID: "VAfaketestsid",
    AI_VERIFICATION_URL: aiUrl,
    TEST_OUTBOUND_LOG: outboundLog,
    ...(fixedNow ? { TEST_FIXED_NOW: fixedNow } : {}),
    ...(forceFlags?.length ? { TEST_FORCE_FLAGS: forceFlags.join(",") } : {}),
    TSX_TSCONFIG_PATH: tsconfig,
  };
}

/**
 * fixedNow: an ISO instant at which the server's clock stands still (date-based answers), or undefined for the
 * real clock. The real clock is the default: code that compares "now" with a timestamp the database wrote (for
 * example "created less than 30 seconds ago") needs the two to agree.
 */
export async function startTestServer(stack, { fixedNow, forceFlags } = {}) {
  requireLocal({ database: stack.dbUrl, api: stack.apiUrl });

  const workDir = mkdtempSync(path.join(os.tmpdir(), "portal-test-server-"));
  if (existsSync(path.join(workDir, ".env")))
    throw new Error("the test server folder must not hold a .env");
  const outboundLog = path.join(workDir, "outbound.jsonl");
  writeFileSync(outboundLog, "");

  const ai = await startAiStub();
  let child;
  let port;
  let env;
  let url;
  let output = "";
  let exited = false;
  try {
    process.env.TEST_OUTBOUND_LOG = outboundLog; // the AI stub (this process) records to the same file
    port = await freePort();
    env = serverEnvironment(stack, {
      port,
      aiUrl: ai.url,
      outboundLog,
      tsconfig: path.join(SERVER_DIR, "tsconfig.json"),
      fixedNow,
      forceFlags,
    });
    requireLocal({
      SUPABASE_URL: env.SUPABASE_URL,
      AI_VERIFICATION_URL: env.AI_VERIFICATION_URL,
    });

    const here = import.meta.url;
    const args = [
      "--import",
      tsxLoader(),
      "--import",
      new URL("./outbound-guard.mjs", here).href,
      "--import",
      new URL("./fixed-clock.mjs", here).href,
      "--import",
      new URL("./force-flags.mjs", here).href,
      path.join(SERVER_DIR, "src/index.ts"),
    ];
    child = spawn(process.execPath, args, {
      cwd: workDir,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("exit", () => (exited = true));

    url = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + 60_000;
    for (;;) {
      if (exited)
        throw new Error(`the test server stopped while starting:\n${output}`);
      try {
        const res = await fetch(`${url}/health`);
        if (res.ok) break;
      } catch {
        // not up yet
      }
      if (Date.now() > deadline) {
        child.kill();
        throw new Error(`the test server did not start in 60 s:\n${output}`);
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  } catch (error) {
    child?.kill();
    await ai.close();
    rmSync(workDir, { recursive: true, force: true });
    throw error;
  }

  return {
    url,
    port,
    env,
    workDir,
    outboundLog,
    output: () => output,
    /** Everything the server tried to send, in order. */
    outbound() {
      return existsSync(outboundLog) ? readLines(outboundLog) : [];
    },
    clearOutbound() {
      writeFileSync(outboundLog, "");
    },
    async stop() {
      if (!exited) {
        child.kill();
        await new Promise((r) => child.once("exit", r));
      }
      await ai.close();
      rmSync(workDir, { recursive: true, force: true });
    },
  };
}

import { readFileSync } from "node:fs";
function readLines(file) {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}
