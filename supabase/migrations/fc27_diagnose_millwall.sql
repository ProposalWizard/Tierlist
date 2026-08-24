-- ============================================================================
-- Why does Millwall still show fake players in the Lineups area?
-- ============================================================================
--
-- Reported directly, after checking every other Championship club's real
-- squad came through fine — Millwall is the one holdout. Same shape of bug
-- as Fenerbahçe SK a few sessions ago (fc27_diagnose_fenerbahce.sql /
-- fc27_fix_fenerbahce_spelling.sql): lib/star/clubs.ts asks for "Millwall FC",
-- but fc27_clone_new_clubs.sql's own matching list only ever had the bare
-- normalised form 'millwall' — if the real row's `club` value actually
-- includes "FC", stripping it down to just letters gives 'millwallfc', which
-- that list was never written to match. Worth confirming before touching
-- anything, the same way Fenerbahçe was, rather than guessing again.
--
-- Run this whole query. It answers, in one pass:
--   1. Does FC27 have ANY real Millwall row at all, under any spelling?
--   2. Does the exact string "Millwall FC" (what the app asks for) match?
--   3. What does FC26 — the clone's actual source — call them?

SELECT
  (SELECT COUNT(*) FROM sofifa_players WHERE fifa_year = 2027) AS fc27_total_rows,

  (SELECT COUNT(*) FROM sofifa_players
     WHERE fifa_year = 2027 AND club = 'Millwall FC') AS exact_match_fc27,

  (SELECT string_agg(DISTINCT club, ' | ') FROM sofifa_players
     WHERE fifa_year = 2027
       AND regexp_replace(lower(club), '[^a-z]', '', 'g') LIKE '%millwall%') AS fc27_fuzzy_matches,

  (SELECT COUNT(*) FROM sofifa_players
     WHERE fifa_year = 2026 AND club = 'Millwall FC') AS exact_match_fc26,

  (SELECT string_agg(DISTINCT club, ' | ') FROM sofifa_players
     WHERE fifa_year = 2026
       AND regexp_replace(lower(club), '[^a-z]', '', 'g') LIKE '%millwall%') AS fc26_fuzzy_matches;

-- If a fuzzy match on either year turns up a club value that LOOKS like
-- "Millwall FC" but the exact match is 0, this settles whether it's really
-- byte-identical or a Unicode/whitespace look-alike:
--
-- SELECT club, encode(convert_to(club, 'UTF8'), 'hex')
-- FROM sofifa_players
-- WHERE fifa_year IN (2026, 2027)
--   AND regexp_replace(lower(club), '[^a-z]', '', 'g') LIKE '%millwall%';
