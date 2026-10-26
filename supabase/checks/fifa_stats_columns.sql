-- READ ONLY. What: measures the FIFA stats table (sofifa_players): its size, each index's size and use, and how many MB the two shrink steps would free. Changes nothing.
-- Why: fifa_stats_shrink.sql and fifa_stats_drop_unnamed_keys.sql carry estimates worked out from the code, not measured. Run this first so Harry sees the real numbers before saying yes.
--
-- Four answers, one per block. Each block is one SELECT; run them together or one by one.
-- Block 3 reads every row once (341,000 rows); expect 10-40 seconds.

-- 1. Whole table: rows, the table itself, the overflow store (TOAST) and all indexes.
SELECT
  (SELECT count(*) FROM public.sofifa_players)                                   AS rows,
  pg_size_pretty(pg_total_relation_size('public.sofifa_players'))                AS total,
  pg_size_pretty(pg_relation_size('public.sofifa_players'))                      AS table_only,
  pg_size_pretty(pg_table_size('public.sofifa_players')
                 - pg_relation_size('public.sofifa_players'))                    AS toast_and_maps,
  pg_size_pretty(pg_indexes_size('public.sofifa_players'))                       AS all_indexes;

-- 2. Every index: size, times used since the last stats reset, and its definition.
--    idx_sofifa_name and idx_sofifa_name_trgm should show the same definition.
SELECT
  i.indexrelname                                        AS index_name,
  pg_size_pretty(pg_relation_size(i.indexrelid))        AS size,
  i.idx_scan                                            AS times_used,
  pg_get_indexdef(i.indexrelid)                         AS definition
FROM pg_stat_user_indexes i
WHERE i.relname = 'sofifa_players'
ORDER BY pg_relation_size(i.indexrelid) DESC;

-- 3. The stats bundle (attributes column), now and after each step.
--    after_step_1: copies of filled columns removed (fifa_stats_shrink.sql, no stat lost).
--    after_step_2: also every key no code reads by name removed (fifa_stats_drop_unnamed_keys.sql).
WITH s AS (
  SELECT
    attributes,
    attributes - array_remove(ARRAY[
      CASE WHEN COALESCE(name, '')        <> '' THEN 'name' END,
      CASE WHEN COALESCE(club, '')        <> '' THEN 'club' END,
      CASE WHEN COALESCE(league, '')      <> '' THEN 'league' END,
      CASE WHEN COALESCE(nationality, '') <> '' THEN 'nationality' END,
      CASE WHEN COALESCE(image_url, '')   <> '' THEN 'image_url' END,
      CASE WHEN COALESCE(sofifa_id, '')   <> '' THEN 'sofifa_id' END,
      CASE WHEN COALESCE(positions, '')   <> '' THEN 'positions' END,
      CASE WHEN COALESCE(positions, '')   <> '' THEN 'player_positions' END,
      CASE WHEN COALESCE(age, 0)       > 0 THEN 'age' END,
      CASE WHEN COALESCE(overall, 0)   > 0 THEN 'overall' END,
      CASE WHEN COALESCE(potential, 0) > 0 THEN 'potential' END
    ]::text[], NULL) AS step1
  FROM public.sofifa_players
)
SELECT
  pg_size_pretty(sum(pg_column_size(attributes))::bigint)                      AS bundle_now,
  pg_size_pretty(sum(pg_column_size(step1))::bigint)                           AS after_step_1,
  pg_size_pretty(sum(pg_column_size(
    (SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
       FROM jsonb_each(step1) AS e(k, v)
      WHERE k = ANY (ARRAY[
        -- Read by the game (lib/playerAttributes.ts, app/api/draft/roster/route.ts)
        'Pace','Shooting','Passing','Dribbling','Defending','Physical','Crossing',
        'pac','shooting','passing','dribbling','defending','physical','finishing','positioning',
        'crossing','vision','longShots','shortPassing','longPassing','heading','interceptions',
        'standingTackle','marking','reactions','sprintSpeed','gkDiving','gkPositioning','gkReflexes',
        'overall','potential','age','positions','player_positions','name','club','league',
        'nationality','nationality_flag_url','image_url','sofifa_id','attr_sort','attr_vl',
        -- Labelled on the admin player page (app/admin/football/players/page.tsx ATTR_LABELS)
        'attr_pac','attr_sho','attr_pas','attr_dri','attr_def','attr_phy','attr_oa','attr_pt','attr_ae',
        'attr_fi','attr_po','attr_cr','attr_vi','attr_lo','attr_sh','attr_lp','attr_he','attr_in',
        'attr_st','attr_sl','attr_ma','attr_re','attr_sp','attr_ac','attr_ag','attr_ba','attr_bc',
        'attr_co','attr_cu','attr_fr','attr_jm','attr_pe','attr_so','attr_sm','attr_sr','attr_vo',
        'attr_aw','attr_dw','attr_sk','attr_wf','attr_ir','attr_pf','attr_gd','attr_gh','attr_gk',
        'attr_gp','attr_gr','attr_div','attr_han','attr_kic','attr_pos','attr_ref','attr_spd'
      ]))
  ))::bigint)                                                                  AS after_step_2,
  count(*) FILTER (WHERE attributes <> step1)                                  AS rows_step_1_changes
FROM s;

-- 4. Which keys take the space (a 5% sample, scaled up x20). Shows the keys step 2 would remove.
SELECT
  k                                                     AS key,
  count(*) * 20                                         AS rows_with_it_approx,
  pg_size_pretty((sum(pg_column_size(v) + octet_length(k) + 8) * 20)::bigint) AS space_approx
FROM public.sofifa_players TABLESAMPLE SYSTEM (5),
     jsonb_each(attributes) AS e(k, v)
GROUP BY k
ORDER BY sum(pg_column_size(v) + octet_length(k) + 8) DESC
LIMIT 120;
