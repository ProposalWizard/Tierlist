-- Fast distinct nationality/club lookup for the objective-builder autocomplete.
--
-- The /api/admin/objectives/vocab route works WITHOUT this (it falls back to a
-- paginated full-table scan), but that scan is slow on a large sofifa_players
-- table. This function returns every distinct (nationality, club) pair in one
-- indexed pass so the admin autocomplete loads instantly.
--
-- Idempotent — safe to run more than once. Run in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION get_player_vocab()
RETURNS TABLE (nationality TEXT, club TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT
    COALESCE(NULLIF(manual_nationality, ''), nationality) AS nationality,
    club
  FROM sofifa_players
$$;
