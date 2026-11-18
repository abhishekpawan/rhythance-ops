# Testing

Run `pnpm test` in `server/` and you get: a fresh local Supabase built from the repo's own migrations, filled with synthetic data, the real server running against it, and every message it tries to send recorded instead of sent. Nothing touches a real database or a real person.

## Run it

Needs, once per machine: Docker (on a Mac: Colima, `colima start`), the Supabase CLI, `psql`, Node 24 (the repo's engine; `fnm install 24`) and `pnpm install` in `server/`.

| Command (in `server/`) | What it does |
| --- | --- |
| `pnpm test` | Everything: starts the local Supabase if it is not running, rebuilds the database, seeds it, starts two test servers (real clock and fixed clock), runs all tests. About 45 seconds once the images are pulled; the first start pulls images (about 15 minutes). |
| `pnpm test:unit` | Only the tests that need nothing running (money and date functions, the guard's own tests). Under a second. |
| `pnpm test:db:up` / `test:db:build` / `test:db:seed` | The steps of the test run, by hand. `build` resets the database and applies `src/db/migration_v2/*.sql` in order; `seed` loads the synthetic data. |
| `pnpm test:schema` | Compares the schema of the test database with production's stored listing. |
| `pnpm test:server` | Starts the test server by hand to look around (messages recorded in the file it prints). |
| `TEST_REUSE_DB=1 pnpm test` | Keeps the database of the last run (faster while writing a test). The default is always a fresh build. |
| `supabase stop` (in `server/`) | Stops the local Supabase when you are done. |

Migration 032 (the catch-up for new databases) refuses to run unless the session sets `rhythence.catch_up = 'new-database'`; the test scripts set it through `PGOPTIONS`, nothing else does.

The Supabase project for the tests lives in `server/supabase/` (ports 54421 to 54422, so it can run next to another local Supabase). Render and Vercel never read it: Render builds `server/` from `src/` only.

## It can only run on this machine

Every script that builds, resets, seeds or starts the server for tests starts with `requireLocal()` (`tests/support/local-only.mjs`). It stops with **exit code 2** unless the database address and `SUPABASE_URL` are `localhost`, `127.0.0.1` or `::1`, and it also refuses when the shell still has a remote address exported (`SUPABASE_URL`, `DATABASE_URL`, `SUPABASE_DB_URL`, `POSTGRES_URL`, `TEST_DB_URL`, `TEST_SUPABASE_URL`). There is no override flag. The address is parsed as a URL, so `http://localhost@evil.example` and `http://localhost.evil.example` are refused.

The test server is started from an empty temporary folder with an explicit list of variables (`tests/support/test-server.mjs`): `server/.env` (which points at stage) and the developer's shell cannot reach it. Vendor keys are fake. `tests/guard/` proves all of this, runs every script in `tests/scripts/` with a remote address and checks the exit code, and fails if a new script does not call the guard first.

## What the tests are

| Where | What |
| --- | --- |
| `tests/unit/` | Vitest tests for `client/src/pages/TimesheetManagement/functions/timesheetCalculations.ts`, `client/src/lib/hybridPayrollSplit.ts` and the server's `utils/metricMonths.ts`, `paymentDueDate.ts`, `dateUtils.ts`, `timesheetDateRange.ts`. Expected values are worked out by hand in the test, to the cent. They run in a timezone far from Toronto (UTC+14, `TEST_TZ` changes it) so a function that depends on the machine's zone fails. |
| `tests/schema/` | `listing.sql` lists a database's structure (tables, columns, constraints, indexes, functions, triggers, policies, grants, buckets, jobs); `production-listing.txt` is production's, taken read-only; `compare.mjs` and `schema.test.ts` compare them. Migrations 032, 033 and 034 are run twice and must change nothing. |
| `tests/access/` | Against the real server and directly against the local Supabase, each time with the user's own token: the role comes from `app_metadata` (a jobseeker who edits their own `user_metadata` to admin is still refused; staff who edit theirs to jobseeker stay staff; open sign-up gives the jobseeker role); a jobseeker cannot list, download, replace or delete another jobseeker's files, nor read signed consents or invoice files; with the anon key alone nothing can be listed or read; each staff role sees all jobseekers' documents and profiles; what each role gets from the server. |
| `tests/guard/` | The local-only guard, the outbound guard (below), the fixed clock, the test server's environment. |
| `tests/seed/` | The synthetic data (below). |
| `tests/support/` | Guard, stack helpers, outbound recorders, test server, API helpers. |

## The synthetic data

`tests/seed/`: one account per role (admin, super admin, recruiter, bookkeeper, recruiter manager, accountant manager, sales, recruiter director), made through the local auth API with the role in **`app_metadata`**; five jobseekers with profiles; one jobseeker made through open sign-up (so the 034 trigger gives it the role). `data.sql` has four clients (Ontario, Quebec, British Columbia, Alberta in USD), positions (ordinary, overtime after 40 h, invoicing-only subcategory, premium pay rate, ended), assignments, nine timesheets and four invoices: SIN direct deposit, cash with a 10% deduction, hybrid SIN + cash and SIN + e-Transfer (hours cap, two rows, bonus on the SIN row), a corporation with HST; invoices taxed per province (HST 13%, GST 5% + QST 9.975%, GST 5%, zero rated). Files: ID documents of two different jobseekers, a signed consent, an invoice file. Addresses end in `@example.test`, phones are +1 555, every id is fixed. Nothing is copied from a real database, so it travels to every branch.

## Messages, AI and the clock

The test server is started with three preloads (`node --import`), so **the server's source is unchanged**:

- `outbound-guard.mjs`: `@sendgrid/mail` and `twilio` are replaced by recorders (each call becomes a line in the file named by `TEST_OUTBOUND_LOG`; the only SMS code a check approves is `000000`); every socket that is not to localhost is refused, which covers `fetch`, `http`, `https` and anything built on `net`, and each refusal is recorded too. `AI_VERIFICATION_URL` points at a local stand-in (`ai-stub.mjs`).
- `fixed-clock.mjs`: with `TEST_FIXED_NOW` set, "now" stands still (10:00 on 17 November 2026 in Toronto). The second test server has it, for date-based answers. The default server uses the real clock, because code that compares "now" with a timestamp the database wrote (for example a ticket created less than 30 seconds ago) needs the two to agree.

`tests/guard/outbound.test.ts` runs a probe that tries every route out (SendGrid, Twilio, OpenAI by `fetch`, `https.request`, `http.request`, raw `net`) and checks each is blocked or recorded.

## Writing a test

Use the helpers in `tests/support/api.ts`: `tokenFor(email)` signs a seeded account in, `server(path, { token })` calls the real server, `supabase(path, { token })` and `storage.*` call the local Supabase with that token. Add expected values by working them out, never by copying what the code printed. If a test shows something wrong in the portal, report it instead of pinning it silently. After writing a test, break the thing it guards on purpose and watch it fail.

## Not covered yet

API pins per module (answers and rows written, every role), browser journeys, CI, the pre-commit hook, the file-size check, server lint (SAFE-2b and the refactor sessions). The tests are not type-checked (Vitest transpiles them).
