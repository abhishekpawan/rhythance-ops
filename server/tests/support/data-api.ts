import { expect } from "vitest";
import { supabase } from "./api";

/** A call that the data API refuses for want of a table grant: 401/403 and "permission denied for table <table>"
 *  (never the old "... for table users" of the dead staff policies, never an empty list). */
export function expectNoGrant(
  r: { status: number; text: string },
  table: string,
  what: string
) {
  expect([401, 403], `${what}: ${r.text}`).toContain(r.status);
  expect(r.text, what).toContain(`permission denied for table ${table}`);
}

/** A read of `table` with this token is refused for want of a grant. */
export async function expectReadRefused(
  table: string,
  token: string,
  who: string
) {
  const r = await supabase(`/rest/v1/${table}?select=id&limit=1`, { token });
  expectNoGrant(r, table, `${who} reads ${table}`);
}
