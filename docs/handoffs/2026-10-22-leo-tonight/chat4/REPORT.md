# Chat 4 — Weather and pitch (Leo, 22 Oct 2026)

Branch `leo-weather`. Decided (4a): **test page first**. The career match is unchanged; everything new is switched on only from **/star-weather-dev**. Round 2 (hub's ask, same evening): played the page at phone size and fixed what read badly, made one picture per condition, a feel check on "stops dead", and the written plan for switching it on (below, NOT applied).

## What was built

1. **Wind with a direction and a speed.** The ball feels the air moving past it, so a side wind pushes it sideways relative to its flight, a head wind cuts its carry and a tail wind adds to it. The wind is weaker near the grass (20% at 10 cm, 60% at 1 m, 100% at 10 m), so a ball bends more the higher and longer it flies. A ball skimming the grass (under 25 cm) is held in line by it; the wind takes hold fully from 1 m (round 2: without this the Old ball's long run of low skips drifted 18 m sideways in a 10 m/s wind). A wind arrow shows on the test page, in the lab pictures and above the match.
2. **Rain skid.** A wet surface lets the ball keep 30% of the pace a bounce would take off, on top of the lower rolling friction rain already had. It skids on and rolls further. Heavy rain is the old heavy pitch, a bit stronger (friction 1.75 → 1.9, bounce 0.6 → 0.55).
3. **Each club's pitch quality** (`lib/star/pitchQuality.ts`), from division, ground size, training-facility rating and a small fixed per-club wobble. Premier League always perfect. In a **dry spell** a bad pitch is baked: less bounce, it grips the ball at each bounce, and below a speed (up to 1.7 m/s on the worst pitch) the turf grabs it and it stops dead. Dry spells only at the ends of the season (August-September, April-May, about 1 week in 3). Pre-match label "Pitch: poor, dry" (a perfect pitch never says "dry": it is watered).
4. **"A bad pitch is: Tame (recommended) | Harsh (first build)"** on the page (round 2, from the feel check below). Tame is the default.
5. **Test page /star-weather-dev** (Match group, test pages, page guide eye, DevGate, Broadcast frame): weather, wind (tap a dot + speed slider), a club's home pitch or a quality slider, Normal / Dry spell, Tame / Harsh, the pre-match line; a **shot and pass lab** (Ground pass, Driven shot, Lofted pass, Long ball): the path from above on a clear day and in these conditions side by side at one shared scale, the side picture, the numbers, "Measure 200 of each", Ball Old/New; **▶ Play it** plays the real match (EnginePlay) in those conditions.

## Proof the real game is unchanged

- **Ball fingerprint** (`tests/star/weatherFingerprint.mts`): 240 chances × 6 weathers the game can roll today (none, clear, wind, rain, heavy, CanvasMatch's fallback) × both balls, every ball position hashed every 6 steps, plus the landing marker. Taken **before** any change; **12 of 12 identical after**, re-checked after every change in round 2.
- **Match tests**: `finishing keeper aiming outcomes conditions ballPhysics` pass on `origin/Leo` and on this branch; the printed results of finishing, outcomes, aiming, ballPhysics (68 lines of numbers), conditions and keeperDive are **byte-identical** before and after.
- Why: the new fields (`windV`, `skid`, `deadBelow`) are optional; `conditionsFor` never sets them, and every hook is skipped when its field is absent.
- `tests/star/weatherPitch.mts`: 32 checks on both balls (wind sides, head/tail, rain, heavy, dry pitch, stops dead, the feel-check bar, club pitches). Pass.
- One-engine guard pass. `npx tsc --noEmit` clean. `npm run build` pass (admin-look guard 48 of 48 on the frame).

**Match engine warning (said plainly):** `lib/star/canvasEngine.ts` was changed (7 guarded lines: the Old ball's air, bounce and roll, the landing marker, the after-whistle roll) and `lib/star/ballPhysics.ts` (the New ball, 3 guarded lines). With the new fields absent they do nothing, and the measurements above show nothing moved. `components/star/EnginePlay.tsx` got one optional input (`conditions`); without it every test screen gets exactly what it got before (same width, props and weather).

## Feel check: is "stops dead" frustrating? (round 2)

A "normal pass": a ground pass 8-30 m to a team-mate, struck so it would reach him at 4 m/s on a clear, perfect pitch, with ±15% error like a real player. "Dies short" = stops 1.5 m or more before him. 1,000 passes each (`npx tsx scripts/weather/feelCheck.mts old|new`).

**Yes, the first build was frustrating:** on the worst dry pitch **87 in 100** normal passes died short (Old ball, the game's default), against 6 on a clear day. Even a "poor" dry pitch killed 62.

**Tame worst case (now the default):** friction only a little higher (×1.10 on the worst dry pitch, was ×2.3), the baked turf grips the ball at each bounce (it takes 30% more pace off a bounce on the worst pitch), and the grab only works on a ball already at a crawl. **14 in 100** die short on the worst dry pitch (+8 on a clear day, about 1 in 12), 7 on a poor dry pitch. The lofted pass still sits down (bounce 2.4 → 0.9 m) and stops dead at the end, so it still reads as a bad pitch.

Old ball:
```
pitch                    dies short  limps in  mean short by
Clear, perfect                 5.7%     10.6%         2.5 m
Fair (0.6), normal             7.1%     12.3%         2.7 m
Poor (0.45), dry               6.9%     11.5%         2.6 m
Very poor (0.35), dry          9.8%     15.1%         2.9 m
Worst (0.25), dry             14.0%     16.5%         3.1 m
Worst, dry, HARSH (first build)      86.7%     10.8%         6.0 m
Poor (0.45), dry, HARSH       61.5%     21.4%         5.0 m
Rain                           0.0%      0.0%             -
Heavy rain                    56.4%     21.6%         4.8 m
```

New ball:
```
pitch                    dies short  limps in  mean short by
Clear, perfect                 0.0%      2.2%             -
Fair (0.6), normal             0.0%      3.7%             -
Poor (0.45), dry               0.1%      6.2%         1.8 m
Very poor (0.35), dry          0.2%      6.2%         1.8 m
Worst (0.25), dry              1.4%      6.2%         1.8 m
Worst, dry, HARSH (first build)      56.7%     23.9%         4.4 m
Poor (0.45), dry, HARSH       33.1%     23.0%         3.7 m
Rain                           0.0%      0.0%             -
Heavy rain                    45.1%     30.4%         4.2 m
```

Note: the game's own **heavy pitch (live today)** already kills 56 in 100 normal passes on the Old ball. Worth a look whatever is decided here.

## Measurements (200 strikes of each kind, speed ±12%, angle ±20%, aim ±6°)

Carry = to the first bounce. Drift = sideways at the first bounce. Bounce = highest after landing. Roll = distance after the first bounce. Change against clear in brackets. Final code, tame pitch. Script: `npx tsx scripts/weather/measure.mts old|new --md`.

### The Old ball (the game's default)
**Ground pass** (14 m/s, 1.5°)

| Condition | Carry m | Drift m | Bounce m | Roll m | Total m |
|---|---|---|---|---|---|
| Clear, perfect pitch | 2.7 | +0.0 | 0.1 | 25.6 | 28.3 |
| Wind 10 m/s, left to right | 2.7 (+0.0) | +0.0 | 0.1 | 25.6 | 28.3 |
| Wind 10 m/s, in your face | 2.7 (+0.0) | +0.0 | 0.1 | 25.6 | 28.3 |
| Wind 10 m/s, behind you | 2.7 (+0.0) | +0.0 | 0.1 | 25.6 | 28.3 |
| Gale 17 m/s, left to right | 2.7 (+0.0) | +0.0 | 0.1 | 25.6 | 28.3 |
| Rain | 2.7 (+0.0) | +0.0 | 0.0 | 49.3 | 52.0 |
| Heavy rain | 2.7 (-0.0) | -0.0 | 0.0 | 17.5 | 20.1 |
| Fair pitch (0.6), normal | 2.7 (-0.0) | -0.0 | 0.0 | 25.2 | 27.9 |
| Poor pitch (0.45), dry | 2.7 (-0.0) | -0.0 | 0.0 | 25.6 | 28.3 |
| Worst pitch (0.25), dry | 2.7 (-0.0) | -0.0 | 0.0 | 23.9 | 26.5 |

**Driven shot** (27 m/s, 8°)

| Condition | Carry m | Drift m | Bounce m | Roll m | Total m |
|---|---|---|---|---|---|
| Clear, perfect pitch | 20.5 | +0.0 | 0.4 | 50.9 | 71.4 |
| Wind 10 m/s, left to right | 20.5 (+0.0) | +0.3 | 0.4 | 51.0 | 71.4 |
| Wind 10 m/s, in your face | 20.2 (-0.3) | +0.0 | 0.4 | 48.8 | 69.0 |
| Wind 10 m/s, behind you | 20.7 (+0.2) | +0.0 | 0.4 | 52.6 | 73.3 |
| Gale 17 m/s, left to right | 20.5 (+0.0) | +0.4 | 0.4 | 51.0 | 71.5 |
| Rain | 20.5 (+0.0) | +0.0 | 0.3 | 105.8 | 126.3 |
| Heavy rain | 20.2 (-0.2) | -0.0 | 0.1 | 46.6 | 66.8 |
| Fair pitch (0.6), normal | 20.5 (-0.0) | -0.0 | 0.4 | 54.2 | 74.7 |
| Poor pitch (0.45), dry | 20.5 (-0.0) | -0.0 | 0.2 | 58.5 | 79.0 |
| Worst pitch (0.25), dry | 20.5 (-0.0) | -0.0 | 0.2 | 56.0 | 76.5 |

**Lofted pass** (17 m/s, 35°)

| Condition | Carry m | Drift m | Bounce m | Roll m | Total m |
|---|---|---|---|---|---|
| Clear, perfect pitch | 24.8 | +0.0 | 2.4 | 28.5 | 53.3 |
| Wind 10 m/s, left to right | 24.8 (+0.0) | +2.7 | 2.4 | 31.3 | 55.7 |
| Wind 10 m/s, in your face | 21.6 (-3.2) | -0.0 | 2.4 | 15.2 | 36.8 |
| Wind 10 m/s, behind you | 27.1 (+2.3) | +0.0 | 2.4 | 38.6 | 65.8 |
| Gale 17 m/s, left to right | 24.8 (+0.0) | +4.9 | 2.4 | 36.6 | 60.4 |
| Rain | 24.8 (+0.0) | +0.0 | 2.0 | 31.7 | 56.5 |
| Heavy rain | 24.1 (-0.7) | -0.0 | 0.7 | 14.0 | 38.1 |
| Fair pitch (0.6), normal | 24.8 (-0.0) | -0.0 | 2.2 | 26.1 | 50.9 |
| Poor pitch (0.45), dry | 24.8 (-0.0) | -0.0 | 1.3 | 18.3 | 43.1 |
| Worst pitch (0.25), dry | 24.8 (-0.0) | -0.0 | 0.9 | 16.1 | 41.0 |

**Long ball** (25 m/s, 30°)

| Condition | Carry m | Drift m | Bounce m | Roll m | Total m |
|---|---|---|---|---|---|
| Clear, perfect pitch | 47.9 | +0.0 | 4.0 | 49.8 | 97.8 |
| Wind 10 m/s, left to right | 47.9 (+0.0) | +6.1 | 4.0 | 56.2 | 103.1 |
| Wind 10 m/s, in your face | 40.3 (-7.6) | -0.0 | 4.0 | 22.3 | 62.7 |
| Wind 10 m/s, behind you | 52.8 (+5.0) | +0.0 | 4.0 | 73.9 | 126.8 |
| Gale 17 m/s, left to right | 47.9 (+0.0) | +11.3 | 4.0 | 68.0 | 113.9 |
| Rain | 47.9 (+0.0) | +0.0 | 3.2 | 55.1 | 103.0 |
| Heavy rain | 46.1 (-1.7) | -0.0 | 1.2 | 24.8 | 71.0 |
| Fair pitch (0.6), normal | 47.9 (-0.0) | -0.0 | 3.5 | 45.8 | 93.8 |
| Poor pitch (0.45), dry | 47.9 (-0.0) | -0.0 | 2.1 | 33.0 | 80.9 |
| Worst pitch (0.25), dry | 47.9 (-0.0) | -0.0 | 1.5 | 30.4 | 78.3 |

### The New ball (Settings → Ball physics: New)
**Ground pass** (14 m/s, 1.5°)

| Condition | Carry m | Drift m | Bounce m | Roll m | Total m |
|---|---|---|---|---|---|
| Clear, perfect pitch | 2.7 | +0.0 | 0.0 | 36.0 | 38.7 |
| Wind 10 m/s, left to right | 2.7 (+0.0) | +0.0 | 0.0 | 36.0 | 38.7 |
| Wind 10 m/s, in your face | 2.7 (+0.0) | +0.0 | 0.0 | 36.0 | 38.7 |
| Wind 10 m/s, behind you | 2.7 (+0.0) | +0.0 | 0.0 | 36.0 | 38.7 |
| Gale 17 m/s, left to right | 2.7 (+0.0) | +0.0 | 0.0 | 36.0 | 38.7 |
| Rain | 2.7 (+0.0) | +0.0 | 0.0 | 42.6 | 45.2 |
| Heavy rain | 2.6 (-0.0) | -0.0 | 0.0 | 24.1 | 26.7 |
| Fair pitch (0.6), normal | 2.7 (-0.0) | -0.0 | 0.0 | 35.5 | 38.1 |
| Poor pitch (0.45), dry | 2.7 (-0.0) | -0.0 | 0.0 | 34.3 | 36.9 |
| Worst pitch (0.25), dry | 2.7 (-0.0) | -0.0 | 0.0 | 33.3 | 36.0 |

**Driven shot** (27 m/s, 8°)

| Condition | Carry m | Drift m | Bounce m | Roll m | Total m |
|---|---|---|---|---|---|
| Clear, perfect pitch | 18.7 | +0.0 | 0.3 | 55.4 | 74.1 |
| Wind 10 m/s, left to right | 18.7 (-0.0) | +0.2 | 0.3 | 55.3 | 74.0 |
| Wind 10 m/s, in your face | 18.3 (-0.4) | +0.0 | 0.3 | 52.6 | 70.9 |
| Wind 10 m/s, behind you | 19.0 (+0.4) | -0.0 | 0.3 | 57.8 | 76.9 |
| Gale 17 m/s, left to right | 18.6 (-0.0) | +0.3 | 0.3 | 55.2 | 73.9 |
| Rain | 18.7 (+0.0) | +0.0 | 0.2 | 67.7 | 86.4 |
| Heavy rain | 18.1 (-0.6) | -0.0 | 0.1 | 39.7 | 57.8 |
| Fair pitch (0.6), normal | 18.7 (-0.0) | -0.0 | 0.2 | 55.8 | 74.5 |
| Poor pitch (0.45), dry | 18.7 (-0.0) | -0.0 | 0.1 | 53.3 | 72.0 |
| Worst pitch (0.25), dry | 18.7 (-0.0) | -0.0 | 0.1 | 52.0 | 70.7 |

**Lofted pass** (17 m/s, 35°)

| Condition | Carry m | Drift m | Bounce m | Roll m | Total m |
|---|---|---|---|---|---|
| Clear, perfect pitch | 22.2 | +0.0 | 1.3 | 17.9 | 40.1 |
| Wind 10 m/s, left to right | 22.2 (+0.0) | +2.2 | 1.3 | 18.9 | 41.0 |
| Wind 10 m/s, in your face | 18.9 (-3.3) | -0.0 | 1.3 | 9.1 | 28.1 |
| Wind 10 m/s, behind you | 24.6 (+2.4) | -0.0 | 1.3 | 25.4 | 50.1 |
| Gale 17 m/s, left to right | 21.8 (-0.4) | +4.0 | 1.3 | 21.0 | 42.4 |
| Rain | 22.2 (+0.0) | +0.0 | 1.1 | 24.5 | 46.8 |
| Heavy rain | 21.1 (-1.1) | -0.0 | 0.4 | 9.7 | 30.8 |
| Fair pitch (0.6), normal | 22.2 (-0.0) | -0.0 | 1.2 | 17.1 | 39.4 |
| Poor pitch (0.45), dry | 22.2 (-0.0) | -0.0 | 0.7 | 12.1 | 34.3 |
| Worst pitch (0.25), dry | 22.2 (-0.0) | -0.0 | 0.5 | 10.0 | 32.2 |

**Long ball** (25 m/s, 30°)

| Condition | Carry m | Drift m | Bounce m | Roll m | Total m |
|---|---|---|---|---|---|
| Clear, perfect pitch | 39.6 | +0.0 | 1.9 | 26.2 | 65.9 |
| Wind 10 m/s, left to right | 39.1 (-0.6) | +4.3 | 1.9 | 27.6 | 66.4 |
| Wind 10 m/s, in your face | 31.8 (-7.9) | -0.0 | 1.8 | 11.4 | 43.3 |
| Wind 10 m/s, behind you | 45.1 (+5.5) | +0.0 | 2.0 | 38.4 | 83.6 |
| Gale 17 m/s, left to right | 38.1 (-1.6) | +7.7 | 1.9 | 30.9 | 68.3 |
| Rain | 39.6 (+0.0) | -0.0 | 1.6 | 34.9 | 74.6 |
| Heavy rain | 37.1 (-2.5) | -0.0 | 0.6 | 14.9 | 52.1 |
| Fair pitch (0.6), normal | 39.6 (-0.0) | +0.0 | 1.7 | 25.4 | 65.1 |
| Poor pitch (0.45), dry | 39.6 (-0.0) | +0.0 | 1.0 | 18.7 | 58.4 |
| Worst pitch (0.25), dry | 39.6 (-0.0) | +0.0 | 0.8 | 15.9 | 55.7 |

### Each club's pitch (quality 0..1; perfect ≥0.95, good ≥0.8, fair ≥0.62, poor ≥0.45, very poor below)

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

## Pictures for the patch notes (round 2)

`pictures/` here, one per condition, made by `npx tsx scripts/weather/pictures.mts` + `PW_CHROME=/opt/pw-browsers/chromium node scripts/weather/shoot-pictures.mjs`. Each: the strike from above (this condition solid, a clear day dashed, white = in the air, dots = where it stops, the wind arrow), from the side, then carry / sideways at the bounce / bounce / roll after, averaged over 200 strikes against clear, Old ball.

`wind-across.jpg` (long ball 6.1 m right) · `wind-face.jpg` (7.6 m shorter, rolls 27 m less) · `wind-behind.jpg` (5.0 m longer) · `gale-lofted.jpg` (17 m/s, lofted pass 5.0 m left) · `rain.jpg` (driven shot runs on 55 m further) · `heavy.jpg` (lofted pass sits down: bounce 2.4 → 0.7 m) · `dry-poor.jpg` (long ball bounce 4.0 → 2.1 m, rolls 17 m less) · `dry-worst.jpg` (lofted pass bounce 2.4 → 0.9 m, stops 12 m sooner).

## The plan to switch it on in the real game (written, NOT applied — Leo and Harry decide)

### What each fixture would play in
`plannedDials(season, week, homeClub)` (`lib/star/weatherLab.ts`, already written and measured, not called by the career):
- **The weather roll stays exactly as today** (`conditionsFor`: clear 58%, windy 18%, rain 16%, heavy 8%), so the same fixtures stay windy or wet and old saves are unaffected (nothing is stored; it is all seeded from season, week and club).
- **Windy days get a speed and a direction:** speed from today's strength, 7.6-13 m/s (average 10.3); one fixed direction for the match (8 compass points, seeded). Other days are still.
- **The pitch is the HOME club's** (`clubPitch`), and **a dry spell** comes from `groundFor` (ends of the season, never when it rains). Tame worst case.

### How often (per division, 20 seasons, every club, `npx tsx scripts/weather/howOften.mts`)
| Division | Clear | Windy | Rain | Heavy rain | Dry spell (any) | Dry on a poor/very poor pitch | Ball grabs at a crawl | Average wind on windy days |
|---|---|---|---|---|---|---|---|---|
| Premier League | 58.4% | 17.5% | 16.0% | 8.1% | 14.9% | 0.0% | 0.0% | 10.3 m/s |
| Championship | 58.4% | 17.5% | 16.1% | 8.0% | 14.7% | 0.0% | 2.9% | 10.3 m/s |
| League One | 58.4% | 17.5% | 16.1% | 8.0% | 14.7% | 0.0% | 14.7% | 10.3 m/s |
| League Two | 58.4% | 17.5% | 16.1% | 8.0% | 14.7% | 0.6% | 14.7% | 10.3 m/s |
| National League | 58.4% | 17.5% | 16.1% | 8.0% | 14.7% | 14.7% | 14.7% | 10.3 m/s |
| National League North | 58.4% | 17.5% | 16.1% | 8.0% | 14.7% | 14.7% | 14.7% | 10.3 m/s |
| National League South | 58.4% | 17.5% | 16.1% | 8.0% | 14.7% | 14.7% | 14.7% | 10.3 m/s |
| Step 3 | 58.7% | 16.6% | 16.3% | 8.3% | 15.0% | 15.0% | 15.0% | 10.4 m/s |

So: wind and rain are the same in every division (as today). The bad-pitch effects are a lower-league thing: none in the Premier League; in the National League and below, about **1 home match in 7** is on a baked bad pitch. (Away matches use the other club's ground.)

### Effect on goals a match (`npx tsx scripts/weather/goalsSim.mts 3000 old|new`)
3,000 whole matches per row, 75 v 75 at home: the game's own unseen match runs the ninety minutes and asks for your chances (about 6.3 a match); each chance is played through the real ball (keeper, defenders, team-mates) by a robot shooter that is the same in every row; its result goes back into the match. Same seeds in every row. Opponent goals come from the unseen match, so they do not move.

Old ball (the game's default):
| Condition | Your chances | Your goals | Your side's goals | Their goals |
|---|---|---|---|---|
| Off: today's game (its own weather roll) | 6.29 | 1.35 | 1.82 | 0.95 |
| Clear every match | 6.27 | 1.34 | 1.81 | 0.95 |
| On: Premier League home ground (Arsenal) | 6.28 | 1.36 | 1.83 | 0.95 |
| On: League Two home ground (Accrington Stanley) | 6.29 | 1.37 | 1.84 | 0.95 |
| On: worst NL North ground (Spalding United) | 6.29 | 1.37 | 1.84 | 0.95 |
| Every match: wind 10 m/s across | 6.28 | 1.36 | 1.83 | 0.95 |
| Every match: wind 10 m/s in your face | 6.31 | 1.33 | 1.79 | 0.95 |
| Every match: wind 10 m/s behind you | 6.30 | 1.39 | 1.85 | 0.95 |
| Every match: rain | 6.27 | 1.34 | 1.80 | 0.96 |
| Every match: heavy rain | 6.28 | 1.40 | 1.86 | 0.95 |
| Every match: worst pitch, dry (tame) | 6.28 | 1.39 | 1.86 | 0.95 |
| Every match: worst pitch, dry (harsh) | 6.28 | 1.39 | 1.85 | 0.95 |

New ball:
| Condition | Your chances | Your goals | Your side's goals | Their goals |
|---|---|---|---|---|
| Off: today's game (its own weather roll) | 6.27 | 1.49 | 1.95 | 0.94 |
| Clear every match | 6.27 | 1.50 | 1.96 | 0.94 |
| On: Premier League home ground (Arsenal) | 6.26 | 1.51 | 1.97 | 0.94 |
| On: League Two home ground (Accrington Stanley) | 6.27 | 1.52 | 1.98 | 0.94 |
| On: worst NL North ground (Spalding United) | 6.28 | 1.52 | 1.99 | 0.94 |
| Every match: wind 10 m/s across | 6.30 | 1.49 | 1.96 | 0.94 |
| Every match: wind 10 m/s in your face | 6.29 | 1.50 | 1.97 | 0.95 |
| Every match: wind 10 m/s behind you | 6.26 | 1.51 | 1.97 | 0.94 |
| Every match: rain | 6.27 | 1.48 | 1.94 | 0.94 |
| Every match: heavy rain | 6.29 | 1.56 | 2.03 | 0.94 |
| Every match: worst pitch, dry (tame) | 6.27 | 1.53 | 1.99 | 0.94 |
| Every match: worst pitch, dry (harsh) | 6.29 | 1.52 | 1.99 | 0.94 |

**Reading it:** switching it on moves your goals by **+0.01 to +0.02 a match** (Old ball 1.35 → 1.36-1.37; New 1.49 → 1.51-1.52), about 1 goal in 70, inside the noise of the robot shooter. Even every match in one fixed condition stays within about ±0.05. A goal is decided mostly in the first metres of a shot, before wind or the pitch matter much; where they bite is passes, crosses, long balls and rebounds. The robot does not adjust to the conditions (a player can: shoot low in a gale, hit passes harder on a bad pitch).

### The exact changes (when told to switch it on)
1. **Move** `plannedDials`, `buildConditions` and the tame numbers from `lib/star/weatherLab.ts` into `lib/star/weather.ts` (one home for the career's weather).
2. **The real match** (`app/star-dev/page.tsx` lines ~4045 and ~4346, the shared file: two small edits): `conditions={conditionsFor(career.season, nextFixture.week, career.homeCity)}` → `conditions={buildConditions(plannedDials(career.season, nextFixture.week, nextFixture.home, career.homeCity))}`.
3. **Test screens** (`lib/star/engineProfile.ts` `testConditions`): the same call, so the one-engine rule holds (every test screen plays the real game's weather).
4. **Pre-match screen** (`components/star/MatchdayScreen.tsx` `Conditions`, line ~821): show the wind arrow + "Windy, in your face" and the pitch line ("Pitch: poor, dry") from the same call.
5. **The arrow in the match** (`components/star/CanvasMatch.tsx`, the weather label near line 5731): a small wind arrow turned with the camera (`facingRef`: up / left / right), fixing the sideways-chance problem below.
6. **Old UI** (`components/star/legacy/`): frozen by rule. It shares the ball, so it would get the new physics through `conditions`; whether its pre-match line changes is Harry's call (it must not be restyled).
7. **Tests:** `weatherFingerprint.mts` is then MEANT to move: re-take it with `--write` in the same commit, saying so. `conditions.mts` keeps passing (the old fields are unchanged). Run the match tests and `goalsSim` again, and a playtest.
8. **Optional, later:** team-mates' and defenders' guesses of where a ball is going (`predictBall`, `runMeetPoint`) do not read the wind (they never read the old wind either); the landing marker does. The unseen ninety minutes (`hiddenMatch.ts`) ignore the weather.

### Decisions for Leo and Harry
- Switch on at all? Recommend yes: it is seen, measured, and does not move goals.
- Tame or Harsh bad pitch? Recommend **Tame** (14 vs 87 in 100 normal passes die short on the worst pitch).
- Wind on windy days only (as planned), or a light breeze most days?
- Look at the existing heavy pitch (56 in 100 normal passes die short today).

## Seen in a browser (390×844, dev server)

Round 1 stills `01`-`07` here; round 2 tour in `tour/` (every weather × strike, gale, every wind direction, Arsenal / Accrington / Spalding in a dry spell, Harsh, Measure 200, Play it). Fixed in round 2 after looking:
- in wind the long ball's path ran off the side of the lab picture → each picture now fits the whole path;
- the two lab pictures used different scales → one shared scale;
- the wind arrow covered the path where it bent → it sits on the side the ball is not blown to, and the metre labels move out of its way;
- "Pitch: perfect, dry" → a perfect pitch never says "dry";
- the cross-wind drift along the grass after landing (see 1. above).
No page errors. Harmless console lines: an outside font through the sandbox proxy, a 404, and 500s from the squad route (no real Supabase key in the sandbox; the match falls back to invented squads). The only thing past the right edge is the shared page-guide eye, which peeks in from the edge on every admin page by design.

## Not seen / not done

- **Not in the career** (plan above).
- Wind in a live match was seen running, but a lofted ball bending in the match itself was not filmed; the bending was measured and seen in the lab (the same ball step the match runs).
- **Sideways chances:** when a chance is turned (camera facing left or right), the arrow above the match (drawn for "attacking up") will not match the screen (fix: plan step 5).
- Bumpy bounces off a rough pitch were not built: everything here is fixed, no dice.
- Old ball in rain rolls a lot (a driven ball 51 → 106 m): most of that is the game's existing rain (friction 0.62); the skid adds about a quarter. The New ball is gentler (55 → 68 m).

## Files touched

New: `lib/star/pitchWeather.ts`, `lib/star/pitchQuality.ts`, `lib/star/weatherLab.ts`, `app/star-weather-dev/{layout,page}.tsx`, `tests/star/weatherFingerprint.mts` (+ `fixtures/weatherFingerprint.json`), `tests/star/weatherPitch.mts`, `scripts/weather/{measure,feelCheck,goalsSim,howOften,pictures}.mts` + `shoot-pictures.mjs`, this folder.
Changed (small, additive): `lib/star/canvasEngine.ts` (match engine), `lib/star/ballPhysics.ts`, `lib/star/weather.ts` (type only), `components/star/EnginePlay.tsx` (one optional input), shared `lib/adminRegistry.ts` (one page line + TEST_PAGES), shared `lib/adminGuides.ts` (one guide entry).
