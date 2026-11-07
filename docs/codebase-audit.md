# Codebase audit

Functional status of every area of the portal, based on reading the implementation. The first version was written in May 2026; **November 2026** re-checked the areas marked *(Nov 2026)* against the code and added the modules built since (feature flags, portal settings, support tickets). Items without that mark carry over from May and were not re-read.

Status key: **Fully working** means the code path is wired end to end assuming env services are configured. **Partially built** means meaningful code exists but wiring, permissions, UI, or dependencies are incomplete. **Scaffolded/stubbed** means mostly placeholder, disabled, or demo-only.

Build check (Nov 2026): `tsc --noEmit` passes with no errors on both `client` and `server` (a type check; the Vite bundle build was not re-run).

**Platform & Access**
- Authentication and account lifecycle: Users can register, log in, verify email/phone, reset passwords, complete onboarding, and fetch their current session/profile. Access: all user types. Status: **Fully working**.
- Internal 2FA: Internal users are required to verify by phone OTP after password login. Access: admin/recruiter-type internal users. Status: **Partially built** because the password is temporarily carried through client route state during 2FA.
- Role-based access control: Routes, menus, and backend middleware restrict features by role; a `superadmin` value unlocks the configuration pages. Access: all roles. Status: **Partially built** because several frontend/backend role rules do not match (see [role-access-control.md](role-access-control.md)). *(Nov 2026)*
- Jobseeker onboarding gates: Jobseekers are forced through employment agreement, profile creation, pending, rejected, or verified flows. Access: jobseeker. Status: **Fully working**.
- Internal user invitations and hierarchy: Admin-style users can invite recruiters/internal users, assign managers, and manage user roles/hierarchy. Access: admin, recruiter managers/directors in UI. Status: **Partially built** due permission mismatches with backend.
- Theme, language, legal pages: App supports light/dark theme, English/French locale toggling (including merged `en/timesheet.json` and `fr/timesheet.json` bundles for all timesheet screens), terms, and privacy pages. Access: all users/public where applicable. Status: **Fully working**.
- Sidebar menu scroll persistence: Hamburger menu restores scroll position across navigation and refresh via session storage (`menuScrollState.ts`). Access: users with sidebar. Status: **Fully working**.
- Portal switcher: the header icon on the admin and recruiter dashboards lists the other portals; the list and this portal's icon come from Portal Settings (`switcher.*`) and the switcher is hidden when empty (demo, public demo). Access: admin and recruiter dashboards. Status: **Fully working**. *(Nov 2026)*

**Jobseeker Management**
- Jobseeker profile creation/editing: Captures personal info, work preferences, payment details, documents, SIN/work permit data, and profile metadata. Access: jobseeker, admin, recruiter, recruiter manager/director. Status: **Fully working**.
- Profile drafts: Jobseeker profiles can be saved as drafts and resumed/deleted. Access: admin, recruiter, recruiter manager/director. Status: **Fully working**.
- Profile verification: Internal users can approve/reject jobseeker profiles and jobseekers see pending/rejected states. Access: admin/recruiter-type roles. Status: **Fully working**.
- Jobseeker listing/search/filtering: Internal users can browse, filter, paginate, update, and delete jobseekers. Access: admin, recruiter, bookkeeper, recruiter/accountant managers, recruiter director. Status: **Fully working**, with backend access broader than UI in places.
- Jobseeker detail view: Shows profile, documents, position assignments, and consent records. Access: permitted internal users and jobseeker self-flows. Status: **Fully working**.
- Jobseeker self-service profile and positions: Jobseekers can view their own profile and assigned positions. Access: jobseeker. Status: **Fully working**.
- Expiry monitoring: SIN/work permit expiry fields and expiry count metrics (`/api/metrics/jobseekers/expiry-status-counts`, now declared before the `:candidateId` route). Access: internal roles. Status: **Fully working**. *(Nov 2026)*

**Client Management**
- Client CRUD: Users can create, view, update, delete, and search clients with contacts, billing, addresses, payment, WSIB, and status fields. Access: admin, recruiter manager, accountant manager, recruiter director. Status: **Fully working**.
- Client drafts: Client forms can be saved, resumed, listed, and deleted as drafts. Access: admin, recruiter manager, accountant manager, recruiter director. Status: **Fully working**.
- Client consent history: Client profiles can show related consent records. Access: internal consent/client roles. Status: **Fully working**.
- Client inactivity tracking: Database fields and monitor logic exist for last activity/inactive clients. Access: internal users. Status: **Partially built**; I saw backend/schema support, but not a complete dedicated management UI.

**Position & Placement**
- Position CRUD: Users can create, edit, delete, list, and view positions with client, dates, rates, shifts, category/subcategory, and premium pay fields. Access: admin, recruiter, bookkeeper, recruiter/accountant managers, recruiter director for viewing; create/edit mostly manager/admin/director. Status: **Fully working**.
- Position drafts: Positions can be saved and resumed as drafts. Access: admin, recruiter manager, recruiter director. Status: **Fully working**.
- Position code generation: Backend generates unique position codes. Access: position creators. Status: **Fully working**.
- Candidate matching and assignment: Positions can surface candidates and assign/remove jobseekers. Access: admin, recruiter, recruiter manager/director. Status: **Partially built** because matching depends on embedding/vector infrastructure and DB functions.
- Candidate assignment tracking: Assignment lists are available by position and by candidate. Access: internal users and jobseeker self views. Status: **Fully working**.
- Invoicing-only position subcategories: Schema and logic distinguish invoice-only subcategories from normal assignment/calendar use. Access: position managers. Status: **Fully working**.

**Timesheet & Payroll**

_Module layout (May 2026):_ Client code lives under `client/src/pages/TimesheetManagement/` (pages, hooks, components, calculation helpers). Server API was split from monolithic `routes/timesheets.ts` into `routes/timesheet.routes.ts`, `controllers/timesheet.controller.ts`, `services/timesheet.service.ts`, `services/timesheet.email.ts`, and `types/timesheet.types.ts`. Routes remain mounted at `/api/timesheets`.

| Route | Page | UI roles |
| --- | --- | --- |
| `/timesheet-management` | Single timesheet | `TIMESHEET_MANAGEMENT_ROLES` |
| `/bulk-timesheet-management` | Bulk by client | `BULK_TIMESHEET_ROLES` (admin, bookkeeper) |
| `/bulk-timesheet-management/jobseeker` | Bulk by jobseeker | `BULK_TIMESHEET_ROLES` |
| `/timesheet-management/list` | All timesheets | `BULK_TIMESHEET_ROLES` |
| `/bulk-timesheet-management/list` | Redirect → list | — |

- Single timesheet entry: Jobseeker → client → position → week cascade; daily hours grid; load/create/update one record per combination; live payroll preview; bonus/deduction/notes; optional email on submit. Access: admin, recruiter, bookkeeper, recruiter manager/director (UI). Status: **Fully working**.
- Hybrid payroll split: Shared `timesheetCalculations.ts` drives regular/overtime, premium rates, payment-method deductions, and SIN cap behavior in single and bulk forms. Access: timesheet roles. Status: **Fully working**.
- Bulk timesheet (client-centric): Select client, position, week; auto-load assigned jobseekers; per-worker forms; batch submit creates **one timesheet per worker** with unique invoice numbers, progress UI, duplicate skip, and partial-failure reporting. Invoice-only subcategory positions show a banner (no assignees). Access: admin, bookkeeper. Status: **Fully working** for create/update batch flows.
- Bulk timesheet (jobseeker-centric): Select jobseeker, client, week; add multiple position rows (`BulkJobseekerPositionCard`); prefills existing week data; same per-row invoice/batch submit behavior as client bulk. Access: admin, bookkeeper. Status: **Fully working** for create/update batch flows.
- All timesheets list: Paginated index with column filters (invoice #, client, position, jobseeker, billing email, date range, email status); send/resend email per row; delete; header shortcuts to both bulk creators. Access: admin, bookkeeper. Status: **Fully working**. *(Nov 2026)*
- Timesheet email workflow: Create/update optional email via `emailNotifier`; manual send via `POST /api/timesheets/send-email/:id`; templates in `email-templates/timesheet-*.ts`. Prefers billing email over primary. Access: timesheet roles (backend `authorizeRoles(["admin","recruiter","jobseeker"])` expands `recruiter` to include bookkeeper and other internal roles). Status: **Fully working** if SendGrid/config is present.
- Timesheet delete API: `DELETE /api/timesheets/:id` with activity logging. Access: same expanded recruiter group. Status: **Fully working**. *(Nov 2026)*
- Timesheet list delete: the table shows a delete button to the roles in `DELETE_TIMESHEET_ROLES`, the confirmation modal calls `DELETE /api/timesheets/:id`, and the list refreshes. Status: **Fully working**. *(Nov 2026)*
- Timesheet view and edit from the list: each row has a View button (read-only page `/timesheet-management/view/:id`) and an Edit button that opens the single-entry page (or the jobseeker bulk page for aggregated timesheets) pre-filled with that jobseeker, client, position and week. Status: **Fully working**. *(Nov 2026)*
- Document metadata on timesheet: `PATCH /api/timesheets/:id/document` for attachment metadata. Access: timesheet roles. Status: **Fully working** where used.
- Deprecated client paths: `pages/BulkTimesheetManagement/` removed; old `BulkTimesheetList` removed; `/bulk-timesheet-management/list` redirects to `/timesheet-management/list`.

**Invoicing & Billing**
- Invoice creation/editing: Users can build invoices from timesheets, manual line items, supplier/PO details, tax settings, notes, payment terms, and attachments. Access: admin, accountant manager. Status: **Fully working**.
- Invoice PDF generation/storage/preview: Client code generates PDFs and updates invoice document metadata. Access: invoice roles. Status: **Fully working**.
- Invoice list/search/send/delete: Users can list, filter, delete, send, and resend invoices. Access: admin, accountant manager. Status: **Fully working**.
- Invoice number generation: Backend generates invoice numbers for invoices/timesheets. Access: billing/timesheet roles. Status: **Fully working**.

**Reports & Analytics**
- Reports hub: Dedicated reports area links to timesheet, margin, invoice, deduction, rate list, clients, sales, and envelope-printing reports. Access: admin, bookkeeper, accountant manager, recruiter director. Status: **Fully working**.
- CSV export/filtering: Report pages support filters and export utilities. Access: report roles. Status: **Fully working**.
- Operational metrics: Dashboards pull recruiter, client, position, timesheet, invoice, jobseeker, and AI metrics. Access: dashboard roles. Every card shows a running total over all time as its headline; the trend (like YouTube Studio) compares the last 30 days with the 30 days before (whole Toronto days), and the chart shows those same 30 days day by day with the previous 30 days dashed behind them, or 12 calendar months with the current month marked as in progress. All of it is calculated in `server/src/utils/metricMonths.ts` (Toronto calendar months, paged reads past Supabase's 1000-row cap). Verification-status cards are approximate (no status history is kept), and "Total Documents Scanned" has no history (`ai_validation` has no `created_at`), so its trend shows N/A. Status: **Fully working**, except the AI monthly chart (below). *(Nov 2026)*
- AI insights analytics: Counts AI validation records and position capacity. Access: internal dashboards. Status: **Partially built**; server contains a TODO about missing/unused historical `created_at` logic.

**Digital Consent & Compliance**
- Consent requests: Users can create consent documents for clients/jobseekers, select templates, upload/generate documents, and send signing links. Access: UI allows admin/recruiter/manager/director roles. Status: **Partially built** due backend requiring superadmin on request creation.
- Public consent signing: Tokenized public pages let recipients view and submit signed consent. Access: public token holders. Status: **Fully working**.
- Consent records dashboard/detail: Internal users can view consent records, documents, statuses, and entity history. Access: consent roles. Status: **Fully working**.
- Consent templates: Templates and autofill field definitions exist. Access: superadmin UI/admin backend. Status: **Partially built** due role mismatch.
- Jobseeker employment agreement: Jobseekers must complete onboarding consent before normal app access. Access: jobseeker. Status: **Fully working**.
- Legal pages: Terms and privacy pages exist as public routes. Access: public/all users. Status: **Fully working**.

**AI Features**
- AI chat page: Internal users can open an embedded external AI chat app in an iframe. The page title is the Portal Setting `branding.aiChatTitle`; the address is `VITE_AI_CHAT_URL` or a built-in default. Access: internal staff roles. Status: **Partially built** because the main app delegates functionality to an external service. *(Nov 2026)*
- Floating AI chat widget: A richer streaming chat component exists. Access: would be internal users. Status: **Scaffolded/stubbed**; it is commented out in `App.tsx`.
- AI document validation: Profile create/update calls an AI validation service asynchronously for uploaded documents. Access: jobseeker/profile flows. Status: **Partially built** because failures are logged but do not affect user flow.
- AI candidate matching infrastructure: Vector/embedding schema and candidate matching behavior exist. Access: placement roles. Status: **Partially built** because it depends on optional DB embedding functions/services.

**Training**
- Video training modules: Training page shows YouTube-based modules: the two mandatory ones (AODA, workplace violence/harassment) use video ids from Portal Settings (`training.video1`, `training.video2`); WHMIS and health/safety use fixed ids. Access: internal users and jobseekers. Status: **Fully working** for playback. *(Nov 2026)*
- Document/interactive modules: Additional modules are marked coming soon. Access: training users. Status: **Scaffolded/stubbed**.
- Training completion tracking: Module data has completion fields but no persistent backend tracking. Access: training users. Status: **Scaffolded/stubbed**.

**Dashboards & Activity**
- Role dashboards: App routes users to admin, recruiter, or jobseeker dashboard variants. Access: respective roles. Status: **Fully working**, except metrics caveats.
- Recent activity feed: Server logs activities and client subscribes to realtime activity updates. Access: dashboard/internal views. Status: **Fully working**.
- Jobseeker dashboard metrics: Jobseekers see their own profile/position data; `GET /api/metrics/jobseekers/:candidateId` allows `jobseeker` but returns 403 unless the id is the caller's own (admins and recruiters can read anyone). Optional payroll cards ("Total No. Hours", "Gross Amount") appear only when the `jobseeker_payroll_summary` flag is on, and the API withholds the numbers when it is off. Access: jobseeker. Status: **Fully working**. *(Nov 2026)*

**Calendar**
- Calendar events: Calendar displays position and assignment-based events with day/month views. Access: internal staff roles. Status: **Fully working**.
- Calendar summaries: Backend returns event summaries for date ranges. Access: internal staff roles. Status: **Fully working**.
- Calendar filters: Client/jobseeker filter component and some quick filters are present but commented out. Access: internal staff roles. Status: **Scaffolded/stubbed**.

**Communications & Notifications**
- Email workflows: Code supports verification, welcome, first-login reminder, onboarding reminder, employment agreement, consent, assignment/removal, timesheet, invoice, recruiter invitation and support-ticket emails (see [email-triggers.md](email-triggers.md)). Sender addresses and names come from Portal Settings. Access: relevant users. Status: **Fully working** if SendGrid/Supabase email config is present. *(Nov 2026)*
- Email template preview: Preview route exists for template rendering. Access: superadmin route. Status: **Fully working**.
- SMS OTP: Twilio-backed phone OTP is used for verification and 2FA. Access: users with phone verification flows. Status: **Fully working** if Twilio env vars are configured.
- Toast notifications: UI uses toasts for success/error feedback. Access: all authenticated users. Status: **Fully working**.
- General notification center: I did not find a real inbox/notification center. Status: **Not present**.

**Admin & Configuration**
- Dropdown option management: Admin/config UI manages dropdown values used across forms. Access: admin/manager/director in UI. Status: **Partially built** because backend writes appear admin-only.
- User and role management: User list, role update, manager assignment, and hierarchy routes exist. Access: admin/recruiter director in UI. Status: **Partially built** because backend allows broader recruiter-style access.
- Recruiter hierarchy: Dedicated hierarchy data/routes exist. Access: admin/recruiter director UI. Status: **Fully working** with permission caveat.
- Security headers/CORS: Server configures Helmet, CORS, JSON limits, and auth middleware. Access: platform-level. Status: **Partially built**.
- Database migrations/RLS/storage: Migrations define tables, indexes, RLS helpers, storage buckets, triggers, and realtime publication. Access: platform-level. Status: **Partially built** because app often uses service-role server access, so route authorization is the main enforcement layer.

**Per-portal configuration** *(Nov 2026; see [portals-and-configuration.md](portals-and-configuration.md))*
- Feature flags: registry in code, per-portal overrides in `feature_flags`, server `isFeatureEnabled` and client `useFeatureFlag`/`FeatureGate`, super-admin page `/feature-flags`. Five flags, all wired. Access: super admin to change, any user to read. Status: **Fully working**.
- Portal settings: 24 settings (company details, sender addresses, brand name, legal-page names and contact, switcher list, staff-email rules, training videos) with database > environment > default resolution and a super-admin page `/portal-settings`. Public subset served before login. Access: super admin to change. Status: **Fully working**. The environment-variable fallbacks are still in place.
- Seed files per portal in `server/src/db/seeds/`. Status: **Fully working** (reference and first-time setup).

**Support tickets** *(Nov 2026; see [features/support-tickets.md](features/support-tickets.md))*
- In-portal help desk with types, urgency/priority, five statuses, public and internal messages, attachments, email notifications, 7-day auto-close and a 14-day reopen window. Access: internal staff request; super admins act as agents. Status: **Fully working** if SendGrid and the `support-attachments` bucket exist.

**Scheduled jobs** *(Nov 2026)*
- The app has no application-level cron, but the database runs two `pg_cron` jobs where the extension is available: `support-auto-close` (daily 03:30 UTC) and `purge-cron-job-run-details` (weekly, Sunday 03:00 UTC). Status: **Fully working** where `pg_cron` is installed; the support job is skipped (with a notice) if it is not.


**Clear Flags**
- **Security concern:** Global API rate limiting is defined but disabled, and many sensitive route-level limiters are commented out, including auth-adjacent/public consent paths.
- **Security concern:** Backend permissions are often broader than frontend permissions because `authorizeRoles(["recruiter"])` expands to several internal roles. Reports, invoices, users, and other APIs may be callable by roles that the UI does not expose.
- **Bug/permission mismatch:** Consent request creation UI allows several roles, but the backend uses `requireSuperAdmin`; many users may see the UI and fail on submit.
- **Bug/permission mismatch:** Dropdown option management UI allows manager/director roles, but backend write routes appear admin-only.
- **Bug/permission mismatch:** Internal user invite/resend UI allows manager/director roles, but backend invite routes appear admin-only.
- **UI without active backend/use:** Training completion/progress and calendar filters are present but not wired.
- **Commented out/scaffolded:** Floating AI chat widget (still commented out in `App.tsx`; its chat address is hard-coded), calendar filter UI, and several "coming soon" training modules.
- **Security concern if re-enabled:** Floating AI chat renders markdown with `dangerouslySetInnerHTML` and sanitization disabled; it is currently inactive.
- **Maintainability concern:** Debug `console.log` calls remain in `AppHeader.tsx`. `server/src/utils/encryption.ts` is not imported anywhere yet throws at load without `ENCRYPTION_KEY`/`ENCRYPTION_IV`. `RATE_LIMIT_*` variables in `server/.env.example` are not read by any code, and `VITE_AI_CHAT_URL` is missing from `client/.env.example`.
- **Build concern:** Client bundle is very large and Vite reports eval usage from dependencies, but build succeeds.

*Last updated: November 2026 (configuration, support and metrics areas re-verified; other areas as of May 24, 2026).*

Audit complete.
