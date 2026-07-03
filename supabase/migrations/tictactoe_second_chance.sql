-- Track whether a score row is the result of a Second Chance attempt.
-- Once is_second_chance = true, no further replays are allowed for that puzzle.
ALTER TABLE tictactoe_scores ADD COLUMN IF NOT EXISTS is_second_chance BOOLEAN DEFAULT FALSE;
