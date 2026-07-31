-- Indexes for the American draft's per-round player lookup.
--
-- The round query filtered with `league ILIKE 'Premier League%'` and
-- `positions ILIKE '%GK%'`. Neither could use an index:
--
--   * idx_sofifa_league_year is a btree on (league, fifa_year), and under the
--     default collation a btree cannot serve ILIKE — not even a prefix pattern.
--   * positions had no index at all, and '%GK%' leads with a wildcard anyway.
--
-- So every round scanned the whole table, evaluating four ILIKEs per row, and
-- eventually hit "canceling statement due to statement timeout" — which is what
-- made picks hang and rounds load empty.
--
-- The code no longer needs these (it filters league by equality and positions
-- in JS), but they make the table safe to query the obvious way, and pg_trgm is
-- already enabled by sofifa_data.sql.

CREATE INDEX IF NOT EXISTS idx_sofifa_positions_trgm
  ON sofifa_players USING gin (positions gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_sofifa_league_trgm
  ON sofifa_players USING gin (league gin_trgm_ops);

-- Supports the "recent editions of one league" access pattern the round query
-- now uses, and keeps the planner honest when fifa_year is the selective half.
CREATE INDEX IF NOT EXISTS idx_sofifa_year_league
  ON sofifa_players (fifa_year, league);
