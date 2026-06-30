-- Consolidated, idempotent fix for draft_records / draft_personal_records.
-- Brings both tables to the full final state regardless of which of the
-- older migrations (draft_records_expanded.sql, draft_records_mode.sql,
-- draft_records_fix_constraints.sql) were already run. Safe to run even if
-- some/all of those already ran — every statement is IF NOT EXISTS / DROP+ADD.
--
-- Run this once in the Supabase SQL Editor. Fixes Career Records (and several
-- season record categories) silently never saving because the CHECK
-- constraints rejected 'career' competition rows and several record_type
-- values (career_assists, career_avg_rating, most_points, biggest_win,
-- avg_rating) that the app has been sending for a while.

-- mode column (Normal vs Prime leaderboards)
ALTER TABLE draft_records ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE draft_personal_records ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'normal';

ALTER TABLE draft_records DROP CONSTRAINT IF EXISTS draft_records_mode_check;
ALTER TABLE draft_records ADD CONSTRAINT draft_records_mode_check
  CHECK (mode IN ('normal', 'prime'));

ALTER TABLE draft_personal_records DROP CONSTRAINT IF EXISTS draft_personal_records_mode_check;
ALTER TABLE draft_personal_records ADD CONSTRAINT draft_personal_records_mode_check
  CHECK (mode IN ('normal', 'prime'));

-- competition: add 'career' scope
ALTER TABLE draft_records DROP CONSTRAINT IF EXISTS draft_records_competition_check;
ALTER TABLE draft_records ADD CONSTRAINT draft_records_competition_check
  CHECK (competition IN ('pl', 'all', 'career'));

ALTER TABLE draft_personal_records DROP CONSTRAINT IF EXISTS draft_personal_records_competition_check;
ALTER TABLE draft_personal_records ADD CONSTRAINT draft_personal_records_competition_check
  CHECK (competition IN ('pl', 'all', 'career'));

-- record_type: full list the app currently writes
ALTER TABLE draft_records DROP CONSTRAINT IF EXISTS draft_records_record_type_check;
ALTER TABLE draft_records ADD CONSTRAINT draft_records_record_type_check
  CHECK (record_type IN (
    'wins', 'goals', 'assists', 'clean_sheets', 'unbeaten', 'goals_conceded',
    'biggest_win', 'avg_rating', 'most_points',
    'career_goals', 'career_assists', 'career_trophies', 'career_avg_rating'
  ));

ALTER TABLE draft_personal_records DROP CONSTRAINT IF EXISTS draft_personal_records_record_type_check;
ALTER TABLE draft_personal_records ADD CONSTRAINT draft_personal_records_record_type_check
  CHECK (record_type IN (
    'wins', 'goals', 'assists', 'clean_sheets', 'unbeaten', 'goals_conceded',
    'biggest_win', 'avg_rating', 'most_points',
    'career_goals', 'career_assists', 'career_trophies', 'career_avg_rating'
  ));
