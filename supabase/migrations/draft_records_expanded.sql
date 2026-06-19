-- Expand draft_records and draft_personal_records to support new record types
-- New types: goals_conceded (PL only), career_goals, career_trophies
-- New competition scope: career
-- Run this in Supabase SQL Editor

-- draft_records: expand CHECK constraints
ALTER TABLE draft_records DROP CONSTRAINT IF EXISTS draft_records_record_type_check;
ALTER TABLE draft_records ADD CONSTRAINT draft_records_record_type_check
  CHECK (record_type IN ('wins', 'goals', 'assists', 'clean_sheets', 'unbeaten', 'goals_conceded', 'career_goals', 'career_trophies'));

ALTER TABLE draft_records DROP CONSTRAINT IF EXISTS draft_records_competition_check;
ALTER TABLE draft_records ADD CONSTRAINT draft_records_competition_check
  CHECK (competition IN ('pl', 'all', 'career'));

-- draft_personal_records: expand CHECK constraints
ALTER TABLE draft_personal_records DROP CONSTRAINT IF EXISTS draft_personal_records_record_type_check;
ALTER TABLE draft_personal_records ADD CONSTRAINT draft_personal_records_record_type_check
  CHECK (record_type IN ('wins', 'goals', 'assists', 'clean_sheets', 'unbeaten', 'goals_conceded', 'career_goals', 'career_trophies'));

ALTER TABLE draft_personal_records DROP CONSTRAINT IF EXISTS draft_personal_records_competition_check;
ALTER TABLE draft_personal_records ADD CONSTRAINT draft_personal_records_competition_check
  CHECK (competition IN ('pl', 'all', 'career'));

-- Seed official PL records for the new goals_conceded category
-- (Chelsea 2004-05: 15 goals conceded in 38 PL matches - actual record)
INSERT INTO draft_records (user_id, username, competition, record_type, value, player_name, player_ovr, season_number, created_at)
VALUES (NULL::UUID, 'Official', 'pl', 'goals_conceded', 15, 'P. Čech', 88, NULL, now())
ON CONFLICT DO NOTHING;

-- Reseed the existing official records in case they weren't seeded before
-- (idempotent guard: only inserts if no Official records exist at all)
INSERT INTO draft_records (user_id, username, competition, record_type, value, player_name, player_ovr, season_number, created_at)
SELECT * FROM (VALUES
  (NULL::UUID, 'Official', 'pl', 'wins',         32, NULL,               NULL::INTEGER, NULL::INTEGER, now()),
  (NULL::UUID, 'Official', 'pl', 'goals',        36, 'E. Haaland',       91,            NULL::INTEGER, now()),
  (NULL::UUID, 'Official', 'pl', 'assists',      21, 'Bruno Fernandes',  88,            NULL::INTEGER, now()),
  (NULL::UUID, 'Official', 'pl', 'clean_sheets', 24, 'P. Čech',          88,            NULL::INTEGER, now()),
  (NULL::UUID, 'Official', 'pl', 'unbeaten',     49, NULL,               NULL::INTEGER, NULL::INTEGER, now())
) AS v(user_id, username, competition, record_type, value, player_name, player_ovr, season_number, created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM draft_records WHERE username = 'Official' AND competition = 'pl' AND record_type != 'goals_conceded'
);
