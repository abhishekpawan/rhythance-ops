// Puts the test database back after a test or a journey wrote timesheets (R-4): the timesheets themselves, the activity
// rows the server logged for them, and the "last activity" dates the inactivity triggers (migration 014) moved to
// "now" on the clients and jobseeker profiles. The Reports pins read those dates (the "inactive" flags) and
// tests/access/by-role.test.ts counts the activity feed, so a write that leaves any of it behind fails other files,
// depending on which file runs first. Local database only (psql refuses anything else through requireLocal).
import { psql } from "./stack.mjs";

// the dates tests/seed/data.sql puts back at its end ("Last activity")
const CLIENT_DATES = [
  ["00000000-0000-4000-8000-000000000021", "2026-11-10T14:00:00Z"],
  ["00000000-0000-4000-8000-000000000022", "2026-11-12T14:00:00Z"],
  ["00000000-0000-4000-8000-000000000023", "2026-11-05T14:00:00Z"],
  ["00000000-0000-4000-8000-000000000024", "2026-09-01T14:00:00Z"],
];
const PROFILE_DATES = [
  ["00000000-0000-4000-8000-000000000041", "2026-11-08T14:00:00Z"],
  ["00000000-0000-4000-8000-000000000042", "2026-11-08T14:00:00Z"],
  ["00000000-0000-4000-8000-000000000043", "2026-11-08T14:00:00Z"],
  ["00000000-0000-4000-8000-000000000044", "2026-11-08T14:00:00Z"],
  ["00000000-0000-4000-8000-000000000045", "2026-08-15T14:00:00Z"],
];
const values = (rows) =>
  rows.map(([id, at]) => `('${id}', '${at}')`).join(", ");

const putBackDates = `
    SET session_replication_role = replica;
    UPDATE public.clients c SET last_activity_at = v.at::timestamptz
      FROM (VALUES ${values(CLIENT_DATES)}) AS v(id, at) WHERE c.id = v.id::uuid;
    UPDATE public.jobseeker_profiles p SET last_activity_at = v.at::timestamptz
      FROM (VALUES ${values(PROFILE_DATES)}) AS v(id, at) WHERE p.id = v.id::uuid;
    SET session_replication_role = origin;`;

/**
 * @param dbUrl the local test database
 * @param timesheetsWhere SQL condition (on public.timesheets) for the rows to delete
 */
export function putBackTimesheetWrites(dbUrl, timesheetsWhere) {
  const sql = `
    DELETE FROM public.timesheets WHERE ${timesheetsWhere};
    DELETE FROM public.recent_activities
      WHERE action_type IN ('create_timesheet', 'update_timesheet', 'delete_timesheet', 'send_bulk_timesheet_email');${putBackDates}`;
  const r = psql(dbUrl, { sql, singleTransaction: false });
  if (r.status !== 0)
    throw new Error(`could not put the test database back: ${r.stderr}`);
}

/**
 * The same for invoices (R-5): the invoices themselves, the activity rows the server logged for them, and the
 * last-activity dates the invoice triggers (migration 014) move on the client and on the jobseekers named in the
 * invoice's lines.
 * @param invoicesWhere SQL condition (on public.invoices) for the rows to delete
 */
export function putBackInvoiceWrites(dbUrl, invoicesWhere) {
  const sql = `
    DELETE FROM public.invoices WHERE ${invoicesWhere};
    DELETE FROM public.recent_activities
      WHERE action_type IN ('create_invoice', 'update_invoice', 'delete_invoice', 'send_invoice_email');${putBackDates}`;
  const r = psql(dbUrl, { sql, singleTransaction: false });
  if (r.status !== 0)
    throw new Error(`could not put the test database back: ${r.stderr}`);
}
