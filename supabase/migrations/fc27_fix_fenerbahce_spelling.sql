-- ============================================================================
-- Fenerbahçe SK's FC27 rows are stuck under an old, stale spelling
-- ============================================================================
--
-- THE ACTUAL BUG — not a fresh spelling mistake, an old one that was only
-- half-fixed
--
-- fc27_diagnose_fenerbahce.sql (run directly against this database) found:
--   fc27_fuzzy_matches: 'Fenerbahce'   (no accent, no "SK" — 2027)
--   fc26_fuzzy_matches: 'Fenerbahçe SK'  (36 real players — 2026)
--
-- fc27_clone_european_clubs.sql's INSERT copies a source row's `club` value
-- verbatim — it never renames anything — so an FC27 row can only say
-- "Fenerbahce" if an FC26 row ALSO said "Fenerbahce" at the moment the
-- clone actually ran. That row has since been corrected (rescraped, or
-- edited by hand) to the real "Fenerbahçe SK", but `ON CONFLICT (sofifa_id,
-- fifa_year) DO NOTHING` means re-running the clone never updates a row
-- that already exists in FC27 — it only inserts sofifa_ids that are new to
-- 2027. The already-cloned rows were simply never touched again.
--
-- Worse: even a fresh clone run would not have picked up the corrected FC26
-- spelling. The migration's own matching array had 'fenerbahcesk' as the
-- expected normalised form of "Fenerbahçe SK" — but the regexp it matches
-- with (`regexp_replace(lower(club), '[^a-z]', '', 'g')`) DROPS a non-ASCII
-- letter, it does not transliterate it, so "Fenerbahçe SK" actually
-- normalises to 'fenerbahesk' (no "c" where the "ç" was). That entry is
-- fixed separately, in fc27_clone_european_clubs.sql itself, so a future
-- re-run (to pick up a player who transferred into Fenerbahçe in FC26 since
-- the last clone) will actually find them.
--
-- This migration is the immediate, narrow fix: rename the FC27 rows that
-- are still sitting under the old "Fenerbahce" label, to match what their
-- own FC26 source has said for a while now. Deliberately NOT a general
-- "sync every FC27 club to its FC26 counterpart" — FC27 is being edited by
-- hand as the real 2026/27 transfer window plays out, and a blanket sync
-- would silently undo every one of those edits. This touches only the one
-- known-stale label.
--
--
-- HOW TO RUN IT
--
-- 1. Run the look-first query. Confirm the count looks like a real squad
--    (Fenerbahçe SK's FC26 row has 36 players — this should be close to
--    that, not 1 or 2).
-- 2. Run the UPDATE.
-- 3. Run the "after" query — should show 0 rows still under the old
--    spelling and the real count now under "Fenerbahçe SK".
-- ============================================================================


-- ── 1. Look first ──

SELECT COUNT(*) AS fenerbahce_stale_rows
FROM sofifa_players
WHERE fifa_year = 2027 AND club = 'Fenerbahce';


-- ── 2. Rename ──

UPDATE sofifa_players
SET club = 'Fenerbahçe SK'
WHERE fifa_year = 2027 AND club = 'Fenerbahce';


-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- UPDATE sofifa_players SET club = 'Fenerbahce'
-- WHERE fifa_year = 2027 AND club = 'Fenerbahçe SK';
--   -- NOTE: only safe to run immediately after this migration — if any
--   -- other real Fenerbahçe SK transfer business (a sale, a loan) has
--   -- happened since, this would incorrectly rename those players' club
--   -- back too.


-- ── 3. Confirm ──

SELECT COUNT(*) AS fenerbahce_stale_rows_remaining
FROM sofifa_players WHERE fifa_year = 2027 AND club = 'Fenerbahce';

SELECT COUNT(*) AS fenerbahce_sk_now
FROM sofifa_players WHERE fifa_year = 2027 AND club = 'Fenerbahçe SK';
