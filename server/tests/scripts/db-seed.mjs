// Loads the synthetic seed into the local test database: accounts (role in app_metadata) through the
// local auth API, domain rows through psql, then the files. Refuses anything that is not local.
import { requireLocal } from "../support/local-only.mjs";
requireLocal();
import path from "node:path";
import { fileURLToPath } from "node:url";
import { localStack, psql } from "../support/stack.mjs";
import { createUsers } from "../seed/users.mjs";
import { uploadSeedFiles } from "../seed/documents.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const stack = localStack();

await createUsers(stack);
const r = psql(stack.dbUrl, { file: path.join(here, "../seed/data.sql") });
if (r.status !== 0) {
  console.error(`seed data failed:\n${r.stderr.split("\n").filter((l) => !l.includes("NOTICE")).join("\n")}`);
  process.exit(1);
}
await uploadSeedFiles(stack);
console.log("test database seeded");
