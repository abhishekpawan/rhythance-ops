// Builds a fresh test database: resets the local Supabase, applies src/db/migration_v2/*.sql in order,
// one transaction per file. Used by the test run and by `pnpm test:db:build`.
import { requireLocal } from "../support/local-only.mjs";
requireLocal();
import path from "node:path";
import { localStack, migrationFiles, psql, supabase } from "../support/stack.mjs";

const stack = localStack();

console.log("resetting the local database...");
const reset = supabase(["db", "reset", "--local", "--no-seed"], { encoding: "utf8" });
if (reset.status !== 0) {
  console.error(reset.stdout, reset.stderr);
  process.exit(1);
}

for (const file of migrationFiles()) {
  const r = psql(stack.dbUrl, { file });
  if (r.status !== 0) {
    console.error(`migration ${path.basename(file)} failed:\n${r.stderr.split("\n").filter((l) => !l.includes("NOTICE")).join("\n")}`);
    process.exit(1);
  }
  console.log(`applied ${path.basename(file)}`);
}
console.log("test database built");
