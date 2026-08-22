-- ============================================================================
-- Find the real SoFIFA spelling for the eleven clubs the European clone
-- reported as unmatched
-- ============================================================================
--
-- HOW TO RUN IT
--
--   Read-only. Copy the whole file into the Supabase SQL Editor and run it —
--   nothing here writes or deletes anything. Send back the results (or a
--   screenshot) and I'll fold whatever spelling shows up into
--   fc27_clone_european_clubs.sql's variant lists and re-run that clone —
--   ON CONFLICT DO NOTHING means re-running it is safe and only fills in
--   whatever is still missing.
--
-- WHY THE FIRST DIAGNOSTIC SAID false
--
-- fc27_clone_european_clubs.sql's check is an EXACT match against a fixed
-- list of guessed spellings, stripped of everything but a-z. That is brittle
-- in exactly the way it looks brittle: a real club whose SoFIFA row carries
-- one extra word my guess didn't ("Real Betis Balompié CF" instead of "Real
-- Betis Balompié"), a different house style for a diacritic, or a club
-- SoFIFA simply doesn't license this edition, all report the same `false` —
-- and there is no way to tell those apart from a boolean.
--
-- This instead searches loosely (ILIKE, matching if EITHER a short root of
-- the club's name appears in SoFIFA's club field, so a real difference in
-- suffix or spelling still turns up) and shows you every row that comes
-- back, across both FIFA years already in the table. A club with a real row
-- here just has the wrong string in the migration's variant list — a club
-- with NO rows either isn't licensed this edition or needs a different root
-- than the one guessed below.
-- ============================================================================

SELECT 'Bodø/Glimt' AS looking_for, sofifa_id, fifa_year, name, club, league
FROM sofifa_players
WHERE fifa_year IN (2026, 2027)
  AND (club ILIKE '%bod%glimt%' OR club ILIKE '%glimt%')

UNION ALL
SELECT 'Lille', sofifa_id, fifa_year, name, club, league
FROM sofifa_players
WHERE fifa_year IN (2026, 2027) AND (club ILIKE '%lille%' OR club ILIKE '%losc%')

UNION ALL
SELECT 'Real Betis', sofifa_id, fifa_year, name, club, league
FROM sofifa_players
WHERE fifa_year IN (2026, 2027) AND club ILIKE '%betis%'

UNION ALL
SELECT 'Slovan Bratislava', sofifa_id, fifa_year, name, club, league
FROM sofifa_players
WHERE fifa_year IN (2026, 2027) AND (club ILIKE '%slovan%' OR club ILIKE '%bratislava%')

UNION ALL
SELECT 'Crvena Zvezda', sofifa_id, fifa_year, name, club, league
FROM sofifa_players
WHERE fifa_year IN (2026, 2027)
  AND (club ILIKE '%crvena%' OR club ILIKE '%zvezda%' OR club ILIKE '%red star%' OR club ILIKE '%redstar%')

UNION ALL
SELECT 'Ferencváros', sofifa_id, fifa_year, name, club, league
FROM sofifa_players
WHERE fifa_year IN (2026, 2027) AND club ILIKE '%ferenc%'

UNION ALL
SELECT 'Omonia Nicosia', sofifa_id, fifa_year, name, club, league
FROM sofifa_players
WHERE fifa_year IN (2026, 2027) AND (club ILIKE '%omonia%' OR club ILIKE '%nicosia%')

UNION ALL
SELECT 'Pafos', sofifa_id, fifa_year, name, club, league
FROM sofifa_players
WHERE fifa_year IN (2026, 2027) AND club ILIKE '%pafos%'

UNION ALL
SELECT 'Torreense', sofifa_id, fifa_year, name, club, league
FROM sofifa_players
WHERE fifa_year IN (2026, 2027) AND club ILIKE '%torreense%'

UNION ALL
SELECT 'Al Ahli', sofifa_id, fifa_year, name, club, league
FROM sofifa_players
WHERE fifa_year IN (2026, 2027) AND club ILIKE '%al%ahli%'

UNION ALL
SELECT 'Schalke', sofifa_id, fifa_year, name, club, league
FROM sofifa_players
WHERE fifa_year IN (2026, 2027) AND club ILIKE '%schalke%'

ORDER BY looking_for, fifa_year;

-- ── If a club above returns NO rows at all ──
--
-- It is genuinely not in the table under any spelling close to the one
-- given, for either year. Al Ahli in particular is ambiguous by name alone —
-- there is an Al Ahli in the Saudi Pro League (the one meant here) and an
-- Al Ahli in the Egyptian Premier League that EA has licensed in some
-- editions; if a row does turn up, check its `league` column reads Saudi
-- before treating it as a match. For any club that comes back completely
-- empty, the real fix is a replacement club rather than a spelling — tell me
-- and I'll swap it into the Europa League / Other list.
