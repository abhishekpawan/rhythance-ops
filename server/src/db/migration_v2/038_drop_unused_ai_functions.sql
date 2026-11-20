-- 038: drop two database functions nothing calls (session AI-4).
--
-- Runs after 037. Safe to run twice. Changes nothing anyone can see.
--
--   * public.execute_sql(text): the old AI chat's free-form SQL function. SEC-1 closed it to everyone but the
--     server key; the rebuilt chat (037) reads through its own read-only layer and never calls it. Only the
--     live databases have it (no migration ever created it).
--   * public.set_user_roles(uuid, text[], uuid, text): no code calls it (roles are changed by the server
--     through the auth admin API and 034's app_metadata). SEC-1 closed it to everyone but the server key.
--
-- No CASCADE on purpose: if anything still depends on either function, the statement fails and nothing is dropped.

DROP FUNCTION IF EXISTS public.execute_sql(text);
DROP FUNCTION IF EXISTS public.set_user_roles(uuid, text[], uuid, text);
