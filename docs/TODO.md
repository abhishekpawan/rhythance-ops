# To do

Everything pending, in one place. Add an item when you find work; tick it and delete it (or move its design into `docs/features/`) when it ships.
Last reorganised: November 2026, when the old jobseeker-dashboard plan was retired. What that plan *did* deliver is now documented in [portals-and-configuration.md](portals-and-configuration.md); only what it left undone is below.

Labels: **Owner** = needs a decision or action from the owner, not code. **Info** = blocked on an answer. **Idea** = optional.

---

## 1. Decisions and actions for the owner

- [x] **Turn on the jobseeker payroll cards for CanHire and GD Workforce.** Done Nov 6, 2026: the flag `jobseeker_payroll_summary` was switched on directly in both production databases, and both seed files now list it. Not yet looked at on the live portals (see section 4).
- [x] **Confirm what "Gross Amount" means.** Done Nov 6, 2026: the client confirmed "gross is no deduction", which is how it is built (regular + overtime + bonus, before deductions). Checked on a demo jobseeker whose timesheet has a $25 deduction: the card shows $17,256.00, paid out was $17,231.00, a difference of exactly $25.
- [ ] **Public demo shows Motion Falcon text instead of Rhythence** (https://demo.rhythence.com). The public site's images are Rhythence but the brand name, tab title and logo alt text come from the demo's backend, which has no `public-main` build and shares the demo database. Options: (1) deploy a second backend from `public-main` on the same database (no code change), or (2) give the public demo its own database. The first visit also waits about 17 seconds while that backend wakes up. Postponed by the owner on Nov 6, 2026 ("not important right now"). (Owner)

## 2. Portal settings: retire the environment-variable fallbacks

Settings are in the database and the pages work; the environment variables are still the fallback on purpose.

- [ ] On each of the four production portals, open Portal Settings and confirm **no field says "From environment"**. That label is the checklist.
- [ ] Then delete these variables from each backend's hosting environment: `PORTAL_NAME`, `NO_REPLY_FROM_EMAIL`, `ASSIGNMENT_FROM_EMAIL`, `DEFAULT_FROM_EMAIL`, `INVOICE_CC_EMAILS`, `SUPPORT_NOTIFY_TO`, `SUPPORT_NOTIFY_CC`; then remove the `envFallback` entries in `server/src/config/portalSettings.ts` and the lines in `server/.env.example`.
- [ ] **Idea:** move brand images (logos, favicons) out of the branches into storage, loaded at runtime. Recommendation was to leave images in the repo: they are a small, stable difference, while runtime loading costs a flash on the login page, extra work for invoice PDFs and emails, and the tab title/favicon cannot change at runtime without extra work. Only do it if the branches must become fully identical.
- [ ] **Idea:** split `jobseeker_profile_godspeed_rules` into smaller flags (licence number required, SIN document required, ID document rule, availability optional) if a portal ever wants only part of the lighter rules.
- [ ] Portal switcher links in the seeds still use the old addresses `app.hiresolutions.ca` and `app.hdgroup.ca`; they redirect today. Update the values on the Portal Settings pages and the seed files when convenient.

## 3. AI credit alert and "Integrations health" card (planned, no code yet)

Requested by Sid (November 2026) after the system stopped when the OpenAI credits ran out. Independent of the jobseeker dashboard work; it uses the editable settings for thresholds.

**Request.** An AI balance indicator in the Admin panel that alerts below **5 USD** (editable by the admin), and the same idea for other third-party vendors, with subscription/renewal dates where they apply.

**What the code shows today.**
- The AI lives in the separate repo `godspeed-ops-ai` (FastAPI, hosted on Render). Each portal's client points to its own hosted AI service (addresses in `client/src/components/FloatingChat.tsx` and via `VITE_AI_CHAT_URL` for `GodspeedAIChat.tsx`; the portal server reads `AI_VERIFICATION_URL`).
- It uses **OpenAI** (`gpt-4o` document verification, `gpt-4.1-mini` chat, `gpt-4.1-nano` query understanding) and **Groq** (database and visualisation agents).
- `services/openai_service.py` catches errors broadly and only logs: a quota error is **not detected or reported**, so the outage was silent. There is no `/health` endpoint.
- Other vendors: **Supabase**, **Twilio** (SMS verify), **SendGrid** (email), **Render** (AI hosting). Domain/DNS and web hosting are not visible in the repo.

**What each vendor lets us read** (checked November 2026 unless noted):

| Vendor | Pricing | Live data |
| --- | --- | --- |
| Twilio | usage-based | Balance API exists (`GET /2010-04-01/Accounts/{AccountSid}/Balance.json`); may lag; meaningful only for prepaid accounts |
| SendGrid | plan credits | `GET /v3/user/credits` returns remaining and total credits; required API-key permission not yet checked |
| OpenAI | prepaid | **No supported balance API.** Only spend, via the Costs API (admin key), so an *estimate* with admin-entered top-ups |
| Groq | usage-based | No balance endpoint found (not confirmed); failure detection only |
| Supabase, Render, domain, hosting | fixed monthly | Nothing to pull |

**Why not a renewals table.** For fixed-price vendors the only data is a hand-typed renewal date: a spreadsheet inside the portal that goes stale, while vendors already email the account owner before renewing and a shared calendar reminder does the same for free. The real outage risk is the **usage-based** vendors, which stop without warning.

**Recommended design:** an "Integrations health" card in the Admin panel. Per service (OpenAI, Groq, Twilio, SendGrid): status (OK, or failing since a time with the reason), balance where available, editable alert threshold, email alert. Each portal has its own database, so thresholds, events and top-ups are per portal. Visible to `admin`; thresholds editable by `admin`; rollout can be gated by a flag (`admin_integrations_health`).

- [ ] **Step 1: failure detection (all vendors, no balance API needed; ship first, about 3-4 h).**
  - AI service: catch OpenAI/Groq `insufficient_quota`, 429 and 401 and return a clear code (`AI_CREDITS_EXHAUSTED`) instead of a generic failure; add a small `/health` endpoint.
  - Portal server: wrap the Twilio and SendGrid calls the same way and record per service the last OK, last failure and reason.
  - Email the admin(s) once per incident (de-duplicated), show a red status in the Admin panel, and give users a friendly message instead of a silent failure.
- [ ] **Step 2: balances and early warning (about 4-5 h; needs a Twilio/SendGrid permission check and an OpenAI admin key).**
  - Twilio: show the live balance, alert below the threshold. SendGrid: show remaining credits, alert below the threshold.
  - OpenAI: **estimated balance** = admin-entered top-ups (amount and date) minus spend from the Costs API, with the **admin key kept as an environment secret** (never in the database); alert below the threshold (**default 5 USD**, stored in portal settings). Label it *estimated*: credit expiry, other projects in the same OpenAI organisation and cost-data delay can make it drift.
  - Also have the OpenAI account owner turn on auto-recharge and low-balance emails in OpenAI's billing settings (not verified yet).
- [ ] **Step 3 (idea, only if still wanted, about 2-3 h):** a small manual "vendors and renewal dates" list with reminder emails; its value depends on someone keeping it current.

Total about 1.5 working days without step 3.

**Questions to answer first** (Info):
1. Do all four portals share one OpenAI account and key, or does each portal's AI service have its own? (One card, or one per portal.)
2. Which admin addresses receive the alert emails?
3. Will the OpenAI account owner create an admin key for the estimate, or are step 1 plus OpenAI's own auto-recharge and alerts enough for now?
4. Are the Twilio and SendGrid accounts prepaid or credit-based, so that a balance is meaningful?
5. Does Sid still want the optional renewals list?

## 4. Checks from the November 2026 test run that were not completed

The browser test run (read-only on production, writes only on the demo database) passed everything it covered. These were left:

- [ ] **SendGrid verified senders:** confirm each portal's sender addresses (no-reply, assignment, default) are verified in SendGrid. SendGrid was not signed in in the browser at the time. Nothing is sent by checking.
- [ ] **Render:** confirm each portal's latest deploy is the current branch tip and the environment keys listed in section 2 are still present until you retire them. Services were seen "Deployed", but commit match and keys were not checked.
- [ ] Envelope printing reports: compare CSV/print output with the screen (A4); the numbers on screen were verified.
- [ ] Create an invoice through the wizard with the company fields cleared in Portal Settings (B5): code-checked only.
- [ ] Training video playback on each portal; consent page logo and alt text; the French labels of the payroll cards on screen (they exist in the locale files).
- [ ] Jobseeker dashboard and the dashboard subtitles on the live portals. The payroll flag is now **on** for CanHire and GD Workforce (look at the two cards there with a real jobseeker) and still **off** for AllStaff and Godspeed (no cards expected). Verified so far only through the API and on the demo, where the cards showed 205 hrs and $4,250.00 for the test data.
- [ ] **Jobseeker "My Profile" link:** fixed and pushed to all six branches on Nov 6, 2026 (commit "My Profile opens the jobseeker's own profile"; the `/jobseekers/:id` route did not allow the jobseeker role, so the link bounced to the dashboard, as it had since April). After the deploys, log in as a jobseeker on each portal and confirm the profile opens. Not seen working yet.
- [ ] **Remove the demo test data** created for the client screenshot on the demo database (the owner will say when): profile `7ba9d34e-45e8-47c4-ba77-d7593adbb47d` (account `abhishekpawan297@gmail.com`) with its 5 timesheets and 4 position assignments, consent record `e96b6d96-8a84-4344-8c5b-995f67db0313`, the `jobseeker_payroll_summary` row in the demo `feature_flags` (it was absent before), and on that login the two metadata flags `employment_agreement_signed` and `hasProfile`.
- [ ] Minor: dates on the Portal Settings page stay English-style when the page is in French.

## 5. Security and permissions

- [ ] **Rate limiting is switched off.** The global limiter is commented out in `server/src/index.ts` and most route-level limiters are commented out, including public consent and auth-adjacent endpoints. Decide limits, switch them on, and wire (or delete) the unused `RATE_LIMIT_*` variables.
- [ ] **Make the server roles match the pages**, or the reverse (see the table in [role-access-control.md](role-access-control.md#where-the-server-is-looser-or-stricter-than-the-ui)):
  - Creating a consent request: the UI offers it to admin, recruiter, recruiter manager and recruiter director, the API accepts only a super admin, so they get a 403 on submit.
  - Dropdown options: the UI offers add/change/delete to managers and directors, the API accepts only `admin` for those.
  - Invite and resend invitation: the UI offers it to managers and directors, the API accepts only `admin`.
  - `authorizeRoles(["recruiter"])` accepts every internal role, so reports, invoices, users, clients and positions can be called by roles that the UI does not show.
- [ ] 2FA: the password is carried through client route state during the second step. Replace with a short-lived server-side step.
- [ ] If the floating AI chat is ever re-enabled it renders markdown through `dangerouslySetInnerHTML` with sanitisation disabled; sanitise first.
- [ ] Consent links do not expire (the `expired` status is never set) although the email text mentions expiry. Either enforce an expiry or reword the email.

## 6. Product gaps (from the audit)

- [ ] **Calendar:** switch the client/jobseeker filter panel back on (`CalendarFilters` is commented out in `CalendarPage.tsx`; the API already filters).
- [ ] **AI insights:** the monthly "documents scanned" chart shows zeros because `ai_validation` has no `created_at`. Add the column and uncomment the code in `server/src/routes/aiInsights.ts`.
- [ ] **Training:** no completion tracking, and four modules are "coming soon".
- [ ] **Timesheets:** the document-upload API (`updateTimesheetDocument`, `PATCH /api/timesheets/:id/document`) exists but nothing calls it, so a signed timesheet scan cannot be attached; the "Total Pay" column header in the list is hard-coded English.
- [ ] Jobseekers list has no bulk actions; list filters reset when you leave and return; no in-app notifications.
- [ ] Several list and report endpoints fetch broadly and filter in application code; fine today, slow later. The client bundle is very large.
- [ ] Report exports are CSV only.

## 7. Clean-up

- [ ] Remove the debug `console.log` calls in `client/src/components/AppHeader.tsx`.
- [ ] `server/src/utils/encryption.ts` is not imported anywhere, yet refuses to load without `ENCRYPTION_KEY`/`ENCRYPTION_IV`. Delete it or use it.
- [ ] `server/src/routes/jobseekers.ts` registers a dead duplicate `/api/profile/check-email` route (the working one is in `profile.ts`).
- [ ] Add `VITE_AI_CHAT_URL` to `client/.env.example`; replace the hard-coded chat addresses in `FloatingChat.tsx` (and the default in `GodspeedAIChat.tsx`) with environment values.
- [ ] Legacy role names `manager` and `accountant` are still normalised in several code paths; migrate the stored data and drop the aliases.
- [ ] The `bulk_timesheets` table is unused by the app.
