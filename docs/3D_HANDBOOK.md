# The 3D handbook

The one front door to the 3D side of Knowitball. Written 9 Oct 2026 from the
code on branch `Harry`. If a path here is wrong, the code wins: fix this page.

Who this is for: Leo and Mikey, and their Claude sessions. You work on your own
branch. This page says where everything is and how to add to it.

> **Start here**
> 1. Merge `main` into your branch: `git fetch origin main && git merge origin/main` (section 6).
> 2. Read the Map (section 1) and find your place.
> 3. Then pick one: **add an animation** (section 3) or **add a model** (section 4).

Section 6 takes two minutes and saves a day.

---

## 1. Map: every 3D place

Each row: what it is, the screen, the scene file, a page you can open to see it,
and the Settings → Look switch that turns it on or off. All switches are in
`lib/star/gameVersions.ts` (`LOOK_ROWS`). Settings → Version (Classic / Standard /
Preview) sets them all at once.

| Place | Screen | Scene / engine | Test page | Look switch |
|---|---|---|---|---|
| The real career match in 3D | `components/star/Match3DLayer.tsx` | `lib/star/style3d/engineView.ts` (draws what the 2D match hands over) | `/star-style-dev` → "Real game" (`components/star/RealGame3D.tsx`) | Match view 3D: On / Off (`lib/star/matchView3d.ts`); 3D camera and 3D player light (`lib/star/style3d/realGameLook.ts`) |
| Dribble run in a match | `components/star/Dribble3D.tsx` | `lib/star/play3d/dribbleRun.ts` on the play3d World, drawn by `lib/star/style3d/gameplay.ts` | played inside a career match | Dribble runs 3D: 3D / Old (`lib/star/dribble3dLook.ts`) |
| 3D drills (Two Touch, Free Roam, Headers & Volleys, Wembley, Pace Sprint) | `components/star/Play3D.tsx`, opened from `components/star/Training3D.tsx` | `lib/star/play3d/scene.ts` (picture) and `lib/star/play3d/world.ts` (rules, own physics). Drill list: `lib/star/play3d/drills.ts` | `/star-training3d-dev`; Free Roam also at `/star-style-dev?scene=play3d` | 3D look: H / Old (`lib/star/look3dStyle.ts`) |
| Crossbar Challenge | `components/star/Training3D.tsx` | `lib/star/training3d/scene.ts` (your shot is the 2D engine; the 3D pitch draws it) | `/star-training3d-dev` | none |
| Garden | `components/star/Garden3D.tsx` | `lib/star/garden3d/scene.ts` (old: `lib/star/garden3d/sceneOld.ts`, frozen) | `/star-garden3d-dev` | 3D garden: New / Old (`lib/star/garden3d/look.ts`) |
| Shop | `components/star/Shop3D.tsx` | `lib/star/shop3d/scene.ts`, items in `lib/star/shop3d/catalogue.ts` | `/star-shop3d-dev` | 3D shop player (`lib/star/signing3d.ts`); 3D look H |
| Casino | `components/star/Casino3D.tsx`, tables in `components/star/Casino3DTable.tsx` | `lib/star/casino3d/scene.ts` | `/star-garden3d-dev` (has a Casino tab) | Casino: 3D / Classic (`lib/star/casino3d/look.ts`); Casino look: New / Old (`lib/star/casino3d/roomLook.ts`) |
| Signing scene | `components/star/SigningScene3D.tsx`, in a career via `components/star/SigningScene3DCareer.tsx` | `lib/star/signing3dScene.ts` (people: `lib/star/signing3dRig.ts`) | `/star-3d-area-dev/signing` | Signing scene: 3D / drawn (`lib/star/signing3d.ts`) |
| Manager's office | `components/star/Office3D.tsx` | `lib/star/signing3dScene.ts` with stage "office" | `/star-3d-area-dev/office` | Talk to your manager: 3D / Old (`lib/star/look3d.ts`) |
| Farewell: guard of honour, standing ovation | `components/star/Farewell.tsx` (the farewell screens) | `lib/star/farewell3d.ts` (guard of honour, plan in `lib/star/guardOfHonour.ts`), `lib/star/ovation3d.ts` | `/star-retirement-dev` | Standing ovation (`lib/star/ovationLook.ts`); Ovation greetings (`lib/star/ovationMoves.ts`) |
| Cut scenes (the director) | `components/star/CutsceneDirector.tsx` | `lib/star/cutscene/director.ts` (read `lib/star/cutscene/README.md`) | `/star-style-dev?scene=director&fixture=signing&clean=1` | Cut-scene people: New / Old (`lib/star/cutscene/look.ts`) |
| Cut-scene people bench (faces, hands, props) | page only | `lib/star/cutscene/peopleAdapter.ts` | `/star-people-dev` | same |
| Style test (five art looks, goal / signing / walk-out cut scenes, Free Roam, Real game) | `components/star/StyleTest3D.tsx` | `lib/star/style3d/` (`styles.ts`, `kit.ts`, `post.ts`, `cutscenes.ts`, `gameplay.ts`) | `/star-style-dev` (query: `style`, `scene`, `tod`, `tilt`, `view`, `seed`, `kinds`, `cam`, `plight`, `demo`, `clean=1`) | none (test page only) |
| Star Pass podium | `components/star/Podium3D.tsx` | spins a GLB from `tools/star-pass-art/export_live3d.py` | on the Star Pass screens | none |
| The test area index | page only | `lib/star/area3d.ts`, `lib/star/assets3dManifest.ts` | `/star-3d-area-dev` | none |
| One of every mode in 3D skin | page only | `lib/star/figureSkin.ts`, `lib/star/figure3d.ts` | `/star-3d-dev` | Drawn-player style |

Notes.
- The 3D shop opens from the garden's shop doors, and its front doors lead back. The casino is also a door in the garden.
- Settings → Look → "3D quality" (`components/star/Quality3dRow.tsx`) is the phone-wide quality tier. See section 2.
- "3D people" (`lib/star/look3d.ts`) and "3D body: Human / Before" (`lib/star/human3d/look.ts`) pick which body every scene uses.
- A new place needs: a screen, a scene file, a test page, a Look switch (New | Old), a row in `lib/star/gameVersions.ts`, and a line in `lib/adminGuides.ts` for the page guide.

---

## 2. Shared building blocks

Use these. Do not make a second copy.

### The body and the people

- `lib/star/people3d.ts` — loads and dresses a person (`loadPeople3d`, `makePerson3d`, `dressPerson3d`, `PersonLook`). One skeleton, 24 joints plus fingers on the "one body". Every clip plays on every body.
- `lib/star/human3d/human.ts` — the parametric human (`makeHuman`, `HumanSpec`): height, build, hair, outfit. Built from MakeHuman by `tools/human3d/build_human.py`. `makePerson3d` calls it when "3D people" is New and "3D body" is Human.
- `lib/star/human3d/npc.ts` — seeded people (managers, fans). `lib/star/human3d/boots.ts` — real boots on the human.
- `public/star/human3d/human.glb`, `public/star/onebody/` (the plain one bodies), `public/star/people3d/` (old bodies + `anims.glb`).

### Kits

- `lib/star/kits.ts` — `kitsOf(club)` gives a club's real colours.
- `PersonLook.kit` (`lib/star/people3d.ts`) paints shirt, shorts and socks on the white kit of a people3d body.
- `dressInKit` (`lib/star/shop3d/scene.ts`) does the same for the old shop and garden footballer (`public/star/shop3d/character.glb`).
- Shirt numbers: `lib/star/signing3dTextures.ts`. Faces: `lib/star/three3d/faceFromUrl.ts`, `lib/star/faceFit.ts`.

### The look: light, post, grade

- Look H ("Console Realism") is one call: `lib/star/style3d/real/look.ts`. Parts: sky and light `real/tod.ts` (day / golden / night), pitch `real/pitch.ts`, stadium `real/arena.ts`, ball `real/ball.ts`, the broadcast pass `real/post.ts`, files `real/assets.ts` (`public/star/h3d`).
- Scenes that build their own world (garden, shop) get look H from `lib/star/style3d/real/enhance.ts`. Drills get it from `lib/star/style3d/real/play3dH.ts`.
- The dials: `lib/star/look/params.ts`. The tuned values: `lib/star/look/tuned.ts` (written by `scripts/look-tuner`, not by hand; read its README).
- Baked light (shade, sun, bounce, worked out once in Blender): `lib/star/look/bakedLight.ts`, made by `tools/bake3d` (read its README), files in `public/star/bake`.
- The colour grade is a 3D LUT: `tools/look/build_lut.py`, `tools/look/derive_lut.py`, files in `public/star/look`.
- The five art styles for the style test are data: `lib/star/style3d/styles.ts`, put on a scene by `lib/star/style3d/kit.ts`, post pass `lib/star/style3d/post.ts`.
- `lib/star/style3d/realGameLook.ts` holds the real game's New | Old camera and player light.
- Stylised bodies (cel / toon look) are being added by another builder. The inputs for the three test bodies are in `tools/modeltest`.

### Quality, the governor and the frame meter

- Quality tiers: `lib/star/three3d/quality.ts`. `TIER_PROFILES` has low / medium / high (pixel caps, antialias, shadows, fps cap, outlines, how many live characters). Auto picks from the device. Pick the tier BEFORE you make the renderer.
- One renderer for all scenes, warm-up, cached loads, dynamic resolution, frame gate: `lib/star/three3d/perf.ts` (`acquireRenderer`, `warmUp`, `loadGltfCached`, `DynamicResolution`, `FrameGate`). Its header lists the steps to adopt.
- The governor: `lib/star/three3d/governor.ts` (the rule: steps down if the middle frame is over ~22 ms for 2.5 s; back up after 15 s) and `lib/star/three3d/governThree.ts` (what a rung does: pixel ratio, shadows, post). A phone opens on Medium and stays there while it keeps up. Call `governScene(...)` once and `g.frame(now)` each drawn frame. Add `?gov=0` to any page to switch stepping off while you measure one tier.
- The frame meter: `lib/star/three3d/frameMeter.ts`. Shows fps, worst frame, draw calls, triangles, shadow and skinned draws, post passes, JS ms, tier and rung. Add `?fps=1` to any page (`?fps=0` hides it; admins and testers see it anyway). The numbers are also on `window.__frame3d`.
- The build machine has NO graphics chip. Frame times here are 10 to 100 times a phone's. Read percentages, never milliseconds. A phone is the only true judge.
- `scripts/perf3d` measures a scene without Next (read its README).

### Files must be packed small: meshopt

- Every GLB the game loads is packed with meshopt by `scripts/perf3d/shrink-models.mjs`. **Every GLTFLoader must call `withMeshopt(loader)`** (`lib/star/three3d/meshopt.ts`) before loading. A loader without it fails.
- Every GLB needs a `POLICY` line in `scripts/perf3d/shrink-models.mjs`. The policy says which vertex data may be made small, because some code reads raw vertices (`people3d.ts`, `dressInKit`, the garden's pieces).
- Props, boots and cars stay Draco where Draco is smaller.

### Cameras

- `lib/star/three3d/orbitCam.ts` — the look-around camera for the garden and shop (drag turns, eased, tilt held, never under the floor). Test: `tests/star/orbitCam.mts`.
- `lib/star/three3d/practiceCam.ts` — the 3D drills' camera: behind your shoulder, turns on its own towards what it frames, never turned by your stick, ball-track for crosses, peek, and PLAY mode for Free Roam (frames the play: tight with the ball, turns to the ball and pulls back when it's away, slides ahead of your run). Test: `tests/star/practiceCam.mts`.
- The real game's 3D camera is built from the 2D canvas's own tilt (`lib/star/cameraTilt.ts`), so every spot on the grass lands on the same pixel. Do not change one without the other.

### Movement and animation helpers

- `lib/star/three3d/gait.ts` — stick push to speed, walk / jog / run / sprint choice, loop speed from ground speed (no foot slide), same-foot crossfade, stamina, pace to speeds.
- `lib/star/three3d/gaitBlend.ts` — the garden's and shop's legs (`GaitBlend`).
- `lib/star/three3d/runPosture.ts` — load-time fixes on the run loops: upright neck, lowered shoulders, running arms.
- `lib/star/three3d/footballAnims.ts` — load and play clips (`loadAnims3d`, `addClips`, `ClipPlayer`, `clipInfo`, `plantedAt`).
- `lib/star/motionLook.ts` — Settings → Look → Motion: Mocap / Old.

### engineFrame: the 2D game decides, 3D only draws

`lib/star/engineFrame.ts` is the record of one frame of the real 2D match: every man where the 2D picture put him, the keeper and his dive, the ball with height, the aim arrow, the camera. `CanvasMatch` fills it when a screen wraps the match in `EngineFrameContext`. `lib/star/style3d/engineView.ts` draws it. **3D reads; it never simulates and never writes back.** The 2D canvas keeps running underneath, invisible, and takes every touch. Test: `tests/star/engineFrameKeeper.mts`.

Pitch units: x across 0 to 68 (goal centre 34), y out from the goal line, z up. In three.js: X = x - 34, Y = z, Z = y.

### Filming

- `lib/star/frameStep.ts` — the contract `window.__frameStep = { duration, seek(t), timeline? }`.
- `lib/star/virtualClock.ts` — `?clock=virtual` freezes the page clock.
- `scripts/film/frames3d.mjs` — see section 3, step 7.

---

## 3. Animations, step by step

### Where the clips come from

| Set | Made by | Output |
|---|---|---|
| Real motion capture (CMU Graphics Lab database, free for all uses) | `tools/mocap3d` (read its README) | `public/star/anims3d/mocap.glb` (the people) and `mocap-ual.glb` (the old shop / garden footballer) |
| Hand-made clips (kicks, drills, keeper, casino) | `tools/anims3d/build.py` with clips in `tools/anims3d/clips.py`, rigs in `tools/anims3d/rig.py` | `public/star/anims3d/football.glb`, `casino.glb` and the `-ual` copies |
| Garden extras (Quaternius UAL clips) | `tools/garden3d/build_anims.py` | `public/star/garden3d/anims.glb` |
| Ovation hugs, dap-ups, claps (both men posed together in Blender) | `tools/ovation3d/author_greetings.py` | `public/star/ovation3d/greetings.glb` |
| Keyed by hand (keeper dives, tackles, knee slide: no free capture exists) | `tools/mocap3d/keyed.py` | inside `mocap.glb` |

Settings → Look → Motion: Mocap plays the capture clips over the hand-made ones BY NAME. Old plays the hand-made ones as before.

### How a capture becomes a clip (`tools/mocap3d/retarget.py`)

1. Read the CMU skeleton and motion (`cmu.py`).
2. Give each of our bones the actor's world turn.
3. Shins and forearms swing only (hinges).
4. The hips go where the actor's pelvis went, scaled by leg length.
5. Each ankle is put where the actor's ankle went (two-bone IK) and pinned while planted.
6. Loops: find the cycle, take the travel out (the game moves the man), close the seam.
7. Resample to 30 fps. Measure the moments the game needs (contact, ball spot, root motion, touches, foot plants) and write them into the file as `clips[name]`.

The retarget is driven by a bone-name table, so a new skeleton is config, not code. See "A new body" in `tools/mocap3d/README.md`.

### Load-time fixes

When `lib/star/three3d/footballAnims.ts` loads the mocap file it fixes it once: `levelMocapHeads` takes the sideways head tilt out of the standing and moving loops, and `uprightRunPosture` (`lib/star/three3d/runPosture.ts`) brings the neck up, lowers the shoulders and sets the running arms. Test: `tests/star/runPosture.mts`.

### Add a clip, step by step

1. **Pick the capture.** Browse mocap.cs.cmu.edu by subject. A trial is `SS_TT` (subject, trial). Note the seconds you want.
2. **Add an entry** to `CLIPS` in `tools/mocap3d/clipdefs.py`. Fields are listed at the top of `tools/mocap3d/make.py` (`trial`, `cut`, `loop`, `mirror`, `moments`, `end`, `inplace`, `hold`, `src_edit`, `adapted`). If the capture needs a small change, write a `src_edit` helper there (`arms_up` is a good model) and set `adapted="what you changed"`.
3. **Fetch and build.** `python3 tools/mocap3d/fetch.py --out /tmp/cmu` then `python3 tools/mocap3d/build.py --cmu /tmp/cmu`. Python 3 and numpy only. It writes both GLBs and packs them. It prints FOOT SLIDE per clip.
4. **Look at it.** `python3 tools/mocap3d/look.py ...` (command in the README) renders the clip on the real body.
5. **Credit it.** Add the trial to `public/star/anims3d/LICENSE-mocap.txt` and the list in `tools/mocap3d/README.md`.
6. **Play it** (next sections).
7. **Check it** frame by frame (below).

For a clip with no capture, key it by hand in `tools/mocap3d/keyed.py` (keeper dives are the model) or in `tools/anims3d/clips.py` for the old set.

### Play a clip in a scene

- People3d bodies: `const g = await loadAnims3d(loader, "football")`, then `addClips(T, person, g)`, then `new ClipPlayer(T, person.mixer, person.actions).play("name", { once: true, onEnd })`. `clipInfo(g, "name")` gives `contact`, `ball`, `end`, `plants`. The big comment at the top of `lib/star/three3d/footballAnims.ts` lists every football clip and its timings.
- The 3D drills pick moves in `lib/star/play3d/scene.ts` (search for `celebrate_fist`).
- Gait (idle / walk / jog / run / sprint on a stick): `lib/star/three3d/gait.ts` and `lib/star/three3d/gaitBlend.ts`. Motion: Old skips all of it (check `motionLook()`).
- Cut scenes ask for a clip by a short name; `lib/star/cutscene/presets/clips.ts` (`CLIP_ALIASES`) maps the name to the real clip, with stand-ins in order. The first clip the body has wins.
- Every clip you add must also work on the old footballer (`mocap-ual.glb`) or the scene must fall back.

### Check it frame by frame

The build machine draws 1 to 5 seconds a frame, so a real-time clip stutters. Freeze the clock instead:

```bash
node scripts/film/frames3d.mjs "http://localhost:PORT/star-style-dev?style=mix&scene=play3d&demo=dribble-shoot&clean=1" --out /abs/frames/play
python3 scripts/film/frames3d_encode.py /abs/frames/play /abs/out/play.mp4 --every 6
```

The tool calls `window.__frameStep.seek(t)`, screenshots, steps 1/30 s. It is resumable. Open the contact sheet before you trust the video. `scripts/film/README.md` has every option and the scripted-input format. For people on the bench page use `window.__people.hold(t)`.

### Worked example: add a celebration clip

Goal: a knee-slide-free "arms wide, spin" celebration called `celebrate_spin`.

1. Find a CMU trial of someone turning with arms out. Say it is `16_02`, seconds 0.5 to 3.0.
2. In `tools/mocap3d/clipdefs.py`, next to `celebrate_airplane`, add:
   `"celebrate_spin": dict(trial="16_02", cut=(0.5, 3.0), inplace=True, hold=0.3),`
   If the arms are low, add `src_edit=arms_wide(0.3, 0.6, 2.0, 2.6)` and `adapted="a real turn with the arms held out"`.
3. `python3 tools/mocap3d/fetch.py --out /tmp/cmu && python3 tools/mocap3d/build.py --cmu /tmp/cmu`. Read the FOOT SLIDE line. Under a few cm is good.
4. Add the trial to `public/star/anims3d/LICENSE-mocap.txt`.
5. Make cut scenes able to ask for it. In `lib/star/cutscene/presets/clips.ts` add
   `"celebrate-spin": [{ clip: "celebrate_spin" }, { clip: "celebrate_fist" }, { clip: "celebrate" }],`
   so a body without the clip still celebrates.
6. For a 3D drill, return it from the `celebrate` case in `lib/star/play3d/scene.ts`, and add its length to the one-shot handling beside `celebrate_fist`.
7. Run `node scripts/run-star-tests.mjs cutscene play3d runPosture` and `npx tsc --noEmit`.
8. Film it: `frames3d.mjs` on `/star-style-dev?scene=director&fixture=goal&clean=1`, encode, look at the sheet.
9. If your new clip is a run or walk loop, add its name to `RUN_POSTURE_CLIPS` in `lib/star/three3d/runPosture.ts`.

---

## 4. Models, step by step

### The Higgsfield route (picture to 3D)

Every generated shop item (6 cars, bike, jet, 9 homes, watches, jewellery, 7 boots, KIB can) and the three new test bodies were made this way.

1. **Picture.** Higgsfield `generate_image` with the model `gpt_image_2_5`. Ask for a plain, unbranded, centred subject on a clean background. For a body: a neutral standing pose. **No real brands, logos, badges, plates or real faces.**
2. **3D.** Higgsfield `generate_3d` with `image_to_3d` (Tripo H3.1; run `models_explore(type:'3d')` for the current id). Use `get_cost:true` first. A model costs about 9 to 12 credits.
3. **Whose account?** One shared account: Harry's Higgsfield, connected in Leo's and Mikey's claude.ai too. So credits are shared.
   - Check the balance first (Higgsfield `balance` tool). **Keep a floor of about 60 credits.** Below that, stop and ask Harry.
   - Rule of thumb: about 9 to 12 credits per 3D model, about 0.5 per concept picture. Use `get_cost:true` to preflight.
   - Put the cost in the commit message, e.g. `Higgsfield: 9.25 credits`.
   - Log each model in the folder's `LICENSE.txt` as Higgsfield-generated (step 6).
   - Do not pay twice for the same picture: keep the picture and the raw GLB (see `tools/models3d/examples/hf-car`).
4. **Prep.** `tools/models3d/prep.mjs raw.glb out.glb 24000` welds, simplifies to the triangle limit and shrinks textures to 1024 px. Cars also go through `tools/models3d/deplate.mjs` (paints out invented number plates). `info.mjs` shows the result. Read `tools/models3d/README.md`.
5. **Pack.** Add a `POLICY` line in `scripts/perf3d/shrink-models.mjs` (shop items copy the existing `{ q: /.*/, webp: true }`), then run it: `node scripts/perf3d/shrink-models.mjs star/shop3d/items/your-file.glb`.
6. **Licence.** Add the file to the folder's `LICENSE.txt` (see the Higgsfield lines in `public/star/shop3d/LICENSE.txt`): what made it, no brands.
7. **Wire it in.** Shop: add the display and item in `lib/star/shop3d/catalogue.ts`, place it in `lib/star/shop3d/scene.ts`, and check it with `tests/star/shop3d.mts`. Garden: a piece in `lib/star/garden3d/scene.ts`. Load with `loadGltfCached` and `withMeshopt`.

### Limits

- At most 25,000 triangles per model. Cars and boots land near 22 to 24k. People are lighter.
- Textures at most 1024 px.
- About 400 KB a file after packing. Check with `ls -l`.
- Shop look H rule: a showpiece must not add draw calls. See "lighter showpieces" in recent changes.
- `tests/star/assets3d.mts` and `lib/star/assets3dManifest.ts` list the 3D files; keep them in step.

### A new body (a person, not a prop)

The body must be fitted to the game skeleton or the clips will not play on it. `tools/modeltest/fit.py` does this (read its README): scale to the MakeHuman crotch height, find the joints in the mesh, weight, bend into the MakeHuman rest pose, move the bone heads onto his joints, export. `tools/modeltest/addclips.mjs` copies the mocap clips on by bone name. The three test bodies c1, c2, c3 and everything they came from are in `tools/modeltest`.

---

## 5. Rules that bite

1. **Every new look gets a toggle: New | Old. Old stays playable and frozen.** New is the default once Harry says it is settled. Add the row to `LOOK_ROWS` and `PREVIEW_ROWS` in `lib/star/gameVersions.ts`. New things go in Preview first. `tests/star/gameVersions.mts` checks it. Never restyle `sceneOld.ts` or `components/star/legacy/`. Never delete an old option unasked.
2. **ONE ENGINE.** Every screen that plays 2D football runs the real match through `EnginePlay` (`components/star/EnginePlay.tsx`). Read `.claude/skills/one-engine/SKILL.md`. `scripts/one-engine-guard.mjs` runs inside `npm run build` and blocks the deploy. Never add to `KNOWN_COPIES`, raise `CEILING`, touch the canary, or remove the guard.
3. **The 3D exception.** Fully 3D games (move around, touch, keep-ups, headers, volleys, Free Roam, the dribble run) have their OWN physics and rules in `lib/star/play3d`. They never import from or change `lib/star/canvasEngine.ts`. Shared basics (ball size, gravity, how skills scale a kick) come from the one shared file `lib/star/play3d/constants.ts`. The 3D view of the real match is not an exception: it only draws (section 2, engineFrame).
4. **Speed.** Do not add realtime lights or extra shadow-casting lights. Use the governor and the quality tiers. Draw nothing twice. Check one scene once, with the frame meter, and judge feel on a phone. Do not spend hours on software-GL timing.
5. **No real brands.** No real logos, badges, number plates, boot stripes or club crests in generated models, textures, LED boards or signs. Invented brands only. Say so in the LICENSE line.
6. **Playtest.** After any change to `lib/star/**`, `components/star/**` or `app/star-dev/**`, run the `star-playtest` agent (`.claude/agents/star-playtest.md`).
7. **Shared collision files.** `app/star-dev/page.tsx` (the phase machine), `lib/star/types.ts`, `lib/star/tuning.ts`, `lib/star/gameVersions.ts`, `lib/adminGuides.ts`, `scripts/perf3d/shrink-models.mjs` and `CLAUDE.md` are edited by everyone. Keep edits there small and additive: one new phase, one new row, one new POLICY line. Never refactor them alone.
8. **Never tell Harry to `git pull` or `git checkout` locally.** Give a link or paste the file.
9. **Changes to the match engine file** `lib/star/canvasEngine.ts` fire a warning hook. Say so in your reply, run `node scripts/run-star-tests.mjs finishing keeper aiming outcomes`, and playtest.
10. **Admin pages** carry a page guide. If you change a button or a save on one, load `.claude/skills/admin-page-guide/SKILL.md`.

---

## 6. Staying up to date

Harry deploys to `main` at every major update. Your branch (Leo or Mikey) must start from it.

Before you start, every time:

```bash
git fetch origin main
git merge origin/main
```

If it conflicts in a shared file (section 5, rule 7), keep both sides' additions.

Then:

1. Read "Recent changes" below.
2. Run the 3D tests for what you will touch:

```bash
node scripts/run-star-tests.mjs perf3d play3d orbitCam practiceCam runPosture shop3d cutscene gameVersions assets3d
npx tsc --noEmit
```

   `node scripts/run-star-tests.mjs <words>` runs only test files whose name contains any word. Without words it runs all of `tests/star` four at a time.
3. Open the test page for your area (section 1) and look at it before you change it.
4. Check the paths in this page still exist: `node scripts/check-handbook-paths.mjs`.

Your session is a cloud container that clones the repo. **Anything only in your scratch folder is lost.** Commit sources (scripts, concept pictures, raw GLBs) under `tools/<area>/` with a README. Keep intermediate renders and logs out.

---

## 7. Recent changes (9 Oct 2026)

What landed today on Harry, newest first, one line each.

- 3D drill controls round 3: Free Roam play camera, Call for it (phone button, PC F), Two Touch's stick moved to a small corner nudge stick on phones.

- Merge: running arms. Elbows bent 80 to 100 degrees, back hand beside the hip, front hand up to the chest, relaxed hands.
- 3D drill cameras: the practice-arena camera, phone and PC control schemes, the Two Touch skill.
- 3D pace: speeds scale with the pace stat (sprint 5.6 to 8.2 m/s), stamina from fitness, a Pace Sprint drill, an upright running neck, a Back pill.
- Shop look H: every shop item is a generated model (cars, bike, jet, 9 homes, watches, jewellery, 7 boots, KIB can) with sharp price tags; lighter showpieces so the shop draws no more triangles; no invented number plates.
- 3D governor in every scene; frame meter gains shadow, skinned, post and JS counts.
- Casino look New: golden-hour room, shadows, crystal chandeliers, camera limit.
- Dribble runs 3D: the Free Roam look for a dribble run in a career match, same waves and result as the duel.
- Match view 3D: the career match drawn in 3D (Golden hour). On in Preview, Off in Standard and Classic. New 3D camera and player light behind New | Old toggles.
- 3D walk, jog, run, sprint on the stick; Free Roam stamina bar; loops at their feet's speed on the same foot.
- Free Roam keeper no longer unstoppable (real dive speed, reach and read).
- Look H: baked light for stadium, garden and shop; a broadcast colour grade (3D LUT); the look-tuner; Day and Night brought up to Golden hour's quality.
- Human body: repainted face skin, clean seams, real football boots, the fitted shape offsets kept (`tools/human3d/fit_a.npz`).
- Mocap: keyed keeper dives, tackles and knee slide (`tools/mocap3d/keyed.py`), new clip defs, keeper dive grows from his set position, one-shot celebrations.
- Cut-scene system: film rules, close-ups, real grass plates, the people layer (`lib/star/cutscene`), The Icon speaks.
- Real game in 3D on the Style Testing page: "same brain, new camera" (`lib/star/engineFrame.ts`, `lib/star/style3d/engineView.ts`).
- Rescued into the repo: `tools/styletest` (look test for cel / Spider-Verse / stylised PBR), `tools/modeltest` (three generated stylised bodies, concept pictures, raw and fitted GLBs), `tools/models3d` (picture to game-ready GLB tools), this handbook and `.claude/skills/3d-building`.

## Handover (9 Oct) → Leo

### Home + title screen

Harry's three asks (9 Oct 2026, New UI Home and title):
1. "I think we just need the players to look really fun and good."
2. "remove the goal or make it actually be facing the right way (goals in the middle of the pitch)."
3. "make the rep/fame + goals and assists and the cans more prominent."

Done (behind Settings → Look → "Home screen: New | Old", default New; Old is exactly the screens as they were; `lib/star/homeLook.ts`, row `homeScreen` in `lib/star/gameVersions.ts`):
- Home, New: four big tiles under Next match (Rep, Fame, Goals, Assists this season), each with a 3D icon and a big number (`StatTiles` in `components/star/HomeHub.tsx`).
- The goal behind him is gone (ask 2: removed, it read better than turning it). The stadium picture still lines up on the same marker, so the set does not move.
- He stands centre stage, taller (up to 360 px, was 290), in a club-coloured glow with a pool of light and a gentle bob.
- Cans: bigger ×N counts and names (`CanTile` `bold` prop).
- Title, New: the same hook, with the glow, light pool and bob. Little else changes there.
- Checked at 390×844 signed out: no page errors, no sideways scroll. tsc, the one-engine guard and `gameVersions.mts` pass.

Left:
- Ask 1 is only half done: he is the same figure, just lit and moving. The fun look needs the Style A body.
- Not checked on a short phone (360×640). The height maths has a floor, but nobody has looked.
- No star-playtest run.

The player-render hook: `HomePlayerFigure` in `components/star/HomePlayer.tsx`. Both screens give it a box (width × height, boots on the bottom edge) and never draw him themselves. Put the Style A render in that one function and keep the same box; neither screen's layout changes. Old look does not use it.

### Drill cameras / Free Roam

Harry, after playing it on his phone: "Free Roam camera is still bad, Headers & Volleys is amazing, make it more dynamic, ask for the ball, the joystick gets in the way in Two Touch".

**Done (built, tested headless, seen in stills at 390×844; not yet judged on a real phone):**

- **Free Roam camera = PLAY mode** (`lib/star/three3d/practiceCam.ts`, `PLAY` constants; turned on by Free Roam's `frame` returning `play` in `lib/star/play3d/drills.ts`; passed through `lib/star/play3d/scene.ts`).
  - With the ball: tight behind your shoulder (1.9 m up, 3.7 m back), swings fully to goal.
  - Ball away (pass, loose ball, shot): turns towards the ball, aiming between ball and goal when both fit, never more than 70° off the goal; pulls back and rises with distance (up to 6 m up, 9 m back at 30 m).
  - Leads your run by sliding ahead (0.5 s of your run, max 3.2 m), never by turning, so the stick still never turns it.
  - All blends eased and rate-capped (`PLAY_EASE`, `PLAY_RATE`); turn still capped at 60°/s.
  - Measured (bot playing Free Roam, 6 × 60 s, phone frustum): ball in frame 61% → 83%; ball in frame while away from you 50% → 82%; goal in frame 97% → 58% overall, 97% → 93% once you have had the ball 1.5 s.
- **Call for it** (`World.callForBall` in `lib/star/play3d/world.ts`, action `{ kind: "call" }`; support brain in `brains.ts` reads `mind.callUntil`).
  - Phone: round CALL button top-right of the picture. PC: F (E is peek, Space is tap). In the hints.
  - The mate on the ball (or the one a pass is going to, or the first to a loose ball) plays you a pass weighted to your run (`World.passBall`) if the lane is open and you are within 36 m. Else ✗ with a reason ("No lane", "Too far", "Keeper's ball", "Their ball") and he shakes his head (`scene.ts`, head bone).
  - Bubble "HERE! ✓/✗" over you, ✓/✗ + reason over him. Cooldown 2.5 s, drawn on the button.
  - Not in Two Touch: there he always sends it back on his second touch, so a call changes nothing.
- **Two Touch stick** (`components/star/Play3D.tsx`, session `stick: "corner"`): on a phone no stick appears under the thumb. Whole screen = tap/swipe. A small nudge stick (60% size, 40% opacity) sits bottom-left only (`CORNER_STICK`). A tap within 70 px of the ball is always the touch (`BALL_GUARD_PX`, uses the new `ballScreen()` on the scene controller); a quick tap on the corner stick is also a touch.
- Tests: `tests/star/practiceCam.mts` sections 11 (Free Roam framing, before vs after) and 12 (call: open lane 30/30 yes and passed; keeper in the lane = "No lane" and he keeps it; cooldown).

**Half-done / not checked:**

- Look and feel on a phone: this machine draws at 0–1 fps, so the stills could not catch the camera mid-turn to a team-mate or a shot in flight (still 2 shows the ball still off to the left). Harry has to judge it on his phone.
- Goal in frame drops while the ball is away (58% overall). That is the trade for following the ball; tune `PLAY.ballTurn`, `PLAY.bothFit`, `PLAY.maxDev` in `lib/star/three3d/practiceCam.ts` if he wants more goal.
- The call answer label over an off-screen mate is clamped to the edge and can sit next to "HERE!" (`Play3D.tsx`, call bubbles).

**Next 3 steps, in order:**

1. Harry plays Free Roam on his phone; tune the `PLAY` numbers from what he says (re-run `node scripts/run-star-tests.mjs practiceCam` for the before/after numbers).
2. If he likes it, give Wembley's chase camera the same play mode (`camera: "practice"` + `play` in its `frame`), or keep its chase camera.
3. Two Touch: if the corner nudge stick is never used, drop it (set `stick` to a new "none" option in `Play3D.tsx`).

Stills from this round: the session scratchpad `r3fr/` (sheet.jpg).
