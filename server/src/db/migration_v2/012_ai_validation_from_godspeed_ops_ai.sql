-- Consolidated migration_v2: AI validation table used by the GodspeedOps AI service.
--
-- Rewritten (2026-11) to be the table as the four production databases have it. The earlier text of this
-- file (jsonb response, defaults, created_at/updated_at, a unique key, a foreign key to auth.users and a
-- trigger) was never what production has, so a database built from the files did not match. Live
-- databases are not affected: the table exists there and this file creates it only when it is missing.
--
-- The two open policies below are what the AI service originally got; 033 replaces them with row
-- security for the owner and staff.

CREATE TABLE IF NOT EXISTS public.ai_validation (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID,
  document_id TEXT NOT NULL,
  ai_response JSON NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  llm_model_name TEXT NOT NULL,
  document_status TEXT,
  CONSTRAINT ai_validation_pkey PRIMARY KEY (id),
  CONSTRAINT ai_validation_document_status_check CHECK (document_status IN ('active', 'inactive'))
);

ALTER TABLE public.ai_validation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable insert for all users" ON public.ai_validation;
DROP POLICY IF EXISTS "Enable users to view their own data or anon can view all" ON public.ai_validation;

CREATE POLICY "Enable insert for all users" ON public.ai_validation
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable users to view their own data or anon can view all" ON public.ai_validation
  FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'anon');

COMMENT ON TABLE public.ai_validation IS 'AI document validation records used by GodspeedOps AI service.';
COMMENT ON COLUMN public.ai_validation.document_id IS 'Document UUID/string as passed from profile documents payload.';
COMMENT ON COLUMN public.ai_validation.ai_response IS 'Structured model output (authentication %, tampering flags, notes, etc.)';
