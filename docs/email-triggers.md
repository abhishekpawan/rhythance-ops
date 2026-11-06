# Email triggers

Every email the portal sends, what triggers it, who receives it and where the code lives.
Trigger numbers (#1 to #20) are also used as comments in `client/src/pages/EmailTemplatePreview/EmailTemplatePreviewPage.tsx`; keep them stable.
Last verified against the code: November 2026.

## Providers and sender settings

- **SendGrid** (`@sendgrid/mail`, key in `SENDGRID_API_KEY`) sends everything except #1, #2a and #3, which Supabase Auth sends with the templates configured in the Supabase dashboard.
- **Sender addresses come from Portal Settings** (database first, then the environment variable, then the default; see [portals-and-configuration.md](portals-and-configuration.md)):

  | Used for | Portal setting | Environment fallback |
  | --- | --- | --- |
  | Most emails | `email.noReplyFrom` | `NO_REPLY_FROM_EMAIL` |
  | Jobseeker assignment and removal (#5, #6) | `email.assignmentFrom`, then the no-reply address | `ASSIGNMENT_FROM_EMAIL` |
  | Last-resort sender | `email.defaultFrom` | `DEFAULT_FROM_EMAIL` (deprecated) |

- **Sender display name** is `<portal name> Ops Portal` (the portal name is the `portal.name` setting; "Ops Portal" is not repeated if the name already ends with it). See `formatFromEmail` in `server/src/middleware/emailNotifier.ts`.
- `{PORTAL_NAME}` in the texts below means the `portal.name` setting. Action links are built from the `CLIENT_URL` environment variable.
- Templates live in `server/src/email-templates/` (shared layout in `_layout.ts`). A super admin can preview them at `/email-template-preview`.

## Two sending patterns

- **Pattern A, `emailNotifier` middleware** (profile, positions, timesheet create/update, consent): the route answers first; after the response finishes the middleware reads `res.locals` and sends the email. A failed email is logged and never fails the API call.
- **Pattern B, direct `sgMail.send()` in the handler** (timesheet re-send, invoice send, recruiter reminder, #13 to #15): the response waits for the email attempt. For the manual send actions (#8, #10) a failure returns an error to the user; for #13 to #15 a failure is only logged.

## Quick reference

| # | Trigger | Endpoint | Recipients | Subject | Sent by |
| --- | --- | --- | --- | --- | --- |
| 1 | Admin invites a recruiter | `POST /api/users/invite-recruiter` | Invited recruiter | Supabase invitation subject | Supabase Auth |
| 2a | Resend invitation, email not verified | `POST /api/users/resend-invitation` | Recruiter | Supabase invitation subject | Supabase Auth |
| 2b | Resend invitation, email verified but onboarding incomplete | `POST /api/users/resend-invitation` | Recruiter | Complete Your Account Setup - Action Required | SendGrid |
| 3 | User asks for a new verification link | `POST /api/auth/resend-verification` | User | Supabase verification subject | Supabase Auth |
| 4 | Jobseeker profile created by a recruiter (welcome) | `POST /api/profile` | Jobseeker | Welcome to {PORTAL_NAME} | SendGrid (+ Supabase verification mail for a new auth account) |
| 5 | Jobseeker assigned to a position | `POST /api/positions/:id/assign` | Jobseeker | Congratulations! You've Been Matched to a New Position Opportunity | SendGrid |
| 6 | Jobseeker removed from a position | `DELETE /api/positions/:id/assign/:candidateId` | Jobseeker | Update Regarding Your Position Assignment | SendGrid |
| 7 | Timesheet created, email option ticked | `POST /api/timesheets` | Jobseeker (billing email, else primary) | Timesheet Summary - Timesheet #{number} | SendGrid |
| 8 | Timesheet re-sent manually | `POST /api/timesheets/send-email/:id` | Same as #7 | Timesheet Summary - Timesheet #{number} | SendGrid |
| 9 | Timesheet updated, email option ticked | `PUT /api/timesheets/:id` | Same as #7 | Updated Timesheet Summary - Timesheet #{number} | SendGrid |
| 10 | Invoice sent to client | `POST /api/invoices/:id/send-email` | Given address (TO), client and portal CC list | Invoice #{number} for {client name} | SendGrid |
| 11 | Consent request created | `POST /api/consent/request` | Each client or jobseeker in the batch | Digital Consent Request: {document name} | SendGrid |
| 12 | Consent request resent | `POST /api/consent/resend` | Each selected record | Digital Consent Request: {document name} | SendGrid |
| 13 | Employment agreement for a jobseeker | `POST /api/profile/submit` (A), `GET /api/consent/jobseeker-onboarding-consent` (B) | Jobseeker | Action Required: Sign Your Employment Agreement | SendGrid |
| 14 | Jobseeker confirms their email: welcome plus employment agreement | `POST /api/auth/send-confirmation-welcome` | Jobseeker | #4 subject and #13 subject | SendGrid |
| 15 | First login without a profile: setup reminder | `POST /api/auth/first-login-reminder` | Jobseeker | Complete Your Account Setup - Action Required | SendGrid |
| 16 | Support: new ticket | `POST /api/support/tickets` | Support notification addresses | [{PORTAL_NAME}] SUP-0001: {title} | SendGrid |
| 17 | Support: requester adds a message | `POST /api/support/tickets/:id/messages` | Support notification addresses | same pattern | SendGrid |
| 18 | Support: requester reopens a ticket | `POST /api/support/tickets/:id/reopen` | Support notification addresses | same pattern | SendGrid |
| 19 | Support: agent replies (not an internal note) | `POST /api/support/tickets/:id/messages` | Ticket requester | same pattern | SendGrid |
| 20 | Support: ticket set to waiting on client or resolved | `PATCH /api/support/tickets/:id` | Ticket requester | same pattern | SendGrid |

## Details

### #1 Recruiter invitation
- File: `server/src/routes/user.ts`. Access: admin only.
- Uses `supabase.auth.admin.inviteUserByEmail`; the email links to `{CLIENT_URL}/complete-signup`.
- Only sent if the email does not already exist in Supabase Auth. User metadata: name, `user_type = "recruiter"`, `onboarding_complete = false`.

### #2 Resend invitation / onboarding reminder
- File: `server/src/routes/user.ts`. Access: admin only. Not possible once onboarding is complete.
- **2a** (email not verified): Supabase invitation again, link to `/complete-signup`.
- **2b** (email verified, onboarding incomplete): SendGrid with `onboarding-reminder-html/txt.ts`: "Complete Your Account Setup, {name}", warning banner, button to `/complete-signup`, signed "The {PORTAL_NAME} Team".

### #3 Resend email verification
- File: `server/src/routes/auth.ts`. Public endpoint. Uses `supabase.auth.resend`; the link redirects to `{CLIENT_URL}/login`.

### #4 Jobseeker welcome
- File: `server/src/routes/profile.ts`, via `emailNotifier`. Templates: `jobseeker-welcome-html/txt.ts`.
- To the jobseeker's email from the profile data; skipped when there is none.
- Content: "Welcome to {PORTAL_NAME}, {firstName}", profile added, button "Open {PORTAL_NAME}" to `CLIENT_URL`, invitation to reply with questions.
- Optional attachments: every file in the Supabase Storage bucket `default-documents`, folder `jobseekerWelcomeDocs/`. Sent without attachments if the folder is empty.
- When the recruiter creates a profile together with a new auth account, Supabase also sends its own verification email. The jobseeker's password is generated by the system and returned only to the recruiter; the jobseeker uses "Forgot password" to set their own.

### #5 Jobseeker assigned to a position
- File: `server/src/routes/positions.ts`, via `emailNotifier`. Templates: `jobseeker-assignment-html/txt.ts`. From address: assignment sender.
- To the jobseeker's email (read from `jobseeker_profiles`); skipped if none.
- Content: "Congratulations, {first name}!" with position title, client, location, full address, employment type/term, shift time, pay rate and type, start and end date, category, experience; note that the team will follow up.
- **Employee handbook attachment is controlled by the feature flag `attach_handbook_to_assignment_email`** (on for Godspeed only). When on, the PDF is downloaded from Supabase Storage using the flag's settings (defaults: bucket `default-documents`, path `employeeHandbook/employeeHandbook2024.pdf`, attachment name `Godspeed_Employee_Handbook_2024.pdf`) and the email gains a handbook section. When off, or if the file is missing, the email goes without it.

### #6 Jobseeker removed from a position
- File: `server/src/routes/positions.ts`, via `emailNotifier`. Templates: `jobseeker-removal-html/txt.ts`. From address: assignment sender.
- Content: "Hi {first name}," with position title, location, employment type/term, start and end date, category, experience, number of positions; invitation to reply about other opportunities. Skipped if no email.

### #7, #8, #9 Timesheet emails
- Files: `server/src/routes/timesheet.routes.ts` (#7 and #9 via `emailNotifier`), `server/src/services/timesheet.service.ts` (#8 sends directly). Templates: `timesheet-html/txt.ts`.
- **To the jobseeker only**: billing email if set, otherwise primary email. No CC, ever.
- #7 and #9 send only when the request has `emailSent: true`. #9 has an "Updated" prefix and badge.
- #8 can be used by admin, recruiter-type roles and the jobseeker (own timesheets only); on success it sets `email_sent = true` on the timesheet.
- Content: timesheet number and date, jobseeker, position, week, daily hours, payment summary (regular hours and rate, premium rate, overtime, bonus, deductions, cash/e-Transfer deduction, total jobseeker pay), footer "generated by {PORTAL_NAME}".

### #10 Invoice sent to client
- File: `server/src/routes/invoices.ts` (direct send). Template: `invoice-html.ts`. Access: admin and recruiter-type roles.
- TO: the address in the request body (normally the client's primary email), required.
- CC: the portal setting `email.invoiceCc` (always), plus per client flags: `email_address2` (`invoice_cc2`), `email_address3` (`invoice_cc3`), `dispatch_dept_email` (`invoice_cc_dispatch`), `accounts_dept_email` (`invoice_cc_accounts`).
- Attachments: the invoice PDF from the `invoices` bucket (`invoice.document_path`) plus any `invoice_data.attachments`.
- On success the invoice gets `email_sent = true`, `email_sent_date` and `invoice_sent_to`.

### #11 Consent request created
- File: `server/src/routes/consent.ts`, via `emailNotifier`. Template: `consent-html.ts`. **Super admin only.**
- One email per recipient (client: `email_address1`; jobseeker: profile email), each with its own link `{CLIENT_URL}/consent?token=...`. Recipients without a resolvable email are skipped.

### #12 Consent request resent
- Same template and link style as #11, using the existing token of each selected record (`recordIds`). Updates `sent_at`. Access: admin and recruiter.

### #13 Employment agreement
- Template: `employment-agreement-html.ts`. Sent directly from the handler.
- **Trigger A**: jobseeker profile submitted by a recruiter (`server/src/routes/profile.ts`), to the profile email.
- **Trigger B**: a jobseeker without an agreement record first opens the portal (`GET /api/consent/jobseeker-onboarding-consent`, `server/src/routes/consent.ts`), to their login email. Fires once; later calls return the existing record.
- Content: account verified, two ways to sign (direct link with the jobseeker's token, or log in), next steps, warning that the link is personal and the account stays locked until the agreement is signed.
- Needs an active `employmentAgreement` row in `consent_document_templates`; if missing the email is skipped and profile creation still succeeds.

### #14 Email confirmation: welcome plus employment agreement
- File: `server/src/routes/auth.ts`. Jobseekers only. Two emails in parallel: the #4 welcome and the #13 agreement.
- Idempotent: guarded by `welcome_email_sent` in the user's metadata, which is set before sending to avoid duplicates. Creates the agreement consent record first; without the template only the welcome goes out. Failures are logged, not returned.

### #15 First login, setup reminder
- File: `server/src/routes/auth.ts`. Jobseekers only, only when no profile exists yet. Templates: `onboarding-reminder-html/txt.ts` (shared with #2b), button to `{CLIENT_URL}/profile/create`.
- Idempotent through `setup_reminder_sent`; the client calls it only after `welcome_email_sent` is true.

### #16 to #20 Support module
- Files: `server/src/services/support.email.ts`, `server/src/routes/support/`. Templates: `support-*.ts`. From address: no-reply sender. Subject: `[{PORTAL_NAME}] SUP-0001: {title}`.
- Emails to the support team (#16, #17, #18) go to the portal settings `email.supportNotifyTo` (CC `email.supportNotifyCc`); **if the "to" setting is empty nothing is sent**.
- Emails to the requester (#19, #20) go to the requester's email. Internal notes never email the requester.
- All support emails are fire-and-forget; failures are logged only. See [features/support-tickets.md](features/support-tickets.md).

## Settings and variables used for email

| Name | Where | Purpose |
| --- | --- | --- |
| `SENDGRID_API_KEY` | environment (secret) | SendGrid authentication |
| `email.noReplyFrom`, `email.assignmentFrom`, `email.defaultFrom` | Portal Settings (env fallbacks above) | Sender addresses |
| `email.invoiceCc` | Portal Settings (`INVOICE_CC_EMAILS`) | Fixed CC on invoice emails |
| `email.supportNotifyTo`, `email.supportNotifyCc` | Portal Settings (`SUPPORT_NOTIFY_TO`, `SUPPORT_NOTIFY_CC`) | Support notifications |
| `portal.name` | Portal Settings (`PORTAL_NAME`) | Sender name, subjects, sign-offs |
| `CLIENT_URL` | environment | Base of every link in emails |

## Template files

| File | Used by |
| --- | --- |
| `recruiter-invitation-html.ts` | Preview of #1 and #2a (the live email is Supabase's) |
| `confirm-signup-html.ts` | Preview of #3 (the live email is Supabase's) |
| `onboarding-reminder-html/txt.ts` | #2b, #15 |
| `jobseeker-welcome-html/txt.ts` | #4, #14 |
| `jobseeker-assignment-html/txt.ts` | #5 |
| `jobseeker-removal-html/txt.ts` | #6 |
| `timesheet-html/txt.ts`, `timesheet-email-numeric.ts` | #7, #8, #9 |
| `invoice-html.ts` | #10 |
| `consent-html.ts` | #11, #12 |
| `employment-agreement-html.ts` | #13, #14 |
| `support-new-ticket.ts`, `support-requester-message.ts`, `support-ticket-reopened.ts` | #16, #17, #18 |
| `support-agent-reply.ts`, `support-status-changed.ts` | #19, #20 |
| `_layout.ts` | Shared wrapper and `getPortalName()` |
