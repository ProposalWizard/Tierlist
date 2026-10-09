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
| Your house (wardrobe and mirror, trophy cabinet, cars out of the window) | `components/star/Home3D.tsx` | `lib/star/home3d/scene.ts` (room presets `homes.ts`, outfits `outfits.ts`, the body `wear.ts`, trophies `trophies.ts`, textures `textures.ts`) | `/star-home3d-dev` (`?tier=starter\|flat\|penthouse\|house\|villa\|estate`, `?look=h\|old`, `?trophies=0`) | none (a new place; its two ways in in a career are one switch, `lib/star/home3d/flag.ts`) |
| Shop | `components/star/Shop3D.tsx` | `lib/star/shop3d/scene.ts`, items in `lib/star/shop3d/catalogue.ts` | `/star-shop3d-dev` | 3D shop player (`lib/star/signing3d.ts`); 3D look H |
| Casino | `components/star/Casino3D.tsx`, tables in `components/star/Casino3DTable.tsx` | `lib/star/casino3d/scene.ts` | `/star-garden3d-dev` (has a Casino tab) | Casino: 3D / Classic (`lib/star/casino3d/look.ts`); Casino look: New / Old (`lib/star/casino3d/roomLook.ts`) |
| Signing scene | `components/star/SigningScene3D.tsx`, in a career via `components/star/SigningScene3DCareer.tsx` | `lib/star/signing3dScene.ts` (people: `lib/star/signing3dRig.ts`) | `/star-3d-area-dev/signing` | Signing scene: 3D / drawn (`lib/star/signing3d.ts`) |
| Manager's office | `components/star/Office3D.tsx` | `lib/star/signing3dScene.ts` with stage "office" | `/star-3d-area-dev/office` | Talk to your manager: 3D / Old (`lib/star/look3d.ts`) |
| Farewell: guard of honour, standing ovation | `components/star/Farewell.tsx` (the farewell screens) | `lib/star/farewell3d.ts` (guard of honour, plan in `lib/star/guardOfHonour.ts`), `lib/star/ovation3d.ts` | `/star-retirement-dev` | Standing ovation (`lib/star/ovationLook.ts`); Ovation greetings (`lib/star/ovationMoves.ts`) |
| Cut scenes (the director) | `components/star/CutsceneDirector.tsx` | `lib/star/cutscene/director.ts` (read `lib/star/cutscene/README.md`) | `/star-style-dev?scene=director&fixture=signing&clean=1` | Cut-scene people: New / Old (`lib/star/cutscene/look.ts`) |
| Cut-scene people bench (faces, hands, props) | page only | `lib/star/cutscene/peopleAdapter.ts` | `/star-people-dev` | same |
| Style test (five art looks, goal / signing / walk-out cut scenes, Free Roam, Real game) | `components/star/StyleTest3D.tsx` | `lib/star/style3d/` (`styles.ts`, `kit.ts`, `post.ts`, `cutscenes.ts`, `gameplay.ts`) | `/star-style-dev` (query: `style`, `scene`, `tod`, `tilt`, `view`, `seed`, `kinds`, `cam`, `plight`, `demo`, `clean=1`) | none (test page only) |
| Star Pass podium | `components/star/Podium3D.tsx` | spins a GLB from `tools/star-pass-art/export_live3d.py` | on the Star Pass screens | none |
| Style A people (every 3D person under Player style: New) | Settings → Your look (`components/star/YourLookPanel.tsx`); Home and title (`components/star/ToonHomePlayer.tsx` via `HomePlayerFigure`) | `lib/star/style3d/toon/` (shader, heads, builds, switch) through `lib/star/people3d.ts` | `/star-look-dev` (`?head=h1..h6`, `?body=c1..c3`, `?pstyle=old`) | Player style: New / Old (`lib/star/style3d/toon/look.ts`) |
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

### Style A: how to dress a person

Every 3D person goes through `makePerson3d` (`lib/star/people3d.ts`). Under
Settings → Look → "Player style: New" it builds a Style A person; under Old,
exactly today's bodies. You never pick a file yourself:

- `makePerson3d(T, SK, loadedPlayer, anims, { who: "<stable id>" })`: a seeded
  head (face + haircut, `toon-p1..p6`), build (Slim / Strong / Tall, a scale,
  `TOON_BUILD_SCALE`), and you pass `skin`/`hair` to `dressPerson3d` from
  `toonSkinFor(id)` / `toonHairFor(id)` (`lib/star/style3d/toon/bodies.ts`).
  The same id is the same man every time.
- `{ you: true }`: your own look from Settings → Your look (`CareerState.player.head3d`,
  `body3d`, `skinTone`, `hairColour`; the page calls `setToonYou`).
- Managers, staff, presenters: `{ suit: true }` (or role "manager", or a
  cut-scene outfit that is not a kit) → a suit head (`toon-mgr`, `toon-mgr2`),
  greyer hair (`toonGreyHairFor`).
- Kit: `dressPerson3d(..., { kit: { shirt, trim, shorts?, socks? }, number, badge })`.
  `toonKitColours` maps it onto the textured kit (base, trim on collar/cuffs/sock
  tops, number on the back, badge, socks, boots). Settle clashes first with
  `kitsFor` (`lib/star/kits.ts`); Style A paints what it is given.
- Hands: the standing idles get relaxed arms baked per person
  (`relaxIdleArms` in `lib/star/three3d/runPosture.ts`, the same file as the
  running arms' wrist step `relaxWrist`), and the fingers rest curled
  (`RELAXED_FINGERS_DEG`; `relaxHands` uses it for Style A). Hands are scaled
  0.88 (`TOON_LOOK_DEFAULT.hands`).
- A scene that keeps spare bodies bins them by `p.toonHead` and sets the build
  with `setToonBuild(p, body)` (see `engineView.ts`).
- Only one person on screen (Home, title)? `loadToonHead(loader, head)` fetches
  one head file instead of all eight.
- A new head: concept picture → Higgsfield image-to-3D (Tripo H3.1, face limit
  15000) → `tools/modeltest/fit.py` → `scripts/people3d/build_toon_bodies.py <dir>
  tag:dir/fit.glb[:suit]` (it also weights the fingers: `weight_fingers`) →
  a POLICY line + `node scripts/perf3d/shrink-models.mjs` → `TOON_FILES` and
  `TOON_HEADS` in `bodies.ts` → `node scripts/assets3d-manifest.mjs`.
  Inputs live in `tools/modeltest/` (one folder per tag).

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
- The governor: `lib/star/three3d/governor.ts` (the rule: steps down if the middle frame is over ~22 ms for 2.5 s, but only to rung 2; rungs 3–4 need under 30 fps for 5 s; back up after 8 s; one-off long frames and the 1 s after `hush()` — a chance start or camera cut — are not judged) and `lib/star/three3d/governThree.ts` (what a rung does: pixel ratio, shadows, post). A phone opens on Medium and stays there while it keeps up. Call `governScene(...)` once and `g.frame(now)` each drawn frame. Add `?gov=0` to any page to switch stepping off while you measure one tier.
- The frame meter: `lib/star/three3d/frameMeter.ts`. Shows fps, worst frame, draw calls, triangles, shadow and skinned draws, post passes, JS ms, tier and rung. Add `?fps=1` to any page (`?fps=0` hides it; admins and testers see it anyway). The numbers are also on `window.__frame3d`.
- The build machine has NO graphics chip. Frame times here are 10 to 100 times a phone's. Read percentages, never milliseconds. A phone is the only true judge.
- `scripts/perf3d` measures a scene without Next (read its README).
- **Speed pass 2 (9 Oct 2026): same picture, less work.** Each saving has a switch so a before/after still can be taken:
  - Shadow cache: `lib/star/three3d/shadowCache.ts`. Still things go into the shadow map once; only movers are drawn on top each frame. People cast from a lighter "shadow body". Off: `?shadowcache=0`, `?shadowbody=0`.
  - Lights only where they reach: `lib/star/three3d/lightReach.ts`. A dark light leaves the shader; far materials skip the lamp loop. Off: `?lightreach=0`.
  - Off-screen people are not drawn: `lib/star/three3d/cullPeople.ts` (`cullSkinned`). Off: `?cullpeople=0`.
  - Packed pictures: `lib/star/three3d/ktx2.ts` (`loadPicture3d`) tries a `.ktx2` beside the WebP and falls back on any failure. Make them with `scripts/perf3d/ktx2-textures.mjs`. Transcoder: `public/star/three/basis`. Off: `?ktx2=0`.
  - Baked light: `lib/star/look/bakedLight.ts`, sets in `tools/bake3d/sets` (stadium, garden, shop, casino). Off: `?bake=0`. **Patch it at build time with `bakedLightNow`** (lag pass 3): its pictures arrive later and switch it on by a uniform. Patching when they arrived built every lit shader twice, the second time mid-play.
  - Proof: `node scripts/perf3d/proof.mjs <garden|shop|casino|career|cut> '{...}' --split --out=DIR` gives a before and after still and the counters.

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


- Your house in 3D: one parametric room in six presets from the home you own (starter flat → estate), a wardrobe with a full-length mirror (casual sets, home/away kit, boots; saved as `CareerState.outfit`; the garden and shop show the casual set, training always the kit), a trophy cabinet from your real trophies and awards ("Win it to fill this"), your cars on the drive (light copies in `public/star/home3d`, `tools/home3d/make_lods.mjs`). Ways in: the garden's house door and the phone's "Your house" app.
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


---


### Your house (the 3D home)

Harry's idea, in his words: *"imagine you actually had your current house with all your stuff and that's where you change clothes."*

**Done.**
- The room: `lib/star/home3d/scene.ts`, one parametric room. Six presets in `lib/star/home3d/homes.ts`, picked by the best home you own in the shop (`homeTierOf`): starter flat (nothing bought), flat, penthouse, house, villa, estate. Size, floor, panelling, metal trim, chandelier, plants, cabinet size, drive size and the window view grow with the tier.
- The wardrobe and mirror: rails of casual sets (hoodie and joggers, tee and jeans, shirt and chinos, club tracksuit, smart coat), your home and away kits, plain or your own boots. Tap it, pick, he changes and you see him in a live full-length mirror (a `Reflector` on its own layer, on only near the wardrobe; off on Low). Saved as `CareerState.outfit` (`lib/star/types.ts`, optional). `wornAt` (`lib/star/home3d/outfits.ts`) says what to wear where: the garden and the 3D shop show the casual set, training always the kit.
- The trophy cabinet: `lib/star/home3d/trophies.ts` reads `trophies`, `awards` and `ballonDorWins`, counts each win once, and fills the empty spots with the big targets ("Win it to fill this"). Trophies are stylised shapes made in code, no real ones.
- The drive window: your cars (best first, as many as the preset's drive holds) from light copies of the shop's generated models (`public/star/home3d/*-lod.glb`, made by `tools/home3d/make_lods.mjs`, packed by `scripts/perf3d/shrink-models.mjs`). No Higgsfield credits spent.
- Ways in: the garden's house door on the east boundary (`lib/star/garden3d/scene.ts`, `HOUSE`), the phone's "Your house" app (on the phone from day one, `STARTER_APPS`), phase `home-3d` in `app/star-dev/page.tsx`. Both are behind one switch, `lib/star/home3d/flag.ts` (`HOME3D_IN_CAREER`, now true).
- Speed at Medium on this machine: 37 to 63 draws, 30k to 92k triangles (limit 120 draws, 150k). No baked light file for the room yet (`enhanceH(..., { bake: null })`): one hemisphere and one sun, as the shop has, no extra lights; the sun's shadow is redrawn only when something moves.
- Tests: `tests/star/home3d.mts` (tier to preset, trophies from a career, outfit saving, the drive).

**Half-done or not seen.**
- Style A (Player style New, 9 Oct, later): casual outfits now use your own toon head and body too (`lib/star/home3d/wear.ts` `paintCasualToon`: the toon shader's long-sleeve "suit" paint, coloured from the set). Seen in the mirror (hoodie, coat) and the garden (`/star-garden3d-dev?outfit=tracksuit`). Rough edges: the forearms read a shade darker than the top, a little skin shows at the elbows, and a thin red line sits at the collar. Player style Old keeps the human outfits.
- The Style A hook: `setWearerBody(fn)` in `lib/star/home3d/wear.ts`. Style A's bodies drop in there and only there. The casual clothes are the human body's own outfits (`lib/star/human3d/human.ts`); a Style A body needs the same outfit parts or paints its clothes from each set's `colours`.
- Seen on the test page (390×844, software GL): the house room, the wardrobe card, the coat and the tee in the mirror, the full cabinet, the drive window. Not seen: the starter, villa and estate rooms and the empty cabinet on screen (stills were cut short; `tests/star/home3d.mts` checks their presets); the house opened from a real career; a phone; the casual set in the garden and shop on screen.

**Next 3 steps, in order.**
1. Play a career to the garden, walk through the house door, change into the coat, walk back out: check the garden and the shop show the coat and the save keeps it.
2. Judge it on a phone: the mirror's frame rate and the wardrobe camera (`shotOf` in `scene.ts`).
3. When Style A lands, register its body with `setWearerBody` and refit the casual sets.

**How to see it.** `/star-home3d-dev?tier=villa` (buttons switch the tier and empty/full cabinet; `?fps=1` for the meter, `?look=old` without Look H). In a career: Garden → the door at the right-hand boundary, or the phone's "Your house".

### 3D speed pass 2 (lag pass 2)

Harry's rule: "I don't want our solution to bad lag to just be make the game look worse, let's be more innovative than that." Same picture, less work. A still frame must look the same or better.

His phone (before this pass): career 3D 43 fps, worst 516–586 ms, ~280 draws, 743–831k triangles (about 460k of them the players again in the shadow map), px 1.5, Medium. Cut scenes 160 shadow draws a frame. Garden 40 fps, 104 draws, 231k triangles, px 2.0. Shop 25 fps at px 2.0. Later on the same day: the governor fell to rung 4 at 60 fps because of one-off 500–730 ms stalls at each chance start.

Measured here (SwiftShader, 390×844, Medium, before → after, `scripts/perf3d/proof.mjs --split`):

| Place | Draws | Triangles | Shadow draws | Shadow triangles a frame | GPU picture MB |
|---|---|---|---|---|---|
| Career 3D | 98 → 80 | 946k → 512k | 17 → 11 | 232k → 46k | 56 → 58 |
| Cut scene (trophy) | 117 → 81 | 288k → 182k | 43 → 7 | 127k → 22k | – |
| Garden | 145 → 145 | 192k → 198k | 0 → 0 | – | 86 → 74 |
| Shop | 70 → 78 | 56k → 55k | 0.8 → 3 | – | 292 → 288 |
| Casino | 58 → 58 | 86k → 86k | 0 → 0 | – | 71 → 72 |

Governor, a simulated 3-minute match with Harry's stall pattern: before rung 1 → 2 → 3 → 4 → back; after 1 → 2 → 1 (`tests/star/perf3d.mts` keeps it).

Done:
- Shadow cache with shadow bodies (all places through `governScene` and the real game). Test: a still frame never redraws the kept map (`tests/star/shadowCache.mts`).
- Lights only where they reach (`lib/star/three3d/lightReach.ts`).
- Off-screen men culled in the real game, the garden bench (both paths) and the training pitch.
- KTX2 for 13 big colour maps, with WebP fallback.
- Baked shade in the casino (`public/star/bake/casino`); the garden and shop already had theirs.
- Governor: stalls and the 1 s after a chance start or cut are ignored; never below rung 2 from a stall; climbs after 8 s; re-climbs a minute after a bounce. `engineView.ts` calls `gov.hush()` on every chance cut.

Half-done:
- The shop got WORSE on draws (70 → 78) and shadow draws (0.8 → 3): the shop already drew its shadows only when something moved (`carSpot.shadow.autoUpdate = false`), and the cache's copy-back + mover overlay runs on those frames. Fix in `lib/star/three3d/shadowCache.ts`, `sm.render`: for a light with `shadow.autoUpdate === false`, skip the cache (pass straight to three) — or leave the shop out of `installShadowCache`.
- KTX2 downloads are bigger than the WebPs (2.0 MB vs 1.1 MB for the 13 files; ETC1S quality 255). The career set showed no GPU saving on SwiftShader (it transcodes to plain RGBA there). Check on an iPhone with `?fps=1`; if no gain, lower `QUALITY` in `scripts/perf3d/ktx2-textures.mjs` or drop the skies from `KTX2_FILES` in `lib/star/three3d/ktx2.ts`.
- The chance-start stalls themselves are hidden from the governor, not removed. Time them with `M.switchChance()` in `scripts/perf3d/entry.ts` (`window.__M.vf` holds ms per `frame()` call). Suspects: a new 256×256 number texture per new man (`numberTex` in `engineView.ts`, uploaded on first draw), `h.dressPeople` on new bodies, the shadow cache redrawing the stadium when the shadow box moves at a cut.

Not done:
- Far-tree impostors in the garden. Measured: the 82 far trees are 29k triangles in 14 draws, and they stand 23–32 m out, a few hundred pixels tall on a phone. A picture card that size would look softer, which breaks Harry's rule. Left out on purpose.
- Dropping decorative realtime lights: none was dropped. The lamps light real things; `lightReach.ts` already removes their cost on far materials (garden: 72 of 121 lit materials skip them).

Next 3 steps, in order:
1. Fix the shop regression (above) and re-run `proof.mjs shop --split`.
2. Kill the chance-start stall: cache number textures per shirt number and `renderer.initTexture` them while the chance plays; pre-dress the next chance's spares.
3. Check KTX2 on an iPhone (GPU memory and load time); keep or trim the list.

How to measure: `?fps=1` on any page shows the frame meter (fps, worst frame, draws, triangles, shadow draws, rung); the numbers are on `window.__frame3d`. `?gov=0` stops the governor stepping so one tier can be measured. Off switches for each saving are listed under "Quality, the governor and the frame meter".

### 3D lag pass 3 (9 Oct, late)

Harry: "pleaseee try and bug fix all lag issues otherwise we can't even test." Same rule: same picture, less work.

Measured on this machine (SwiftShader, 390×844, Medium; percentages only). Harness: `scripts/perf3d` (`M.switchChance(kind)` now reuses CanvasMatch's own names, "mate0", "def3"…, and turns the camera for corners; `M.switchChance(kind, true)` is the old all-new-men worst case).

| What | Before | After |
|---|---|---|
| Career 3D GPU memory, px 1.5 (textures + render buffers) | 149 MB (107 MB when look H loads before the first frame) | 72 MB |
| Shaders built by the career 3D view | 45, 10 of them after 20 s of play | 35, all in the first 17 s |
| Shaders built at the first chance start | 3 | 1 |

Done:
- **The baked light is patched when the place is built** (`bakedLightNow`, `lib/star/look/bakedLight.ts`; used by look H and `enhanceH`). Before, it patched every lit material when its pictures arrived, 3–20 s in: every shader in the stadium (or garden, shop, casino) was built a second time in the middle of play. Now it is built once, and the pictures switch it on by a uniform. A new man gets the bake in `dressPeople`, before his first draw.
- **Style A's colour map at match size** (`matchSizedMap`, `engineView.ts`). Each head's 1024² map is 5.6 MB on the GPU; six heads = 34 MB. A man on the match camera is at most ~120 px tall, so the GPU only reads the 128 px level: a 512 copy draws the same picture. The loaded file is untouched (the garden, shop and close-ups share it). The match loads the six player heads only, not the suits.
- **The kit's post pictures freed under look H** (`StylePost.release`, `kit.setActive(false)`). The kit draws the few seconds before look H arrives, and its full-screen 4× MSAA picture and depth (34 MB at px 1.5) stayed all match.
- **One number texture per shirt number**, uploaded at load (`numberTex`). Each man used to paint and upload his own when he first appeared, often several at a chance start.
- **Spare bodies for the heads the match will really ask for** (`LIKELY_SIDS`, `engineView.ts`). Spares were dealt round the six heads in turn, so a chance whose new men shared a head built the rest on the spot. Now they are built for "you", "keeper", "follower", def0–9, mate0–9, run0… in order.
- **Freed on leaving a match**: the sun's two kept shadow maps (`installShadowCache(...).forget(light)`, from look H's `dispose`) and the spares, which never reached the scene. The match renderer is shared, so these waited for the browser's own clean-up.
- No garbage each frame: `?bcam`/`?shadowcache` read once, not per man per frame; scratch vectors for the ball, the camera, the shop and house cameras.
- Test: `tests/star/bakedLightNow.mts` (patched at once, off until the pictures arrive, a missing set stays off, `forget` frees both maps).

Not done / still lags:
- **The 3D shop holds ~377 MB of pictures on this machine** (45 Higgsfield models, three 1024² maps each, all WebP, so uncompressed on the GPU). This is the biggest memory risk left on an iPhone. Fix without a softer picture: pack them as KTX2 inside the GLBs (`scripts/perf3d/ktx2-textures.mjs` only does loose pictures today), or load each model's maps only when its shelf is on screen.
- **The real game's chance start was not timed on this machine** past one run: the browser was killed by the machine's own memory limit (other sessions' servers), not by the page. One run that finished showed a 3.1 s long task at the first chance after a kick (SwiftShader). The profile of it is the next step: `/star-style-dev?scene=real`, play two chances, profile the switch.
- One shader still builds at the first corner (the corner flag / canopy material, double-sided). `warmUp(..., { includeHidden: true })` fixes it but builds 70 more unused shaders at load: not worth it.

Next 3 steps, in order:
1. Harry: a career match on the iPhone with `?fps=1`, Player style New. Look at "worst" across 10 chances and whether the 3D still drops to 2D.
2. Pack the shop's 45 models' maps as KTX2 (same picture; ~4× less GPU memory on iPhone).
3. Profile a real-game chance start on a quiet machine (CanvasMatch's `loadScenario` + the first 3D frame) and fix what the profile names.

### 2D shop

- **What:** a new 2D shop (Cans · Boots · Style) and a new Shop page. Settings → Look → "Shop: New | Old" (`lib/star/shopLook.ts`, row `shop2d` in `gameVersions.ts`), default New. Old = `components/star/Shop.tsx` + `ShopPage.tsx`, untouched.
- **Where:** `components/star/shop2d/` — `StoreShop.tsx` (the three tabs, item sheets with the level ladder, confirm sheet, purchase moment), `StoreLanding.tsx` (Home's Shop page), `parts.tsx` (hero, tabs, framed card, ladder, badges, sheets). Wired in `app/star-dev/page.tsx` (shop phases + the Shop swipe page).
- **Art:** Higgsfield UI dressing only (Harry: "I meant higgs for the UI"), 17 credits, in `public/star/shop2d/` (credits in its `LICENSE.txt`; packer `tools/shop2d/pack.py`). Item pictures are the existing `/shop/*.webp`, KIB can art and drawings — no new item art.
- **Kept:** every buy handler and price, boot sponsor 25%, banned boots via the black market (lawyers option in the confirm sheet), unlock chain locks, phone flash + `phone-tile` tour target, worn-out repair, "Sold out" per visit, focus from the 3D shop. New: Use a can from the Cans tab, "View in 3D shop" on items the 3D shop has (opens the 3D shop; it does not jump to the item).
- **Judge it:** `/star-dev/media-lab?shop=kib|boots|lifestyle|landing` (+ `&look=old`), buying works on a sample career.
- **Open:** Harry approved Cans and Boots; Style had one more pass (2-up cards, chunky group tabs, fame banner) — not yet re-judged. The basket stays off (`BASKET_ON`), so the new shop has no basket.

### 2D shop (Showroom + Feed)

- **What:** the New option of Settings → Look → "Shop: New | Old" is now the Showroom + Feed shop (Harry, 9 Oct: "showroom swipe + feed is definitely something"). One item fills the screen. Swipe left/right = items in a category (dots, tap a dot to jump); swipe up/down = the next category (Cans → Boots → Drip → Gadgets → Cars → Homes → Holiday; the rail at the top jumps). Back chip top-left; balance + fame chip top-right (tap it: the fame banner). Buy/Upgrade pinned at the bottom; tap the item for its sheet (level ladder, what you gain, View in 3D). PC: mouse drag, wheel/trackpad, arrow keys, side arrows.
- **Where:** `components/star/shop2d/ShowroomShop.tsx`, wired in `app/star-dev/page.tsx` (shop phases). Old is still `components/star/Shop.tsx`. The earlier card store (`StoreShop.tsx`) is only on the media-lab bench now (`&look=grid`).
- **Pictures:** `public/star/shop2d/items/*.webp` — 1440x1080 renders of the same Blender models as `/shop/*.webp`, no shadow floor (the page draws a soft contact shadow). Made by `tools/shop2d/render_big.py` (it sets `SHOP_RES`/`SHOP_NO_FLOOR` in `tools/blender-shop/scripts/studio.py`), about 40 s a picture on this machine. Not the Higgsfield GLBs: those are one model per family, so every level would show the same thing ("Rusty Moped" as a superbike). Missing still → the small picture. Test: `tests/star/showroomShop.mts`.
- **Kept:** every buy handler, price, sponsor 25%, black market + lawyers, Style locks, worn-out repair, sold out per visit, focus from the 3D shop, Use a can.
- **Judge it:** `/star-dev/media-lab?shop=kib|boots|lifestyle&cat=cars` (`&look=grid` = the card store, `&look=old` = the old shop).
- **Not built:** the live GLB turntable on the showing item (the GLBs don't change per level, and a second WebGL scene costs frames on phones).

### Career 3D camera + size

**Harry's feedback** (4 iPhone screenshots, Chelsea v Brentford, Match view 3D On): "have you even applied the camera and sizing changes to 3d? The animations are a bit wild and rough, dragging is having to be done off the pitch alot and players too big, angle too low etc. … also we need a 3d/2d toggle in game and a setting cog whilst match commentary is on."
What the shots showed: one chance drawn straight top-down with dot men (a side-on chance copying the 2D camera); you at the very bottom edge so the drag ran off the pitch; one camera close and low with three huge men and half the frame empty grass.

**Target rules**
- One angle for every chance kind: asked for 35–45°, then Harry after the 8% still: "the players and goalie could be even smaller and the camera a little bit higher still" → **48° (50° when it cuts empty stand)**. Never top-down, never at the grass. Corners and side-on chances use the same angle, turned.
- The ball (while you aim) at 55–65% of the height, so ≥ 25% of the canvas below it is pitch to drag on.
- Frame only the action: ball, you, the 2 nearest team-mates you can pass to (within 11 m across), the 2 nearest defenders, the keeper and goal when in range.
- A man at the ball a set share of the canvas height (measured through the camera), not a fixed 1.6×. Asked for ~10%; Harry chose 8%, then **6%** (players and keeper) after seeing it.
- Smooth: glide between chances, hold still while you aim, crossfaded clips, no walk/jog flicker, turns capped.

**Done** (all under Settings → Look → "3D camera: New"; Old is untouched)
- `lib/star/style3d/broadcastCam.ts`: the camera, pure (no three.js). `solveBroadcast`, `actionPoints`, `BROADCAST` numbers.
- `lib/star/style3d/engineView.ts`: `placeBroadcast` uses it for every facing; glide (~0.4 s), held while a finger is down / the arrow is up / the strike screen shows. Smooth playback: crossfades ≥ 0.24 s, a gait kept ≥ 0.35 s, turns ≤ 540°/s, steadier speed reading, a man who appears starts in the right pose. Ball drawn at the men's scale, capped 2×.
- `tests/star/broadcastCam.mts`: 13 kinds × 20 seeds at 390×844. Angle 48–50°; room below the ball 40–45%; at the 6% default the man is 6.0–6.2% of the height in all 260 (8% gave 8.0–8.3%, median 1.45× life size; 10% gave 9.4–10.5%, median 1.8×). The crossbar sits 7 / 13 / 34% down the screen (p10 / median / p90): close chances still show a band of stand above the goal. Seen in one still (one-on-one: 6.1%, 1.55× life size, 48°).
- In the match's stats bar, by the speaker: a **3D | 2D** switch (instant, the chance carries on; writes "Match view 3D") and a **⚙** that opens this phone's Settings over the match, the match held while open (`components/star/Match3DLayer.tsx`; `EngineFrameObserver.hold` / `.chrome` in `lib/star/engineFrame.ts`; CanvasMatch reads them, additive).
- Test page: `/star-style-dev?scene=real&cam=new&man=0.08|0.10|0.12` (size candidates), `&bcam=0` (the New camera as it was before, for before stills).

**Half-done**
- The size is 6% and the angle 48–50° (`BROADCAST.manShare`, `elevDeg`, `elevMaxDeg` in `lib/star/style3d/broadcastCam.ts`). The full 8 / 10 / 12% sheet over 4 chances was not finished (stopped at Harry's request): only one-on-one stills exist (today, 8%, 6%), in the round's scratch folder, not the repo.
- At 10% about 1 chance in 9 reached the 3.2× cap (`BROADCAST.kMax`); at 6% none does. Not yet judged on a phone.
- A small white dot sits on the grass just ahead of you in the one-on-one stills (before and after, so not from this change). Not traced.
- Close chances (ball 8–12 m out) keep up to a third of the screen as stand above the goal: with the ball held at 60% for the drag there is no room to bring the goal higher without making the men bigger than 10%.
- Not seen on a phone. Stills came from the Style Testing page's Real game (same engine view), not a career match.
- Smooth playback lives in `engineView.ts` behind `smooth()`; root motion was already pinned to the 2D record (no change); `ClipPlayer` (`lib/star/three3d/footballAnims.ts`) still drops the older clip if a new change arrives mid-fade.

**Next 3 steps**
1. Harry judges 6% / 48° on his phone (`/star-style-dev?scene=real&cam=new&man=0.08` to compare); set `manShare`, and drop `kMax` to ~2.2 if he goes bigger.
2. Play a career match on a phone with "3D camera: New": check corners and byline crosses (turned 30° behind the attack), the drag room, and the glide between chances; then make New the default in Standard (`lib/star/gameVersions.ts`).
3. Make `ClipPlayer` blend from the current mix on an interrupted fade (no pop), and play the 3D/2D button and ⚙ with the `star-playtest` agent.

### Style A (cel-shaded people for every 3D person)

Harry: "Style A becomes the Knowitball standard look for EVERY 3D person". He
picked **Stylised** on the heads sheet, asked "what is happening with those
arms/hands?", and gave ~200 Higgsfield credits for better models.

**Done** (behind Settings → Look → "Player style: New | Old", default New, in
`PREVIEW_ROWS`; Old = exactly the old bodies and materials):
- Eight new generated people: six player heads (`public/star/people3d/toon-p1.glb` … `toon-p6.glb`:
  curls, quiff, buzz & beard, bun, fringe, ginger crop & beard) and two in suits
  (`toon-mgr.glb` grey & stubble, `toon-mgr2.glb` fade & beard). ~14.5k triangles
  each (old body 20.9k), 206–235 KB packed. The old C1–C3 files are gone from
  `public/` (sources stay in `tools/modeltest/c1`–`c3`).
- Builds are a scale now, not a file: Slim / Strong / Tall on any head.
- Hands: fingers are really skinned now (`weight_fingers` in
  `scripts/people3d/build_toon_bodies.py`; before, every hand vertex followed
  the hand bone only, so no finger pose ever showed). Hands 0.88 size; relaxed
  curl; idle arms baked (wrist 22° → 8°, elbow 27° → 13°, palms to the thighs
  0.68 → 0.96; `tests/star/runPosture.mts`). A light fingertip by the white
  shorts no longer reads as kit (hand zone kept out of the kit mask).
- Seeded picks: head, build, skin, hair per id (`toonPickFor`); a squad of 25
  uses 5–6 heads (`tests/star/toonPeople.mts`). Your look: Settings → Your look
  (head, build, skin, hair colour), saved as `player.head3d` / `body3d`.
- Wired places (through `makePerson3d`): career 3D match and Real game
  (`engineView.ts`), drills (`play3d/scene.ts`, `training3d/scene.ts`), dribble
  3D (`style3d/gameplay.ts`), shop, garden, casino, signing scene, farewell and
  ovation, cut scenes (`cutscene/people.ts`). Home and title: `ToonHomePlayer`
  inside `HomePlayerFigure` (one head file, 30 fps cap, drag to turn on Home,
  the old figure until it loads).

**Fixed after the first round:** glowing white squares on every lit Style A
person (shop, garden, cut scenes). Cause: the cel band's full-strength light
also fed the GGX highlight, which divides by the light angle, so silhouette
pixels blew up under the bloom. The highlight now uses the real falloff
(`patchToonBody`, `lib/star/style3d/toon/shader.ts`). Old saves get a seeded
head and build (`yourToonHead`); scenes load only their heads
(`loadPeople3d(..., heads)`); the house wardrobe in a kit is your Style A player.

**Not done (next):**
- 2D match sprites. `node tools/sprites/new/bake-new.mjs reskin` re-bakes every
  cell on a Style A body into the same rects and anchors, but it is not
  shippable yet: atlas-0's sprint, kick and keeper dives came from GLB clips
  that were never committed, and the Old cells are cropped tight to the Old
  silhouette, so the Style A body overflows them (shrinking to fit gave scales
  down to 0.3). Needs a decision: re-bake with a fresh index (new rects,
  same frame counts and timings) or keep 2D Old.
- Kit decals on the Style A shirt: the back number sits low (`uNumBox` comes
  from the kit lines; place it between the shoulder blades per head) and the
  shirt is flat colour (add the textured kit: weave, seams, collar trim).
- Garden's casual sets still use the human body.

**Half-done / not seen:**
- Stills were taken on the stand-alone harness only (`tools/styletest/heads.ts`,
  stills in the session scratchpad `r3styleA/stylised-hands.jpg`). The Old/New
  per-place sheet (`r3styleA/sheet.jpg`) was NOT made this round; the earlier
  WIP stills in `r3styleA/*-new.jpg` show the old C1 body.
- Home/title Style A player: built, type-checked, never seen on screen.
- Every scene loads all eight heads (~1.8 MB) when it makes its first person;
  fine on Wi-Fi, heavy on a first match on mobile data.
- Managers: the seeded suit head + grey hair works; no per-club manager face
  yet; the house wardrobe (`setWearerBody`, Harry branch) does not know Style A.
- Hair colour recolours the modelled cut; there is no ginger in `HAIR_COLOURS`,
  so the ginger head is shown in the seeded colour.

**Next 3 steps, in order:**
1. Open each place with Player style New and Old on a phone and make the
   Old/New sheet (`/star-look-dev`, `/star-shop3d-dev`, `/star-garden3d-dev`,
   `/star-style-dev?scene=play3d`, the Real game tab, `/star-3d-area-dev/signing`,
   Home and title in `/star-dev` signed out). Fix what looks wrong there.
2. Loading: let scenes ask only for the heads they will use (pass the ids up
   front, or start with `loadToonHead` and fetch the rest after first paint).
3. Managers/staff: more suit heads (one Higgsfield image-to-3D is 18 credits),
   a per-club manager pick, and the house wardrobe's casual sets on Style A.

**Harry's decisions that apply:** Stylised for everyone; hands ~0.88, relaxed
curl, wrists ≤10°, elbows ~10–15°; Higgsfield up to ~200 credits, never below
a 60 balance (this round: 74 for heads 1–3 and the first suit, then 90 for heads 4–6 and the second suit = 164 credits; balance now 168.25);
same or fewer triangles per person than Old (14.5k vs 20.9k, 3 draws each with
outline and shadow, as Old); every new look behind New | Old.

**See it:** `/star-look-dev?head=h4&body=c2` (your player, a mate, a manager;
`?pstyle=old` for Old). Stand-alone stills without Next.js:
`tools/styletest/heads.ts` (`?head=h1..h6|m1|m2&view=front|34&clip=idle|run|kick_r&inset=hand`).
