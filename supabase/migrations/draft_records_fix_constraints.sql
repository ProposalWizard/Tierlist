-- Fix CHECK constraints on draft_records and draft_personal_records to include
-- all record types that the app actually writes: biggest_win, avg_rating,
-- career_assists, career_avg_rating (previously missing, causing silent failures).

ALTER TABLE draft_records DROP CONSTRAINT IF EXISTS draft_records_record_type_check;
ALTER TABLE draft_records ADD CONSTRAINT draft_records_record_type_check
  CHECK (record_type IN (
    'wins', 'goals', 'assists', 'clean_sheets', 'unbeaten', 'goals_conceded',
    'career_goals', 'career_trophies',
    'biggest_win', 'avg_rating', 'career_assists', 'career_avg_rating'
  ));

ALTER TABLE draft_personal_records DROP CONSTRAINT IF EXISTS draft_personal_records_record_type_check;
ALTER TABLE draft_personal_records ADD CONSTRAINT draft_personal_records_record_type_check
  CHECK (record_type IN (
    'wins', 'goals', 'assists', 'clean_sheets', 'unbeaten', 'goals_conceded',
    'career_goals', 'career_trophies',
    'biggest_win', 'avg_rating', 'career_assists', 'career_avg_rating'
  ));
