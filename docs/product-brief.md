# Godspeed Ops Portal — Product Brief

> **Document Purpose:** This brief is intended to onboard an AI assistant (or new team member) to the full context of the Godspeed Ops Portal — what it is, what it does, who it serves, and where it is heading. It is written in plain English and deliberately avoids technical implementation detail. For the technical side start at [README.md](README.md).

---

## 1. App Overview

### What is it?

The **Godspeed Ops Portal** is an internal staffing operations platform for staffing agencies. One codebase runs as several separately branded portals, each with its own database: **AllStaff**, **CanHire**, **Godspeed** and **GD Workforce** (plus a demo and a public demo). See [portals-and-configuration.md](portals-and-configuration.md) for how they differ. It is the central hub where the agency's entire workflow lives — from bringing on new clients and posting job positions, to recruiting workers (called "jobseekers"), matching them to positions, tracking their hours, and generating invoices for clients.

Think of it as the agency's operating system: every person, every placement, every dollar flows through this portal.

### What problem does it solve?

Staffing agencies manage a complex, multi-party operation involving clients (businesses that need workers), jobseekers (workers looking for placement), and an internal team of recruiters, bookkeepers, and managers. Without a centralized system, this coordination relies on spreadsheets, emails, and phone calls — all of which are error-prone, slow, and hard to audit.

The Godspeed Ops Portal replaces that chaos with a structured, role-aware, auditable platform where every action is tracked, every team member sees only what they need to, and automated communications keep everyone informed.

### Who is it for?

The app has two distinct user populations:

**Internal staff (employees of the staffing agency):**
- **Admins / Directors** — Full access; oversee the entire operation
- **Recruiter Directors / Managers** — Manage recruiters and their pipelines
- **Recruiters** — Manage jobseeker profiles, match candidates to positions
- **Bookkeepers** — Primary owners of weekly payroll entry: single timesheets, two bulk-entry workflows (by client or by jobseeker), and the all-timesheets list with email follow-up
- **Accountant Managers** — Manage invoicing and financial reporting
- **Sales** — View clients and positions; focused on business development
- **Super admin** — An admin who additionally configures the portal (feature flags, portal settings, consent templates, email previews) and answers support tickets

**External users (people served by the agency):**
- **Jobseekers** — Workers who have been placed or are being onboarded by the agency; they access their own profile, timesheets, and consent documents through a self-service portal

### Core Value Proposition

A single, structured platform that replaces manual coordination across a staffing agency — giving every team member exactly the tools they need, keeping jobseekers informed and compliant, and giving leadership live visibility into the business.

---

## 2. Current Features

### Core Product

#### Jobseeker Management
The heart of the platform. A jobseeker is a worker the agency places with client companies.

- **Profile creation and onboarding:** Recruiters can create detailed jobseeker profiles capturing personal details, work eligibility documents (SIN, passport, work permits), pay preferences, payment methods, and contact information. Jobseekers can also self-register and build their own profiles after being invited.
- **AI-powered document verification:** When a jobseeker profile is created or updated, the system automatically sends the profile to an external AI verification service that checks the legitimacy of submitted documents (SIN numbers, work permits, etc.). The result is stored against the profile and surfaced to recruiters.
- **Profile status workflow:** Every jobseeker profile moves through a status pipeline — `pending`, `verified`, or `rejected`. Recruiters and managers can approve or reject profiles. Rejected or pending jobseekers have restricted access to the portal until their profile is approved.
- **Draft profiles:** Recruiters can save incomplete profiles as drafts and return to them later, preventing accidental data loss mid-entry.
- **Candidate matching:** The system can suggest which jobseekers best match an open position, using a stored database procedure that compares jobseeker attributes against position requirements.
- **Document expiry tracking:** The dashboard surfaces a panel showing whose documents (work permits, etc.) are approaching expiry, helping recruiters stay ahead of compliance issues.

#### Client Management
Clients are the businesses that hire workers through the agency.

- **Client profiles:** Full company details including multiple contact people, billing addresses, invoice preferences, multiple email addresses (for CC-ing invoices to accounting and dispatch departments), payment terms, preferred payment methods, and currency.
- **Draft clients:** Like jobseekers, new clients can be saved as drafts before being finalized.
- **Multiple address and contact support:** Clients can have multiple locations, contacts, and email destinations for invoicing — important for large enterprise clients.

#### Position Management
Positions represent job openings that a client needs filled.

- **Position details:** Each position captures title, category, pay rates (regular, overtime, premium), bill rates to the client, location, employment type, shift times, start/end dates, and how many workers are needed.
- **Auto-generated position codes:** The system automatically generates a unique, structured position code for each new position, tied to the client.
- **Assigning jobseekers to positions:** Recruiters can assign matched candidates to open positions. Each assignment triggers an email to the jobseeker with all relevant position details.
- **Draft positions:** Incomplete positions can be saved as drafts.

---

### Dashboard

Each user role sees a dashboard tailored to their responsibilities:

- **Admin Dashboard:** Displays organization-wide metrics — total jobseeker profiles (and breakdown by status), total clients, positions and fill rates, timesheet and invoice summaries, and AI activity insights. All data can be viewed over a rolling 12-month window with trend charts.
- **Recruiter Dashboard:** Similar to admin but defaults to the recruiter's own pipeline. A toggle lets them switch between personal metrics and team-wide aggregates.
- **Jobseeker Dashboard:** A simplified view showing the jobseeker's own profile status, their assigned positions, and recent timesheets. On portals where the `jobseeker_payroll_summary` flag is on, it also shows **Total No. Hours** and **Gross Amount** cards (pay before deductions).
- **Real-time Activity Feed:** Every dashboard includes a live feed of recent actions taken anywhere in the system — who created a client, who verified a jobseeker, who sent an invoice. This feed updates in real time without page refresh.
- **Document Expiry Overview:** A widget on recruiter and admin dashboards that highlights jobseekers with expiring documents, categorized by urgency.

---

### Timesheet Management

Timesheets are weekly records of hours a jobseeker worked at a specific client position. The timesheet area was rebuilt as a dedicated module with separate screens for single entry, two bulk workflows, and a searchable master list. Access is under the Finance section of the navigation menu.

**Who can use it**

| Screen | Typical users |
| --- | --- |
| Create / edit a single timesheet | Admin, recruiter, bookkeeper, recruiter manager, recruiter director |
| Bulk entry (client or jobseeker) | Admin, bookkeeper |
| All timesheets list (search, email, delete UI) | Admin, bookkeeper |

#### Single timesheet (`/timesheet-management`)

Used when processing one jobseeker at a time. The flow is **jobseeker → client → position → week**, with cascading dropdowns so each choice narrows the next.

- **Daily hours grid:** Enter hours per day for the selected week; the form loads an existing timesheet for that combination when one already exists (create or update in place).
- **Pay adjustments:** Bonuses and deductions with descriptions.
- **Live payroll preview:** As hours change, the UI shows regular vs. overtime split, premium rates, payment-method-specific rules (cash / e-Transfer deductions, SIN hours cap where applicable), and totals before submit.
- **Employee context panel:** Surfaces name, billing email, payment method, and other pay-relevant profile fields beside the form.
- **Invoice summary:** Position pay rates, period, and per-line pay breakdown aligned with what will be stored and emailed.
- **Optional email on save:** Checkbox to send the jobseeker a pay summary immediately; prefers billing email when set.

#### Bulk timesheet — by client (`/bulk-timesheet-management`)

Used for a typical weekly payroll run at one client site: one position, one week, many workers.

- Select **client**, **position**, and **week**; the system loads every jobseeker currently assigned to that position (no manual multi-select list).
- Each assigned worker gets their own expandable form on the same page (hours, adjustments, notes, per-person email toggle).
- Workers can be removed from the batch before submit.
- **Submit creates one timesheet per jobseeker**, each with its own invoice number — not a single combined “bulk” database row. A progress overlay shows invoice generation and per-person success, skip-on-duplicate, or partial-failure outcomes.
- **Invoice-only subcategory positions** (invoicing without placements) show a banner and direct staff to single timesheet entry instead.

#### Bulk timesheet — by job seeker (`/bulk-timesheet-management/jobseeker`)

Used when one worker worked **multiple positions** (or the same client under different roles) in the same week — the mirror of the client-centric bulk flow.

- Select **jobseeker**, **client**, and **week**.
- Add one or more **position rows**; each row is a full timesheet form for that position.
- Prefills from any existing timesheets for that jobseeker/week; supports add/remove rows and optional email-to-all on submit.
- Same per-row invoice numbering and batch progress behavior as client bulk entry.

#### All timesheets list (`/timesheet-management/list`)

Central index for bookkeepers and admins (replaces the older standalone bulk list route, which redirects here).

- **Filters:** Invoice number, client, position, jobseeker name, billing email, date range, email sent / not sent.
- **Pagination** with configurable page size.
- **Email actions:** Send or resend timesheet summary email per row from the list.
- **View and Edit** buttons on each row: View opens a read-only page; Edit opens the single (or jobseeker-bulk) entry screen pre-filled with that timesheet's jobseeker, client, position and week.
- **Shortcuts** to start new bulk entry (client or jobseeker) from the page header.
- **Delete** (admin, bookkeeper, recruiter manager, recruiter director): a confirmation, then the timesheet is removed and the list refreshes.

#### Cross-cutting behavior

- **Invoice numbers:** Generated sequentially per timesheet on create (bulk runs assign a unique number to each created record).
- **Email delivery:** Templates include daily hours, rates, deductions, and totals; billing email is preferred over primary email when present.
- **Document attachment:** Timesheet records can have a PDF document attached (e.g., a signed timesheet scan).
- **Localization:** All timesheet screens use dedicated English and French string bundles (full UI copy for forms, bulk flows, and the list).

---

### Invoice Management

Invoices are sent to client companies to bill them for the workers provided.

- **Invoice creation:** Invoices pull in timesheet data for one or more jobseekers, calculating client bill amounts based on position bill rates.
- **PDF generation:** The system generates invoice PDF documents. The portal's logo, company name, address and tax number come from Portal Settings, and the app refuses to create an invoice while they are not loaded.
- **Email delivery to clients:** Staff can manually trigger invoice emails to clients, with automatic CC-ing of the correct accounting, dispatch, and management contacts based on client settings.
- **Invoice tracking:** The system tracks whether an invoice has been emailed, when, and to whom.
- **Attachments:** Additional documents can be attached to invoice emails.

---

### Reports

A dedicated reporting section lets finance and management export structured data for analysis. Reports available:

- **Weekly Timesheet Report:** All timesheet entries for a specific jobseeker across selected weeks and clients, including pay breakdown and cash deduction calculations.
- **Margin Report:** For each invoice in a date range, calculates the difference between what the client was billed and what the jobseeker was paid — showing the agency's margin, broken down by payment method.
- **Invoice Report:** Lists all invoices in a date range with client, amount, terms, and email delivery status.
- **Deduction Report:** Identifies invoices that contain negative line items (deductions or adjustments) and shows the impact per jobseeker.
- **Rate List Report:** A reference list of all active positions and their pay/bill rates, filterable by client.
- **Clients Report:** A full export of all active clients with contact details, payment preferences, and activity status.
- **Sales Report:** A view of business activity useful for the sales team.
- **Envelope Printing Reports (by position and by due date):** Specialized reports that format mailing address data and pay amounts for physical envelope printing — used for sending cheques or physical documents to jobseekers. A jobseeker with several positions shows all pay rates, and biweekly pay cycles collapse to one row per jobseeker.

Report pages support filtering and CSV download.

---

### Digital Consent Management

A system for collecting legally binding signatures from jobseekers and clients on important documents.

- **Document templates:** Admins can define consent document templates (e.g., an Employment Agreement) in the system.
- **Consent requests:** Admins or recruiters can send consent requests to specific jobseekers or clients. Each recipient gets a unique, secure link via email.
- **Online signing:** Recipients visit a public-facing page (no login required), view the document, type their full name, and check a consent checkbox. The response is recorded with their IP address and timestamp for legal audit purposes.
- **Automatic employment agreement flow:** When a new jobseeker's profile is created, the system automatically generates and sends them an Employment Agreement consent request, without any manual action required.
- **Status tracking:** The internal team can see who has signed, who hasn't, and resend reminders to outstanding signers.
- **Confirmation state:** Once a consent link has been used, revisiting it shows a confirmation message rather than the form again.

---

### Calendar

A read-only calendar view (for admins and recruiters) that visualizes when jobseekers are starting and ending assignments across all client positions.

- Displays position assignments as calendar events, filterable by date range, client, or jobseeker.
- Includes a side panel showing the details for any selected day.
- Helps recruiters and managers quickly see upcoming starts, endings, and gaps in coverage.

---

### User Management

Tools for managing the internal team of agency staff:

- **All Users view:** Admins and director-level roles can see all registered users with their roles, status, and last login.
- **Role assignment:** Admins can assign or change user roles directly within the portal.
- **Recruiter Hierarchy:** A visual map of which recruiter reports to which manager, supporting the agency's organizational structure.
- **Invite Recruiter/Accountant:** Authorized managers can invite new team members via email. The invitee receives an email with a link to complete their account setup.
- **Onboarding reminders:** If a newly invited team member hasn't completed their setup, managers can resend the invitation or onboarding reminder email.

---

### Training Modules

A built-in training section accessible to all staff and jobseekers. It contains curated training videos on workplace compliance topics:

- **AODA (Accessibility for Ontarians with Disabilities Act):** Mandatory compliance training for Ontario organizations.
- **Violence and Harassment in the Workplace:** Awareness training on preventing and reporting workplace misconduct.
- **WHMIS** and **Health and Safety** videos.

The two mandatory videos are chosen per portal in Portal Settings (`training.video1`, `training.video2`; descriptions in [reference/training-video-details.md](reference/training-video-details.md)). Four further modules show as "coming soon".

---

### AI Chat

An embedded AI chat assistant (hosted at an external URL, embedded via iframe), titled per portal (for example "CanHire Solution AI Chat"; Portal Setting `branding.aiChatTitle`). This provides internal staff with an AI assistant they can interact with directly from within the portal without navigating away. The underlying AI service is hosted separately.

---

### Two-Factor Authentication (2FA)

The platform supports two-factor authentication as an additional login security layer. Users can validate credentials and then complete login via a second verification step.

---

### Support Tickets

An in-portal help desk: staff report bugs, request changes or features, or ask questions; super admins answer, set status and priority, and can leave internal notes. Tickets close when the requester confirms or automatically after 7 days. Email notifications go to the support team and the requester. See [features/support-tickets.md](features/support-tickets.md).

---

### Portal Configuration (super admin)

- **Feature Flags:** switch behaviour on or off for one portal, for example the jobseeker payroll cards, subcategory positions, hiding pay rates, the Godspeed profile rules and the employee handbook attachment.
- **Portal Settings:** the portal's name, sender and notification email addresses, company details for invoices, brand name and AI chat title, the portal switcher list, which email addresses count as staff, legal-page company names, and the training videos.
- **Portal switcher:** a header icon on the admin and recruiter dashboards that opens the other portals of the same organisation (hidden when none are configured).

See [portals-and-configuration.md](portals-and-configuration.md).

---

### Dropdown Options Management

Authorized managers and directors can configure the dropdown values used across the platform (e.g., position categories, employment types, terms options) without needing developer involvement.

---

## 3. Infrastructure & Background Systems

### Background Scripts and Seeds

**Admin Seeding Script (`server/src/scripts/create-admin.ts`):** A one-time utility script used to create the first admin user. Not a recurring job.

**Per-portal seeds (`server/src/db/seeds/`):** One SQL file per portal that gives a new database its settings and feature-flag overrides. Run once after the migrations.

**Database Migrations (`server/src/db/migration_v2/`):** Numbered SQL files (000 to 031) that define and evolve the schema, applied manually in order on each portal's database. (`server/src/db/migrations/` holds the older, individual files that were consolidated into `migration_v2`.)

### Scheduled Jobs

There is no scheduled work in the application server; operations are triggered by user actions, and document expiry is read when a dashboard loads. The database runs two `pg_cron` jobs where that extension is installed: `support-auto-close` (daily 03:30 UTC, closes resolved support tickets after 7 days) and a weekly cleanup of cron run logs.

### Realtime Activity Broadcasting

The system uses Supabase's real-time database feature to broadcast activity updates. Whenever a significant action is performed (creating a client, verifying a jobseeker, sending an invoice, etc.), the event is written to a central `recent_activities` table. The dashboard automatically receives these updates and displays them without requiring a page refresh. This is not a scheduled job — it's a live database event subscription.

---

### Third-Party Integrations

| Integration | What It Does |
|---|---|
| **Supabase** | The database, authentication system, file storage, and real-time messaging backbone. All user accounts, data records, and uploaded documents live in Supabase. |
| **SendGrid** | Sends all transactional emails — welcome emails, timesheet summaries, invoice notifications, consent requests, onboarding reminders, and assignment notifications. |
| **Twilio Verify** | Powers phone number verification via SMS one-time codes (OTP). Used during the user onboarding flow to verify mobile numbers. |
| **External AI Verification Service** | An external API (the separate `godspeed-ops-ai` repository, a FastAPI service) that receives jobseeker document data and returns a validation result. The portal sends data to this service when profiles are created or updated and stores the result. |
| **AI Chat (Iframe)** | The same AI service's chat interface, embedded into the portal via iframe. Staff can use this AI assistant without leaving the portal. |
| **Hosting** | Not described in the repository itself: the web app is built for Vercel (`client/vercel.json`); the backend and AI services run as separate services per portal. |

---

## 4. Landing Page / Marketing Site

There is **no separate public marketing or landing page** in this codebase. The application is an internal operations tool — not a consumer-facing product with a public homepage.

The app does have public-facing pages, but they serve functional onboarding purposes rather than marketing:

- **`/login`** — The entry point for all users
- **`/terms-of-service`** and **`/privacy-policy`** — Legal pages, filled with each portal's company names from Portal Settings
- **`/two-factor-auth`** and **`/email-confirmed`** — Second login step for staff, and the landing page after confirming an email
- **`/signup`** — For jobseekers registering themselves
- **`/complete-signup`** — For invited staff completing their account setup
- **`/forgot-password`** and **`/reset-password`** — Password recovery flows
- **`/consent?token=...`** — A public page where clients and jobseekers sign consent documents (no login required)
- **`/verification-pending`** — Shown to jobseekers whose profile is awaiting review

The portal is likely accessed via a direct URL shared with staff during onboarding, rather than discovered organically.

---

## 5. User Journey

### Internal Staff (Recruiter / Manager)

1. **Invited by an admin** → receives an email with a "complete account setup" link
2. **Clicks the link** → lands on `/complete-signup`, sets a password and completes onboarding
3. **Logs in** → lands on their role-specific dashboard showing their metrics, recent activities, and document alerts
4. **Creates or manages clients** → adds new client companies with contact info and billing preferences
5. **Creates positions** → adds job openings for clients with pay/bill rates
6. **Creates or reviews jobseeker profiles** → enters worker details, uploads or triggers AI document verification
7. **Assigns candidates** → matches jobseekers to open positions; the jobseeker receives an automated email
8. **Creates timesheets** → for recruiters/managers, usually one jobseeker at a time via single timesheet entry; bookkeepers often use client bulk (whole position for a week) or jobseeker bulk (one worker across multiple positions), then review and resend emails from the all-timesheets list
9. **Creates invoices** → bills the client for services; sends invoice via email with PDF attachment
10. **Runs reports** → exports data for payroll, margin analysis, or client records
11. **Reviews consent status** → monitors which jobseekers/clients have signed required agreements

### Jobseeker

1. **Recruiter creates their profile** OR **they self-register** → receives a welcome email and an employment agreement to sign
2. **Clicks consent link in email** → signs their employment agreement on a clean public page
3. **First login** → lands on a "complete your profile" prompt if profile is missing, or on a "verification pending" screen while their documents are reviewed
4. **Profile approved** → gains access to their personal dashboard
5. **Views dashboard** → sees their assigned position(s) and any recent timesheets
6. **Receives timesheet emails** → each pay period, an email summarizes their hours and pay
7. **Accesses training modules** → completes any required compliance training videos
8. **Uses the portal for self-service** → can view their own profile and historical timesheets

---

## 6. Business Model (if inferable)

The Godspeed Ops Portal is an **internal business tool** — it is not itself a product sold to customers. It is built for and used exclusively by the Godspeed / AllStaff staffing agency to run their operations.

The agency's business model (as reflected by the portal's features) is a **traditional staffing agency model**:

- The agency recruits workers (jobseekers) and places them with client companies
- The agency bills clients at a higher rate (the "bill rate") than it pays workers (the "pay rate")
- The difference is the agency's **margin** — which is explicitly calculated in the Margin Report
- Payments to workers vary by method (cash, e-Transfer, direct deposit, cheque, corporation accounts)
- Some payment methods (cash, e-Transfer) include a percentage deduction from the worker's pay, suggesting the agency absorbs some payment processing cost

There is **no subscription, usage-based pricing, or freemium model** visible in the codebase. The portal is a custom internal tool.

---

## 7. Current Gaps & Known Limitations

### Partially Built Features

- **AI Insights time-range tracking:** The AI dashboard shows "documents scanned" statistics, but the code includes a clear `TODO` comment noting that the `ai_validation` table is missing a `created_at` field — meaning historical document scan data cannot be broken down by month yet. The monthly breakdown charts for AI documents are currently placeholder zeros.

- **AI Chat:** The AI chat page is a thin wrapper that embeds an external chat service via iframe, with no deeper integration with portal data. Its address defaults to one hosted service unless `VITE_AI_CHAT_URL` is set per portal. It could benefit from context-aware AI that knows about the portal's clients, positions, and jobseekers.
- **AI service failures are silent:** if the AI provider runs out of credit or rejects a request, the portal's document verification just logs the error. See [TODO.md](TODO.md).

- **Training Modules:** Four training videos are present and four more cards show "Coming Soon". There is no completion tracking.

- **Route Path Anomaly:** `server/src/routes/jobseekers.ts` registers a duplicate `/api/profile/check-email` route inside the `/api/jobseekers` router, so it ends up at a wrong path. The working route is the one in `profile.ts`; the duplicate is dead code.


### Scalability Constraints

- Several list and report endpoints fetch a broad set of data from the database and then filter it in application code (rather than in the database query). This works fine at small scale but could become slow as the dataset grows.

### UX / Feature Gaps

- **No bulk actions on jobseekers list:** You can manage jobseekers individually but there's no multi-select bulk action (e.g., bulk status updates).
- **No client-side pagination state persistence:** Navigating away from a filtered list and returning resets the filters.
- **No mobile-optimized experience:** The portal is built as a desktop-first application. The calendar feature has a note about needing mobile responsiveness, but this is uneven across the app.
- **No notifications system:** Beyond emails and the activity feed, there is no in-app notification or alert system (e.g., badge counts, alerts for urgent items). Third-party services (AI, SMS, email) have no health or low-credit alerts either.

### Technical Debt

- Some debug `console.log` statements remain in production code (e.g., in `AppHeader.tsx`)
- The global API rate limiter is commented out in the server entry point
- Legacy role names (`manager` → `recruiter_manager`, `accountant` → `bookkeeper`) need normalization in some code paths

---

## 8. Inferred Product Intentions

Based on the codebase, feature scaffolding, and documentation, the product appears to be moving in the following directions:

### Near-Term (Already Scaffolded)

- **Expanding the Training Library:** The "Coming Soon" training cards are a clear signal that more compliance and onboarding training content will be added. The infrastructure is already in place.
- **AI Insights Improvements:** There's commented-out code specifically waiting for a database field (`created_at` in `ai_validation`) to be added. Once that's available, the AI dashboard will show proper month-by-month document scan trends.
- **Calendar Evolution:** The calendar was recently added and described as "read-only" in the docs. Likely next steps include write capabilities (scheduling shifts, marking availability).

### Medium-Term (Strongly Implied)

- **Deeper AI Integration:** The presence of an AI chat tool, an AI document verification service, and an AI candidate-matching stored procedure suggests the team is actively investing in AI-powered automation. The logical next steps are AI-powered candidate ranking, predictive fill-time estimates, and an AI assistant that actually understands portal context (rather than a generic iframe).
- **Jobseeker Self-Service Expansion:** Jobseekers currently have a thin experience. The infrastructure supports them viewing their profile and timesheets, but there are hints that the product intends to give them more — potentially viewing and signing more documents, requesting time off, or confirming hours worked.
- **Reporting Exports:** Reports can be downloaded as CSV; Excel export and scheduled reports do not exist.
- **Notification System:** As the platform grows and manages more time-sensitive operations (document expiries, position start dates, outstanding invoices), an in-app notification or alert system becomes increasingly valuable.

### Longer-Term (Speculative but Pattern-Supported)

- **Multi-Agency / Multi-Portal Support:** Delivered: four live portals run from one codebase using feature flags and portal settings. What remains is moving the last per-portal differences (brand image files) out of the branches, and retiring the environment-variable fallbacks.
- **Client-Facing Portal:** The infrastructure for digital consent already creates a partial public-facing experience for clients. This could expand into a full client self-service portal where clients can view their own invoices, positions, and worker assignments.
- **Advanced Financial Features:** The billing model (margin calculation, multiple payment methods, cash deductions) is already quite sophisticated. The logical extension is automated payroll runs, direct payment processing integrations, and tax document generation.

---

*Last updated: November 2026 — multi-portal setup, feature flags, portal settings, support tickets, scheduled jobs, jobseeker payroll cards and the fixed timesheet delete added; earlier sections re-checked against the code.*
