-- Remove the NOT NULL constraint on the players column that was kept after
-- commit b3948d9 dropped the field from the history insert. Every save has
-- been failing with 23502 since 15 July 2026.
ALTER TABLE draft_runs ALTER COLUMN players DROP NOT NULL;
