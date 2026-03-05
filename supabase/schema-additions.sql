-- ============================================================
-- Run this entire file in Supabase → SQL Editor
-- ============================================================

-- 1. User profiles (username, anonymous preference, login streak)
create table if not exists user_profiles (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  username       text unique,
  is_anonymous   boolean not null default false,
  current_streak int not null default 1,
  longest_streak int not null default 1,
  last_active_date date not null default current_date,
  updated_at     timestamptz not null default now()
);

alter table user_profiles enable row level security;
create policy "Anyone can read profiles"      on user_profiles for select using (true);
create policy "Users can insert own profile"  on user_profiles for insert with check (auth.uid() = user_id);
create policy "Users can update own profile"  on user_profiles for update using (auth.uid() = user_id);

-- 2. Editable categories
create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table categories enable row level security;
create policy "Anyone can read categories" on categories for select using (true);
-- Writes go through service-role API routes (no public write policy needed)

-- Seed default categories (safe to re-run)
insert into categories (name, sort_order) values
  ('Football',    0),
  ('Basketball',  1),
  ('Movies & TV', 2),
  ('Music',       3),
  ('Gaming',      4),
  ('Food & Drink',5),
  ('Animals',     6),
  ('Other',       7)
on conflict (name) do nothing;

-- 3. Tierlist likes (one per user per tierlist)
create table if not exists tierlist_likes (
  user_id     uuid not null references auth.users(id)  on delete cascade,
  tierlist_id uuid not null references tierlists(id)   on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, tierlist_id)
);

alter table tierlist_likes enable row level security;
create policy "Anyone can read likes"        on tierlist_likes for select using (true);
create policy "Users can manage own likes"   on tierlist_likes for all    using (auth.uid() = user_id);

-- 4. Saved tierlists (bookmarks)
create table if not exists saved_tierlists (
  user_id     uuid not null references auth.users(id)  on delete cascade,
  tierlist_id uuid not null references tierlists(id)   on delete cascade,
  saved_at    timestamptz not null default now(),
  primary key (user_id, tierlist_id)
);

alter table saved_tierlists enable row level security;
create policy "Users can manage own saves"   on saved_tierlists for all using (auth.uid() = user_id);
create policy "Users can read own saves"     on saved_tierlists for select using (auth.uid() = user_id);

-- 5. View count column on tierlists
alter table tierlists add column if not exists view_count bigint not null default 0;

-- 6. Atomic view-count increment (callable by anyone)
create or replace function increment_view_count(p_id uuid)
returns void language sql security definer as $$
  update tierlists set view_count = view_count + 1 where id = p_id;
$$;
grant execute on function increment_view_count(uuid) to anon, authenticated;

-- 7. Login streak updater (callable by authenticated users only)
create or replace function update_login_streak(p_user_id uuid)
returns void language plpgsql security definer as $$
declare
  v_last   date;
  v_streak int;
  v_longest int;
begin
  select last_active_date, current_streak, longest_streak
    into v_last, v_streak, v_longest
    from user_profiles
   where user_id = p_user_id;

  if not found then return; end if;           -- no profile yet
  if v_last = current_date then return; end if; -- already updated today

  if v_last = current_date - 1 then
    -- consecutive day → extend streak
    update user_profiles set
      current_streak   = v_streak + 1,
      longest_streak   = greatest(v_longest, v_streak + 1),
      last_active_date = current_date,
      updated_at       = now()
    where user_id = p_user_id;
  else
    -- streak broken → reset
    update user_profiles set
      current_streak   = 1,
      last_active_date = current_date,
      updated_at       = now()
    where user_id = p_user_id;
  end if;
end;
$$;
grant execute on function update_login_streak(uuid) to authenticated;
