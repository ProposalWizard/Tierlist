---
id: FACT-ENG-007
type: fact
client: engine
tags: [career]
status: live
date: 2026-10-27
source: "lib/star/hiddenMatch.ts:1770-1781"
summary: One match for every tool: careerMatchSpec carries a new career's corner rule and moves, and hiddenMatch stepInvolved (a minute plus any owed chance) is the one step the real match, the radar and sim90 use.
---
Before 27 Oct 2026 the real match added the corner rule and the moves gate by hand, so "Sim this match" played without them, and the owed chances (one a half on Medium/High, game 4's header and volley, a late sub's) lived only in advanceUntilInvolved, so the radar and sim90 missed them. A new per-match rule goes in careerMatchSpec; a new owed chance goes in stepInvolved. Tests: oneFormula.mts, matchRadar.mts.
