---
id: FACT-ENG-011
type: fact
client: eng
tags: [team, engine]
status: live
date: 2026-11-01
source: "lib/star/liveChance.ts:1-30"
summary: Live chances first touch (Leo, 1 Nov 2026): a quick flick from the ring is ONE touch; the keeper rushes in one-on-ones and either smothers it or is beaten.
---
Leo's picks (31 Oct 2026): quick flick, keeper rushes, stays live, every live chance.

A release quicker than TOUCH.maxMs (240 ms) and longer than TOUCH.minSwipe (4.5% of the pitch's height) is a touch in the flick's direction (`isTouchFlick`, CanvasMatch onPointerUp → `liveTouch`); its length is the weight. It is timed like a strike (`readTouch`). The ball then rolls (`planAfterTouch`, plan.roll), you run onto it (`runnerAt`), the ring moves to where you catch it, then you carry it at your feet for up to TOUCH.holdS (2.5 s real) before CLOSED DOWN.

In one_on_one / through_ball the keeper rushes (`keeperRushes`, `rushTarget`, 4.4–6.0 m/s by rating) and, at the touch, `keeperVsTouch` decides: he reaches it before you (SAVED, outcome "caught") or he is beaten (low dive held TOUCH.downS, then back to his line). While he rushes or reacts, stepKeeper/brainAim are skipped for him (stepLiveMen moves him). Balance: scripts/film/live/touchbalance.mts. Browser driver: scripts/film/live/touchcheck.mjs.
