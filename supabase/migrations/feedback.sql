-- Feedback table: lightweight anonymous feedback from users
create table if not exists feedback (
  id         uuid primary key default uuid_generate_v4(),
  message    text not null,
  page_url   text,
  created_at timestamptz default now()
);

-- RLS: allow anyone to insert (no auth required), no read/update/delete from client
alter table feedback enable row level security;

create policy "Anyone can insert feedback"
  on feedback for insert
  with check (true);
