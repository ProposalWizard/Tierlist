# Build-ups (Full highlights rebuild): measured, 21 Oct 2026

Measurement only. No game code changed, nothing committed. Branch Harry, main checkout read-only.
Tags: **[M]** measured, **[C]** read in the code, **[R]** reasoned (not measured).
Stills: `docs/research/2026-10-21-buildups/`.

## Plain-English summary

**Time**
- With the switch Off, no chance gets a build-up at all. 0 build-ups in 5 career matches (28 chances). [M]
- With the switch On, 92% of chances get one. About 5 per match. [M]
- A build-up is 6.4 s on average. Half are under 6.1 s, 9 in 10 are under 7.9 s, the longest seen was 8.3 s in the game and 10.9 s in the generator. [M]
- That is **33 s more per match**. Off was 111 s a match, On was 144 s (+30%). Same average of 5.6 chances in both groups. [M]
- My bot aims in 1.3 s. A real player aims slower, so the real extra share is lower, about +15 to 25%. [R]
- The chance itself takes the same time in both modes (6.5 s Off, 7.1 s On, from "chance appears" to "back to the feed"). So the whole extra is the build-up. [M]

**Why Off feels snappy (Harry's point)**
- Off goes straight from the feed to the chance. Nothing in between. [M]
- Both modes serve the same kind of picture: the gallery drawings. Off 1,220 of 1,341 chances are drawings (91%, the rest are through balls made by the builder or a plan). On 1,341 of 1,341 (100%). [M]
- On, the build-up ends **exactly** on that drawing. 0 of 582 build-ups differed by more than 5 cm. The men are still running about 1.1 m short for 0.9 s after the hand-over (by design). [M]
- But 43 of 582 (7%) build-ups end in a called offside and there is no chance at all. About 6.5 s with no pay-off. [M]
- On also changes which chances you get: long shots are 26% of chances On, 10% Off. [M]

**Camera**
- The ball stays in shot. It was off the glass in 1.1% of build-ups (worst 58 px). [M]
- The real problem is the framing. The camera is never allowed to be wider than the chance's own frame (smallest size seen = 1.00 of the chance). [M]
- 40% of build-ups have a pass longer than 0.9 of the frame. In 55% of build-ups the passer or the receiver is off screen for more than 0.3 s during a pass (10% of all build-up time). [M]
- The man who plays the ball is on screen when he plays it 99% of the time. The receiver is on screen when it reaches him 99% of the time. The gap is in the middle of long passes. [M]
- Sudden zooms (width changes more than 15% in half a second): 7.5% of build-ups. Fast pans (over 600 px/s): 0.8%. [M]
- Real game stills show men about 17 px tall and a lot of empty grass, often the whole bottom 40% of the screen. [seen in 3 of 4 real stills, not counted]

**3D**
- With Match view 3D On and the switch On, the build-up **plays in 3D**. The camera follows, the men and ball move, the hand-over to the chance works, no errors. I saw it once, 15 stills. [M, one run, headless software 3D]
- It does not break and does not fall back to 2D. [M, one run + C]
- The risk is time. The build-up clock cannot run faster than 20 frames a second. A phone below 20 fps plays the build-up in slow motion. On this machine's 3D (about 1 frame a second) a 5.8 s build-up took 88 s. A phone at 10 fps would take about 13 s for a 6.5 s build-up. [M for this machine, C + R for phones]

**Options in one line each** (details below)
- Shorter: play only the last 3 s of each build-up, same speed, same final frame, tap to skip (already there). Saves 18 s a match (54%). Small. No drift file.
- Camera: calmer camera, then better lead room. Small, then medium.
- 3D: keep build-ups in 3D but stop the clock stretching (small, touches CanvasMatch), or switch them off in 3D (small), or 2D build-up then cut to 3D (medium).

---

## 1. Time

### How it was measured
- **Browser [M]:** real `/star-dev` career match, signed out, phone size 390×844, headless Chromium (software drawing). A bot taps the chance 0.8 s after it appears, kicks 1.3 s after it appears, and clicks through. Driver and the `window.__starMatch` hook as in `scripts/star-sandbox`. 5 matches Off, 5 matches On (switch set by `star-fhr` in localStorage). Timestamps of every phase change and every build-up (the "Build-up · tap to skip" pill).
- **Generator sweep [M]:** the real chance maker and the real build-up generator over whole simulated matches (`servedChances`, 1,192 chances in 221 matches, then 1,100 in 197 matches). Same distribution as the browser.
- Not measured: a human's aim time; a real phone's frame rate.

### Off vs On, per match (browser)

| | Off | On |
|---|---|---|
| Matches | 5 | 5 |
| Chances a match | 5.6 (1 to 9) | 5.6 (1 to 10) |
| Build-ups a match | 0 | 5.2 |
| Build-up seconds a match | 0 | 33 |
| Match length (first screen to full time) | 111 s (49 to 153) | 144 s (54 to 227) |
| Seconds per chance, all in | 19.8 | 25.7 |
| Chance on screen to back in the feed | 6.5 s | 7.1 s |
| of which kick to feed (flight, result) | 4.4 s | 5.0 s |

Match length depends mostly on how many chances come (a match with 1 chance is about 50 s, with 10 about 220 s). The build-up share of a match: 33 of 144 s = 23%.

Build-up lengths, 26 build-ups in the browser: min 4.8, p50 6.1, p90 7.9, max 8.3, mean 6.4 s. They play at real time (played minus planned: -0.08 s on average).

### Build-up lengths (generator, 1,093 build-ups of 1,192 chances)
- Ordinary moment: min 3.2, p10 5.2, **p50 6.4, p90 7.9, max 10.0**, mean 6.5 s. [M]
- With the match's minute and a score (late and close): p50 6.55, p90 8.1, max 10.9. The code's longest at a level final, 90th minute is 11.5 s. [M, C]
- Share of chances that get one: **92%**. Only set pieces (corner always none; penalty and free kick only when a foul shows) and carry-ons are left out. [M, C]
- Per match: 4.9 build-ups, 32 s (p10 19 s, p90 47 s, max 75 s). [M]
- By kind (mean seconds): header 6.7, volley 6.8, cutback 6.6, long shot 6.4, tight angle 6.4, one-on-one 6.3, byline cross 6.2. All about the same. [M]

### Off (the snappy one), from the chance appearing to the kick
- There is nothing before the chance. "Appears" and "playable" are the same moment. Off path in code: `careerBuildUp` returns null when the switch is Off and Chances is Old (the default). [C]
- Seen: 28 chances, 0 build-up pills. [M]
- My bot's kick comes 1.3 s after the picture. A person adds their own aiming time on top (not measured).
- On path: build-up 6.4 s, then the same chance. First playable moment is 6.4 s later than Off. [M]

### Older generator, for comparison [M]
With Off + Chances: New (code still there, not reachable from Settings now) the old generator gave: 34% of chances, 2.5 s mean (p90 3.0, max 3.1), 1.8 a match, **4.7 s a match**. The rebuild is 92% of chances, 6.4 s, 33 s a match: about 7 times more. If the build-ups Harry remembers as snappy were these, that is the difference. [R for what Harry remembers]

---

## 2. Camera: bad cases

### How it was measured
- **Sweep [M]:** 652 build-ups (700 chances), the real generator, the real match camera for each chance (`matchStill`) and the real build-up camera (`leadInCamera`) sampled at 30 fps on a 366×744 canvas (phone). Counted per build-up. Also the 716 frames the browser driver read from the real match (25 build-ups).
- The match's own check `tests/star/fhrCameraHandover.mts` already pins the hand-over (last build-up frame = first chance frame). I re-measured it: 0.00 px for every build-up that has a chance. Not a bad case.

### Counts

| Case | How often (of build-ups) | Worst | Seen in |
|---|---|---|---|
| Ball outside the frame at some moment | 1.1% (7 of 652); all 7 for over 0.3 s | 58 px outside, a cutback and a tight angle | `cam-ballEdge-2.png` |
| Ball within 6% of the frame edge | 2.0% (over 1 s: 0.5%) | | |
| Passer or receiver off screen for over 0.3 s during a pass | **55%** (any moment: 71%) | 566 to 619 px outside | `cam-longpass-2.png` |
| A pass longer than 0.9 of the frame width | **40%** | | |
| Passer off screen at the kick / receiver off screen on arrival | 1% / 1% of 480 passes | | |
| Camera wider than the chance frame (zoomed out) | never (smallest size 1.00) | | |
| Sudden zoom in: width change over 15% in 0.5 s | **7.5%** (over 30%: 0.5%) | 1.33× in half a second | `cam-zoom-2.png` |
| Camera pan over 600 px/s | 0.8% | 698 px/s (p50 236, p90 371) | `cam-pan-2.png` |
| Camera moves in the last 1.5 s before the chance (the glide onto the chance frame) | median 154 px, p90 268 px; zooms over 15% in 8.8% | | |
| First frame starts far from the chance frame | median 258 px, p90 473 px | | |
| Pitch turned side-on for the whole build-up | 4.4% | | `cam-turned-2.png` |
| Called offside, no chance follows | 6% (7% in the second run) | | `cam-offside-2.png` |
| Facing flips during a build-up | none: the turn is fixed from the first frame [C] | | |
| Hand-over to the chance | 0.00 px off for every build-up that has a chance | | |
| Camera locked (not following) | 1% of build-up time | | |

Men's size: 16.7 to 25.5 px tall in the browser frames (a chance's own size is about 17.8 px at 24.7 m across; a byline cross is about 22 to 25 px). Within one build-up the size swings median 1.00×, once 1.20× (a cutback). [M]

Real game stills (phone, 390×844):
- `game-buildup-start-empty-bottom.jpg`, `game-buildup-late-action-top-half.jpg`: a cutback. The men are tiny and the bottom 40% of the screen is empty grass.
- `game-buildup-tight-angle.jpg`, `game-buildup-long-range.jpg`: fine, for comparison.
- The `cam-*.png` stills are **schematic redraws** of the camera frame (pitch lines, dots for the men, the chance's own frame dashed), not the game's own picture. They show the worst case found in each class.

### What the camera is, in the code [C]
- `lib/star/leadIn.ts` `leadInCamera`: a spring on the frame's middle and size. Build-ups never go wider than the chance's frame (`hi = cw`) and never narrower than `LEAD_FRAME_MIN_W` 28 m. The ball is kept 2.5 m (or 20%) inside by `keepBall`.
- The TV camera (can go 1.2× wider) is used only by the Real shots page, not the FHR build-ups.
- It glides onto the chance's frame over `LEAD_SETTLE_S` 1.5 s once the ball is in the lock box.

### Honest limit
The numbers say the ball and the hand-over are fine. What the numbers show as bad is: receiver off screen mid-pass (55%), sudden zoom-ins (7.5%), and small men with a lot of empty grass (seen, not counted). I could not find a larger bad class by sweep. Harry's "can be bad sometimes" may be the 4.4% sideways pitches and the 6% offsides with no chance, which count as "camera" in play. I did not see his device. [R]

---

## 3. 3D

### Code path [C]
- Settings → Look → "Match view 3D" is `lib/star/matchView3d.ts`. `Match3DLayer` wraps the career `CanvasMatch`. The 2D match keeps running underneath, invisible, and hands each frame to the 3D view (`EngineFrame`).
- The build-up is a replay inside the 2D match (`CanvasMatch` `leadIn`, `stepLeadIn`): it puts the men and ball on the generated paths and moves the 2D frame. The 3D view reads the same frame. The frame carries `leadIn: { lock, ball, keeper, at }` so the 3D view's own cameras (corner, cutback, tight angle) fix on the chance's camera as the lead-in locks. This code exists in `lib/star/style3d/engineView.ts` (the comment still says "test pages only", it is stale).
- The men the build-up adds (extra team-mates, the opponent who loses the ball, the covering defender) are put into the 2D scene, so they are drawn and sent to 3D.
- If the 3D picture is still loading, the build-up holds on its first frame (`frameObsRef.warming`).
- The lead-in clock: `dt = min(dt, 0.05)` in the main loop, then `stepLeadIn(dt)`. Under 20 fps the replay runs slower than real time.

### Run [M]
Headless Chromium, software 3D, Match view 3D On, switch On: the "Build-up · tap to skip" pill showed, the men and ball moved in 3D, the camera followed the move and settled on the chance, the aim screen appeared (stamina bar), I kicked, flight and full time came. 0 console errors, 0 page errors. 15 stills: `3d-buildup-contact-sheet-15-frames.jpg`, `3d-buildup-early.jpg`, `3d-buildup-late.jpg`.
- Wall time of the 5.8 s build-up: **88 s**. This machine has no graphics chip (about 1 frame a second in 3D, the project notes say 1 to 5 s a frame). So it is the clamp, not the 3D. [M]
- On a phone: at 30 fps no change. At 15 fps about 8.7 s for a 6.5 s build-up. At 10 fps about 13 s. [R, from the clamp]
- Not seen: a real phone, mocap poses in the build-up, how the 3D camera swings at the hand-over on a device.

---

## 4. Options

Sizes: small = under a day, one or two files; medium = a few days or new tests with eyes on; large = a project.
"Drift" = the files the repo's guard asks about (CanvasMatch, EnginePlay, ScenarioPlay, InfiniteMatch, hiddenMatch, engineProfile, playArea, scenePicture, matchView). "Engine" = `canvasEngine.ts`.
None of these touch `canvasEngine.ts`.

### A. Shorter

**A1. SNAPPY BUILD-UP (Harry's ask): play only the last 3 s, always end on the drawing, tap to skip.**
- What: the generated move is kept, but each build-up starts late so it is 3 s at the end (normal speed). The men's paths, the ball and the camera code are the same, so it still ends exactly on the gallery picture (that is already true: 0 of 582 differ). Done as a wrapper in `lib/star/fhr/builders.ts` that shifts time (`posAt`, `ballAt`, pass times, the offside whistle, the caption) and shortens `durS`. The camera then runs on the shorter lead without any change.
- Tap to skip is already built: every FHR build-up is `skippable`, the pill says "Build-up · tap to skip", a tap goes straight to the chance (`skipLeadIn`, then the chance's own frame). So "easier to get to the final frame" = shorter + the tap that exists. [C, pill seen in the stills]
- Saves, per match with the ruler's 5.1 build-ups: 33.4 s → **15.3 s, saves 18.1 s (54%)**. Cap 4 s instead: 20.4 s, saves 13.0 s. In the browser terms: On 144 s → about 126 s, Off is 111 s. [M for the sums, R for the browser figure]
- Cost: the first 3 to 4 s of the move is not shown (one or two touches instead of two to four). A move that ends in a called offside must keep the offside pass inside the 3 s. [R]
- Size: **small**. Drift: none. Engine: none. Tests: `tests/star/fhr.mts`, `fhrCameraHandover.mts` need a case.

**A2. Fewer chances get one.**
- What: only chances where a build-up explains the chance get one, as the old table did: one-on-one always, byline cross always, cutback always, long shot half (34% of chances).
- Saves 33.4 → 12.0 s a match, **21.4 s (64%)**. Together with A1: 33.4 → 5.6 s, saves **27.8 s (83%)**, about what the old 2.5 s generator cost (4.7 s). [M]
- Cost: 2 chances in 3 arrive cold, as Off does. Less "everything has a story".
- Size: **small**. Drift: none (`fhrWantsBuildUp` in `buildUp.ts`). Engine: none.

**A3. Play it at 2× speed.**
- What: the same move in half the time.
- Saves 33.4 → 16.7 s, **16.7 s (50%)**; "2× but never over 3 s": 14.8 s, saves 18.6 s. [M for the sums]
- Cost: the camera and the men move twice as fast. Pan speeds double: median 236 → about 470 px/s, p90 371 → about 740 px/s, so most build-ups would cross the 600 px/s mark that 0.8% cross today. [R, scaled from the measured]
- Making a **shorter move from scratch** does not work: I tried it. Scale 0.72: mean 5.1 s, 0.7% of build-ups fail the checks. Scale 0.5 (mean 3.5 s): **19.5% fail**. Scale 0.4 (mean 2.7 s): **44% fail** (men cannot reach their places in time). [M]
- Size: **small to medium** (a time scale in the replay clock in `CanvasMatch` = drift file, or in the wrapper). Engine: none.
- Not recommended over A1.

Smaller extras: drop the 7% offside build-ups with no chance (saves 2.2 s a match, [M]). But Harry asked for called offsides, so this is his call.

### B. Camera fixes (each says which bad case it fixes)

**B1. Calmer camera.** Slower size spring, a pan speed cap of about 450 px/s, and start the glide onto the chance frame earlier so it is not 154 px to 268 px in the last 1.5 s.
- Fixes: sudden zooms (7.5% of build-ups), fast pans (0.8%), the late glide (8.8% zoom in the last 1.5 s).
- Does not fix: receiver off screen, small men.
- Size: **small**: constants in `lib/star/leadIn.ts` (`LEAD_FOLLOW_OMEGA`, `LEAD_FOLLOW_TOP`, `LEAD_SETTLE_S`). Drift: none. Engine: none. Needs `fhrCameraHandover.mts` to stay at 0.00 px.

**B2. Frame the move, with lead room.** Keep the ball and the next receiver in the upper two-thirds with room ahead of the ball, and let the width go to about 1.25× the chance's only while a long pass is in flight.
- Fixes: receiver off screen in a long pass (55% of build-ups), the empty bottom of the screen (seen).
- I tried the widening alone: at 1.5× the number with a man off screen only fell 55% → 48% and zoom jerks went up (7.5% → 35% of build-ups over 15% in half a second). So the width must be paired with a slow zoom (B1), or it gets worse. [M]
- Size: **medium**. Drift: none (`leadIn.ts`). Engine: none.

**B3. Hold the chance's frame all the way (the Off look).** The build-up runs inside the chance's own fixed frame, the ball is just followed by a ring; men who are off screen come in from the edge.
- Fixes everything in the camera table at once (no zoom, no pan, no hand-over glide). The 4.4% sideways pitches stay the chance's own.
- Cost: long passes start and end off screen. Much of the move is not seen. [R]
- Size: **small** (lock time 0). Drift: none. Engine: none.

Cases not covered by any of these: the 6% offside build-ups and the 4.4% sideways pitches. For the sideways ones, turning the pitch only at the hand-over would need a decision from Harry. [R]

### C. 3D

**C1. Play build-ups in 3D, and stop the clock stretching.** Let the build-up clock use real time (up to about 0.25 s a frame) instead of the 0.05 s clamp, only for the replay.
- Fixes: the slow-motion build-up on a phone under 20 fps (13 s instead of 6.5 s at 10 fps). Everything else stays as measured: plays, follows, hands over.
- Size: **small** (one line in `stepLeadIn`'s caller). It is in **CanvasMatch.tsx, a drift file**: the guard will ask, and the match tests should be run. Engine: none.
- Risk: at 10 fps the men jump further each frame (same path, fewer frames). [R]

**C2. Switch build-ups off in 3D.** When Match view 3D is On the chance starts as in Off.
- Fixes: all 3D time cost and any 3D camera surprise. Saves the whole 33 s a match in 3D.
- Cost: 3D players get no build-ups at all.
- Size: **small**: one check in `lib/star/leadInGen.ts` `careerBuildUp` (or `builders.ts`). Drift: none. Engine: none.

**C3. Show a 2D build-up, then cut to 3D at the chance.**
- What: while the lead-in plays (the frame carries `leadIn`), `Match3DLayer` shows the 2D canvas; at the hand-over it cuts to the 3D view.
- Fixes: 3D frame rate and camera risk during the build-up, but keeps the story. The cut at the hand-over would be a visible jump between two cameras. [R]
- Size: **medium** (`components/star/Match3DLayer.tsx`, maybe `lib/star/engineFrame.ts`). Drift: none of the listed drift files. Engine: none. Needs a phone to judge the cut.

### Recommended order [R, mine]
1. A1 (snappy, last 3 s) + B1 (calmer camera). Both small, no drift files.
2. Decide A2 with Harry: 92% of chances or about a third.
3. For 3D, C2 now (nothing to risk), C1 only if 3D build-ups are wanted, after a phone test.

---

## Method notes and gaps
- Scripts were in the session scratchpad, not the repo: `time-model.mts` (chances and build-up lengths), `how.mts` (drawing vs builder, final-frame check), `cam-sweep.mts`/`cam2.mts`/`dump.mts` (camera), `savings.mts` (option sums), `drive-fhr.mjs` (browser driver), `parse.py`, `render.mjs` (schematic stills), and a scratch copy of `lib/star` with env switches for the generator-scale and camera-width tests. Nothing in the repo was edited.
- The browser matches use my bot's aims (1.3 s). 5 + 5 matches is small: a match with 1 chance and one with 10 differ by 4×. The per-chance numbers and the build-up lengths are the steadier ones. The generator sweep (221 and 197 matches) agrees with the browser: 33.4 s a match against 33 s.
- The 3D check is one run in headless software 3D. It cannot tell the frame rate or the look on a phone.
- The dev server used was another session's copy of the same code on port 3093 (the same `CanvasMatch`, `lib/star/fhr`, `leadIn.ts`, `leadInGen.ts` as the main checkout; diffed, no difference). My own server on 3082 ran out of memory (the machine's limit) and was stopped.
- `tests/star` were not run: nothing changed.
