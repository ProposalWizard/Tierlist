-- Indexes for hot read paths that were doing sequential scans.
-- Idempotent; safe to re-run.

-- tierlist_likes is keyed PRIMARY KEY (user_id, tierlist_id), so no index has
-- tierlist_id leading. Every /play/[id] and /vote/[id] view mounts LikeButton,
-- which counts likes filtered on tierlist_id alone — a seq scan on the hottest
-- read path in the app. The sibling tables already have this
-- (idx_blind_ranking_likes_ranking_id, and vote_tierlist_likes' unique index
-- leads with vote_tierlist_id); tierlist_likes was the one missed.
CREATE INDEX IF NOT EXISTS idx_tierlist_likes_tierlist_id
  ON tierlist_likes (tierlist_id);

-- draft_records had no indexes at all. Saving a PL Draft season runs ~20
-- record candidates through per-type top-N lookups and per-user reads, every
-- one of which was a seq scan.
CREATE INDEX IF NOT EXISTS idx_draft_records_lookup
  ON draft_records (competition, record_type, mode, value DESC);

CREATE INDEX IF NOT EXISTS idx_draft_records_user
  ON draft_records (user_id, competition, record_type, mode);

-- saved_tierlists is read per-user on the profile page and written on every
-- bookmark toggle, filtered on user_id.
CREATE INDEX IF NOT EXISTS idx_saved_tierlists_user
  ON saved_tierlists (user_id);
