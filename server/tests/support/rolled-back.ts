// Runs SQL against the local test database inside BEGIN ... ROLLBACK and returns what its SELECTs printed.
import { expect, inject } from "vitest";
import { psql } from "./stack.mjs";

export function rolledBack(statements: string): string {
  const r = psql(inject("stack").dbUrl, {
    sql: `BEGIN; ${statements} ROLLBACK;`,
    tuplesOnly: true,
    singleTransaction: false,
  });
  expect(r.status, r.stderr).toBe(0);
  return r.stdout
    .split("\n")
    .filter((l: string) => l && l !== "BEGIN" && l !== "ROLLBACK")
    .join("\n");
}
