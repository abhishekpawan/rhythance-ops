-- ============================================================================
-- Migration: Remove module, page, and url columns and legacy function
-- Target: Supabase Postgres (public schema)
-- Idempotent: Yes
-- ============================================================================

-- 1. Drop deprecated columns from support_tickets
ALTER TABLE public.support_tickets
  DROP COLUMN IF EXISTS area_key,
  DROP COLUMN IF EXISTS area_label,
  DROP COLUMN IF EXISTS page_url;

-- 2. Drop old 14-parameter function overload if present
DROP FUNCTION IF EXISTS public.support_create_ticket(
  uuid, text, text, text[], text, text, text, text, text, text, text, jsonb, text, uuid
);

-- 3. Create or replace clean 11-parameter function
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

-- 4. Permissions and security grants
REVOKE EXECUTE ON FUNCTION public.support_create_ticket(uuid, text, text, text[], text, text, text, text, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_create_ticket(uuid, text, text, text[], text, text, text, text, jsonb, text, uuid) TO service_role;
