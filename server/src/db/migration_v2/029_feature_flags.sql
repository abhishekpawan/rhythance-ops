-- ============================================================================
-- Migration: Feature flags (per-portal on/off switches)
-- Target: Supabase Postgres (public schema)
-- Idempotent: Yes
-- Naming Convention: 029_feature_flags.sql
--
-- Each portal has its own database, so each portal has its own copy of this
-- table. The list of valid flags (key, description, default) lives in code
-- (server/src/config/featureFlags.ts). This table only stores OVERRIDES of the
-- in-code default. A flag without a row uses its default, so adding a flag to
-- the code never needs a data migration.
--
-- The server reads/writes this table with the service role key; RLS is enabled
-- with no policies so the table is not reachable from the browser.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY CHECK (char_length(key) BETWEEN 1 AND 100),
  enabled boolean NOT NULL,
  updated_by uuid NULL,
  updated_by_name text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.feature_flags IS
  'Per-portal feature flag overrides. Valid keys and defaults are defined in server/src/config/featureFlags.ts.';

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
