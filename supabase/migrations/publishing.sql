-- CHANGES THE DATABASE. What: the tables behind Admin → Publishing (/admin/publish), which posts our videos to
-- Instagram, Facebook and YouTube on a schedule, and a 5-minute timer that tells the site to post anything due.
-- Why: Mikey, 11 Nov 2026: "build our own version" of a posting tool (Metricool and the like) — post to every
-- platform from a chat or the admin page, at a set time, and see the numbers afterwards.
--
-- NOT RUN. Run it in the Supabase SQL Editor once, AFTER the site with /api/admin/publish/tick is live, and
-- after replacing PASTE_PUBLISH_CRON_SECRET below with the same value as PUBLISH_CRON_SECRET in Vercel.
-- Safe to re-run (tables are created only if missing; the timer is replaced, not doubled).
--
-- WHAT IT ADDS
--  * publish_accounts: one row per connected platform (instagram, facebook, youtube). The login tokens are
--    encrypted by the site (AES-256-GCM, key PUBLISH_TOKEN_KEY in Vercel) before they are stored, so this table
--    never holds a usable token on its own. Only the server (service role) can read or write it.
--  * publish_posts: the queue. One row per video post: the video (an R2 key from Marketing uploads), the caption
--    and title for each platform, which platforms, when, and what happened (links, errors, stats).
--  * A pg_cron job every 5 minutes that calls https://knowitball.co.uk/api/admin/publish/tick (pg_net).
--    The tick posts whatever is due, carries on posts that need several steps (an Instagram Reel is processed
--    by Instagram before it can be published), and refreshes the numbers. Works on any Vercel plan.
--
-- Size: a few KB per post. Nothing here holds video; videos stay in R2 (Marketing → Uploads).

CREATE TABLE IF NOT EXISTS public.publish_accounts (
  platform     text PRIMARY KEY CHECK (platform IN ('instagram', 'facebook', 'youtube')),
  account_id   text NOT NULL,             -- Instagram user id / Facebook Page id / YouTube channel id
  account_name text NOT NULL DEFAULT '',  -- what the page shows ("knowitballjr", "Knowitball", ...)
  token_enc    text NOT NULL,             -- encrypted access token (Page token for Facebook and Instagram)
  refresh_enc  text,                      -- encrypted refresh token (YouTube)
  expires_at   timestamptz,               -- when token_enc stops working (null = it does not expire)
  extra        jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_by uuid,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.publish_posts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_key    text NOT NULL,             -- R2 key, e.g. videos/inbox/20261111-180000-ab12-ch03.mp4
  title        text NOT NULL DEFAULT '',  -- YouTube title (and Facebook video title)
  captions     jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {"instagram": "...", "facebook": "...", "youtube": "..."}
  platforms    text[] NOT NULL,           -- any of instagram, facebook, youtube
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  status       text NOT NULL DEFAULT 'scheduled'
               CHECK (status IN ('scheduled', 'posting', 'done', 'partial', 'failed', 'cancelled')),
  results      jsonb NOT NULL DEFAULT '{}'::jsonb,   -- per platform: stage, ids, link, error, stats
  attempts     int NOT NULL DEFAULT 0,
  created_by   text NOT NULL DEFAULT '',  -- "Mikey", "chat", ...
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS publish_posts_due ON public.publish_posts (status, scheduled_at);

-- Server only: Row Level Security on, and no policies, so the browser's anon key can read nothing here.
ALTER TABLE public.publish_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publish_posts    ENABLE ROW LEVEL SECURITY;

-- The 5-minute timer.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'publish-tick') THEN
    PERFORM cron.unschedule('publish-tick');
  END IF;
END $$;

SELECT cron.schedule(
  'publish-tick',
  '*/5 * * * *',
  $job$
    SELECT net.http_post(
      url     := 'https://knowitball.co.uk/api/admin/publish/tick',
      headers := '{"Content-Type": "application/json", "x-publish-cron": "PASTE_PUBLISH_CRON_SECRET"}'::jsonb,
      body    := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$
);
