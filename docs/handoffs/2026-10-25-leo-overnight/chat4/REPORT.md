# Chat 4 — weather in real matches (25 Oct 2026, hub job; branch leo-weather)

Behind Leo's update: a new part **"Weather and pitch"** (`lib/star/leoUpdate.ts`, id `weather`), on with the update like the others, with its own toggle in Settings → Updates. Nothing reaches the live game until Leo picks.

## What changed (plain English)
- **Each career match gets its weather** from its date and place (`lib/star/matchWeather.ts`): today's weather roll for that fixture (so the same days stay windy or wet, about 4 matches in 10), windy days get a speed (8-13 m/s) and one direction, the **home club's pitch** decides the surface (Premier League perfect … Step 3 very poor), and dry spells at the ends of the season. Internationals are on a perfect pitch.
- **Before kick-off:** the team sheet's date line adds the day, e.g. "Sat 15 Aug · Rain · poor, wet pitch" or "Sat 15 Aug · Windy 12 m/s · poor pitch" (seen).
- **In the match:** light rain streaks (heavier in heavy rain, slanted with the wind) and a small wind arrow with its speed in the top-right, turned with the camera on sideways chances (seen). Not drawn over the strike screen.
- **Fixed on the way:** every windy match was getting the same wind direction (a sign error in the direction roll). Now spread over all 8 directions (measured: 10-20 of 114 matches each).

## With the switch off: nothing changes
- The match hand-off reads `leoUpdateOn("weather")`; off, it passes `conditionsFor(...)` exactly as before. The team sheet line and the drawing need the switch too.
- Ball fingerprints (1,440 chances, every weather the game can roll today, both balls): **12 of 12 identical** (measured). Match tests `finishing keeper aiming outcomes conditions ballPhysics weatherPitch weatherFingerprint`: 13 passed (measured). One-engine guard and `npm run build` pass.

## Weather on vs off (1,500 whole matches per row, measured; `npx tsx scripts/weather/matchSim.mts 1500 old|new`)
The game's own unseen match runs 90 minutes and asks for your chances; each is played through the real ball by the same robot in every row (passes on passing chances, shots otherwise). OFF = today's game. ON = weather on, home grounds from the division named.

Old ball (the game's default):
| Row | Your chances | Your goals | Your side's goals | Their goals | Pass completion | Shots blocked | Shots blocked in rain |
|---|---|---|---|---|---|---|---|
| OFF: today's game | 6.38 | 1.750 | 2.249 | 0.935 | 88.0% (4035) | 10.9% | 9.9% (1368) |
| ON: Premier League grounds | 6.40 | 1.763 | 2.259 | 0.935 | 88.1% (4020) | 10.8% | 10.0% (1364) |
| ON: League Two grounds | 6.39 | 1.748 | 2.245 | 0.938 | 88.1% (4038) | 11.0% | 10.0% (1371) |
| ON: National League North grounds | 6.39 | 1.757 | 2.249 | 0.939 | 88.3% (4022) | 11.0% | 10.0% (1369) |
| ON: Step 3 grounds | 6.38 | 1.763 | 2.251 | 0.943 | 88.3% (4024) | 10.9% | 10.0% (1376) |

New ball:
| Row | Your chances | Your goals | Your side's goals | Their goals | Pass completion | Shots blocked | Shots blocked in rain |
|---|---|---|---|---|---|---|---|
| OFF: today's game | 6.35 | 1.901 | 2.368 | 0.931 | 90.5% (4020) | 11.4% | 11.0% (1413) |
| ON: Premier League grounds | 6.36 | 1.927 | 2.405 | 0.935 | 90.9% (4028) | 11.0% | 10.8% (1411) |
| ON: League Two grounds | 6.38 | 1.925 | 2.407 | 0.935 | 90.9% (4022) | 11.4% | 10.6% (1419) |
| ON: National League North grounds | 6.40 | 1.936 | 2.412 | 0.932 | 91.0% (4037) | 11.3% | 10.6% (1420) |
| ON: Step 3 grounds | 6.37 | 1.956 | 2.435 | 0.933 | 90.9% (4026) | 11.2% | 10.5% (1424) |

**Reading it:** your side's goals move **-0.2% to +0.5%** (Old ball) and **+1.6% to +2.8%** (New ball); pass completion +0.1 to +0.5 points; shots blocked -0.4 to +0.1 points, and in rain matches only +0.1 (Old) / -0.4 (New) points. All far under the 10% bar, so nothing was toned down. Opponent goals move by 0.01 at most (they come from the unseen match). The robot doesn't adapt to the weather; a player can.

## Clips (real play, the game's sound, production build, all watched)
`docs/handoffs/2026-10-25-leo-overnight/chat4/`:
- `rain-match.mp4` (18.3 s): the team sheet "Rain · poor, wet pitch", then the match with light rain (single slanted drops); a long-range strike saved, then a cross. Still: `rain-match.jpg`, `team-sheet-rain.jpg`. Before/after of the rain look (hub note: it read like a grid): `rain-before-after.jpg`.
- `wind-match.mp4` (15.3 s, 0.41 MB): the team sheet "Windy 12 m/s · poor pitch", then the match with the wind arrow; a lofted strike is saved, then a goal from range. Still: `wind-match.jpg`, `team-sheet-wind.jpg`.
How: a fresh career (Maidstone, first match v Dover), Leo's update on (celebrations and big moments off to keep it on the weather). The weather is the fixture's own: the only thing set is the career's home city name, whose length is part of the weather roll ("Leeds" gives rain, "Margate" wind). Every chance is a real drag and strike; nothing moves the ball (`scripts/film/scenes/weather-match.mjs`).

## For Harry (his area)
- `lib/star/canvasEngine.ts`, `lib/star/ballPhysics.ts`: **no change in this job.** (Earlier, 22 Oct: guarded wind/skid/grab hooks, inert unless `windV`/`skid`/`deadBelow` are passed; still inert with the switch off, fingerprints identical.)
- `components/star/CanvasMatch.tsx`: one import + one block mounting `WeatherLayer` when `conditions.drawn` (never set when the switch is off).
- `app/star-dev/page.tsx`: one line, the real match's `conditions` prop (switch on: `matchConditions`; off: `conditionsFor` as before). The farewell match is unchanged.

## Not done / unsure
- Rain look redone after the hub's note: single drops at random (fixed) spots, varied length and speed, slanted (6° in still air, more with the wind); not drawn over the strike screen or the commentary feed.
- The wind's bending is real but hard to see in a real chance at the match camera (it shows best on long, high balls); the earlier test-page clips show it clearer.
- Team-mates' and defenders' guesses of where the ball goes still ignore the wind (as before).
- The unseen ninety minutes (hiddenMatch) ignore the weather; only chances you play feel it.
