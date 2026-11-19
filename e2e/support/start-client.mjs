// Starts the client (Vite dev server, source unchanged) for the browser journeys. Runs as its own process,
// started by global-setup.ts with an explicit environment.
//
// Local only, enforced like the test database (D1a): refuses with exit code 2 unless both addresses the
// client will use (Supabase and the API) are localhost, 127.0.0.1 or ::1. The addresses come only from the
// variables this script is given; client/.env (which points at stage) is never read, because Vite is told
// to look for .env files in an empty folder.
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireLocal } from "../../server/tests/support/local-only.mjs";

const CLIENT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../client"
);

requireLocal({
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  VITE_API_URL: process.env.VITE_API_URL,
  VITE_AI_CHAT_URL: process.env.VITE_AI_CHAT_URL,
});

const port = Number(process.env.E2E_CLIENT_PORT);
if (!Number.isInteger(port) || port < 1024) {
  console.error("E2E_CLIENT_PORT is missing or not a port number");
  process.exit(2);
}

const emptyEnvDir = mkdtempSync(path.join(os.tmpdir(), "portal-e2e-env-"));
const requireFromClient = createRequire(path.join(CLIENT_DIR, "package.json"));
const { createServer } = requireFromClient("vite");

const server = await createServer({
  root: CLIENT_DIR,
  envDir: emptyEnvDir,
  clearScreen: false,
  server: { port, strictPort: true, host: "localhost", open: false },
  // the app is served with the same defaults as `pnpm dev`; nothing else is changed
});
await server.listen();
console.log(`client ready on http://localhost:${port}`);

async function stop() {
  await server.close();
  rmSync(emptyEnvDir, { recursive: true, force: true });
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
