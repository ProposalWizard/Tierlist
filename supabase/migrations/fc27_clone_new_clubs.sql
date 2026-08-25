-- ============================================================================
-- FC 27 (2026/27) — cloned from FC 26 for every NEW club this season
-- ============================================================================
--
-- HOW TO RUN IT
--
--   Copy this whole file. Paste it into the Supabase SQL Editor. Press Run once.
--
-- Same shape as fc27_clone_premier_league.sql, and it is worth reading that
-- file's own header if you have not — this one only covers what changed.
--
--   players_found ...... matched in FC 26 across every club below
--   copied_now ......... how many it just wrote into FC 27
--   clubs_found ........ the club names it matched, so you can see they're right
--   if_zero_send_me_this  every FC 26 league name, ONLY if nothing matched at all
--
-- Safe to run as many times as you like — ON CONFLICT DO NOTHING only fills in
-- players who are missing, never touches an edit you've made, and FC 26 is
-- never modified.
--
--
-- WHICH CLUBS, AND WHY THIS LIST ISN'T "every club the user just named"
--
-- Twenty-nine clubs — every one that is NEW to the FC 27 database this
-- season, and only those:
--
--   The three promoted into the Premier League: Coventry City, Ipswich
--   Town, Hull City.
--
--   Twenty-one of the twenty-four Championship clubs. NOT all twenty-four —
--   Burnley, West Ham United and Wolverhampton Wanderers are also in this
--   season's Championship (relegated from the Premier League), but their FC
--   27 rows already exist from the original Premier League clone and a
--   division change is a game-logic fact, not a database one. Re-running
--   their clone would do nothing anyway (ON CONFLICT DO NOTHING), but they
--   are left out of the WHERE clause here so `clubs_found` reads as exactly
--   the twenty-nine that actually needed it, not twenty-nine plus three
--   no-ops.
--
--   The five clubs that make up this season's promotion pool: Luton Town,
--   Huddersfield Town, Leicester City, Reading, Wigan Athletic. None of them
--   play a Championship fixture yet, but a member of this pool can be
--   promoted INTO the Championship mid-career, at which point it needs a
--   real squad the same as anyone already there — cloned now rather than
--   the moment it is needed, so a promotion never has to wait on a database
--   migration to resolve.
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
    COALESCE(
      p.age,
      NULLIF(regexp_replace(COALESCE(p.attributes ->> 'age', ''),     '[^0-9]', '', 'g'), '')::int,
      NULLIF(regexp_replace(COALESCE(p.attributes ->> 'attr_ae', ''), '[^0-9]', '', 'g'), '')::int
    ) + 1                      AS age,
    p.image_url,
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
    p.manual_overall,
    p.manual_positions,
    p.manual_nationality
  FROM sofifa_players p
  WHERE p.fifa_year = 2026
    AND regexp_replace(LOWER(COALESCE(p.club, '')), '[^a-z]', '', 'g') IN (
      -- Promoted into the Premier League
      'coventrycity', 'coventry',
      'ipswichtown', 'ipswich',
      'hullcity', 'hull',
      -- The Championship, minus the three relegated PL clubs already cloned
      'queensparkrangers', 'qpr',
      -- 'millwall' alone was the original guess — every sibling club with the
      -- same "FC" ambiguity (Wrexham, Reading, Portsmouth, Southampton below)
      -- got both forms; this one did not, and lib/star/clubs.ts asks for the
      -- full "Millwall FC" — reported directly as the one Championship club
      -- still showing fake players after every other one came through.
      'millwall', 'millwallfc',
      'boltonwanderers', 'bolton',
      'watford',
      'middlesbrough',
      'charltonathletic', 'charlton',
      'swanseacity', 'swansea',
      'westbromwichalbion', 'westbromwich', 'westbrom', 'wba',
      'blackburnrovers', 'blackburn',
      'cardiffcity', 'cardiff',
      'wrexham', 'wrexhamafc',
      'birminghamcity', 'birmingham',
      'sheffieldunited', 'sheffieldutd',
      'lincolncity', 'lincoln',
      'prestonnorthend', 'preston',
      'norwichcity', 'norwich',
      'stokecity', 'stoke',
      'derbycounty', 'derby',
      'portsmouth', 'portsmouthfc',
      'bristolcity',
      'southampton', 'southamptonfc',
      -- This season's promotion pool
      'lutontown', 'luton',
      'huddersfieldtown', 'huddersfield',
      'leicestercity', 'leicester',
      'reading', 'readingfc',
      'wiganathletic', 'wigan'
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
  (SELECT COUNT(*) FROM sofifa_players WHERE fifa_year = 2027)      AS fc27_total_now,
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
-- OPTIONAL — which of the twenty-nine actually matched
-- ════════════════════════════════════════════════════════════════════════════
-- Run on its own. Twenty-nine rows if everything matched; anything missing
-- from the list tells you exactly which club's SoFIFA spelling isn't covered
-- by the WHERE clause above yet, so a name variant can be added and the whole
-- file re-run — it is safe to run again, see the header.
--
-- WITH wanted(club) AS (VALUES
--   ('Coventry City'), ('Ipswich Town'), ('Hull City'),
--   ('Queens Park Rangers'), ('Millwall FC'), ('Bolton Wanderers'), ('Watford'),
--   ('Middlesbrough'), ('Charlton Athletic'), ('Swansea City'),
--   ('West Bromwich Albion'), ('Blackburn Rovers'), ('Cardiff City'),
--   ('Wrexham'), ('Birmingham City'), ('Sheffield United'), ('Lincoln City'),
--   ('Preston North End'), ('Norwich City'), ('Stoke City'), ('Derby County'),
--   ('Portsmouth'), ('Bristol City'), ('Southampton'),
--   ('Luton Town'), ('Huddersfield Town'), ('Leicester City'), ('Reading'),
--   ('Wigan Athletic')
-- )
-- SELECT w.club,
--   EXISTS (
--     SELECT 1 FROM sofifa_players p
--     WHERE p.fifa_year = 2027
--       AND regexp_replace(LOWER(p.club), '[^a-z]', '', 'g')
--         = regexp_replace(LOWER(w.club), '[^a-z]', '', 'g')
--   ) AS matched
-- FROM wanted w
-- ORDER BY matched, w.club;


-- ============================================================================
-- ROLLBACK — deletes only what THIS migration adds, by club name, not the
-- whole FC 27 table (fc27_clone_premier_league.sql's rollback would also
-- delete the original twenty, including any edits you've made to them)
-- ============================================================================
-- DELETE FROM sofifa_players
-- WHERE fifa_year = 2027
--   AND regexp_replace(LOWER(COALESCE(club, '')), '[^a-z]', '', 'g') IN (
--     'coventrycity', 'coventry', 'ipswichtown', 'ipswich', 'hullcity', 'hull',
--     'queensparkrangers', 'qpr', 'millwall', 'millwallfc', 'boltonwanderers', 'bolton',
--     'watford', 'middlesbrough', 'charltonathletic', 'charlton',
--     'swanseacity', 'swansea', 'westbromwichalbion', 'westbromwich',
--     'westbrom', 'wba', 'blackburnrovers', 'blackburn', 'cardiffcity',
--     'cardiff', 'wrexham', 'wrexhamafc', 'birminghamcity', 'birmingham',
--     'sheffieldunited', 'sheffieldutd', 'lincolncity', 'lincoln',
--     'prestonnorthend', 'preston', 'norwichcity', 'norwich', 'stokecity',
--     'stoke', 'derbycounty', 'derby', 'portsmouth', 'portsmouthfc',
--     'bristolcity', 'southampton', 'southamptonfc', 'lutontown', 'luton',
--     'huddersfieldtown', 'huddersfield', 'leicestercity', 'leicester',
--     'reading', 'readingfc', 'wiganathletic', 'wigan'
--   );
