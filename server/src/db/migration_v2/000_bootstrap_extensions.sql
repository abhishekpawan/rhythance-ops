-- Consolidated migration_v2 bootstrap
-- Ensures required UUID/random extensions are available.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Scheduled jobs (023, 027 and the status job in 032 use cron.schedule). Already installed on every live database.
CREATE EXTENSION IF NOT EXISTS pg_cron;
