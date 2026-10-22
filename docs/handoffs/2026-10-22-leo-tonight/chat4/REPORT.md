# Chat 4 — Weather and pitch (Leo, 22 Oct 2026)

Branch `leo-weather`. Decided (4a): **test page first**. The career match is unchanged; everything new is switched on only from **/star-weather-dev**.

## What was built

1. **Wind with a direction and a speed.** The ball feels the air moving past it, so a side wind pushes it sideways relative to its flight, a head wind cuts its carry and a tail wind adds to it. The wind is weaker near the grass (as over any field: 20% at 10 cm, 60% at 1 m, 100% at 10 m), so a ball bends more the higher and longer it flies. A ball on the ground is not touched. A wind arrow shows on the test page, in the lab pictures and above the match.
2. **Rain skid.** A wet surface lets the ball keep 30% of the pace a bounce would take off, on top of the lower rolling friction rain already had. It skids on and rolls further. Heavy rain is the old heavy pitch, a bit stronger (friction 1.75 → 1.9, bounce 0.6 → 0.55).
3. **Each club's pitch quality** (`lib/star/pitchQuality.ts`), from division, ground size, training-facility rating and a small fixed per-club wobble. Premier League always perfect. A worn pitch is a bit slower and flatter. In a **dry spell** a bad pitch is baked: much less bounce, slows fast, and below a speed (up to 2.4 m/s on the worst pitch) the turf grabs the ball and it stops dead. Dry spells only come at the ends of the season (August-September, April-May, about 1 week in 3; built, not used by the career yet). Pre-match label built ("Pitch: poor, dry"), shown on the test page only.
4. **Test page /star-weather-dev** (Match group, test pages, page guide eye, DevGate, Broadcast frame): pickers for weather, wind (tap a dot on the circle + speed slider), a club's home pitch or a quality slider, Normal / Dry spell; the pre-match line; a **shot and pass lab** (Ground pass, Driven shot, Lofted pass, Long ball) showing the path from above on a clear day and in these conditions side by side, the side picture, the numbers, "Measure 200 of each" and a Ball Old/New switch; **▶ Play it** plays the real match (EnginePlay) in those conditions.

## Proof the real game is unchanged

- **Ball fingerprint** (`tests/star/weatherFingerprint.mts`): 240 chances × 6 weathers the game can roll today (none, clear, wind, rain, heavy, CanvasMatch's fallback) × both balls (Old, New), every ball position hashed every 6 steps, plus the landing marker. Taken **before** any change; **12 of 12 identical after**.
- **Match tests**: `finishing keeper aiming outcomes conditions ballPhysics` (11 suites) pass on `origin/Leo` and on this branch; the printed results of finishing, outcomes, aiming, ballPhysics (68 lines of numbers), conditions and keeperDive are **byte-identical** before and after.
- Why: the new fields (`windV`, `skid`, `deadBelow`) are optional; `conditionsFor` (the career's weather) never sets them, and every hook is skipped when its field is absent.
- New suite `tests/star/weatherPitch.mts`: 28 checks (wind sides, head/tail, rain, heavy, dry pitch, stops dead, club pitches) on both balls. Pass.
- One-engine guard: pass, no new copies. `npx tsc --noEmit`: clean. `npm run build`: pass (admin-look guard 48 of 48 on the frame; /star-weather-dev 8.6 kB).

**Match engine warning (said plainly):** `lib/star/canvasEngine.ts` was changed (7 guarded lines: the Old ball's air, bounce and roll, the landing marker, and the after-whistle roll), and `lib/star/ballPhysics.ts` (the New ball, 3 guarded lines). With the new fields absent they do nothing, and the measurements above show nothing moved. `components/star/EnginePlay.tsx` got one optional input (`conditions`); without it every test screen gets exactly what it got before (same width, same props, same weather), so no drift re-measure was needed beyond this.

## Measurements (200 strikes of each kind, speed ±12%, angle ±20%, aim ±6°)

Carry = to the first bounce. Drift = sideways at the first bounce. Bounce = highest after landing. Roll = distance after the first bounce. Change against clear in brackets. Script: `npx tsx scripts/weather/measure.mts old|new --md`.

### The Old ball (the game's default)
**Ground pass** (14 m/s, 1.5°)

| Condition | Carry m | Drift m | Bounce m | Roll m | Total m |
|---|---|---|---|---|---|
| Clear, perfect pitch | 2.7 | +0.0 | 0.1 | 25.6 | 28.3 |
| Wind 10 m/s, left to right | 2.7 (+0.0) | +0.0 | 0.1 | 25.6 | 28.3 |
| Wind 10 m/s, in your face | 2.7 (-0.0) | -0.0 | 0.1 | 25.0 | 27.7 |
| Wind 10 m/s, behind you | 2.7 (+0.0) | +0.0 | 0.1 | 26.2 | 28.9 |
| Gale 17 m/s, left to right | 2.7 (+0.0) | +0.0 | 0.1 | 25.6 | 28.3 |
| Rain | 2.7 (+0.0) | +0.0 | 0.0 | 49.3 | 52.0 |
| Heavy rain | 2.7 (-0.0) | -0.0 | 0.0 | 17.5 | 20.1 |
| Fair pitch (0.6), normal | 2.7 (-0.0) | -0.0 | 0.0 | 21.9 | 24.6 |
| Poor pitch (0.45), dry | 2.7 (-0.0) | -0.0 | 0.0 | 16.7 | 19.4 |
| Worst pitch (0.25), dry | 2.7 (-0.0) | -0.0 | 0.0 | 14.0 | 16.6 |

**Driven shot** (27 m/s, 8°)

| Condition | Carry m | Drift m | Bounce m | Roll m | Total m |
|---|---|---|---|---|---|
| Clear, perfect pitch | 20.5 | +0.0 | 0.4 | 50.9 | 71.4 |
| Wind 10 m/s, left to right | 20.5 (+0.0) | +0.5 | 0.4 | 51.2 | 71.7 |
| Wind 10 m/s, in your face | 19.9 (-0.5) | -0.0 | 0.4 | 44.4 | 64.4 |
| Wind 10 m/s, behind you | 20.8 (+0.4) | +0.0 | 0.4 | 56.3 | 77.1 |
| Gale 17 m/s, left to right | 20.5 (+0.0) | +0.8 | 0.4 | 51.7 | 72.1 |
| Rain | 20.5 (+0.0) | +0.0 | 0.3 | 105.8 | 126.3 |
| Heavy rain | 20.2 (-0.2) | -0.0 | 0.1 | 46.6 | 66.8 |
| Fair pitch (0.6), normal | 20.5 (-0.0) | -0.0 | 0.4 | 49.3 | 69.8 |
| Poor pitch (0.45), dry | 20.5 (-0.0) | -0.0 | 0.2 | 44.2 | 64.7 |
| Worst pitch (0.25), dry | 20.5 (-0.0) | -0.0 | 0.2 | 38.3 | 58.8 |

**Lofted pass** (17 m/s, 35°)

| Condition | Carry m | Drift m | Bounce m | Roll m | Total m |
|---|---|---|---|---|---|
| Clear, perfect pitch | 24.8 | +0.0 | 2.4 | 28.5 | 53.3 |
| Wind 10 m/s, left to right | 24.8 (+0.0) | +2.7 | 2.4 | 32.2 | 56.3 |
| Wind 10 m/s, in your face | 21.5 (-3.3) | -0.0 | 2.4 | 13.4 | 35.0 |
| Wind 10 m/s, behind you | 27.2 (+2.4) | +0.0 | 2.4 | 40.4 | 67.7 |
| Gale 17 m/s, left to right | 24.8 (+0.0) | +5.1 | 2.4 | 39.0 | 62.4 |
| Rain | 24.8 (+0.0) | +0.0 | 2.0 | 31.7 | 56.5 |
| Heavy rain | 24.1 (-0.7) | -0.0 | 0.7 | 14.0 | 38.1 |
| Fair pitch (0.6), normal | 24.8 (-0.0) | -0.0 | 2.2 | 25.7 | 50.6 |
| Poor pitch (0.45), dry | 24.8 (-0.0) | -0.0 | 1.3 | 17.8 | 42.6 |
| Worst pitch (0.25), dry | 24.8 (-0.0) | -0.0 | 0.9 | 15.0 | 39.9 |

**Long ball** (25 m/s, 30°)

| Condition | Carry m | Drift m | Bounce m | Roll m | Total m |
|---|---|---|---|---|---|
| Clear, perfect pitch | 47.9 | +0.0 | 4.0 | 49.8 | 97.8 |
| Wind 10 m/s, left to right | 47.9 (+0.0) | +6.2 | 4.0 | 57.4 | 104.0 |
| Wind 10 m/s, in your face | 40.2 (-7.7) | -0.0 | 4.0 | 20.4 | 60.6 |
| Wind 10 m/s, behind you | 52.9 (+5.0) | +0.0 | 4.0 | 76.8 | 129.8 |
| Gale 17 m/s, left to right | 47.9 (+0.0) | +11.5 | 4.0 | 71.3 | 116.7 |
| Rain | 47.9 (+0.0) | +0.0 | 3.2 | 55.1 | 103.0 |
| Heavy rain | 46.1 (-1.7) | -0.0 | 1.2 | 24.8 | 71.0 |
| Fair pitch (0.6), normal | 47.9 (-0.0) | -0.0 | 3.5 | 45.3 | 93.3 |
| Poor pitch (0.45), dry | 47.9 (-0.0) | -0.0 | 2.1 | 32.4 | 80.3 |
| Worst pitch (0.25), dry | 47.9 (-0.0) | -0.0 | 1.5 | 28.2 | 76.2 |

### The New ball (Settings → Ball physics: New)
**Ground pass** (14 m/s, 1.5°)

| Condition | Carry m | Drift m | Bounce m | Roll m | Total m |
|---|---|---|---|---|---|
| Clear, perfect pitch | 2.7 | +0.0 | 0.0 | 36.0 | 38.7 |
| Wind 10 m/s, left to right | 2.7 (+0.0) | +0.0 | 0.0 | 36.0 | 38.7 |
| Wind 10 m/s, in your face | 2.6 (-0.0) | -0.0 | 0.0 | 35.6 | 38.3 |
| Wind 10 m/s, behind you | 2.7 (+0.0) | -0.0 | 0.0 | 36.3 | 38.9 |
| Gale 17 m/s, left to right | 2.7 (+0.0) | +0.0 | 0.0 | 36.1 | 38.7 |
| Rain | 2.7 (+0.0) | +0.0 | 0.0 | 42.6 | 45.2 |
| Heavy rain | 2.6 (-0.0) | -0.0 | 0.0 | 24.1 | 26.7 |
| Fair pitch (0.6), normal | 2.7 (-0.0) | -0.0 | 0.0 | 33.2 | 35.9 |
| Poor pitch (0.45), dry | 2.7 (-0.0) | -0.0 | 0.0 | 26.6 | 29.3 |
| Worst pitch (0.25), dry | 2.7 (-0.0) | -0.0 | 0.0 | 23.8 | 26.4 |

**Driven shot** (27 m/s, 8°)

| Condition | Carry m | Drift m | Bounce m | Roll m | Total m |
|---|---|---|---|---|---|
| Clear, perfect pitch | 18.7 | +0.0 | 0.3 | 55.4 | 74.1 |
| Wind 10 m/s, left to right | 18.6 (-0.0) | +0.4 | 0.3 | 55.3 | 74.0 |
| Wind 10 m/s, in your face | 17.8 (-0.8) | -0.0 | 0.2 | 47.8 | 65.7 |
| Wind 10 m/s, behind you | 19.4 (+0.7) | +0.0 | 0.3 | 62.2 | 81.6 |
| Gale 17 m/s, left to right | 18.6 (-0.1) | +0.7 | 0.3 | 55.1 | 73.7 |
| Rain | 18.7 (+0.0) | +0.0 | 0.2 | 67.7 | 86.4 |
| Heavy rain | 18.1 (-0.6) | -0.0 | 0.1 | 39.7 | 57.8 |
| Fair pitch (0.6), normal | 18.7 (-0.0) | -0.0 | 0.2 | 53.1 | 71.8 |
| Poor pitch (0.45), dry | 18.7 (-0.0) | -0.0 | 0.1 | 45.7 | 64.4 |
| Worst pitch (0.25), dry | 18.7 (-0.0) | -0.0 | 0.1 | 42.1 | 60.8 |

**Lofted pass** (17 m/s, 35°)

| Condition | Carry m | Drift m | Bounce m | Roll m | Total m |
|---|---|---|---|---|---|
| Clear, perfect pitch | 22.2 | +0.0 | 1.3 | 17.9 | 40.1 |
| Wind 10 m/s, left to right | 22.2 (+0.0) | +2.3 | 1.3 | 19.5 | 41.5 |
| Wind 10 m/s, in your face | 18.8 (-3.4) | -0.0 | 1.3 | 7.3 | 26.2 |
| Wind 10 m/s, behind you | 24.7 (+2.5) | -0.0 | 1.4 | 28.0 | 52.7 |
| Gale 17 m/s, left to right | 21.8 (-0.4) | +4.1 | 1.3 | 22.7 | 43.7 |
| Rain | 22.2 (+0.0) | +0.0 | 1.1 | 24.5 | 46.8 |
| Heavy rain | 21.1 (-1.1) | -0.0 | 0.4 | 9.7 | 30.8 |
| Fair pitch (0.6), normal | 22.2 (-0.0) | -0.0 | 1.2 | 16.2 | 38.4 |
| Poor pitch (0.45), dry | 22.2 (-0.0) | -0.0 | 0.7 | 11.5 | 33.7 |
| Worst pitch (0.25), dry | 22.2 (-0.0) | -0.0 | 0.5 | 9.6 | 31.9 |

**Long ball** (25 m/s, 30°)

| Condition | Carry m | Drift m | Bounce m | Roll m | Total m |
|---|---|---|---|---|---|
| Clear, perfect pitch | 39.6 | +0.0 | 1.9 | 26.2 | 65.9 |
| Wind 10 m/s, left to right | 39.1 (-0.6) | +4.4 | 1.9 | 28.5 | 67.1 |
| Wind 10 m/s, in your face | 31.6 (-8.0) | -0.0 | 1.8 | 9.5 | 41.2 |
| Wind 10 m/s, behind you | 45.3 (+5.7) | +0.0 | 2.0 | 41.6 | 86.9 |
| Gale 17 m/s, left to right | 38.0 (-1.6) | +7.9 | 1.9 | 33.3 | 70.1 |
| Rain | 39.6 (+0.0) | -0.0 | 1.6 | 34.9 | 74.6 |
| Heavy rain | 37.1 (-2.5) | -0.0 | 0.6 | 14.9 | 52.1 |
| Fair pitch (0.6), normal | 39.6 (-0.0) | +0.0 | 1.7 | 24.1 | 63.8 |
| Poor pitch (0.45), dry | 39.6 (-0.0) | +0.0 | 1.0 | 18.0 | 57.7 |
| Worst pitch (0.25), dry | 39.6 (-0.0) | +0.0 | 0.8 | 15.6 | 55.3 |

### Each club's pitch (quality 0..1; words: perfect ≥0.95, good ≥0.8, fair ≥0.62, poor ≥0.45, very poor)

| League | Average | Words | Worst | Best |
|---|---|---|---|---|
| Premier League | 1.00 | 20 perfect | all perfect | |
| Championship | 0.97 | 22 perfect, 2 good | Wrexham 0.91 | Portsmouth 0.99 |
| League One | 0.82 | 17 good, 7 fair | Cambridge United 0.75 | Wigan Athletic 0.89 |
| League Two | 0.68 | 23 fair, 1 poor | Accrington Stanley 0.61 | Exeter City 0.74 |
| National League | 0.57 | 24 poor | Boston United 0.49 | Scunthorpe United 0.61 |
| National League North | 0.47 | 17 poor, 7 very poor | Spalding United 0.39 | Hednesford Town 0.53 |
| National League South | 0.46 | 12 poor, 12 very poor | Farnham Town 0.36 | Dover Athletic 0.54 |
| Step 3 | 0.31 | 8 very poor | Cleethorpes Town 0.26 | Uxbridge 0.38 |

## Seen in a browser (390×844, dev server, saved here)

- `01-wind-top.jpg` the page top: weather, wind circle, pitch, pre-match line. Page 1,900 px tall.
- `02-wind-lab.jpg` long ball in a 10 m/s wind left to right: bends right, lands 47.6 m out.
- `03-play-wind.jpg` ▶ Play it: the real match running in the wind, the arrow and "Windy · Pitch: perfect" above it.
- `04-dry-poor-prematch.jpg` / `05-dry-poor-groundpass.jpg` a very poor pitch in a dry spell: "Pitch: very poor, dry"; a ground pass runs 16.4 m after its first bounce instead of 25.2.
- `06-rain-driven.jpg` rain: a driven shot runs on 103 m instead of 50 (lab, Old ball, no defenders).
- `07-headwind-measured.jpg` head wind, long ball 7.4 m shorter; the 200-each table.
- Console: no page errors on a fresh load. Two harmless loading messages (an outside font through the sandbox proxy, a 404) and 500s from the squad data route because the sandbox has no real Supabase key (the match falls back to invented squads, as designed). One hydration warning was seen once, right after editing the page while it loaded; it did not come back on fresh loads.

## Not seen / not done

- **Not in the career.** The real match still uses `conditionsFor` (no wind direction, no skid, no club pitch, no dry spells). Moving it in is Leo + Harry's call after trying the page.
- Wind in a live match was seen running, but I did not film a lofted ball bending in the match itself; the bending was measured and seen in the lab (same ball step the match runs).
- **Sideways chances:** when a chance is turned (the camera faces left or right), the pitch is drawn rotated, so the arrow above the match (drawn for "attacking up") will not match the screen. Fine for most chances; worth fixing before this goes into the game.
- Players' guesses about where a ball is going (`predictBall`, `runMeetPoint`) do not read the wind, as they never read the old wind either; the landing marker does.
- Bumpy bounces (a random kick off a rough pitch) were not built: everything here is fixed, no dice.
- Old ball in rain rolls a lot (a driven ball 51 → 106 m): most of that is the game's existing rain (friction 0.62); the skid adds about a quarter of it. The New ball is gentler (55 → 68 m).

## Files touched

New: `lib/star/pitchWeather.ts`, `lib/star/pitchQuality.ts`, `lib/star/weatherLab.ts`, `app/star-weather-dev/{layout,page}.tsx`, `tests/star/weatherFingerprint.mts` (+ `fixtures/weatherFingerprint.json`), `tests/star/weatherPitch.mts`, `scripts/weather/measure.mts`, this folder.
Changed (small, additive): `lib/star/canvasEngine.ts` (match engine), `lib/star/ballPhysics.ts`, `lib/star/weather.ts` (type only), `components/star/EnginePlay.tsx` (one optional input), shared `lib/adminRegistry.ts` (one page line + TEST_PAGES), shared `lib/adminGuides.ts` (one guide entry).
