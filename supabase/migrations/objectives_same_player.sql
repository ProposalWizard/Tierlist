-- Add same_player flag to objectives table.
-- When true, all "any player" stat conditions (goals/assists/clean_sheets) must
-- be satisfied by the SAME individual player in order to complete the objective.

ALTER TABLE objectives ADD COLUMN IF NOT EXISTS same_player BOOLEAN NOT NULL DEFAULT FALSE;
