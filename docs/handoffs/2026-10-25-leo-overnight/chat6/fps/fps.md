# Season Awards Night (3D): frame rate on a slow phone (25 Oct 2026)

Key point: on this machine's software graphics, the night runs at **3 to 6 fps on every tier**, before and after.
The lighter room cuts draws by about a third to a half and leaves the picture the same, pixel for pixel.
It did **not** bring the frame rate near 30 here. The cost here is the two skinned people and the pixel count, not the room.

## How it was measured (measured)

- Playwright Chromium, 390×844, deviceScaleFactor 3, an Android phone's user agent, software GL (`--use-gl=angle --use-angle=swiftshader`).
- CPU slowed 4× (CDP `Emulation.setCPUThrottlingRate` 4) for the slow phone, and 1× as the baseline.
- `/star-awards-night-dev` → "▶ Play the night", played in real time (no seek), the whole night (44 s, 5 awards).
- Tier set by Settings' stored value (`star-3d-quality` = low / medium / high), `?gov=0` so the governor holds the tier, `?fps=1` for the frame meter.
- fps from the frame meter's drawn frames (`window.__frame3dAll`), per section of the plan (`lib/star/awardsNight.ts`): room = intro, host = the call, nominees = nominees + envelope + reveal, walk = the walk up, lift = the trophy lift. Median fps and 5th-percentile fps (the 95th-percentile frame gap).
- Before and after are the same build: `?awardslite=0` builds the room as before (every saving off).
- A slow phone's tier: Auto gives an Android with ≤ 3 GB or ≤ 4 cores **Low**, a weak GPU name **Low**, every other phone **Medium** (`lib/star/three3d/quality.ts`). Low caps the night at 30 fps (`fpsCap`), pixel ratio 1.25, antialias on, no shadows.
- The machine was shared with other builders for most of the runs (load 5 to 9 on 4 cores). Runs of the same setting moved by up to ±30%. Two runs each (a · b) for low and medium at 4×.

## Before → after, real time (measured)

Each cell: median fps / 5th-percentile fps, run a · run b.

| Tier, CPU | Section | Before | After | Draws before → after | Triangles before → after |
|---|---|---|---|---|---|
| low, 4× | room | 2 / 2 · 1.8 / 1.8 | 1.7 / 1.7 · 2.2 / 2.2 | 56 → 27 | 35k → 38k |
| low, 4× | host | 4.3 / 1.7 · 5.4 / 3.2 | 2.4 / 0.9 · 4.1 / 2.4 | 38 (max 53) → 26 (max 27) | 47k → 38k |
| low, 4× | nominees | 4.8 / 1.9 · 6.9 / 3.1 | 5 / 1.1 · 6 / 2 | 39 (max 49) → 26 (max 27) | 32k → 24k |
| low, 4× | walk | 4.5 / 2.4 · 5.4 / 2.4 | 4.7 / 1.4 · 4.5 / 2.4 | 28 (max 52) → 26 (max 28) | 32k → 38k |
| low, 4× | lift | 4.8 / 2.4 · 5.8 / 3 | 2.8 / 1.2 · 4.1 / 2.2 | 40 (max 45) → 26 | 47k → 38k |
| **low, 4×** | **whole night** | **4.6 / 1.9 · 5.8 / 2.5** | **3.3 / 0.9 · 4.5 / 2** | | |
| low, 1× | whole night | 6.2 / 2.2 · 5 / 2 | 4.4 / 1.7 · 5.7 / 2.3 | 38–56 → 26–27 | |
| medium, 4× | whole night | 2.2 / 0.8 · 2.3 / 0.8 | 2.2 / 0.8 · 2.6 / 0.8 | 41–58 (max 68) → 29–30 (max 33) | 42–61k → 48–52k |
| medium, 1× | whole night | 2.8 / 1 | 3.1 / 1.1 | 41–58 → 29–30 | |
| high, 1× | whole night | 3.2 / 0.6 | 3.1 / 0.6 | 30–59 (max 69) → 29–31 (max 34) | 56–89k → 34–66k |

First "before" runs on the :3500 build (the branch as it was, no switch): low 4× 3.9 / 1.4, low 1× 6.3 / 2.6, medium 1× 2.2 / 0.7, high 1× 3.3 / 0.3 (measured).

Per tier (frame meter, measured): lights 4 on every tier (hemisphere + 3 directional, no point lights; bulbs and lamps are glowing shapes). Shadow map: Low none; Medium one 1024² map (2–4 shadow draws a frame); High one 2048² map (2–4). Skinned draws 1–2 (host, winner). Pixel ratio Low 1.25, Medium 1.5, High 2.

## Held frames (measured)

The same five moments held still (seek), 8 frames each with a GPU finish, Low, 1×, two rounds, median ms a frame:

| | room | host | nominees | walk | lift | sum |
|---|---|---|---|---|---|---|
| before | 279 | 199 | 177 | 286 | 320 | 1261 |
| after | 214 | 167 | 157 | 290 | 333 | 1161 |
| after, room not merged | 264 | 217 | 140 | 239 | 312 | 1172 |
| after, lamps not instanced | 199 | 159 | 133 | 250 | 368 | 1109 |
| after, people not culled | 213 | 175 | 164 | 313 | 333 | 1198 |

Held frames say about 8% cheaper; the real-time runs on Low say 10–25% slower in 3 of 4 pairs. Both are inside this machine's run-to-run spread. I can not say from here that the change made Low faster or slower in software GL. Hiding the two skinned people halved a held frame (about 50%, measured in an earlier probe); drawing at pixel ratio 0.25 (about 1/25 of the pixels) cut it by 60–75%. The room itself is a small part.

## What changed (lib/star/awardsNight3d.ts)

1. The still room is merged to one draw per material (`mergeStaticByMaterial`, three3d/perf.ts): curtains (8 → 1), slats (10 → 1, one shared material), table tops and cloths (14 → 2), steps (2 → 1).
2. The seven table lamps are three instanced sets (base, bulb, halo): 21 draws → 3. A lamp left out of a shot is scaled to nothing, as the guests are.
3. Off-screen people are not drawn: `cullSkinned` (three3d/cullPeople.ts) on the host and each winner, as in the match and the garden. The host is skipped while the camera is on the screen or the walk.
4. The governor's hush on each camera cut, so the first frame of a new shot is not judged slow.
5. `?awardslite=0` builds the room as before, for a before/after still.

Not changed: the people (shared people3d pipeline), the tier profiles (pixel ratio, antialias), lights, shadows, sizes (RUL-3D-006). Tried and dropped: plain (Lambert) materials on Low. No gain measured and it changed Low's look.

## How it looks (measured: pixel difference of the stills)

Stills here: `high-before-*.jpg`, `high-after-*.jpg`, `low-before-*.jpg`, `low-after-*.jpg` (room, walk, lift; 390×844).
The 3D picture is the same on High and Low: the lift stills differ by 0 on every pixel; the room and walk stills differ only in the HTML captions (a fade caught at a different moment) and a hair of the host's idle sway.
Low looks as it did: no shadows, no shine on the trophy (no environment map on Low, unchanged).

## What I am unsure of

- Software GL is not a phone. Its cost here is fill and skinning on the CPU; a phone's GPU does both in hardware. The handbook says read percentages, not milliseconds, here. Whether a real slow phone holds 30 fps on Low: not seen, no number.
- Reasoned: a slow phone's main thread does about 1/4 of this machine's work in the same time; the page's JS was 6–13 ms a frame at 4× (frame meter, measured), inside Low's 33 ms budget. Draw calls are a phone's CPU cost, so 38–56 → 26–27 should help there (reasoned, not measured).
- Recommend one look on a real cheap Android with `?fps=1` (the frame meter) at Low.
