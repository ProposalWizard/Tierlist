---
id: FACT-ENG-010
type: fact
client: eng
tags: [team, engine]
status: live
date: 2026-10-31
source: "lib/star/liveChance.ts:86-95"
summary: Live chances (Leo, 31 Oct 2026): own switch kib-live-chances, off by default; with the kick screen (on by default) letting go sets the timing, then the game's normal kick screen picks where on the ball.
---
Leo, 31 Oct 2026: "i meant normal kick screen, the second part of the aiming and kicking bit, not this new weird thing" (a small strip along the pitch was built first and removed).

Saved per phone in localStorage `kib-live-chances` ({on, strike, dials}); shown in Settings → Match (admins, `LiveChancesSettings`) and Settings → Updates. Off = the old path untouched.

On: open-play ground chances hand over before the build-up's last pass arrives (`planFromLead`; no build-up = `planMadeUp`); CanvasMatch steps it (`stepLive`). Kick screen on: the release is the moment you meet it; out of reach = fresh air at once; in reach, `lv.armed` keeps that ball and speed, the pass stops (`stepLive` returns while armed), the normal ContactBall opens, and its tap goes to `liveTapStrike` → `readSwing(…, tap)` (the tap's cx/cy moved by the timing). Off: the release reads the swing directly. The strike goes through `handleContact` → `launch`. 3D: the frame's `grabAt`; a press on the spot is never a team-mate order.

Test page `/star-live-chances-dev`; tests `tests/star/liveChance.mts`; drivers `scripts/film/live/`.
