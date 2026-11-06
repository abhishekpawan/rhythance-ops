-- ============================================================================
-- Migration: Feature flag settings (extra per-portal values on a flag)
-- Target: Supabase Postgres (public schema)
-- Idempotent: Yes
-- Naming Convention: 030_feature_flags_config.sql
--
-- Some flags carry values besides on/off (for example the handbook file path used
-- by attach_handbook_to_assignment_email). They are stored in `config` as a flat
-- JSON object of text values. Valid setting names and their in-code defaults are
-- defined in server/src/config/featureFlags.ts; a missing value uses the default.
-- ============================================================================

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS config jsonb NULL;

COMMENT ON COLUMN public.feature_flags.config IS
  'Optional flat JSON object of text settings for the flag. Valid names and defaults are defined in server/src/config/featureFlags.ts.';
