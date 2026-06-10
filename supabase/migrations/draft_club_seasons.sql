-- Fast distinct lookup of Premier League club/season pairs for the PL Draft game.
-- Replaces paginating through every PL player row in /api/draft/clubs.
-- League patterns are anchored to the start so "Scottish Premier League",
-- "Russian Premier League" etc. are excluded.

CREATE OR REPLACE FUNCTION get_pl_club_seasons()
RETURNS TABLE (club TEXT, fifa_year INTEGER) AS $$
  SELECT DISTINCT p.club, p.fifa_year
  FROM sofifa_players p
  WHERE p.club IS NOT NULL
    AND (
      p.league ILIKE 'Premier League%'
      OR p.league ILIKE 'English Premier League%'
      OR p.league ILIKE 'Barclays Premier League%'
    )
$$ LANGUAGE sql STABLE;
