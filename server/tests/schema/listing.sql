-- Schema listing: structure only (names, types, definitions, grants). No row of any table is read.
--
-- One line per object, `kind|object|details`, sorted. The same query runs on a production database
-- (read-only) to make tests/schema/production-listing.txt, and on the test database to compare.
-- Cron job commands and function bodies are listed as md5 only, because a command can hold a key.
-- Function bodies are hashed with all whitespace collapsed, and constraint texts are listed without
-- casts and parentheses: line endings and deparse style differ between how a database was written
-- and are not differences in behaviour.

with
rels as (
  select c.oid, c.relname, c.relkind, c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'S')
    and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
),
fns as (
  select p.oid, p.proname, p.prosecdef, p.provolatile, p.proconfig, p.prosrc, p.prokind,
         pg_get_function_identity_arguments(p.oid) as args,
         pg_get_function_result(p.oid) as result
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
),
roles(role) as (values ('anon'), ('authenticated'), ('service_role'))
select regexp_replace(line, '\s+', ' ', 'g') as line from (
  select 'extension|' || extname || '|' as line from pg_extension
  where extname in ('plpgsql', 'pg_cron', 'pgcrypto', 'uuid-ossp', 'vector')
  union all
  select 'table|public.' || relname || '|kind=' || relkind::text || ' rls=' || relrowsecurity from rels
  union all
  select 'column|public.' || r.relname || '.' || a.attname || '|' || format_type(a.atttypid, a.atttypmod)
         || case when a.attidentity <> '' then ' identity=' || a.attidentity::text else '' end
         || case when a.attnotnull then ' not null' else '' end
         || coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '')
  from rels r
  join pg_attribute a on a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = r.oid and d.adnum = a.attnum
  where r.relkind in ('r', 'p')
  union all
  select 'constraint|public.' || r.relname || '.' || c.conname || '|' || regexp_replace(regexp_replace(pg_get_constraintdef(c.oid), '::(character varying|text)(\[\])?', '', 'g'), '[()]', '', 'g')
  from rels r join pg_constraint c on c.conrelid = r.oid
  union all
  select 'index|public.' || i.tablename || '.' || i.indexname || '|' || regexp_replace(i.indexdef, '^.* USING ', 'USING ')
  from pg_indexes i where i.schemaname = 'public'
  union all
  select 'view|public.' || r.relname || '|md5=' || md5(pg_get_viewdef(r.oid)) from rels r where r.relkind = 'v'
  union all
  select 'function|public.' || proname || '(' || args || ')|returns ' || result
         || ' secdef=' || prosecdef || ' volatility=' || provolatile::text
         || ' config=' || coalesce(array_to_string(proconfig, ','), '')
         || ' body=' || md5(btrim(regexp_replace(prosrc, '\s+', ' ', 'g')))
  from fns
  union all
  select 'fngrant|public.' || proname || '(' || args || ')|'
         || string_agg(role || '=' || has_function_privilege(role, oid, 'execute'), ' ' order by role)
  from fns cross join roles group by oid, proname, args
  union all
  select 'grant|public.' || r.relname || '|' || ro.role || '='
         || coalesce(string_agg(pr.priv, '' order by pr.priv) filter (where has_table_privilege(ro.role, r.oid, pr.name)), '')
  from rels r cross join roles ro
  cross join (values ('SELECT', 'r'), ('INSERT', 'a'), ('UPDATE', 'w'), ('DELETE', 'd'),
                     ('TRUNCATE', 'D'), ('REFERENCES', 'x'), ('TRIGGER', 't')) as pr(name, priv)
  where r.relkind in ('r', 'p')
  group by r.oid, r.relname, ro.role
  union all
  select 'trigger|' || n.nspname || '.' || c.relname || '.' || t.tgname || '|enabled=' || t.tgenabled::text
         || ' ' || regexp_replace(pg_get_triggerdef(t.oid), '^CREATE (CONSTRAINT )?TRIGGER \S+ ', '')
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
    and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname = 'users')
         or (n.nspname = 'storage' and c.relname = 'objects'))
  union all
  select 'policy|' || schemaname || '.' || tablename || '|"' || policyname || '" ' || cmd || ' ' || permissive
         || ' roles=' || array_to_string(roles, ',')
         || ' using=' || coalesce(qual, '') || ' check=' || coalesce(with_check, '')
  from pg_policies where schemaname in ('public', 'storage')
  union all
  select 'bucket|' || id || '|public=' || public || ' limit=' || coalesce(file_size_limit::text, '')
         || ' mime=' || coalesce(array_to_string(allowed_mime_types, ','), '')
  from storage.buckets
  union all
  select 'cron|' || jobname || '|schedule=' || schedule || ' command_md5=' || md5(btrim(regexp_replace(command, '\s+', ' ', 'g'))) from cron.job
  union all
  select 'publication|' || pubname || '|' || schemaname || '.' || tablename from pg_publication_tables where pubname = 'supabase_realtime'
  union all
  select 'type|public.' || t.typname || '|' || coalesce((select string_agg(enumlabel, ',' order by enumsortorder)
                                                         from pg_enum e where e.enumtypid = t.oid), '')
  from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public' and t.typtype = 'e'
) listing
order by 1;
