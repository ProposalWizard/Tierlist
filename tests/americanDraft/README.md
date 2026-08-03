# American draft tests

Run against a stand-in Supabase client (`fakeSupabase.mjs`) that mimics the
PostgREST behaviour the draft actually depends on: filters, ordering, keyset
paging and — importantly — the server's 1000-row response cap, which has caused
real bugs here by silently truncating results.

    npx tsx tests/americanDraft/fullDraft.mts
    npx tsx tests/americanDraft/prime.mts
    npx tsx tests/americanDraft/randomness.mts

**fullDraft** — plays a complete 14-round draft plus a between-season
replacement draft for two managers, and asserts: pools are always 10, no
duplicate player or duplicate name in a pool, nobody is drafted by two
managers, every player is eligible for the slot they were drafted into, squads
come out 11 starters + 3 subs, replacements are not marked as substitutes, the
replacement pool never offers an already-owned player, and a manager who lost
their keeper is guaranteed one.

**prime** — a player whose best-rated season lists different positions must
keep the positions he was drafted with, or he ends up out of position in his
own slot. Uses the two cases this actually happened to.

**randomness** — the pool must span the whole era. Ideal randomness is ~8.0
distinct seasons per ten-card round; a broken shuffle scored 6.0 and put nine
of ten cards inside a five-year window 38% of the time. Also asserts every
edition is reachable and that the era cache stops per-round queries.
