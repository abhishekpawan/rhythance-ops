-- ============================================================================
-- Verification Script: Support Module
-- Target: Supabase Postgres (public schema)
-- Description:
--   1. Read-only configuration checks as ONE query (UNION ALL) returning
--      rows of (check_name, result).
--   2. Transactional test block (wrapped in BEGIN ... ROLLBACK) executing all
--      assertions, followed by:
--      SELECT 'ALL TRANSACTIONAL TESTS PASSED' AS result;
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PART 1: READ-ONLY CONFIGURATION CHECKS (SINGLE UNION ALL QUERY)
-- ----------------------------------------------------------------------------

-- Check 1: RLS enabled on each of the 4 tables
SELECT
  'rls_enabled:' || t.tbl AS check_name,
  CASE
    WHEN pt.tablename IS NULL THEN 'FAIL: table does not exist'
    WHEN pt.rowsecurity = true THEN 'PASS'
    ELSE 'FAIL: RLS is disabled'
  END AS result
FROM (
  VALUES
    ('support_tickets'),
    ('support_ticket_messages'),
    ('support_ticket_attachments'),
    ('support_ticket_status_events')
) AS t(tbl)
LEFT JOIN pg_tables pt ON pt.schemaname = 'public' AND pt.tablename = t.tbl

UNION ALL

-- Check 2: Zero policies on each of the 4 tables
SELECT
  'zero_policies:' || t.tbl AS check_name,
  CASE
    WHEN COUNT(p.policyname) = 0 THEN 'PASS'
    ELSE 'FAIL: policies exist on table (' || COUNT(p.policyname)::text || ')'
  END AS result
FROM (
  VALUES
    ('support_tickets'),
    ('support_ticket_messages'),
    ('support_ticket_attachments'),
    ('support_ticket_status_events')
) AS t(tbl)
LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = t.tbl
GROUP BY t.tbl

UNION ALL

-- Check 3: anon and authenticated have no privilege on each table
SELECT
  'no_table_privilege_anon_auth:' || t.tbl AS check_name,
  CASE
    WHEN NOT has_table_privilege('anon', 'public.' || t.tbl, 'SELECT,INSERT,UPDATE,DELETE')
     AND NOT has_table_privilege('authenticated', 'public.' || t.tbl, 'SELECT,INSERT,UPDATE,DELETE')
    THEN 'PASS'
    ELSE 'FAIL: unexpected table privilege granted to anon or authenticated'
  END AS result
FROM (
  VALUES
    ('support_tickets'),
    ('support_ticket_messages'),
    ('support_ticket_attachments'),
    ('support_ticket_status_events')
) AS t(tbl)

UNION ALL

-- Check 4: anon and authenticated have no privilege on the sequence
SELECT
  'no_sequence_privilege_anon_auth:support_ticket_number_seq' AS check_name,
  CASE
    WHEN NOT has_sequence_privilege('anon', 'public.support_ticket_number_seq', 'USAGE,SELECT,UPDATE')
     AND NOT has_sequence_privilege('authenticated', 'public.support_ticket_number_seq', 'USAGE,SELECT,UPDATE')
    THEN 'PASS'
    ELSE 'FAIL: unexpected sequence privilege granted to anon or authenticated'
  END AS result

UNION ALL

-- Check 5: anon and authenticated cannot EXECUTE any of the 5 support functions; service_role can EXECUTE all 5
SELECT
  'function_privilege:' || fn.fn_name AS check_name,
  CASE
    WHEN NOT has_function_privilege('anon', fn.fn_sig, 'EXECUTE')
     AND NOT has_function_privilege('authenticated', fn.fn_sig, 'EXECUTE')
     AND has_function_privilege('service_role', fn.fn_sig, 'EXECUTE')
    THEN 'PASS'
    ELSE 'FAIL: invalid execute permissions for anon, authenticated, or service_role'
  END AS result
FROM (
  VALUES
    ('support_create_ticket', 'public.support_create_ticket(uuid, text, text, text[], text, text, text, text, text, text, text, jsonb, text, uuid)'),
    ('support_change_status', 'public.support_change_status(uuid, text, uuid, text, integer)'),
    ('support_add_message', 'public.support_add_message(uuid, uuid, text, text, text, boolean)'),
    ('support_elapsed_minutes', 'public.support_elapsed_minutes(uuid)'),
    ('support_auto_close_resolved', 'public.support_auto_close_resolved()')
) AS fn(fn_name, fn_sig)

UNION ALL

-- Check 6: Bucket exists, public = false, file_size_limit = 10485760
SELECT
  'storage_bucket:support-attachments' AS check_name,
  CASE
    WHEN b.id IS NULL THEN 'FAIL: bucket does not exist'
    WHEN b.public = false AND b.file_size_limit = 10485760 THEN 'PASS'
    ELSE 'FAIL: bucket public=' || COALESCE(b.public::text, 'null') || ' file_size_limit=' || COALESCE(b.file_size_limit::text, 'null')
  END AS result
FROM (SELECT 1) AS dummy
LEFT JOIN storage.buckets b ON b.id = 'support-attachments'

UNION ALL

-- Check 7: Cron job 'support-auto-close' exists with schedule '30 3 * * *'
SELECT
  'cron_job:support-auto-close' AS check_name,
  CASE
    WHEN j.jobname IS NULL THEN 'FAIL: cron job does not exist'
    WHEN j.schedule = '30 3 * * *' THEN 'PASS'
    ELSE 'FAIL: cron job schedule is ' || COALESCE(j.schedule, 'null') || ', expected 30 3 * * *'
  END AS result
FROM (SELECT 1) AS dummy
LEFT JOIN (
  SELECT jobname, schedule
  FROM cron.job
  WHERE jobname = 'support-auto-close'
  LIMIT 1
) j ON true;


-- ----------------------------------------------------------------------------
-- PART 2: TRANSACTIONAL TEST BLOCK (ROLLED BACK AUTOMATICALLY)
-- ----------------------------------------------------------------------------

BEGIN;

DO $$
DECLARE
  v_idem_key uuid := gen_random_uuid();
  v_test_idem_key uuid;
  v_auth_user_id uuid;
  v_ticket1 public.support_tickets;
  v_ticket2 public.support_tickets;
  v_ticket_updated public.support_tickets;
  v_timing_ticket public.support_tickets;
  v_msg_ticket public.support_tickets;
  v_test_message public.support_ticket_messages;
  v_elapsed integer;
  v_invalid_caught boolean := false;
  v_caught_exception boolean := false;
  v_messages_count integer;
  v_events_count integer;
  v_check_status text;
  v_count_check integer;
BEGIN
  RAISE NOTICE '=== Starting Support Module Transactional Verification ===';

  -- 1. Create a ticket with support_create_ticket (requester_id null)
  v_ticket1 := public.support_create_ticket(
    p_requester_id => NULL,
    p_requester_name => 'Verification Script User',
    p_requester_email => 'verify@godspeedops.local',
    p_requester_roles => ARRAY['admin']::text[],
    p_type => 'bug',
    p_area_key => 'client_management',
    p_area_label => 'Client Management',
    p_page_url => '/client-management',
    p_title => 'Verification Script Test Ticket',
    p_description => 'Initial issue body created by verification test.',
    p_urgency => 'blocked',
    p_context => '{"environment": "verification"}'::jsonb,
    p_locale => 'en',
    p_idempotency_key => v_idem_key
  );

  IF v_ticket1.id IS NULL THEN
    RAISE EXCEPTION 'TEST FAILED: support_create_ticket returned null id';
  END IF;

  IF v_ticket1.status <> 'open' THEN
    RAISE EXCEPTION 'TEST FAILED: Expected initial status open, got %', v_ticket1.status;
  END IF;

  IF v_ticket1.priority <> 'p1' THEN
    RAISE EXCEPTION 'TEST FAILED: Expected priority p1 for urgency blocked, got %', v_ticket1.priority;
  END IF;

  -- Confirm first message and initial status event were inserted
  SELECT COUNT(*) INTO v_messages_count
  FROM public.support_ticket_messages
  WHERE ticket_id = v_ticket1.id;

  IF v_messages_count <> 1 THEN
    RAISE EXCEPTION 'TEST FAILED: Expected 1 initial message, found %', v_messages_count;
  END IF;

  SELECT COUNT(*) INTO v_events_count
  FROM public.support_ticket_status_events
  WHERE ticket_id = v_ticket1.id;

  IF v_events_count <> 1 THEN
    RAISE EXCEPTION 'TEST FAILED: Expected 1 initial status event, found %', v_events_count;
  END IF;

  RAISE NOTICE 'Assertion 1 Passed: support_create_ticket created ticket #% with message and event', v_ticket1.ticket_number;

  -- 2. Call again with same idempotency_key and same requester (NULL) -> confirm same ticket returned unchanged
  v_ticket2 := public.support_create_ticket(
    p_requester_id => NULL,
    p_requester_name => 'Different User',
    p_requester_email => 'different@example.com',
    p_requester_roles => ARRAY['recruiter']::text[],
    p_type => 'feature',
    p_area_key => 'finance',
    p_area_label => 'Finance',
    p_page_url => '/invoices',
    p_title => 'Different Title That Must Not Overwrite',
    p_description => 'Second description attempt',
    p_urgency => 'not_urgent',
    p_context => '{}'::jsonb,
    p_locale => 'fr',
    p_idempotency_key => v_idem_key
  );

  IF v_ticket2.id <> v_ticket1.id OR v_ticket2.title <> v_ticket1.title THEN
    RAISE EXCEPTION 'TEST FAILED: Idempotency failed. Expected ticket id %, got %', v_ticket1.id, v_ticket2.id;
  END IF;

  RAISE NOTICE 'Assertion 2 Passed: Idempotency confirmed (same ticket returned unchanged)';

  -- 3. Move open -> in_progress -> resolved -> closed through support_change_status
  -- 3a. open -> in_progress
  v_ticket_updated := public.support_change_status(
    p_ticket_id => v_ticket1.id,
    p_to_status => 'in_progress',
    p_actor_id => NULL,
    p_actor_kind => 'agent'
  );

  IF v_ticket_updated.status <> 'in_progress' THEN
    RAISE EXCEPTION 'TEST FAILED: Expected status in_progress, got %', v_ticket_updated.status;
  END IF;

  -- 3b. in_progress -> resolved (with effort_minutes)
  v_ticket_updated := public.support_change_status(
    p_ticket_id => v_ticket1.id,
    p_to_status => 'resolved',
    p_actor_id => NULL,
    p_actor_kind => 'agent',
    p_effort_minutes => 45
  );

  IF v_ticket_updated.status <> 'resolved' OR v_ticket_updated.resolved_at IS NULL OR v_ticket_updated.effort_minutes <> 45 THEN
    RAISE EXCEPTION 'TEST FAILED: Transition to resolved failed or fields not populated';
  END IF;

  -- 3c. resolved -> closed (system actor should set confirmed_by = 'auto')
  v_ticket_updated := public.support_change_status(
    p_ticket_id => v_ticket1.id,
    p_to_status => 'closed',
    p_actor_id => NULL,
    p_actor_kind => 'system'
  );

  IF v_ticket_updated.status <> 'closed' OR v_ticket_updated.closed_at IS NULL OR v_ticket_updated.confirmed_by <> 'auto' THEN
    RAISE EXCEPTION 'TEST FAILED: Transition to closed failed or confirmed_by was not auto';
  END IF;

  RAISE NOTICE 'Assertion 3 Passed: Valid status flow (open -> in_progress -> resolved -> closed)';

  -- 4. Reopen to in_progress, transition to resolved, then test invalid transition (resolved -> open)
  v_ticket_updated := public.support_change_status(
    p_ticket_id => v_ticket1.id,
    p_to_status => 'in_progress',
    p_actor_id => NULL,
    p_actor_kind => 'agent'
  );

  IF v_ticket_updated.resolved_at IS NOT NULL OR v_ticket_updated.closed_at IS NOT NULL OR v_ticket_updated.confirmed_by IS NOT NULL THEN
    RAISE EXCEPTION 'TEST FAILED: Reopen to in_progress did not reset resolved_at, closed_at, confirmed_by to null';
  END IF;

  v_ticket_updated := public.support_change_status(
    p_ticket_id => v_ticket1.id,
    p_to_status => 'resolved',
    p_actor_id => NULL,
    p_actor_kind => 'agent'
  );

  BEGIN
    PERFORM public.support_change_status(
      p_ticket_id => v_ticket1.id,
      p_to_status => 'open',
      p_actor_id => NULL,
      p_actor_kind => 'agent'
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE 'INVALID_TRANSITION:%' THEN
        v_invalid_caught := true;
      ELSE
        RAISE EXCEPTION 'TEST FAILED: Expected error starting with INVALID_TRANSITION:, got: %', SQLERRM;
      END IF;
  END;

  IF NOT v_invalid_caught THEN
    RAISE EXCEPTION 'TEST FAILED: Transition from resolved to open did not raise INVALID_TRANSITION';
  END IF;

  RAISE NOTICE 'Assertion 4 Passed: Invalid transition correctly rejected with INVALID_TRANSITION';

  -- 5. Check support_elapsed_minutes returns >= 0
  v_elapsed := public.support_elapsed_minutes(v_ticket1.id);

  IF v_elapsed IS NULL OR v_elapsed < 0 THEN
    RAISE EXCEPTION 'TEST FAILED: support_elapsed_minutes returned invalid value %', v_elapsed;
  END IF;

  RAISE NOTICE 'Assertion 5 Passed: support_elapsed_minutes returned % minutes', v_elapsed;

  -- 6. IDEMPOTENCY_CONFLICT assertion (auth.users requester check)
  SELECT id INTO v_auth_user_id FROM auth.users LIMIT 1;
  IF v_auth_user_id IS NOT NULL THEN
    v_test_idem_key := gen_random_uuid();
    -- Create ticket with real user id as requester
    PERFORM public.support_create_ticket(
      p_requester_id => v_auth_user_id,
      p_requester_name => 'Existing User',
      p_requester_email => 'user@example.com',
      p_requester_roles => ARRAY['admin']::text[],
      p_type => 'bug',
      p_area_key => 'auth_test',
      p_area_label => 'Auth Test',
      p_page_url => '/auth-test',
      p_title => 'Idempotency Conflict Test',
      p_description => 'Initial ticket description',
      p_urgency => 'not_urgent',
      p_context => '{}'::jsonb,
      p_locale => 'en',
      p_idempotency_key => v_test_idem_key
    );

    v_caught_exception := false;
    BEGIN
      -- Call again with the same idempotency key but requester_id NULL
      PERFORM public.support_create_ticket(
        p_requester_id => NULL,
        p_requester_name => 'Different User',
        p_requester_email => 'other@example.com',
        p_requester_roles => ARRAY['admin']::text[],
        p_type => 'bug',
        p_area_key => 'auth_test',
        p_area_label => 'Auth Test',
        p_page_url => '/auth-test',
        p_title => 'Conflict Attempt',
        p_description => 'Conflict description',
        p_urgency => 'not_urgent',
        p_context => '{}'::jsonb,
        p_locale => 'en',
        p_idempotency_key => v_test_idem_key
      );
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLERRM LIKE 'IDEMPOTENCY_CONFLICT:%' THEN
          v_caught_exception := true;
        ELSE
          RAISE EXCEPTION 'TEST FAILED: Expected IDEMPOTENCY_CONFLICT, got: %', SQLERRM;
        END IF;
    END;

    IF NOT v_caught_exception THEN
      RAISE EXCEPTION 'TEST FAILED: Calling support_create_ticket with different requester did not raise IDEMPOTENCY_CONFLICT';
    END IF;

    RAISE NOTICE 'Assertion 6 Passed: IDEMPOTENCY_CONFLICT raised when requester_id differs';
  ELSE
    RAISE NOTICE 'Assertion 6 Skipped: No users found in auth.users; skipping IDEMPOTENCY_CONFLICT test';
  END IF;

  -- 7. Elapsed time exclusion test
  v_timing_ticket := public.support_create_ticket(
    p_requester_id => NULL,
    p_requester_name => 'Timing User',
    p_requester_email => 'timing@example.com',
    p_requester_roles => '{}'::text[],
    p_type => 'bug',
    p_area_key => 'timing',
    p_area_label => 'Timing',
    p_page_url => '/timing',
    p_title => 'Timing Test Ticket',
    p_description => 'Elapsed time verification',
    p_urgency => 'not_urgent',
    p_context => '{}'::jsonb,
    p_locale => 'en',
    p_idempotency_key => gen_random_uuid()
  );

  DELETE FROM public.support_ticket_status_events
  WHERE ticket_id = v_timing_ticket.id;

  INSERT INTO public.support_ticket_status_events (
    ticket_id,
    from_status,
    to_status,
    created_at
  ) VALUES
    (v_timing_ticket.id, NULL, 'open', now() - interval '100 minutes'),
    (v_timing_ticket.id, 'open', 'in_progress', now() - interval '90 minutes'),
    (v_timing_ticket.id, 'in_progress', 'waiting_on_client', now() - interval '60 minutes'),
    (v_timing_ticket.id, 'waiting_on_client', 'in_progress', now() - interval '30 minutes'),
    (v_timing_ticket.id, 'in_progress', 'resolved', now() - interval '10 minutes');

  v_elapsed := public.support_elapsed_minutes(v_timing_ticket.id);

  IF v_elapsed < 59 OR v_elapsed > 61 THEN
    RAISE EXCEPTION 'TEST FAILED: Expected elapsed minutes ~60 (+/- 1), got %', v_elapsed;
  END IF;

  RAISE NOTICE 'Assertion 7 Passed: support_elapsed_minutes correctly calculated % minutes (expected ~60)', v_elapsed;

  -- 8. support_add_message tests
  -- 8a. Requester reply on waiting_on_client ticket moves it to in_progress
  v_msg_ticket := public.support_create_ticket(
    p_requester_id => NULL,
    p_requester_name => 'Message Test User',
    p_requester_email => 'msg@example.com',
    p_requester_roles => '{}'::text[],
    p_type => 'question',
    p_area_key => 'help',
    p_area_label => 'Help',
    p_page_url => '/help',
    p_title => 'Message Flow Ticket',
    p_description => 'Initial question',
    p_urgency => 'not_urgent',
    p_context => '{}'::jsonb,
    p_locale => 'en',
    p_idempotency_key => gen_random_uuid()
  );

  -- Transition open -> waiting_on_client
  PERFORM public.support_change_status(
    p_ticket_id => v_msg_ticket.id,
    p_to_status => 'waiting_on_client',
    p_actor_id => NULL,
    p_actor_kind => 'agent'
  );

  -- Requester replies
  v_test_message := public.support_add_message(
    p_ticket_id => v_msg_ticket.id,
    p_author_id => NULL,
    p_author_name => 'Message Test User',
    p_author_kind => 'requester',
    p_body => 'Here is the requested information.',
    p_is_internal => false
  );

  SELECT status INTO v_check_status
  FROM public.support_tickets
  WHERE id = v_msg_ticket.id;

  IF v_check_status <> 'in_progress' THEN
    RAISE EXCEPTION 'TEST FAILED: Requester reply on waiting_on_client did not move status to in_progress (got %)', v_check_status;
  END IF;

  RAISE NOTICE 'Assertion 8a Passed: Requester reply moved waiting_on_client -> in_progress';

  -- 8b. Requester reply on resolved ticket moves it to in_progress
  PERFORM public.support_change_status(
    p_ticket_id => v_msg_ticket.id,
    p_to_status => 'resolved',
    p_actor_id => NULL,
    p_actor_kind => 'agent'
  );

  v_test_message := public.support_add_message(
    p_ticket_id => v_msg_ticket.id,
    p_author_id => NULL,
    p_author_name => 'Message Test User',
    p_author_kind => 'requester',
    p_body => 'This is still not working for me.',
    p_is_internal => false
  );

  SELECT status INTO v_check_status
  FROM public.support_tickets
  WHERE id = v_msg_ticket.id;

  IF v_check_status <> 'in_progress' THEN
    RAISE EXCEPTION 'TEST FAILED: Requester reply on resolved did not move status to in_progress (got %)', v_check_status;
  END IF;

  RAISE NOTICE 'Assertion 8b Passed: Requester reply moved resolved -> in_progress';

  -- 8c. Agent internal note does NOT change the status
  PERFORM public.support_change_status(
    p_ticket_id => v_msg_ticket.id,
    p_to_status => 'waiting_on_client',
    p_actor_id => NULL,
    p_actor_kind => 'agent'
  );

  v_test_message := public.support_add_message(
    p_ticket_id => v_msg_ticket.id,
    p_author_id => NULL,
    p_author_name => 'Agent Smith',
    p_author_kind => 'agent',
    p_body => 'Internal agent inspection note.',
    p_is_internal => true
  );

  SELECT status INTO v_check_status
  FROM public.support_tickets
  WHERE id = v_msg_ticket.id;

  IF v_check_status <> 'waiting_on_client' THEN
    RAISE EXCEPTION 'TEST FAILED: Agent internal note changed ticket status from waiting_on_client to %', v_check_status;
  END IF;

  RAISE NOTICE 'Assertion 8c Passed: Agent internal note did not change status';

  -- 8d. Internal note from a requester raises INTERNAL_NOT_ALLOWED
  v_caught_exception := false;
  BEGIN
    PERFORM public.support_add_message(
      p_ticket_id => v_msg_ticket.id,
      p_author_id => NULL,
      p_author_name => 'Requester Hacker',
      p_author_kind => 'requester',
      p_body => 'Attempting to create internal note as requester',
      p_is_internal => true
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE 'INTERNAL_NOT_ALLOWED:%' THEN
        v_caught_exception := true;
      ELSE
        RAISE EXCEPTION 'TEST FAILED: Expected INTERNAL_NOT_ALLOWED, got: %', SQLERRM;
      END IF;
  END;

  IF NOT v_caught_exception THEN
    RAISE EXCEPTION 'TEST FAILED: Requester creating internal note did not raise INTERNAL_NOT_ALLOWED';
  END IF;

  RAISE NOTICE 'Assertion 8d Passed: Requester internal note raised INTERNAL_NOT_ALLOWED';

  -- 8e. Requester reply on a ticket closed more than 14 days ago raises REOPEN_WINDOW_EXPIRED
  PERFORM public.support_change_status(
    p_ticket_id => v_msg_ticket.id,
    p_to_status => 'resolved',
    p_actor_id => NULL,
    p_actor_kind => 'agent'
  );

  PERFORM public.support_change_status(
    p_ticket_id => v_msg_ticket.id,
    p_to_status => 'closed',
    p_actor_id => NULL,
    p_actor_kind => 'system'
  );

  -- Backdate closed_at to 15 days ago
  UPDATE public.support_tickets
  SET closed_at = now() - interval '15 days'
  WHERE id = v_msg_ticket.id;

  v_caught_exception := false;
  BEGIN
    PERFORM public.support_add_message(
      p_ticket_id => v_msg_ticket.id,
      p_author_id => NULL,
      p_author_name => 'Message Test User',
      p_author_kind => 'requester',
      p_body => 'Trying to reply to expired closed ticket',
      p_is_internal => false
    );
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE 'REOPEN_WINDOW_EXPIRED:%' THEN
        v_caught_exception := true;
      ELSE
        RAISE EXCEPTION 'TEST FAILED: Expected REOPEN_WINDOW_EXPIRED, got: %', SQLERRM;
      END IF;
  END;

  IF NOT v_caught_exception THEN
    RAISE EXCEPTION 'TEST FAILED: Requester reply on expired closed ticket did not raise REOPEN_WINDOW_EXPIRED';
  END IF;

  -- Verify message was not inserted
  SELECT COUNT(*) INTO v_count_check
  FROM public.support_ticket_messages
  WHERE ticket_id = v_msg_ticket.id
    AND body = 'Trying to reply to expired closed ticket';

  IF v_count_check <> 0 THEN
    RAISE EXCEPTION 'TEST FAILED: Message was inserted despite REOPEN_WINDOW_EXPIRED';
  END IF;

  RAISE NOTICE 'Assertion 8e Passed: Requester reply on expired closed ticket raised REOPEN_WINDOW_EXPIRED and message was not created';
  RAISE NOTICE '=== All transactional verification assertions PASSED ===';
END $$;

ROLLBACK;

SELECT 'ALL TRANSACTIONAL TESTS PASSED' AS result;
