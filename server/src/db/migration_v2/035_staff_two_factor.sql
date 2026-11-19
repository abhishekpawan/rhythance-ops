-- 035: server-side two-step login for staff (admin and recruiter accounts).
--
-- Runs after 034. Safe to run twice. Changes nothing visible by itself: the server only enforces the
-- check when the feature flag `staff_two_factor_enforced` is on for the portal (default off).
--
-- What it does:
--   1. staff_2fa_sessions: one row per sign-in session (Supabase `session_id`) whose phone code the server
--      verified. Only the server (service key) can read or write it.
--   2. Copies each staff account's phone number from user_metadata (which the user can edit) to
--      app_metadata.twofa_phone (which only the server can write). The phone code is checked against that
--      number, so someone who knows only the password cannot swap in their own phone.
--      Jobseeker accounts are not touched.

CREATE TABLE IF NOT EXISTS public.staff_2fa_sessions (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_2fa_sessions_verified_at
  ON public.staff_2fa_sessions (verified_at);

COMMENT ON TABLE public.staff_2fa_sessions IS
  'Sign-in sessions of staff whose phone code the server verified. Server only (service key); the feature flag staff_two_factor_enforced decides whether the server requires a row here.';

ALTER TABLE public.staff_2fa_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_2fa_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.staff_2fa_sessions TO service_role;

-- 2. Pin each staff phone number where the user cannot edit it -------------------------------------

UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object(
       'twofa_phone',
       CASE
         WHEN left(btrim(u.raw_user_meta_data ->> 'phoneNumber'), 1) = '+'
           THEN regexp_replace(u.raw_user_meta_data ->> 'phoneNumber', '\s+', '', 'g')
         ELSE '+' || regexp_replace(u.raw_user_meta_data ->> 'phoneNumber', '\s+', '', 'g')
       END
     )
WHERE u.raw_app_meta_data ->> 'user_type' IN ('admin', 'recruiter')
  AND NULLIF(btrim(u.raw_user_meta_data ->> 'phoneNumber'), '') IS NOT NULL
  AND NOT (COALESCE(u.raw_app_meta_data, '{}'::jsonb) ? 'twofa_phone');
