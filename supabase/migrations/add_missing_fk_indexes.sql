-- CHANGES THE DATABASE. What: adds 19 small indexes, one on each column that points at another table (a "foreign key") and has none.
-- Why: the speed advisor (25 Oct 2026) listed all 19. Without one, deleting an account, a tierlist or a room makes the database read the whole linked table to find matching rows; joins on these columns are slower too. Harry: missing indexes "sound cool".
--
-- NOT RUN. Safe to re-run (IF NOT EXISTS). All 19 tables are small, so each index builds in well under a
-- second; while it builds, writes to that one table wait. No change to what any page shows.
-- Estimate: under 2 MB of disk in total (reasoned from table sizes; tiny tables).
-- Each column was checked to exist in the repo's migrations (file named after each line).

CREATE INDEX IF NOT EXISTS idx_american_draft_participants_user_id ON public.american_draft_participants (user_id);  -- american_draft.sql
CREATE INDEX IF NOT EXISTS idx_american_draft_rooms_host_id        ON public.american_draft_rooms (host_id);         -- american_draft.sql
CREATE INDEX IF NOT EXISTS idx_blind_rankings_created_by           ON public.blind_rankings (created_by);            -- blind_rankings.sql
CREATE INDEX IF NOT EXISTS idx_draft_room_players_user_id          ON public.draft_room_players (user_id);           -- draft_rooms.sql
CREATE INDEX IF NOT EXISTS idx_draft_rooms_host_id                 ON public.draft_rooms (host_id);                  -- draft_rooms.sql
CREATE INDEX IF NOT EXISTS idx_feedback_user_id                    ON public.feedback (user_id);                     -- feedback_user_id.sql
CREATE INDEX IF NOT EXISTS idx_saved_profile_images_tierlist_id    ON public.saved_profile_images (tierlist_id);     -- saved_profile_images.sql
CREATE INDEX IF NOT EXISTS idx_saved_tierlists_tierlist_id         ON public.saved_tierlists (tierlist_id);          -- schema-additions.sql
CREATE INDEX IF NOT EXISTS idx_season_level_rewards_card_library_id ON public.season_level_rewards (card_library_id); -- season_rewards.sql
CREATE INDEX IF NOT EXISTS idx_star_entitlements_item_id           ON public.star_entitlements (item_id);            -- star_wallet.sql
CREATE INDEX IF NOT EXISTS idx_star_entitlements_ledger_id         ON public.star_entitlements (ledger_id);          -- star_wallet.sql
CREATE INDEX IF NOT EXISTS idx_tenable_puzzles_created_by          ON public.tenable_puzzles (created_by);           -- tenable.sql
CREATE INDEX IF NOT EXISTS idx_tester_links_created_by             ON public.tester_links (created_by);              -- tester_access.sql
CREATE INDEX IF NOT EXISTS idx_tictactoe_difficulty_ratings_user_id ON public.tictactoe_difficulty_ratings (user_id); -- tictactoe_difficulty_ratings.sql
CREATE INDEX IF NOT EXISTS idx_tictactoe_puzzles_created_by        ON public.tictactoe_puzzles (created_by);         -- tictactoe.sql
CREATE INDEX IF NOT EXISTS idx_tierlist_rankings_topic_id          ON public.tierlist_rankings (topic_id);           -- schema.sql
CREATE INDEX IF NOT EXISTS idx_user_objectives_objective_id        ON public.user_objectives (objective_id);         -- objectives.sql
CREATE INDEX IF NOT EXISTS idx_user_rewards_reward_id              ON public.user_rewards (reward_id);               -- progression_system.sql
CREATE INDEX IF NOT EXISTS idx_vote_tierlists_created_by           ON public.vote_tierlists (created_by);            -- vote-schema.sql

-- Verify afterwards (READ ONLY): the speed advisor's "unindexed foreign keys" list should be empty.
