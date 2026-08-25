-- ============================================================================
-- FIND rows corrupted by the broken SoFIFA scraper (nationality/positions).
-- Run this in the Supabase SQL Editor. Read-only — nothing here writes.
-- ============================================================================
--
-- WHAT HAPPENED
--
-- Reported directly: after a scrape run, every scraped player's nationality
-- came back as "United States" and their `positions` came back as a garbled
-- list of up to nine entries — some of them (LCM, RDM, ...) not real
-- "plays as" tags at all, but cells off the position-RATINGS grid on a
-- player's SoFIFA page. The real answer, visible on the player's own page,
-- is 1–3 short tags like "CAM CM CDM" and a single real nationality
-- ("Belgium"). `lib/sofifaScraper.ts`'s selectors are being fixed
-- separately; this only finds what the broken run already wrote, so it can
-- be re-scraped and nothing else touched.
--
-- WHY "nationality = 'United States'" IS THE SIGNAL
--
-- It is not that no scraped player is ever really American — it is that
-- every single player in a corrupted batch came back American, regardless
-- of league or club (a Belgian club's entire squad, an English Championship
-- club's entire squad). That is not a real distribution; it is what a
-- selector grabbing the wrong element produces when that wrong element
-- happens to be the same for every row.
-- ============================================================================

-- ── 1. How many rows, and which editions ──
-- If this comes back near-100% for an edition that has any size to it at
-- all, that edition's scrape run is the corrupted one.

SELECT fifa_year, fifa_edition,
       count(*) FILTER (WHERE nationality = 'United States') AS us_flagged,
       count(*) AS total,
       round(100.0 * count(*) FILTER (WHERE nationality = 'United States') / NULLIF(count(*), 0), 1) AS pct
FROM sofifa_players
GROUP BY fifa_year, fifa_edition
ORDER BY pct DESC NULLS LAST, fifa_year DESC;

-- ── 2. The rows themselves ──
-- Also catches a positions string with more entries than a real player ever
-- has (nine, in the report) or one containing a grid-only token that is
-- never a real "plays as" tag (LCM/RCM/LDM/RDM/LAM/RAM/LCB/RCB/LS/RS/LF/RF —
-- the double-direction cells that only exist in the ratings grid).

SELECT id, sofifa_id, fifa_year, fifa_edition, name, club, league, nationality, positions
FROM sofifa_players
WHERE nationality = 'United States'
   OR positions ~ '(LCM|RCM|LDM|RDM|LAM|RAM|LCB|RCB|LS|RS|LF|RF)(,|$)'
   OR array_length(string_to_array(positions, ','), 1) > 4
ORDER BY fifa_year DESC, club, name;

-- ── 3. Just the count, for a quick before/after check once the re-scrape runs ──

SELECT count(*) AS corrupted_rows
FROM sofifa_players
WHERE nationality = 'United States'
   OR positions ~ '(LCM|RCM|LDM|RDM|LAM|RAM|LCB|RCB|LS|RS|LF|RF)(,|$)'
   OR array_length(string_to_array(positions, ','), 1) > 4;
