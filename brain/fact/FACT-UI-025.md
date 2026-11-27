---
id: FACT-UI-025
type: fact
client: ui
tags: [ui, career]
status: live
date: 2026-11-27
source: "lib/draft/daily.ts:1-12"
summary: Behind the New look switch (usePreview): Daily Draft (same spins for all by UK date, first-season points ranked by /api/draft/daily via draft_runs.event_key "daily:<date>:", first per player), Draft spot ratings + best spot, Tic Tac Toe today-first + streak + Share, Ten-A-Ball topics + bests + Share; Rankings run past the pause for the tester (middleware.ts).
---
Leo, 27 Nov 2026: "carry on do em all". New features ride the same cookie as the look (lib/siteLook/usePreview.ts; server pages read cookies()) until Leo says go. Fixed for everyone: three wrong Draft seasons (app/api/draft/clubs NOT_IN_PL_THAT_SEASON) and Ten-A-Ball duplicate titles (oncePerTitle). Rankings stay paused for everyone (Mikey, 17 Nov). Open: chemistry (changes results, so Hall of Fame vs a separate board is Leo's call).
