---
id: FACT-ENG-009
type: fact
client: eng
tags: [team, engine]
status: superseded
superseded_by: FACT-ENG-010
date: 2026-10-30
source: "lib/star/liveChance.ts:1-30"
summary: Live chances (Leo, 30 Oct 2026): own switch kib-live-chances, off by default; with the strike screen (on by default) letting go locks the aim and the tap on a small ball is the kick.
---
Switch, strike screen and the 7 sliders are saved per phone in localStorage `kib-live-chances` ({on, strike, dials}) and shown in Settings → Match (admins, `LiveChancesSettings`) and Settings → Updates (Leo's card). Off = the old path untouched.

On: open-play ground chances (never penalties, free kicks, corners, headers, volleys) hand over before the build-up's last pass arrives (`planFromLead`; no build-up = `planMadeUp`). CanvasMatch steps it (`stepLive`). Strike screen on: release locks the aim (`lv.armed`), `ContactBall compact` opens a still strip (top when the ring is low), and the tap goes straight to `liveTapStrike` → `readSwing(…, tap)`: the tap's cx/cy, moved by timing (early up the ball, late under it). Off: release reads the swing directly. Out of reach or never struck = chance gone. The strike goes through `handleContact` → `launch`. In 3D the frame's `grabAt` lets a press at the spot grab the aim, and a press on the spot is never a team-mate order (2D too).

Test page `/star-live-chances-dev` (its own switch, strike screen and dials, in memory; after a chance it starts a new one or replays it live, via the `kib-picture-opened` event). Tests: `tests/star/liveChance.mts`. Drivers: `scripts/film/live/`.
