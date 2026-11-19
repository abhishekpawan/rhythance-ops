// Compares the schema of the test database (built from migration_v2) with production-listing.txt.
//
// Ignored, exactly: the two "NOT COVERED" groups named in migration 032 (execute_sql, and the embedding
// queue). Accepted as extra in the test database, exactly: the lines of files-ahead-of-production.txt.
// Everything else must match. A stale allowance (the object is in production, or no longer in the files)
// also fails, so both lists can only shrink.
//
// Run: node tests/schema/compare.mjs   (needs the local test database; refuses anything else)

import { requireLocal } from "../support/local-only.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 032 "NOT COVERED": present in production, deliberately absent from a database built from the files. */
export const NOT_COVERED = [
  /^(function|fngrant)\|public\.execute_sql\(/, // 1. the AI chat's SQL function (ROADMAP P12)
  /^(function|fngrant)\|public\.embedding_input_/, // 2. the embedding queue ...
  /^trigger\|public\.(jobseeker_profiles|positions)\.embed_/,
  /^cron\|process-embeddings\|/,
];

const here = path.dirname(fileURLToPath(import.meta.url));

export function readLines(file) {
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "" && !l.startsWith("#"));
}

export function readAllowances(file) {
  return readLines(file).map((l) => l.replace(/\s+#.*$/, ""));
}

/**
 * @param {string[]} production lines of production-listing.txt
 * @param {string[]} local lines listed from the test database
 * @param {string[]} ahead prefixes from files-ahead-of-production.txt
 * @returns {{missing: string[], extra: string[], staleAllowances: string[]}}
 */
export function compareListings(production, local, ahead, changed = []) {
  const prod = new Set(
    production.filter((l) => !NOT_COVERED.some((re) => re.test(l)))
  );
  const loc = new Set(local);
  const missingAll = [...prod].filter((l) => !loc.has(l)).sort();
  const extraAll = [...loc].filter((l) => !prod.has(l)).sort();
  const isChanged = (l) => changed.some((p) => l.startsWith(p));
  // "changed": the files hold a newer definition of something production has (listed in
  // changed-ahead-of-production.txt): production's old line and the files' new line are both accepted.
  const missing = missingAll.filter((l) => !isChanged(l));
  const extra = extraAll.filter(
    (l) => !ahead.some((p) => l.startsWith(p)) && !isChanged(l)
  );
  const staleAllowances = [
    ...ahead.filter((p) => !extraAll.some((l) => l.startsWith(p))),
    ...changed.filter(
      (p) =>
        !(
          missingAll.some((l) => l.startsWith(p)) &&
          extraAll.some((l) => l.startsWith(p))
        )
    ),
  ];
  return { missing, extra, staleAllowances };
}

export function formatResult({ missing, extra, staleAllowances }) {
  const out = [];
  if (missing.length)
    out.push(
      "In production, missing from the test database:",
      ...missing.map((l) => `  - ${l}`)
    );
  if (extra.length)
    out.push(
      "In the test database, not in production:",
      ...extra.map((l) => `  + ${l}`)
    );
  if (staleAllowances.length)
    out.push(
      "Stale entries in files-ahead-of-production.txt:",
      ...staleAllowances.map((l) => `  ! ${l}`)
    );
  return out.join("\n");
}

/** Lists the schema of the local test database with listing.sql. */
export async function listLocal() {
  const { localStack, psql } = await import("../support/stack.mjs");
  const stack = localStack();
  const r = psql(stack.dbUrl, {
    file: path.join(here, "listing.sql"),
    tuplesOnly: true,
    singleTransaction: false,
  });
  if (r.status !== 0) throw new Error(`listing.sql failed: ${r.stderr}`);
  return r.stdout.split("\n").filter((l) => l.trim() !== "");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  requireLocal();
  const result = compareListings(
    readLines(path.join(here, "production-listing.txt")),
    await listLocal(),
    readAllowances(path.join(here, "files-ahead-of-production.txt")),
    readAllowances(path.join(here, "changed-ahead-of-production.txt"))
  );
  const text = formatResult(result);
  if (text) {
    console.error(text);
    process.exit(1);
  }
  console.log(
    "schema matches production (apart from the items 032 lists as not covered, files-ahead-of-production.txt and changed-ahead-of-production.txt)"
  );
}
