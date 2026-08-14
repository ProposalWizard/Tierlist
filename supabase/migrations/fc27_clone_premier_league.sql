-- ============================================================================
-- FC 27 (2026/27) — cloned from the FC 26 Premier League
-- ============================================================================
--
-- HOW TO RUN IT
--
--   Copy this whole file. Paste it into the Supabase SQL Editor. Press Run once.
--
-- That is all. It is ONE statement, so the editor cannot show you the wrong
-- result, and it prints a row of numbers telling you exactly what happened.
--
--   players_found ...... Premier League players it found in FC 26
--   copied_now ......... how many it just wrote into FC 27
--   fc27_before ........ how many FC 27 players already existed beforehand
--   clubs_found ........ the club names it matched, so you can see they're right
--
--   copied_now > 0                     → it worked. Reload /lineups.
--   copied_now = 0 and fc27_before > 0 → already done. Nothing to do.
--   players_found = 0                  → nothing matched. The last column then
--                                        lists every league name FC 26 actually
--                                        uses — send me that list.
--
-- Safe to run as many times as you like: ON CONFLICT DO NOTHING means it only
-- ever fills in players who are missing, and never touches an edit you've made.
-- FC 26 itself is never modified.
--
--
-- WHY IT MATCHES ON CLUB NAME AND NOT LEAGUE NAME
--
-- The earlier version filtered on `league LIKE 'Premier League%'` and found
-- nothing twice, which means the league column in this database does not say
-- what we assumed. The twenty club names are not a guess — they are the same
-- twenty in lib/star/kits.ts, and they are compared with the punctuation and
-- spacing stripped out, so "Fulham", "Fulham FC" and "AFC Bournemouth" all
-- match whichever way SoFIFA happened to write them.
-- ============================================================================

WITH src AS (
  SELECT
    p.sofifa_id,
    2027                       AS fifa_year,
    'FC 27'                    AS fifa_edition,
    p.name,
    p.positions,
    p.nationality,
    p.club,
    p.league,
    p.overall,
    p.potential,
    -- A year older. From the age column where it's set, otherwise out of the
    -- attributes blob — older imports left the column null and put it there.
    -- Non-numeric characters stripped first; values like "28 +2" exist.
    COALESCE(
      p.age,
      NULLIF(regexp_replace(COALESCE(p.attributes ->> 'age', ''),     '[^0-9]', '', 'g'), '')::int,
      NULLIF(regexp_replace(COALESCE(p.attributes ->> 'attr_ae', ''), '[^0-9]', '', 'g'), '')::int
    ) + 1                      AS age,
    p.image_url,
    -- The blob's own age key kept in step, so the two can never disagree.
    -- `-> 'age' IS NOT NULL` rather than the `?` key-exists operator on purpose:
    -- `?` is a parameter placeholder in a great many SQL clients.
    CASE
      WHEN p.attributes -> 'age' IS NOT NULL THEN
        jsonb_set(
          p.attributes, '{age}',
          to_jsonb(
            COALESCE(NULLIF(regexp_replace(COALESCE(p.attributes ->> 'age', ''), '[^0-9]', '', 'g'), '')::int, 0) + 1
          )
        )
      ELSE COALESCE(p.attributes, '{}'::jsonb)
    END                        AS attributes,
    -- The admin overrides come too. A rating corrected by hand in FC 26 was
    -- correct, and you'd only have to type it again.
    p.manual_overall,
    p.manual_positions,
    p.manual_nationality
  FROM sofifa_players p
  WHERE p.fifa_year = 2026
    AND regexp_replace(LOWER(COALESCE(p.club, '')), '[^a-z]', '', 'g') IN (
      'arsenal',
      'astonvilla',
      'afcbournemouth', 'bournemouth',
      'brentford',
      'brightonhovealbion', 'brightonandhovealbion', 'brighton',
      'burnley',
      'chelsea',
      'crystalpalace',
      'everton',
      'fulhamfc', 'fulham',
      'leedsunited', 'leeds',
      'liverpool',
      'manchestercity',
      'manchesterunited',
      'newcastleunited',
      'nottinghamforest', 'nottmforest',
      'sunderland',
      'tottenhamhotspur',
      'westhamunited',
      'wolverhamptonwanderers', 'wolves'
    )
),
ins AS (
  INSERT INTO sofifa_players (
    sofifa_id, fifa_year, fifa_edition, name, positions, nationality,
    club, league, overall, potential, age, image_url, attributes,
    manual_overall, manual_positions, manual_nationality
  )
  SELECT
    sofifa_id, fifa_year, fifa_edition, name, positions, nationality,
    club, league, overall, potential, age, image_url, attributes,
    manual_overall, manual_positions, manual_nationality
  FROM src
  ON CONFLICT (sofifa_id, fifa_year) DO NOTHING
  RETURNING 1 AS written
)
SELECT
  (SELECT COUNT(*) FROM src)                                        AS players_found,
  (SELECT COUNT(DISTINCT club) FROM src)                            AS clubs_matched,
  (SELECT COUNT(*) FROM ins)                                        AS copied_now,
  (SELECT COUNT(*) FROM sofifa_players WHERE fifa_year = 2027)      AS fc27_before,
  (SELECT COUNT(*) FROM sofifa_players WHERE fifa_year = 2026)      AS fc26_total,
  (SELECT string_agg(DISTINCT club, ' | ') FROM src)                AS clubs_found,
  CASE
    WHEN (SELECT COUNT(*) FROM src) > 0 THEN 'not needed — players were found'
    ELSE COALESCE(
      (SELECT string_agg(DISTINCT COALESCE(league, '(no league)'), ' | ')
       FROM sofifa_players WHERE fifa_year = 2026),
      'there are no fifa_year = 2026 rows at all'
    )
  END                                                                AS if_zero_send_me_this;


-- ════════════════════════════════════════════════════════════════════════════
-- OPTIONAL — only if you want to check the ages afterwards
-- ════════════════════════════════════════════════════════════════════════════
-- Run on its own. Same clubs both sides, average age one year higher in FC 27.
--
-- SELECT
--   club,
--   COUNT(*) FILTER (WHERE fifa_year = 2026)            AS fc26,
--   COUNT(*) FILTER (WHERE fifa_year = 2027)            AS fc27,
--   ROUND(AVG(age) FILTER (WHERE fifa_year = 2026), 1)  AS avg_age_26,
--   ROUND(AVG(age) FILTER (WHERE fifa_year = 2027), 1)  AS avg_age_27
-- FROM sofifa_players
-- WHERE fifa_year IN (2026, 2027)
-- GROUP BY club
-- HAVING COUNT(*) FILTER (WHERE fifa_year = 2027) > 0
-- ORDER BY club;


-- ============================================================================
-- ROLLBACK — deletes every FC 27 row, INCLUDING any edits you have made
-- ============================================================================
-- DELETE FROM sofifa_players WHERE fifa_year = 2027;
