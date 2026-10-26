-- CHANGES THE DATABASE. What: shrinks the FIFA stats table (sofifa_players) without losing a single stat: drops 2 spare indexes and removes, from each player's stats bundle, the copies of facts the row already holds in its own column (name, club, league, nationality, photo link, id, positions, age, overall, potential).
-- Why: Harry, 25 Oct 2026: "FIFA stats shrink: do it, 100%." This table is 312 MB of the 382 MB database (free plan bills at 500 MB).
--
-- NOT RUN. Run supabase/checks/fifa_stats_columns.sql first (READ ONLY) to see the real numbers.
-- Then run this file. Then run fifa_stats_vacuum.sql ON ITS OWN (see step 4).
--
-- ── What every game screen reads, and why nothing is lost ──────────────────
-- Checked 25 Oct 2026 by reading every query on sofifa_players in lib/, app/, components/, scripts/:
--  * The game reads the stats through lib/playerAttributes.ts (attributesFromJson) and
--    app/api/draft/roster/route.ts: 22 skills, each under 2-3 spellings (Pace / attr_pac / pac ...).
--    None of those keys is touched here.
--  * name, club, league, nationality, image_url, sofifa_id, positions, age, overall and potential are
--    ALSO stored inside the bundle on some editions. Every reader takes the column first and only
--    falls back to the bundle when the column is empty:
--      app/api/draft/roster/route.ts:90-96   p.name || a.name, p.positions || a.positions, ...
--      app/api/draft/roster/route.ts:221,239 p.overall || a.overall, p.potential || a.potential
--      app/admin/football/players/page.tsx:68 p.positions || a.positions || a.player_positions
--      app/api/admin/football/player-search/route.ts:362-366  source.age > 0 ? source.age : a.age
--      app/api/admin/football/normalize-attributes/route.ts:31-65  p.X ?? a.X
--    So a bundle copy is removed ONLY where the column is filled (text not empty, number above 0).
--    Where the column is empty, the bundle copy stays and the fallback still works.
--  * The admin player page lists every bundle key; it will list those copies no longer. The same
--    facts still show in the row's own columns on that page.
--
-- ── Estimate (reasoned, not measured; the READ ONLY check measures it) ─────
--  Step 1 duplicate name index: a trigram index on 341,000 names, about 8-15 MB.
--  Step 2 idx_sofifa_year: a number index on 341,000 rows, 2-7 MB.
--  Step 3 bundle copies: up to 10 copies per row at about 20-70 bytes each (a key, a value and
--         8 bytes of bookkeeping). If a third to two thirds of rows carry them: about 20-60 MB.
--  Step 4 VACUUM FULL: rebuilds the table and every index tight, freeing the space above plus any
--         old dead rows (a few MB).
--  Total: about 30-80 MB. Database 382 MB -> roughly 300-350 MB.
--  The bigger saving (the 22 skills as one short list, about -120 MB) needs a code change in every
--  reader first; not done here. fifa_stats_drop_unnamed_keys.sql is the optional next step.
--
-- Safe to re-run: every step checks before it acts.

-- 1. Two identical name-search indexes; keep one.
--    Name search uses "contains" matching (ilike '%...%': app/api/star/player-search/route.ts:48,
--    app/api/admin/football/player-search/route.ts:92-94), which needs a trigram index. Both are
--    trigram indexes on name (the speed advisor called them identical, 25 Oct 2026).
--    Keep idx_sofifa_name_trgm; drop idx_sofifa_name — but only if the one we keep is really there.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'sofifa_players'
      AND indexname = 'idx_sofifa_name_trgm' AND indexdef ILIKE '%gin_trgm_ops%'
  ) THEN
    DROP INDEX IF EXISTS public.idx_sofifa_name;
  ELSE
    RAISE NOTICE 'idx_sofifa_name_trgm not found: kept idx_sofifa_name (name search needs one).';
  END IF;
END $$;

-- 2. idx_sofifa_year (fifa_year) is covered by idx_sofifa_year_league (fifa_year, league): an index
--    on two columns also serves searches on its first column alone. Drop only if that one exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'sofifa_players'
      AND indexname = 'idx_sofifa_year_league'
  ) THEN
    DROP INDEX IF EXISTS public.idx_sofifa_year;
  ELSE
    RAISE NOTICE 'idx_sofifa_year_league not found: kept idx_sofifa_year.';
  END IF;
END $$;

-- 3. Remove the bundle's copies of filled columns. Only rows that have at least one such copy
--    are rewritten. While this runs the table briefly holds old and new rows side by side
--    (up to about +250 MB of disk, well under the 2 GB disk); step 4 gives it back.
UPDATE public.sofifa_players
SET attributes = attributes - array_remove(ARRAY[
      CASE WHEN COALESCE(name, '')        <> '' THEN 'name' END,
      CASE WHEN COALESCE(club, '')        <> '' THEN 'club' END,
      CASE WHEN COALESCE(league, '')      <> '' THEN 'league' END,
      CASE WHEN COALESCE(nationality, '') <> '' THEN 'nationality' END,
      CASE WHEN COALESCE(image_url, '')   <> '' THEN 'image_url' END,
      CASE WHEN COALESCE(sofifa_id, '')   <> '' THEN 'sofifa_id' END,
      CASE WHEN COALESCE(positions, '')   <> '' THEN 'positions' END,
      CASE WHEN COALESCE(positions, '')   <> '' THEN 'player_positions' END,
      CASE WHEN COALESCE(age, 0)       > 0 THEN 'age' END,
      CASE WHEN COALESCE(overall, 0)   > 0 THEN 'overall' END,
      CASE WHEN COALESCE(potential, 0) > 0 THEN 'potential' END
    ]::text[], NULL)
WHERE attributes ?| ARRAY['name','club','league','nationality','image_url','sofifa_id',
                          'positions','player_positions','age','overall','potential'];

-- 4. Give the space back. THE SPACE ONLY RETURNS AFTER THIS.
--    It is its own file, supabase/migrations/fifa_stats_vacuum.sql. Run it ON ITS OWN, after the rest
--    has finished (it cannot run inside the same batch: send it as a single statement).
--    It locks the table while it rebuilds: squads and the draft cannot load for about 1-2 minutes.
--    Run it at a quiet time (early morning UK).
--
--    VACUUM (FULL, ANALYZE) public.sofifa_players;
--
-- ── Verify afterwards (READ ONLY) ──────────────────────────────────────────
--    Re-run supabase/checks/fifa_stats_columns.sql blocks 1 and 2: total size down, one name index.
--    Then open /star-dev and a PL Draft: squads, photos, flags and ratings as before.
