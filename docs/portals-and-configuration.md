# Portals and per-portal configuration

One codebase serves several branded portals. This page explains how they are deployed, what is allowed to differ between them, and the two systems that hold per-portal differences: **feature flags** and **portal settings**.
Status: both systems are live on every portal (November 2026).

## The portals

Every portal is its own deployment **with its own Supabase database** and its own backend service. The code is the same; only the data, a few image files and the hosting environment differ.

| Portal | Branch | App address | Notes |
| --- | --- | --- | --- |
| AllStaff | `allstaff-production` | app.allstaff.ca | |
| CanHire | `canhire-production` | app.canhiresolutions.ca | the older address app.hiresolutions.ca redirects here |
| Godspeed | `godspeed-production` | app.godspeedxp.com | shown to users as "Godspeed Workforce" |
| GD Workforce | `hdgroup-production` | app.hdgroup.ca | HD Group was renamed GD Workforce; the branch name is the old one |
| Demo | `multiple-login-demo` | demo deployment | integration branch, also the demo; has the demo widgets and the demo database |
| Public demo | `public-main` | demo.rhythence.com | public mirror repo `rhythance-ops`, brand "Rhythence"; shares the demo's database and backend |

`demo-production` also exists on the remote but is out of scope.

### Branch model

- New work is built and committed on **`multiple-login-demo`**.
- It is then copied commit by commit (cherry-pick, never a merge) to the four production branches and `public-main`. The procedure is in [automated-tasks/sync-commit-to-production-branches.md](automated-tasks/sync-commit-to-production-branches.md).
- Formatting follows `.prettierrc.json` (double quotes, 2 spaces, 80 columns). Use format-on-save, otherwise whitespace noise returns and makes cherry-picks conflict.

### What may differ between branches

Measured against `multiple-login-demo` (November 2026), the production branches differ only by:

- **Brand image files** in `client/src/assets/` (logos, header/login/invoice/consent pictures).
- **Demo-only code that is removed from production**: `DemoAutoFillWidget`, `DemoLoginModal`, and demo hooks in the login, client-create, position-create and profile-create pages, `lib/auth.ts`, `button.css`, `demo-login-modal.css`.
- Godspeed's `client/index.html` (tab icon and the title shown before settings load).
- `public-main` also has the Rhythence brand defaults in `server/src/config/portalSettings.ts` and does **not** carry `server/src/db/seeds/`.

Everything else (behaviour, wording, company details, legal text, training videos, email addresses) is the same code driven by flags and settings. **Do not add new per-portal code forks**: add a flag or a setting instead.

## Feature flags

An on/off switch for behaviour that only some portals want.

- **Registry in code:** `server/src/config/featureFlags.ts` lists every flag with title, description, category, `defaultEnabled`, the intended state per portal, and optional text settings (stored in the flag's `config`). Adding a flag never needs a migration; a flag without a database row uses its default; unknown database rows are ignored.
- **Storage:** table `feature_flags` (key, enabled, config, updated_by, updated_at) in each portal's database. Migrations `029_feature_flags.sql` and `030_feature_flags_config.sql`. Row-level security is on with no policies, so only the server (service role) can read or write it.
- **Server:** `isFeatureEnabled(key)` in `server/src/services/featureFlags.ts` (30-second cache). Use it to **refuse** sensitive data when a flag is off; hiding in the UI is not security.
- **Client:** `useFeatureFlag("key")` and the `<FeatureGate flag="..." />` route guard (`FeatureFlagsContext`). A gated page that is off redirects to `/login`, like any unknown address.
- **API:** `GET /api/feature-flags` (any logged-in user), admin routes under the same path for **super admins only** (`requireSuperAdmin`).
- **Page:** `/feature-flags`, visible to super admins only: each flag with its state, where the value comes from (default or this portal's override), who changed it and when, a toggle, a reset button, and the flag's text settings.
- Flag and settings changes are deliberately **not written to the activity log** (decision: these are hidden switches).

### Current flags

| Flag | What it does | Default | On for |
| --- | --- | --- | --- |
| `jobseeker_payroll_summary` | "Total No. Hours" and "Gross Amount" cards on the jobseeker dashboard (hours = regular + overtime; gross = pay before deductions). The API refuses the numbers when off. | off | intended for CanHire and GD Workforce; **to be switched on by the owner** (see [TODO.md](TODO.md)) |
| `subcategory_positions` | Subcategory position pages, menu entry and the dropdown-management option | on | off for Godspeed and GD Workforce |
| `attach_handbook_to_assignment_email` | Attaches the employee handbook PDF to the assignment email; bucket, path and attachment name are flag settings | off | Godspeed |
| `hide_jobseeker_pay_rate` | Hides pay rate and bill rate in the jobseeker Compensation step | off | GD Workforce |
| `jobseeker_profile_godspeed_rules` | Lighter jobseeker profile rules (licence number required, SIN and most address/qualification/compensation fields optional, document rule driver's licence or passport), in the forms and on the server | off | Godspeed |

The Feature Flags page shows the intended state per portal next to the real one.

### Adding a flag

1. Add an entry to `FEATURE_FLAGS` in `server/src/config/featureFlags.ts`.
2. Read it with `isFeatureEnabled` (server) or `useFeatureFlag` (client); add the title and description texts in `locales/{en,fr}/featureFlags.json`.
3. Set `wired: true` once code reads it.
4. Before shipping a flag whose default differs from today's behaviour on a portal, **seed that portal's database first** so nothing changes when the code arrives.
5. When every portal has the feature permanently, delete the flag from the registry.

## Portal settings

Values that used to be typed into the code per branch.

- **Registry in code:** `server/src/config/portalSettings.ts` (24 settings) with key, group, label, description, default, optional `envFallback`, and `public` for the few values a logged-out visitor may read.
- **Storage:** table `portal_settings` (key, value, updated_by, updated_at) per database, migration `031_portal_settings.sql`; same RLS approach as flags. Empty values are not stored.
- **A value is resolved in this order:** this portal's database value, then the environment variable named in `envFallback`, then the in-code default. Nothing changes in production just because a setting was not filled in.
- **Server:** `getPortalSetting(key)` / `getPortalSettingSync(key)` in `server/src/services/portalSettings.ts` (30-second cache).
- **Client:** `usePortalSetting("key")` and `PortalSettingsContext`. The public values are loaded before login (`GET /api/portal-settings/public`: brand name, portal switcher and the legal-page values, including the contact details when they are filled in; never the sender or support addresses, the invoice company details, the tax number, the training ids or the staff-email rules) and cached in `publicSettingsStore.ts` so later visits draw instantly.
- **API:** `GET /api/portal-settings` (logged in), `GET /api/portal-settings/admin` and `PUT` (super admin only).
- **Page:** `/portal-settings` (super admin), groups in this order: Portal, Email, Company details, Branding, Portal switcher, Staff email recognition, Legal pages, Training. Each field shows its source label: "Set for this portal", "From environment" or "Default". That label is also the checklist for retiring an environment variable.
- **Brand name in texts** is the `{{brandName}}` placeholder, never typed in a translation ([development/translations.md](development/translations.md)).

### What the settings control

| Group | Settings (keys) | Used by |
| --- | --- | --- |
| Portal | `portal.name` | Email sender name, subjects, welcome emails, signup metadata, support tickets |
| Email | `email.noReplyFrom`, `email.assignmentFrom`, `email.defaultFrom`, `email.invoiceCc`, `email.supportNotifyTo`, `email.supportNotifyCc` | [email-triggers.md](email-triggers.md) |
| Company details | `company.name`, `company.address`, `company.address2`, `company.taxNumber` | Invoice PDF (the app refuses to create an invoice while these are not loaded) |
| Branding | `branding.brandName`, `branding.aiChatTitle` | Tab title, headings, logo alt text, AI chat title |
| Portal switcher | `switcher.currentLogo`, `switcher.options` | The header icon that opens the other portals; empty hides it (demo and public demo) |
| Staff email recognition | `access.staffEmailContains`, `access.staffEmailExcluded` | Sign-ups and logins whose email matches are treated as staff (recruiter/admin side) instead of jobseeker; matching ignores case |
| Legal pages | `legal.companyName`, `legal.companyShortName`, `legal.contactAddress`, `legal.contactEmail`, `legal.contactPhone` | Privacy Policy and Terms of Service. The contact block shows only what is filled in; all three empty hides it |
| Training | `training.video1`, `training.video2` | YouTube ids of the two mandatory training videos |

### Adding a setting

1. Add an entry to `PORTAL_SETTINGS` (give it an `envFallback` only if an environment variable already exists for it).
2. Read it with `getPortalSetting` or `usePortalSetting`; add its label to `locales/{en,fr}/portalSettings.json`.
3. Add the live value to every portal's seed file (below) and set it on each portal's page.

**Secrets never go into settings.** API keys, the Supabase service key, database URLs and anything needed before the database is reachable stay in environment variables.

## Environment variables

Server (`server/.env`, see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `PORT`, `NODE_ENV`, `CLIENT_URL` | Server port, mode, and the web app's address (base of links in emails and redirects) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` | The portal's database; the service key is a secret |
| `SENDGRID_API_KEY` | Email delivery (secret) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` | SMS codes for phone verification and 2FA (secrets) |
| `AI_VERIFICATION_URL` | The portal's AI service, used for document verification |
| `ENCRYPTION_KEY`, `ENCRYPTION_IV` | Read by `server/src/utils/encryption.ts`, which refuses to load without them. Nothing imports that helper today (secrets; see [TODO.md](TODO.md)) |
| `PORTAL_NAME`, `NO_REPLY_FROM_EMAIL`, `ASSIGNMENT_FROM_EMAIL`, `DEFAULT_FROM_EMAIL`, `INVOICE_CC_EMAILS`, `SUPPORT_NOTIFY_TO`, `SUPPORT_NOTIFY_CC` | **Fallbacks** for portal settings; used only when the setting is empty. To be removed once every portal has its settings filled in |

`server/.env.example` also lists `RATE_LIMIT_WINDOW`, `RATE_LIMIT_MAX`, `SENSITIVE_RATE_LIMIT_WINDOW` and `SENSITIVE_RATE_LIMIT_MAX`, but no code reads them: the limits are fixed in `server/src/middleware/security.ts` (and the limiters are mostly switched off, see [TODO.md](TODO.md)).

Client (`client/.env`; only `VITE_` variables reach the browser, so never put a secret here):

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | The portal's database (public anon key) |
| `VITE_API_URL` | The portal's backend (defaults to `http://localhost:5001`) |
| `VITE_AI_CHAT_URL` | The AI chat page embedded in `/ai-chat`; defaults to one hosted address, so **set it on every portal that has its own AI service** (not listed in `.env.example`) |

## Seed files

`server/src/db/seeds/` holds one SQL file per portal (`allstaff.sql`, `canhire.sql`, `godspeed.sql`, `hdgroup.sql`, `demo.sql`) with the portal's settings and flag overrides. After running the migrations on a new database, run its seed once. Existing rows are never overwritten, so re-running is safe. The files are a reference copy of what is live: **update the file when you change a value on the pages.** They contain no secrets and are not kept on `public-main`. Details: `server/src/db/seeds/README.md`.

## Setting up a new portal

1. Create a Supabase project; run `server/src/db/migration_v2/*.sql` in order (see that folder's README).
2. Create the backend and frontend deployments from a production branch; set the environment variables above.
3. Copy a seed file, edit the values, run it on the new database.
4. Create the first admin with `server/src/scripts/create-admin.ts` (it sets `user_type = "admin"`), then add `"superadmin"` to that user's `user_role` list in the Supabase Auth user metadata by hand; the script does not do it.
5. Add the brand images under `client/src/assets/` and point the header, login, invoice and consent images at them.

## Roles worth knowing

`superadmin` is a value inside the user's `user_role` list (user metadata); it is separate from the `admin` role. It unlocks Feature Flags, Portal Settings, Email Template Preview, Consent Templates, consent request creation and the support agent role. See [role-access-control.md](role-access-control.md).
