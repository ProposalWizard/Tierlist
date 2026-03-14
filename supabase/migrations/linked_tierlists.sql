-- Add linked_vote_tierlist_id to tierlists table
-- Allows linking a regular tierlist to a vote tierlist for cross-navigation
alter table tierlists
  add column if not exists linked_vote_tierlist_id uuid references vote_tierlists(id) on delete set null;

-- Index for reverse lookups (find regular tierlists linked to a vote tierlist)
create index if not exists idx_tierlists_linked_vote on tierlists(linked_vote_tierlist_id)
  where linked_vote_tierlist_id is not null;
