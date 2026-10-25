-- CHANGES THE DATABASE. What: rebuilds the FIFA stats table (sofifa_players) and its indexes tight, so the space freed by fifa_stats_shrink.sql (and fifa_stats_drop_unnamed_keys.sql) is given back. No data changes.
-- Why: deleting or rewriting rows does not shrink the database on its own; the space only comes back after this.
--
-- NOT RUN. Run it ON ITS OWN, as the only statement (it cannot run inside a batch or a transaction),
-- after fifa_stats_shrink.sql has finished.
-- It locks the table while it works: squads and the PL Draft cannot load for about 1-2 minutes
-- (reasoned for a ~300 MB table, not measured). Run it at a quiet time, early morning UK.
-- It needs free disk about the size of the new table (~250 MB); the free plan has 2 GB of disk.
VACUUM (FULL, ANALYZE) public.sofifa_players;
