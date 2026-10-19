-- ============================================================================
-- Migration: Support Module (Ticketing, Messages, Attachments, Status Events)
-- Target: Supabase Postgres (public schema)
-- Idempotent: Yes
-- Naming Convention: 027_support_module.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SEQUENCE
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.support_ticket_number_seq
  INCREMENT BY 1
  MINVALUE 1
  START WITH 1;

-- ----------------------------------------------------------------------------
-- 2. TABLES
-- ----------------------------------------------------------------------------

-- Table: support_tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number integer NOT NULL UNIQUE DEFAULT nextval('public.support_ticket_number_seq'),
  idempotency_key uuid NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('bug', 'change', 'feature', 'question')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  urgency text NOT NULL CHECK (urgency IN ('blocked', 'annoying', 'not_urgent')),
  priority text NOT NULL DEFAULT 'p3' CHECK (priority IN ('p1', 'p2', 'p3')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_on_client', 'resolved', 'closed')),
  assigned_to uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  requester_roles text[] NOT NULL DEFAULT '{}'::text[],
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  locale text NOT NULL DEFAULT 'en',
  related_ticket_id uuid NULL REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  effort_minutes integer NULL CHECK (effort_minutes >= 0),
  resolved_at timestamptz NULL,
  closed_at timestamptz NULL,
  confirmed_by text NULL CHECK (confirmed_by IN ('client', 'auto', 'agent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: support_ticket_messages
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  author_kind text NOT NULL CHECK (author_kind IN ('requester', 'agent', 'system')),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: support_ticket_attachments
CREATE TABLE IF NOT EXISTS public.support_ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  message_id uuid NULL REFERENCES public.support_ticket_messages(id) ON DELETE SET NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  uploaded_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: support_ticket_status_events
CREATE TABLE IF NOT EXISTS public.support_ticket_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  from_status text NULL,
  to_status text NOT NULL,
  changed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_requester_created
  ON public.support_tickets (requester_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status_created
  ON public.support_tickets (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_created
  ON public.support_ticket_messages (ticket_id, created_at);

CREATE INDEX IF NOT EXISTS idx_support_ticket_attachments_ticket
  ON public.support_ticket_attachments (ticket_id);

CREATE INDEX IF NOT EXISTS idx_support_ticket_status_events_ticket_created
  ON public.support_ticket_status_events (ticket_id, created_at);

-- Dedicated updated_at trigger function for support_tickets
CREATE OR REPLACE FUNCTION public.support_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.support_set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. FUNCTIONS
-- ----------------------------------------------------------------------------

-- Function 1: support_create_ticket
CREATE OR REPLACE FUNCTION public.support_create_ticket(
  p_requester_id uuid,
  p_requester_name text,
  p_requester_email text,
  p_requester_roles text[],
  p_type text,
  p_title text,
  p_description text,
  p_urgency text,
  p_context jsonb,
  p_locale text,
  p_idempotency_key uuid
)
RETURNS public.support_tickets
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

-- Function 2: support_change_status
CREATE OR REPLACE FUNCTION public.support_change_status(
  p_ticket_id uuid,
  p_to_status text,
  p_actor_id uuid,
  p_actor_kind text,
  p_effort_minutes integer DEFAULT NULL
)
RETURNS public.support_tickets
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

-- Function 3: support_add_message
CREATE OR REPLACE FUNCTION public.support_add_message(
  p_ticket_id uuid,
  p_author_id uuid,
  p_author_name text,
  p_author_kind text,
  p_body text,
  p_is_internal boolean DEFAULT false
)
RETURNS public.support_ticket_messages
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

-- Function 4: support_elapsed_minutes
CREATE OR REPLACE FUNCTION public.support_elapsed_minutes(p_ticket_id uuid)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

-- Function 5: support_auto_close_resolved
CREATE OR REPLACE FUNCTION public.support_auto_close_resolved()
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

-- Revoke execute from public, anon, authenticated; grant to service_role
REVOKE EXECUTE ON FUNCTION public.support_set_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_set_updated_at() TO service_role;

REVOKE EXECUTE ON FUNCTION public.support_create_ticket(uuid, text, text, text[], text, text, text, text, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_create_ticket(uuid, text, text, text[], text, text, text, text, jsonb, text, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.support_change_status(uuid, text, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_change_status(uuid, text, uuid, text, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.support_add_message(uuid, uuid, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_add_message(uuid, uuid, text, text, text, boolean) TO service_role;

REVOKE EXECUTE ON FUNCTION public.support_elapsed_minutes(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_elapsed_minutes(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.support_auto_close_resolved() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_auto_close_resolved() TO service_role;

-- ----------------------------------------------------------------------------
-- 4. SECURITY & RLS
-- ----------------------------------------------------------------------------

-- Enable Row Level Security on the 4 support tables
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_status_events ENABLE ROW LEVEL SECURITY;

-- Revoke all table and sequence permissions from anon and authenticated roles
REVOKE ALL ON TABLE public.support_tickets FROM anon, authenticated;
REVOKE ALL ON TABLE public.support_ticket_messages FROM anon, authenticated;
REVOKE ALL ON TABLE public.support_ticket_attachments FROM anon, authenticated;
REVOKE ALL ON TABLE public.support_ticket_status_events FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.support_ticket_number_seq FROM anon, authenticated;

-- Grant permissions to service_role (used by Express backend)
GRANT ALL ON TABLE public.support_tickets TO service_role;
GRANT ALL ON TABLE public.support_ticket_messages TO service_role;
GRANT ALL ON TABLE public.support_ticket_attachments TO service_role;
GRANT ALL ON TABLE public.support_ticket_status_events TO service_role;
GRANT ALL ON SEQUENCE public.support_ticket_number_seq TO service_role;

-- ----------------------------------------------------------------------------
-- 5. PG_CRON SCHEDULE
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Idempotently unschedule existing job if present
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'support-auto-close') THEN
      PERFORM cron.unschedule('support-auto-close');
    END IF;

    -- Schedule job daily at 03:30 UTC
    PERFORM cron.schedule(
      'support-auto-close',
      '30 3 * * *',
      'SELECT public.support_auto_close_resolved();'
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not found; skipping cron.schedule for support-auto-close.';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. STORAGE BUCKET
-- ----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-attachments',
  'support-attachments',
  false,
  10485760,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'text/csv'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
