-- =============================================================
-- Category Homepage Settings
-- Run this in the Supabase SQL Editor.
-- Allows admins to control which tierlists appear per category
-- on the homepage and in what order.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.category_homepage_settings (
  category    TEXT        PRIMARY KEY,
  sort_method TEXT        NOT NULL DEFAULT 'recent',
  -- sort_method: 'recent' | 'views' | 'likes' | 'manual'
  pinned_ids  JSONB       NOT NULL DEFAULT '[]',
  -- pinned_ids: ordered array of tierlist UUIDs (used when sort_method = 'manual')
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.category_homepage_settings ENABLE ROW LEVEL SECURITY;

-- Only admins (via service role) can read/write; public cannot access directly
CREATE POLICY "Service role full access"
  ON public.category_homepage_settings
  USING (true)
  WITH CHECK (true);
