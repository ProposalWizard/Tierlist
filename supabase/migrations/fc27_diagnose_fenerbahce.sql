-- ============================================================================
-- Why does Fenerbahçe SK still have no real FC 27 players?
-- ============================================================================
--
-- Reported again today, after two fixes yesterday (225ea2b, 7442c7d) that
-- landed on lib/star/clubs.ts asking for the literal string "Fenerbahçe SK"
-- — which fc27_clone_european_clubs.sql's own diagnostic supposedly showed
-- was the real FC26 spelling. If it is still broken, one of three things is
-- true, and this tells you which:
--
--   1. fc27_clone_european_clubs.sql was never actually RUN against this
--      database — the code fix is correct but there is nothing for it to
--      find, because no FC27 row for this club (or most of the 84-club
--      European list) exists at all yet.
--   2. It WAS run, but Fenerbahçe's row is stored under a byte-for-byte
--      different "ç" — SoFIFA's scrape and lib/star/clubs.ts could each be
--      using the precomposed accented character (U+00E7) or the decomposed
--      form (a plain "c" plus a separate combining-cedilla codepoint,
--      U+0327). Both display identically and this is exactly the kind of
--      thing that survives a visual spelling check. (For what it's worth,
--      lib/star/clubs.ts itself uses the precomposed U+00E7 form.)
--   3. Something else — a trailing space, a different year, etc.
--
-- Run this whole query. It answers all three at once.

SELECT
  -- Is FC27 populated at all, for ANY club?
  (SELECT COUNT(*) FROM sofifa_players WHERE fifa_year = 2027) AS fc27_total_rows,

  -- The exact row(s) this game is actually asking for — an empty result
  -- here with a non-zero total above means (2) or (3), not (1).
  (SELECT COUNT(*) FROM sofifa_players
     WHERE fifa_year = 2027 AND club = 'Fenerbahçe SK') AS exact_match_fc27,

  -- Every FC27 club value that merely CONTAINS "fenerbah", accent and case
  -- stripped both ways, so a byte-level mismatch or an unexpected suffix
  -- still turns up here even though the exact match above missed it.
  (SELECT string_agg(DISTINCT club, ' | ') FROM sofifa_players
     WHERE fifa_year = 2027
       AND regexp_replace(lower(club), '[^a-z]', '', 'g') LIKE '%fenerbah%') AS fc27_fuzzy_matches,

  -- Same two questions against FC26, where the clone actually reads from —
  -- confirms whether the source row exists and exactly what it is stored as.
  (SELECT COUNT(*) FROM sofifa_players
     WHERE fifa_year = 2026 AND club = 'Fenerbahçe SK') AS exact_match_fc26,
  (SELECT string_agg(DISTINCT club, ' | ') FROM sofifa_players
     WHERE fifa_year = 2026
       AND regexp_replace(lower(club), '[^a-z]', '', 'g') LIKE '%fenerbah%') AS fc26_fuzzy_matches;

-- If fc27_fuzzy_matches (or fc26_fuzzy_matches) shows a club value that
-- LOOKS identical to 'Fenerbahçe SK' but exact_match is 0, run this to see
-- the actual codepoints and settle it for certain:
--
-- SELECT club, encode(convert_to(club, 'UTF8'), 'hex')
-- FROM sofifa_players
-- WHERE fifa_year = 2027
--   AND regexp_replace(lower(club), '[^a-z]', '', 'g') LIKE '%fenerbah%';
--
-- 'ç' as U+00E7 (precomposed, what lib/star/clubs.ts uses) encodes to c3a7.
-- 'ç' as "c" + combining cedilla (U+0327, decomposed) encodes to 63cca7 —
-- an extra codepoint on its own, wedged right after the plain "c".
