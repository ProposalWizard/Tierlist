-- Extended per-season stats on draft_runs.
--
-- The client has always SENT these fields (top scorer, cup wins, streaks...)
-- but the history API silently dropped them, so trophy/cup achievements and
-- several Key Stats could never be computed. Adds the columns plus a
-- deterministic event_key so replaying the same season (refresh / resim)
-- can't insert duplicate runs.
--
-- Idempotent — safe to run more than once.

ALTER TABLE draft_runs ADD COLUMN IF NOT EXISTS top_scorer_goals INT;
ALTER TABLE draft_runs ADD COLUMN IF NOT EXISTS top_assists INT;
ALTER TABLE draft_runs ADD COLUMN IF NOT EXISTS clean_sheets INT;
ALTER TABLE draft_runs ADD COLUMN IF NOT EXISTS goal_difference INT;
ALTER TABLE draft_runs ADD COLUMN IF NOT EXISTS longest_win_streak INT;
ALTER TABLE draft_runs ADD COLUMN IF NOT EXISTS longest_unbeaten_run INT;
ALTER TABLE draft_runs ADD COLUMN IF NOT EXISTS fa_cup_winner BOOLEAN;
ALTER TABLE draft_runs ADD COLUMN IF NOT EXISTS efl_cup_winner BOOLEAN;
ALTER TABLE draft_runs ADD COLUMN IF NOT EXISTS ucl_winner BOOLEAN;
ALTER TABLE draft_runs ADD COLUMN IF NOT EXISTS uel_winner BOOLEAN;
ALTER TABLE draft_runs ADD COLUMN IF NOT EXISTS super_cup_winner BOOLEAN;
ALTER TABLE draft_runs ADD COLUMN IF NOT EXISTS charity_shield_winner BOOLEAN;
ALTER TABLE draft_runs ADD COLUMN IF NOT EXISTS event_key TEXT;

-- One row per (user, season fingerprint): a replayed identical season upserts
-- into the same row instead of duplicating it.
CREATE UNIQUE INDEX IF NOT EXISTS idx_draft_runs_user_event_key
  ON draft_runs(user_id, event_key)
  WHERE event_key IS NOT NULL;
