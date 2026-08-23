-- ============================================================================
-- Backfill missing positions/nationality on FC 27 from an earlier edition
-- ============================================================================
--
-- WHAT HAPPENED
--
-- FC 26's scrape never captured `positions` or `nationality` for anybody
-- outside the Premier League — every other FIFA/FC edition this database
-- holds did capture both. Every FC27 row this season's clone work created
-- was copied FROM that FC26 source, so the gap carried straight through:
-- Harry Kane's FC27 row has no position and no nationality, because his
-- FC26 row never had them either — even though his FC25 row says striker,
-- England, plain as day.
--
-- Reported directly, with the fix already scoped: not a re-scrape, not a
-- delete-and-reclone (which would risk losing every hand-edited transfer
-- made since) — read the same player's data off whichever earlier edition
-- actually has it, matched by `sofifa_id`, which is stable across every
-- edition a player has ever appeared in.
--
--
-- WHY THIS WRITES manual_positions / manual_nationality, NOT positions /
-- nationality THEMSELVES
--
-- Those two columns are already the established override mechanism in this
-- database — the Lineups fetch (app/api/star/league-squads) already reads
-- `manual_positions || positions` and `manual_nationality || nationality`,
-- manual winning where set. Writing there means: the real scraped columns
-- stay exactly what FC26 actually said (empty, honestly), and this fix is
-- clearly a distinct, later correction layered on top — not indistinguishable
-- from data SoFIFA itself provided. It is also strictly safer to run more
-- than once: nothing here ever touches a row that already has a real value
-- OR an existing manual override, in either column, independently.
--
--
-- WHICH EDITION IT BORROWS FROM
--
-- Not hardcoded to FC25 — some players will not have existed yet in FC25,
-- or their best real record sits somewhere else. For each player, this
-- reads whichever edition (excluding FC26 and FC27 themselves) is the MOST
-- RECENT one where that field is actually populated, so a player with real
-- data all the way back to FC20 uses the freshest one available.
--
--
-- HOW TO RUN IT
--
-- 1. Run the look-first query below. It costs nothing and changes nothing —
--    check the numbers look like what you would expect (roughly the whole
--    non-Premier-League FC27 population) before running the two UPDATEs.
-- 2. Run the "positions" UPDATE, then the "nationality" one. Independent of
--    each other on purpose, in case a player has real data for one field
--    but not the other in every edition that has him at all.
-- 3. Run the "after" query at the bottom to confirm — Harry Kane is in
--    there by name specifically, since he is the example this was reported
--    against.
-- ============================================================================


-- ── 1. Look first ──
-- How many FC27 rows are missing positions/nationality, and how many of
-- those actually have an earlier edition to borrow from (a small number may
-- have neither — a player who has only ever existed in FC26/FC27 — and
-- those necessarily stay empty; nothing to backfill FROM).

WITH earlier_positions AS (
  SELECT DISTINCT ON (sofifa_id) sofifa_id, positions, fifa_year AS source_year
  FROM sofifa_players
  WHERE fifa_year NOT IN (2026, 2027) AND positions IS NOT NULL AND positions <> ''
  ORDER BY sofifa_id, fifa_year DESC
),
earlier_nationality AS (
  SELECT DISTINCT ON (sofifa_id) sofifa_id, nationality, fifa_year AS source_year
  FROM sofifa_players
  WHERE fifa_year NOT IN (2026, 2027) AND nationality IS NOT NULL AND nationality <> ''
  ORDER BY sofifa_id, fifa_year DESC
)
SELECT
  COUNT(*) FILTER (
    WHERE (p.positions IS NULL OR p.positions = '')
      AND (p.manual_positions IS NULL OR p.manual_positions = '')
  ) AS missing_positions,
  COUNT(*) FILTER (
    WHERE (p.positions IS NULL OR p.positions = '')
      AND (p.manual_positions IS NULL OR p.manual_positions = '')
      AND ep.sofifa_id IS NOT NULL
  ) AS positions_fixable,
  COUNT(*) FILTER (
    WHERE (p.nationality IS NULL OR p.nationality = '')
      AND (p.manual_nationality IS NULL OR p.manual_nationality = '')
  ) AS missing_nationality,
  COUNT(*) FILTER (
    WHERE (p.nationality IS NULL OR p.nationality = '')
      AND (p.manual_nationality IS NULL OR p.manual_nationality = '')
      AND en.sofifa_id IS NOT NULL
  ) AS nationality_fixable
FROM sofifa_players p
LEFT JOIN earlier_positions ep ON ep.sofifa_id = p.sofifa_id
LEFT JOIN earlier_nationality en ON en.sofifa_id = p.sofifa_id
WHERE p.fifa_year = 2027;


-- ── 2a. Backfill positions ──

WITH source AS (
  SELECT DISTINCT ON (sofifa_id) sofifa_id, positions, fifa_year AS source_year
  FROM sofifa_players
  WHERE fifa_year NOT IN (2026, 2027) AND positions IS NOT NULL AND positions <> ''
  ORDER BY sofifa_id, fifa_year DESC
)
UPDATE sofifa_players p
SET manual_positions = s.positions
FROM source s
WHERE p.sofifa_id = s.sofifa_id
  AND p.fifa_year = 2027
  AND (p.positions IS NULL OR p.positions = '')
  AND (p.manual_positions IS NULL OR p.manual_positions = '');


-- ── 2b. Backfill nationality ──

WITH source AS (
  SELECT DISTINCT ON (sofifa_id) sofifa_id, nationality, fifa_year AS source_year
  FROM sofifa_players
  WHERE fifa_year NOT IN (2026, 2027) AND nationality IS NOT NULL AND nationality <> ''
  ORDER BY sofifa_id, fifa_year DESC
)
UPDATE sofifa_players p
SET manual_nationality = s.nationality
FROM source s
WHERE p.sofifa_id = s.sofifa_id
  AND p.fifa_year = 2027
  AND (p.nationality IS NULL OR p.nationality = '')
  AND (p.manual_nationality IS NULL OR p.manual_nationality = '');


-- ============================================================================
-- ROLLBACK — clears only what THIS migration would have set, by re-deriving
-- the same source lookup, so it never touches a manual override you set by
-- hand for some other reason
-- ============================================================================
-- WITH source AS (
--   SELECT DISTINCT ON (sofifa_id) sofifa_id, positions, fifa_year AS source_year
--   FROM sofifa_players
--   WHERE fifa_year NOT IN (2026, 2027) AND positions IS NOT NULL AND positions <> ''
--   ORDER BY sofifa_id, fifa_year DESC
-- )
-- UPDATE sofifa_players p SET manual_positions = NULL
-- FROM source s
-- WHERE p.sofifa_id = s.sofifa_id AND p.fifa_year = 2027 AND p.manual_positions = s.positions;
--
-- WITH source AS (
--   SELECT DISTINCT ON (sofifa_id) sofifa_id, nationality, fifa_year AS source_year
--   FROM sofifa_players
--   WHERE fifa_year NOT IN (2026, 2027) AND nationality IS NOT NULL AND nationality <> ''
--   ORDER BY sofifa_id, fifa_year DESC
-- )
-- UPDATE sofifa_players p SET manual_nationality = NULL
-- FROM source s
-- WHERE p.sofifa_id = s.sofifa_id AND p.fifa_year = 2027 AND p.manual_nationality = s.nationality;


-- ── 3. Confirm ── run after the two UPDATEs above

SELECT sofifa_id, name, club, positions, manual_positions, nationality, manual_nationality
FROM sofifa_players
WHERE fifa_year = 2027 AND name ILIKE '%Harry Kane%';

-- …and the overall picture: how many FC27 rows are still missing each field
-- after the backfill (should be at or near the "fixable" figures above, not
-- the "missing" ones).
SELECT
  COUNT(*) FILTER (WHERE (positions IS NULL OR positions = '') AND (manual_positions IS NULL OR manual_positions = '')) AS still_missing_positions,
  COUNT(*) FILTER (WHERE (nationality IS NULL OR nationality = '') AND (manual_nationality IS NULL OR manual_nationality = '')) AS still_missing_nationality
FROM sofifa_players
WHERE fifa_year = 2027;
