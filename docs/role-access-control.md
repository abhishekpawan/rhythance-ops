# Role Access Control

This file is the source of truth for role-based access in the portal.

## Roles

- `admin`
- `recruiter`
- `bookkeeper`
- `recruiter_manager`
- `accountant_manager`
- `sales`
- `recruiter_director`
- `jobseeker`

### Super admin

`superadmin` is not one of the page roles above. It is an extra value inside a user's `user_role` list (Supabase user metadata) that is added to a user who is normally also `admin`. The client reads it with `isSuperAdmin` (`client/src/lib/auth.ts`) and guards pages with `SuperAdminRoute`; the server uses `requireSuperAdmin` (`server/src/middleware/superAdmin.ts`). Super admins have no extra access to normal pages; they alone get the pages and actions marked "super admin" below.

## Page-Level Access

These rules map directly to the hamburger menu pages and route guards.

### Common Pages

| Page | Allowed roles |
| --- | --- |
| Dashboard | `admin`, `recruiter`, `bookkeeper`, `recruiter_manager`, `accountant_manager`, `sales`, `recruiter_director`, `jobseeker` |
| Calendar | `admin`, `recruiter`, `bookkeeper`, `recruiter_manager`, `accountant_manager`, `sales`, `recruiter_director` |
| Training | `admin`, `recruiter`, `bookkeeper`, `recruiter_manager`, `accountant_manager`, `sales`, `recruiter_director`, `jobseeker` |
| AI Chat | `admin`, `recruiter`, `bookkeeper`, `recruiter_manager`, `accountant_manager`, `sales`, `recruiter_director`. What a question can read depends on the role and is enforced by the database (migration 037): change it together with the page lists, see [features/ai-chat.md](features/ai-chat.md) |
| Dropdown Options | `admin`, `recruiter_manager`, `accountant_manager`, `recruiter_director` |

### User Management

| Page | Allowed roles |
| --- | --- |
| All Users | `admin`, `recruiter_director` |
| Recruiter Hierarchy | `admin`, `recruiter_director` |
| Invite Recruiter/Accountant | `admin`, `recruiter_manager`, `accountant_manager`, `recruiter_director` |

### Jobseekers

| Page | Allowed roles |
| --- | --- |
| All Jobseekers | `admin`, `recruiter`, `bookkeeper`, `recruiter_manager`, `accountant_manager`, `recruiter_director` |
| Create Jobseeker | `admin`, `recruiter`, `recruiter_manager`, `recruiter_director` |
| Jobseeker Drafts | `admin`, `recruiter`, `recruiter_manager`, `recruiter_director` |
| SIN / Work Permit Management | `admin`, `recruiter`, `recruiter_manager`, `recruiter_director` |
| My Positions (Jobseeker Portal) | `jobseeker` |
| Verification Pending / Rejected | `jobseeker` |

### Clients

| Page | Allowed roles |
| --- | --- |
| All Clients | `admin`, `recruiter_manager`, `accountant_manager`, `recruiter_director`, `sales` |
| Create Client | `admin`, `recruiter_manager`, `accountant_manager`, `recruiter_director` |
| Draft Clients | `admin`, `recruiter_manager`, `accountant_manager`, `recruiter_director` |

### Positions

| Page | Allowed roles |
| --- | --- |
| All Positions | `admin`, `recruiter`, `bookkeeper`, `recruiter_manager`, `accountant_manager`, `recruiter_director`, `sales` |
| Create Position | `admin`, `recruiter_manager`, `recruiter_director` |
| Create Position Subcategory | `admin`, `recruiter_manager`, `recruiter_director`; only on portals where the `subcategory_positions` feature flag is on (otherwise the address redirects to login) |
| Draft Positions | `admin`, `recruiter_manager`, `recruiter_director` |
| Position Matching | `admin`, `recruiter`, `recruiter_manager`, `recruiter_director` |

### Documents

| Page | Allowed roles |
| --- | --- |
| All Consent Documents | `admin`, `recruiter`, `recruiter_manager`, `recruiter_director` |
| Create Consent Document | `admin`, `recruiter`, `recruiter_manager`, `recruiter_director` |
| Consent Templates | super admin |

### System & Administration

| Page | Allowed roles |
| --- | --- |
| Email Template Preview (`/email-template-preview`) | super admin |
| Feature Flags (`/feature-flags`) | super admin |
| Portal Settings (`/portal-settings`) | super admin |

Metric Examples is no longer a routed page.

### Timesheets

| Page | Allowed roles |
| --- | --- |
| Timesheet Management | `admin`, `recruiter`, `bookkeeper`, `recruiter_manager`, `recruiter_director` |
| Create Bulk Timesheet (Client) | `admin`, `bookkeeper`, `recruiter_manager`, `recruiter_director` |
| Create Bulk Timesheet (Job Seeker) | `admin`, `bookkeeper`, `recruiter_manager`, `recruiter_director` |
| Bulk Timesheet List | `admin`, `bookkeeper`, `recruiter_manager`, `recruiter_director` |

### Finance

| Page | Allowed roles |
| --- | --- |
| Invoice Management | `admin`, `accountant_manager`, `bookkeeper` |
| Invoice List | `admin`, `accountant_manager`, `bookkeeper` |

### Reports

| Page | Allowed roles |
| --- | --- |
| Reports | `admin`, `bookkeeper`, `accountant_manager`, `recruiter_director`, `sales` |

### Support Tickets

| Page | Allowed roles |
| --- | --- |
| Support Tickets | `admin`, `recruiter`, `bookkeeper`, `recruiter_manager`, `accountant_manager`, `sales`, `recruiter_director` |

Support agents (the people who answer tickets, change status and priority, and write internal notes) are **super admins**; see [features/support-tickets.md](features/support-tickets.md).

> [!IMPORTANT]
> The Support Ticket module is strictly for internal staff (`SUPPORT_ROLES`) and is **hidden from and inaccessible to `jobseeker` usertypes** across all navigation menus/dropdowns, route guards (`RoleRoute`), and backend API endpoints.

## Non-Menu Route Inheritance

These routes inherit the menu-page access above.

- Jobseeker details: `/jobseekers/:id` uses `All Jobseekers`
- Jobseeker edit/create helper routes: `/profile/create`, `/jobseekers/:id/edit`
  - `jobseeker` is also allowed for self-service onboarding/profile flow
- Jobseeker draft edit: `/jobseekers/drafts/edit/:id` uses `Jobseeker Drafts`
- Client view: `/client-management/view/:id` uses `All Clients`
- Client edit: `/client-management/edit/:id` uses `Create Client`
- Client draft edit: `/client-management/drafts/edit/:id` uses `Draft Clients`
- Position view: `/position-management/view/:id` uses `All Positions`
- Position edit: `/position-management/edit/:id` uses `Create Position`
- Position draft edit: `/position-management/drafts/edit/:id` uses `Draft Positions`
- Support ticket create: `/support/new` uses `Support Tickets`
- Support ticket details: `/support/:id` uses `Support Tickets`
- Consent detail: `/consent-dashboard/:documentId` uses `All Consent Documents`
- Timesheet detail view: `/timesheet-management/view/:id` uses `Bulk Timesheet List` / `Timesheet Management`
- Invoice detail view: `/invoice-management/view/:id` uses `Invoice Management`
- Reports subpages under `/reports/*` use `Reports`
- Onboarding consent: `/onboarding-consent` uses common authenticated user access
- Public routes (no auth required): `/consent` (document signing), `/terms-of-service`, `/privacy-policy`

## Implementation Notes

- Frontend page access is centralized in `client/src/constants/accessControl.ts`.
- Menu visibility must follow the same constants as route guards.
- Route guards use exact role matching for page-level access.
- Legacy metadata roles are still normalized:
  - `manager` -> `recruiter_manager`
  - `accountant` -> `bookkeeper`
- A user's role is read from `app_metadata` (only the server can write it), never from `user_metadata`, which users can edit about themselves (migration 034, `server/src/utils/trustedRoles.ts`). Promote someone by writing `app_metadata.user_type` and `user_role`.

## Two-step login (staff)

Admin and recruiter accounts enter a phone code after the password; jobseekers sign in with email and password only and are never affected. The login screen alone cannot enforce this, because the browser holds Supabase's public key and can sign in to Supabase directly. The server therefore enforces it when the feature flag `staff_two_factor_enforced` is on for the portal (default on since 2026-11-19; the demo database stores it off):

- `POST /api/auth/validate-credentials` answers a staff account with `requiresTwoFactor: true` and **no session**. Staff are recognised by their role in `app_metadata`, not by their email.
- `POST /api/auth/complete-2fa` takes email, password and the code, checks the code with Twilio against the number **on file** (`app_metadata.twofa_phone`, written by migration 035, sign-up and first onboarding; the number in `user_metadata` is only a fallback for an account without a pinned one), then signs in and records the new session in `staff_2fa_sessions`. A missing or wrong code gives a 400 and no session.
- `authenticateToken` refuses a staff token whose session is not in `staff_2fa_sessions` (401 `TWO_FACTOR_REQUIRED`; the client signs out and returns to login). A recorded session is accepted for 90 days. If the lookup itself fails the answer is 503, not 401, so a database hiccup does not sign everyone out. If migration 035 is missing the check is skipped.
- `POST /api/auth/login` (password only) refuses staff with 403.
- An invited staff member, who arrives with a session from the email link and has no number on file yet, may call `POST /api/auth/complete-onboarding` once; it pins the number and records that session.

Code: `server/src/services/staffTwoFactor.ts`, `server/src/routes/authSignIn.ts`, `server/src/middleware/auth.ts`. Tests: `server/tests/access/staff-two-factor.test.ts`.

**The phone-code endpoints.** `POST /api/auth/send-verification` and `POST /api/auth/verify-otp` are public (sign-up has no session) and text real numbers, so both are rate limited per phone number and per address (`middleware/otpRateLimits.ts`; counts live in the server's memory; defaults per hour: 8 sends and 20 checks per number, 100 sends and 200 checks per address; `OTP_SEND_LIMIT_PER_NUMBER`, `OTP_SEND_LIMIT_PER_ADDRESS`, `OTP_CHECK_LIMIT_PER_NUMBER`, `OTP_CHECK_LIMIT_PER_ADDRESS`, `OTP_RATE_LIMIT_WINDOW_MS` change them). Over the limit the answer is 429 `RATE_LIMITED` and nothing is sent. `verify-otp` with a `userId` writes the phone and `phone_verified` onto that account, so it needs that account's own session (401 without one, 403 `NOT_YOUR_ACCOUNT` for another account's id); without a `userId` it only checks the code. The limit on a number is shared by everyone who calls these two public endpoints, so they are not used for the sign-in code any more: `POST /api/auth/send-sign-in-code` takes email and password, checks them, and texts only the number on file (never a number the browser names), for staff accounts (by their role; while the flag is off, an address the portal settings list as staff counts too) and nowhere else (400 `TWO_FACTOR_NOT_REQUIRED` for a jobseeker, 400 `NO_2FA_PHONE` without a number, 401 for a wrong password, no text in any of those cases). Checking the password signs in on a throwaway client and ends only that session, so it never signs the person out on another device. Its limits count the account, not the number: after the password is right, 8 sends per account per hour (`OTP_SEND_LIMIT_PER_NUMBER`), and an address limit before the password is checked (`OTP_SEND_LIMIT_PER_ADDRESS`), so someone who knows only a staff member's number or email cannot use up that person's sign-in codes (`middleware/otpRateLimits.ts`, `routes/authSignInCode.ts`). What stays: the public `send-verification` (sign-up) still texts any number up to 8 times an hour, which can annoy the owner of a number, and Twilio Verify has its own limit per number (about 5 sends in 10 minutes) that those sends can use up. Tests: `server/tests/access/phone-code-endpoints.test.ts`, `sign-in-code.test.ts`.

**Sign-in errors.** The sign-in and phone-code routes send a stable `code` next to the English `error` text (`INVALID_CREDENTIALS`, `TOO_MANY_ATTEMPTS`, `INVALID_2FA_CODE`, `RATE_LIMITED`, …); the screens show `auth.errors.<CODE>` in the language of the page (`client/src/services/api/authErrors.ts`). A new code needs its texts in `en.json` and `fr.json` (a test checks).

**Turning it on for a portal:** apply migration 035 to its database, deploy the server and client, then switch the flag on in Feature Flags (a new portal now has it on without that step). Staff who are signed in at that moment are sent back to the login screen once. **If something goes wrong:** switch the flag off (Feature Flags), or if nobody can sign in, `delete from feature_flags where key = 'staff_two_factor_enforced'` in that database. Keep it off on the demo portals (their database stores `enabled=false`): the demo login signs in directly and would be refused.

**The data API (migration 039, 2026-11-20).** The browser can also call Supabase directly (data API and storage) with the session it holds, so the database's own staff checks follow the same rule: `has_role`, `has_user_role` and `has_scope` (and so `is_admin`, `is_recruiter` and every policy built on them: `jobseeker_profiles`, `ai_validation`, `recent_activities`, and the `jobseeker-documents`, `consent-documents` and `invoices` storage rules) are true for an admin or recruiter only when the sign-in session is in `staff_2fa_sessions` and at most 90 days old, while the flag is on (no flag row counts as on, like the server; the demo database stores it off and behaves as before). They call `staff_session_ok()`, which only the helpers (and the service key) can run. Jobseekers are not affected. Tests: `server/tests/access/staff-data-api-session.test.ts` (password-only session refused on profiles, files and writes; verified session works; someone else's or a 90-day-old session does not count; a second sign-in needs its own code; a jobseeker who writes `user_type: admin` into their own profile fields gains nothing). Undo: `ops/undo/039_undo.sql`. Run 039 **after** 034 and 032 whenever those are run again (they define the older helpers).

**Older policies that do not use the helpers.** Thirty-three policies on `clients`, `positions`, `position_candidate_assignments`, `timesheets`, `consent_documents`, `consent_document_templates`, `consent_records`, `client_dropdown_options`, `email_checkpoint` and `invoices` decide "staff" by reading `auth.users.raw_user_meta_data`, a field the signed-in user can edit about themselves. A signed-in user cannot read `auth.users`, so each of those policies fails with "permission denied" for everybody and grants nothing (checked on stage and the four production databases 2026-11-20; the portal reads these tables through the server's service key, never from the browser). Nothing is exposed today, but if someone grants `authenticated` read access to `auth.users` they would become a way in for anyone who edits their own profile fields, and rewriting them to the helpers would open the data API to staff roles the server limits. `staff-data-api-session.test.ts` pins that nobody (staff included) reads those tables through the data API; whether to delete or rewrite them is a decision (`ops/inbox.md`).

## Action-Level Permissions

These are not the page-level rules. They must be enforced separately inside pages and APIs.

| Action | Allowed roles |
| --- | --- |
| Assign roles in All Users | `admin`, `recruiter_director` |
| Delete jobseeker profile | `admin`, `recruiter_manager`, `recruiter_director` |
| Delete Client | `admin`, `recruiter_manager`, `recruiter_director` |
| Delete Position | `admin`, `recruiter_manager`, `recruiter_director` |
| Remove assigned jobseeker from a position | `admin`, `recruiter_manager`, `recruiter_director` |
| Invite Recruiter/Accountant submit action | `admin`, `recruiter_manager`, `accountant_manager`, `recruiter_director` |
| Edit Single Timesheet | `admin`, `recruiter`, `bookkeeper`, `recruiter_manager`, `recruiter_director` |
| Delete Timesheet | `admin`, `bookkeeper`, `recruiter_manager`, `recruiter_director` |
| Edit Invoice | `admin`, `accountant_manager`, `bookkeeper` |
| Delete Invoice | `admin`, `accountant_manager`, `bookkeeper` |
| View All Support Tickets (`scope=all` shared view) | `admin`, `recruiter`, `recruiter_manager`, `recruiter_director` |

## Where the server is looser or stricter than the UI

The tables above describe the **UI**. On the server, `authorizeRoles(["recruiter"])` (and `["admin", "recruiter"]`) is satisfied by *every* internal role (`recruiter`, `bookkeeper`, `recruiter_manager`, `accountant_manager`, `sales`, `recruiter_director`), so many APIs accept more roles than the menu shows. `authorizeExactRoles` is the strict variant. Known differences:

| Area | UI | API |
| --- | --- | --- |
| Create consent request | admin, recruiter, recruiter manager, recruiter director | super admin only (others get 403 on submit) |
| Dropdown options (add, change, delete) | admin, recruiter manager, accountant manager, recruiter director | admin only; reading is open to every internal role |
| Invite / resend invitation | admin, recruiter manager, accountant manager, recruiter director | admin only |
| Consent templates (create, delete) | super admin | admin |
| Reports, invoices | roles in the tables above | any internal role |
| Clients and positions (`GET /api/clients`, `GET /api/positions`) | All Clients: `admin`, `recruiter_manager`, `accountant_manager`, `recruiter_director`, `sales`; All Positions: as in the Positions table | any internal role, so `recruiter` and `bookkeeper` can read the client list although they do not see the All Clients page. **Intended, not a gap:** the timesheet, invoice, report, consent and position screens read the lists to fill pickers. Changing a client or position is limited to the roles in the tables above. |
| Staff user list and changing a manager (`GET /api/users`, `GET /api/users/:id`, `PATCH /api/users/:id/manager`) | All Users and Recruiter Hierarchy: `admin`, `recruiter_director` | the same two roles (exact match: `admin` includes the super admin). Since DEV-3 no other staff role gets it: no other screen uses them; the list returns every staff member's email, phone and sign-in times, and the manager change rewrites the hierarchy. |

Each is tracked in [TODO.md](TODO.md) until the UI and API agree. Frontend access is always only a convenience; the server check is the real one.
