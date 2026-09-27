-- ============================================================================
-- FC 27 (2026/27) — League One, League Two and the National League,
-- cloned from FC 26 a year older
-- ============================================================================
--
-- Harry, 27 Sep 2026: "Just fill it out, fill out the full database the same
-- way we did for everything else." This is fc27_clone_premier_league.sql
-- again, for the three tiers below the Championship.
--
-- WHAT IT FIXES (checked against the live table, 27 Sep 2026)
--
--   This season (FC 27) has real players for   5 of 24 League One clubs,
--                                               1 of 24 League Two clubs,
--                                               0 of 24 National League clubs.
--   Every other club plays with invented names.
--   Last season (FC 26) has players for 23/24, 23/24 and 8/24 of them.
--
-- WHAT IT DOES
--
--   Copies every FC 26 player at those clubs into FC 27, a year older — for
--   43 clubs, 1,154 players. Same statement shape as the Premier League
--   clone: ONE statement, run once, and the row it prints says what happened.
--
--   It also fixes two things the Premier League clone didn't have to:
--
--   1. POSITIONS. FC 26's scrape never captured a position outside the
--      Premier League (see fc27_backfill_positions_nationality.sql). Of these
--      1,154 players, 65 have one of their own, 118 have one in an earlier
--      FIFA edition, and 971 have none anywhere. Without a position the game
--      can't put a player in a team: in a preview, Stockport's eleven came out
--      empty and the team sheet filled it with free agents — Benzema, Icardi
--      and Sancho lining up for Stockport. So each copied player gets
--      manual_positions: his own if he has one, else the newest earlier
--      edition's, else a guess from his six card numbers. The guess gets the
--      broad role (keeper / defender / midfielder / forward) right for 149 of
--      the 183 players whose real position is known — 81% (keepers 14 of 15).
--   2. CLUB NAMES. Where SoFIFA spells a club differently from the game, the
--      copy takes the game's spelling (SoFIFA's "Blackpool FC" is the game's
--      "Blackpool"), because the game finds a squad by its exact name.
--
--   It writes manual_positions / manual_nationality, never positions /
--   nationality — the same override columns the earlier backfill used, so the
--   scraped columns stay exactly what SoFIFA said.
--
-- WHAT IT LEAVES ALONE
--
--   * A club that already has 11 or more FC 27 players (Huddersfield,
--     Leicester, Luton, Reading, Wigan) — somebody built those by hand, and
--     re-adding everyone would undo the players they took out.
--   * A club with fewer than 16 FC 26 players — a real squad that small can't
--     field a side, so it keeps its invented one: Bromley (12), Barnet (11),
--     Chesterfield (10), Rochdale (9), York City (1), Hartlepool (10),
--     Scunthorpe (13), Southend (8), and the 16 National League clubs with
--     none at all.
--   * Anyone already in FC 27 at another club (they moved; FC 27 wins).
--   * FC 26 itself — nothing in it is changed.
--
-- HOW TO RUN IT
--
--   1. (Optional) Run PART 1 on its own. It changes nothing and lists, club
--      by club, what PART 2 would do.
--   2. Run PART 2 once. It prints one row:
--        players_copied ..... how many it just wrote into FC 27
--        clubs_filled ....... how many clubs got a squad
--        positions_own / positions_earlier / positions_guessed
--                             where each copied player's position came from
--        per_club ........... "Club: n" for every club it filled
--      copied 0 with clubs_filled 0 → already done, nothing to do.
--   Safe to run again: ON CONFLICT DO NOTHING only ever fills in who's missing.
--
-- FACES: none of these 1,154 has a photo we host. Every screen shows each
-- one his own fake face (faceOrFake, lib/star/fakeFaces.ts — the same face
-- the pitch draws), never a silhouette, until the face scrape + upload is
-- run for these editions.
-- ============================================================================


-- ════════════════════════════════════════════════════════════════════════════
-- PART 1 — LOOK FIRST (changes nothing)
-- ════════════════════════════════════════════════════════════════════════════

WITH clubs(game_name, sofifa_name, tier) AS (
  VALUES
  ('AFC Wimbledon','AFC Wimbledon','League One'), ('Barnsley','Barnsley','League One'),
  ('Blackpool','Blackpool FC','League One'), ('Bradford City','Bradford City','League One'),
  ('Bromley','Bromley','League One'), ('Burton Albion','Burton Albion','League One'),
  ('Cambridge United','Cambridge United','League One'), ('Doncaster Rovers','Doncaster Rovers','League One'),
  ('Huddersfield Town','Huddersfield Town','League One'), ('Leicester City','Leicester City','League One'),
  ('Leyton Orient','Leyton Orient','League One'), ('Luton Town','Luton Town','League One'),
  ('Mansfield Town','Mansfield Town','League One'), ('Milton Keynes Dons','Milton Keynes Dons','League One'),
  ('Notts County','Notts County','League One'), ('Oxford United','Oxford United','League One'),
  ('Peterborough United','Peterborough United','League One'), ('Plymouth Argyle','Plymouth Argyle','League One'),
  ('Reading FC','Reading FC','League One'), ('Sheffield Wednesday','Sheffield Wednesday','League One'),
  ('Stevenage','Stevenage','League One'), ('Stockport County','Stockport County','League One'),
  ('Wigan Athletic','Wigan Athletic','League One'), ('Wycombe Wanderers','Wycombe Wanderers','League One'),
  ('Accrington Stanley','Accrington Stanley','League Two'), ('Barnet','Barnet','League Two'),
  ('Bristol Rovers','Bristol Rovers','League Two'), ('Cheltenham Town','Cheltenham Town','League Two'),
  ('Chesterfield','Chesterfield','League Two'), ('Colchester United','Colchester United','League Two'),
  ('Crawley Town','Crawley Town','League Two'), ('Crewe Alexandra','Crewe Alexandra','League Two'),
  ('Exeter City','Exeter City','League Two'), ('Fleetwood Town','Fleetwood Town','League Two'),
  ('Gillingham','Gillingham','League Two'), ('Grimsby Town','Grimsby Town','League Two'),
  ('Newport County','Newport County','League Two'), ('Northampton Town','Northampton Town','League Two'),
  ('Oldham Athletic','Oldham Athletic','League Two'), ('Port Vale','Port Vale','League Two'),
  ('Rochdale','Rochdale','League Two'), ('Rotherham United','Rotherham United','League Two'),
  ('Salford City','Salford City','League Two'), ('Shrewsbury Town','Shrewsbury Town','League Two'),
  ('Swindon Town','Swindon Town','League Two'), ('Tranmere Rovers','Tranmere Rovers','League Two'),
  ('Walsall','Walsall','League Two'), ('York City','York City','League Two'),
  ('AFC Fylde','AFC Fylde','National League'), ('Aldershot Town','Aldershot Town','National League'),
  ('Altrincham','Altrincham','National League'), ('Barrow','Barrow','National League'),
  ('Boreham Wood','Boreham Wood','National League'), ('Boston United','Boston United','National League'),
  ('Carlisle United','Carlisle United','National League'), ('Eastleigh','Eastleigh','National League'),
  ('FC Halifax Town','FC Halifax Town','National League'), ('Forest Green Rovers','Forest Green Rovers','National League'),
  ('Gateshead','Gateshead','National League'), ('Harrogate Town','Harrogate Town','National League'),
  ('Hartlepool United','Hartlepool United','National League'), ('Hornchurch','Hornchurch','National League'),
  ('Kidderminster Harriers','Kidderminster Harriers','National League'), ('Scunthorpe United','Scunthorpe United','National League'),
  ('Solihull Moors','Solihull Moors','National League'), ('Southend United','Southend United','National League'),
  ('Sutton United','Sutton United','National League'), ('Tamworth','Tamworth','National League'),
  ('Wealdstone','Wealdstone','National League'), ('Woking','Woking','National League'),
  ('Worthing','Worthing','National League'), ('Yeovil Town','Yeovil Town','National League')
),
fc27_now AS (
  SELECT c.game_name, COUNT(p.sofifa_id) AS n
  FROM clubs c LEFT JOIN sofifa_players p ON p.fifa_year = 2027 AND p.club = c.game_name
  GROUP BY c.game_name
),
fc26 AS (
  SELECT c.game_name, p.sofifa_id
  FROM clubs c
  JOIN sofifa_players p
    ON p.fifa_year = 2026
   AND regexp_replace(LOWER(COALESCE(p.club, '')), '[^a-z]', '', 'g') = regexp_replace(LOWER(c.sofifa_name), '[^a-z]', '', 'g')
),
counts AS (
  SELECT c.game_name, c.tier,
         (SELECT n FROM fc27_now x WHERE x.game_name = c.game_name) AS fc27_now,
         (SELECT COUNT(*) FROM fc26 f WHERE f.game_name = c.game_name) AS fc26,
         (SELECT COUNT(*) FROM fc26 f WHERE f.game_name = c.game_name
            AND NOT EXISTS (SELECT 1 FROM sofifa_players q WHERE q.sofifa_id = f.sofifa_id AND q.fifa_year = 2027)) AS copyable
  FROM clubs c
)
SELECT tier, game_name AS club, fc27_now, fc26, copyable,
       CASE WHEN fc27_now >= 11 THEN 'left alone — already built in FC 27'
            WHEN fc26 < 16      THEN 'left alone — too few FC 26 players'
            ELSE 'will copy ' || copyable END AS part_2_will
FROM counts
ORDER BY tier, club;


-- ════════════════════════════════════════════════════════════════════════════
-- PART 2 — THE CLONE (run once)
-- ════════════════════════════════════════════════════════════════════════════

WITH clubs(game_name, sofifa_name) AS (
  VALUES
  ('AFC Wimbledon','AFC Wimbledon'), ('Barnsley','Barnsley'), ('Blackpool','Blackpool FC'),
  ('Bradford City','Bradford City'), ('Bromley','Bromley'), ('Burton Albion','Burton Albion'),
  ('Cambridge United','Cambridge United'), ('Doncaster Rovers','Doncaster Rovers'),
  ('Huddersfield Town','Huddersfield Town'), ('Leicester City','Leicester City'),
  ('Leyton Orient','Leyton Orient'), ('Luton Town','Luton Town'), ('Mansfield Town','Mansfield Town'),
  ('Milton Keynes Dons','Milton Keynes Dons'), ('Notts County','Notts County'), ('Oxford United','Oxford United'),
  ('Peterborough United','Peterborough United'), ('Plymouth Argyle','Plymouth Argyle'), ('Reading FC','Reading FC'),
  ('Sheffield Wednesday','Sheffield Wednesday'), ('Stevenage','Stevenage'), ('Stockport County','Stockport County'),
  ('Wigan Athletic','Wigan Athletic'), ('Wycombe Wanderers','Wycombe Wanderers'),
  ('Accrington Stanley','Accrington Stanley'), ('Barnet','Barnet'), ('Bristol Rovers','Bristol Rovers'),
  ('Cheltenham Town','Cheltenham Town'), ('Chesterfield','Chesterfield'), ('Colchester United','Colchester United'),
  ('Crawley Town','Crawley Town'), ('Crewe Alexandra','Crewe Alexandra'), ('Exeter City','Exeter City'),
  ('Fleetwood Town','Fleetwood Town'), ('Gillingham','Gillingham'), ('Grimsby Town','Grimsby Town'),
  ('Newport County','Newport County'), ('Northampton Town','Northampton Town'), ('Oldham Athletic','Oldham Athletic'),
  ('Port Vale','Port Vale'), ('Rochdale','Rochdale'), ('Rotherham United','Rotherham United'),
  ('Salford City','Salford City'), ('Shrewsbury Town','Shrewsbury Town'), ('Swindon Town','Swindon Town'),
  ('Tranmere Rovers','Tranmere Rovers'), ('Walsall','Walsall'), ('York City','York City'),
  ('AFC Fylde','AFC Fylde'), ('Aldershot Town','Aldershot Town'), ('Altrincham','Altrincham'), ('Barrow','Barrow'),
  ('Boreham Wood','Boreham Wood'), ('Boston United','Boston United'), ('Carlisle United','Carlisle United'),
  ('Eastleigh','Eastleigh'), ('FC Halifax Town','FC Halifax Town'), ('Forest Green Rovers','Forest Green Rovers'),
  ('Gateshead','Gateshead'), ('Harrogate Town','Harrogate Town'), ('Hartlepool United','Hartlepool United'),
  ('Hornchurch','Hornchurch'), ('Kidderminster Harriers','Kidderminster Harriers'),
  ('Scunthorpe United','Scunthorpe United'), ('Solihull Moors','Solihull Moors'), ('Southend United','Southend United'),
  ('Sutton United','Sutton United'), ('Tamworth','Tamworth'), ('Wealdstone','Wealdstone'), ('Woking','Woking'),
  ('Worthing','Worthing'), ('Yeovil Town','Yeovil Town')
),
fc26 AS (
  SELECT c.game_name, p.*
  FROM clubs c
  JOIN sofifa_players p
    ON p.fifa_year = 2026
   AND regexp_replace(LOWER(COALESCE(p.club, '')), '[^a-z]', '', 'g') = regexp_replace(LOWER(c.sofifa_name), '[^a-z]', '', 'g')
),
-- A club is filled only if FC 27 has almost nobody there (fewer than 11) and
-- FC 26 has a real squad (16 or more).
eligible AS (
  SELECT c.game_name
  FROM clubs c
  WHERE (SELECT COUNT(*) FROM sofifa_players q WHERE q.fifa_year = 2027 AND q.club = c.game_name) < 11
    AND (SELECT COUNT(*) FROM fc26 f WHERE f.game_name = c.game_name) >= 16
),
-- The newest edition (not FC 26 / FC 27) that knows each player's position
-- and nationality — the same lookup fc27_backfill_positions_nationality.sql uses.
earlier_positions AS (
  SELECT DISTINCT ON (sofifa_id) sofifa_id, COALESCE(NULLIF(manual_positions, ''), positions) AS positions
  FROM sofifa_players
  WHERE fifa_year NOT IN (2026, 2027)
    AND COALESCE(NULLIF(manual_positions, ''), NULLIF(positions, '')) IS NOT NULL
    AND sofifa_id IN (SELECT sofifa_id FROM fc26)
  ORDER BY sofifa_id, fifa_year DESC
),
earlier_nationality AS (
  SELECT DISTINCT ON (sofifa_id) sofifa_id, COALESCE(NULLIF(manual_nationality, ''), nationality) AS nationality
  FROM sofifa_players
  WHERE fifa_year NOT IN (2026, 2027)
    AND COALESCE(NULLIF(manual_nationality, ''), NULLIF(nationality, '')) IS NOT NULL
    AND sofifa_id IN (SELECT sofifa_id FROM fc26)
  ORDER BY sofifa_id, fifa_year DESC
),
-- His six card numbers (and crossing), for the position guess.
card AS (
  SELECT f.sofifa_id,
    COALESCE(NULLIF(substring(f.attributes ->> 'attr_pac' FROM '^\s*(\d+)'), '')::int, 0) AS pac,
    COALESCE(NULLIF(substring(f.attributes ->> 'attr_sho' FROM '^\s*(\d+)'), '')::int, 0) AS sho,
    COALESCE(NULLIF(substring(f.attributes ->> 'attr_pas' FROM '^\s*(\d+)'), '')::int, 0) AS pas,
    COALESCE(NULLIF(substring(f.attributes ->> 'attr_dri' FROM '^\s*(\d+)'), '')::int, 0) AS dri,
    COALESCE(NULLIF(substring(f.attributes ->> 'attr_def' FROM '^\s*(\d+)'), '')::int, 0) AS def,
    COALESCE(NULLIF(substring(f.attributes ->> 'attr_phy' FROM '^\s*(\d+)'), '')::int, 0) AS phy,
    COALESCE(NULLIF(substring(f.attributes ->> 'attr_cr'  FROM '^\s*(\d+)'), '')::int, 0) AS cr
  FROM fc26 f
),
src AS (
  SELECT
    f.sofifa_id,
    2027                       AS fifa_year,
    'FC 27'                    AS fifa_edition,
    f.name,
    f.positions,
    f.nationality,
    f.game_name                AS club,
    f.league,
    f.overall,
    f.potential,
    -- A year older (same rule as the Premier League clone).
    COALESCE(
      f.age,
      NULLIF(regexp_replace(COALESCE(f.attributes ->> 'age', ''),     '[^0-9]', '', 'g'), '')::int,
      NULLIF(regexp_replace(COALESCE(f.attributes ->> 'attr_ae', ''), '[^0-9]', '', 'g'), '')::int
    ) + 1                      AS age,
    f.image_url,
    CASE
      WHEN f.attributes -> 'age' IS NOT NULL THEN
        jsonb_set(f.attributes, '{age}', to_jsonb(
          COALESCE(NULLIF(regexp_replace(COALESCE(f.attributes ->> 'age', ''), '[^0-9]', '', 'g'), '')::int, 0) + 1))
      ELSE COALESCE(f.attributes, '{}'::jsonb)
    END                        AS attributes,
    f.manual_overall,
    -- Position: his own → an earlier edition's → a guess from his card.
    CASE
      WHEN COALESCE(NULLIF(f.manual_positions, ''), NULLIF(f.positions, '')) IS NOT NULL THEN f.manual_positions
      WHEN ep.positions IS NOT NULL THEN ep.positions
      WHEN k.pac = 0 AND k.sho = 0 AND k.def = 0 THEN NULL
      WHEN k.cr > 0 AND k.cr <= 22 AND k.def <= 50 THEN 'GK'
      WHEN k.def >= k.sho + 18 AND k.def >= 50 THEN
        CASE WHEN k.phy >= k.pac OR (k.def >= 60 AND k.pac < 70) THEN 'CB' ELSE 'RB,LB' END
      WHEN k.def >= k.sho + 5 AND k.pac >= 68 AND k.def >= 48 THEN 'RB,LB'
      WHEN k.sho >= k.def + 22 AND k.sho >= k.pas - 2 AND k.sho >= 55 THEN
        CASE WHEN k.pac >= 78 AND k.dri >= k.sho THEN 'RW,LW' ELSE 'ST' END
      WHEN k.pac >= 76 AND k.dri >= 60 AND k.def < 50 THEN 'RW,LW'
      WHEN k.pas >= k.dri AND k.def >= 48 THEN 'CDM,CM'
      WHEN k.dri >= 62 AND k.pas >= 58 AND k.def < 50 THEN 'CAM,CM'
      ELSE 'CM'
    END                        AS manual_positions,
    CASE
      WHEN COALESCE(NULLIF(f.manual_nationality, ''), NULLIF(f.nationality, '')) IS NOT NULL THEN f.manual_nationality
      ELSE en.nationality
    END                        AS manual_nationality,
    CASE
      WHEN COALESCE(NULLIF(f.manual_positions, ''), NULLIF(f.positions, '')) IS NOT NULL THEN 'own'
      WHEN ep.positions IS NOT NULL THEN 'earlier'
      ELSE 'guessed'
    END                        AS position_from
  FROM fc26 f
  JOIN eligible e ON e.game_name = f.game_name
  LEFT JOIN earlier_positions ep ON ep.sofifa_id = f.sofifa_id
  LEFT JOIN earlier_nationality en ON en.sofifa_id = f.sofifa_id
  LEFT JOIN card k ON k.sofifa_id = f.sofifa_id
),
ins AS (
  INSERT INTO sofifa_players (
    sofifa_id, fifa_year, fifa_edition, name, positions, nationality,
    club, league, overall, potential, age, image_url, attributes,
    manual_overall, manual_positions, manual_nationality
  )
  SELECT
    sofifa_id, fifa_year, fifa_edition, name, positions, nationality,
    club, league, overall, potential, age, image_url, attributes,
    manual_overall, manual_positions, manual_nationality
  FROM src
  ON CONFLICT (sofifa_id, fifa_year) DO NOTHING
  RETURNING sofifa_id, club
),
landed AS (
  SELECT i.club, s.position_from FROM ins i JOIN src s ON s.sofifa_id = i.sofifa_id
)
SELECT
  (SELECT COUNT(*) FROM landed)                                            AS players_copied,
  (SELECT COUNT(DISTINCT club) FROM landed)                                AS clubs_filled,
  (SELECT COUNT(*) FROM landed WHERE position_from = 'own')                AS positions_own,
  (SELECT COUNT(*) FROM landed WHERE position_from = 'earlier')            AS positions_earlier,
  (SELECT COUNT(*) FROM landed WHERE position_from = 'guessed')            AS positions_guessed,
  (SELECT string_agg(club || ': ' || n, ' | ' ORDER BY club)
     FROM (SELECT club, COUNT(*) AS n FROM landed GROUP BY club) t)       AS per_club;


-- ════════════════════════════════════════════════════════════════════════════
-- OPTIONAL — check afterwards (run on its own)
-- ════════════════════════════════════════════════════════════════════════════
-- SELECT club, COUNT(*) AS fc27_players, ROUND(AVG(age), 1) AS avg_age,
--        COUNT(*) FILTER (WHERE COALESCE(NULLIF(manual_positions, ''), positions) LIKE 'GK%') AS keepers
-- FROM sofifa_players
-- WHERE fifa_year = 2027 AND club IN ('Blackpool', 'Stockport County', 'Bristol Rovers', 'Tranmere Rovers')
-- GROUP BY club ORDER BY club;


-- ============================================================================
-- ROLLBACK — deletes only the rows PART 2 copied: an FC 27 player at one of
-- the filled clubs who was at that same club in FC 26. Edits made to them
-- since go too. Anyone moved there by hand (Kyle Dempsey at Port Vale, from
-- Bolton) and the five hand-built League One clubs are left alone.
-- ============================================================================
-- DELETE FROM sofifa_players p
-- USING sofifa_players s
-- WHERE p.fifa_year = 2027
--   AND s.fifa_year = 2026
--   AND s.sofifa_id = p.sofifa_id
--   AND regexp_replace(LOWER(s.club), '[^a-z]', '', 'g')
--       = regexp_replace(LOWER(CASE WHEN p.club = 'Blackpool' THEN 'Blackpool FC' ELSE p.club END), '[^a-z]', '', 'g')
--   AND p.club IN (
--     'AFC Wimbledon','Barnsley','Blackpool','Bradford City','Burton Albion','Cambridge United',
--     'Doncaster Rovers','Leyton Orient','Mansfield Town','Milton Keynes Dons','Notts County',
--     'Oxford United','Peterborough United','Plymouth Argyle','Sheffield Wednesday','Stevenage',
--     'Stockport County','Wycombe Wanderers','Accrington Stanley','Bristol Rovers','Cheltenham Town',
--     'Colchester United','Crawley Town','Crewe Alexandra','Exeter City','Fleetwood Town','Gillingham',
--     'Grimsby Town','Newport County','Northampton Town','Oldham Athletic','Port Vale','Rotherham United',
--     'Salford City','Shrewsbury Town','Swindon Town','Tranmere Rovers','Walsall','Barrow',
--     'Carlisle United','Forest Green Rovers','Harrogate Town','Sutton United'
--   );
