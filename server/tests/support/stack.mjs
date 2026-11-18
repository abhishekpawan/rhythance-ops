// Shared helpers for the test scripts: where the local Supabase is, running psql, the migration list.
// Every entry point calls requireLocal() before anything else; localStack() calls it again on the
// addresses the Supabase CLI reports, so a reachable non-local address can never get through.

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireLocal } from "./local-only.mjs";

export const SERVER_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
export const MIGRATIONS_DIR = path.join(SERVER_DIR, "src/db/migration_v2");

/** Services the tests do not need; the images are never started. */
export const EXCLUDED_SERVICES =
  "studio,imgproxy,postgres-meta,vector,logflare,supavisor,mailpit,edge-runtime";

export function supabase(args, options = {}) {
  return spawnSync("supabase", args, {
    cwd: SERVER_DIR,
    encoding: "utf8",
    ...options,
  });
}

/** Addresses and keys of the running local stack. Exits 2 unless every address is local. */
export function localStack() {
  requireLocal();
  const r = supabase(["status", "-o", "json"]);
  const start = r.stdout.indexOf("{");
  if (r.status !== 0 || start < 0) {
    console.error(
      "The local Supabase is not running. Start it with: pnpm test:db:up"
    );
    process.exit(1);
  }
  const s = JSON.parse(r.stdout.slice(start));
  requireLocal({ database: s.DB_URL, api: s.API_URL });
  return {
    dbUrl: s.DB_URL,
    apiUrl: s.API_URL,
    anonKey: s.ANON_KEY,
    serviceKey: s.SERVICE_ROLE_KEY,
    jwtSecret: s.JWT_SECRET,
  };
}

/** Runs a SQL file (or a statement) with psql; the database address has been checked by the caller. */
export function psql(
  dbUrl,
  { file, sql, singleTransaction = true, quiet = true, tuplesOnly = false }
) {
  requireLocal({ database: dbUrl });
  const args = [dbUrl, "-v", "ON_ERROR_STOP=1", "-X"];
  if (quiet) args.push("-q");
  if (tuplesOnly) args.push("-At");
  if (singleTransaction && file) args.push("--single-transaction");
  if (file) args.push("-f", file);
  if (sql) args.push("-c", sql);
  // 032 refuses to run unless the caller opts in; only these local test scripts do (see 032's header)
  const env = {
    ...process.env,
    PGOPTIONS: "-c rhythence.catch_up=new-database",
  };
  return spawnSync("psql", args, { encoding: "utf8", env });
}

/** Migration files in run order: 000 .. 034 (032 is the catch-up). */
export function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .sort()
    .map((f) => path.join(MIGRATIONS_DIR, f));
}
