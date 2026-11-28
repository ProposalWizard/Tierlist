---
id: FACT-UI-026
type: fact
client: ui
tags: [ui, career, data]
status: live
date: 2026-11-27
source: "lib/draft/ranked.ts:1-15"
summary: PL Draft (New look switch): every draft is Ranked (full era, 3 re-spins, ratings shown) for one of three Hall of Fame boards (Normal, Prime, Chemistry with Normal ratings) or Custom (history only); FIFA-style Chemistry (lib/draft/chemistry.ts, up to +3 each, ~6-10 pts a season at 33); the Chemistry board needs supabase/migrations/draft_records_chemistry.sql run (PENDING).
---
Leo, 27 Nov 2026: "not loads of diff things that make drafts too different so u cant rlly compare to others." Also: convince to stay = higher-or-lower (components/draft/HigherLower.tsx, ~43% stay with sensible play vs the old 50% flip); Match Centre (lib/draft/matchTimeline.ts, never re-simulates) for finals and the biggest win, shown only after the season reveal; roster sorted by rating (Leo: "sorts new picks of clubs by rating again"). Next: friend matches watched together, Manager mode (docs/DRAFT_MANAGER_PLAN.md).
