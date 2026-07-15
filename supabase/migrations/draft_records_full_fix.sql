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

-- Add squad_ovr to global records (was added later in draft_records_squad_ovr.sql
-- but not included here — adding it so this migration is fully self-contained)
ALTER TABLE draft_records DROP CONSTRAINT IF EXISTS draft_records_record_type_check;
ALTER TABLE draft_records ADD CONSTRAINT draft_records_record_type_check
  CHECK (record_type IN (
    'wins', 'goals', 'assists', 'clean_sheets', 'unbeaten', 'goals_conceded',
    'biggest_win', 'avg_rating', 'most_points', 'squad_ovr',
    'career_goals', 'career_assists', 'career_trophies', 'career_avg_rating'
  ));

-- Fix the personal records unique constraint to include mode so that normal
-- and prime records can coexist per user. The old constraint (user_id,
-- competition, record_type) caused prime-mode inserts to conflict with an
-- existing normal-mode row (or vice versa), silently dropping the record.
ALTER TABLE draft_personal_records DROP CONSTRAINT IF EXISTS draft_personal_records_user_id_competition_record_type_key;
ALTER TABLE draft_personal_records DROP CONSTRAINT IF EXISTS draft_personal_records_user_competition_type_unique;
ALTER TABLE draft_personal_records
  ADD CONSTRAINT draft_personal_records_user_competition_type_mode_unique
  UNIQUE (user_id, competition, record_type, mode);
