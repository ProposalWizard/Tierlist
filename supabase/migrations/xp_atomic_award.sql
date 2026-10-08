-- Add XP in one step (8 Oct 2026).
--
-- /api/xp used to read total_xp, add the award in the server, and write the
-- sum back. Two awards at the same moment could both read the same total, and
-- one award was lost. add_user_xp does the add inside the database, in one
-- statement, and gives back the new total.
--
-- Until this runs, the route keeps the old read-then-write (it checks for the
-- function and falls back). Nothing breaks either way.
--
-- Service role only: the browser cannot call it.
--
-- Run in the Supabase SQL Editor. Idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION add_user_xp(p_user_id UUID, p_amount INTEGER)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO user_xp (user_id, total_xp, updated_at)
  VALUES (p_user_id, GREATEST(p_amount, 0), now())
  ON CONFLICT (user_id) DO UPDATE
    SET total_xp = user_xp.total_xp + GREATEST(p_amount, 0),
        updated_at = now()
  RETURNING total_xp;
$$;

REVOKE ALL ON FUNCTION add_user_xp(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION add_user_xp(UUID, INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION add_user_xp(UUID, INTEGER) TO service_role;

-- Verify (should list add_user_xp; the second should say false for anon):
-- SELECT proname FROM pg_proc WHERE proname = 'add_user_xp';
-- SELECT has_function_privilege('anon', 'add_user_xp(uuid, integer)', 'execute');
