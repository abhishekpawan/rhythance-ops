-- Migration: Expand client and client_drafts short_code to VARCHAR(5)
-- Purpose: Allow 2 to 5 character client short codes to accommodate standard abbreviations and prevent database length constraint exceptions

ALTER TABLE public.clients
  ALTER COLUMN short_code TYPE VARCHAR(5);

ALTER TABLE public.client_drafts
  ALTER COLUMN short_code TYPE VARCHAR(5);
