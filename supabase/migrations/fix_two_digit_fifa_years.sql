-- ============================================================================
-- Clean up rows written with a two-digit fifa_year
-- Run this in the Supabase SQL Editor. Safe to run more than once.
-- ============================================================================
--
-- WHAT HAPPENED
--
-- The admin clone form posted a two-digit target year. `fifa_year` is four
-- digits everywhere else, so those rows landed as `fifa_year = 26` rather than
-- 2027, and their age was computed as age + (26 - 2026) — a 23-year-old came
-- out as -1977.
--
-- They are hard to spot because `editionLabel` normalises anything over 100, so
-- a row with fifa_year 26 renders in the admin table as "FC 26", sitting right
-- next to the real FC 26 row it was cloned from.
--
-- Both the form and the API are fixed. This clears up what was already written.
-- ============================================================================

-- ── 1. Look before deleting ──
-- Every row with a year that is not a real edition. Check this list is what you
-- expect before running the delete below.

SELECT id, sofifa_id, fifa_year, fifa_edition, name, club, overall, age
FROM sofifa_players
WHERE fifa_year < 2000
ORDER BY name, fifa_year;

-- …and anybody whose age came out impossible, whatever their year.

SELECT id, sofifa_id, fifa_year, name, club, age
FROM sofifa_players
WHERE age IS NOT NULL AND (age < 14 OR age > 50)
ORDER BY age;

-- ── 2. Delete them ──
-- These rows are duplicates of a real edition with a broken year and a broken
-- age. There is nothing in them worth keeping: clone the player again from the
-- fixed form afterwards.
--
-- Uncomment to run.

-- DELETE FROM sofifa_players WHERE fifa_year < 2000;

-- ── 3. …and any FC 27 row whose age did not get bumped ──
-- Only relevant if you cloned players into 2027 before the fix. It puts them
-- back in step with the bulk migration: one year older than their FC 26 row.
--
-- Uncomment to run.

-- UPDATE sofifa_players AS b
-- SET age = a.age + 1
-- FROM sofifa_players AS a
-- WHERE b.fifa_year = 2027
--   AND a.fifa_year = 2026
--   AND a.sofifa_id = b.sofifa_id
--   AND a.age IS NOT NULL
--   AND b.age IS DISTINCT FROM a.age + 1;

-- ── 4. Check ──
-- Should return no rows.

SELECT id, sofifa_id, fifa_year, name, age
FROM sofifa_players
WHERE fifa_year < 2000
   OR (age IS NOT NULL AND (age < 14 OR age > 50));
