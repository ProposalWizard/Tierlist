-- CHANGES THE DATABASE (adds one read-only function; touches no data).
-- What: ops_limits() returns two numbers: the database size in bytes, and the
--       total bytes of every file in Supabase Storage.
-- Why:  the morning limits post in #health (/api/cron/limits, Harry 12 Nov
--       2026) compares them with the free plan's 500 MB and 1 GB. The site's
--       own Supabase connection cannot run raw SQL, so it calls this.
-- Who can call it: only the service key (the server). Not signed-in players,
-- not the public. Safe to run again.
--
-- Until this is run, the morning post says "Database: could not read" and
-- "Supabase Storage: could not read", with a note naming this file.

CREATE OR REPLACE FUNCTION public.ops_limits()
RETURNS TABLE (db_bytes bigint, storage_bytes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    pg_database_size(current_database())::bigint AS db_bytes,
    COALESCE((SELECT sum((o.metadata->>'size')::bigint) FROM storage.objects o), 0)::bigint AS storage_bytes;
$$;

REVOKE ALL ON FUNCTION public.ops_limits() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ops_limits() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_limits() TO service_role;
