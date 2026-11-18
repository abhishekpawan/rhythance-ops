// Local-only guard (D1a). Every script that builds, resets, seeds or starts the server for tests
// calls requireLocal() FIRST, before any connection. There is no override flag.
//
// A database address or SUPABASE_URL that is not localhost, 127.0.0.1 or ::1 stops the script with
// exit code 2. The ambient environment is checked too: a shell that still has a stage or production
// address exported makes the test scripts refuse rather than silently ignore it.

import { fileURLToPath } from "node:url";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Environment variables that may carry a database or API address. */
export const ADDRESS_VARIABLES = [
  "SUPABASE_URL",
  "DATABASE_URL",
  "SUPABASE_DB_URL",
  "POSTGRES_URL",
  "TEST_DB_URL",
  "TEST_SUPABASE_URL",
];

/** @returns {{ok: true, host: string} | {ok: false, reason: string}} */
export function checkAddress(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false, reason: "empty address" };
  }
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return { ok: false, reason: "not a URL" };
  }
  // URL parsing takes the host after any "user@", so "http://localhost@evil.test" gives evil.test.
  const host = parsed.hostname.toLowerCase();
  if (!LOCAL_HOSTS.has(host)) {
    return { ok: false, reason: `host "${host}" is not local` };
  }
  return { ok: true, host };
}

/** Throws a plain Error (used by unit tests and by requireLocal). */
export function assertLocal(label, value) {
  const result = checkAddress(value);
  if (!result.ok) {
    throw new Error(`${label}: ${result.reason}`);
  }
  return result.host;
}

/**
 * Checks the given addresses and the ambient environment. Exits the process with code 2 when any
 * address that is set is not local. Returns the checked addresses otherwise.
 * @param {Record<string, string | undefined>} [addresses] label -> address, for example {"database": url}
 */
export function requireLocal(addresses = {}, env = process.env) {
  const problems = [];
  for (const [label, value] of Object.entries(addresses)) {
    const r = checkAddress(value);
    if (!r.ok) problems.push(`${label}: ${r.reason}`);
  }
  for (const name of ADDRESS_VARIABLES) {
    if (env[name] !== undefined && env[name] !== "") {
      const r = checkAddress(env[name]);
      if (!r.ok) problems.push(`environment ${name}: ${r.reason}`);
    }
  }
  if (problems.length > 0) {
    console.error(
      "REFUSED: the test scripts only run against a local database (localhost, 127.0.0.1 or ::1).\n" +
        problems.map((p) => `  - ${p}`).join("\n") +
        "\nNothing was run. Unset the variable, or fix the address. There is no override."
    );
    process.exit(2);
  }
  return addresses;
}

// Run directly: `node tests/support/local-only.mjs [address ...]` checks the environment and the arguments.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const given = Object.fromEntries(process.argv.slice(2).map((a, i) => [`argument ${i + 1}`, a]));
  requireLocal(given);
  console.log("local-only check passed");
}
