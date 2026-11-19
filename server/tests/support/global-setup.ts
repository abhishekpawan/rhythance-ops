// Integration tests: build a fresh test database, seed it, start the real server against it.
// Every step goes through the local-only guard. TEST_REUSE_DB=1 keeps the database from the last run
// (faster while writing tests); the default is always a fresh build.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TestProject } from "vitest/node";
import { requireLocal } from "./local-only.mjs";
import { localStack } from "./stack.mjs";
import { startTestServer } from "./test-server.mjs";
import { FIXED_NOW } from "../seed/ids.mjs";

const scripts = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../scripts"
);

function run(script: string) {
  const r = spawnSync(process.execPath, [path.join(scripts, script)], {
    stdio: "inherit",
  });
  if (r.status !== 0) throw new Error(`${script} failed (exit ${r.status})`);
}

export default async function setup(project: TestProject) {
  requireLocal();
  if (!process.env.TEST_REUSE_DB) {
    run("db-up.mjs");
    run("db-build.mjs");
    run("db-seed.mjs");
  }
  const stack = localStack();
  const server = await startTestServer(stack);
  const fixedServer = await startTestServer(stack, { fixedNow: FIXED_NOW });
  // third server: the staff two-step login enforced (feature flag forced on for this process only)
  const twoFactorServer = await startTestServer(stack, {
    forceFlags: ["staff_two_factor_enforced"],
  });
  project.provide("stack", stack);
  project.provide("twoFactorServerUrl", twoFactorServer.url);
  project.provide("twoFactorOutboundLog", twoFactorServer.outboundLog);
  project.provide("serverUrl", server.url);
  project.provide("outboundLog", server.outboundLog);
  project.provide("serverWorkDir", server.workDir);
  project.provide("fixedClockServerUrl", fixedServer.url);
  return async () => {
    await twoFactorServer.stop();
    await fixedServer.stop();
    await server.stop();
  };
}
