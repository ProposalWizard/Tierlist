-- Add linked_blind_ranking_id to tierlists table
-- Allows linking a regular tierlist to a blind ranking for cross-navigation
ALTER TABLE tierlists
  ADD COLUMN IF NOT EXISTS linked_blind_ranking_id UUID REFERENCES blind_rankings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tierlists_linked_blind ON tierlists(linked_blind_ranking_id)
  WHERE linked_blind_ranking_id IS NOT NULL;
