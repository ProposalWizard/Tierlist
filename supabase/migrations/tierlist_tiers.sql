-- Add tiers JSONB column to regular tierlists
-- Stores custom tier labels/colors so the play page uses them instead of defaults.
-- Default matches DEFAULT_TIER_ROWS in lib/types.ts.

ALTER TABLE public.tierlists
  ADD COLUMN IF NOT EXISTS tiers JSONB NOT NULL DEFAULT '[
    {"label":"S","color":"#4ade80"},
    {"label":"A","color":"#86efac"},
    {"label":"B","color":"#fde047"},
    {"label":"C","color":"#fb923c"},
    {"label":"D","color":"#f87171"}
  ]';
