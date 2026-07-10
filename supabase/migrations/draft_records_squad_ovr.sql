-- Add the 'squad_ovr' record type (Highest Squad OVR) to draft_records and
-- draft_personal_records. Without this, the CHECK constraint silently rejects
-- squad_ovr inserts (the route only console.error's them), so the record never
-- saves. Idempotent DROP+ADD — safe to run once in the Supabase SQL Editor.
-- Includes the full existing record_type list so it works whether or not
-- draft_records_full_fix.sql has been run.

ALTER TABLE draft_records DROP CONSTRAINT IF EXISTS draft_records_record_type_check;
ALTER TABLE draft_records ADD CONSTRAINT draft_records_record_type_check
  CHECK (record_type IN (
    'wins', 'goals', 'assists', 'clean_sheets', 'unbeaten', 'goals_conceded',
    'biggest_win', 'avg_rating', 'most_points',
    'career_goals', 'career_assists', 'career_trophies', 'career_avg_rating',
    'squad_ovr'
  ));

ALTER TABLE draft_personal_records DROP CONSTRAINT IF EXISTS draft_personal_records_record_type_check;
ALTER TABLE draft_personal_records ADD CONSTRAINT draft_personal_records_record_type_check
  CHECK (record_type IN (
    'wins', 'goals', 'assists', 'clean_sheets', 'unbeaten', 'goals_conceded',
    'biggest_win', 'avg_rating', 'most_points',
    'career_goals', 'career_assists', 'career_trophies', 'career_avg_rating',
    'squad_ovr'
  ));
