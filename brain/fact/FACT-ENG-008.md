---
id: FACT-ENG-008
type: fact
client: eng
tags: [team, engine]
status: superseded
superseded_by: FACT-ENG-009
date: 2026-10-30
source: "lib/star/liveChance.ts:1-30"
summary: Live chances (Leo, 30 Oct 2026): own switch kib-live-chances, off by default; the last pass keeps coming and letting go of the drag is the swing.
---
Settings → Updates (admins) → "Live chances", its own switch, OFF by default (localStorage `kib-live-chances`). Off = the old path untouched.

On: for open-play ground chances (never penalties, free kicks, corners, headers, volleys) the build-up hands over before its last pass arrives (`planFromLead`; no build-up = a made-up pass, `planMadeUp`). CanvasMatch steps it (`stepLive`), draws the ball from `liveBallAt`, and a release reads the swing (`readSwing`): clean within 0.35 m, early = top of the ball and weaker, late = under it and weaker, out of reach or never swung = chance gone. The strike goes through the normal `handleContact` → `launch`. In 3D the frame's `grabAt` lets a press at the spot grab the aim (engineView onDown).

Test page `/star-live-chances-dev` (its switch and dials are in memory, never the game's). Tests: `tests/star/liveChance.mts`. Drivers: `scripts/film/live/` (livecheck.mjs test page, livecareer.mjs a career match).
