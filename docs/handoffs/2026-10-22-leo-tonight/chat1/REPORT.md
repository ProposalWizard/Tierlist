# Chat 1 · After you score — report (22 Oct 2026)

Branch `leo-celebrations`. Plan parts 1 (goal celebrations) and 5 (big moments), all choices as recommended (1a every goal, skippable · 1b hand-make the knee slide · 1c shop prices on the usual ladder · 5a 85'+ level or one down).

**The match file was changed** (`components/star/CanvasMatch.tsx`, a drift file: the engine-warn hook asked). Every edit is an additive block marked "After your goal" / "Big moments". The engine (`lib/star/canvasEngine.ts`) is untouched. Match tests pass (below).

## What was built

### 1 · Goal celebrations
- **After your own goal** (not team-mates'), your player waits 0.25 s, sprints up to 2 s towards the nearer corner by the goal, then plays the celebration equipped in the shop. Then the match goes on. One plan decides where he is at every moment (`lib/star/celebration.ts`), so the 2D match, the 3D view and the goal video all agree.
- **Tap anywhere skips** ("Tap to skip" pill at the bottom). Measured: the overlay goes 0.04 s after the tap and the match moves on at once.
- **How long:** the result screen holds 5.4 s after your goal (was 1.8 s), only for your goal. Knee slide is the longest (2.84 s move).
- **Shop:** six celebrations, one equipped (`lib/star/store/catalogue.ts`):

  | Item | Price band | 3D move | 2D frames |
  |---|---|---|---|
  | Hands Up | Common | celebrate_safe (jogs on, arms up) | celebHandsUp (6) |
  | Fist Pump (new) | Common | celebrate_pump | celebFistPump (8) |
  | Jump (new) | Rare | celebrate_jump | celebJump (7) |
  | Roar (new) | Rare | celebrate_roar | celebRoar (7) |
  | Aeroplane | Rare | celebrate_airplane | celebArmsOut (10) |
  | Knee Slide | Legendary | knee_slide (hand-keyed) | celebKneeSlide (9) |

  Nothing equipped = the team-mates' fist celebration after the run. The store's note under accessories now says "Your celebration plays after every goal you score".
- **Knee slide (1b):** a hand-keyed clip already existed (`tools/mocap3d/keyed.py`), but its knees pressed together from 1.3 to 1.9 s (5 cm apart; a curve overshoot). Fixed: knees 33 cm apart, shins flat behind, toes clear of the grass; every other clip in `mocap.glb` unchanged (checked within 0.06°). Pipeline for rebuilding one clip: `tools/mocap3d/one-clip/`.
- **2D frames:** six new sprite clips in a new atlas 2 (`atlas-2a.webp` 403 KB for the live Style A look, `atlas-2.webp` for Current), loaded only when first needed. Baker: `node tools/sprites/new/bake-new.mjs celebs`.
- **2D camera:** follows your run and eases in to 70% of the frame on you.
- **3D view:** plays the equipped move at exactly the 2D's moment (`EngineFrameFigure.celeb`, `engineView.ts`), hips pinned, the 2D moving him along the grass. The 3D camera now eases onto you and follows the run.
- **Goal videos:** your goal's video runs 2.5 s longer; your run and move are worked out from the same plan, so the video is whole even when you tapped past it in the match; the TV cut goes to the tight camera once you wheel away (`goalClip/edit.ts celebCut`).

### 5 · Big moments
- **When:** a chance served at 85' or later (scaled to the match length; extra time counts) with your team level or one down, and a goal in the picture (`lib/star/bigMoment.ts`).
- **Before:** a red "BIG MOMENT · Late on · it's on you" banner for 1.9 s, the crowd rising (2.2 s swell), a heartbeat (72 a minute) under the sound until the chance ends.
- **You score:** the last 0.5 s of the shot in slow motion (×0.3; the new ball steps in fixed 1/180 s steps, so the flight is step for step the same — outcome unchanged), a big roar, a late commentary call, and the turning-point music (if music is on and it did not already play).
- **You miss:** a groan. Nothing else changes.
- **Late commentary:** 14 new lines in the offline Kokoro voice (10 lead: 6 winner, 4 equaliser; 4 co-commentator), e.g. "Late, late, he's won it!", "He's levelled it at the death!". Live (`lib/star/lateCommentary.ts`) and in goal videos (`ClipMeta.late`). Ordinary goals are called exactly as before (checked byte for byte).

## Seen in a browser (390×844, dev server, a real career: Darlington v Radcliffe)
- 2D: knee slide, aeroplane, roar, fist pump after real goals (stills `celeb-2d-*`); knee slide sequence with the new camera (`celeb-2d-knee-slide-sequence.jpg`).
- Tap to skip: 0.04 s.
- Big-moment banner (`big-moment-banner.jpg`).
- Goal video of a knee-slide goal: the tight camera follows the run, the slide and the arms up (`goal-video-knee-slide.jpg`).
- 3D match view, knee slide after a real goal: the camera follows the run; he kneels with arms wide, then arms up (`celeb-3d-knee-slide-sequence.jpg`, `celeb-3d-knee-slide-close.jpg`; taken from a screen recording because 3D renders very slowly here). Overlay held 4.35 s in 3D (frames are slow in this sandbox).
- Frame sheets of all six 2D moves (`sprites-celebs-*`), the fixed knee slide in 3D (`knee-slide-fixed-*`).
- No page errors. The only console errors were 500s from data routes (the sandbox cannot reach the database), so squads were invented.

## Not seen / not measured
- The goals were real strikes, but the ball was moved into the net by the test tool (the sandbox keeper saved every drag), so the slow motion in a real big-moment goal was not seen or timed.
- Sound (crowd rise, heartbeat, roar, late call) cannot be heard here; only checked that nothing errors.
- Hands Up and Jump not played in a match (only on the frame sheets). In 3D only the knee slide was played (the first 3D check, before the camera fix, showed the run leaving a fixed camera; fixed).

## Goal video: scripted, not recorded (for the feed chat)
Your run and celebration in a goal video are drawn from the celebration plan (`goalClip/recorder.ts` writes your position from `celebAt` into every frame after the goal; `render.ts` picks the move's frames). They never rely on recorded movement after the goal, so the held picture during the commentary does not freeze them. Seen: a knee-slide goal video plays the run, the slide and the arms up to the end (`goal-video-knee-slide.jpg`). Other men in the shot do hold still after the recording ends.

## Known issues
- A team-mate making a run can stay near you in the goal video's tight shot (the match's runners carry on); he sometimes stands in front of you.
- Frame sheets are cached on a phone for a day (existing rule, next.config.mjs). A re-bake of atlas 2 under the same name can draw broken figures until the cache clears (seen once in testing with a stale cache; fine after clearing). Not a problem for the first release of these files.
- Atlas 2 for the Current look is 474 KB (over the ~400 KB aim); it is not the live look.

## Checks
- `npx tsc --noEmit`: clean.
- `node scripts/run-star-tests.mjs finishing keeper aiming outcomes goalClip lateCommentary celebration storeCareer signing3d sprite3dClips gameMusic engineFrame`: all pass (18 files).
- Knee-slide helper: `animSmooth assets3d perf3d cutscene play3d shoulderSet` pass.
- `node scripts/one-engine-guard.mjs`: no new copies.
- `npm run build`: passes (with `NODE_OPTIONS=--max-old-space-size=6144`; the first try ran out of memory while the tests ran beside it). All build guards pass.
- Merged `origin/Leo` before the final push (already up to date).

## Files
New: `lib/star/celebration.ts`, `lib/star/bigMoment.ts`, `lib/star/lateCommentary.ts`, `tests/star/celebration.mts`, `tests/star/lateCommentary.mts`, `public/sfx/cl-late-*.mp3`, `cc-late-*.mp3`, `public/star/sprites/atlas-2*.webp`, `mask-2*.webp`, `tools/mocap3d/one-clip/`.
Changed: `components/star/CanvasMatch.tsx` (shared), `lib/star/engineFrame.ts`, `lib/star/style3d/engineView.ts`, `lib/star/goalClip/{recorder,render,edit,track,audio,commentary,commentaryDurations}.ts`, `lib/star/matchSound.ts`, `lib/star/sprites.ts`, `lib/star/store/{catalogue,career}.ts`, `components/star/store/AccessoryFigure.tsx`, `public/star/anims3d/mocap*.glb`, `public/star/sprites/index*.json`, `public/sfx/manifest.json`, `lib/star/three3d/assetVersions.ts`, `tools/mocap3d/keyed.py`, `tools/sprites/new/*`, `tests/star/sprite3dClips.mts`, `docs/3D_HANDBOOK.md`.
Merging note: atlas slot 2 is ours; the bicycle chat moves to slot 3 (hub).
