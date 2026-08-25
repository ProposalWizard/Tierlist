-- ============================================================================
-- Reset (to NULL) the positions/nationality on FC 27 rows that fc27_fill_
-- assets.py's parser corrupted — so a re-run of that script (now fixed, see
-- scripts/fc27_fill_assets.py) treats them as needing a re-fetch instead of
-- skipping them. That script deliberately never overwrites a non-blank
-- value — the right rule for protecting a manual edit, but it means the
-- wrong values it wrote itself will sit there forever unless cleared first.
--
-- Only touches rows matching the corruption signature: `nationality` of
-- 'United States' (implausible at this rate for every league scraped — see
-- find_corrupted_sofifa_scrape.sql for the reasoning), or a `positions`
-- string carrying a grid-only token (LCM/RCM/LDM/RDM/LAM/RAM/LCB/RCB/LS/RS/
-- LF/RF — cells that only exist in the ratings grid, never a real "plays
-- as" badge) or more entries than a real player ever has. A row untouched
-- by that scrape (an FC 27 row that already had good data, or a `manual_*`
-- override) never matches this, so it is left exactly as it is.
--
-- Run this BEFORE re-running: python fc27_fill_assets.py --restart
-- ============================================================================

-- ── 1. Look first ──

SELECT id, sofifa_id, name, club, nationality, positions
FROM sofifa_players
WHERE fifa_year = 2027
  AND (
    nationality = 'United States'
    OR positions ~ '(LCM|RCM|LDM|RDM|LAM|RAM|LCB|RCB|LS|RS|LF|RF)(,|$)'
    OR array_length(string_to_array(positions, ','), 1) > 4
  )
ORDER BY club, name;

-- ── 2. Clear it ──
-- Uncomment and run once the list above looks right (a lot of Championship/
-- smaller-league rows, essentially none from the Premier League — matches
-- what was already found).

-- UPDATE sofifa_players
-- SET nationality = NULL, positions = NULL
-- WHERE fifa_year = 2027
--   AND (
--     nationality = 'United States'
--     OR positions ~ '(LCM|RCM|LDM|RDM|LAM|RAM|LCB|RCB|LS|RS|LF|RF)(,|$)'
--     OR array_length(string_to_array(positions, ','), 1) > 4
--   );

-- ── 3. Check ──
-- Should return 0.

SELECT count(*) AS still_corrupted
FROM sofifa_players
WHERE fifa_year = 2027
  AND (
    nationality = 'United States'
    OR positions ~ '(LCM|RCM|LDM|RDM|LAM|RAM|LCB|RCB|LS|RS|LF|RF)(,|$)'
    OR array_length(string_to_array(positions, ','), 1) > 4
  );
