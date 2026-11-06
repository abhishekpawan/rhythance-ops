# Digital consent

Collects typed-name consent from clients and jobseekers on documents such as the Employment Agreement. Staff pick a document and recipients; each recipient gets an emailed link with a personal token, opens a public page (no login), reads the document, types their full name, ticks a box and submits.

## Flow

1. **Template (optional, super admin).** A template is a PDF plus field mappings used to fill in recipient details automatically. Page `/consent-dashboard/templates`.
2. **Create a consent document.** `/consent-dashboard/new`. Two modes (`consent_documents.consent_mode`):
   - `standard`: upload a PDF as it is.
   - `autofill`: pick a template; each recipient's details are written into their own copy of the PDF.
3. **Send.** `POST /api/consent/request` creates one `consent_records` row per recipient (client or jobseeker profile) with a unique `consent_token` and emails the link `{CLIENT_URL}/consent?token=...` (email #11 in [email-triggers.md](../email-triggers.md)).
4. **Sign.** The public page `/consent` loads the record with `GET /api/consent/view?token=...`, and `POST /api/consent/submit` stores the typed name, the time and the caller's IP address, and marks the record `completed`. For autofill documents the filled PDF is stored with the record.
5. **Follow up.** `/consent-dashboard` lists documents with how many recipients have signed; the detail page lists records and can resend (`POST /api/consent/resend`, email #12). Opening a used link shows a confirmation instead of the form.

### Employment agreement for new jobseekers

A jobseeker must sign the active `employmentAgreement` template before using the portal (`ProtectedRoute` sends them to `/onboarding-consent` until it is signed). The record and email are created automatically when a recruiter submits the profile, when the jobseeker confirms their email, or on their first visit if none exists (emails #13 and #14). If the template row is missing or inactive, the email is skipped and nothing else breaks.

## Data

Tables (migration `server/src/db/migration_v2/009_consent.sql`; `017_jobseeker_onboarding_consent.sql` adds the `is_jobseeker_onboarding` flag on documents and records and the `user` recipient type):

| Table | Purpose |
| --- | --- |
| `consent_document_templates` | Template PDF, `field_mappings` (JSON array), `is_active` |
| `consent_documents` | Uploaded document, `consent_mode` (`standard` or `autofill`), `autofill_fields`, optional `template_id`, version |
| `consent_records` | One per recipient: `consentable_type` (`client`, `jobseeker_profile` or, for the onboarding agreement, `user`), `consentable_id`, `status` (`pending`, `completed`, `expired`), `consent_token` (unique), `sent_at`, `completed_at`, `consented_name`, `ip_address`, filled-document path |

Files are kept in Supabase Storage.

## API (`/api/consent`, `server/src/routes/consent.ts`)

| Endpoint | Access |
| --- | --- |
| `GET /templates` | admin, recruiter |
| `POST /templates`, `DELETE /templates/:templateId` | admin (the page itself is super admin only) |
| `GET /documents`, `GET /records/:documentId`, `GET /entity-records/:consentableId` | admin, recruiter |
| `POST /request` | **super admin only** |
| `POST /resend` | admin, recruiter |
| `GET /view?token=`, `POST /submit` | public (token is the credential) |
| `GET /jobseeker-onboarding-consent` | logged-in jobseeker |

## Access in the UI

| Page | Roles |
| --- | --- |
| All Consent Documents, Create Consent Document | admin, recruiter, recruiter manager, recruiter director |
| Consent Templates | super admin |
| Public signing page `/consent` | anyone with a token |

Note the mismatch: the Create page is open to the roles above, but the API only lets a super admin create requests, so other roles get a 403 on submit. See [codebase-audit.md](../codebase-audit.md) and [../TODO.md](../TODO.md).

## Code

| Part | Location |
| --- | --- |
| Pages | `client/src/pages/Consent/` (`ConsentListPage`, `ConsentDetailPage`, `ConsentRecordDetailModal`, `CreateConsentPage`, `ConsentTemplatePage`, `ConsentPage`, `OnboardingConsent`) |
| API client | `client/src/services/api/consent.ts` |
| Server | `server/src/routes/consent.ts` |
| Email | `server/src/email-templates/consent-html.ts`, `employment-agreement-html.ts` |

## Limits to keep in mind

- This is a typed-name acknowledgement with timestamp and IP, not a drawn signature.
- Links do not expire automatically (the `expired` status exists but nothing sets it), even though the email text mentions expiry.
- The public endpoints currently have their rate limiters switched off.
