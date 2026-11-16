-- 033: close database access that the public (anon) key and ordinary signed-in users should not have.
--
-- Runs after 032 (catch-up). Safe on a database where an object is missing: every step checks first.
-- Safe to run twice.
--
-- What it does:
--   1. SECURITY DEFINER functions that read auth.users or the database layout are callable only by the
--      server (service_role). execute_sql (the AI chat's SQL function) is not created by any migration on
--      purpose; if a database has it, it is closed here too.
--   2. get_user_id_by_email / get_user_id_by_phone: closed to anon. They stay callable by signed-in users
--      for now because the server's auth routes sign users in on a shared client, so some of its calls
--      arrive as "authenticated" (see 034 / server fix).
--   3. ai_validation: row security on; the AI service (which forwards the signed-in user's token) and
--      staff keep access; anon has none.
--   4. recent_activities: the activity feed is readable by admins and recruiters only (it was readable by anyone).
--   5. consent_records: the "public can update a pending consent" policy goes; the public consent page
--      submits through the server, which uses the service key.
--   6. Storage: anon can no longer read the jobseeker-documents bucket.
--
-- Helper functions used inside policies (is_admin, is_recruiter, is_jobseeker, has_role, has_scope,
-- has_user_role) stay callable by signed-in users: every policy that uses them needs that.

-- 1 and 2. Function access -------------------------------------------------------------------------

DO $$
DECLARE
  fn text;
  server_only text[] := ARRAY[
    'public.execute_sql(text)',
    'public.set_user_roles(uuid, text[], uuid, text)',
    'public.list_auth_users(text, text, text, text, text, text, integer, integer)',
    'public.get_role_change_log(uuid)',
    'public.get_table_info(text, text)',
    'public.test_connection()',
    'public.get_user_role(uuid)',
    'public.get_user_roles(uuid)',
    'public.get_manager_id(uuid)',
    'public.get_org_id(uuid)'
  ];
  no_anon text[] := ARRAY[
    'public.get_user_id_by_email(text)',
    'public.get_user_id_by_phone(text)'
  ];
BEGIN
  FOREACH fn IN ARRAY server_only LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;

  FOREACH fn IN ARRAY no_anon LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
    END IF;
  END LOOP;
END $$;

-- 3. ai_validation ----------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.ai_validation') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.ai_validation ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON public.ai_validation FROM anon;

  DROP POLICY IF EXISTS "Enable insert for all users" ON public.ai_validation;
  DROP POLICY IF EXISTS "Enable users to view their own data or anon can view all" ON public.ai_validation;
  DROP POLICY IF EXISTS "ai_validation_select_own_or_staff" ON public.ai_validation;
  DROP POLICY IF EXISTS "ai_validation_insert_own_or_staff" ON public.ai_validation;
  DROP POLICY IF EXISTS "ai_validation_update_own_or_staff" ON public.ai_validation;

  -- The AI service writes with the token of whoever uploaded the document: the jobseeker, or a
  -- recruiter or admin acting for them. Its upsert needs select, insert and update.
  CREATE POLICY "ai_validation_select_own_or_staff" ON public.ai_validation
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_admin() OR public.is_recruiter());

  CREATE POLICY "ai_validation_insert_own_or_staff" ON public.ai_validation
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.is_admin() OR public.is_recruiter());

  CREATE POLICY "ai_validation_update_own_or_staff" ON public.ai_validation
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR public.is_admin() OR public.is_recruiter())
    WITH CHECK (user_id = auth.uid() OR public.is_admin() OR public.is_recruiter());
END $$;

-- 4. recent_activities ------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.recent_activities') IS NULL THEN
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Anyone can view all activities" ON public.recent_activities;
  DROP POLICY IF EXISTS "Staff can view activities" ON public.recent_activities;

  -- Read on the admin and recruiter dashboards (and their realtime feed) only.
  CREATE POLICY "Staff can view activities" ON public.recent_activities
    FOR SELECT TO authenticated
    USING (public.is_admin() OR public.is_recruiter());
END $$;

-- 5. consent_records --------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.consent_records') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Public can submit consent with valid token" ON public.consent_records;
  END IF;
END $$;

-- 6. Storage ----------------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow anonymous users to view documents" ON storage.objects;
