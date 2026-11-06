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

Run **every file once, in order, on each portal's database**, then that portal's seed from `../seeds/` (see `../seeds/README.md`).

## What was merged

- Auth + role helpers:
  - `01_user_types.sql`
  - `20240420_create_user_email_lookup_function.sql`
  - `20240701_force_recreate_list_auth_users_function.sql`
  - `add_user_roles_and_hierarchy.sql`
- Jobseeker schema/follow-up alters:
  - `02_jobseeker_profiles.sql`
  - `03_documents_array.sql`
  - `04_add_bio_field.sql`
  - `05_add_creator_field.sql`
  - `20230612_add_rejection_reason.sql`
  - `20230825_update_jobseeker_profiles_constraints.sql`
  - `20230826_update_jobseeker_profile_drafts.sql`
  - `add_employee_id_to_jobseeker_profiles.sql`
  - `update_has_profile.sql`
- Jobseeker storage policies:
  - `YYYYMMDDHHMMSS_add_storage_rls_policies.sql`
  - `20240420_setup_jobseeker_documents_rls.sql`
- Clients/positions:
  - `create_clients_tables.sql`
  - `create_positions_tables.sql`
  - `add_wsib_code_to_clients.sql`
  - `add_position_code_constraints.sql`
  - `add_assigned_jobseekers_to_positions.sql`
  - `add_client_name_to_positions.sql`
- Timesheets:
  - `create_complete_timesheets_table.sql`
  - `disable_auto_invoice_generation.sql`
  - `remove_assignment_id_from_timesheets.sql`
  - `add_bonus_deduction_to_timesheets.sql`
  - `add_notes_to_timesheets.sql`
- Recent activities:
  - `add_recent_activities_table.sql`
  - `enable_recent_activities_realtime.sql`
  - `update_activity_trigger_for_broadcast.sql`
- Invoices:
  - `create_invoice_table.sql`
  - `add_invoice_sent_to_field.sql`
  - `update_invoice_number_format.sql`
  - `add_notes_to_invoices.sql`
  - `remove_rls_policy_from_invoices_bucket.sql` (duplicate source of `create_invoice_table.sql`)
- Consent:
  - `20250827_create_digital_consent_tables.sql`
  - `20250827_consent_storage_policies.sql`
  - `20250128_update_consent_storage_policies.sql`
  - `20250128_fix_consent_read_policy.sql`
- Client dropdown options:
  - `create_client_dropdown_options_table.sql`
  - `seed_client_dropdown_options.sql`

## Drift items now folded into base create files

- `clients` + `client_drafts` now include:
  - `accounting_manager`
  - `client_rep`
- `timesheets` now includes:
  - `version`
  - `version_history`
- `invoices` now includes:
  - `version_history`

These are included directly in the original consolidated table-create files:
- `004_clients_and_positions.sql`
- `005_timesheets.sql`
- `007_invoices.sql`

## Added from GodspeedOps AI repo

The AI repo (`d:\Development\godspeed-ops-ai`) does not contain SQL migration files, so schema additions were ported from its Supabase schema usage in:
- `services/chat_database_service.py`
- `models.py`

Added files:
- `011_embeddings.sql`
  - Adds `bio_embedding` and `job_embedding` vector columns + HNSW indexes.
  - Adds `jobseeker_profiles` embedding triggers only when `util.queue_embeddings()` exists.
- `012_ai_validation_from_godspeed_ops_ai.sql`
  - Adds the `ai_validation` table and RLS policies used by the AI service.

## Removed as standalone files (now absorbed)

- `supabase_direct_update.sql` was duplicate-intent SQL for the same `jobseeker_profiles` uniqueness change.
- `remove_rls_policy_from_invoices_bucket.sql` was a byte-for-byte duplicate of `create_invoice_table.sql`.

## MCP validation notes

I cross-checked against the connected Supabase DB before consolidating.

Observed drift in live DB was reviewed and incorporated into this consolidated set where requested. Any remaining runtime-only differences should now be much smaller and easier to patch with a dedicated follow-up migration if needed.
