-- CHANGES THE DATABASE.
-- What: (1) stops guest accounts writing to community, leaderboard, team,
--       admin and shop tables; (2) adds account_campaigns, which records which
--       ad each guest came from and whether they later saved with Google;
--       (3) adds a nightly job that deletes guests idle 30+ days with no save.
-- Why:  guest accounts (Harry, 25 Oct 2026) let a player start Road to Ballon
--       d'Or without signing in. A guest is a real signed-in Supabase user, so
--       every rule that says "any signed-in user may…" would also let a guest
--       in. This keeps guests to the career game only, measures the ads, and
--       stops empty guest accounts piling up.
--
-- STATUS: PENDING — NOT RUN. Written 25 Oct 2026, not applied to any database.
-- Run it in the Supabase SQL Editor BEFORE switching NEXT_PUBLIC_GUEST_ACCOUNTS
-- on (see docs/plans/2026-10-25/guest-accounts-plan.md). Safe to run twice.
-- Safe to run while guests are still off: with no guests, (1) changes nothing
-- anyone can see, (2) stays empty and (3) deletes nothing.
--
-- Needs: the pg_cron extension (Dashboard → Database → Extensions → pg_cron)
-- for part 3. Everything else runs without it.
--
-- HOW A GUEST IS RECOGNISED
-- A guest's login token carries is_anonymous = true (auth.users.is_anonymous
-- in the table). Once Google is linked it becomes false, and every rule below
-- stops applying: the same account is now an ordinary one.
--
-- WHAT GUESTS CAN STILL DO
-- Everything a signed-out visitor can do (read tierlists, vote anonymously,
-- send feedback), plus their own Road to Ballon d'Or saves: star_careers,
-- star_hall_of_fame and star_legend_shares are deliberately NOT in the list.
-- Their own XP/objective/stat rows are also left alone (they carry over when
-- the guest saves with Google, because the user id does not change).
--
-- NOT COVERED BY THIS FILE: server routes that use the service key bypass row
-- rules entirely. Those check for guests in the code (lib/guest/config.ts
-- isGuestUser); the plan lists which ones do and which still need it.

-- ═══ 1. Keep guests out ══════════════════════════════════════════════════
-- A RESTRICTIVE policy is ANDed with the table's existing rules, so a write is
-- allowed only if an old rule allows it AND the writer is not a guest. Reads
-- are untouched (separate INSERT / UPDATE / DELETE policies, never FOR ALL).
-- Tables that don't exist in this database are skipped.

CREATE OR REPLACE FUNCTION public.is_guest()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;
COMMENT ON FUNCTION public.is_guest() IS
  'True for a guest (anonymous) account. guest_accounts.sql, 25 Oct 2026.';

DO $$
DECLARE
  t text;
  guest_free_tables text[] := ARRAY[
    -- Tierlists and the other community content
    'tierlists', 'tierlist_images', 'tierlist_players', 'tierlist_rankings',
    'tierlist_likes', 'saved_tierlists', 'tierlist_topics',
    'vote_tierlists', 'vote_tierlist_images', 'vote_tierlist_likes',
    'blind_rankings', 'blind_ranking_images', 'blind_ranking_likes',
    'tictactoe_puzzles', 'tictactoe_scores', 'tictactoe_difficulty_ratings',
    'tenable_puzzles', 'uploaded_images', 'saved_profile_images',
    -- Draft leaderboards and rooms
    'draft_rooms', 'draft_room_players', 'draft_records',
    'draft_personal_records', 'draft_runs',
    'american_draft_rooms', 'american_draft_participants',
    -- Profiles, roles, tester links (a guest gets a username only after Google)
    'user_profiles', 'user_roles', 'tester_links',
    -- The Team room
    'team_members', 'team_messages', 'team_ideas', 'team_idea_votes',
    'team_tasks', 'team_notes', 'team_acks', 'team_read_marks',
    -- Admin-made content
    'card_library', 'objectives', 'custom_clubs', 'categories',
    'category_homepage_settings', 'dev_recordings', 'dev_status',
    'star_scenarios', 'star_lineups', 'star_training_levels',
    'star_cutscene_edits', 'star_pass_config', 'star_xp_config',
    -- Payments and the casino (already server-only; belt and braces)
    'star_paid_items', 'star_wallet', 'star_wallet_ledger',
    'star_entitlements', 'star_casino_plays'
  ];
BEGIN
  FOREACH t IN ARRAY guest_free_tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'guest_accounts: % not in this database, skipped', t;
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS "no guest insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "no guest update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "no guest delete" ON public.%I', t);
    EXECUTE format('CREATE POLICY "no guest insert" ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_guest())', t);
    EXECUTE format('CREATE POLICY "no guest update" ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_guest()) WITH CHECK (NOT public.is_guest())', t);
    EXECUTE format('CREATE POLICY "no guest delete" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_guest())', t);
  END LOOP;
END $$;

-- Uploading pictures to the tierlist-images bucket (tierlist covers, profile
-- pictures): signed-in users only, and a guest does not count.
DROP POLICY IF EXISTS "no guest uploads" ON storage.objects;
CREATE POLICY "no guest uploads" ON storage.objects AS RESTRICTIVE
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'tierlist-images' OR NOT public.is_guest());

-- ═══ 2. Which ad each guest came from ════════════════════════════════════
-- Filled automatically when a guest account is made, from the details the
-- landing page put on it (lib/guest/start.ts: campaign, utm_*, landing).
-- upgraded_at is set the moment that account links Google. When the nightly
-- tidy deletes a guest, its row stays (user_id becomes empty, tidied_at set)
-- so the ad numbers survive.
-- Players cannot read or write it; read it in the SQL Editor:
--   SELECT campaign, count(*) AS guests, count(upgraded_at) AS saved_with_google
--   FROM account_campaigns GROUP BY campaign ORDER BY guests DESC;

CREATE TABLE IF NOT EXISTS public.account_campaigns (
  id           bigserial PRIMARY KEY,
  user_id      uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  campaign     text,
  utm          jsonb NOT NULL DEFAULT '{}'::jsonb,
  landing      text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  upgraded_at  timestamptz,
  tidied_at    timestamptz
);
CREATE INDEX IF NOT EXISTS account_campaigns_campaign ON public.account_campaigns (campaign, created_at DESC);
ALTER TABLE public.account_campaigns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_campaigns FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.account_campaigns_id_seq FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.guest_campaign_on_signup()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE m jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
  IF NEW.is_anonymous IS TRUE THEN
    INSERT INTO public.account_campaigns (user_id, campaign, utm, landing)
    VALUES (
      NEW.id,
      left(m ->> 'campaign', 80),
      jsonb_strip_nulls(jsonb_build_object(
        'utm_source',   left(m ->> 'utm_source', 200),
        'utm_medium',   left(m ->> 'utm_medium', 200),
        'utm_campaign', left(m ->> 'utm_campaign', 200),
        'utm_content',  left(m ->> 'utm_content', 200),
        'utm_term',     left(m ->> 'utm_term', 200),
        'ttclid',       left(m ->> 'ttclid', 200),
        'fbclid',       left(m ->> 'fbclid', 200))),
      left(m ->> 'landing', 200))
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Recording the ad must never stop an account being made.
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guest_campaign_on_upgrade()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.is_anonymous IS TRUE AND NEW.is_anonymous IS NOT TRUE THEN
    UPDATE public.account_campaigns SET upgraded_at = now()
    WHERE user_id = NEW.id AND upgraded_at IS NULL;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.guest_campaign_on_signup() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guest_campaign_on_upgrade() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS kib_guest_campaign_signup ON auth.users;
CREATE TRIGGER kib_guest_campaign_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.guest_campaign_on_signup();

DROP TRIGGER IF EXISTS kib_guest_campaign_upgrade ON auth.users;
CREATE TRIGGER kib_guest_campaign_upgrade
  AFTER UPDATE OF is_anonymous ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.guest_campaign_on_upgrade();

-- ═══ 3. Nightly tidy of idle guests ══════════════════════════════════════
-- Deletes guest accounts that: are still guests, were made or last signed in
-- 30+ days ago, have had no session activity for 30 days, have NO career save
-- (no star_careers row), and have nothing in the gem wallet. Deleting the
-- account removes its other rows too (their tables point at auth.users with
-- ON DELETE CASCADE). At most 5,000 a night. Returns how many went.
-- Guests WITH a save are never deleted by this (an open question in the plan).

CREATE OR REPLACE FUNCTION public.tidy_idle_guests()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  doomed uuid[];
  d uuid;
  gone integer := 0;
  has_wallet boolean := to_regclass('public.star_wallet') IS NOT NULL;
BEGIN
  SELECT coalesce(array_agg(id), '{}') INTO doomed FROM (
    SELECT u.id
    FROM auth.users u
    WHERE u.is_anonymous IS TRUE
      AND coalesce(u.last_sign_in_at, u.created_at) < now() - interval '30 days'
      AND NOT EXISTS (SELECT 1 FROM auth.sessions s
                      WHERE s.user_id = u.id AND s.updated_at > now() - interval '30 days')
      AND NOT EXISTS (SELECT 1 FROM public.star_careers c WHERE c.user_id = u.id)
    LIMIT 5000
  ) x;

  IF has_wallet AND array_length(doomed, 1) > 0 THEN
    EXECUTE 'SELECT coalesce(array_agg(d), ''{}'') FROM unnest($1) d
             WHERE NOT EXISTS (SELECT 1 FROM public.star_wallet w WHERE w.user_id = d)'
      INTO doomed USING doomed;
  END IF;

  IF coalesce(array_length(doomed, 1), 0) = 0 THEN RETURN 0; END IF;

  -- One at a time: a guest some other table still points at (without
  -- ON DELETE CASCADE) is skipped instead of stopping the whole night.
  FOREACH d IN ARRAY doomed LOOP
    BEGIN
      UPDATE public.account_campaigns SET tidied_at = now() WHERE user_id = d;
      DELETE FROM auth.users WHERE id = d AND is_anonymous IS TRUE;
      gone := gone + 1;
    EXCEPTION WHEN foreign_key_violation THEN
      NULL;
    END;
  END LOOP;
  RETURN gone;
END $$;

REVOKE ALL ON FUNCTION public.tidy_idle_guests() FROM PUBLIC, anon, authenticated;

-- The schedule: every night at 03:17 UTC. Needs pg_cron (see the top).
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kib-guest-tidy') THEN
    PERFORM cron.unschedule('kib-guest-tidy');
  END IF;
  PERFORM cron.schedule('kib-guest-tidy', '17 3 * * *', 'SELECT public.tidy_idle_guests()');
END $$;

-- ═══ Checks (READ ONLY — run after, each should return what it says) ═════
-- Every "no guest" rule (about 3 per table that exists):
--   SELECT tablename, policyname FROM pg_policies
--   WHERE policyname LIKE 'no guest%' ORDER BY tablename;
-- The two triggers on auth.users:
--   SELECT tgname FROM pg_trigger WHERE tgname LIKE 'kib_guest_campaign%';
-- The nightly job:
--   SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'kib-guest-tidy';
-- How many guests the tidy WOULD delete tonight (deletes nothing):
--   SELECT count(*) FROM auth.users u WHERE u.is_anonymous IS TRUE
--     AND coalesce(u.last_sign_in_at, u.created_at) < now() - interval '30 days'
--     AND NOT EXISTS (SELECT 1 FROM public.star_careers c WHERE c.user_id = u.id);
