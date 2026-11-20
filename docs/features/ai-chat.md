# AI chat

Staff ask questions about their portal's data in plain words (English or French) and get an answer written from the database ("how many jobseekers are available this month?", "which clients bill in USD?"). It reads only. It never changes anything.

The page `/ai-chat` shows the AI service's own chat page in a frame. The service lives in the separate repository `godspeed-ops-ai` (FastAPI on Render, one service per portal); the portal's part is small: the frame, the sign-in token it hands to the frame, and the database functions of migration 037.

## Switching it on for a portal

**Status (2026-11-20): on in all four portals** (AllStaff, CanHire, Godspeed, GD Workforce): migration 037 applied, `CHAT_ENABLED=true` on each AI service, flag `ai_chat` on in each database. It stays off on the demo and public demo (no flag, stage database has the migration only). A new portal gets it in three steps, in this order:

1. Migration `037_ai_chat_read_layer.sql` applied to that portal's database ([migration_v2/README.md](../../server/src/db/migration_v2/README.md)).
2. On that portal's AI service (Render): `CHAT_ENABLED=true`, `CHAT_MODEL_NAME` (default `gpt-6.1-terra`), `ALLOWED_ORIGINS` (the portal's web address) and its OpenAI key. With `CHAT_ENABLED` off (the default) the page shows a notice and no question is answered. The portal's web app must point `VITE_AI_CHAT_URL` at that service (the built-in default is Godspeed's).
3. The feature flag `ai_chat` on in Feature Flags (shows the menu entry).

To switch it off again, turn the flag off and set `CHAT_ENABLED=false`.

## Who can use it and what they can read

Every internal staff role may open the chat; what a question can read depends on the role, mirroring the pages that role already sees ([role-access-control.md](../role-access-control.md)):

| Data (view) | Roles |
| --- | --- |
| Jobseekers (names, contact details, work facts, **pay and bill rates**) | `JOBSEEKER_LIST_ROLES` |
| Clients (company facts, terms, managers) | `CLIENT_LIST_ROLES` |
| Positions (job facts, rates) | `POSITION_LIST_ROLES` |
| Assignments | roles that see both jobseekers and positions |
| Timesheets (hours, pay and billing totals) | `TIMESHEET_MANAGEMENT_ROLES` |
| Invoices (totals, status, dates) | `INVOICE_MANAGEMENT_ROLES` |

**Never readable by the chat, for anyone:** SIN, date of birth, driving licence, passport and other ID numbers, bank details, uploaded documents and the document check, notes and free-text fields, street addresses, client contact people, passwords and tokens, the account tables, support tickets, consent records, activity and audit logs. The list of fields was approved by the owner on 2026-11-19; a test fails if a forbidden field ever appears in a view.

**Change the map in two places together:** `client/src/constants/accessControl.ts` and `ai_chat.entities_for` (and the grants beside it) in migration 037. `server/tests/access/ai-chat-read-layer.test.ts` reads the constants and fails when the two disagree. A user holding several roles gets the one that sees the most (never a mix).

## How it is protected

- **The database decides, not a word list.** A question runs as a database role (one per portal role) that can `SELECT` only that role's views in the private schema `ai_chat` and holds no write privilege anywhere; the transaction is read-only, rows are capped (200, never more than 500), the result size is capped, and every table the query plan touches must be a chat view. The service also parses the statement and allows only one `SELECT` over the listed views and a fixed list of functions; that is a second line, not the first.
- **No second sign-in, no service key.** The frame asks the portal for the signed-in person's own token and the portal sends it to the chat's own address only; it sends a fresh one whenever the sign-in renews (`client/src/lib/aiChatBridge.ts`). The AI service verifies it with Supabase and then calls the database functions `ai_chat_schema`, `ai_chat_run`, `ai_chat_claim` and `ai_chat_record_usage` as that person. The database refuses anyone who is not staff (role from `app_metadata`) and, while `staff_two_factor_enforced` is on, a sign-in session without a verified phone code.
- **Limits.** A per-portal daily number of questions (`CHAT_DAILY_QUESTION_LIMIT`, default 300, counted in the portal's own table `ai_chat_usage`, which also adds up the tokens spent per day), a per-person rate, a cap on question length, rows and result size.
- **What goes to OpenAI:** the question, the last few turns of the conversation, the description of the views the person may read, and the rows a query returned (names, contact details and rates included, as approved). Nothing is logged by the service: no token, question, query, row or answer.
- The page is framed only by the portal's address, loads nothing from other sites, and shows every answer as escaped text.

## What the page shows

The page (in the AI repo, `static/chat/`) is built to match the portal: black and white, the portal's borders and rounded cards, light and dark following the portal's theme (sent as a message, so switching never reloads the chat), English and French, a layout that works down to phone width, and reduced motion respected.

- **Suggested questions** on the empty screen are chosen from the views the signed-in person's role can read (the page asks `GET /chat/config`, which counts nothing against the daily limit and calls no model), so a role never gets a suggestion it cannot answer. Each suggested question was run against the real model on synthetic data before it was listed.
- **A thinking trace** above each answer shows the steps as they happen (reading the question, one line on how the question was understood, which kinds of data were looked up, writing the answer) with animation while it works, then folds to "Thought for N s" (click to open again). It costs no extra model call: the line on how the question was understood is part of the same plan the chat already makes. It never shows the query or any rows.
- When the data does not hold what a question needs (for example availability by date, which is not stored: only Full-Time/Part-Time and a weekend flag), the chat says what is missing and offers one or two related questions it can answer.
- The answer streams in; tables are shown as tables.

## Tests

`server/tests/access/ai-chat-read-layer.test.ts` (roles, forbidden tables and fields, writes, phone code, limits; each protection was broken on purpose and caught), `server/tests/unit/aiChatBridge.test.ts` (the token goes only to the chat frame), `e2e/tests/ai-chat.spec.ts` (the token arrives with no extra step and a renewed one keeps the chat working, EN and FR; the chat page there is a stand-in, `e2e/support/ai-chat-stand-in.mjs`), and in the AI repo `tests/offline`, `tests/local` (real local database) and `tools/chat_eval.py` (model and cost). `e2e/tests/ai-chat-real.spec.ts` runs the portal against the real service by hand.
