# Supabase speed advice, read 25 Oct 2026 04:44 (get_advisors performance, look-only)

- Duplicate index: sofifa_players has identical idx_sofifa_name and idx_sofifa_name_trgm. Drop one.
- Unused indexes (14): idx_uploaded_images_cleanup, idx_tierlist_rankings_player, idx_tenable_puzzles_active,
  star_tuning_notes_note_at_idx (table made 23 Oct, too new to judge), idx_tierlists_category, idx_tierlist_likes_tierlist_id,
  idx_blind_rankings_active, idx_saved_tierlists_user, team_messages_time (new), team_tasks_owner (new),
  star_save_flags_user_at, star_save_flags_at, star_wallet_ledger_user_idx, team_notes_target (new).
  Caution: "unused" counts since the last stats reset; new tables and anything a page reads rarely can look unused.
- Missing indexes on foreign keys (19): american_draft_participants.user_id, american_draft_rooms.host_id, blind_rankings.created_by,
  draft_room_players.user_id, draft_rooms.host_id, feedback.user_id, saved_profile_images.tierlist_id, saved_tierlists.tierlist_id,
  season_level_rewards.card_library_id, star_entitlements.item_id, star_entitlements.ledger_id, tenable_puzzles.created_by,
  tester_links.created_by, tictactoe_difficulty_ratings.user_id, tictactoe_puzzles.created_by, tierlist_rankings.topic_id,
  user_objectives.objective_id, user_rewards.reward_id, vote_tierlists.created_by.
- Row rules re-checking the login on every row (42 policies, WARN): fix = wrap auth.uid() as (select auth.uid()).
  Tables: tierlist_rankings x4, tierlists x2, tierlist_images, user_roles, user_profiles x2, tierlist_likes, saved_tierlists x2,
  saved_profile_images x3, blind_ranking_likes, tictactoe_scores, draft_runs x2, user_xp, xp_events, user_rewards, user_stats,
  draft_personal_records, user_objectives x2, star_careers, feedback, star_wallet, star_wallet_ledger, star_entitlements,
  star_hall_of_fame x4, star_legend_shares x3, dev_status, team_members, star_tuning_notes.
- Two row rules doing the same job (20 findings on 4 tables): blind_ranking_likes, saved_tierlists, tierlist_likes, user_objectives.
