---
id: FACT-DAT-007
type: fact
client: dat
tags: [career, rule, data]
status: live
date: 2026-11-02
source: "data/competition-history/README.md:1-10"
summary: Every History tab shows your career's seasons, then the real history before them (data/competition-history, loaded only when the tab opens), each season with winner, runner-up, final score, top scorer, top assister and player of the season.
---
Career seasons: leagues and Europe take most goals + assists as player of the season (your own league uses the Season Awards' winners); cups take the best player in the final; tournaments keep their leaders at each rollover (`career.intlHistory`, lib/star/intl/editionLeaders.ts). Real rows from your first season's year on are dropped, so nothing overlaps. Copa América has no real file yet. Code: lib/star/world/realHistory.ts, history.ts, summary.ts; test tests/star/historyLeaders.mts.
