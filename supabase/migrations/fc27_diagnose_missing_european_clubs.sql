-- ============================================================================
-- Find the real SoFIFA spelling for the two European clubs still unmatched
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
-- WHERE THIS LEFT OFF
--
-- The original version of this file covered eleven clubs. Nine are now
-- resolved — six were a wrong guess in the original clone (Al Ahli,
-- Bodø/Glimt, Ferencváros, Lille, Real Betis, Schalke), five were genuinely
-- absent and got swapped for real replacements (Sporting Braga, PAOK,
-- Legia Warszawa and FC Copenhagen all confirmed present on the next run;
-- Viktoria Plzeň too, for Pafos's other replacement). Only two of the
-- replacements are still unconfirmed: FC Copenhagen and Vitória Guimarães
-- both came back `false` again even after fixing an accent-stripping bug in
-- their guessed variants — this file exists to find out whether that is
-- still a spelling problem or whether these two are genuinely not in the
-- table either, the same ambiguity the original version of this file was
-- built to resolve.
-- ============================================================================

SELECT 'FC Copenhagen' AS looking_for, sofifa_id, fifa_year, name, club, league
FROM sofifa_players
WHERE fifa_year IN (2026, 2027)
  AND (club ILIKE '%copenhagen%' OR club ILIKE '%K%benhavn%' OR club ILIKE '%FCK%')

UNION ALL
SELECT 'Vitória Guimarães', sofifa_id, fifa_year, name, club, league
FROM sofifa_players
WHERE fifa_year IN (2026, 2027)
  AND (club ILIKE '%Vit%ria%' OR club ILIKE '%Guimar%es%')

ORDER BY looking_for, fifa_year;

-- ── If a club above returns NO rows at all ──
--
-- It is genuinely not in the table under any spelling close to the one
-- given, for either year — that means picking yet another replacement
-- rather than chasing a spelling further. Tell me and I'll swap it into
-- the Champions League / Europa League list in its place.
