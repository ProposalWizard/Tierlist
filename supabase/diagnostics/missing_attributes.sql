-- ============================================================================
-- How many players are missing their attribute stats?
--
-- Paste into the Supabase SQL Editor. Read-only — changes nothing.
--
-- WHAT COUNTS AS "MISSING"
-- This mirrors the check the simulator used to make (lib/seasonSimulator.ts,
-- the old hasAttrs): a player counted as HAVING attributes if any one of pace,
-- shooting, passing or defending was above zero.
--
-- Two things a naive query gets wrong, both handled below:
--   1. Key names differ by edition. Newer imports use "Pace"/"Shooting", older
--      ones "attr_pac"/"attr_sho", and some use bare "pac"/"shooting".
--      lib/playerAttributes.ts checks all three spellings, so this does too.
--   2. Values are not always numbers. SoFIFA writes "83 +2" / "83 -1", so the
--      leading digits have to be pulled out before comparing.
--
-- NOTE: since the August 2026 fix, missing attributes no longer make a squad
-- weaker — a player with none is scored as though every stat equalled his
-- overall. This is now a DATA QUALITY question (which editions need
-- re-importing), not a fairness one.
-- ============================================================================

-- First digits of a value like "83 +2", as an int. NULL when absent/unparseable.
CREATE OR REPLACE FUNCTION pg_temp.attr_num(v text) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(substring(COALESCE(v, '') from '(\d+)'), '')::int;
$$;

WITH parsed AS (
  SELECT
    fifa_year,
    fifa_edition,
    GREATEST(
      COALESCE(pg_temp.attr_num(attributes->>'Pace'),      0),
      COALESCE(pg_temp.attr_num(attributes->>'attr_pac'),  0),
      COALESCE(pg_temp.attr_num(attributes->>'pac'),       0),
      COALESCE(pg_temp.attr_num(attributes->>'Shooting'),  0),
      COALESCE(pg_temp.attr_num(attributes->>'attr_sho'),  0),
      COALESCE(pg_temp.attr_num(attributes->>'shooting'),  0),
      COALESCE(pg_temp.attr_num(attributes->>'Passing'),   0),
      COALESCE(pg_temp.attr_num(attributes->>'attr_pas'),  0),
      COALESCE(pg_temp.attr_num(attributes->>'passing'),   0),
      COALESCE(pg_temp.attr_num(attributes->>'Defending'), 0),
      COALESCE(pg_temp.attr_num(attributes->>'attr_def'),  0),
      COALESCE(pg_temp.attr_num(attributes->>'defending'), 0)
    ) AS best_core_stat
  FROM sofifa_players
)

-- ── 1. Headline ─────────────────────────────────────────────────────────────
SELECT
  COUNT(*)                                                   AS total_rows,
  COUNT(*) FILTER (WHERE best_core_stat > 0)                 AS has_stats,
  COUNT(*) FILTER (WHERE best_core_stat = 0)                 AS missing_stats,
  ROUND(100.0 * COUNT(*) FILTER (WHERE best_core_stat = 0)
        / NULLIF(COUNT(*), 0), 1)                            AS pct_missing
FROM parsed;


-- ── 2. Per edition — which imports to redo ──────────────────────────────────
-- Run this separately (highlight it and press Run). Re-create the helper and
-- the CTE first if you opened a new editor tab.
/*
WITH parsed AS (
  SELECT
    fifa_year,
    fifa_edition,
    GREATEST(
      COALESCE(pg_temp.attr_num(attributes->>'Pace'),      0),
      COALESCE(pg_temp.attr_num(attributes->>'attr_pac'),  0),
      COALESCE(pg_temp.attr_num(attributes->>'pac'),       0),
      COALESCE(pg_temp.attr_num(attributes->>'Shooting'),  0),
      COALESCE(pg_temp.attr_num(attributes->>'attr_sho'),  0),
      COALESCE(pg_temp.attr_num(attributes->>'shooting'),  0),
      COALESCE(pg_temp.attr_num(attributes->>'Passing'),   0),
      COALESCE(pg_temp.attr_num(attributes->>'attr_pas'),  0),
      COALESCE(pg_temp.attr_num(attributes->>'passing'),   0),
      COALESCE(pg_temp.attr_num(attributes->>'Defending'), 0),
      COALESCE(pg_temp.attr_num(attributes->>'attr_def'),  0),
      COALESCE(pg_temp.attr_num(attributes->>'defending'), 0)
    ) AS best_core_stat
  FROM sofifa_players
)
SELECT
  fifa_year,
  MIN(fifa_edition)                                          AS edition,
  COUNT(*)                                                   AS rows,
  COUNT(*) FILTER (WHERE best_core_stat = 0)                 AS missing_stats,
  ROUND(100.0 * COUNT(*) FILTER (WHERE best_core_stat = 0)
        / NULLIF(COUNT(*), 0), 1)                            AS pct_missing
FROM parsed
GROUP BY fifa_year
ORDER BY fifa_year DESC;
*/


-- ── 3. Premier League only ──────────────────────────────────────────────────
-- The draft only ever picks from the Premier League, so this is the number that
-- actually affects the games. Add to the CTE's FROM clause:
--     WHERE league ILIKE 'Premier League%'
--        OR league ILIKE 'English Premier League%'
--        OR league ILIKE 'Barclays Premier League%'
-- (This scans the table — fine as a one-off, but don't put it in a route.)


-- ── 4. Which key spelling is in use ─────────────────────────────────────────
-- Useful if the numbers above look wrong: it shows whether an edition stores
-- attributes under a spelling lib/playerAttributes.ts doesn't know about yet.
/*
SELECT fifa_year, k AS attribute_key, COUNT(*) AS rows
FROM sofifa_players, LATERAL jsonb_object_keys(attributes) AS k
WHERE attributes IS NOT NULL
GROUP BY fifa_year, k
ORDER BY fifa_year DESC, rows DESC;
*/
