# B5c — fluid arms, shoulders down, arms off the body (20 Oct 2026)

Harry: *"I don't like how robotic the arms can end up being"*, then *"why is the
shoulders always so awkwardly high when moving … even when standing stationary"*
and, on `b5b/walk-options.mp4`, *"the arms are hitting into the body and through the body"*.

## 1. Shoulders too high — found and fixed

**Cause (measured):** every body is built with its collarbones level (0°). The
motion-capture clips lift them: idle and applause 13°, talk 14°, handshake 26°,
wave 23°, point 24°, the celebrations 22–25°. Only the walk and run loops had been
brought down before (`runPosture.ts`). So he shrugs even standing still.
Not a body problem: every body's bind pose is level. 49 of 73 clips lifted them more than 3°.

| clip (today's body) | collarbone before → after | neck base above the shoulder joints |
|---|---|---|
| idle | 13° → 0° | 4.0 → 8.5 cm |
| handshake | 26° → 0° | −0.1 → 8.5 cm |
| applause | 13° → 0° | 3.9 → 8.5 cm |
| wave | 23° → 0° | 0.4 → 8.1 cm |
| point | 24° → 2° | 0.8 → 8.1 cm |
| celebrate_fist | 25° → 1° | −0.1 → 8.0 cm |
| walk | 1° → 1° | 8.1 → 8.4 cm |

Clips still above 3° after: only ones with an arm up (high claim, jump, airplane, safe
hands, sit/stand, hug), where a real shoulder does shrug (up to 22° with the arm straight up).

**Seen with a pose detector on the stills** (neck length ÷ shoulder width, MediaPipe on
the picture; lower = shoulders nearer the ears). Real people in the reference videos: **0.61–0.69**.

| | idle before → after | walk before → after |
|---|---|---|
| today's body | 0.48 → 0.56 | 0.63 → 0.65 |
| body B (B5b toon-b4) | 0.56 → 0.64 | 0.67 → 0.69 |

Body B now sits inside the real range. Today's body standing still is still a little
short (0.56): the rest is the body itself — the Style A neck is 1.25× thick
(`TOON_LOOK_DEFAULT.neck`, worth 0.02–0.03 here) and the head and shoulder sculpt.
That is B5b's to judge. Pictures: `shoulders-before-after.jpg` (front and side, idle and mid-walk, both bodies).

## 2. Arms through the body — found and fixed

**Cause (measured on the skin, frame by frame):** the capture people were narrower at
the waist and hips for their shoulders than our bodies. On our bodies the forearms and
hands swing into the hips and waist. Walk: a hand **8.8 cm into the hip in 92% of frames**
(today's body), 8.7 cm on body B.

**Check** (`tools/motionref/arm_clearance.mts`): every clip, 10 frames a second, the
mesh skinned on the CPU, each arm skin point tested against the torso and hips skin
(8 nearest points must agree it is inside). Left out: 15 cm round each shoulder joint,
where arm and chest skin always meet and fold.

| forearm or hand inside the body (>0.5 cm) | before | after |
|---|---|---|
| today's body (73 clips) | 29 clips | 13 clips |
| today's body, Strong build | 30 | 12 |
| body B toon-b2 | 31 | 16 |
| body B toon-b4 | 31 | 16 |

Walk, idle, jog, run, handshake, applause, wave, talk, point, shirt hold, hug: forearm and
hand **clear on all four bodies** (walk 8.8 cm → 0). Still inside after: keeper dives
(lying on the ground, 4–9% of frames), get-up, kicks (4% of frames), celebrate_fist and
dejected (fist to the belly, 2–3 cm on today's body); on body B also volley, first touch,
turns, dribble_run and sprint (8–10 cm for 6–25% of frames).

**Upper arm against the lats** (body B): body B's upper arm is thick for its chest, so a
hanging arm presses 1–6 cm into the lat in almost every clip. Clearing it from the clips
means arms out like a penguin (tried: 22–36° out; it looked wrong). **For B5b:** slim the
inner upper arm and the lat at the armpit on body B, or the arms will always sink there.

**Fix** (`lib/star/three3d/shoulderSet.ts`, baked into the files by
`tools/motionref/settle_clips.mts`): at every key, collarbones down to level (the upper
arm keeps its aim, so only the joint comes down), a hanging elbow never locked straight
(10°), and the arm turned about the shoulder just enough to keep elbow, forearm, wrist,
palm and finger ends out of the torso, measured on the body's own skin rings; each turn
spread over ±0.08 s so the swing stays smooth. Settled against today's body (Slim and
Strong builds) and B5b's f2 and f3; the arms also keep off the legs and the head. Files: anims.glb 251 → 225 KB, mocap.glb 627 → 657 KB,
football.glb 239 → 243 KB, casino.glb 69 → 70 KB.

**Re-run** `SHRINK_TOOLS=… npx tsx tools/motionref/settle_clips.mts` after rebuilding any clip
file (`tools/mocap3d`, `tools/anims3d`) or when B5b's body lands (it picks up
`public/star/people3d/toon-f2.glb` / `toon-f3.glb` by itself); the clip builders now run it at their end. `tests/star/shoulderSet.mts` fails if a file
was rebuilt without it.

Video: `arms-before-after.mp4` (side-view walk, today's body and body B, before | after) + still.

## 3. Fluid cut-scene arms

**Why they were robotic (measured, `tools/motionref/arm_metrics.py`, his wrists frame by frame):**
IK holds pinned the wrists still (frozen = share of time a wrist moves under 2 cm/s against the
chest), every joint arrived at once (no lag of forearm behind upper arm), a fixed collarbone, linear
lifts, metronome rhythms. Real people in the reference videos: frozen 0.00–0.02.

| scene ("you") | frozen before → after | longest still | jerk 95% (m/s³) | real people |
|---|---|---|---|---|
| trophy lift | 0.49 → 0.14 | 2.7 → 0.6 s | 930 → 764 | frozen 0.01, jerk 289 |
| goal celebration | 0.18 → 0.05 | 0.6 → 0.5 s | 1278 → 1182 | 0.00, 272 |
| press answer | 0.87 → 0.37 | 3.2 → 2.6 s | 37 → 144 | 0.00, 133 |
| farewell | 0.28 → 0.09 | 3.4 → 0.6 s | 363 → 366 | 0.00, 354 |
| signing | 0.45 → 0.34 | 3.2 → 2.8 s | 228 → 409 | – |
| walk-out | 0.20 → 0.14 | 0.7 → 0.7 s | 259 → 208 | 0.02, 41 |
| mentor | 0.37 → 0.29 | 0.2 → 0.4 s | 60 → 53 | 0.00, 422 |

How: "ref-…" holds put the arms where the real people's were (`refMotion.ts`); the forearm and
hand trail the upper arm (70 / 140 ms); held hands drift and breathe; the collarbone follows a
raised hand; lifts dip, overshoot and settle. Videos: `compare-trophy-lift.mp4`,
`compare-goal-celebration.mp4`, `compare-press-answer.mp4` (before | after | real people).

**Still not fluid (seen):** the press answer is still the stillest scene (0.37 frozen: the
hands rest on the desk between gestures); the signing is still stiff while he writes (the pen
hand follows the signature path exactly); the trophy is held tilted a little towards the camera
where the real man holds it upright.

## 4. No body part inside another (Harry's rule, 20 Oct 2026)

**Check:** `tools/motionref/body_overlap.mts` — any body, any clip set, any cut scene
(`tools/motionref/dump-pose.mjs` dumps a scene's poses). The body in 14 parts; each part a volume
measured on its own skin; every skin point of every part tested against every other part, every
frame; joint folds and the body's own bind-pose contacts left out. **Gate:** `--gate` with
`tools/motionref/overlap_exceptions.json` (named, measured, with reasons); `tests/star/bodyOverlap.mts`
runs it on today's body (19 clips) — a new or deeper overlap fails.

Run: every clip (73) + 7 cut scenes ("you"), 10 frames a second, 4 bodies.

| body | kind | clips + scenes with it, before → after | worst, before → after |
|---|---|---|---|
| today's (p1) | forearm / hand into body, legs, head | 50 → 20 | 16.5 → 16.9 cm (dives) |
| today's (p1) | chin / head | 14 → 11 | 10.4 → 3.6 cm |
| today's (p1) | upper arm against the lat (named exception) | 72 → 72 | 21.4 → 20.5 cm |
| today's (p1) | legs into torso / legs (named exception) | 86 / 83 | unchanged (not touched) |
| B5b f2 | forearm / hand into body, legs, head | 48 → 25 | 10.0 → 7.6 cm |
| B5b f2 | chin / head | 14 → 11 | 6.6 → 4.3 cm |
| B5b f3 | forearm / hand into body, legs, head | 47 → 25 | 10.0 → 8.4 cm |
| B5b b4 | forearm / hand into body, legs, head | 49 → 25 | 10.1 → 7.6 cm |

Per clip (today's body, worst cm: arms | legs | head): walk 10.0 → 3.2 | 8.8 | 0;
idle 5.1 → 3.2; handshake 8.5 → 3.5; celebrate_fist 9.8 → 2.9; walk-out scene 10.6 → 3.3;
goal scene 9.3 → 5.5; signing scene 9.3 → 5.3 (the remaining arm numbers are mostly the upper
arm against the lat, the named exception).

**Not zero, and why (all named in the exceptions file):**
- **Legs** (every clip): the hip fold (thigh top into belly and buttock, worst in kneeling,
  sitting, dives: up to 17 cm), inner thighs pressing together (Style A thighs are thick for the
  capture's narrow stance), the knee fold in deep bends, feet and shins brushing in narrow steps.
  Not touched in B5c (it was arms and shoulders). To fix: leg clips (stance width, knee and hip
  limits) and the bodies' hip weights.
- **Upper arm against the lat**: the bodies' upper arms are thick for their chests; clearing it
  spreads every arm 20–35° (tried, looked wrong). To fix: the bodies (B5b).
- **Keeper dives**: the bottom arm folds under the body on landing (up to 17 cm). To fix: the dive clips.
- **Sitting** (`sitidle`, `boss-sit`, `sitdown`): hands and forearms on the thighs/shins sink 3–6 cm.

## 5. Press answer: shoulders up at the ears (Harry 20:21)

**Cause (measured in the scene):** the desk top was 0.765 m; the seated man's shoulder joints are
at 0.88 m — the desk was only 11 cm under his shoulders (a real desk is ~30 cm under a seated
man's shoulders: our Style A body sits short, shoulders 36 cm over the seat, a real man ~58).
Hands on it pushed arms and shoulders up. Also his hands sank into it (a seated man's root
drops 7.6 cm when his feet are planted; the desk does not).
**Fix:** desk top 0.665 m (his elbow height + 3 cm), hands kept on top of it.
Neck ÷ shoulder width in that shot: **0.36 → 0.55** (frames 5.5 s and 6.7 s).
Still: `press-shoulders-before-after.jpg`. The short Style A neck (B5b: 0.09 m vs 0.13 real)
still hides more neck than a real man would show.
