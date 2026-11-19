-- 037: the read layer for the AI chat (session AI-5a).
--
-- Runs after 036. Safe to run twice. Changes nothing visible until the AI service has the chat switched on
-- (CHAT_ENABLED) and the portal's feature flag `ai_chat` is on.
--
-- What it does, and why it is built this way:
--   * The chat reads the database as the signed-in staff member, through four functions the portal's own
--     login can call (public.ai_chat_schema / _run / _claim / _record_usage). No service key, no password,
--     no function that runs free-form SQL as a powerful role (that was `execute_sql`, closed in SEC-1).
--   * What the chat can read is a list of views in the private schema `ai_chat` (not exposed by the Data API):
--     jobseekers, clients, positions, assignments, timesheets, invoices, with only the approved fields
--     (Abhishek, 2026-11-19): no SIN, date of birth, ID or passport numbers, bank details, documents, notes,
--     street addresses, tokens, auth tables. Individual pay rates and email/phone are in, for the roles that see
--     them in the portal.
--   * A question runs inside one function per portal role (`ai_chat_run.run_<role>`), and that function is OWNED
--     BY a database role that has SELECT on that role's views and nothing else. So the database, not a word list,
--     decides what a question can touch: a recruiter's question cannot read invoices, nobody's question can read
--     auth.users or the profile table, and no write is possible (the role holds no write privilege and the
--     transaction is read-only). The role-to-view map below mirrors client/src/constants/accessControl.ts
--     (a test compares them).
--   * Each call is refused unless the caller is staff (app_metadata, never user_metadata) and, while the flag
--     `staff_two_factor_enforced` is on, their sign-in session has a verified phone code (staff_2fa_sessions).
--   * Row cap and size cap, a per-day question count per portal (public.ai_chat_usage), and the tokens spent. Time is
--     bounded by the Data API's own statement timeout (8 s on the authenticator role in Supabase) and by the service.

-- 1. Schemas and the usage table --------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS ai_chat;      -- the approved views (private)
CREATE SCHEMA IF NOT EXISTS ai_chat_run;  -- one runner function per portal role (private)
REVOKE ALL ON SCHEMA ai_chat, ai_chat_run FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.ai_chat_usage (
  day date PRIMARY KEY,
  questions integer NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0
);
COMMENT ON TABLE public.ai_chat_usage IS
  'AI chat: questions asked and model tokens spent per day (Toronto time) in this portal. Written by public.ai_chat_claim and ai_chat_record_usage only.';
ALTER TABLE public.ai_chat_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_chat_usage FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_chat_usage TO service_role;

-- 2. The approved views -------------------------------------------------------------------------

-- Text fields that hold numbers ("$20", "18.50") as numbers; anything unreadable becomes null.
CREATE OR REPLACE FUNCTION ai_chat.to_num(v text) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog AS $$
BEGIN
  RETURN NULLIF(regexp_replace(COALESCE(v, ''), '[^0-9.]', '', 'g'), '')::numeric;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;

CREATE OR REPLACE VIEW ai_chat.jobseekers AS
SELECT
  j.id,
  j.employee_id,
  j.first_name,
  j.last_name,
  j.email,
  j.mobile,
  j.city,
  j.province,
  j.license_type,
  j.experience,
  j.work_preference,
  j.availability,
  j.weekend_availability,
  j.manual_driving,
  j.verification_status,
  j.payrate_type,
  ai_chat.to_num(j.pay_rate) AS pay_rate,
  ai_chat.to_num(j.bill_rate) AS bill_rate,
  j.overtime_enabled,
  ai_chat.to_num(j.overtime_hours) AS overtime_after_hours,
  ai_chat.to_num(j.overtime_pay_rate) AS overtime_pay_rate,
  ai_chat.to_num(j.overtime_bill_rate) AS overtime_bill_rate,
  j.created_at,
  j.last_activity_at
FROM public.jobseeker_profiles j;

CREATE OR REPLACE VIEW ai_chat.clients AS
SELECT
  c.id,
  c.company_name,
  c.short_code,
  c.list_name,
  c.website,
  c.currency,
  c.work_province,
  c.city1 AS city,
  c.province1 AS province,
  c.terms,
  c.pay_cycle,
  c.preferred_payment_method,
  c.client_manager,
  c.sales_person,
  c.accounting_person,
  c.client_rep,
  c.invoice_language,
  c.created_at,
  c.last_activity_at
FROM public.clients c
WHERE c.is_draft IS NOT TRUE;

CREATE OR REPLACE VIEW ai_chat.positions AS
SELECT
  p.id,
  p.client AS client_id,
  p.client_name,
  p.title,
  p.position_code,
  p.position_number,
  p.start_date,
  p.end_date,
  p.employment_term,
  p.employment_type,
  p.position_category,
  p.experience,
  p.payrate_type,
  p.number_of_positions,
  p.city,
  p.province,
  p.stat,
  p.is_subcategory,
  p.show_on_job_portal,
  p.documents_required,
  ai_chat.to_num(p.regular_pay_rate) AS pay_rate,
  ai_chat.to_num(p.bill_rate) AS bill_rate,
  ai_chat.to_num(p.markup) AS markup,
  p.overtime_enabled,
  ai_chat.to_num(p.overtime_hours) AS overtime_after_hours,
  ai_chat.to_num(p.overtime_pay_rate) AS overtime_pay_rate,
  ai_chat.to_num(p.overtime_bill_rate) AS overtime_bill_rate,
  ai_chat.to_num(p.premium_pay_rate) AS premium_pay_rate,
  p.created_at
FROM public.positions p
WHERE p.is_draft IS NOT TRUE;

CREATE OR REPLACE VIEW ai_chat.assignments AS
SELECT
  a.id,
  a.position_id,
  a.candidate_id AS jobseeker_id,
  a.status,
  a.start_date,
  a.end_date,
  a.created_at
FROM public.position_candidate_assignments a;

CREATE OR REPLACE VIEW ai_chat.timesheets AS
SELECT
  t.id,
  t.position_id,
  t.jobseeker_profile_id AS jobseeker_id,
  t.week_start_date,
  t.week_end_date,
  t.total_regular_hours,
  t.total_overtime_hours,
  t.is_bulk,
  t.invoice_number,
  t.regular_pay_rate,
  t.overtime_pay_rate,
  t.premium_pay_rate,
  t.regular_bill_rate,
  t.overtime_bill_rate,
  t.bonus_amount,
  t.deduction_amount,
  t.total_jobseeker_pay,
  t.total_client_bill,
  t.created_at
FROM public.timesheets t;

CREATE OR REPLACE VIEW ai_chat.invoices AS
SELECT
  i.id,
  i.client_id,
  i.invoice_number,
  i.invoice_date,
  i.due_date,
  i.status,
  i.currency,
  i.total_hours,
  i.subtotal,
  i.total_gst,
  i.total_hst,
  i.total_qst,
  i.total_tax,
  i.grand_total,
  i.email_sent,
  i.created_at
FROM public.invoices i;

-- What the model is told about each view and field. The service reads this through ai_chat_schema(), so
-- the description cannot drift from the views.
COMMENT ON VIEW ai_chat.jobseekers IS 'People who work through the agency (jobseeker profiles). Join to timesheets.jobseeker_id and assignments.jobseeker_id. Pay and bill rates are per hour, day or month as payrate_type says.';
COMMENT ON VIEW ai_chat.clients IS 'Client companies (customers). Join to positions.client_id and invoices.client_id.';
COMMENT ON VIEW ai_chat.positions IS 'Jobs a client has opened. Join to clients on client_id, to assignments and timesheets on position_id. A position is current when end_date is null or in the future.';
COMMENT ON VIEW ai_chat.assignments IS 'A jobseeker placed on a position. status is usually active, upcoming, completed or cancelled.';
COMMENT ON VIEW ai_chat.timesheets IS 'Weekly hours a jobseeker worked on a position, with pay and billing totals. Money is in the client''s currency (see clients.currency).';
COMMENT ON VIEW ai_chat.invoices IS 'Invoices sent to clients. status is draft, sent, paid and so on. Money columns are in the invoice currency.';

COMMENT ON COLUMN ai_chat.jobseekers.id IS 'Primary key.';
COMMENT ON COLUMN ai_chat.jobseekers.employee_id IS 'The agency''s own employee number.';
COMMENT ON COLUMN ai_chat.jobseekers.province IS 'Home province, as typed (full name or two letters).';
COMMENT ON COLUMN ai_chat.jobseekers.license_type IS 'Driving licence class, for example G, DZ, AZ.';
COMMENT ON COLUMN ai_chat.jobseekers.experience IS 'Years of experience as a text range.';
COMMENT ON COLUMN ai_chat.jobseekers.work_preference IS 'Preferred kind of work.';
COMMENT ON COLUMN ai_chat.jobseekers.availability IS 'Full-Time, Part-Time and similar, as text.';
COMMENT ON COLUMN ai_chat.jobseekers.verification_status IS 'pending, verified or rejected.';
COMMENT ON COLUMN ai_chat.jobseekers.pay_rate IS 'What the jobseeker is paid per payrate_type unit.';
COMMENT ON COLUMN ai_chat.jobseekers.bill_rate IS 'What the client is charged per payrate_type unit for this jobseeker.';
COMMENT ON COLUMN ai_chat.jobseekers.overtime_after_hours IS 'Weekly hours after which overtime rates apply, when overtime_enabled.';
COMMENT ON COLUMN ai_chat.jobseekers.last_activity_at IS 'Last time anything happened on this profile.';
COMMENT ON COLUMN ai_chat.clients.id IS 'Primary key.';
COMMENT ON COLUMN ai_chat.clients.short_code IS 'Up to five letters, used in invoice and position numbers.';
COMMENT ON COLUMN ai_chat.clients.currency IS 'CAD or USD.';
COMMENT ON COLUMN ai_chat.clients.work_province IS 'Two-letter province where the work is done.';
COMMENT ON COLUMN ai_chat.clients.terms IS 'Payment terms, for example Net 30.';
COMMENT ON COLUMN ai_chat.clients.client_manager IS 'Name of the agency''s manager for this client.';
COMMENT ON COLUMN ai_chat.clients.last_activity_at IS 'Last time anything happened for this client.';
COMMENT ON COLUMN ai_chat.positions.id IS 'Primary key.';
COMMENT ON COLUMN ai_chat.positions.client_id IS 'clients.id of the client who owns the position.';
COMMENT ON COLUMN ai_chat.positions.title IS 'Job title.';
COMMENT ON COLUMN ai_chat.positions.province IS 'Two-letter province of the job.';
COMMENT ON COLUMN ai_chat.positions.stat IS 'True when the position works on statutory holidays.';
COMMENT ON COLUMN ai_chat.positions.is_subcategory IS 'True for invoicing-only sub-positions; leave them out when counting real jobs.';
COMMENT ON COLUMN ai_chat.positions.pay_rate IS 'Regular pay rate per payrate_type unit.';
COMMENT ON COLUMN ai_chat.positions.bill_rate IS 'Regular bill rate per payrate_type unit.';
COMMENT ON COLUMN ai_chat.positions.markup IS 'Markup the bill rate adds over the pay rate.';
COMMENT ON COLUMN ai_chat.positions.documents_required IS 'JSON of the documents a jobseeker must provide (sin, license, passport...), each true or false.';
COMMENT ON COLUMN ai_chat.assignments.position_id IS 'positions.id.';
COMMENT ON COLUMN ai_chat.assignments.jobseeker_id IS 'jobseekers.id.';
COMMENT ON COLUMN ai_chat.timesheets.position_id IS 'positions.id (null when the position was deleted).';
COMMENT ON COLUMN ai_chat.timesheets.jobseeker_id IS 'jobseekers.id.';
COMMENT ON COLUMN ai_chat.timesheets.week_start_date IS 'First day of the week the hours were worked.';
COMMENT ON COLUMN ai_chat.timesheets.is_bulk IS 'True when one timesheet covers several positions.';
COMMENT ON COLUMN ai_chat.timesheets.invoice_number IS 'invoices.invoice_number once the timesheet is invoiced, otherwise null.';
COMMENT ON COLUMN ai_chat.timesheets.total_jobseeker_pay IS 'What the jobseeker is paid for the week.';
COMMENT ON COLUMN ai_chat.timesheets.total_client_bill IS 'What the client is billed for the week.';
COMMENT ON COLUMN ai_chat.invoices.client_id IS 'clients.id.';
COMMENT ON COLUMN ai_chat.invoices.grand_total IS 'Subtotal plus tax.';

-- 3. Who may read which view: one database role per portal role -----------------------------------
-- Mirrors client/src/constants/accessControl.ts (JOBSEEKER_LIST_ROLES, CLIENT_LIST_ROLES, POSITION_LIST_ROLES,
-- TIMESHEET_MANAGEMENT_ROLES, INVOICE_MANAGEMENT_ROLES; assignments need both jobseekers and positions).
-- A user with several roles gets the role among theirs that sees the most (never a mix).

CREATE OR REPLACE FUNCTION ai_chat.entities_for(portal_role text) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT CASE portal_role
    WHEN 'admin'              THEN ARRAY['jobseekers','clients','positions','assignments','timesheets','invoices']
    WHEN 'recruiter'          THEN ARRAY['jobseekers','positions','assignments','timesheets']
    WHEN 'bookkeeper'         THEN ARRAY['jobseekers','positions','assignments','timesheets','invoices']
    WHEN 'recruiter_manager'  THEN ARRAY['jobseekers','clients','positions','assignments','timesheets']
    WHEN 'accountant_manager' THEN ARRAY['jobseekers','clients','positions','assignments','invoices']
    WHEN 'sales'              THEN ARRAY['clients','positions']
    WHEN 'recruiter_director' THEN ARRAY['jobseekers','clients','positions','assignments','timesheets']
    ELSE ARRAY[]::text[]
  END
$$;

DO $$
DECLARE
  r text;
  e text;
  rolename text;
  fname text;
BEGIN
  FOREACH r IN ARRAY ARRAY['admin','recruiter','bookkeeper','recruiter_manager','accountant_manager','sales','recruiter_director'] LOOP
    rolename := 'ai_chat_role_' || r;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rolename) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOBYPASSRLS', rolename);
    END IF;
    -- the migration role has to be able to hand the role a function (ALTER ... OWNER TO below): Postgres 16 and
    -- later need WITH SET TRUE, earlier versions have no such option
    BEGIN
      EXECUTE format('GRANT %I TO CURRENT_USER WITH SET TRUE', rolename);
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        EXECUTE format('GRANT %I TO CURRENT_USER', rolename);
      EXCEPTION WHEN OTHERS THEN
        NULL; -- already a member
      END;
    END;

    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA ai_chat FROM %I', rolename);
    EXECUTE format('GRANT USAGE ON SCHEMA ai_chat TO %I', rolename);
    FOREACH e IN ARRAY ai_chat.entities_for(r) LOOP
      EXECUTE format('GRANT SELECT ON ai_chat.%I TO %I', e, rolename);
    END LOOP;

    -- The runner: owned by the role above, so everything inside it runs with that role's privileges only.
    fname := 'run_' || r;
    EXECUTE format($f$
      CREATE OR REPLACE FUNCTION ai_chat_run.%I(q text, cap integer) RETURNS jsonb
      LANGUAGE plpgsql SECURITY DEFINER
      SET search_path = ai_chat, pg_catalog
      AS $body$
      DECLARE
        result jsonb;
        wrapped text;
        plan jsonb;
      BEGIN
        PERFORM set_config('transaction_read_only', 'on', true);
        wrapped := 'SELECT * FROM (' || chr(10) || q || chr(10) || ') AS q0 LIMIT ' || (cap + 1)::text;
        -- Everything the database lets this role read through PUBLIC (Supabase's pg_net tables, the catalogs) is
        -- refused too: after the views are expanded, every table the plan scans must be in public or ai_chat.
        EXECUTE 'EXPLAIN (FORMAT JSON, VERBOSE) ' || wrapped INTO plan;
        IF EXISTS (SELECT 1 FROM jsonb_path_query(plan, 'lax $.**?(exists(@."Relation Name")).Schema') AS s(v) WHERE (s.v #>> '{}') NOT IN ('ai_chat', 'public')) THEN
          RETURN jsonb_build_object('ok', false, 'error', 'AI_CHAT_FORBIDDEN_RELATION', 'message', 'Only the chat views can be read.');
        END IF;
        EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) FROM (' || wrapped || ') AS r' INTO result;
        IF pg_column_size(result) > 400000 THEN
          RETURN jsonb_build_object('ok', false, 'error', 'AI_CHAT_TOO_MUCH_DATA', 'message', 'The answer is too large; ask for fewer rows or columns.');
        END IF;
        IF jsonb_array_length(result) > cap THEN
          RETURN jsonb_build_object('ok', true, 'truncated', true,
            'rows', (SELECT jsonb_agg(x) FROM (SELECT x FROM jsonb_array_elements(result) WITH ORDINALITY AS t(x, n) ORDER BY n LIMIT cap) s));
        END IF;
        RETURN jsonb_build_object('ok', true, 'truncated', false, 'rows', result);
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('ok', false, 'error', SQLSTATE, 'message', left(SQLERRM, 300));
      END
      $body$
    $f$, fname);
    EXECUTE format('REVOKE ALL ON FUNCTION ai_chat_run.%I(text, integer) FROM PUBLIC, anon, authenticated', fname);
    EXECUTE format('GRANT USAGE ON SCHEMA ai_chat_run TO %I', rolename);
    EXECUTE format('GRANT CREATE ON SCHEMA ai_chat_run TO %I', rolename);
    EXECUTE format('ALTER FUNCTION ai_chat_run.%I(text, integer) OWNER TO %I', fname, rolename);
    EXECUTE format('REVOKE CREATE, USAGE ON SCHEMA ai_chat_run FROM %I', rolename);  -- no runner can call a runner
  END LOOP;
END $$;

-- 4. Who is asking ----------------------------------------------------------------------------------------

-- Returns the portal role the caller's questions run as, or raises. Reads auth.users, not the token's claims, so
-- a role taken away is gone at once. SQLSTATE 'P0001' with a stable message code the service maps to a refusal.
CREATE OR REPLACE FUNCTION ai_chat.caller_role() RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  uid uuid := auth.uid();
  app jsonb;
  utype text;
  roles text[] := ARRAY[]::text[];
  rl text;
  best text := NULL;
  best_n integer := -1;
  enforced boolean;
  session uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'AI_CHAT_NO_SESSION';
  END IF;
  SELECT u.raw_app_meta_data INTO app FROM auth.users u WHERE u.id = uid;
  utype := app ->> 'user_type';
  IF utype NOT IN ('admin', 'recruiter') THEN
    RAISE EXCEPTION 'AI_CHAT_NOT_STAFF';
  END IF;

  -- same rule as client/src/lib/auth.ts: an admin is admin; a recruiter holds the roles listed in
  -- user_role (legacy names mapped), or plain "recruiter" when none is listed
  IF utype = 'admin' THEN
    roles := ARRAY['admin'];
  ELSE
    IF jsonb_typeof(app -> 'user_role') = 'array' THEN
      SELECT COALESCE(array_agg(DISTINCT CASE v WHEN 'manager' THEN 'recruiter_manager' WHEN 'accountant' THEN 'bookkeeper' ELSE v END), ARRAY[]::text[])
        INTO roles
        FROM jsonb_array_elements_text(app -> 'user_role') AS t(v)
        WHERE v IN ('recruiter','bookkeeper','recruiter_manager','accountant_manager','sales','recruiter_director','manager','accountant');
    END IF;
    IF cardinality(roles) = 0 THEN
      roles := ARRAY['recruiter'];
    END IF;
  END IF;

  -- two-step login: while enforced (the flag defaults to on; no row means on), this sign-in session must have
  -- a verified phone code that is at most 90 days old (the same rule as server/src/services/staffTwoFactor.ts)
  SELECT COALESCE((SELECT f.enabled FROM public.feature_flags f WHERE f.key = 'staff_two_factor_enforced'), true) INTO enforced;
  IF enforced THEN
    BEGIN
      session := (auth.jwt() ->> 'session_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      session := NULL;
    END;
    IF session IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.staff_2fa_sessions s
      WHERE s.session_id = session AND s.user_id = uid AND s.verified_at > now() - interval '90 days'
    ) THEN
      RAISE EXCEPTION 'AI_CHAT_TWO_FACTOR_REQUIRED';
    END IF;
  END IF;

  FOREACH rl IN ARRAY roles LOOP
    IF cardinality(ai_chat.entities_for(rl)) > best_n THEN
      best := rl;
      best_n := cardinality(ai_chat.entities_for(rl));
    END IF;
  END LOOP;
  IF best IS NULL OR best_n < 1 THEN
    RAISE EXCEPTION 'AI_CHAT_NO_ACCESS';
  END IF;
  RETURN best;
END $$;
REVOKE ALL ON FUNCTION ai_chat.caller_role() FROM PUBLIC, anon, authenticated;

-- 5. What the service calls (all four need the caller's own token) ---------------------------------------

-- The views the caller's role may read, with the field descriptions, for the model's prompt.
CREATE OR REPLACE FUNCTION public.ai_chat_schema() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  r text := ai_chat.caller_role();
BEGIN
  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'name', c.relname,
      'comment', obj_description(c.oid, 'pg_class'),
      'columns', (
        SELECT jsonb_agg(jsonb_build_object(
          'name', a.attname,
          'type', format_type(a.atttypid, a.atttypmod),
          'comment', col_description(c.oid, a.attnum)
        ) ORDER BY a.attnum)
        FROM pg_attribute a
        WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
      )
    ) ORDER BY c.relname), '[]'::jsonb)
    FROM pg_class c
    WHERE c.relnamespace = 'ai_chat'::regnamespace AND c.relkind = 'v'
      AND c.relname = ANY (ai_chat.entities_for(r))
  );
END $$;

-- Runs one SELECT as the caller's role. Always answers jsonb: {ok, rows, truncated} or {ok:false, error, message}.
CREATE OR REPLACE FUNCTION public.ai_chat_run(query text, row_cap integer DEFAULT 200) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  r text := ai_chat.caller_role();
  result jsonb;
BEGIN
  IF query IS NULL OR btrim(query) = '' OR length(query) > 6000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'AI_CHAT_BAD_QUERY', 'message', 'Empty or too long.');
  END IF;
  EXECUTE format('SELECT ai_chat_run.%I($1, $2)', 'run_' || r)
    INTO result USING query, LEAST(GREATEST(COALESCE(row_cap, 200), 1), 500);
  RETURN result;
END $$;

-- Counts one question against today's limit. {allowed, used}. Nothing is spent when the limit is reached.
CREATE OR REPLACE FUNCTION public.ai_chat_claim(daily_limit integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  r text := ai_chat.caller_role();
  d date := (now() AT TIME ZONE 'America/Toronto')::date;
  used integer;
BEGIN
  INSERT INTO public.ai_chat_usage AS u (day, questions) VALUES (d, 1)
  ON CONFLICT (day) DO UPDATE SET questions = u.questions + 1 WHERE u.questions < GREATEST(daily_limit, 0)
  RETURNING u.questions INTO used;
  IF used IS NULL THEN
    SELECT questions INTO used FROM public.ai_chat_usage WHERE day = d;
    RETURN jsonb_build_object('allowed', false, 'used', COALESCE(used, 0));
  END IF;
  RETURN jsonb_build_object('allowed', true, 'used', used);
END $$;

-- Adds the model tokens a question used to today's row.
CREATE OR REPLACE FUNCTION public.ai_chat_record_usage(tokens_in integer, tokens_out integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  r text := ai_chat.caller_role();
  d date := (now() AT TIME ZONE 'America/Toronto')::date;
BEGIN
  INSERT INTO public.ai_chat_usage AS u (day, questions, input_tokens, output_tokens)
  VALUES (d, 0, GREATEST(tokens_in, 0), GREATEST(tokens_out, 0))
  ON CONFLICT (day) DO UPDATE
    SET input_tokens = u.input_tokens + GREATEST(tokens_in, 0),
        output_tokens = u.output_tokens + GREATEST(tokens_out, 0);
END $$;

REVOKE ALL ON FUNCTION public.ai_chat_schema() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ai_chat_run(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ai_chat_claim(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ai_chat_record_usage(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_chat_schema() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_chat_run(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_chat_claim(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ai_chat_record_usage(integer, integer) TO authenticated;
