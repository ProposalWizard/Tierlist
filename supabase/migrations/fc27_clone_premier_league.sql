-- ============================================================================
-- FC 27 (2026/27) — cloned from the FC 26 Premier League
-- Run this in the Supabase SQL Editor. Safe to run more than once.
-- ============================================================================
--
-- RUN THE FOUR STEPS IN ORDER AND READ WHAT EACH ONE RETURNS. The Supabase SQL
-- Editor shows only the LAST statement's result, so run them one at a time
-- (select the block, then Run) rather than the whole file at once — otherwise a
-- step that finds nothing looks exactly like a step that worked.
--
-- WHY THIS EXISTS
--
-- FC 27 does not exist yet and the 2026/27 season is about to start, so the
-- database is made by hand: every Premier League player in FC 26 copied into
-- fifa_year 2027, a year older, then edited in /admin/football/players as the
-- window plays out.
--
-- WHAT IT TOUCHES
--
--   * Only writes fifa_year = 2027. FC 26 is never modified.
--   * English clubs only — SoFIFA gives Russia's and Ukraine's top divisions the
--     same league name, so they are excluded by the closed list below, which is
--     the one /api/draft/clubs uses.
--   * ON CONFLICT DO NOTHING, so re-running after you have started editing
--     fills in anybody missing and undoes nothing.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 1 — What is there to copy?
-- ════════════════════════════════════════════════════════════════════════════
-- Run this FIRST. If `to_copy` is 0 the insert cannot do anything and the rest
-- of the file is pointless — the answer is in this row, not in the insert.

SELECT
  COUNT(*) FILTER (WHERE fifa_year = 2026)                                  AS all_fc26,
  COUNT(*) FILTER (WHERE fifa_year = 2026 AND league IS NULL)               AS fc26_no_league,
  COUNT(*) FILTER (WHERE fifa_year = 2027)                                  AS already_fc27,
  COUNT(*) FILTER (
    WHERE fifa_year = 2026
      AND (league ILIKE 'Premier League%'
        OR league ILIKE 'English Premier League%'
        OR league ILIKE 'Barclays Premier League%')
  )                                                                          AS to_copy
FROM sofifa_players;

-- If `to_copy` is 0 but `all_fc26` is not, the league column is spelled
-- something this does not match. This shows what it actually says:

SELECT league, COUNT(*) AS players, COUNT(DISTINCT club) AS clubs
FROM sofifa_players
WHERE fifa_year = 2026 AND league IS NOT NULL
GROUP BY league
ORDER BY players DESC
LIMIT 15;


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 2 — Copy them
-- ════════════════════════════════════════════════════════════════════════════
-- Deliberately NOT wrapped in BEGIN/COMMIT: if something fails you want to see
-- it fail, not watch a transaction roll back and report nothing.
--
-- The RETURNING clause makes the result unambiguous — the editor prints the rows
-- that were actually written. No rows returned means no rows written.

INSERT INTO sofifa_players (
  sofifa_id, fifa_year, fifa_edition, name, positions, nationality,
  club, league, overall, potential, age, image_url, attributes,
  manual_overall, manual_positions, manual_nationality
)
SELECT
  p.sofifa_id,
  2027,
  'FC 27',
  p.name,
  p.positions,
  p.nationality,
  p.club,
  p.league,
  p.overall,
  p.potential,
  -- A year older. The age column where it is set, otherwise whatever the
  -- attributes blob carries — older imports left the column null and put it
  -- there. Non-numeric characters are stripped first; "28 +2" values exist.
  COALESCE(
    p.age,
    NULLIF(regexp_replace(COALESCE(p.attributes ->> 'age', ''),     '[^0-9]', '', 'g'), '')::int,
    NULLIF(regexp_replace(COALESCE(p.attributes ->> 'attr_ae', ''), '[^0-9]', '', 'g'), '')::int
  ) + 1,
  p.image_url,
  -- The blob's own age key kept in step, so the two can never disagree.
  -- `->> IS NOT NULL` rather than the `?` operator on purpose: `?` is a
  -- parameter placeholder in a great many SQL clients and drivers, and a
  -- migration that only runs in some of them is worse than one that is a
  -- little more verbose.
  CASE
    WHEN p.attributes -> 'age' IS NOT NULL THEN
      jsonb_set(
        p.attributes, '{age}',
        to_jsonb(
          COALESCE(NULLIF(regexp_replace(COALESCE(p.attributes ->> 'age', ''), '[^0-9]', '', 'g'), '')::int, 0) + 1
        )
      )
    ELSE COALESCE(p.attributes, '{}'::jsonb)
  END,
  -- The admin overrides come too. A rating you corrected by hand in FC 26 was
  -- correct, and you would only have to type it again.
  p.manual_overall,
  p.manual_positions,
  p.manual_nationality
FROM sofifa_players p
WHERE p.fifa_year = 2026
  AND (
    p.league ILIKE 'Premier League%'
    OR p.league ILIKE 'English Premier League%'
    OR p.league ILIKE 'Barclays Premier League%'
  )
  AND LOWER(TRIM(COALESCE(p.club, ''))) NOT IN (
    'dynamo kyiv', 'shakhtar donetsk',
    'akhmat grozny', 'alaniya', 'arsenal tula', 'fc amkar perm',
    'fc anzhi makhachkala', 'fc dynamo moscow', 'fc khimki', 'fc krasnodar',
    'fc kuban krasnodar', 'fc lokomotiv', 'fc moscow', 'fc orenburg',
    'fc rostov', 'fc tom tomsk', 'fc tosno', 'fc ufa', 'fc ural yekaterinburg',
    'fc volga nizhny novgorod', 'mordovia saransk', 'pfc cska',
    'pfc krylia sovetov samara', 'rubin kazan', 'ska khabarovsk',
    'saturn ramenskoye', 'spartak moscow', 'spartak nalchik', 'torpedo moscow',
    'fc sibir novosibirsk', 'zenit', ''
  )
ON CONFLICT (sofifa_id, fifa_year) DO NOTHING
RETURNING sofifa_id, name, club, age, overall;


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 3 — Did it work?
-- ════════════════════════════════════════════════════════════════════════════
-- Same clubs, same headcount, everybody one year older.

SELECT
  club,
  COUNT(*) FILTER (WHERE fifa_year = 2026)            AS fc26,
  COUNT(*) FILTER (WHERE fifa_year = 2027)            AS fc27,
  ROUND(AVG(age) FILTER (WHERE fifa_year = 2026), 1)  AS avg_age_26,
  ROUND(AVG(age) FILTER (WHERE fifa_year = 2027), 1)  AS avg_age_27
FROM sofifa_players
WHERE fifa_year IN (2026, 2027)
  AND (league ILIKE 'Premier League%' OR league ILIKE 'English Premier League%')
GROUP BY club
ORDER BY club;


-- ════════════════════════════════════════════════════════════════════════════
-- STEP 4 — Anybody whose age did not move (should return no rows)
-- ════════════════════════════════════════════════════════════════════════════

SELECT a.name, a.club, a.age AS fc26_age, b.age AS fc27_age
FROM sofifa_players a
JOIN sofifa_players b ON b.sofifa_id = a.sofifa_id AND b.fifa_year = 2027
WHERE a.fifa_year = 2026
  AND b.age IS DISTINCT FROM a.age + 1
LIMIT 50;


-- ============================================================================
-- ROLLBACK — deletes every FC 27 row, INCLUDING any edits you have made
-- ============================================================================
-- DELETE FROM sofifa_players WHERE fifa_year = 2027;
