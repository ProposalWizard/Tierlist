# Chat 3 · Bicycle kicks — report (22 Oct 2026)

Branch `leo-bicycle`. Not live. Plan: part 3 of `../../../plans/2026-10-22-leo-tonight/plan.html`,
`docs/plans/2026-10-20-flair-bicycle.md`, research `docs/research/2026-10-21-headers-volleys-acrobatics.md`.

## What was built

1. **When it is offered** (`lib/star/bicycle.ts`). Only on a header chance whose cross
   reaches you **above your head** (1.90 m or more) and travels **across you** (45° or
   more off the line from you to goal), from either side (Leo 3a). Not a ball coming
   straight at you, not a ball from straight behind, never a volley or a ground ball.
   How often, when it fits: by **Aerial & Acrobatics** (Leo 3b): 1 in 4 at Aerial 40,
   a straight line up to every time at 80+, at least 1 in 20 below 40. No new stat.
   Seeded off the chance (no random draw: the match is otherwise unchanged).
2. **The BICYCLE button** (`components/star/ContactBall.tsx`). An orange "Bicycle!"
   button on the "Head it?" screen. Pressed: "Bicycle kick!", the ball drops across you
   again and again, a Height meter with a green band, a smaller centre ring. "← Head it"
   goes back.
3. **How it is judged** (`bicycleContactRead`, `airborneChance.ts applyBicycle`). A strike
   rule on top of `launch`, like the volley's; `canvasEngine.ts` is NOT changed.
   - Clean only within 0.1 ball radii of the middle (a volley: 0.2) and inside the band
     0.4–0.8 of the drop (a volley: 0.25–0.9). Aerial widens the band (0.30–0.90 at 90)
     and forgives a miss (the same line headers and volleys use).
   - Clean: ×1.2 pace, and the keeper reacts 0.14 s later (`keeperBrain.ts brainReactLater`,
     new, additive; replays do the same).
   - A miss goes off line fast (up to 40°), balloons if early, is scuffed if late.
4. **The animation.**
   - **3D**: a hand-keyed `bicycle` clip, 1.5 s (`tools/anims3d/clips.py`, built into
     `public/star/anims3d/football.glb` and `football-ual.glb`). Crouch, left knee up,
     lie back, right foot meets the ball above head height at 0.48 s, land on the back
     with the hands out, sit up. Played in the 3D match view (`style3d/engineView.ts`).
     Contact sheets: `3d-bicycle-side.jpg`, `3d-bicycle-sheet.jpg`.
   - **2D**: a `bicycle` sprite clip, 7 frames, 8 facings, on both body styles, in a new
     small atlas 3 (`public/star/sprites/atlas-3*.webp`, slot 2 is the celebrations', ~300 KB, loads only when needed;
     the strike screen asks for it as soon as the button shows). Sheet: `2d-bicycle-sheet.jpg`.
   - Your own player now plays it through the kick pose (CanvasMatch; it used to force
     the old kick for you). Goal videos wait for it too (`goalClip/render.ts`).
5. **Crowd and media treat a bicycle goal like a hat-trick.** In the match: "BICYCLE!"
   banner, two goal bursts, the crowd roars twice, its own commentary lines (and a line for a
   try that misses). Media: a `bicycle-kick` story at a hat-trick's importance (76), its own
   fan, tabloid and club posts, the pundit's praise, a headline, and a press-conference
   question. The goal is recorded as `how: "bicycle"`.
6. **The 15 real overhead goals are back.** They were left out of Real Moments ("acrobatics
   are not built yet"). Now each plays as a header chance with the BICYCLE button always on.
   All 15 pass every automatic check (15 of the 67 header moments in the pool).

## Numbers (measured: `scripts/bicycle/measure.mts`)

How often the button shows, per 40 matches (200 matches of the real unseen match and the
real chance maker; 19.4 header chances per 40 matches, 8.6 of them fit):

| Aerial | 30 | 40 | 60 | 80 | 90 |
|---|---:|---:|---:|---:|---:|
| Shown per 40 matches | 0.4 | 1.4 | 4.4 | 8.6 | 8.6 |

Real overhead moments add to this when Real Moments is on.

Goals per 100 attempts (400 fitting header chances from the real chance maker, a seeded bot):

| | Aerial 40 | 60 | 90 |
|---|---:|---:|---:|
| Bicycle, clean (in the middle, in the band) | 39.5 | 39.5 | 39.8 |
| Bicycle, poor hand (9–13% of them clean) | 15.0 | 19.3 | 25.3 |
| The same balls headed instead | 28.8 | 32.8 | 40.5 |

Before the misses were made harsher, a poor bicycle scored 26–31 in 100 (too forgiving).

## Checks

- `tests/star/bicycle.mts` (new): offer rule, strict read, strike, replay, marks, media — all pass.
- `airborne`, `airChances`, `aerialSkill`, `realMoments`, `realMomentHighlights`, `media`,
  `goalClip`, `sprite3dClips`, `spritesStyleA`, `actionLog`: pass.
- Match tests `finishing keeper aiming outcomes` (12 files): all pass.
- Body-overlap check on the 3D clip: passes the gate with no new exceptions (hip-crease
  numbers like the diving header's). All 27 old clips in football.glb unchanged.
- 2D: old atlases byte-identical; only atlas 3 and the bicycle entry added.
- `node scripts/one-engine-guard.mjs`: clean.

## Seen vs not seen

**Seen in a browser at 390×844** (the real match, on `/star-real-moments-dev` → a real
overhead moment → ▶ Play; about 45 tries; no console or page errors):
- `bike-01-button.jpg` the "Head it?" screen with the orange Bicycle! button.
- `bike-02-mode.jpg` Bicycle kick! mode: Height meter, green band, "← Head it".
- `bike-03-clean.jpg` a clean hit: "BICYCLE KICK!" grade. (The grade sat over the Power bar;
  moved under the ball after this still. The fix is type-checked, not re-filmed.)
- `bike-04/05/06-anim-*.jpg` the pitch after the strike; in a screen recording the player
  tipped back, scissored, lay flat and sat up: the new clip, not the old kick.
- `bike-07-result.jpg` a bicycle goal: the banner and confetti. The banner read "BICYCLE KICK!",
  wrapped onto two lines and was cut off at the left; now "BICYCLE!" (not re-filmed).
- `bike-08-poor.jpg` a late tap: "TOO LATE" in red. `bike-09-back-to-header.jpg` "← Head it" works.
- Contact sheets of every frame: `3d-bicycle-side.jpg`, `3d-bicycle-sheet.jpg`, `2d-bicycle-sheet.jpg`.

**Not seen:** the commentary line (the test page has no commentary ticker; the lines are covered
by type-check only); the move in the 3D match view (seen only on the contact sheets on the real
body); a bicycle chance arising in a full career match (rare by design: about 1.4 per 40 matches at
Aerial 40); the media posts on the phone (tested through the real media pipeline, not looked at).
The playtester saw the player upright again about 0.5 s after the strike, where the clip runs
1.1 s; the likely reason is the shot ending and the scene moving on, not checked.
Of 8 overhead moments tried, a clean hit scored as a bicycle on one (with the aim 12° off centre);
one always went in off a defender (correctly not counted as a bicycle goal); others were saved.

## Known issues

- The goal video's spoken commentary has no bicycle line (its lines are recorded audio);
  it uses the general goal call.
- The 2D clip is weakest facing straight up the screen (you see his front).
- The bicycle clip runs 1.1 s in 2D, longer than other strikes, so it can still be playing as
  the result shows. Looks only.
- Offer numbers exclude Real Moments; the fit rule only reads the crosser's spot and the
  cross height (no new placement: nobody is moved).

## Match-file warnings

The engine-warn hook asked on `CanvasMatch.tsx` and `keeperBrain.ts` (both edited, small and
additive). `canvasEngine.ts` is not touched. The drift warning concerns what play screens hand
the engine: no prop the engine reads was changed (only the strike screen's new `bicycle` prop).

## Files touched

New: `lib/star/bicycle.ts`, `tests/star/bicycle.mts`, `scripts/bicycle/measure.mts`,
`public/star/sprites/atlas-3.webp`, `atlas-3a.webp`, `mask-3.webp`, `mask-3a.webp`, `tools/anims3d/look/*`.
Changed: `components/star/ContactBall.tsx`, `components/star/CanvasMatch.tsx`,
`lib/star/airborneChance.ts`, `lib/star/keeperBrain.ts`, `lib/star/actionAnim.ts`,
`lib/star/sprites.ts`, `lib/star/sprite3dAnim.ts`, `lib/star/style3d/engineView.ts`,
`lib/star/three3d/footballAnims.ts`, `lib/star/goalClip/render.ts`, `lib/star/realMoments/shots.ts`,
`lib/star/fhr/realMomentHighlights.ts`, `lib/star/media.ts`, `lib/star/media/{types,graphics}.ts`,
`lib/star/media/detect/goals.ts`, `lib/star/media/templates/{social,press,club,data}.ts`,
`public/star/anims3d/football.glb`, `football-ual.glb`, `public/star/sprites/index.json`,
`index-a.json`, `tools/anims3d/clips.py`, `tools/sprites/new/{defs.js,bake-new.html,bake-new.mjs}`,
`tests/star/{sprite3dClips,realMoments,shotLab}.mts|ts`.

## Hub join fix (22:57)

Chat 1 (celebrations) also used sprite atlas slot 2. The bicycle frames moved to **slot 3**
(`atlas-3.webp`, `atlas-3a.webp`, `mask-3.webp`, `mask-3a.webp`; `atlases["3"]` in both
indexes; the clip says `atlas: 3`). `lib/star/sprites.ts` now has `LAZY_ATLASES = new Set([2, 3])`:
neither is fetched in the idle preload, only when a clip in it is asked for (the strike screen asks
for the bicycle as soon as the button shows; goal videos wait for it). `assetVersions.ts` renamed.
Re-checked in a browser at 390×844 (real overhead moment, ▶ Play): `atlas-3a.webp` fetched with 200
when the button appeared, a clean tap graded BICYCLE KICK!, no console or page errors. The figure in
that run was too small in the recording to confirm its pose by eye (it was deflected). Tests
sprite3dClips, spritesStyleA, bicycle, goalClip, actionLog and tsc pass.
