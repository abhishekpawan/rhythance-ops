-- ============================================================================
-- Migration: Portal settings (per-portal values that used to be hard-coded)
-- Target: Supabase Postgres (public schema)
-- Idempotent: Yes
-- Naming Convention: 031_portal_settings.sql
--
-- Each portal has its own database, so each portal has its own settings. The list
-- of valid settings (key, label, default) lives in code
-- (server/src/config/portalSettings.ts); this table only stores the portal's own
-- values. A setting without a row uses its in-code default (after its environment
-- variable, where one exists). Empty values are never stored.
--
-- The server reads/writes this table with the service role key; RLS is enabled with
-- no policies so the table is not reachable from the browser.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.portal_settings (
  key text PRIMARY KEY CHECK (char_length(key) BETWEEN 1 AND 100),
  value text NOT NULL CHECK (char_length(value) BETWEEN 1 AND 50000),
  updated_by uuid NULL,
  updated_by_name text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.portal_settings IS
  'Per-portal setting values. Valid keys and defaults are defined in server/src/config/portalSettings.ts.';

ALTER TABLE public.portal_settings ENABLE ROW LEVEL SECURITY;
