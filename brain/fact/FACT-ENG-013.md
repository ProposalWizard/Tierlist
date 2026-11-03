---
id: FACT-ENG-013
type: fact
client: eng
tags: [engine]
status: live
date: 2026-11-01
source: "lib/star/kindRules/freeKick.ts:78-98"
summary: Match free kicks: a ball into the very top corner beats the keeper about 4 in 5 (FREE_KICK.corner, cornerness); was 11% against a 92 keeper.
---
Leo, 1 Nov 2026: "full power perfect top corner … 100% the keeper saves it." Cause: at 17–19 m/s a top keeper (react 0.08 s) got across and his 2.7 m reach covered the corner; the top-corner reach cut was off for match free kicks.

Fix: `cornerness(ball)` (0..1, from where it will cross: full within cornerEdge[0] of a post and above cornerZ[0], none past cornerEdge[1] / below cornerZ[1]). The keeper aims cornerShortM × cornerness short of it and his reach is cut by cornerCut × cornerness. Drill free kicks unchanged (FREE_KICK_DRILL corner off).

Measured (scripts/fk/cornerFk.mts, 99/99 taker, every aim/power/curl/lift, real engine + match setup): very top corner 11% → 79% vs 80/92/95 keepers; realism test ordinary 10% → 16% (bound raised to 18%), specialist 25%. A general slow-down or a worse start position made ordinary kicks up to 36% without helping the corner; not used.
