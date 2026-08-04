-- ============================================================================
-- SECURITY: restrict which user_profiles columns a user may write
--
-- Run this in the Supabase SQL Editor. It is idempotent — safe to re-run.
-- This is a FOLLOW-UP to security_rls_hardening_jul2026.sql, which
-- deliberately left user_profiles alone because the browser writes to it
-- directly. Run that file first if you have not already.
--
-- BACKGROUND
-- supabase/schema-additions.sql created:
--   "Users can update own profile" ON user_profiles FOR UPDATE
--     USING (auth.uid() = user_id)
--
-- Row ownership is correct — you can only touch your own row. The problem is
-- that the policy permits updating ANY COLUMN, and the table has since gained
-- columns that are meant to be controlled by server routes only:
--
--   equipped_frame / equipped_title
--     app/api/profile/equip/route.ts checks you actually own the reward before
--     equipping it. Writing the column directly skips that check, so any
--     logged-in user can equip cosmetics they never unlocked:
--       PATCH /rest/v1/user_profiles?user_id=eq.<me>
--       {"equipped_frame":"frame_legendary"}
--
--   longest_streak
--     app/api/stats reads this value back and feeds it to checkRewardUnlock,
--     which inserts streak trophies. Setting it to 99999 and then calling
--     POST /api/stats grants every streak-gated reward. The same applies to
--     any future unlock_stat reward keyed on a profile column.
--
--   username_changed_at
--     backs the username-change cooldown; writable = cooldown bypass.
--
-- FIX
-- Replace the blanket policy with one that additionally requires every
-- server-controlled column to be UNCHANGED. A user can still edit the fields
-- that are genuinely theirs (username, is_anonymous, team_name, …) straight
-- from the browser, exactly as before; the API routes use the service role and
-- are unaffected by any of this.
-- ============================================================================

-- The WITH CHECK expression compares the proposed row against the stored one.
-- A plain "OLD.col = NEW.col" is not available in a policy, so this uses a
-- lookup against the current row instead.
CREATE OR REPLACE FUNCTION public.user_profile_locked_cols_unchanged(
  p_user_id            uuid,
  p_equipped_frame     text,
  p_equipped_title     text,
  p_longest_streak     int,
  p_current_streak     int,
  p_username_changed_at timestamptz
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.user_id = p_user_id
      AND up.equipped_frame      IS NOT DISTINCT FROM p_equipped_frame
      AND up.equipped_title      IS NOT DISTINCT FROM p_equipped_title
      AND up.longest_streak      IS NOT DISTINCT FROM p_longest_streak
      AND up.current_streak      IS NOT DISTINCT FROM p_current_streak
      AND up.username_changed_at IS NOT DISTINCT FROM p_username_changed_at
  );
$$;

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_profile_locked_cols_unchanged(
      user_id,
      equipped_frame,
      equipped_title,
      longest_streak,
      current_streak,
      username_changed_at
    )
  );


-- ── Verify ───────────────────────────────────────────────────────────────────
-- Expect exactly one UPDATE policy on user_profiles, with a WITH CHECK clause
-- (with_check must NOT be null).
--
--   SELECT policyname, cmd, qual, with_check
--   FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'user_profiles';
--
-- Manual check, signed in as any normal user — this must now FAIL:
--   PATCH /rest/v1/user_profiles?user_id=eq.<your id>
--   {"equipped_frame":"frame_legendary"}
-- while a normal profile edit must still succeed:
--   PATCH /rest/v1/user_profiles?user_id=eq.<your id>
--   {"is_anonymous":true}
