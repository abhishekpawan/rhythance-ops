// Before the journeys: a fresh local test database (built from migration_v2 and seeded, exactly like
// `pnpm test` in server/), the real server against it (fixed clock, every message recorded, CORS set to the
// client's own address) and the client on a free port. Everything goes through the local-only guard.
// E2E_REUSE_DB=1 keeps the database of the last run (faster while writing a journey); the default is a fresh build.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireLocal } from "../../server/tests/support/local-only.mjs";
import { localStack } from "../../server/tests/support/stack.mjs";
import { startTestServer } from "../../server/tests/support/test-server.mjs";
import { FIXED_NOW } from "../../server/tests/seed/ids.mjs";
import { OUTSIDE_LOG } from "./outside-requests";
import { startChatStandIn } from "./ai-chat-stand-in.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverScripts = path.resolve(here, "../../server/tests/scripts");

function run(script: string) {
  const r = spawnSync(process.execPath, [path.join(serverScripts, script)], {
    stdio: "inherit",
  });
  if (r.status !== 0) throw new Error(`${script} failed (exit ${r.status})`);
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
  });
}

async function startClient(env: Record<string, string>, url: string) {
  let output = "";
  let exited = false;
  const child: ChildProcess = spawn(
    process.execPath,
    [path.join(here, "start-client.mjs")],
    { env, stdio: ["ignore", "pipe", "pipe"] }
  );
  child.stdout?.on("data", (d) => (output += d));
  child.stderr?.on("data", (d) => (output += d));
  child.on("exit", () => (exited = true));
  const deadline = Date.now() + 90_000;
  for (;;) {
    if (exited)
      throw new Error(`the client stopped while starting:\n${output}`);
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) {
      child.kill();
      throw new Error(`the client did not start in 90 s:\n${output}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  // Vite compiles on first request; load the entry once so the first journey does not pay for it
  await fetch(`${url}/src/main.tsx`).catch(() => undefined);
  return async () => {
    if (!exited) {
      child.kill("SIGTERM");
      await new Promise((r) => child.once("exit", r));
    }
  };
}

export default async function globalSetup() {
  requireLocal();
  if (!process.env.E2E_REUSE_DB) {
    run("db-up.mjs");
    run("db-build.mjs");
    run("db-seed.mjs");
  }
  const stack = localStack();
  // E2E_CLIENT_PORT and E2E_AI_CHAT_URL are for checking the real chat service by hand (tests/ai-chat-real.spec.ts)
  const clientPort = Number(process.env.E2E_CLIENT_PORT) || (await freePort());
  const clientUrl = `http://localhost:${clientPort}`;
  const server = await startTestServer(stack, {
    fixedNow: FIXED_NOW,
    clientUrl,
    // every seeded staff account shares one phone number and every sign-in texts it: the phone-code limits
    // (server/src/middleware/otpRateLimits.ts, tested in server/tests/access/phone-code-endpoints.test.ts)
    // would stop the journeys
    extraEnv: {
      OTP_SEND_LIMIT_PER_NUMBER: "100000",
      OTP_SEND_LIMIT_PER_ADDRESS: "100000",
      OTP_CHECK_LIMIT_PER_NUMBER: "100000",
      OTP_CHECK_LIMIT_PER_ADDRESS: "100000",
    },
  });

  // the AI chat's page is a stand-in that speaks the same token contract (support/ai-chat-stand-in.mjs)
  const chat = await startChatStandIn({
    apiUrl: stack.apiUrl,
    anonKey: stack.anonKey,
  });

  const clientEnv = {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    TMPDIR: process.env.TMPDIR ?? "",
    NODE_ENV: "development",
    E2E_CLIENT_PORT: String(clientPort),
    VITE_SUPABASE_URL: stack.apiUrl,
    VITE_SUPABASE_ANON_KEY: stack.anonKey,
    VITE_API_URL: server.url,
    VITE_AI_CHAT_URL: process.env.E2E_AI_CHAT_URL || chat.url,
  };
  requireLocal({
    VITE_SUPABASE_URL: clientEnv.VITE_SUPABASE_URL,
    VITE_API_URL: clientEnv.VITE_API_URL,
    CLIENT_URL: clientUrl,
  });
  let stopClient: () => Promise<void>;
  try {
    stopClient = await startClient(clientEnv, clientUrl);
  } catch (error) {
    await server.stop();
    await chat.stop();
    throw error;
  }

  process.env.E2E_CLIENT_URL = clientUrl;
  process.env.E2E_SERVER_URL = server.url;
  process.env.E2E_OUTBOUND_LOG = server.outboundLog;
  return async () => {
    await stopClient();
    await server.stop();
    await chat.stop();
    printOutsideRequests();
  };
}

/** What the browser tried to reach outside this machine during the run (all of it was aborted). */
function printOutsideRequests() {
  if (!existsSync(OUTSIDE_LOG)) return console.log("\nOutside requests: none");
  const counts = new Map<string, number>();
  for (const line of readFileSync(OUTSIDE_LOG, "utf8").split("\n")) {
    if (!line) continue;
    const { host, test } = JSON.parse(line);
    if (String(test).includes("every request to another host")) continue; // the guard's own probes
    counts.set(host, (counts.get(host) ?? 0) + 1);
  }
  console.log("\nOutside requests the browser tried (all aborted):");
  for (const [host, n] of [...counts].sort()) console.log(`  ${host}: ${n}`);
}
