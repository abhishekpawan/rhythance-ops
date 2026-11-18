-- 032: catch-up. Brings a database built from 000 to 031 up to what the four production databases have.
--
-- WHY. The files before this one never reproduced a live database: a table the server uses is in no
-- file (position_candidate_assignments), columns the code reads are in no file, and many functions
-- differ from what runs in production. On current Supabase three files also fail (the storage.objects
-- and pg_cron lines, fixed in 000, 003 and 009). A database built from the files could not run the
-- server, so a new managed client could not be set up from them. This file closes the gap.
--
-- SOURCE. Production definitions, read-only, 2026-11-17, taken AFTER 033 and 034 were applied
-- (CanHire; AllStaff, Godspeed and GD Workforce compared: the tables, columns, constraints, indexes,
-- grants and triggers are identical on all four; the remaining differences, all on GD Workforce, are listed in
-- README.md. Godspeed's find_matching_candidates, which differed on 2026-11-17, was aligned on 2026-11-18.)
--
-- NEW DATABASES ONLY. NEVER RUN THIS ON A LIVE DATABASE (production, stage or any database with clients' data).
-- It would change nothing on production as it is today (2026-11-18), but it holds production's definitions of
-- 2026-11-17: any later change to a function or policy there would be overwritten. The four production databases
-- already have everything in it. To make that hard to do by
-- accident, the first statement below refuses to run unless the caller has opted in explicitly with
--   PGOPTIONS="-c rhythence.catch_up=new-database"      (or: SET rhythence.catch_up = 'new-database';)
-- The test scripts set it; nothing else does.
--
-- Inside a new database it is safe to run twice: every statement checks first. 033 and 034 run after this
-- file and stay as they are.
--
-- NOT COVERED, on purpose (each is also listed in README.md and ignored by the schema comparison):
--   1. public.execute_sql(text): the AI chat's SQL function (ROADMAP P12). A new database gets no chat
--      SQL function until the AI service replaces it with a safe one.
--   2. The embedding queue: public.embedding_input_jobseeker_bio / _position_description, the embed_*
--      triggers on jobseeker_profiles and positions, schema util, the pgmq and pg_net extensions and
--      the `process-embeddings` cron job. They call an edge function that is not in this repo, and
--      from inside Postgres no test guard can stop them. 011 creates the embedding columns and
--      creates the triggers only if util.queue_embeddings() exists, so nothing here calls out.
--
-- LEFT AS THE FILES HAVE IT, although production lacks it (named in tests/schema/files-ahead-of-production.txt):
--   028's trigger on positions, the has_profile triggers on jobseeker_profiles, the activity_change
--   trigger on recent_activities, the timesheets updated_at trigger and 023's purge job. Whether they
--   go live is client work, not this file's decision.

-- Opt-in guard: see the header. Raises before anything else runs.
DO $$
BEGIN
  IF coalesce(current_setting('rhythence.catch_up', true), '') <> 'new-database' THEN
    RAISE EXCEPTION '032 is the catch-up for NEW databases built from migration_v2 only, and must never be run on a live database (it would change functions and policies there). To run it on a new database set rhythence.catch_up = ''new-database'' for the session. See server/src/db/migration_v2/README.md, section "032 and the test database".'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 1. Privileges. Production gives anon, authenticated and service_role everything on public tables
--    and sequences by default; current Supabase gives new tables nothing.
-- ---------------------------------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- Only objects that have nothing yet are touched: a table that has the bare defaults (TRUNCATE and no
-- read/write privilege) or a sequence the role cannot use. A privilege that 033 removed on purpose
-- (for example ai_validation for anon) is left alone.
DO $$
DECLARE
  t record;
  r text;
BEGIN
  FOR t IN
    SELECT c.oid, c.relname, c.relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'S')
  LOOP
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
      IF t.relkind IN ('r', 'p') THEN
        IF has_table_privilege(r, t.oid, 'TRUNCATE')
           AND NOT has_table_privilege(r, t.oid, 'SELECT') AND NOT has_table_privilege(r, t.oid, 'INSERT')
           AND NOT has_table_privilege(r, t.oid, 'UPDATE') AND NOT has_table_privilege(r, t.oid, 'DELETE') THEN
          EXECUTE format('GRANT ALL ON TABLE public.%I TO %I', t.relname, r);
        END IF;
      ELSIF r = 'service_role' AND NOT has_sequence_privilege(r, t.oid, 'USAGE') THEN
        -- invoice, support and timesheet numbers come from sequences the server writes through
        EXECUTE format('GRANT ALL ON SEQUENCE public.%I TO anon, authenticated, service_role', t.relname);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 006 gives signed-in users less on the activity tables than production has (row security decides who
-- may do what); production has full table privileges.
GRANT ALL ON TABLE public.recent_activities, public.activity_action_types, public.activity_categories TO authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Types production has
-- ---------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'jobseeker_verification_status') THEN
    CREATE TYPE public.jobseeker_verification_status AS ENUM ('verified', 'rejected', 'pending', 'needs_attention');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                 WHERE n.nspname = 'public' AND t.typname = 'position_candidate_mapping_status') THEN
    CREATE TYPE public.position_candidate_mapping_status AS ENUM ('active', 'completed', 'cancelled', 'upcoming');
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 3. Tables and sequences that no earlier file creates
-- ---------------------------------------------------------------------------------------------

-- Which jobseeker works on which position, and when. Used by four server files and by the 014 triggers.
CREATE TABLE IF NOT EXISTS public.position_candidate_assignments (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  position_id UUID NOT NULL,
  candidate_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status CHARACTER VARYING(50) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_user_id UUID NOT NULL,
  updated_by_user_id UUID NOT NULL,
  CONSTRAINT position_candidate_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT position_candidate_assignment_position_id_candidate_id_star_key UNIQUE (position_id, candidate_id, start_date),
  CONSTRAINT position_candidate_assignments_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.positions(id) ON DELETE CASCADE,
  CONSTRAINT position_candidate_assignments_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id),
  CONSTRAINT position_candidate_assignments_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES auth.users(id),
  CONSTRAINT position_candidate_assignments_status_check CHECK (status IN ('active', 'completed', 'upcoming', 'cancelled'))
);
ALTER TABLE public.position_candidate_assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_position_candidate_assignments_candidate ON public.position_candidate_assignments USING btree (candidate_id);
CREATE INDEX IF NOT EXISTS idx_position_candidate_assignments_dates ON public.position_candidate_assignments USING btree (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_position_candidate_assignments_position ON public.position_candidate_assignments USING btree (position_id);
CREATE INDEX IF NOT EXISTS idx_position_candidate_assignments_status ON public.position_candidate_assignments USING btree (status);

-- Reminder emails sent to jobseekers (30, 60 and 90 days). No primary key, as in production.
CREATE TABLE IF NOT EXISTS public.email_checkpoint (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY,
  jobseeker_id UUID,
  day_30 BOOLEAN,
  day_60 BOOLEAN,
  day_90 BOOLEAN
);
ALTER TABLE public.email_checkpoint ENABLE ROW LEVEL SECURITY;

CREATE SEQUENCE IF NOT EXISTS public.timesheet_invoice_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 MAXVALUE 999999 NO CYCLE;

-- The tables above are new after the privilege step in section 1.
GRANT ALL ON TABLE public.position_candidate_assignments, public.email_checkpoint TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON SEQUENCE public.timesheet_invoice_seq, public.email_checkpoint_id_seq TO anon, authenticated, service_role;

-- 014 skips these two triggers when the table is missing; production has them.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_client_activity_on_assignment'
                 AND tgrelid = 'public.position_candidate_assignments'::regclass) THEN
    CREATE TRIGGER trg_client_activity_on_assignment
      AFTER INSERT ON public.position_candidate_assignments
      FOR EACH ROW EXECUTE FUNCTION update_client_last_activity();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_jobseeker_activity_on_assignment'
                 AND tgrelid = 'public.position_candidate_assignments'::regclass) THEN
    CREATE TRIGGER trg_jobseeker_activity_on_assignment
      AFTER INSERT ON public.position_candidate_assignments
      FOR EACH ROW EXECUTE FUNCTION update_jobseeker_last_activity();
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 4. Columns the code uses that no earlier file adds, and column shapes that differ
-- ---------------------------------------------------------------------------------------------

ALTER TABLE public.jobseeker_profiles ADD COLUMN IF NOT EXISTS billing_email TEXT;
ALTER TABLE public.jobseeker_profiles ADD COLUMN IF NOT EXISTS work_permit_expiry TEXT;
ALTER TABLE public.jobseeker_profiles ADD COLUMN IF NOT EXISTS work_permit_uci TEXT;
ALTER TABLE public.client_drafts ADD COLUMN IF NOT EXISTS wsib_code CHARACTER VARYING(2);

DO $$
BEGIN
  -- production: accounting_manager and client_rep have no length limit
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
             AND table_name = 'clients' AND column_name = 'accounting_manager' AND character_maximum_length IS NOT NULL) THEN
    ALTER TABLE public.clients ALTER COLUMN accounting_manager TYPE CHARACTER VARYING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
             AND table_name = 'clients' AND column_name = 'client_rep' AND character_maximum_length IS NOT NULL) THEN
    ALTER TABLE public.clients ALTER COLUMN client_rep TYPE CHARACTER VARYING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
             AND table_name = 'client_drafts' AND column_name = 'accounting_manager' AND character_maximum_length IS NOT NULL) THEN
    ALTER TABLE public.client_drafts ALTER COLUMN accounting_manager TYPE CHARACTER VARYING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
             AND table_name = 'client_drafts' AND column_name = 'client_rep' AND character_maximum_length IS NOT NULL) THEN
    ALTER TABLE public.client_drafts ALTER COLUMN client_rep TYPE CHARACTER VARYING;
  END IF;
  -- production: invoices.version_history is not null
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
             AND table_name = 'invoices' AND column_name = 'version_history' AND is_nullable = 'YES') THEN
    UPDATE public.invoices SET version_history = '[]'::jsonb WHERE version_history IS NULL;
    ALTER TABLE public.invoices ALTER COLUMN version_history SET NOT NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Constraints and indexes
-- ---------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_wsib_code_format_check'
                 AND conrelid = 'public.client_drafts'::regclass) THEN
    ALTER TABLE public.client_drafts
      ADD CONSTRAINT clients_wsib_code_format_check CHECK (wsib_code IS NULL OR wsib_code::text ~ '^[A-Z][0-9]$');
  END IF;
END $$;

-- production names the audit_logs foreign key fk_user
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'audit_logs_user_id_fkey' AND conrelid = 'public.audit_logs'::regclass)
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_user' AND conrelid = 'public.audit_logs'::regclass) THEN
    ALTER TABLE public.audit_logs RENAME CONSTRAINT audit_logs_user_id_fkey TO fk_user;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobseeker_profiles_employee_id ON public.jobseeker_profiles USING btree (employee_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_invoice_number ON public.timesheets USING btree (invoice_number);
-- 007 adds a GIN index on invoices.version_history that no production database has
DROP INDEX IF EXISTS public.idx_invoices_version_history;

-- ---------------------------------------------------------------------------------------------
-- 6. Tables only the files had
-- ---------------------------------------------------------------------------------------------

-- 008 creates bulk_timesheets, which production dropped (the app does not use it). Dropped here only
-- when it is empty; a database that holds rows in it keeps it and is told so.
DO $$
DECLARE
  n bigint;
BEGIN
  IF to_regclass('public.bulk_timesheets') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.bulk_timesheets' INTO n;
    IF n = 0 THEN
      DROP TABLE public.bulk_timesheets;
    ELSE
      RAISE NOTICE 'bulk_timesheets holds % rows and was kept; production dropped it', n;
    END IF;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 7. Functions: production's definitions (CREATE OR REPLACE, so a second run changes nothing).
--    Not repeated here because 033 / 034 define them: default_app_role, document_on_own_profile,
--    get_user_role, get_user_roles, has_role, has_scope, has_user_role, is_admin, is_jobseeker,
--    is_recruiter, list_auth_users.
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_invoice_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.invoice_number IS NULL THEN
        NEW.invoice_number := generate_invoice_number();
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.find_matching_candidates(p_position_id uuid, p_limit integer DEFAULT 25, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(candidate_id uuid, first_name text, last_name text, email text, mobile text, bio text, experience text, weekend_availability boolean, availability text, similarity_score double precision, is_available boolean)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_position_embedding vector;
    v_start_date DATE;
    v_end_date DATE;
BEGIN
    -- Get position details
    SELECT 
        p.job_embedding,
        p.start_date,
        p.end_date
    INTO 
        v_position_embedding,
        v_start_date,
        v_end_date
    FROM positions p
    WHERE p.id = p_position_id;
    
    -- Return matching candidates
    RETURN QUERY
    WITH available_candidates AS (
        SELECT 
            jp.user_id,
            jp.id,
            jp.first_name,
            jp.last_name,
            jp.email,
            jp.mobile,
            jp.bio,
            jp.experience,
            jp.weekend_availability,
            jp.availability,
            jp.bio_embedding,
            CASE WHEN pca.candidate_id IS NULL THEN TRUE ELSE FALSE END AS is_available
        FROM jobseeker_profiles jp
        -- LEFT JOIN: if match found, candidate is busy; NULL means available
        LEFT JOIN position_candidate_assignments pca
            ON pca.candidate_id = jp.user_id  -- Now correctly using user_id
            AND pca.status IN ('active', 'upcoming')
            AND daterange(pca.start_date, COALESCE(pca.end_date, 'infinity'::date), '[]') 
                && daterange(v_start_date, COALESCE(v_end_date, 'infinity'::date), '[]')
        WHERE jp.verification_status = 'verified'
        AND jp.bio_embedding IS NOT NULL
    ),
    filtered_candidates AS (
        SELECT *
        FROM available_candidates ac
        WHERE 
            -- Apply dynamic filters from JSONB
            (p_filters->>'weekend_availability' IS NULL OR 
             ac.weekend_availability = (p_filters->>'weekend_availability')::BOOLEAN)
            AND
            (p_filters->>'experience' IS NULL OR 
             ac.experience = p_filters->>'experience')
            AND
            (p_filters->>'availability' IS NULL OR 
             ac.availability = p_filters->>'availability')
            AND
            (p_filters->>'city' IS NULL OR 
             EXISTS (
                SELECT 1 FROM jobseeker_profiles jp2 
                WHERE jp2.id = ac.id 
                AND LOWER(jp2.city) = LOWER(p_filters->>'city')
             ))
            AND
            (p_filters->>'province' IS NULL OR 
             EXISTS (
                SELECT 1 FROM jobseeker_profiles jp2 
                WHERE jp2.id = ac.id 
                AND LOWER(jp2.province) = LOWER(p_filters->>'province')
             ))
            AND
            (p_filters->>'only_available' IS NULL OR 
             p_filters->>'only_available' = 'false' OR 
             ac.is_available = TRUE)
    )
    SELECT 
        fc.user_id AS candidate_id,  -- Return user_id as candidate_id
        fc.first_name,
        fc.last_name,
        fc.email,
        fc.mobile,
        fc.bio,
        fc.experience,
        fc.weekend_availability,
        fc.availability,
        1 - (fc.bio_embedding <=> v_position_embedding) AS similarity_score,
        fc.is_available
    FROM filtered_candidates fc
    WHERE v_position_embedding IS NOT NULL
    ORDER BY 
        1 - (fc.bio_embedding <=> v_position_embedding) DESC -- Then by similarity
    LIMIT p_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
    next_val INTEGER;
    formatted_number VARCHAR(10);
BEGIN
    next_val := nextval('invoice_number_seq');
    -- Format as 000001 (without INV- prefix)
    formatted_number := LPAD(next_val::TEXT, 6, '0');
    RETURN formatted_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_next_position_code(client_short_code text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
    next_number INTEGER;
    new_position_code TEXT;
    max_existing_number INTEGER;
BEGIN
    -- Find the highest existing number for this client's short code
    SELECT COALESCE(
        MAX(
            CASE 
                WHEN position_code ~ ('^' || client_short_code || '[0-9]{3}$')
                THEN CAST(RIGHT(position_code, 3) AS INTEGER)
                ELSE 0
            END
        ), 0
    ) INTO max_existing_number
    FROM (
        SELECT position_code FROM positions WHERE position_code LIKE client_short_code || '%'
        UNION ALL
        SELECT position_code FROM position_drafts WHERE position_code LIKE client_short_code || '%'
    ) AS all_codes;
    
    -- Increment the number
    next_number := max_existing_number + 1;
    
    -- Format as 3-digit number with leading zeros
    new_position_code := client_short_code || LPAD(next_number::TEXT, 3, '0');
    
    RETURN new_position_code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_manager_id(user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
    SELECT NULLIF((auth.users.raw_user_meta_data -> 'hierarchy' ->> 'manager_id'), '')::uuid
    FROM auth.users
    WHERE id = user_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_org_id(user_id uuid)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
    SELECT NULLIF((auth.users.raw_user_meta_data -> 'hierarchy' ->> 'org_id'), '')::uuid
    FROM auth.users
    WHERE id = user_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_role_change_log(user_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
    SELECT COALESCE(auth.users.raw_user_meta_data -> 'role_change_log', '[]'::jsonb)
    FROM auth.users
    WHERE id = user_id;
$function$;

CREATE OR REPLACE FUNCTION public.get_table_info(table_name_param text DEFAULT NULL::text, schema_name_param text DEFAULT 'public'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    result json;
BEGIN
    IF table_name_param IS NULL THEN
        -- Return all tables in the schema
        SELECT json_agg(
            json_build_object(
                'table_name', table_name,
                'table_schema', table_schema,
                'table_type', table_type
            )
        )
        FROM information_schema.tables
        WHERE table_schema = schema_name_param
        AND table_type = 'BASE TABLE'
        INTO result;
    ELSE
        -- Return detailed information about a specific table
        SELECT json_build_object(
            'table_name', table_name_param,
            'table_schema', schema_name_param,
            'columns', (
                SELECT json_agg(
                    json_build_object(
                        'column_name', column_name,
                        'data_type', data_type,
                        'is_nullable', is_nullable,
                        'column_default', column_default,
                        'ordinal_position', ordinal_position
                    )
                )
                FROM information_schema.columns
                WHERE table_name = table_name_param
                AND table_schema = schema_name_param
                ORDER BY ordinal_position
            ),
            'primary_keys', (
                SELECT json_agg(column_name)
                FROM information_schema.key_column_usage kcu
                JOIN information_schema.table_constraints tc
                ON kcu.constraint_name = tc.constraint_name
                WHERE tc.table_name = table_name_param
                AND tc.table_schema = schema_name_param
                AND tc.constraint_type = 'PRIMARY KEY'
            ),
            'foreign_keys', (
                SELECT json_agg(
                    json_build_object(
                        'column_name', kcu.column_name,
                        'foreign_table_name', ccu.table_name,
                        'foreign_column_name', ccu.column_name
                    )
                )
                FROM information_schema.key_column_usage kcu
                JOIN information_schema.table_constraints tc
                ON kcu.constraint_name = tc.constraint_name
                JOIN information_schema.constraint_column_usage ccu
                ON tc.constraint_name = ccu.constraint_name
                WHERE tc.table_name = table_name_param
                AND tc.table_schema = schema_name_param
                AND tc.constraint_type = 'FOREIGN KEY'
            )
        ) INTO result;
    END IF;
    
    RETURN COALESCE(result, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(user_email text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Find the user with the given email
    RETURN (
        SELECT id
        FROM auth.users
        WHERE email = user_email
        LIMIT 1
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_id_by_phone(user_phone text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Find the user with the given phone number
    -- Check both the phone field and phoneNumber in user_metadata
    RETURN (
        SELECT id
        FROM auth.users
        WHERE phone = user_phone 
           OR raw_user_meta_data->>'phoneNumber' = user_phone
        LIMIT 1
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_activity_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    event_type TEXT;
    payload JSONB;
BEGIN
    -- Determine the event type
    IF TG_OP = 'INSERT' THEN
        event_type := 'INSERT';
        payload := jsonb_build_object(
            'eventType', event_type,
            'table', TG_TABLE_NAME,
            'timestamp', NOW(),
            'new', row_to_json(NEW)
        );
        PERFORM pg_notify('recent_activities_changes', payload::text);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        event_type := 'UPDATE';
        payload := jsonb_build_object(
            'eventType', event_type,
            'table', TG_TABLE_NAME,
            'timestamp', NOW(),
            'old', row_to_json(OLD),
            'new', row_to_json(NEW)
        );
        PERFORM pg_notify('recent_activities_changes', payload::text);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        event_type := 'DELETE';
        payload := jsonb_build_object(
            'eventType', event_type,
            'table', TG_TABLE_NAME,
            'timestamp', NOW(),
            'old', row_to_json(OLD)
        );
        PERFORM pg_notify('recent_activities_changes', payload::text);
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_user_roles(target_user_id uuid, new_roles text[], changed_by uuid, reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    caller_is_admin boolean;
    old_roles text[] := ARRAY[]::text[];
    current_meta jsonb;
    new_log_entry jsonb;
    updated_log jsonb;
BEGIN
    SELECT (raw_user_meta_data->>'user_type' = 'admin') INTO caller_is_admin
    FROM auth.users
    WHERE id = auth.uid();

    IF NOT caller_is_admin THEN
        RAISE EXCEPTION 'Not authorized to set roles';
    END IF;

    SELECT raw_user_meta_data INTO current_meta
    FROM auth.users
    WHERE id = target_user_id
    FOR UPDATE;

    SELECT COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(current_meta -> 'user_role')),
        ARRAY[]::text[]
    ) INTO old_roles;

    new_log_entry := jsonb_build_object(
        'changed_at', now(),
        'changed_by', changed_by,
        'previous_roles', to_jsonb(old_roles),
        'new_roles', to_jsonb(new_roles),
        'reason', to_jsonb(reason)
    );

    updated_log := COALESCE(current_meta -> 'role_change_log', '[]'::jsonb) || new_log_entry;

    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
        jsonb_set(
            COALESCE(current_meta, '{}'::jsonb),
            '{user_role}',
            to_jsonb(new_roles),
            true
        ),
        '{role_change_log}',
        updated_log,
        true
    )
    WHERE id = target_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.simple_matching_candidates(p_position_id uuid, p_limit integer DEFAULT 20)
 RETURNS TABLE(candidate_id uuid, similarity_score double precision)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_position_embedding vector;
BEGIN
    -- Get position embedding
    SELECT job_embedding INTO v_position_embedding
    FROM positions
    WHERE id = p_position_id;

    -- Return top matches by embedding
    RETURN QUERY
    SELECT 
        jp.id,
        1 - (jp.bio_embedding <=> v_position_embedding) AS similarity_score
    FROM jobseeker_profiles jp
    WHERE jp.verification_status = 'approved'
    AND jp.bio_embedding IS NOT NULL
    AND v_position_embedding IS NOT NULL
    ORDER BY (jp.bio_embedding <=> v_position_embedding) ASC
    LIMIT p_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.support_add_message(p_ticket_id uuid, p_author_id uuid, p_author_name text, p_author_kind text, p_body text, p_is_internal boolean DEFAULT false)
 RETURNS support_ticket_messages
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket public.support_tickets;
  v_message_count integer;
  v_message public.support_ticket_messages;
BEGIN
  -- SELECT ... FOR UPDATE on the ticket first; if missing raise 'TICKET_NOT_FOUND:'
  SELECT * INTO v_ticket
  FROM public.support_tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND: Ticket % not found', p_ticket_id;
  END IF;

  -- Validate author kind: must be 'requester' or 'agent'
  IF p_author_kind NOT IN ('requester', 'agent') THEN
    RAISE EXCEPTION 'INVALID_ACTOR: % is not a valid message author kind', p_author_kind;
  END IF;

  -- Validate internal note permissions
  IF COALESCE(p_is_internal, false) AND p_author_kind <> 'agent' THEN
    RAISE EXCEPTION 'INTERNAL_NOT_ALLOWED: Only agents may post internal notes';
  END IF;

  -- Validate message limit (maximum 200 messages)
  SELECT COUNT(*) INTO v_message_count
  FROM public.support_ticket_messages
  WHERE ticket_id = p_ticket_id;

  IF v_message_count >= 200 THEN
    RAISE EXCEPTION 'MESSAGE_LIMIT: Ticket % already has % messages (maximum 200)', p_ticket_id, v_message_count;
  END IF;

  -- Automatic status changes for requester public replies
  IF p_author_kind = 'requester' AND NOT COALESCE(p_is_internal, false) THEN
    IF v_ticket.status IN ('waiting_on_client', 'resolved', 'closed') THEN
      PERFORM public.support_change_status(
        p_ticket_id => p_ticket_id,
        p_to_status => 'in_progress',
        p_actor_id => p_author_id,
        p_actor_kind => p_author_kind
      );
    END IF;
  END IF;

  -- Insert the message and return it
  INSERT INTO public.support_ticket_messages (
    ticket_id,
    author_id,
    author_name,
    author_kind,
    body,
    is_internal
  ) VALUES (
    p_ticket_id,
    p_author_id,
    p_author_name,
    p_author_kind,
    p_body,
    COALESCE(p_is_internal, false)
  )
  RETURNING * INTO v_message;

  RETURN v_message;
END;
$function$;

CREATE OR REPLACE FUNCTION public.support_auto_close_resolved()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket RECORD;
  v_count integer := 0;
BEGIN
  FOR v_ticket IN
    SELECT id
    FROM public.support_tickets
    WHERE status = 'resolved'
      AND resolved_at IS NOT NULL
      AND resolved_at <= (now() - interval '7 days')
  LOOP
    BEGIN
      PERFORM public.support_change_status(
        p_ticket_id => v_ticket.id,
        p_to_status => 'closed',
        p_actor_id => NULL,
        p_actor_kind => 'system',
        p_effort_minutes => NULL
      );

      INSERT INTO public.support_ticket_messages (
        ticket_id,
        author_id,
        author_name,
        author_kind,
        body,
        is_internal
      ) VALUES (
        v_ticket.id,
        NULL,
        'System',
        'system',
        'Closed automatically after 7 days without a response.',
        false
      );

      v_count := v_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'support_auto_close_resolved failed for ticket %: %', v_ticket.id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.support_change_status(p_ticket_id uuid, p_to_status text, p_actor_id uuid, p_actor_kind text, p_effort_minutes integer DEFAULT NULL::integer)
 RETURNS support_tickets
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket public.support_tickets;
  v_updated_ticket public.support_tickets;
  v_resolved_at timestamptz;
  v_closed_at timestamptz;
  v_confirmed_by text;
  v_effort_minutes integer;
BEGIN
  -- Validate actor kind
  IF p_actor_kind NOT IN ('requester', 'agent', 'system') THEN
    RAISE EXCEPTION 'INVALID_ACTOR: % is not a valid actor kind', p_actor_kind;
  END IF;

  -- Lock ticket row for update
  SELECT * INTO v_ticket
  FROM public.support_tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TICKET_NOT_FOUND: Ticket % not found', p_ticket_id;
  END IF;

  -- Validate allowed transitions only
  IF NOT (
    (v_ticket.status = 'open' AND p_to_status IN ('in_progress', 'waiting_on_client', 'resolved')) OR
    (v_ticket.status = 'in_progress' AND p_to_status IN ('waiting_on_client', 'resolved')) OR
    (v_ticket.status = 'waiting_on_client' AND p_to_status IN ('in_progress', 'resolved')) OR
    (v_ticket.status = 'resolved' AND p_to_status IN ('closed', 'in_progress')) OR
    (v_ticket.status = 'closed' AND p_to_status = 'in_progress')
  ) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: Cannot transition ticket % from ''%'' to ''%''',
      p_ticket_id, v_ticket.status, p_to_status;
  END IF;

  -- Validate reopen window for closed tickets (14 days)
  IF v_ticket.status = 'closed' AND p_to_status = 'in_progress' THEN
    IF v_ticket.closed_at IS NULL OR v_ticket.closed_at <= (now() - interval '14 days') THEN
      RAISE EXCEPTION 'REOPEN_WINDOW_EXPIRED: Cannot reopen ticket % closed more than 14 days ago', p_ticket_id;
    END IF;
  END IF;

  -- Compute fields based on target status
  IF p_to_status = 'resolved' THEN
    v_resolved_at := now();
    v_closed_at := v_ticket.closed_at;
    v_confirmed_by := v_ticket.confirmed_by;
  ELSIF p_to_status = 'closed' THEN
    v_closed_at := now();
    v_resolved_at := COALESCE(v_ticket.resolved_at, now());
    v_confirmed_by := CASE p_actor_kind
      WHEN 'requester' THEN 'client'
      WHEN 'system' THEN 'auto'
      ELSE 'agent'
    END;
  ELSIF p_to_status = 'in_progress' AND v_ticket.status IN ('resolved', 'closed') THEN
    v_resolved_at := NULL;
    v_closed_at := NULL;
    v_confirmed_by := NULL;
  ELSE
    v_resolved_at := v_ticket.resolved_at;
    v_closed_at := v_ticket.closed_at;
    v_confirmed_by := v_ticket.confirmed_by;
  END IF;

  v_effort_minutes := COALESCE(p_effort_minutes, v_ticket.effort_minutes);

  -- Update ticket record
  UPDATE public.support_tickets
  SET
    status = p_to_status,
    effort_minutes = v_effort_minutes,
    resolved_at = v_resolved_at,
    closed_at = v_closed_at,
    confirmed_by = v_confirmed_by
  WHERE id = p_ticket_id
  RETURNING * INTO v_updated_ticket;

  -- Insert status event
  INSERT INTO public.support_ticket_status_events (
    ticket_id,
    from_status,
    to_status,
    changed_by
  ) VALUES (
    p_ticket_id,
    v_ticket.status,
    p_to_status,
    p_actor_id
  );

  RETURN v_updated_ticket;
END;
$function$;

CREATE OR REPLACE FUNCTION public.support_create_ticket(p_requester_id uuid, p_requester_name text, p_requester_email text, p_requester_roles text[], p_type text, p_title text, p_description text, p_urgency text, p_context jsonb, p_locale text, p_idempotency_key uuid)
 RETURNS support_tickets
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ticket public.support_tickets;
  v_priority text;
BEGIN
  -- Idempotency check: return existing ticket if idempotency_key matches
  SELECT * INTO v_ticket
  FROM public.support_tickets
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF NOT (v_ticket.requester_id IS NOT DISTINCT FROM p_requester_id) THEN
      RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Ticket already exists with a different requester';
    END IF;
    RETURN v_ticket;
  END IF;

  -- Map urgency to priority
  v_priority := CASE p_urgency
    WHEN 'blocked' THEN 'p1'
    WHEN 'annoying' THEN 'p2'
    WHEN 'not_urgent' THEN 'p3'
    ELSE 'p3'
  END;

  -- Insert ticket (catch unique_violation for concurrent calls with the same key)
  BEGIN
    INSERT INTO public.support_tickets (
      idempotency_key,
      type,
      title,
      urgency,
      priority,
      status,
      requester_id,
      requester_name,
      requester_email,
      requester_roles,
      context,
      locale
    ) VALUES (
      p_idempotency_key,
      p_type,
      p_title,
      p_urgency,
      v_priority,
      'open',
      p_requester_id,
      p_requester_name,
      p_requester_email,
      COALESCE(p_requester_roles, '{}'::text[]),
      COALESCE(p_context, '{}'::jsonb),
      COALESCE(p_locale, 'en')
    )
    RETURNING * INTO v_ticket;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT * INTO v_ticket
      FROM public.support_tickets
      WHERE idempotency_key = p_idempotency_key;

      IF FOUND THEN
        IF NOT (v_ticket.requester_id IS NOT DISTINCT FROM p_requester_id) THEN
          RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Ticket already exists with a different requester';
        END IF;
        RETURN v_ticket;
      ELSE
        RAISE;
      END IF;
  END;

  -- Insert initial description message
  INSERT INTO public.support_ticket_messages (
    ticket_id,
    author_id,
    author_name,
    author_kind,
    body,
    is_internal
  ) VALUES (
    v_ticket.id,
    p_requester_id,
    p_requester_name,
    'requester',
    p_description,
    false
  );

  -- Insert initial status event (null -> 'open')
  INSERT INTO public.support_ticket_status_events (
    ticket_id,
    from_status,
    to_status,
    changed_by
  ) VALUES (
    v_ticket.id,
    NULL,
    'open',
    p_requester_id
  );

  RETURN v_ticket;
END;
$function$;

CREATE OR REPLACE FUNCTION public.support_elapsed_minutes(p_ticket_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_seconds double precision;
BEGIN
  WITH event_intervals AS (
    SELECT
      to_status,
      created_at AS start_time,
      LEAD(created_at, 1, now()) OVER (ORDER BY created_at ASC, id ASC) AS end_time
    FROM public.support_ticket_status_events
    WHERE ticket_id = p_ticket_id
  )
  SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time))), 0)
  INTO v_total_seconds
  FROM event_intervals
  WHERE to_status IN ('open', 'in_progress')
    AND end_time > start_time;

  RETURN GREATEST(0, FLOOR(v_total_seconds / 60.0)::integer);
END;
$function$;

CREATE OR REPLACE FUNCTION public.support_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.test_connection()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN json_build_object(
        'connected', true,
        'timestamp', NOW(),
        'version', version()
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_bulk_timesheets_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_client_last_activity()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  target_client_id UUID;
BEGIN
  -- Determine the client ID based on the source table
  CASE TG_TABLE_NAME
    WHEN 'clients' THEN
      -- Direct client update
      target_client_id := NEW.id;

    WHEN 'positions' THEN
      -- Position created/updated for a client
      target_client_id := NEW.client;

    WHEN 'timesheets' THEN
      -- Timesheet created/updated → resolve client via position
      IF NEW.position_id IS NOT NULL THEN
        SELECT p.client INTO target_client_id
        FROM public.positions p
        WHERE p.id = NEW.position_id;
      END IF;

    WHEN 'invoices' THEN
      -- Invoice created/updated for a client
      target_client_id := NEW.client_id;

    WHEN 'position_candidate_assignments' THEN
      -- Jobseeker assigned to a position → resolve client via position
      IF NEW.position_id IS NOT NULL THEN
        SELECT p.client INTO target_client_id
        FROM public.positions p
        WHERE p.id = NEW.position_id;
      END IF;
  END CASE;

  -- Update the client's last_activity_at if we found a valid client
  IF target_client_id IS NOT NULL THEN
    UPDATE public.clients
    SET last_activity_at = NOW()
    WHERE id = target_client_id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_consent_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_job_status()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
begin
  -- Set to completed: end_date < today
  update public.position_candidate_assignments
  set status = 'completed'
  where end_date < current_date
    and status != 'cancelled';

  -- Set to active: today is between start_date and end_date (inclusive)
  update public.position_candidate_assignments
  set status = 'active'
  where current_date >= start_date
    and current_date <= end_date
    and status != 'cancelled';

  -- Set to upcoming: today is before start_date
  update public.position_candidate_assignments
  set status = 'upcoming'
  where current_date < start_date
    and status != 'cancelled';
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_jobseeker_last_activity()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  target_jobseeker_id UUID;
  ts_element JSONB;
BEGIN
  -- Determine the jobseeker profile ID based on the source table
  CASE TG_TABLE_NAME
    WHEN 'jobseeker_profiles' THEN
      -- Direct jobseeker profile update
      target_jobseeker_id := NEW.id;

    WHEN 'timesheets' THEN
      -- Timesheet created/updated for a jobseeker
      target_jobseeker_id := NEW.jobseeker_profile_id;

    WHEN 'position_candidate_assignments' THEN
      -- Jobseeker assigned to a position (candidate_id is auth.users.id, not jobseeker_profiles.id)
      IF NEW.candidate_id IS NOT NULL THEN
        UPDATE public.jobseeker_profiles
        SET last_activity_at = NOW()
        WHERE user_id = NEW.candidate_id;
      END IF;
      RETURN NEW;

    WHEN 'invoices' THEN
      -- Invoice created/updated → extract all jobseeker IDs from JSONB timesheets array
      IF NEW.invoice_data IS NOT NULL AND NEW.invoice_data -> 'timesheets' IS NOT NULL THEN
        FOR ts_element IN SELECT jsonb_array_elements(NEW.invoice_data -> 'timesheets')
        LOOP
          IF ts_element -> 'jobseekerProfile' ->> 'jobseekerProfileId' IS NOT NULL THEN
            UPDATE public.jobseeker_profiles
            SET last_activity_at = NOW()
            WHERE id = (ts_element -> 'jobseekerProfile' ->> 'jobseekerProfileId')::UUID;
          END IF;
        END LOOP;
      END IF;
      -- Already handled all jobseekers in the loop, skip the single-update below
      RETURN NEW;
  END CASE;

  -- Update the jobseeker's last_activity_at if we found a valid ID
  IF target_jobseeker_id IS NOT NULL THEN
    UPDATE public.jobseeker_profiles
    SET last_activity_at = NOW()
    WHERE id = target_jobseeker_id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_has_profile_on_profile_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    user_id UUID;
    curr_metadata JSONB;
    new_metadata JSONB;
BEGIN
    -- Set user_id based on whether this is an INSERT, UPDATE or DELETE operation
    IF TG_OP = 'DELETE' THEN
        user_id := OLD.user_id;
    ELSE
        user_id := NEW.user_id;
    END IF;
    
    -- Get current metadata
    SELECT raw_user_meta_data INTO curr_metadata 
    FROM auth.users 
    WHERE id = user_id;
    
    IF curr_metadata IS NULL THEN
        -- Skip if user not found
        RETURN NULL;
    END IF;
    
    -- For INSERT/UPDATE, set hasProfile to true
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        new_metadata := jsonb_set(
            curr_metadata, 
            '{hasProfile}', 
            'true'::jsonb, 
            true
        );
        
        UPDATE auth.users 
        SET raw_user_meta_data = new_metadata 
        WHERE id = user_id;
        
    -- For DELETE, check if any profiles still exist
    ELSIF TG_OP = 'DELETE' THEN
        -- Check if user has any other profiles (fix ambiguous user_id reference)
        IF NOT EXISTS (SELECT 1 FROM jobseeker_profiles jp WHERE jp.user_id = user_id) THEN
            -- If no profiles left, set hasProfile to false
            new_metadata := jsonb_set(
                curr_metadata, 
                '{hasProfile}', 
                'false'::jsonb, 
                true
            );
            
            UPDATE auth.users 
            SET raw_user_meta_data = new_metadata 
            WHERE id = user_id;
        END IF;
    END IF;
    
    RETURN NULL;
END;
$function$;

-- ---------------------------------------------------------------------------------------------
-- 9. Triggers that differ: the function each one calls in production
-- ---------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_ensure_invoice_number'
                 AND tgrelid = 'public.invoices'::regclass AND tgfoid = 'public.ensure_invoice_number()'::regprocedure) THEN
    DROP TRIGGER IF EXISTS trigger_ensure_invoice_number ON public.invoices;
    CREATE TRIGGER trigger_ensure_invoice_number BEFORE INSERT ON public.invoices
      FOR EACH ROW EXECUTE FUNCTION ensure_invoice_number();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_invoices_updated_at'
                 AND tgrelid = 'public.invoices'::regclass AND tgfoid = 'public.update_updated_at_column()'::regprocedure) THEN
    DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
    CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_consent_documents_updated_at'
                 AND tgrelid = 'public.consent_documents'::regclass AND tgfoid = 'public.update_updated_at_column()'::regprocedure) THEN
    DROP TRIGGER IF EXISTS update_consent_documents_updated_at ON public.consent_documents;
    CREATE TRIGGER update_consent_documents_updated_at BEFORE UPDATE ON public.consent_documents
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_consent_records_updated_at'
                 AND tgrelid = 'public.consent_records'::regclass AND tgfoid = 'public.update_updated_at_column()'::regprocedure) THEN
    DROP TRIGGER IF EXISTS update_consent_records_updated_at ON public.consent_records;
    CREATE TRIGGER update_consent_records_updated_at BEFORE UPDATE ON public.consent_records
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- The two functions the files used for those triggers; nothing uses them once the triggers are repointed.
DROP FUNCTION IF EXISTS public.ensure_invoice_number_for_invoices();
DROP FUNCTION IF EXISTS public.update_invoices_updated_at_column();

-- ---------------------------------------------------------------------------------------------
-- 9b. Policy production does not have: 006 lets every user read the activities that mention them
-- ---------------------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view their own activities" ON public.recent_activities;

-- ---------------------------------------------------------------------------------------------
-- 10. Policies: invoices and the storage rules production has. A rule is (re)created only when no policy
--     on the table has the same command, text and check (a differently named policy with the same rule counts).
-- ---------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname || '.' || tablename = 'public.invoices' AND cmd = 'UPDATE'
      AND regexp_replace(coalesce(qual, ''), '\s+', ' ', 'g') = $q$(EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'recruiter'::text])))))$q$
      AND regexp_replace(coalesce(with_check, ''), '\s+', ' ', 'g') = ''
  ) THEN
    DROP POLICY IF EXISTS "Admin and recruiters can update any invoice" ON public.invoices;
    CREATE POLICY "Admin and recruiters can update any invoice" ON public.invoices
      AS PERMISSIVE FOR UPDATE
      USING (EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'recruiter'::text])))));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname || '.' || tablename = 'public.invoices' AND cmd = 'SELECT'
      AND regexp_replace(coalesce(qual, ''), '\s+', ' ', 'g') = $q$(EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'recruiter'::text])))))$q$
      AND regexp_replace(coalesce(with_check, ''), '\s+', ' ', 'g') = ''
  ) THEN
    DROP POLICY IF EXISTS "Admin and recruiters can view all invoices" ON public.invoices;
    CREATE POLICY "Admin and recruiters can view all invoices" ON public.invoices
      AS PERMISSIVE FOR SELECT
      USING (EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = ANY (ARRAY['admin'::text, 'recruiter'::text])))));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname || '.' || tablename = 'public.invoices' AND cmd = 'DELETE'
      AND regexp_replace(coalesce(qual, ''), '\s+', ' ', 'g') = $q$(EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = 'admin'::text))))$q$
      AND regexp_replace(coalesce(with_check, ''), '\s+', ' ', 'g') = ''
  ) THEN
    DROP POLICY IF EXISTS "Admin can delete invoices" ON public.invoices;
    CREATE POLICY "Admin can delete invoices" ON public.invoices
      AS PERMISSIVE FOR DELETE
      USING (EXISTS ( SELECT 1 FROM auth.users WHERE ((users.id = auth.uid()) AND ((users.raw_user_meta_data ->> 'role'::text) = 'admin'::text))));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname || '.' || tablename = 'storage.objects' AND cmd = 'DELETE'
      AND regexp_replace(coalesce(qual, ''), '\s+', ' ', 'g') = $q$((bucket_id = 'invoices'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))$q$
      AND regexp_replace(coalesce(with_check, ''), '\s+', ' ', 'g') = ''
  ) THEN
    DROP POLICY IF EXISTS "Allow authenticated users to delete invoice attachments" ON storage.objects;
    CREATE POLICY "Allow authenticated users to delete invoice attachments" ON storage.objects
      AS PERMISSIVE FOR DELETE TO authenticated
      USING ((bucket_id = 'invoices'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname || '.' || tablename = 'storage.objects' AND cmd = 'DELETE'
      AND regexp_replace(coalesce(qual, ''), '\s+', ' ', 'g') = $q$((bucket_id = 'jobseeker-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))$q$
      AND regexp_replace(coalesce(with_check, ''), '\s+', ' ', 'g') = ''
  ) THEN
    DROP POLICY IF EXISTS "Allow authenticated users to delete own documents" ON storage.objects;
    CREATE POLICY "Allow authenticated users to delete own documents" ON storage.objects
      AS PERMISSIVE FOR DELETE TO authenticated
      USING ((bucket_id = 'jobseeker-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname || '.' || tablename = 'storage.objects' AND cmd = 'SELECT'
      AND regexp_replace(coalesce(qual, ''), '\s+', ' ', 'g') = $q$((bucket_id = 'invoices'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))$q$
      AND regexp_replace(coalesce(with_check, ''), '\s+', ' ', 'g') = ''
  ) THEN
    DROP POLICY IF EXISTS "Allow authenticated users to select invoice attachments" ON storage.objects;
    CREATE POLICY "Allow authenticated users to select invoice attachments" ON storage.objects
      AS PERMISSIVE FOR SELECT TO authenticated
      USING ((bucket_id = 'invoices'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname || '.' || tablename = 'storage.objects' AND cmd = 'SELECT'
      AND regexp_replace(coalesce(qual, ''), '\s+', ' ', 'g') = $q$((bucket_id = 'jobseeker-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))$q$
      AND regexp_replace(coalesce(with_check, ''), '\s+', ' ', 'g') = ''
  ) THEN
    DROP POLICY IF EXISTS "Allow authenticated users to select own documents" ON storage.objects;
    CREATE POLICY "Allow authenticated users to select own documents" ON storage.objects
      AS PERMISSIVE FOR SELECT TO authenticated
      USING ((bucket_id = 'jobseeker-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname || '.' || tablename = 'storage.objects' AND cmd = 'UPDATE'
      AND regexp_replace(coalesce(qual, ''), '\s+', ' ', 'g') = $q$((bucket_id = 'invoices'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))$q$
      AND regexp_replace(coalesce(with_check, ''), '\s+', ' ', 'g') = $q$((bucket_id = 'invoices'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))$q$
  ) THEN
    DROP POLICY IF EXISTS "Allow authenticated users to update invoice attachments" ON storage.objects;
    CREATE POLICY "Allow authenticated users to update invoice attachments" ON storage.objects
      AS PERMISSIVE FOR UPDATE TO authenticated
      USING ((bucket_id = 'invoices'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))
      WITH CHECK ((bucket_id = 'invoices'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname || '.' || tablename = 'storage.objects' AND cmd = 'UPDATE'
      AND regexp_replace(coalesce(qual, ''), '\s+', ' ', 'g') = $q$((bucket_id = 'jobseeker-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))$q$
      AND regexp_replace(coalesce(with_check, ''), '\s+', ' ', 'g') = $q$((bucket_id = 'jobseeker-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))$q$
  ) THEN
    DROP POLICY IF EXISTS "Allow authenticated users to update own documents" ON storage.objects;
    CREATE POLICY "Allow authenticated users to update own documents" ON storage.objects
      AS PERMISSIVE FOR UPDATE TO authenticated
      USING ((bucket_id = 'jobseeker-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))
      WITH CHECK ((bucket_id = 'jobseeker-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname || '.' || tablename = 'storage.objects' AND cmd = 'INSERT'
      AND regexp_replace(coalesce(qual, ''), '\s+', ' ', 'g') = ''
      AND regexp_replace(coalesce(with_check, ''), '\s+', ' ', 'g') = $q$((bucket_id = 'invoices'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))$q$
  ) THEN
    DROP POLICY IF EXISTS "Allow authenticated users to upload invoice attachments" ON storage.objects;
    CREATE POLICY "Allow authenticated users to upload invoice attachments" ON storage.objects
      AS PERMISSIVE FOR INSERT TO authenticated
      WITH CHECK ((bucket_id = 'invoices'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname || '.' || tablename = 'storage.objects' AND cmd = 'INSERT'
      AND regexp_replace(coalesce(qual, ''), '\s+', ' ', 'g') = ''
      AND regexp_replace(coalesce(with_check, ''), '\s+', ' ', 'g') = $q$((bucket_id = 'jobseeker-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))$q$
  ) THEN
    DROP POLICY IF EXISTS "Allow authenticated users to upload own documents" ON storage.objects;
    CREATE POLICY "Allow authenticated users to upload own documents" ON storage.objects
      AS PERMISSIVE FOR INSERT TO authenticated
      WITH CHECK ((bucket_id = 'jobseeker-documents'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 11. Storage buckets no file creates (the other three are created by 009, 007 and 027)
-- ---------------------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public) VALUES ('jobseeker-documents', 'jobseeker-documents', false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('default-documents', 'default-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------------------------
-- 12. Scheduled job: keeps assignment statuses (active, upcoming, completed) true, every day at 04:00 UTC
-- ---------------------------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily_update_job_status') THEN
    PERFORM cron.schedule('daily_update_job_status', '0 4 * * *', 'select public.update_job_status();');
  END IF;
END $$;
