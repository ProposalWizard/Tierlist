# People, hands and props in 3D: review and proof (keeping the game's style)

20 Nov 2026. Branch Harry. Nothing in the game was changed. New files are only in `tools/review-people/`.

**Frame (Harry's clarification):** keep the cartoon style. "Realistic" means correct: body proportions, no bugs, pitches, sponsor boards, views, hands, picking things up, interacting. The realistic hand is the bar for how a hand should POSE and TOUCH things, not a reason to change the models.

Each claim says how I know it: **saw** (in a picture I made), **measured** (a number from a script), **read** (in the code, file:line), **reasoned** (worked out, not tested).

---

## The short version

1. **Managers look the same because the game asks for every manager by the same id.** `"signing-manager"` always picks the same one of two suit heads, the same build and the one suit. Only skin, hair colour and the tie change. A small change gives real variety with the art you already have: see still 6. (read + measured + saw)
2. **Proportions are not one rule.** The eight heads are 5.2 to 6.2 heads tall (a real man is about 7.8). The two managers differ most: 5.2 and 5.7. Heads are 12% to 16% of the body's height wide. Every prop, door, desk and goal is real size, so a phone, pen or cup looks small beside the head and big in the hand. (measured)
3. **Body parts pass through each other because one set of moves is played on bodies of different shapes, and the check allows it.** Measured on today's managers: forearm 8.2 cm inside the thigh in the sitting clip, chin 5.3 cm into the chest in the handshake clip. The check has 158 named exceptions, runs on one body, and never checks one person against another or against a prop. (measured + read)
4. **Hands hold things by a fixed finger pose, not by touch.** The game sets finger angles from a list ("pen", "phone", "mic") and puts one grip point on the prop. Nothing closes the fingers until they meet the thing. The phone-hand script does exactly that, and it works on the cartoon hand too: still 7, 0 mm inside the phone, 171 skin points touching. But the cartoon hand itself is a thick mitten: that mesh is now the limit. (read + measured + saw)
5. **Cut scenes are almost silent.** One recorded spoken line in total. The scripted sounds (pen, cameras, kick, crowd) are dropped because no files exist. Kokoro has 54 voices; 8 samples are made. (read + measured)
6. **Pitch, goals, boards, doors and desks are real size in the code.** I found no wrong size there. What I saw wrong is placement and views: a trophy sitting on a face, your own head covering a third of the office view. (read + saw)
7. **Your notes on the realistic stills** (better proportions; legs into the body; weird hands, wrists, arms): causes and fixes are in section 8, with a before/after still. The quick fix helped the arms and the hips (thigh faces cutting the body 114 / 180 → 77 / 99). It did not fix the hands. Those need twist bones and hands placed by contact.

---

## The pictures (every file)

Folder: `/tmp/claude-0/-home-user-Tierlist/b3e40a5d-8375-5f33-bf31-5b59e99a7327/scratchpad/review-people/`

| File | What it shows |
|---|---|
| `6-toon-managers-today-vs-seeded.png` | **Top row: today.** Six clubs' managers: the same head, build and suit six times. **Bottom row: seeded by the manager's name**, using only what the game already has (2 heads, 3 builds, 8 skin tones, hair and grey, a suit, shirt and tie colour). Blender light, not the game's cartoon shader. |
| `7-toon-hand-holding-phone.png` | Today's cartoon hand (from `toon-p1.glb`) holding a phone, posed by the same contact solver as the hand you liked. The pose and the contact are right. The hand's shape is the weak part. |
| `5-today-same-manager-everywhere.jpg` | From the game: office, signing page, signing cut scene, dropped cut scene. The same manager head in all four. |
| `toon/office.png`, `toon/signing-page.png` | Today's office and signing test pages, phone size. |
| `toon/cut-signing-2.png`, `-6.png`, `-10_1.png`, `toon/cut-press-6_7.png` | Today's signing and press cut scenes. |
| `toon/cut-dropped-2.png`, `-5.png`, `toon/cut-dropped-seed9-2.png`, `-5.png` | Today's "you are dropped" scene from the generator, two seeds. Seed 3 at 2 s is 90% black (measured). A fade or a blocked camera: I did not find out which. |
| `today/*.jpg` (10 stills) + `today/bench-today.json` | The 3D bench's ten shots as they are today: home, signing, office, press, trophy, walk-out, garden, drill, made-up goal, made-up trophy. The cookie card is on them (the bench script does not close it). |
| `8-seated-before-after.jpg` (and `8-seated-fixed.png`) | Left: the desk still you saw. Right: the same man with the hips, elbows and wrists corrected in the script. Arms better; **hands still wrong**, and one shoulder of the jacket tore. Section 8. |
| `voices/*.wav`, `voices/*.mp3` | 8 voice samples (section 7). |
| `1-realistic-manager-desk.png`, `1b-…-young.png`, `2-realistic-three-managers.png`, `3-realistic-three-faces.png` | **Made before your clarification.** The realistic body in a suit at a desk, and three realistic managers. Not the plan any more. Useful for one thing: still 1 shows hands laid on a desk by contact (1.5 mm above it, 0 crossings). |

---

## 1. Proportions (measured from the eight body files)

| Body | Heads tall | Head width ÷ height | Hand length ÷ height | Hip height ÷ height | Foot length ÷ height |
|---|---|---|---|---|---|
| Real man (the MakeHuman body, for reference) | 7.8 | 9.5% | 11.1% | 55% | 10.9% |
| Curls (h1) | 5.5 | 13.6% | 10.7% | 47% | 13.0% |
| Quiff (h2) | 5.7 | 13.4% | 10.8% | 49% | 12.4% |
| Buzz & beard (h3) | 6.2 | 13.3% | 11.0% | 48% | 14.1% |
| Bun (h4) | 5.9 | 12.0% | 10.8% | 49% | 12.2% |
| Fringe (h5) | 6.0 | 13.3% | 10.8% | 49% | 14.4% |
| Crop & beard (h6) | 6.1 | 12.8% | 10.8% | 48% | 13.3% |
| Manager 1, grey & stubble | **5.2** | **16.0%** | 11.2% | 46% | 11.7% |
| Manager 2, fade & beard | 5.7 | 13.9% | 11.5% | 49% | 11.8% |

What this means:
- **A big head is the style. A different head size on every man is not.** 5.2 to 6.2 heads tall is a wide spread. Manager 1's head is a third wider than the Bun's. Stand them side by side and one looks like a child. (measured)
- **Hands.** In the file the hand is the right length for the body. The game then shrinks it to 88% (`TOON_LOOK_DEFAULT.hands`, handbook "Style A"). So a hand is about 17 cm beside a head about 33 cm tall: half the head. On a real man the hand is about four fifths of the head. This is why hands read small next to faces and props read big in hands. (measured + read)
- **Legs are short** (hip at 46% to 49% of height, a real man 55%) and **feet are long** (12% to 14%, a real man 11%). Fine as a style if it is the same on everyone. It is not: feet vary from 11.7% to 14.4%.
- **Props are real size**: door 2.15 m (`home3d/roomBuild.ts:615`), desk top 0.76 m (`signing3dScene.ts:186`), goal 7.32 × 2.44 m (`real/arena.ts:52`), pitch 105 × 68 m (`real/pitch.ts:15-19`), every man 1.8 m and scale 1 (`size3d.ts`). The ball is 1.6 × real on purpose (your pick, 13 Oct). (read)
- You have judged body options before (B5b, B5d: `tools/bodies/README.md`; test files `toon-d1..d3`). I did not redo that. The new point is the **spread between heads**, and the managers.

**Fix:** one proportion rule for all eight heads (pick the target once, for example 6.0 heads, head width 13%), and bring each file to it with the tool that exists (`tools/bodies/reshape.py`, head moved as one piece so the face is kept). A test already guards proportions (`tests/star/toonProportions.mts`); add "all heads within 0.15 heads of each other".

---

## 2. Why managers all look the same: the exact cause

1. `lib/star/signing3dScene.ts:329`: the manager is made with `who: "signing-manager"`. This one line serves the signing scene AND the manager's office, at every club. (read)
2. `lib/star/style3d/toon/bodies.ts:39`: there are only two suit heads. `bodies.ts:119-121` picks one from the id. (read)
3. `"signing-manager"` always gives head `m2` ("Fade & beard") and build `c2`. In cut scenes the manager's id is `"boss"` (`cutscene/fixtures.ts:41`, `story.ts:32,76-78`): also `m2`. So do `"chairman"`, `"journalist"` and `"agent"`. (measured: I ran the game's own hash on each id)
4. `signing3dScene.ts:347` passes only skin, hair colour and grey. The beard, bald head and buzz cut worked out per manager name (`components/star/Office3D.tsx:47-53`) are dropped, because a Style A head has its hair and beard modelled in. (read)
5. The suit is one colour for everyone: `toon/shader.ts:518`. Only the tie takes the club colour (`people3d.ts:996`). (read)
6. In cut scenes the manager's default skin and hair are fixed values (`cutscene/casting.ts:35`) unless the career passes its own. (read)

Saw it: `5-today-same-manager-everywhere.jpg`. Also saw, in the game and in my own render: **manager 2's shirt is painted in his skin colour** (the file's mask marks the shirt as skin). A real fault in `toon-mgr2.glb`.

**The fix, in two sizes:**
- **Small (about half a day, no new art):** seed from the manager's name, not a fixed id; seed the suit, shirt and tie colour. Result: still 6, bottom row. 2 heads × 3 builds × 8 skins × hair × grey × 6 suits.
- **Proper (needs your OK for Higgsfield, RUL-3D-002):** 4 to 6 more suit heads in the same style: bald, glasses, older, heavier, a tracksuit manager, a woman. The handbook prices a head at 18 credits. Then two faces become eight.

---

## 3. Body parts through each other

**Measured today, on the two manager bodies** (`tools/motionref/body_overlap.mts`, 5 checks a second):

| Clip | Manager 2 (build c2) | Manager 1 (build c3) |
|---|---|---|
| Sitting (`boss-sit`) | forearm in thigh 8.1 cm (57% of the clip), hand in shin 6.7 cm, thigh in belly 9.9 cm | forearm in thigh 8.2 cm, hand in thigh 6.3 cm |
| Standing (`boss-idle`) | upper arm in chest 2.9 cm, all the time | thigh in belly 3.4 cm, upper arm 2.9 cm |
| Talking (`boss-talk`) | upper arm in chest 3.9 cm (85%) | upper arm 4.2 cm, chin in chest 2.8 cm (70%) |
| Handshake | thighs together 6.3 cm, chin in chest 2.5 cm | **chin in chest 5.3 cm, all the time** |
| Idle | upper arm in chest 4.0 cm, forearm in body 3.0 cm | **forearm in thigh 4.2 cm, all the time** |

**Causes:**
1. **One move, many bodies.** A clip is made for one body and played on eight heads × three builds. Bigger head, thicker chest, wider thigh: the same arm now cuts in. (measured above; the same thing showed on three builds of the realistic body: 0, 97 and 104 crossing faces from one clip)
2. **The check lets it through.** `tools/motionref/overlap_exceptions.json` holds **158 named exceptions** (deepest: upper arm in chest 20.8 cm, thigh in belly 17.2 cm). The test (`tests/star/bodyOverlap.mts:13-15`) runs **one body** (`toon-p1.glb`) on 23 clips: not the managers, not the three builds, not the sit clips. (read)
3. **Never one person against another.** The hugs and dap-ups were built on a body the game no longer uses (`public/star/onebody/player.glb`, `tools/ovation3d/README.md`) and are played on Style A bodies (`lib/star/ovation3d.ts:245`). Nobody has measured two men together. (read; I did not measure it either)
4. **Never a person against a prop.** Saw: in `today/gen-trophy-today.jpg` the trophy's base sits on his face, over one eye. `tests/star/propHold.mts` checks the cup against his head in one hand-made lift only.
5. **Hands put on a fixed point.** The signing cut scene has 9 exceptions for the writing hand sunk 1.5 to 5 cm into his own leg and belly (reason in the file: "the writing hand's IK target sits against his own belly"). (read)

**Fix (no new idea needed, the check is good):**
1. Run the check on all eight heads × three builds, and on every clip a scene uses.
2. Add person-against-person (handshake, hug, dap, pat) and person-against-prop (trophy, desk, chair, mic).
3. Stop adding exceptions; clear them clip by clip, cut-scene clips first.
4. Fix at the source: (a) when a person is built, let his arms out until nothing crosses (I did this in the proof: one small loop cleared it); (b) hands that rest on a thing are placed by contact; (c) two-person moves re-made on today's bodies.
5. Put it in `npm run test:star`.

**Not checked by anything today (read: no test exists):** feet floating or sinking into the ground, and a pop when one clip changes to the next. I did not measure these. They need a small check each: lowest foot point against the floor every frame; the largest joint jump between two frames.

---

## 4. Hands, holding and picking things up

**How it works today (read):**
- A hand pose is a list of finger angles: `lib/star/cutscene/hands.ts:18-30` (relaxed, open, flat, fist, point, pen, phone, mic …).
- A prop has grip points: `lib/star/cutscene/props.ts` (pen `:96`, phone `:224`, mic `:233`). The hand goes to the point and takes the named pose.
- Nothing checks that the fingers touch the thing, or stop at it. A pose that fits the pen on one head is too open or too closed on another, and thick fingers pass through thin props.
- The full people layer with grips and handshake (`lib/star/cutscene/people.ts`) is written but the director still uses the stand-in (`cutscene/peopleAdapter.ts:9`).
- The handbook lists "props held by hands" as not done (`docs/3D_HANDBOOK.md:1073`).

**The bar: the phone hand** (`tools/phone3d/hand_phone_gta.py`). It closes each finger joint until it touches the phone, flattens the pads onto it, and counts crossings. It prints its own proof.

**I ran that same solver on today's cartoon hand** (still 7). Measured: deepest point inside the phone 0.0 mm, 171 skin points touching, 0 faces of one finger cutting another. So the method carries over to the cartoon body with no change: the bones are the same 54.

**What still looks wrong in still 7 (saw):** the cartoon hand is a thick mitten. The fingers are fat, have no knuckles or nails, and barely separate; one bulges over the phone's bottom corner. The cartoon hand has no clean finger shapes for a solver to wrap round a thin thing.

**Fix, in order:**
1. **A proper cartoon hand.** One well-made stylised hand (clear fingers, knuckles, nails, same 15 bones) grafted onto all eight bodies at the wrist. The realistic body's hand is the pattern for its shape and its weights (3,190 triangles; a cartoon version can be about 1,200). Shaded by the game's cartoon shader, so the style is kept.
2. **Grips by contact, made once per prop.** Run the solver in Blender for each prop × grip (phone, pen, contract, trophy handles, mic, shirt, ball, cup, door handle), save the finger angles as that grip's pose. The game then plays a pose that is known to touch and not cut. No cost on the phone.
3. **Picking up and putting down** as three steps a script can ask for: reach (the hand goes to the grip, fingers open), close (to the saved pose), carry (the prop follows the hand). The director has the parts (`reach`, `carry`, `grab` in `people.ts`); it needs the adapter switched and the contact poses.
4. **One hand size.** Decide 88% or 100% once, with the new hand, and size props' grips to it.

---

## 5. Views and framing

- Cut-scene cameras on a tall phone were fixed on 20 Oct (handbook B5: 27 of 65 bad shots → 0, measured then). I did not re-measure.
- **Not covered by that fix: the office and the signing scene** (they are not director scenes). Saw: in `toon/office.png` and `toon/signing-page.png` your own head fills the left third of the screen, with a broken neck and ear edge, and the manager is cut off at the right.
- Saw: `today/trophy-today.jpg` is mostly the cup and an arm; no face.
- Saw: `toon/cut-dropped-2.png` 90% black at 2 s (seed 3).
- Fix: give the office and signing cameras the same rule the director has (keep the lens clear of heads: `clearOfPeople`, `clearShot` in `director.ts`), and add those two scenes to `scripts/bench3d/framing.mjs`.

---

## 6. Pitches, goals and sponsor boards

Read in the code, not judged on a phone:
- Pitch 105 × 68 m, goal 7.32 × 2.44 m, net 2 m deep, posts 12 cm (`real/pitch.ts:15-19`, `real/arena.ts:52, 514`). Real sizes.
- Boards: 1.0 m high, 3.6 m behind each goal line, 4 m outside each touchline (`real/arena.ts:218-227`). Real boards are about 0.9 to 1.0 m. Fine.
- Board picture: one strip, 2048 × 222 pixels, stretched along an 86 m board: about 24 pixels a metre. Close to the camera (a corner, a celebration by the boards) that is soft. Grass picture 512, tiled. Crowd one 1536 × 860 photo sheet. (measured)
- The goal has a scale the match can change (`setArenaGoalScale`, `real/arena.ts:38`; `engineView.ts:214`). `SIZE3D.goal` is 1 today, so it does nothing. It is a door left open to break "sizes never change". (read)

Saw in the bench stills: stands, boards and pitch look right in the made-up goal and trophy scenes. I did not find a wrong size. **What I did not do:** a board-by-board check of words, brands and seams, or the pitch from every match camera. That is a half-day job with the 3D bench, and worth doing before any art is redone.

Likely wins (reasoned): a sharper board strip (4096 wide, or two strips) for close shots; one stadium for every cut scene (handbook step 7, not done).

---

## 7. Audio and voices (unchanged from the first pass)

**Today (read):**
- One recorded line in all cut scenes: `lib/star/cutscene/voiceLines.ts:2` (`public/sfx/cut-mentor-line.mp3`, Kokoro `bm_george`).
- Every other line is a caption; lips move on a timer (`director.ts:332`).
- Scripted sounds are dropped: beats ask for `pen-scratch`, `camera-shutters`, `kick`, `net`, `crowd-roar`, `crowd-murmur` (`beats.ts:163, 243, 290-292, 324, 376, 415`); `components/star/CutsceneDirector.tsx:88` plays a cue only if it is a recorded voice line (its comment: "other cues have no sound file yet").
- Music: five 20 to 24 s loops from a small synthesiser (`tools/cutscene-music/make_beds.py`).

**Kokoro has 54 voices** (measured: installed here and listed; Apache-2.0; no real person copied).
- English 28: American women 11 (`af_alloy, af_aoede, af_bella, af_heart, af_jessica, af_kore, af_nicole, af_nova, af_river, af_sarah, af_sky`), American men 9 (`am_adam, am_echo, am_eric, am_fenrir, am_liam, am_michael, am_onyx, am_puck, am_santa`), British women 4 (`bf_alice, bf_emma, bf_isabella, bf_lily`), British men 4 (`bm_daniel, bm_fable, bm_george, bm_lewis`).
- Other languages 26: Spanish 3, French 1, Hindi 4, Italian 2, Japanese 5, Portuguese 3, Chinese 8.
- The catch: only 4 British men, and the commentary uses all four. Ways round: blend two voices into a new one (from memory, not tested); Chatterbox, already in the repo (MIT), with Kokoro-read references and an emotion control; a Spanish, Italian, French or Portuguese voice reading English for a foreign manager (not tested). Piper is another free offline voice, but each Piper voice has its own licence; I did not check them.

**Samples** (in `voices/`, each `.wav` and `.mp3`, 3.1 to 4.9 s): `manager-1-old-hand-bm_george`, `manager-2-young-coach-bm_daniel`, `manager-3-tactician-bm_lewis`, `manager-4-american-am_michael`, `manager-5-woman-bf_emma` (all the same line), `agent-am_puck`, `journalist-bf_isabella`, `team-mate-bm_fable`. **I have not listened to them: I cannot hear.** Made with the small Kokoro file; the commentary uses the full one.

**Lines to record first:** manager about 40 (6 to 8 voices, one per manager, seeded from his name), agent 20 (2 voices), journalist 20 (3), team-mate and captain 20 (4), chairman, physio, presenter 10 each. A 3 to 5 s line is 24 to 40 KB; 40 lines × 8 voices is about 10 MB, loaded per scene.

**Lip sync:** today the mouth follows loudness 30 times a second for the one recorded line. Next: mouth shapes from the sound (Rhubarb Lip Sync: free, offline, MIT, from memory), saved beside the loudness in `voiceLines.ts`. The cartoon face already has a moving mouth (`style3d/toon/face.ts`), so this works in today's style.

---

## 8. Harry's notes on the realistic stills (added after he saw them)

"They look proportionally a lot better though, the legs are pushing into the body a bit and the hands/wrists/arms are super weird."

### 8a. What is better about those proportions, and how to bring it into the cartoon bodies

What the realistic body has that today's cartoon bodies do not (measured, table in section 1):
- **A smaller head for the body:** 7.8 heads tall, against 5.2 to 6.2.
- **Longer legs:** the hip at 55% of his height, against 46% to 49%.
- **Shorter feet:** 10.9% of his height, against 11.7% to 14.4%.
- **Shoulders and arm length are already the same** (shoulders 24%, arm 28% of height on both). So the arms are not the problem; the head, the legs and the feet are.

How to bring it in and keep the cartoon faces:
1. Pick one target between the two. My suggestion to try first: **6.8 to 7.0 heads, hip at 52%, feet at 11.5%**. That keeps a cartoon head (about 15% bigger than real) on a grown man's body.
2. Use the tool that exists: `tools/bodies/reshape.py` with the head moved and scaled as one piece, so the face and its moving mouth are kept (this is how B5d made `toon-d1..d3`). Shrink the head, lengthen thigh and shin, shorten the foot, on all eight files, to the same numbers.
3. The joints move with it, so every clip still plays (the game's proportion code already does this: `lib/star/style3d/toon/proportions.ts`).
4. Check with `tests/star/toonProportions.mts` plus the new rule "all heads within 0.15 heads of each other".
5. You rejected bone-scaled proportions before (B5b: "none of those body proportions look remotely good"). So this must be a re-shape of the mesh in Blender, judged on a sheet of all eight men side by side with a door, a desk and a goal in the picture, before anything goes in the game.

### 8b. Sitting: the legs push into the body

**Measured:** in still 1, 114 faces of the left thigh and 180 of the right cut the belly and jacket (not counting the fold at the hip itself). On today's cartoon managers the same clip puts the thigh 8.4 to 9.9 cm into the belly for the whole clip (section 3).

**Causes:**
1. **The clip folds the hip about 90° and splays the knees wide.** Thighs level, body upright. A real man on a chair sits a little back with his knees a little lower than his hips, so the hip is open to about 100° to 105°.
2. **The skin has nothing to help it at the hip.** One thigh bone, one hips bone, the points between them blended in a straight line. At 90° that blend caves in at the groin and pushes the top of the thigh into the belly. There is no helper bone and no corrected shape for a bent hip.
3. **Clothes are skinned like skin.** The jacket's hem and the belly hang from the hips and spine. They do not lift when the thigh comes up, so the thigh goes through them. On a heavy build (this man has a belly) it is worse.
4. **No limit on the joint.** Nothing stops a clip folding a hip further than the body can take.

**Fixes, cheapest first:**
- (a) **Fix the sit clips**: hips back 5° to 8°, knees 10° to 15° lower than the hips, knees in from the wide splay. I did this in the proof: crossing faces went from **114 / 180 to 77 / 99** (measured). Better, not gone.
- (b) **A "seated" corrected shape** for the belly, jacket hem and thigh top, switched on by the hip's angle. Made once in Blender, costs the phone almost nothing. This is what removes the rest.
- (c) **Smoother weights at the groin**, and the jacket hem partly following the thighs.
- (d) **Hip flexion limit** in the overlap check: a clip that folds past it fails.

### 8c. Hands, wrists and arms looking weird

**Causes in the still you saw (read from my own script, and true of the game's scenes too):**
1. **Elbows out like wings.** The arm solver was told to point the elbows out to the sides. A seated man's elbows hang down by his ribs.
2. **Wrung wrists.** To lay the palms flat, the hand was twisted about 35° to 40° a side, half of it at the wrist. The body has **no twist bones in the forearm**: one forearm bone, one hand bone. A real forearm turns along its whole length. With one bone the turn happens in one ring of skin, so the wrist looks wrung like a sweet wrapper.
3. **Bent wrists.** The hands were then aimed inward, which bent the wrist sideways.
4. **Fingers from a list of angles**, not closed onto anything. Flat, stiff, evenly spread.
5. **Shoulders.** Lowering an arm from the body's rest pose with one upper-arm bone pinches the shoulder; the jacket shows it.

**What I tried, cheaply (still 8, right side):**
- Elbows down: **better**. This is the biggest visible gain.
- No forced palm-down twist; the forearm turns at most 40° and the wrist stays within 9° of straight (measured: wrist bend 8.4° and 8.6°).
- The game's relaxed finger curl.
- A smoothing pass on the suit.

**Honest result:** the arms now sit like a man's. **The hands are still wrong**: the left hand's fingers tangle and the right hand lies on its side. The smoothing pass also tore the jacket at one shoulder. So a quick pose change is not enough. The hands need the real fixes:

**Fixes:**
- (a) **Twist bones**: one in each forearm (and one in each upper arm), sharing the turn along the limb. Added to the body file once; the game spreads the hand's turn onto it. This cures the wrung wrist in every scene. About 4 bones more (54 → 58).
- (b) **Corrected shapes** for the three worst joints: wrist, elbow, shoulder. Made in Blender, driven by the joint's angle.
- (c) **Better weights** at the wrist and the shoulder (wider, smoother bands).
- (d) **Hands placed by contact, not by angle**: the same solver as the phone hand, run for "hand resting on a desk", "hands clasped", "hand on a knee", and each prop grip. Saved as poses. The phone hand is the proof that this works; a flat hand on a desk is the same job with a flat surface.
- (e) **Wrist limits** in the check: bend over about 30° or a turn over about 60° with no twist bone fails.

All of 8b and 8c apply to the cartoon bodies exactly as they do to the realistic one: same 54 bones, same clips, same faults (section 3 measured them on the cartoon managers).

---

## The plan in steps

| Step | What | Effort | You see |
|---|---|---|---|
| 0 | Managers seeded by name + seeded suit, shirt, tie. Fix manager 2's shirt mask. The six missing cut-scene sounds. | 1 to 2 days | Still 6's bottom row in the game; scenes have sound |
| 1 | One proportion rule, moved towards the realistic body (try 6.8 to 7.0 heads, hip 52%, feet 11.5%): all eight heads re-shaped to it, faces kept; decide hand size. Judged on a sheet first. | 4 to 6 days | Managers and players that belong together, with a grown man's legs |
| 1b | Sitting and arms: sit clips opened at the hip; twist bones in forearm and upper arm; corrected shapes for hip, wrist, elbow, shoulder; elbows-down rule in the arm solver. | 1 to 1.5 weeks | No thighs in bellies, no wrung wrists |
| 2 | The overlap check made wide: 8 heads × 3 builds, every scene clip, person against person, person against prop, feet on the floor, pops. In the test run. | 1 week | A list of every fault, then none in cut scenes |
| 3 | A proper cartoon hand on every body; grips made by contact for each prop; pick up, hold, put down as script steps; the full people layer switched in. | 1.5 to 2 weeks | Hands that hold the pen, phone, trophy, mic |
| 4 | Office and signing cameras on the director's rule; trophy shots; the pitch and boards pass on the bench; sharper board strip. | 3 to 5 days | No head across the lens, clean boards |
| 5 | Voices: 8 manager voices + 3 roles, about 130 lines, mouth shapes from the sound. | 1 week | Managers who talk and sound different |
| 6 | More suit heads (needs your OK for Higgsfield). | 2 to 3 days + credits | Eight manager faces, not two |

Efforts are my estimates. Nothing here changes the style or adds work for the phone: no new lights, the same or fewer triangles a person (the new hand is small), poses worked out in Blender ahead of time. (reasoned)

Random events and a story in a career: the scene generator already turns a game event into a scene (`cutscene/generate.ts`, `story.ts`). It needs events and lines. Steps 0, 3 and 5 are what it would stand on.

---

## What I did not check

- Nothing on a real phone. This machine has no graphics chip.
- Feet on the ground and clip-to-clip pops: no numbers.
- Two men together (hug, handshake): no numbers.
- The match itself in 3D, the shop, the house, the casino: not looked at in this pass.
- The voice samples by ear.
- Stills 6 and 7 use Blender's light, not the game's cartoon shader.

---

## Files added (committed on Harry, not pushed)

- `tools/review-people/toon_managers.py`: still 6.
- `tools/review-people/toon_hand_file.mjs`: makes the cartoon body readable by the phone-hand script (still 7 is then `tools/phone3d/hand_phone_gta.py` with `PHONE3D_HUMAN` set to that file).
- `tools/review-people/toon_stills.mjs`: stills of today's scenes from the game's test pages.
- `tools/review-people/strip_sheet.py`, `compare_sheet.py`: labelled sheets.
- `tools/review-people/voice_samples.py`: lists Kokoro's voices and records the samples.
- `tools/review-people/realistic_people.py`: the realistic stills made before the clarification, with its crossing check.
