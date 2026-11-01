---
id: RUL-ENG-008
type: ruling
client: eng
tags: [ui, rule, engine]
status: live
date: 2026-11-01
source: "tests/star/testPagesMatchGame.mts:1-12"
summary: Every gameplay change must reach every test page, training and the trial the same day; only a marked, named difficulty may differ (trial/training free-kick keeper).
---
Leo, 1 Nov 2026: "make sure everything is always up to date with the real game, that includes training and trials … I dont wanna be starting a new career … and seeing old gameplay that doesnt look like the real game."

How: a kind rule's easier version applies only to a picture explicitly marked (markDrillFreeKick, from lib/star/kindRules) — never "anything the match didn't set up". Test careers carry every stat the match reads (buildTestCareer). Test weather and build-ups use the career's own functions (matchConditions with Leo's weather update; careerBuildUp when Full highlights rebuild is off). A test page that serves its own chance uses makeChance where it can (sim90).

Leo's 1 Nov choice: the trial's and training's free kicks keep their easier keeper (FREE_KICK_DRILL), marked. tests/star/testPagesMatchGame.mts pins all of this; add a line there for any new split. (RUL-ENG-008)
