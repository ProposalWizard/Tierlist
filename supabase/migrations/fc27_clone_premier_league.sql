-- ============================================================================
-- FC 27 (2026/27) — cloned from the FC 26 Premier League
-- Run this in the Supabase SQL Editor. Safe to run more than once.
-- ============================================================================
--
-- WHY
--
-- FC 27 does not exist yet, and the 2026/27 season is about to start. So the
-- 2026/27 database is made by hand: take every Premier League player in FC 26,
-- copy them into fifa_year 2027, add a year to everybody's age, and then edit
-- the copies — transfers, ratings, promoted clubs — in the admin player editor
-- (/admin/football/players, which now offers FC 27 in its year picker).
--
-- WHAT IT TOUCHES
--
--   * Only fifa_year = 2027 rows are created. FC 26 is not modified in any way.
--   * Only ENGLISH Premier League clubs. SoFIFA gives Russia's and Ukraine's top
--     divisions the same league name, so those clubs are excluded by name, the
--     same list /api/draft/clubs uses.
--
-- RE-RUNNING IT
--
-- `ON CONFLICT DO NOTHING` on (sofifa_id, fifa_year). So once a player exists in
-- FC 27 he is left completely alone — running this again after you have started
-- editing will NOT undo your work. It only fills in anybody missing.
--
-- To start again from scratch, see the rollback at the bottom.
-- ============================================================================

BEGIN;

INSERT INTO sofifa_players (
  sofifa_id, fifa_year, fifa_edition, name, positions, nationality,
  club, league, overall, potential, age, image_url, attributes,
  manual_overall, manual_positions, manual_nationality
)
SELECT
  p.sofifa_id,
  2027                AS fifa_year,
  'FC 27'             AS fifa_edition,
  p.name,
  p.positions,
  p.nationality,
  p.club,
  p.league,
  p.overall,
  p.potential,
  -- ── A year older ──
  -- The age column where it is set, otherwise whatever the attributes blob
  -- carries, because older imports left the column null and put it in there.
  -- Everything non-numeric is stripped first ("28 +2" style values exist).
  COALESCE(
    p.age,
    NULLIF(regexp_replace(COALESCE(p.attributes->>'age', ''),      '\D', '', 'g'), '')::int,
    NULLIF(regexp_replace(COALESCE(p.attributes->>'attr_ae', ''),  '\D', '', 'g'), '')::int
  ) + 1               AS age,
  p.image_url,
  -- …and the same year inside the blob, so the two can never disagree. Only
  -- keys that are already there are touched.
  CASE
    WHEN p.attributes ? 'age'
      THEN jsonb_set(
        p.attributes, '{age}',
        to_jsonb(
          COALESCE(NULLIF(regexp_replace(COALESCE(p.attributes->>'age', ''), '\D', '', 'g'), '')::int, 0) + 1
        )
      )
    ELSE COALESCE(p.attributes, '{}'::jsonb)
  END                 AS attributes,
  -- The admin overrides come with them: a rating you corrected by hand in FC 26
  -- was correct, and you would only have to type it again.
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
  -- SoFIFA calls Russia's and Ukraine's top divisions "Premier League" too.
  -- This is the same closed list /api/draft/clubs uses to keep them out.
  AND LOWER(TRIM(p.club)) NOT IN (
    'dynamo kyiv', 'shakhtar donetsk',
    'akhmat grozny', 'alaniya', 'arsenal tula', 'fc amkar perm',
    'fc anzhi makhachkala', 'fc dynamo moscow', 'fc khimki', 'fc krasnodar',
    'fc kuban krasnodar', 'fc lokomotiv', 'fc moscow', 'fc orenburg',
    'fc rostov', 'fc tom tomsk', 'fc tosno', 'fc ufa', 'fc ural yekaterinburg',
    'fc volga nizhny novgorod', 'mordovia saransk', 'pfc cska',
    'pfc krylia sovetov samara', 'rubin kazan', 'ska khabarovsk',
    'saturn ramenskoye', 'spartak moscow', 'spartak nalchik', 'torpedo moscow',
    'fc sibir novosibirsk', 'zenit'
  )
ON CONFLICT (sofifa_id, fifa_year) DO NOTHING;

COMMIT;

-- ============================================================================
-- CHECK IT WORKED
-- ============================================================================
-- Same clubs, same headcount, everybody a year older.

SELECT
  club,
  COUNT(*) FILTER (WHERE fifa_year = 2026) AS fc26,
  COUNT(*) FILTER (WHERE fifa_year = 2027) AS fc27,
  ROUND(AVG(age) FILTER (WHERE fifa_year = 2026), 1) AS avg_age_26,
  ROUND(AVG(age) FILTER (WHERE fifa_year = 2027), 1) AS avg_age_27
FROM sofifa_players
WHERE fifa_year IN (2026, 2027)
  AND (league ILIKE 'Premier League%' OR league ILIKE 'English Premier League%')
GROUP BY club
ORDER BY club;

-- Anybody whose age did not move (should return no rows).
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
