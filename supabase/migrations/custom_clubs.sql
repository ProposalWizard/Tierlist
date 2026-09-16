-- CUSTOM CLUBS. RUN — applied directly to the live project 16 Sep 2026
-- (this session had real Supabase access; the table already exists and is
-- in use). Checked in here purely for the repo's own record, matching every
-- other migration's convention — running it again is a safe no-op.
--
-- Requested directly: the ability to invent a whole fake club — name, real
-- players (created from scratch, not scraped), a kit, a badge, a stadium
-- name — and later vote it into a real competition (Rule Book).
--
-- Deliberately a SEPARATE, small metadata table rather than a parallel
-- player/squad system. A custom club's PLAYERS live in the exact same
-- `sofifa_players` table every real club's players already do (with a
-- `custom:` -prefixed sofifa_id, and `club` set to this club's name) —
-- so every existing real-data code path (league-squads fetch, the admin
-- players editor, the transfer engine) already works for them with zero
-- changes. Its LOGO reuses `club_logos` (keyed by club name, exactly like
-- a real club's). This table only holds the handful of fields that don't
-- already have a real home: the club's own kit (a real home+away pair —
-- see kits.ts's ClubKits) and its stadium name.
create table if not exists custom_clubs (
  name text primary key,
  stadium_name text not null default 'New Stadium',
  home_shirt text not null default '#dc2626',
  home_trim text not null default '#ffffff',
  away_shirt text not null default '#ffffff',
  away_trim text not null default '#dc2626',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table custom_clubs enable row level security;

-- Public read (the game itself, and anyone browsing, needs to read kit
-- colours/stadium names without being signed in as admin) — same posture
-- as club_logos/nationality_flags, which are also public-read.
drop policy if exists "custom_clubs_public_read" on custom_clubs;
create policy "custom_clubs_public_read" on custom_clubs for select using (true);

-- Writes go through the service-role client from admin API routes only
-- (same pattern as every other admin-football table) — no direct-write
-- policy for anon/authenticated.
