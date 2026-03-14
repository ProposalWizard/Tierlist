-- =============================================================
-- Image cleanup tracking
-- Tracks uploaded images so unused ones can be cleaned up later.
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor).
-- =============================================================

-- Tracks every image uploaded to Supabase Storage.
-- `is_used` is set to true when the image is referenced by a tierlist.
-- A cleanup job can delete rows where is_used = false AND uploaded_at < NOW() - 24 hours.
create table if not exists uploaded_images (
  id          uuid primary key default gen_random_uuid(),
  storage_path text not null,               -- path in the tierlist-images bucket
  uploaded_at  timestamptz not null default now(),
  is_used      boolean not null default false -- true once linked to a tierlist
);

alter table uploaded_images enable row level security;

-- Authenticated users can insert (track their uploads)
create policy "Authenticated users can insert uploaded_images"
  on uploaded_images for insert
  to authenticated
  with check (true);

-- Service role handles reads/updates/deletes for cleanup
-- (no public select needed — cleanup runs server-side)

-- Index for the cleanup query: find unused images older than 24h
create index if not exists idx_uploaded_images_cleanup
  on uploaded_images (is_used, uploaded_at)
  where is_used = false;
