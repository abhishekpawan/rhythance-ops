-- 040: drop the 33 policies that decide "staff" from auth.users and so grant nothing, and close the data API on
-- timesheets and invoices (REVOKE ALL from anon and authenticated).
--
-- Runs after 039, and after 032 when a database is built from scratch (032 puts three of the dead invoice policies
-- back, so 040 comes after it; 032 grants nothing on tables). Safe to run twice, and safe on a database that lacks
-- some of the policies (DROP POLICY IF EXISTS): the four production databases have 28 of the 33 (not the
-- email_checkpoint one nor the four on position_candidate_assignments); stage has all 33. Changes nothing for any
-- user and nothing for the server (it uses the service key, which skips grants and row security).
--
-- Inbox 49 (program session DEV-4, decided by Abhishek 2026-11-21). These policies (on clients, positions,
-- position_candidate_assignments, timesheets, consent_documents, consent_document_templates, consent_records,
-- client_dropdown_options, email_checkpoint and invoices) decide "staff" with
--   auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'user_type' ...)
-- (three on invoices with a `role` field no account has). raw_user_meta_data is a field a signed-in user can
-- edit about themselves, and signed-in users cannot read auth.users, so every one of them fails with "permission
-- denied for table users" for everybody and grants nothing; the browser never reads these tables. They were
-- safe by accident and would become a hole if `authenticated` were ever granted read on auth.users.
--
-- The catch, found while testing this file (2026-11-21): on timesheets and invoices the dead policies were also
-- the only thing blocking the own-row policies that sit beside them ("Jobseekers can view/update/insert own
-- timesheets", "Users can view/create/update own invoices"). Postgres ORs a table's policies and checks the
-- auth.users privilege when the query starts, so one dead policy made every data-API query on the table fail.
-- With the dead ones gone and the table grants still full, a jobseeker could read and edit their own timesheet
-- (hours, pay rates, totals) with their own token, and a creator their own invoices. So the same file takes the
-- table privileges away from anon and authenticated on those two tables: nothing reads or writes them through the
-- data API today (checked in client/src and server/src: the browser only uses the invoices STORAGE bucket, and
-- every server client that touches these tables uses the service key), and nothing will afterwards. The own-row
-- policies stay in place, harmless without a grant. Their old text is not needed: they are not changed.
-- The other eight tables have no policy left for signed-in users, so they answer nobody (an empty list, a refused
-- write) instead of "permission denied for table users".
--
-- Not touched on purpose: every policy that does not read auth.users, e.g. "Service role can manage email
-- checkpoints", "Users can view own invoices", "Users can create invoices", "Jobseekers can ... own timesheets".
--
-- The guard at the end fails the whole migration (it runs in one transaction) if any policy in public still
-- reads auth.users or raw_user_meta_data, or if anon or authenticated still holds a privilege on timesheets or
-- invoices, so a database with an extra one of them is not left half done.
--
-- Undo: ops/undo/040_undo.sql (the two grants, as production had them: all privileges to anon and authenticated).
-- The dropped policies are not restored: they granted nothing.

BEGIN;

-- client_dropdown_options
DROP POLICY IF EXISTS "Admins and recruiters can view dropdown options" ON public.client_dropdown_options;
DROP POLICY IF EXISTS "Only admins can delete dropdown options" ON public.client_dropdown_options;
DROP POLICY IF EXISTS "Only admins can insert dropdown options" ON public.client_dropdown_options;
DROP POLICY IF EXISTS "Only admins can update dropdown options" ON public.client_dropdown_options;

-- clients
DROP POLICY IF EXISTS "Admins and recruiters can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and recruiters can update clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and recruiters can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Only admins can delete clients" ON public.clients;

-- consent_document_templates
DROP POLICY IF EXISTS "Admins and recruiters can view consent templates" ON public.consent_document_templates;
DROP POLICY IF EXISTS "Only admins can delete consent templates" ON public.consent_document_templates;
DROP POLICY IF EXISTS "Only admins can insert consent templates" ON public.consent_document_templates;
DROP POLICY IF EXISTS "Only admins can update consent templates" ON public.consent_document_templates;

-- consent_documents
DROP POLICY IF EXISTS "Admins and recruiters can insert consent documents" ON public.consent_documents;
DROP POLICY IF EXISTS "Admins and recruiters can update consent documents" ON public.consent_documents;
DROP POLICY IF EXISTS "Admins and recruiters can view all consent documents" ON public.consent_documents;
DROP POLICY IF EXISTS "Only admins can delete consent documents" ON public.consent_documents;

-- consent_records
DROP POLICY IF EXISTS "Admins and recruiters can insert consent records" ON public.consent_records;
DROP POLICY IF EXISTS "Admins and recruiters can update consent records" ON public.consent_records;
DROP POLICY IF EXISTS "Admins and recruiters can view all consent records" ON public.consent_records;

-- email_checkpoint
DROP POLICY IF EXISTS "Admins can view email checkpoints" ON public.email_checkpoint;

-- invoices
DROP POLICY IF EXISTS "Admin and recruiters can update any invoice" ON public.invoices;
DROP POLICY IF EXISTS "Admin and recruiters can view all invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admin can delete invoices" ON public.invoices;

-- position_candidate_assignments
DROP POLICY IF EXISTS "Admins and recruiters can insert assignments" ON public.position_candidate_assignments;
DROP POLICY IF EXISTS "Admins and recruiters can update assignments" ON public.position_candidate_assignments;
DROP POLICY IF EXISTS "Admins and recruiters can view all assignments" ON public.position_candidate_assignments;
DROP POLICY IF EXISTS "Only admins can delete assignments" ON public.position_candidate_assignments;

-- positions
DROP POLICY IF EXISTS "Admins and recruiters can insert positions" ON public.positions;
DROP POLICY IF EXISTS "Admins and recruiters can update positions" ON public.positions;
DROP POLICY IF EXISTS "Admins and recruiters can view all positions" ON public.positions;
DROP POLICY IF EXISTS "Only admins can delete positions" ON public.positions;

-- timesheets
DROP POLICY IF EXISTS "Recruiters and admins can update all timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Recruiters and admins can view all timesheets" ON public.timesheets;

-- timesheets and invoices: closed to the data API (the server uses the service key and is not affected).
REVOKE ALL ON public.timesheets, public.invoices FROM anon, authenticated;

-- Guard: no policy in public may still read auth.users or raw_user_meta_data, and anon and authenticated may hold
-- no privilege on timesheets or invoices.
DO $$
DECLARE
  v_left text;
BEGIN
  SELECT string_agg(format('%I.%I "%s"', schemaname, tablename, policyname), ', ' ORDER BY tablename, policyname)
    INTO v_left
    FROM pg_policies
   WHERE schemaname = 'public'
     AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) ~* 'auth\.users|raw_user_meta_data';
  IF v_left IS NOT NULL THEN
    RAISE EXCEPTION '040: policies still reading auth.users or raw_user_meta_data: %', v_left;
  END IF;

  SELECT string_agg(format('%s on %s', r.rolname, c.relname), ', ')
    INTO v_left
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN pg_roles r ON r.rolname IN ('anon', 'authenticated')
   WHERE c.relname IN ('timesheets', 'invoices')
     AND (has_table_privilege(r.rolname, c.oid, 'SELECT') OR has_table_privilege(r.rolname, c.oid, 'INSERT')
          OR has_table_privilege(r.rolname, c.oid, 'UPDATE') OR has_table_privilege(r.rolname, c.oid, 'DELETE'));
  IF v_left IS NOT NULL THEN
    RAISE EXCEPTION '040: still granted on timesheets or invoices: %', v_left;
  END IF;
END
$$;

COMMIT;
