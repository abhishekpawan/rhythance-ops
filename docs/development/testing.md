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
| `pnpm test --project integration tests/pins` | Only the Reports API pins (database, seed and both servers are still set up). |
| `pnpm lint`, `pnpm knip` (in `server/` and `client/`) | Lint (server: warnings only) and the dead-code report. See "Checks around the tests". |
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
| `tests/pins/` | **API pins**: for each of the nine Reports endpoints (`server/src/routes/reports.ts`) the real server's answer to a set of requests, stored in `tests/pins/__snapshots__/<endpoint>/NN-<case>.json` (status and body, run-time ids and timestamps replaced by placeholders), the same answer from every one of the nine staff accounts, and the refusal of a jobseeker (403), of no token (401) and of a bad token (403). Dates are asked on the fixed-clock server. See "API pins". |
| `tests/guard/` | The local-only guard, the outbound guard (below), the fixed clock, the test server's environment. |
| `tests/seed/` | The synthetic data (below). |
| `tests/support/` | Guard, stack helpers, outbound recorders, test server, API helpers. |

## The synthetic data

`tests/seed/`: one account per role (admin, super admin, recruiter, bookkeeper, recruiter manager, accountant manager, sales, recruiter director), made through the local auth API with the role in **`app_metadata`**; five jobseekers with profiles; one jobseeker made through open sign-up (so the 034 trigger gives it the role). `data.sql` has four clients (Ontario, Quebec, British Columbia, Alberta in USD), positions (ordinary, overtime after 40 h, invoicing-only subcategory, premium pay rate, ended), assignments, nine timesheets and five invoices: SIN direct deposit, cash with a 10% deduction, hybrid SIN + cash and SIN + e-Transfer (hours cap, two rows, bonus on the SIN row), a corporation with HST; a fifth invoice (900006) written with every field the reports read, one discount and one deduction line (a negative bill rate); invoices taxed per province (HST 13%, GST 5% + QST 9.975%, GST 5%, zero rated). The inactivity triggers overwrite `last_activity_at` on insert, so the end of `data.sql` puts the intended dates back (triggers off for that statement): one client (77 days) and one jobseeker (93 days) are inactive on the fixed clock, the others are not. Files: ID documents of two different jobseekers, a signed consent, an invoice file. Addresses end in `@example.test`, phones are +1 555, every id is fixed. Nothing is copied from a real database, so it travels to every branch.

## Messages, AI and the clock

The test server is started with three preloads (`node --import`), so **the server's source is unchanged**:

- `outbound-guard.mjs`: `@sendgrid/mail` and `twilio` are replaced by recorders (each call becomes a line in the file named by `TEST_OUTBOUND_LOG`; the only SMS code a check approves is `000000`); every socket that is not to localhost is refused, which covers `fetch`, `http`, `https` and anything built on `net`, and each refusal is recorded too. `AI_VERIFICATION_URL` points at a local stand-in (`ai-stub.mjs`).
- `fixed-clock.mjs`: with `TEST_FIXED_NOW` set, "now" stands still (10:00 on 17 November 2026 in Toronto). The second test server has it, for date-based answers. The default server uses the real clock, because code that compares "now" with a timestamp the database wrote (for example a ticket created less than 30 seconds ago) needs the two to agree.

`tests/guard/outbound.test.ts` runs a probe that tries every route out (SendGrid, Twilio, OpenAI by `fetch`, `https.request`, `http.request`, raw `net`) and checks each is blocked or recorded.

## Writing a test

Use the helpers in `tests/support/api.ts`: `tokenFor(email)` signs a seeded account in, `server(path, { token })` calls the real server, `supabase(path, { token })` and `storage.*` call the local Supabase with that token. Add expected values by working them out, never by copying what the code printed. If a test shows something wrong in the portal, report it instead of pinning it silently. After writing a test, break the thing it guards on purpose and watch it fail.

## API pins

A pin is a stored answer: the same request must give the same answer. Where they are and how they work:

- `tests/pins/pin.ts` is the helper. `pinEndpoint(path, cases, { tiesBy })` registers, for one endpoint, one snapshot file per case, the equality of every other staff role's answer with admin's, and the three refusals. `tests/pins/reports.test.ts` lists the cases for the nine Reports endpoints (the filters, an empty answer and the 400 for missing input each).
- **A snapshot that changes is a change in behaviour.** Read the diff (the test prints it) before you decide. If the change is intended (a client request), run `pnpm test --project integration tests/pins -u`, look at `git diff tests/pins/__snapshots__` and commit it with the code. **During a refactor (a file split) no snapshot may change**; if one does, the split stops.
- CI runs with `CI=true`, where Vitest never writes a new snapshot: a missing file fails.
- **Rows with the same sort key come back in no fixed order** (the Reports queries order by one column only, so the database may answer ties in any order, and did). `tiesBy` keeps the order of the key groups exactly and sorts inside each group; for the envelope reports it also checks the running number (`sequence_number`, `sr_no`) is 1..n and stores the row without it. A real change of the sort still fails. This is an open finding (the numbers on the envelopes can differ between two prints of the same data); it is in the portal inbox.
- Where an answer looks wrong it is pinned as it is and recorded as a finding; the tests never fix the portal.
- Proof that the net catches a change: in SAFE-2b `marginAmount` in `reports.ts` was changed by 1 on purpose; the two margin pins failed, each showing `margin_amount: "383.00"` against `"384.00"` and the same for every row; the change was reverted.

To pin a new module: add `tests/pins/<module>.test.ts` with `pinEndpoint` for each endpoint of its route files (every role that may call it, one that may not), seed rows only where an answer would come back empty (synthetic, fixed ids in `tests/seed/`), run it twice from a fresh database, then break the code on purpose and watch it fail.

## Checks around the tests

| Check | Where | What |
| --- | --- | --- |
| **CI** | `.github/workflows/ci.yml` | On push and pull request to `multiple-login-demo`: job `static` (type checks of client and server, the client lint ratchet, server lint, file-size ratchet) and job `suite` (unit tests, then a local Supabase in Docker and the full suite). On push to the four production branches: `static` only, without the ratchet. Does not run on the public mirror (its branch is `main`, not listed). No secrets: the tests use a local database with fake vendor keys and record every message. A newer push cancels the run in progress. `workflow_dispatch` runs it by hand. |
| **File-size ratchet** | `scripts/check-file-size.sh`, `scripts/file-size-baseline.txt` | No new file over 300 lines, no listed file grows; a listed file that shrank (or was split or deleted) must have its entry lowered or removed with `scripts/check-file-size.sh --update` in the same commit, so the baseline only shrinks. `--staged` is what the hook runs; `--update` never adds or raises an entry. |
| **Pre-commit hook** | `scripts/git-hooks/pre-commit` | Turn it on once per clone: `git config core.hooksPath scripts/git-hooks`. On the staged files only: the file-size ratchet; Prettier; the type check of each package touched (server 4 s, client 12 s). It needs `pnpm install` in `client/` and `server/`. `git commit --no-verify` skips it; CI does not. |
| **Prettier** | `client` and `server` dev dependency (same exact version), `.prettierrc.json` at the repo root | **The repo is not formatted yet and must not be reformatted in one go** (every later cherry-pick across the six branches would conflict). So the hook is a ratchet: a staged file must be Prettier-clean if it is new or was clean in HEAD; a file that was not clean in HEAD may be committed as it is (the hook says how many). `server/tests/` and this session's files are formatted. Format by hand: `npx prettier --write <file>` in `client/` or `server/`. `.prettierignore` (one in each folder) skips snapshots, the guard fixture, `server/supabase` and lockfiles. |
| **Server lint** | `server/.eslintrc.cjs` | `pnpm lint` in `server/` now runs: typescript-eslint's recommended rules plus a few core ones, **all warnings** (about 314 on 2026-11-18, mostly `no-explicit-any` and unused variables); it fails only on an error. Tighten later rule by rule. **Client lint** (`pnpm lint` in `client/`) was found to fail already on 2026-11-18 (81 errors, 55 warnings: `no-explicit-any`, `exhaustive-deps` and a few more, none new), so CI runs `scripts/check-client-lint.sh`, a ratchet on those two counts (`scripts/client-lint-baseline.txt`): more fails, fewer fails until you lower the baseline with `UPDATE=1 scripts/check-client-lint.sh`. |
| **knip** | `knip.json` in `client/` and `server/`, `pnpm knip` | Reports unused files, exports, types and packages from the import graph. Reads only; nothing is removed by it. Per module, before a split, the unused code of that module is removed in its own commit. Notes: the client report flags exports only the server's unit tests import (`hybridPayrollSplit.ts`, `timesheetWeek.ts`); check before deleting. The first full report is linked from the SAFE-2b session report. |

Not covered yet: browser journeys (Playwright, they come with the Timesheets module), API pins for the other modules (each module's first refactor step), the Prettier formatting of the existing source. The tests are not type-checked (Vitest transpiles them).
