-- THE CASINO ON THE SERVER (Harry, 8 Oct 2026: "move the casino to the server").
--
-- Until now every casino game (blackjack, roulette, slots, horse racing,
-- your own horse's races, Goalie Mode) rolled its dice on the player's phone
-- and wrote the bank into the career save. The save guard could not tell a
-- real lucky night from an edited save, so it let "casino luck" through up
-- to ×2,000 a week.
--
-- Now, for a signed-in player, the SERVER rolls and pays
-- (app/api/star/casino/play, rules in lib/star/casinoRules.ts and
-- lib/star/casinoEngine.ts) and keeps one row per play here. The save guard
-- (lib/star/saveGuard.ts) then allows casino money only up to the net these
-- rows add up to since the last trusted save. No more luck allowance.
--
--   star_casino_plays   one row per bet (or per blackjack hand / Goalie Mode
--                       run, played in steps). stake, payout, net = payout −
--                       stake. `outcome` is what the player may see;
--                       `secret` (the dealer's face-down card, the shot in
--                       flight) is never readable from the browser.
--
-- Players can READ their own rows (not the `secret` column). Nobody can write
-- from the browser: no insert/update/delete policy, and the rights are
-- revoked. The server writes with the service key.
--
-- Size: rows are small (a few hundred bytes). The route deletes each
-- account's own settled rows older than 60 days as it goes (the guard only
-- needs rows since the last trusted save). The prune function below does the
-- same for everyone, if wanted.
--
-- Until this runs: NOTHING breaks. GET /api/star/casino/play answers
-- `migrationMissing`, the casino plays on the phone exactly as before, and
-- the save guard keeps its luck allowance.
--
-- Run in the Supabase SQL Editor. Idempotent: safe to re-run. Not run against
-- a live database when written; the checks at the bottom confirm it.

CREATE TABLE IF NOT EXISTS public.star_casino_plays (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot        SMALLINT     NOT NULL DEFAULT 1,
  game        TEXT         NOT NULL,
  stake       BIGINT       NOT NULL DEFAULT 0,
  payout      BIGINT       NOT NULL DEFAULT 0,
  net         BIGINT       NOT NULL DEFAULT 0,
  -- open: a blackjack hand or Goalie Mode run still being played (its stake
  -- is already counted as lost in `net` until it settles).
  status      TEXT         NOT NULL DEFAULT 'settled',
  step        INTEGER      NOT NULL DEFAULT 1,
  outcome     JSONB        NOT NULL DEFAULT '{}'::jsonb,
  secret      JSONB,
  idem_key    TEXT         NOT NULL,
  at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'star_casino_plays_game') THEN
    ALTER TABLE public.star_casino_plays ADD CONSTRAINT star_casino_plays_game
      CHECK (game IN ('roulette','slots','blackjack','horse','horse_own','goalie'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'star_casino_plays_status') THEN
    ALTER TABLE public.star_casino_plays ADD CONSTRAINT star_casino_plays_status
      CHECK (status IN ('open','settled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'star_casino_plays_amounts') THEN
    ALTER TABLE public.star_casino_plays ADD CONSTRAINT star_casino_plays_amounts
      CHECK (stake >= 0 AND payout >= 0 AND net = payout - stake AND slot BETWEEN 1 AND 3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'star_casino_plays_idem_shape') THEN
    ALTER TABLE public.star_casino_plays ADD CONSTRAINT star_casino_plays_idem_shape
      CHECK (char_length(idem_key) BETWEEN 8 AND 80);
  END IF;
END $$;

-- One request key per account: a retried request never plays twice.
CREATE UNIQUE INDEX IF NOT EXISTS star_casino_plays_idem ON public.star_casino_plays (user_id, idem_key);
-- The save guard's question: this account+slot's net since a time.
CREATE INDEX IF NOT EXISTS star_casino_plays_user_slot_at ON public.star_casino_plays (user_id, slot, at);

-- RLS on: read own rows only, no writes from the browser.
ALTER TABLE public.star_casino_plays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS star_casino_plays_read_own ON public.star_casino_plays;
CREATE POLICY star_casino_plays_read_own ON public.star_casino_plays
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON public.star_casino_plays FROM anon, authenticated;
-- Every column but `secret` (the dealer's hidden card, the shot in flight).
GRANT SELECT (id, user_id, slot, game, stake, payout, net, status, step, outcome, idem_key, at, updated_at)
  ON public.star_casino_plays TO authenticated;
GRANT ALL ON public.star_casino_plays TO service_role;

-- Optional tidy-up for every account at once (the route already prunes each
-- account's own rows as it goes). SELECT star_casino_prune(); returns rows deleted.
CREATE OR REPLACE FUNCTION public.star_casino_prune(p_days INTEGER DEFAULT 60)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INTEGER;
BEGIN
  DELETE FROM public.star_casino_plays
   WHERE status = 'settled' AND at < now() - make_interval(days => GREATEST(p_days, 7));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.star_casino_prune(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.star_casino_prune(INTEGER) TO service_role;

-- ── Verify, after running ────────────────────────────────────────────────────
-- 1. RLS is on (true):
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'star_casino_plays';
--
-- 2. One policy, SELECT only:
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'star_casino_plays';
--
-- 3. The browser roles cannot write (every can_write is false):
-- SELECT r, has_table_privilege(r, 'public.star_casino_plays', 'INSERT')
--        OR has_table_privilege(r, 'public.star_casino_plays', 'UPDATE')
--        OR has_table_privilege(r, 'public.star_casino_plays', 'DELETE') AS can_write
--   FROM unnest(ARRAY['anon','authenticated']) r;
--
-- 4. The browser cannot read the hidden column (false):
-- SELECT has_column_privilege('authenticated', 'public.star_casino_plays', 'secret', 'SELECT');
--
-- 5. The request-key index exists (one row):
-- SELECT indexname FROM pg_indexes WHERE tablename = 'star_casino_plays' AND indexname = 'star_casino_plays_idem';
--
-- 6. After some play: each account's casino net (what the save guard allows):
-- SELECT user_id, slot, count(*) AS plays, sum(net) AS net
--   FROM public.star_casino_plays GROUP BY user_id, slot ORDER BY net DESC LIMIT 20;
--
-- 7. Table size (keep an eye on the 500 MB free limit):
-- SELECT pg_size_pretty(pg_total_relation_size('public.star_casino_plays'));
