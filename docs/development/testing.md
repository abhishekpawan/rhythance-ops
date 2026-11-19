# Testing

Run `pnpm test` in `server/` and you get: a fresh local Supabase built from the repo's own migrations, filled with synthetic data, the real server running against it, and every message it tries to send recorded instead of sent. Nothing touches a real database or a real person.

## Run it

Needs, once per machine: Docker (on a Mac: Colima, `colima start`), the Supabase CLI, `psql`, Node 24 (the repo's engine; `fnm install 24`) and `pnpm install` in `server/`.

| Command (in `server/`) | What it does |
| --- | --- |
| `pnpm test` | Everything: starts the local Supabase if it is not running, rebuilds the database, seeds it, starts four test servers (real clock, fixed clock, staff two-step login forced on, low phone-code rate limits), runs all tests. About 45 seconds once the images are pulled; the first start pulls images (about 15 minutes). |
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
| `tests/schema/` | `listing.sql` lists a database's structure (tables, columns, constraints, indexes, functions, triggers, policies, grants, buckets, jobs); `production-listing.txt` is production's, taken read-only; `compare.mjs` and `schema.test.ts` compare them (`files-ahead-of-production.txt`: objects the files create that production lacks; `changed-ahead-of-production.txt`: a newer definition in the files of something production has; both lists shrink as migrations reach production and a stale entry fails). Migrations 032 to 035 are run twice and must change nothing. `position-dates-sync.test.ts` (migration 028) and `matching-one-row-per-candidate.test.ts` (036) run SQL against the built database inside a rolled-back transaction. |
| `tests/access/` | Against the real server and directly against the local Supabase, each time with the user's own token: the role comes from `app_metadata` (a jobseeker who edits their own `user_metadata` to admin is still refused; staff who edit theirs to jobseeker stay staff; open sign-up gives the jobseeker role); a jobseeker cannot list, download, replace or delete another jobseeker's files, nor read signed consents or invoice files; with the anon key alone nothing can be listed or read; each staff role sees all jobseekers' documents and profiles; what each role gets from the server; `staff-two-factor.test.ts`: the staff two-step login (below). |
| `tests/pins/` | **API pins**: for each of the nine Reports endpoints (`server/src/routes/reports.ts`) the real server's answer to a set of requests, stored in `tests/pins/__snapshots__/<endpoint>/NN-<case>.json` (status and body, run-time ids and timestamps replaced by placeholders), the same answer from every one of the nine staff accounts, and the refusal of a jobseeker (403), of no token (401) and of a bad token (403). Dates are asked on the fixed-clock server. See "API pins". |
| `tests/pins/support-*.test.ts` | **Support API pins** (below): all nine endpoints of `server/src/routes/support/`, asked as the eight staff roles and a jobseeker, the validation answers, the status moves the database allows and refuses, and the messages the server sends. |
| `tests/guard/` | The local-only guard, the outbound guard (below), the fixed clock, the test server's environment. |
| `tests/seed/` | The synthetic data (below). |
| `tests/support/` | Guard, stack helpers, outbound recorders, test server, API helpers. |

## The synthetic data

`tests/seed/`: one account per role (admin, super admin, recruiter, bookkeeper, recruiter manager, accountant manager, sales, recruiter director), made through the local auth API with the role in **`app_metadata`**; five jobseekers with profiles; one jobseeker made through open sign-up (so the 034 trigger gives it the role). `data.sql` has four clients (Ontario, Quebec, British Columbia, Alberta in USD), positions (ordinary, overtime after 40 h, invoicing-only subcategory, premium pay rate, ended), assignments, nine timesheets and five invoices: SIN direct deposit, cash with a 10% deduction, hybrid SIN + cash and SIN + e-Transfer (hours cap, two rows, bonus on the SIN row), a corporation with HST; a fifth invoice (900006) written with every field the reports read, one discount and one deduction line (a negative bill rate); invoices taxed per province (HST 13%, GST 5% + QST 9.975%, GST 5%, zero rated). The inactivity triggers overwrite `last_activity_at` on insert, so the end of `data.sql` puts the intended dates back (triggers off for that statement): one client (77 days) and one jobseeker (93 days) are inactive on the fixed clock, the others are not. Five support tickets (`SUPPORT` in `ids.mjs`, numbers 1 to 5): in progress with an agent reply, an internal note and two files; resolved; waiting on the client; closed; open and blocked; all with fixed dates before the fixed clock. Files: ID documents of two different jobseekers, a signed consent, an invoice file. Addresses end in `@example.test`, phones are +1 555, every id is fixed. Nothing is copied from a real database, so it travels to every branch.

## Messages, AI and the clock

The test server is started with three preloads (`node --import`), so **the server's source is unchanged**:

- `outbound-guard.mjs`: `@sendgrid/mail` and `twilio` are replaced by recorders (each call becomes a line in the file named by `TEST_OUTBOUND_LOG`; the only SMS code a check approves is `000000`); every socket that is not to localhost is refused, which covers `fetch`, `http`, `https` and anything built on `net`, and each refusal is recorded too. `AI_VERIFICATION_URL` points at a local stand-in (`ai-stub.mjs`).
- `fixed-clock.mjs`: with `TEST_FIXED_NOW` set, "now" stands still (10:00 on 17 November 2026 in Toronto). The second test server has it, for date-based answers. The default server uses the real clock, because code that compares "now" with a timestamp the database wrote (for example a ticket created less than 30 seconds ago) needs the two to agree.

`tests/guard/outbound.test.ts` runs a probe that tries every route out (SendGrid, Twilio, OpenAI by `fetch`, `https.request`, `http.request`, raw `net`) and checks each is blocked or recorded.

## The phone-code and sign-in tests

`tests/access/phone-code-endpoints.test.ts` (session needed for `verify-otp` with a `userId`; the rate limits), `tests/access/sign-in-error-codes.test.ts` (the `code` of each sign-in answer), `tests/access/feature-flags-client.test.ts` (the browser gets only the flags marked `clientVisible`) and `tests/unit/authErrorCodes.test.ts` (every server code has an English and a French text). The rate-limit tests call the fourth test server, started with `OTP_*_LIMIT_*` values of 3 per number and 6 per address (`server(path, { limited: true })`); the browser journeys start theirs with very high limits because every seeded staff account shares one phone number. The test seed stores `staff_two_factor_enforced` as `enabled=false` (like the stage database) because the registry default is now on.

## The two-step login tests

`tests/access/staff-two-factor.test.ts` runs against two servers: the normal one (feature flag `staff_two_factor_enforced` off, today's behaviour) and a third one started with `TEST_FORCE_FLAGS=staff_two_factor_enforced`, where the preload `tests/support/force-flags.mjs` adds the override to the server's read of the flag table for that process only (the database is not touched, so the other test servers keep the default). Use `server(path, { twoFactor: true })` to call it; its recorded SMS checks are in `inject("twoFactorOutboundLog")`.

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

### Support pins

`tests/pins/support-{read,create,messages,actions}.test.ts` with the helpers in `support-helpers.ts`. Support answers **404, never 401 or 403**, to a signed-in person who may not do something (the client signs a user out on those), so these pins are written per role instead of with `pinEndpoint`:

- **Who may do what** (from the routes and `src/services/support.permissions.ts`): any staff role may raise a ticket, a jobseeker may not (404); the agent is the super admin; shared viewers (admin and the three recruiter roles) may list and open every ticket but write only on their own; only the owner may confirm; owner and agent may reopen; only the agent may change status, priority, title, assignee or hours (PATCH); files are visible to the owner, admins and the agent, and a file on an internal note to the agent alone. Each test states this in a line of code worked out from the route, then stores the answers.
- **Reads** (`support-read.test.ts`) ask the five seeded tickets as every account on the fixed-clock server and store `{ role: { status, answer } }` per case in `__snapshots__/api-support-<endpoint>/`. It first removes any ticket the other files made, so the read pins always see the five seeded ones.
- **Writes** run a `Scenario` (`support-helpers.ts`): a run of requests whose answers are stored together with the messages the server recorded while it ran (recipients and subject only; ticket numbers above the seed and ids become placeholders; the minutes a ticket has been open are checked and replaced). `result(n)` fails unless exactly `n` support messages were sent, the ones that set the scene included. Every test makes its own tickets: the seeded five are never changed.
- **Rate limits** (10 new tickets, 30 messages and 30 upload links per user per hour, every request counted, `src/middleware/supportRateLimits.ts`) belong to the test server, which every file shares. `as()` keeps a count per role in a file beside the message log and stops a test with a clear message before it would be refused; each file uses different roles for the tickets it makes. The one test of the limit itself (`support-create.test.ts`, the eleventh request) uses the `sales` account and calls the server directly.
- Proof the net catches a change (R-2): showing internal notes to non-agents, accepting a confirm on a ticket that is not resolved, changing the `SUP-` in the subject and letting admins patch each failed the pins.

## Browser journeys

`pnpm test:e2e` in `e2e/` drives a real browser (Playwright, Chromium only) through the portal against the same local test database: it builds and seeds the database, starts the real server (fixed clock, every message recorded) and the client (the Vite dev server, source unchanged) on this machine, and opens the screens like a person. It replaces clicking through a module's screens by hand (step 5 of the routine in [code-structure.md](code-structure.md)).

| Command (in `e2e/`) | What it does |
| --- | --- |
| `pnpm install`, `pnpm test:e2e:install` | Once per machine: the dependencies, and the Chromium download (about 100 MB, kept in `~/Library/Caches/ms-playwright`). Needs Node 24, Docker (Colima) and the Supabase CLI like `pnpm test`. |
| `pnpm test:e2e` | Everything: fresh database, servers, all journeys. About 3 to 4 minutes on this Mac (3 browsers at a time, 97 tests). |
| `E2E_REUSE_DB=1 pnpm test:e2e tests/reports.spec.ts -g "margin"` | Keeps the database of the last run and runs part of the journeys (faster while writing one). |
| `pnpm test:e2e:update` | Rewrites the text snapshots (see below) after a change that was meant. |
| `pnpm exec playwright show-trace test-results/<test>/trace.zip` | What a failed journey did, step by step (traces and screenshots are kept only for failures). |
| `pnpm typecheck` | Type check of the journeys. |

**Where it lives and why.** In its own folder, `e2e/`, with its own `package.json` and lock file, not in `client/` or `server/`: Vercel builds `client/` and Render builds `server/` (its `postinstall` compiles it), so a Playwright dependency in either would change what those builds install. `e2e/` is read by neither. It reuses the server's test scripts (`server/tests/scripts/`, `server/tests/support/`) and the seed, so there is one database recipe.

**It can only run on this machine**, the same rules as the database tests, plus the browser's side:

- `support/start-client.mjs` starts the client with its own explicit environment: the Supabase and API addresses come from the test scripts and never from `client/.env` (Vite is told to look for `.env` files in an empty folder). It refuses with **exit code 2** unless `VITE_SUPABASE_URL`, `VITE_API_URL` and `VITE_AI_CHAT_URL` are localhost, `127.0.0.1` or `::1` (the same `requireLocal()`); `tests/guard.spec.ts` proves it for each address.
- The test server's `CLIENT_URL` (its CORS rule) is set to the client's own address and port (`startTestServer(stack, { clientUrl })`). The client's port is free-picked each run.
- **Every request from the browser to a host other than localhost is aborted and counted** (`support/outside-requests.ts`). A test **fails** if the page tries a host that is not in `KNOWN_OUTSIDE_HOSTS`, so a new font, CDN, analytics script or API call is noticed at once. Known hosts are still aborted, never let through. Today the only one is `fonts.googleapis.com` (the Inter font `@import` in `client/src/styles/main.css`, every page); the AI chat widget would add `cdn.jsdelivr.net` (marked, prism) when it is opened, which no journey does. The run prints what was tried at its end.

**What is covered.**

| File | What |
| --- | --- |
| `tests/sign-in.spec.ts` | The eight seeded staff accounts (admin, super admin, recruiter, bookkeeper, recruiter manager, accountant manager, sales, recruiter director) sign in through the real form and the phone code (the stand-in approves `000000`), in English and in French: they land on `/dashboard` with the right heading and role label; the Reports menu opens (nine cards) for the roles in `REPORTS_ROLES` and sends the others back to the dashboard. Two jobseekers (seeded and open sign-up) land on the employment agreement page (the seed has not signed it). A wrong password; the language switch on the login page. |
| `tests/reports.spec.ts` | Every Reports screen (all nine), as the admin and as the accountant manager, in English and in French: the filters set like a person does, **the request body the browser sends** compared with the one worked out from the screen's code, the table as plain text, the CSV file the button downloads. The two roles must show the same, so the snapshots are per screen and language (`tests/__snapshots__/reports/`). |
| `tests/support.spec.ts` | **Support**, in English and French, in one file whose tests run one after the other (the list screens read the five seeded tickets, so nothing may be created before they have been read). Reads: the list (my tickets, all tickets, one status) as admin, the empty list of the agent, a bookkeeper's list without the scope switch, ticket 1 as its owner, as an admin who does not own it (read only, no internal note) and as the agent (internal note, panel, status history), a resolved ticket and a closed one as their owners, a ticket that is not the person's own, and the file's download link. Then one ticket's life: the owner raises it with a file (the request body, the support address told), replies, the agent's internal note and a status change from the panel (bodies and messages checked), the owner says it is not fixed, the agent resolves it again, the owner confirms. Snapshots in `tests/__snapshots__/support/`; a ticket made by a journey has its dates and number masked. |
| `tests/guard.spec.ts` | The local-only proof above. |
| `tests/auth.setup.ts` | Signs the Reports and Support accounts in once and saves their browser state in `e2e/.auth/` (git-ignored). |

**The request-body pattern (for the Timesheets and Invoices money journeys).** `tests/reports.spec.ts` starts `page.waitForRequest(...)` for the POST to the screen's endpoint whose JSON body equals the expected one *before* touching the screen, drives the filters, then `expect(request.postDataJSON()).toEqual(expected)` and checks the answer was 200. The expected body is written by hand from what the screen's code holds (`support/report-screens.ts`), never copied from a run. For a money screen the same code captures the invoice or timesheet payload the browser sends and pins the totals to the cent.

**Snapshots** are plain text (`tests/__snapshots__/`): the table as `HEADER:` and `ROW:` lines (cells joined by ` | `) and the CSV file as downloaded (without the byte-order mark). **A snapshot that changes is a change in behaviour**, exactly like an API pin: read the diff before deciding. During a refactor none may change. CI never writes a missing snapshot (it fails). Reports whose rows have equal sort keys (weekly timesheet, rate list, both envelope reports; inbox 12) are compared with their rows sorted, the serial column left out and the running number of the envelope reference masked (`NW-20261107-NNN`), because the server answers ties in no fixed order; the API pins hold the rest.

**No fixed sleeps.** Every wait is for something the page shows or sends: a URL, an element, a request, the end of network activity. The two places that retry (opening a dropdown whose list is still being fetched, typing the phone code) retry a check, not a delay. The browser's clock stands still at the server's moment (10:00 on 17 November 2026 in Toronto, `context.clock.setFixedTime`; timers keep running), so the week lists and default dates are the same on every run.

**Writing a journey.** Copy the shape of `support/report-screens.ts`: how the screen is driven, and the body it must send. Two things made journeys unsteady and are handled in `tests/reports.spec.ts`: several Reports screens ask the server again after every filter, and nothing stops an older answer arriving after a newer one, so (1) drive the filters so that the last one set is the one that triggers the single request (the envelope screens start with default dates or a default due date: set those first, the client last), and (2) read the table only when the page is quiet and the last request the screen made is the expected one. Every run attaches the list of requests and the order of the answers (`requests` attachment), which is what to read when a journey fails. The three checks that follow a change on purpose (a wrong column format, a wrong request body, a role removed from `REPORTS_ROLES`) each failed the journeys when tried in SAFE-3.

**Steadiness.** Five runs from a freshly built database and one with the CI settings (`CI=true`: two browsers at a time, snapshots never written) were all green, 112 to 133 seconds each.

**CI** (job `journeys` in `.github/workflows/ci.yml`): on push and pull request to `multiple-login-demo`, only when `client/`, `e2e/`, the test server and seed (`server/tests/support`, `server/tests/seed`, `server/tests/scripts`, `server/supabase`) or the workflow changed, or when started by hand (`workflow_dispatch`). The Chromium download is cached by the Playwright version in `e2e/pnpm-lock.yaml`. A failed run uploads `e2e/test-results` (traces, screenshots) for 7 days.

**Known limits.** The seeded jobseekers have not signed the employment agreement, so journeys cannot reach the jobseeker dashboard yet; `Select All`, `Deselect All` and `Search options...` in the dropdown widget are English in French (not changed). The staff sign-in currently sends the phone code twice (see inbox) and the login page shows no error for a wrong password (pinned in `sign-in.spec.ts`).

## Checks around the tests

| Check | Where | What |
| --- | --- | --- |
| **CI** | `.github/workflows/ci.yml` | On push and pull request to `multiple-login-demo`: job `static` (type checks of client and server, the client lint ratchet, server lint, file-size ratchet) and job `suite` (unit tests, then a local Supabase in Docker and the full suite). On push to the four production branches: `static` only, without the two ratchets (file size and client lint: those branches lack the demo-only files, so their counts differ). Does not run on the public mirror (its branch is `main`, not listed). No secrets: the tests use a local database with fake vendor keys and record every message. A newer push cancels the run in progress. `workflow_dispatch` runs it by hand. |
| **File-size ratchet** | `scripts/check-file-size.sh`, `scripts/file-size-baseline.txt` | No new file over 300 lines, no listed file grows; a listed file that shrank (or was split or deleted) must have its entry lowered or removed with `scripts/check-file-size.sh --update` in the same commit, so the baseline only shrinks. `--staged` is what the hook runs; `--update` never adds or raises an entry. |
| **Pre-commit hook** | `scripts/git-hooks/pre-commit` | Turn it on once per clone: `git config core.hooksPath scripts/git-hooks`. On the staged files only: the file-size ratchet; Prettier; the type check of each package touched (server 4 s, client 12 s). It needs `pnpm install` in `client/` and `server/`. `git commit --no-verify` skips it; CI does not. |
| **Prettier** | `client` and `server` dev dependency (same exact version), `.prettierrc.json` at the repo root | **The repo is not formatted yet and must not be reformatted in one go** (every later cherry-pick across the six branches would conflict). So the hook is a ratchet: a staged file must be Prettier-clean if it is new or was clean in HEAD; a file that was not clean in HEAD may be committed as it is (the hook says how many). `server/tests/` and this session's files are formatted. Format by hand: `npx prettier --write <file>` in `client/` or `server/`. `.prettierignore` (one in each folder) skips snapshots, the guard fixture, `server/supabase` and lockfiles. |
| **Server lint** | `server/.eslintrc.cjs` | `pnpm lint` in `server/` now runs: typescript-eslint's recommended rules plus a few core ones, **all warnings** (about 314 on 2026-11-18, mostly `no-explicit-any` and unused variables); it fails only on an error. Tighten later rule by rule. **Client lint** (`pnpm lint` in `client/`) was found to fail already on 2026-11-18 (81 errors, 55 warnings: `no-explicit-any`, `exhaustive-deps` and a few more, none new), so CI runs `scripts/check-client-lint.sh`, a ratchet on those two counts (`scripts/client-lint-baseline.txt`): more fails, fewer fails until you lower the baseline with `UPDATE=1 scripts/check-client-lint.sh`. |
| **knip** | `knip.json` in `client/` and `server/`, `pnpm knip` | Reports unused files, exports, types and packages from the import graph. Reads only; nothing is removed by it. Per module, before a split, the unused code of that module is removed in its own commit. Notes: the client report flags exports only the server's unit tests import (`hybridPayrollSplit.ts`, `timesheetWeek.ts`); check before deleting. The first full report is linked from the SAFE-2b session report. |

Not covered yet: browser journeys for the modules other than sign-in and Reports (each module's first refactor step; Timesheets and Invoices also need the money journey), API pins for the other modules (each module's first refactor step), the Prettier formatting of the existing source. The tests are not type-checked (Vitest transpiles them).
