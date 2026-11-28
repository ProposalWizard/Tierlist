-- CHANGES THE DATABASE. What: two small tables for Marketing → Library and Marketing → Results.
--   marketing_videos   one row per video in a space's storage: its name, why it was made, the YouTube/Facebook
--                      titles, the caption and the hashtags for each app. The video file itself stays in Cloudflare
--                      (Mikey's own bucket for football and content, the team's bucket for kib); this only holds words.
--   marketing_lessons  "What worked": short lines the team writes down after seeing the numbers.
-- Why: Mikey, 28 Nov 2026: put the Mikey's Brain system into the Knowitball marketing area: a library everyone can
-- add to (by hand or through Claude), ready-made captions and hashtags, the guided send, numbers, what worked.
--
-- SAFE: only adds two new tables (created if missing), changes nothing that exists, and can be re-run.
-- Server only: Row Level Security is on with no policies, so the browser's anon key can read nothing here.
-- Run it once in the Supabase SQL Editor (or ask a Claude chat that has the Supabase connector to run it).

CREATE TABLE IF NOT EXISTS public.marketing_videos (
  space       text NOT NULL DEFAULT 'kib' CHECK (space IN ('football', 'content', 'kib')),
  video_key   text NOT NULL,                         -- the same key the posting queue uses ("own:" in front for Mikey's bucket)
  name        text NOT NULL DEFAULT '',
  why         text NOT NULL DEFAULT '',              -- one line: what the video is and when to post it
  series      text NOT NULL DEFAULT '',              -- optional label, e.g. "Explainer", "Stat twin"
  len_label   text NOT NULL DEFAULT '',              -- "0:29"
  made_on     date,
  titles      jsonb NOT NULL DEFAULT '{}'::jsonb,    -- {"youtube": "...", "facebook": "..."}
  captions    jsonb NOT NULL DEFAULT '{}'::jsonb,    -- {"instagram": "...", "facebook": "...", "youtube": "...", "tiktok": "..."}
  tags        jsonb NOT NULL DEFAULT '{}'::jsonb,    -- {"instagram": "#a #b", ...}
  created_by  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (space, video_key)
);

CREATE TABLE IF NOT EXISTS public.marketing_lessons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space       text NOT NULL DEFAULT 'kib' CHECK (space IN ('football', 'content', 'kib')),
  body        text NOT NULL,
  created_by  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_lessons_space ON public.marketing_lessons (space, created_at DESC);

ALTER TABLE public.marketing_videos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_lessons ENABLE ROW LEVEL SECURITY;
