-- ============================================================
-- Migration 002 – Add more tier list topics and players
-- Run once in the Supabase SQL Editor (Dashboard → SQL Editor)
-- Safe to re-run: uses ON CONFLICT guards.
-- ============================================================


-- ── La Liga 2024/25 ─────────────────────────────────────────
WITH topic AS (
  INSERT INTO tierlist_topics (slug, title, description)
  VALUES (
    'la-liga-2024',
    'La Liga 2024/25',
    'Rank the best players from Spain''s top flight this season'
  )
  ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
  RETURNING id
),
new_players (name, position, club) AS (VALUES
  ('Vinicius Jr',        'LW',  'Real Madrid'),
  ('Jude Bellingham',   'CAM', 'Real Madrid'),
  ('Kylian Mbappe',     'ST',  'Real Madrid'),
  ('Rodrygo',           'RW',  'Real Madrid'),
  ('Toni Kroos',        'CM',  'Real Madrid'),
  ('Robert Lewandowski','ST',  'FC Barcelona'),
  ('Lamine Yamal',      'RW',  'FC Barcelona'),
  ('Raphinha',          'LW',  'FC Barcelona'),
  ('Pedri',             'CM',  'FC Barcelona'),
  ('Dani Olmo',         'AM',  'FC Barcelona'),
  ('Antoine Griezmann', 'ST',  'Atletico Madrid'),
  ('Julian Alvarez',    'ST',  'Atletico Madrid')
)
INSERT INTO tierlist_players (topic_id, name, position, club)
SELECT topic.id, p.name, p.position, p.club
FROM topic, new_players p
WHERE NOT EXISTS (
  SELECT 1
  FROM tierlist_players tp
  WHERE tp.topic_id = topic.id AND tp.name = p.name
);


-- ── Champions League 2024/25 ─────────────────────────────────
WITH topic AS (
  INSERT INTO tierlist_topics (slug, title, description)
  VALUES (
    'champions-league-2024',
    'Champions League 2024/25',
    'The best players competing in European club football this season'
  )
  ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
  RETURNING id
),
new_players (name, position, club) AS (VALUES
  ('Kylian Mbappe',     'ST',  'Real Madrid'),
  ('Vinicius Jr',       'LW',  'Real Madrid'),
  ('Jude Bellingham',   'CAM', 'Real Madrid'),
  ('Erling Haaland',    'ST',  'Man City'),
  ('Mohamed Salah',     'RW',  'Liverpool'),
  ('Bukayo Saka',       'RW',  'Arsenal'),
  ('Lamine Yamal',      'RW',  'FC Barcelona'),
  ('Robert Lewandowski','ST',  'FC Barcelona'),
  ('Jamal Musiala',     'AM',  'Bayern Munich'),
  ('Harry Kane',        'ST',  'Bayern Munich'),
  ('Florian Wirtz',     'AM',  'Bayer Leverkusen'),
  ('Phil Foden',        'AM',  'Man City')
)
INSERT INTO tierlist_players (topic_id, name, position, club)
SELECT topic.id, p.name, p.position, p.club
FROM topic, new_players p
WHERE NOT EXISTS (
  SELECT 1
  FROM tierlist_players tp
  WHERE tp.topic_id = topic.id AND tp.name = p.name
);


-- ── Premier League GOATs ─────────────────────────────────────
WITH topic AS (
  INSERT INTO tierlist_topics (slug, title, description)
  VALUES (
    'premier-league-goat',
    'Premier League GOATs',
    'Rank the all-time legends of the Premier League era'
  )
  ON CONFLICT (slug) DO UPDATE SET slug = EXCLUDED.slug
  RETURNING id
),
new_players (name, position, club) AS (VALUES
  ('Thierry Henry',     'ST',  'Arsenal'),
  ('Cristiano Ronaldo', 'FW',  'Man United'),
  ('Alan Shearer',      'ST',  'Newcastle'),
  ('Wayne Rooney',      'ST',  'Man United'),
  ('Steven Gerrard',    'CM',  'Liverpool'),
  ('Frank Lampard',     'CM',  'Chelsea'),
  ('Patrick Vieira',    'CM',  'Arsenal'),
  ('Roy Keane',         'CM',  'Man United'),
  ('Didier Drogba',     'ST',  'Chelsea'),
  ('Dennis Bergkamp',   'AM',  'Arsenal'),
  ('Eric Cantona',      'ST',  'Man United'),
  ('Peter Schmeichel',  'GK',  'Man United')
)
INSERT INTO tierlist_players (topic_id, name, position, club)
SELECT topic.id, p.name, p.position, p.club
FROM topic, new_players p
WHERE NOT EXISTS (
  SELECT 1
  FROM tierlist_players tp
  WHERE tp.topic_id = topic.id AND tp.name = p.name
);
