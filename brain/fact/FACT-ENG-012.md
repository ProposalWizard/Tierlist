---
id: FACT-ENG-012
type: fact
client: eng
tags: [team, engine]
status: live
date: 2026-11-01
source: "lib/star/liveChance.ts:124-149"
summary: Live chances: the player's stats set the skill (technique, pace, vision, power; liveDialsFor), and everyone moves (defenders close down/cover/chase the touch, team-mates carry on their runs).
---
Leo, 1 Nov 2026: "anything skill related should be related to levels … decided by the player's stats" and "add moving everything to live chances". His picks: defenders + team-mates; the stats plan as below; the sliders on the test page only.

Stats (40 floor, 95 top; tired legs count; `liveSkillsNow` in CanvasMatch): technique → clean zone 0.22–0.50 m, early reach 0.8–1.3 m, touch error ×1.35–×0.6 (`touchErrorScale`); pace → late reach 0.6–1.1 m and the run after a touch (`touchChaseSpeed`); vision → time for the pass 1.3–2.3 s and slow motion near you ×0.72–×0.40; power → the strike (launch). Game Settings keep only the two switches; the test page has stats sliders, presets and by-hand dials (`setLiveTest({stats, manual})`).

Movement (`stepLiveMen`, `DEF`): once the build-up has played out (or after your touch), defenders within 16 m move at 5.6 m/s × their speed: the nearest presses to 1.4 m short of the ball, the rest go goal-side (`defenderTarget`); after a touch the nearest two race for it (`keeperVsTouch` with DEF.reachM) and the first there before you wins it (TACKLED), and on the ball a defender within 0.85 m takes it. Team-mates carry on their build-up runs at 85%, easing off over 1.6 s.
