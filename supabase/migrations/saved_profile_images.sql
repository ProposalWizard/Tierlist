-- ============================================================
-- Saved profile images — users can save tierlist screenshots
-- to their profile for later viewing.
-- ============================================================

create table if not exists saved_profile_images (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  image_url       text not null,
  tierlist_title  text,
  tierlist_id     uuid references tierlists(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_saved_profile_images_user on saved_profile_images(user_id);

alter table saved_profile_images enable row level security;

create policy "Users can read own saved images"
  on saved_profile_images for select using (auth.uid() = user_id);

create policy "Users can insert own saved images"
  on saved_profile_images for insert with check (auth.uid() = user_id);

create policy "Users can delete own saved images"
  on saved_profile_images for delete using (auth.uid() = user_id);
