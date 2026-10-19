-- team_room_claude.sql — ideas from Claude on the Team room's Ideas board
-- (Mikey, 19 Oct 2026: "can I get you to add ideas here? From Claude").
--
-- A Claude chat posts an idea FOR one of you (POST /api/team-ideas, written
-- with the service key). The idea belongs to that person (their lane, their
-- red dot for notes, they can delete it) and is marked from_claude so the
-- board shows a "Claude" tag. Run after team_room.sql. Safe to run twice.

ALTER TABLE public.team_ideas ADD COLUMN IF NOT EXISTS from_claude boolean NOT NULL DEFAULT false;

-- Check:
-- SELECT id, person, from_claude, title FROM public.team_ideas ORDER BY id DESC LIMIT 5;
