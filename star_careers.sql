-- Star career game: cloud saves tied to a user account.
--
-- One row per user. The career JSON is the same blob localStorage has always
-- held; we just write it here too so a device wipe or a new login recovers it.
-- Run this in the Supabase SQL Editor before deploying the cloud-save feature.

CREATE TABLE IF NOT EXISTS star_careers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  career     JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE star_careers ENABLE ROW LEVEL SECURITY;

-- Each user can only read and write their own row.
CREATE POLICY "star_careers_select" ON star_careers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "star_careers_insert" ON star_careers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "star_careers_update" ON star_careers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "star_careers_delete" ON star_careers
  FOR DELETE USING (auth.uid() = user_id);
