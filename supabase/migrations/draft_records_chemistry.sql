-- draft_records_chemistry.sql — the Chemistry Hall of Fame board (Leo, 27 Nov 2026).
-- PL Draft's Chemistry rules (lib/draft/chemistry.ts) get their own board, so
-- chemistry-boosted seasons never sit next to Classic ones. Adds 'chem' to the
-- allowed modes. Safe to run twice. Nothing else changes.
ALTER TABLE draft_records DROP CONSTRAINT IF EXISTS draft_records_mode_check;
ALTER TABLE draft_records ADD CONSTRAINT draft_records_mode_check
  CHECK (mode IN ('normal', 'prime', 'chem'));

ALTER TABLE draft_personal_records DROP CONSTRAINT IF EXISTS draft_personal_records_mode_check;
ALTER TABLE draft_personal_records ADD CONSTRAINT draft_personal_records_mode_check
  CHECK (mode IN ('normal', 'prime', 'chem'));
