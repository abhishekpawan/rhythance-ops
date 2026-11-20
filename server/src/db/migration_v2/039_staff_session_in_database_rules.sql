-- 039: the database's own staff checks follow the two-step login.
--
-- Runs after 038 and must run after 034 (034 defines the helpers this file replaces). Safe to run twice.
-- Nothing changes for a staff member who signed in with the phone code, for jobseekers, or for the server (it
-- uses the service key, which skips row security).
--
-- Inbox 30 (program session DEV-4). With the two-step login enforced the server refuses a staff token whose
-- sign-in has no verified phone code, but Supabase's own data API (PostgREST and storage) did not: a staff
-- password alone still opened it as that staff user, because the role helpers only looked at the account's
-- role. has_role, has_user_role and has_scope (and so is_admin, is_recruiter and every policy built on them:
-- jobseeker_profiles, ai_validation, recent_activities, and the jobseeker-documents, consent-documents and
-- invoices storage rules) now also require, for admin and recruiter accounts, a sign-in session recorded in
-- staff_2fa_sessions (035) that is at most 90 days old, while the feature flag staff_two_factor_enforced is on.
-- Same rule as the server (services/staffTwoFactor.ts) and as 037. The flag defaults to on: no row means on.
-- Off (the demo database stores it off) = the helpers behave exactly as before. Jobseekers are not affected.
--
-- Not touched on purpose: 33 policies on clients, positions, position_candidate_assignments, timesheets,
-- consent_documents, consent_document_templates, consent_records, client_dropdown_options, email_checkpoint and
-- invoices decide "staff" from auth.users.raw_user_meta_data (a field a signed-in user can edit about
-- themselves) by reading auth.users. Signed-in users cannot read auth.users, so those policies fail with
-- "permission denied" for everybody and grant nothing (checked on stage and all four production databases,
-- 2026-11-20); the portal reads those tables through the server only. Pointing them at the helpers would
-- open the data API to them, which nobody has asked for: see ops/inbox.md, found while working in DEV-4.
--
-- Undo: ops/undo/039_undo.sql (the helpers as 034 defined them; staff_session_ok dropped).

-- B. The session rule ---------------------------------------------------------------------------------------

-- True when the rule is off, or the signed-in session has a verified phone code. Called by the helpers below only
-- for staff accounts; callable by nobody else (the helpers run it as their owner).
CREATE OR REPLACE FUNCTION public.staff_session_ok()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NOT COALESCE(
           (SELECT f.enabled FROM public.feature_flags f WHERE f.key = 'staff_two_factor_enforced'), true)
         OR EXISTS (
           SELECT 1 FROM public.staff_2fa_sessions s
           WHERE s.session_id = NULLIF(auth.jwt() ->> 'session_id', '')::uuid
             AND s.user_id = auth.uid()
             AND s.verified_at > now() - interval '90 days');
$$;

REVOKE EXECUTE ON FUNCTION public.staff_session_ok() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_session_ok() TO service_role;

-- Same names and signatures as 034, so every policy that calls them keeps working. The argument is written
-- function.argument inside the subquery on purpose: auth.users has a column called `role`, which a bare `role`
-- would pick instead (034's has_user_role does; nothing calls it, so it was never noticed).
CREATE OR REPLACE FUNCTION public.has_role(role public.user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN u.raw_app_meta_data->>'user_type' IN ('admin', 'recruiter') THEN
        (CASE
           WHEN has_role.role = 'admin' THEN u.raw_app_meta_data->>'user_type' = 'admin'
           WHEN has_role.role = 'recruiter' THEN true
           ELSE false
         END) AND public.staff_session_ok()
      ELSE has_role.role = 'jobseeker' AND u.raw_app_meta_data->>'user_type' = 'jobseeker'
    END
    FROM auth.users u WHERE u.id = auth.uid()
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.has_user_role(role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT (u.raw_app_meta_data->>'user_type' = 'admin'
            OR COALESCE(u.raw_app_meta_data->'user_role', '[]'::jsonb) ? has_user_role.role)
       AND (COALESCE(u.raw_app_meta_data->>'user_type', '') NOT IN ('admin', 'recruiter')
            OR public.staff_session_ok())
    FROM auth.users u WHERE u.id = auth.uid()
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.has_scope(scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT (u.raw_app_meta_data->>'user_type' = 'admin'
            OR COALESCE(u.raw_app_meta_data->'scopes', '[]'::jsonb) ? has_scope.scope)
       AND (COALESCE(u.raw_app_meta_data->>'user_type', '') NOT IN ('admin', 'recruiter')
            OR public.staff_session_ok())
    FROM auth.users u WHERE u.id = auth.uid()
  ), false);
$$;

-- is_admin, is_recruiter and is_jobseeker (034) call has_role and are unchanged.
