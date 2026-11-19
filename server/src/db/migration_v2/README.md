# migration_v2 (Consolidated)

This folder now contains a reduced, consolidated migration set.

## Run order

Execute in lexical order:

```powershell
Get-ChildItem .\server\src\db\migration_v2\*.sql | Sort-Object Name
```

or, on macOS/Linux: `ls server/src/db/migration_v2/*.sql | sort`

## Files

| File | Purpose |
| --- | --- |
| `000_bootstrap_extensions.sql` | Required Postgres extensions |
| `001_auth_and_role_helpers.sql` | Auth and role helper functions |
| `002_jobseeker_profiles.sql` | Jobseeker profiles and drafts |
| `003_storage_jobseeker_documents_policies.sql` | Storage policies for jobseeker documents |
| `004_clients_and_positions.sql` | Clients, positions, drafts, assignments |
| `005_timesheets.sql` | Timesheets |
| `006_recent_activities.sql` | Activity feed table and realtime |
| `007_invoices.sql` | Invoices |
| `008_bulk_timesheets.sql` | `bulk_timesheets` table (legacy; the current app does not use it) |
| `009_consent.sql` | Digital consent tables and storage policies |
| `010_client_dropdown_options.sql` | Configurable dropdown options |
| `011_embeddings.sql` | Embedding columns for candidate matching |
| `012_ai_validation_from_godspeed_ops_ai.sql` | `ai_validation` table used by the AI service |
| `013_add_stat_to_positions.sql` | STAT (yes/no) column on positions and drafts |
| `014_inactivity_monitor.sql` | `last_activity_at` on clients and jobseekers, with triggers |
| `015_add_premium_pay_rate.sql` | Premium pay rate on positions, drafts and timesheets |
| `016_add_is_subcategory_to_positions.sql` | `is_subcategory` flag: invoicing-only positions, excluded from matching and assignment |
| `017_jobseeker_onboarding_consent.sql` | Onboarding-agreement flag and the `user` recipient type for consent |
| `018_hybrid_payment_timesheets.sql` | Hybrid SIN + cash/e-Transfer payment: weekly SIN hours cap on the profile and split timesheet rows |
| `019` to `022` (subcategory files) | Subcategory position types, their per-type details and the group/primary refactor |
| `023_purge_cron_job_run_details.sql` | Weekly `pg_cron` job that trims cron run logs |
| `024_timesheets_bulk_jobseeker.sql` | `is_bulk` and `bulk_breakdown` on timesheets (one timesheet covering several positions) |
| `025_timesheets_tax_amount.sql` | `tax_amount` on timesheets (Corporation-Direct Deposit) |
| `026_expand_client_short_code_to_varchar_5.sql` | Client short code up to 5 characters |
| `027_support_module.sql` | Support tickets: tables, functions, storage bucket, daily auto-close job |
| `028_sync_position_dates_to_assignments.sql` | When a position's dates change, active and upcoming assignments (and their statuses) follow |
| `029_feature_flags.sql` | `feature_flags` table |
| `030_feature_flags_config.sql` | `config` column on flags (flag text settings) |
| `031_portal_settings.sql` | `portal_settings` table |
| `032_catch_up_to_production.sql` | Catch-up: what the four production databases have and files 000 to 031 lack (see below). **New databases only; refuses to run without an explicit opt-in; never run on a live database.** |
| `033_close_public_access.sql` | Closes access the public key and signed-in users should not have: account and schema functions become server-only, `ai_validation` gets row security (owner and staff), the activity feed is staff-only, the anonymous consent-update policy and anonymous read of `jobseeker-documents` are removed. Skips anything a database lacks |
| `034_roles_from_app_metadata.sql` | Roles are decided from `app_metadata` (only the server can write it), not `user_metadata` (users can edit their own): copies each account's role, gives new accounts the jobseeker role until the server sets another, role helpers and `list_auth_users` read it; storage rules for jobseeker documents (staff, uploader, the jobseeker whose profile lists the file), signed consent PDFs (staff) and invoice files (staff, uploader); email/phone lookups server-only. **Run after the server version that writes `app_metadata` is deployed** |
| `035_staff_two_factor.sql` | Staff two-step login on the server: table `staff_2fa_sessions` (server only) and each staff phone number copied to `app_metadata.twofa_phone`. Changes nothing visible until the flag `staff_two_factor_enforced` is switched on |
| `036_matching_one_row_per_candidate.sql` | `find_matching_candidates` lists each candidate once (it listed a candidate once per overlapping assignment); same body as in 032 |

Run **every file once, in order, on each portal's database**, then that portal's seed from `../seeds/` (see `../seeds/README.md`).

**032 is different:** it is for a NEW database only and refuses to run unless the session sets `rhythence.catch_up = 'new-database'`. Live databases already have what it holds; do not run it on them.

**028**, **035** and **036** are applied on stage and all four production databases (2026-11-19). 028 went in as `CREATE OR REPLACE TRIGGER` (no such trigger existed anywhere, so the file's `DROP TRIGGER IF EXISTS` had nothing to drop). 035 changes nothing until the flag `staff_two_factor_enforced` is on; it is on in the four production portals since 2026-11-19 and off on stage (the demos).

**Where 033 and 034 are applied:** stage and the four production databases (2026-11-16); the demo database not yet. **032 is applied nowhere** (it was written for a database built from these files; see below).

## 032 and the test database

Before 032 the files could not build a database the server runs on (proven on a real local Supabase): a table the server uses was in no file (`position_candidate_assignments`), four columns the code reads were missing, many functions differed from production, new tables had no privileges for the Data API roles, two buckets were created by nothing, and three files failed on current Supabase. `pnpm test` in `server/` now builds a database from these files and compares it with production's stored listing (`server/tests/schema/`), see [../../../docs/development/testing.md](../../../docs/development/testing.md).

**What 032 holds** (read from production after 033 and 034, 2026-11-17, all read-only): default privileges and grants for `anon`, `authenticated`, `service_role` (only where a table or sequence has none, so what 033 revoked stays revoked); the two enum types; tables `position_candidate_assignments`, `email_checkpoint` and sequence `timesheet_invoice_seq`; columns `jobseeker_profiles.billing_email`, `work_permit_expiry`, `work_permit_uci`, `client_drafts.wsib_code` with its check; `clients` and `client_drafts` text columns without a length limit, `invoices.version_history` not null; two indexes and the `fk_user` name on `audit_logs`; production's definitions of the other 27 functions (11 are defined by 033 and 034); the invoice and consent triggers pointed at the functions production uses; the invoice and storage policies as production has them; buckets `jobseeker-documents` and `default-documents`; the daily `update_job_status` job. It drops what only the files had and production does not: `bulk_timesheets` (only when empty), index `idx_invoices_version_history`, the two invoice helper functions replaced above, the policy "Users can view their own activities".

**Changes to files 000 to 014 (all harmless on a live database, which does not run them again):** `000` enables `pg_cron`; `003` and `009` enable row security on `storage.objects` only if it is off (current Supabase refuses the plain statement); `012` is now the `ai_validation` table as production has it (the old text was never true); `014` creates the two assignment triggers only if the table exists (032 creates them).

**Not covered, on purpose** (named in 032's header, ignored by the schema comparison, and nothing else is):
1. `execute_sql`, the AI chat's SQL function (ROADMAP P12): a new database gets no chat SQL function until the AI service replaces it with a safe one.
2. The embedding queue: `embedding_input_jobseeker_bio` and `_position_description`, the `embed_*` triggers on `jobseeker_profiles` and `positions`, schema `util`, extensions `pgmq` and `pg_net`, and the `process-embeddings` cron job. They call an edge function that is not in this repo, and from inside Postgres no test guard can stop them. 011 creates the embedding columns and the triggers only if `util.queue_embeddings()` exists, so a database built from these files never calls out.

**In the files, not in production** (kept as the files have them; listed in `server/tests/schema/files-ahead-of-production.txt`, which fails when an entry goes stale): the three has_profile triggers on `jobseeker_profiles`, the `activity_change_trigger` on `recent_activities`, the `timesheets` updated-at trigger and function, and 023's weekly log-trim job.

**Differences between the four production databases** (listed with the same query on 2026-11-17; everything else is identical): one (GD Workforce) has the four invoice-attachment storage policies under other names (same rules) and its log-trim job named `prune_cron_job_run_details` (daily 02:00). Godspeed's `find_matching_candidates` differed until 2026-11-18, when it was aligned with the other portals; a read-only listing of Godspeed the same day was identical to the stored CanHire listing (1037 lines).

**Running 032 on a live database: never.** 032 refuses to run unless the session sets `rhythence.catch_up = 'new-database'` (`PGOPTIONS="-c rhythence.catch_up=new-database"` for `psql`); only the test scripts set it. Production already has everything in it, and it is not a no-op there: read-only analysis on 2026-11-17 said it would change nothing on three of the four databases and replace Godspeed's own `find_matching_candidates`; since Godspeed's function was aligned on 2026-11-18 it holds the same body everywhere, so the only remaining differences are GD Workforce's policy names and job name above, which 032 does not touch. It still refuses to run on a live database. Nothing was run on any production or stage database.
