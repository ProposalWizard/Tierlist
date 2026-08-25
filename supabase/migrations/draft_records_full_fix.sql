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

-- record_type: full list the app currently writes, 'squad_ovr' included from
-- the start.
--
-- This used to be two separate DROP+ADD passes — an incomplete list first,
-- 'squad_ovr' added in a second pass right after, with a comment claiming
-- that made the migration "fully self-contained". It did the opposite: the
-- FIRST ADD CONSTRAINT is checked against every existing row immediately,
-- and this table already has real squad_ovr rows (draft_records_squad_ovr.sql
-- added support for them earlier) — so the incomplete constraint failed
-- outright, before execution ever reached the corrected version a few lines
-- later. Reported directly: "check constraint ... is violated by some row"
-- on a table that was never actually broken, on data that was never
-- actually invalid. One correct pass, not two, fixes it.
ALTER TABLE draft_records DROP CONSTRAINT IF EXISTS draft_records_record_type_check;
ALTER TABLE draft_records ADD CONSTRAINT draft_records_record_type_check
  CHECK (record_type IN (
    'wins', 'goals', 'assists', 'clean_sheets', 'unbeaten', 'goals_conceded',
    'biggest_win', 'avg_rating', 'most_points', 'squad_ovr',
    'career_goals', 'career_assists', 'career_trophies', 'career_avg_rating'
  ));

-- Same fix applies here — this table also already has real squad_ovr rows
-- (draft_records_squad_ovr.sql touched both tables), so leaving it out of
-- THIS constraint would have failed the exact same way the moment the
-- draft_records one above was fixed.
ALTER TABLE draft_personal_records DROP CONSTRAINT IF EXISTS draft_personal_records_record_type_check;
ALTER TABLE draft_personal_records ADD CONSTRAINT draft_personal_records_record_type_check
  CHECK (record_type IN (
    'wins', 'goals', 'assists', 'clean_sheets', 'unbeaten', 'goals_conceded',
    'biggest_win', 'avg_rating', 'most_points', 'squad_ovr',
    'career_goals', 'career_assists', 'career_trophies', 'career_avg_rating'
  ));

-- Fix the personal records unique constraint to include mode so that normal
-- and prime records can coexist per user. The old constraint (user_id,
-- competition, record_type) caused prime-mode inserts to conflict with an
-- existing normal-mode row (or vice versa), silently dropping the record.
--
-- This block was not actually idempotent despite the file's own header
-- claiming every statement in it is: it dropped the two OLD constraint
-- names before adding the new one, but never dropped the NEW name first.
-- The first time this ever ran far enough to reach this block, it created
-- draft_personal_records_user_competition_type_mode_unique successfully —
-- and every run since then has failed here with "relation ... already
-- exists" the moment it got this far, including the run that fixed the
-- record_type bug above and reached this line for the first time since.
ALTER TABLE draft_personal_records DROP CONSTRAINT IF EXISTS draft_personal_records_user_id_competition_record_type_key;
ALTER TABLE draft_personal_records DROP CONSTRAINT IF EXISTS draft_personal_records_user_competition_type_unique;
ALTER TABLE draft_personal_records DROP CONSTRAINT IF EXISTS draft_personal_records_user_competition_type_mode_unique;
ALTER TABLE draft_personal_records
  ADD CONSTRAINT draft_personal_records_user_competition_type_mode_unique
  UNIQUE (user_id, competition, record_type, mode);
