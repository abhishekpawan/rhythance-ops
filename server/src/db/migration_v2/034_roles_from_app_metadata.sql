-- 034: decide roles from app_metadata, which only the service key can write.
--
-- user_metadata can be changed by the signed-in user themselves, so it must not decide access.
-- Run AFTER the server version that writes roles to app_metadata is deployed (it reads
-- app_metadata and falls back to user_metadata only while an account has no role there yet).
-- Safe to run twice. Skips anything a database lacks.
--
--   1. Copy each account's current role (user_type, user_role) into app_metadata where missing.
--   2. New accounts get the jobseeker role in app_metadata unless one is set; the server raises it.
--   3. Role helpers used by row security read app_metadata.
--   4. list_auth_users: server-only check, shows the trusted role.
--   5. Storage: jobseeker documents readable by staff, the uploader, and the jobseeker whose
--      profile lists them; signed consent PDFs staff-only; invoice files staff and uploader only.
--   6. get_user_id_by_email / _by_phone become server-only (the server no longer signs users in
--      on its shared client).

-- 1. Copy roles ------------------------------------------------------------------------------------

UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
  'user_type',
  CASE WHEN raw_user_meta_data->>'user_type' IN ('admin', 'recruiter') THEN raw_user_meta_data->>'user_type'
       ELSE 'jobseeker' END,
  'user_role',
  CASE WHEN jsonb_typeof(raw_user_meta_data->'user_role') = 'array' THEN raw_user_meta_data->'user_role'
       ELSE '[]'::jsonb END
)
WHERE raw_app_meta_data->>'user_type' IS NULL;

-- 2. Default role for new accounts -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.default_app_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.raw_app_meta_data->>'user_type' IS NULL THEN
    NEW.raw_app_meta_data := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('user_type', 'jobseeker', 'user_role', '[]'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.default_app_role() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS default_app_role ON auth.users;
CREATE TRIGGER default_app_role
BEFORE INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.default_app_role();

-- 3. Role helpers ----------------------------------------------------------------------------------
-- Same names and signatures as before, so every policy that calls them keeps working.

CREATE OR REPLACE FUNCTION public.has_role(role public.user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN role = 'admin' THEN
      (SELECT u.raw_app_meta_data->>'user_type' = 'admin' FROM auth.users u WHERE u.id = auth.uid())
    WHEN role = 'recruiter' THEN
      (SELECT u.raw_app_meta_data->>'user_type' IN ('recruiter', 'admin') FROM auth.users u WHERE u.id = auth.uid())
    WHEN role = 'jobseeker' THEN
      (SELECT u.raw_app_meta_data->>'user_type' = 'jobseeker' FROM auth.users u WHERE u.id = auth.uid())
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT COALESCE(public.has_role('admin'::public.user_role), false); $$;

CREATE OR REPLACE FUNCTION public.is_recruiter()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT COALESCE(public.has_role('recruiter'::public.user_role), false); $$;

CREATE OR REPLACE FUNCTION public.is_jobseeker()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT COALESCE(public.has_role('jobseeker'::public.user_role), false); $$;

CREATE OR REPLACE FUNCTION public.has_user_role(role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT u.raw_app_meta_data->>'user_type' = 'admin'
        OR COALESCE(u.raw_app_meta_data->'user_role', '[]'::jsonb) ? role
    FROM auth.users u WHERE u.id = auth.uid()
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.has_scope(scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT u.raw_app_meta_data->>'user_type' = 'admin'
        OR COALESCE(u.raw_app_meta_data->'scopes', '[]'::jsonb) ? scope
    FROM auth.users u WHERE u.id = auth.uid()
  ), false);
$$;

DO $$
BEGIN
  IF to_regprocedure('public.get_user_role(uuid)') IS NOT NULL THEN
    CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
    RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
    AS $f$
      SELECT CASE
        WHEN u.raw_app_meta_data->>'user_type' = 'admin' THEN 'admin'::public.user_role
        WHEN u.raw_app_meta_data->>'user_type' = 'recruiter' THEN 'recruiter'::public.user_role
        ELSE 'jobseeker'::public.user_role
      END
      FROM auth.users u WHERE u.id = get_user_role.user_id;
    $f$;
  END IF;

  IF to_regprocedure('public.get_user_roles(uuid)') IS NOT NULL THEN
    CREATE OR REPLACE FUNCTION public.get_user_roles(user_id uuid)
    RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
    AS $f$
      SELECT COALESCE(ARRAY(SELECT jsonb_array_elements_text(u.raw_app_meta_data->'user_role')), ARRAY[]::text[])
      FROM auth.users u WHERE u.id = get_user_roles.user_id;
    $f$;
  END IF;
END $$;

-- 4. list_auth_users -------------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regprocedure('public.list_auth_users(text, text, text, text, text, text, integer, integer)') IS NULL THEN
    RETURN;
  END IF;

  CREATE OR REPLACE FUNCTION public.list_auth_users(
    search text DEFAULT NULL, name_filter text DEFAULT NULL, email_filter text DEFAULT NULL,
    mobile_filter text DEFAULT NULL, user_type_filter text DEFAULT NULL,
    email_verified_filter text DEFAULT NULL, limit_count integer DEFAULT 10, offset_count integer DEFAULT 0)
  RETURNS TABLE(id uuid, email text, user_metadata jsonb, created_at timestamptz,
                last_sign_in_at timestamptz, email_confirmed_at timestamptz)
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
  AS $f$
  BEGIN
    -- Server only (execute is granted to service_role alone); staff may call it if ever granted.
    IF COALESCE(auth.role(), '') <> 'service_role' AND NOT (public.is_admin() OR public.is_recruiter()) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;

    RETURN QUERY
    SELECT u.id, u.email::text,
      u.raw_user_meta_data || jsonb_build_object(
        'user_type', u.raw_app_meta_data->'user_type',
        'user_role', COALESCE(u.raw_app_meta_data->'user_role', '[]'::jsonb)) AS user_metadata,
      u.created_at, u.last_sign_in_at, u.email_confirmed_at
    FROM auth.users u
    WHERE
      (search IS NULL OR
        u.email ILIKE '%' || search || '%' OR
        (u.raw_user_meta_data->>'name') ILIKE '%' || search || '%' OR
        (u.raw_user_meta_data->>'phoneNumber') ILIKE '%' || search || '%' OR
        (u.raw_app_meta_data->>'user_type') ILIKE '%' || search || '%')
      AND (name_filter IS NULL OR (u.raw_user_meta_data->>'name') ILIKE '%' || name_filter || '%')
      AND (email_filter IS NULL OR u.email ILIKE '%' || email_filter || '%')
      AND (mobile_filter IS NULL OR (u.raw_user_meta_data->>'phoneNumber') ILIKE '%' || mobile_filter || '%')
      AND (user_type_filter IS NULL OR (u.raw_app_meta_data->>'user_type') = user_type_filter)
      AND (
        email_verified_filter IS NULL OR
        (email_verified_filter = 'true' AND u.email_confirmed_at IS NOT NULL) OR
        (email_verified_filter = 'false' AND u.email_confirmed_at IS NULL))
    ORDER BY u.created_at DESC
    LIMIT limit_count OFFSET offset_count;
  END;
  $f$;

  REVOKE EXECUTE ON FUNCTION public.list_auth_users(text, text, text, text, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.list_auth_users(text, text, text, text, text, text, integer, integer) TO service_role;
END $$;

-- 5. Storage ---------------------------------------------------------------------------------------

-- True when the signed-in user's own profile lists this file (documents a recruiter uploaded for them).
CREATE OR REPLACE FUNCTION public.document_on_own_profile(object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobseeker_profiles p,
         jsonb_array_elements(CASE WHEN jsonb_typeof(p.documents) = 'array' THEN p.documents ELSE '[]'::jsonb END) d
    WHERE p.user_id = auth.uid() AND d->>'documentPath' = object_name
  );
$$;
REVOKE EXECUTE ON FUNCTION public.document_on_own_profile(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.document_on_own_profile(text) TO authenticated, service_role;

-- jobseeker-documents: drop the bucket-wide rules for every signed-in user; keep the own-folder rules.
DROP POLICY IF EXISTS "Allow authenticated users to view documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload documents" ON storage.objects;
DROP POLICY IF EXISTS "jobseeker_documents_staff" ON storage.objects;
DROP POLICY IF EXISTS "jobseeker_documents_listed_on_own_profile" ON storage.objects;

CREATE POLICY "jobseeker_documents_staff" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'jobseeker-documents' AND (public.is_admin() OR public.is_recruiter()))
  WITH CHECK (bucket_id = 'jobseeker-documents' AND (public.is_admin() OR public.is_recruiter()));

CREATE POLICY "jobseeker_documents_listed_on_own_profile" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'jobseeker-documents' AND public.document_on_own_profile(name));

-- consent-documents: originals stay readable (the public consent page needs them); signed copies
-- (filled-consents/) and all changes are staff-only.
DROP POLICY IF EXISTS "Allow public and authenticated access to view consent documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update consent documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete consent documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload consent documents" ON storage.objects;
DROP POLICY IF EXISTS "consent_documents_read_originals" ON storage.objects;
DROP POLICY IF EXISTS "consent_documents_staff" ON storage.objects;

CREATE POLICY "consent_documents_read_originals" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'consent-documents' AND (storage.foldername(name))[1] IS DISTINCT FROM 'filled-consents');

CREATE POLICY "consent_documents_staff" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'consent-documents' AND (public.is_admin() OR public.is_recruiter()))
  WITH CHECK (bucket_id = 'consent-documents' AND (public.is_admin() OR public.is_recruiter()));

-- invoices: the bucket-wide read for every signed-in user goes; staff read all, uploaders their own
-- (the own-folder rules stay).
DROP POLICY IF EXISTS "Allow authenticated users to select invoices" ON storage.objects;
DROP POLICY IF EXISTS "invoices_staff_read" ON storage.objects;

CREATE POLICY "invoices_staff_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'invoices' AND (public.is_admin() OR public.is_recruiter()));

-- 6. Email and phone lookups -----------------------------------------------------------------------

DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['public.get_user_id_by_email(text)', 'public.get_user_id_by_phone(text)'] LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END $$;
