-- CHANGES THE DATABASE. What: removes, from each FIFA player's stats bundle (sofifa_players.attributes), every key that no screen or admin page reads by name. Every key the game or the admin player page names stays.
-- Why: step 2 of Harry's "FIFA stats shrink: do it, 100%" (25 Oct 2026). Optional: run only if supabase/checks/fifa_stats_columns.sql block 3 shows "after_step_2" saves enough to be worth it.
--
-- NOT RUN. Order:
--   1. fifa_stats_shrink.sql first (and its VACUUM).
--   2. Save the cold copy: node scripts/supabase/export-sofifa-attributes.mjs  (look-only; writes every
--      player's full bundle to a .jsonl.gz file), then put that file in Cloudflare R2. That copy is how
--      no stat is lost: a removed key can be put back from it.
--   3. Only then add this line above the guard and run the file:
--        SET knowitball.cold_copy_saved = 'yes';
--   4. fifa_stats_vacuum.sql again, on its own, at a quiet time (locks the table 1-2 min).
--
-- What stays (the keep list), checked 25 Oct 2026:
--   * Read by the game: lib/playerAttributes.ts:22-44 and app/api/draft/roster/route.ts:87-120, 221-260.
--   * Read by the admin tools: app/api/admin/football/normalize-attributes/route.ts:31-65.
--   * Labelled on the admin player page: app/admin/football/players/page.tsx:9-63 (ATTR_LABELS).
-- What goes: any other key (whatever the scraper stored that nothing reads). Block 4 of the check
-- lists them with their size; read that list before running.
-- If a later feature wants a removed key, add it to this keep list AND bring it back from the cold copy.
--
-- Estimate: not reasoned to a number on purpose; the check's block 3 measures it exactly.

DO $$
BEGIN
  IF current_setting('knowitball.cold_copy_saved', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'Stopped on purpose: save the cold copy first (scripts/supabase/export-sofifa-attributes.mjs, then R2), then add  SET knowitball.cold_copy_saved = ''yes'';  above this block.';
  END IF;
END $$;

WITH keep(k) AS (
  SELECT unnest(ARRAY[
    'Pace','Shooting','Passing','Dribbling','Defending','Physical','Crossing',
    'pac','shooting','passing','dribbling','defending','physical','finishing','positioning',
    'crossing','vision','longShots','shortPassing','longPassing','heading','interceptions',
    'standingTackle','marking','reactions','sprintSpeed','gkDiving','gkPositioning','gkReflexes',
    'overall','potential','age','positions','player_positions','name','club','league',
    'nationality','nationality_flag_url','image_url','sofifa_id','attr_sort','attr_vl',
    'attr_pac','attr_sho','attr_pas','attr_dri','attr_def','attr_phy','attr_oa','attr_pt','attr_ae',
    'attr_fi','attr_po','attr_cr','attr_vi','attr_lo','attr_sh','attr_lp','attr_he','attr_in',
    'attr_st','attr_sl','attr_ma','attr_re','attr_sp','attr_ac','attr_ag','attr_ba','attr_bc',
    'attr_co','attr_cu','attr_fr','attr_jm','attr_pe','attr_so','attr_sm','attr_sr','attr_vo',
    'attr_aw','attr_dw','attr_sk','attr_wf','attr_ir','attr_pf','attr_gd','attr_gh','attr_gk',
    'attr_gp','attr_gr','attr_div','attr_han','attr_kic','attr_pos','attr_ref','attr_spd'
  ]::text[])
)
UPDATE public.sofifa_players p
SET attributes = COALESCE(
  (SELECT jsonb_object_agg(e.k, e.v)
     FROM jsonb_each(p.attributes) AS e(k, v)
    WHERE e.k IN (SELECT k FROM keep)),
  '{}'::jsonb)
WHERE EXISTS (
  SELECT 1 FROM jsonb_object_keys(p.attributes) AS o(k)
  WHERE o.k NOT IN (SELECT k FROM keep)
);

-- Verify (READ ONLY): re-run supabase/checks/fifa_stats_columns.sql; block 4 should list only kept keys.
