-- CHANGES THE DATABASE
-- What: adds ONE new table, beta_signups (an email address, where it was
--       typed, and when). It changes no table that exists today.
-- Why:  the new public home has a "Join the beta" box (Harry, 12 Nov 2026:
--       "try the beta, sign up"). This is where those emails are kept.
-- Who can do what: anyone may ADD a row (the form). Nobody can read, change
--       or delete rows from the website; only the Supabase dashboard (the
--       service role) can see the list. One row per email.
-- Status: NOT RUN. Needs Harry's yes, then run once in the Supabase SQL
--       Editor. Until then the form says "Sign-ups open soon" and keeps
--       nothing. Safe to run twice.

create table if not exists public.beta_signups (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  source      text not null default 'home',
  created_at  timestamptz not null default now(),
  constraint beta_signups_email_len   check (char_length(email) between 5 and 254),
  constraint beta_signups_email_shape check (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$'),
  constraint beta_signups_source_len  check (char_length(source) <= 40)
);

create unique index if not exists beta_signups_email_key on public.beta_signups (email);

alter table public.beta_signups enable row level security;

-- Adding a row is the only thing the website may do.
revoke all on public.beta_signups from anon, authenticated;
grant insert on public.beta_signups to anon, authenticated;

drop policy if exists "beta_signups: anyone may sign up" on public.beta_signups;
create policy "beta_signups: anyone may sign up"
  on public.beta_signups
  for insert
  to anon, authenticated
  with check (true);

-- No select, update or delete policy on purpose: with row level security on,
-- that means nobody but the service role can read or change the list.
