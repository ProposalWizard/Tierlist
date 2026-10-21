-- team_room_v2.sql — the Team room, round two (Harry, 20 Oct 2026):
-- "read receipts in chat … the patch notes system could have like a read
-- receipts and notes so we know when everyone has read and understood".
--
-- Run AFTER team_room.sql (it uses its team_room_admin() and
-- team_room_person() checks). Never edit team_room.sql; this file adds:
--   1. team_read_marks — the newest chat message each person has had on screen
--      (the H/M/L "seen" faces under each message). One row per person.
--   2. team_acks       — "Got it" on a pointed-at part of a page, and
--      "Read and understood" on a patch note. One row per person per thing.
--   3. "patch" as a kind of note in team_notes (the notes under a patch note).
-- Replies, @mentions, page cards and points need NO database change: they
-- live inside the message text, so they already work for everyone.
--
-- Until this runs: seen faces, Got it and Read-and-understood are kept on the
-- device that pressed them, and patch-note notes stay in that browser. The
-- screens say "saved on this device only". Safe to run twice.

-- ── 1. Who has seen what ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_read_marks (
  person text PRIMARY KEY CHECK (person IN ('Harry', 'Mikey', 'Leo')),
  last_seen_id bigint NOT NULL DEFAULT 0 CHECK (last_seen_id >= 0),
  at timestamptz NOT NULL DEFAULT now()
);

-- A seen mark only ever moves forward (two devices can race).
CREATE OR REPLACE FUNCTION public.team_read_marks_forward() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.last_seen_id := GREATEST(COALESCE(OLD.last_seen_id, 0), NEW.last_seen_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS team_read_marks_forward ON public.team_read_marks;
CREATE TRIGGER team_read_marks_forward BEFORE UPDATE ON public.team_read_marks
  FOR EACH ROW EXECUTE FUNCTION public.team_read_marks_forward();

-- ── 2. Got it / Read and understood ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_acks (
  kind text NOT NULL CHECK (kind IN ('point', 'patch')),
  target text NOT NULL CHECK (char_length(target) BETWEEN 1 AND 80),
  person text NOT NULL CHECK (person IN ('Harry', 'Mikey', 'Leo')),
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, target, person)
);

-- ── 3. Notes under a patch note ─────────────────────────────────────────
-- team_room.sql allowed only 'idea' and 'push'. Drop whichever check on
-- target_kind is there (its name was made up by Postgres) and put one back
-- that also allows 'patch'.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.team_notes'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%target_kind%'
  LOOP
    EXECUTE format('ALTER TABLE public.team_notes DROP CONSTRAINT %I', c);
  END LOOP;
END $$;
ALTER TABLE public.team_notes ADD CONSTRAINT team_notes_target_kind_v2
  CHECK (target_kind IN ('idea', 'push', 'patch'));

-- ── Row rules (admins only, as yourself) ───────────────────────────────
ALTER TABLE public.team_read_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_acks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read team_read_marks" ON public.team_read_marks;
CREATE POLICY "admins read team_read_marks" ON public.team_read_marks FOR SELECT USING (public.team_room_admin());
DROP POLICY IF EXISTS "seen own" ON public.team_read_marks;
CREATE POLICY "seen own" ON public.team_read_marks FOR INSERT
  WITH CHECK (public.team_room_admin() AND person = public.team_room_person());
DROP POLICY IF EXISTS "seen own move" ON public.team_read_marks;
CREATE POLICY "seen own move" ON public.team_read_marks FOR UPDATE
  USING (public.team_room_admin() AND person = public.team_room_person())
  WITH CHECK (public.team_room_admin() AND person = public.team_room_person());

DROP POLICY IF EXISTS "admins read team_acks" ON public.team_acks;
CREATE POLICY "admins read team_acks" ON public.team_acks FOR SELECT USING (public.team_room_admin());
DROP POLICY IF EXISTS "ack own" ON public.team_acks;
CREATE POLICY "ack own" ON public.team_acks FOR INSERT
  WITH CHECK (public.team_room_admin() AND person = public.team_room_person());
DROP POLICY IF EXISTS "ack own again" ON public.team_acks;
CREATE POLICY "ack own again" ON public.team_acks FOR UPDATE
  USING (public.team_room_admin() AND person = public.team_room_person())
  WITH CHECK (public.team_room_admin() AND person = public.team_room_person());
DROP POLICY IF EXISTS "unack own" ON public.team_acks;
CREATE POLICY "unack own" ON public.team_acks FOR DELETE
  USING (public.team_room_admin() AND person = public.team_room_person());

-- ── Live updates ────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['team_read_marks','team_acks'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
ALTER TABLE public.team_read_marks REPLICA IDENTITY FULL;
ALTER TABLE public.team_acks REPLICA IDENTITY FULL;

-- Check: two new tables with their rules; both in the live list; team_notes allows 'patch'.
SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename IN ('team_read_marks', 'team_acks') ORDER BY tablename, cmd;
SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN ('team_read_marks', 'team_acks');
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.team_notes'::regclass AND contype = 'c';
