-- Seed official Premier League records into draft_records.
-- These use a placeholder user_id (NULL allowed after schema change)
-- and username = 'Official'.
--
-- Only competition = 'pl' records are seeded.
-- Idempotent: skips insert if an Official record for that type already exists.

INSERT INTO draft_records (user_id, username, competition, record_type, value, player_name, player_ovr, season_number, created_at)
SELECT * FROM (VALUES
  (NULL::UUID, 'Official', 'pl', 'wins',         32, NULL,               NULL, NULL, now()),
  (NULL::UUID, 'Official', 'pl', 'goals',        36, 'E. Haaland',      91,   NULL, now()),
  (NULL::UUID, 'Official', 'pl', 'assists',      21, 'Bruno Fernandes', 88,   NULL, now()),
  (NULL::UUID, 'Official', 'pl', 'clean_sheets', 24, 'P. Čech',         88,   NULL, now()),
  (NULL::UUID, 'Official', 'pl', 'unbeaten',     49, NULL,               NULL, NULL, now())
) AS v(user_id, username, competition, record_type, value, player_name, player_ovr, season_number, created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM draft_records WHERE username = 'Official' AND competition = 'pl'
);
