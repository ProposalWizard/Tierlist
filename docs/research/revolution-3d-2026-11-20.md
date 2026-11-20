# Revolution report: why the 3D looks "2010", and the way out (20 Nov 2026)

Research + proof only. No repo code changed. Demo: `scratchpad/revolution/demo/` (runs the game's REAL house,
`lib/star/home3d/scene.ts`, and lays each upgrade on from outside). Pictures: `scratchpad/revolution/demo/out/`.

## 0. FIRST: what each lounge upgrade costs (measured)

Measured on this build machine's software GPU (SwiftShader) at phone viewport 390x844 css, dpr 2 asked (the game's Medium tier caps it to 1.5, so 585x1266 pixels are drawn, as on a real phone on Medium), wide lounge camera,
median of 6-10 frames. **Read the % column, not the ms**: a phone GPU is 10-100x faster, but the RATIO between steps
holds roughly, because a phone, like SwiftShader, is limited by how many pixels each pass touches (fill rate).
Draw calls and triangles are exact (all passes counted). Logs: `demo/log-bench2.txt`, `demo/log-bench3.txt`.

| Step (as in ladder.png) | Draw calls | Triangles | Frame (sw ms) | vs today | Mid Android estimate (reasoned) |
|---|---|---|---|---|---|
| 0 Today | 30 | 18k | 590 | 0% | baseline |
| 1a Real light: lit walls/floor + 3 warm lamps (no shadows) | 27 | 18k | 594 | **+1%** | free (≈0 ms) |
| 1b + live soft sun shadows (2048, every frame) | 65 | 37k | 647 | +10% | ~1-2 ms |
| 1c   cheap variant: 1024 shadows, drawn once (frozen) | 27 | 18k | 617 | **+5%** | ≈0.3 ms (the repo already has `shadowCache.ts` for this) |
| 2 + set dressing, 38 Kenney props (frozen shadows) | 53 | 19k | 704 | **+19%** | ~0.5-1 ms (26 extra draws; can be merged to ~5) |
| 2b   same with live 2048 shadows | 165 | 42k | 728 | +23% | ~2-3 ms (props redrawn into the shadow map every frame) |
| P1 + colour grade + SMAA as a post pass chain (HalfFloat MSAA target) | 58 | 19k | 1177 | **+85%** | ~3-5 ms: the off-screen target + 4 full-screen passes |
| P2 + bloom (UnrealBloom) | 71 | 19k | 1420 | +38% more | ~3-5 ms |
| P3 + live GTAO (screen-space AO) | 128 | 39k | 2190 | **+121% more** | ~8-15 ms: too dear for a mid phone at full res |
| P4 GTAO alone, no bloom/grade | 111 | 39k | 1678 | — | — |
| All on (ladder step 4) | 128 | 39k | 2190 | **3.7x today** | would not hold 30 fps on a mid phone |

What this says, in plain words:
- **Nearly free, take them now:** real light on the walls (1a), warm lamps, frozen soft shadows (1c), set dressing (2).
  Together: +19% on the software GPU, under ~1.5 ms on a phone. That is most of the "after" picture's warmth and fullness.
- **Costs real frames:** anything done as a full-screen pass after the picture is drawn. Live AO is the worst (2.2x the
  dressed room on its own), then the post-pass chain itself (+85% before any effect), then bloom.
- **Cheap variants that keep the look:**
  - AO -> **baked AO** (Blender bakes it into a lightmap or vertex colours once): 0 ms. The repo already has the
    tooling (`tools/bake3d`, `lib/star/look/bakedLight.ts`) for the stadium, garden, shop and casino; the house has none.
  - Grade -> do it **inside the tone map** of the normal shaders (a 3D LUT; `real/toneGrade.ts` already does this for Low):
    no extra pass, ≈0 ms. SMAA -> the canvas's own MSAA, or FXAA on High only.
  - Bloom -> **glow cards** (a soft additive sprite on each lamp and window): ~0 ms. Real bloom on High/PC only, at half res.
  - Live shadows -> **frozen** for the room, a cheap blob or shadow body for the moving player.
- Honest caveat: ms figures for a phone are reasoned from the ratios, not measured. A real mid Android with `?fps=1`
  (frame meter) is the only judge; the demo can be put on a test page to measure it.

Movie of it running: `demo/out/run-before-after.mp4` (6 s, 30 fps, TODAY | UPGRADED side by side, each 585x1266 =
what a 390x844 phone draws on Medium; same stick inputs and a fixed 1/30 s step, so both walks are identical). Strip:
`demo/out/run-strip.jpg`. It was rendered frame by frame on the software GPU (2.5 s per frame today, 9.5 s per frame with
everything on, on a busy shared machine), so it shows the LOOK in motion, not the speed. The walk also shows two
problems the upgrade does not fix: camera D runs him into a corner and frames a bare wall for a second, and
the new armchair fills the foreground when he stands next to it (the camera does not fade props yet).

Phone-budget picture vs full picture: `demo/out/ladder-2-set-dressing.png` (cheap steps only, ~+19%) vs
`demo/out/ladder-4-bloom-grade.png` (everything, 3.7x). Most of the gain is already in the cheap one; what the dear
steps add (contact darkening under furniture, lamp glow, filmic colour) can be bought back baked (section 4).
Note: the live GTAO in `ladder-3-ao.png` shows grain on this software GPU; baked AO has no grain at all.

---

## 1. Why it reads "2010 indie web game" (with evidence)

Every point is something seen in today's footage (`scratchpad/camD-game/*-strip.jpg`, `scratchpad/cutscenes-now/*-strip.jpg`,
`scratchpad/world-kit/*-strip.jpg`) or in the demo's "today" frames. [seen] = seen in a picture; [code] = read in the repo.

1. **Light is painted on, not cast.** [seen+code] The house walls, floor and ceiling are flat pictures
   (`lib/star/home3d/roomBuild.ts` uses 25 `MeshBasicMaterial`s: painted glows, blob shadows, additive light pools).
   Nothing in the room darkens where two surfaces meet, furniture does not shade the floor, lamps light nothing
   (`ladder-0-today.png`: the lamp is on, the wall beside it is the same flat cream). Look H runs in the house with
   `bake: null` (`scene.ts:316`): the baked-light system that the garden, shop, casino and stadium have
   (`tools/bake3d/sets/*.json`) was never made for the house or the cut-scene rooms.
2. **Empty rooms, low prop density.** [seen] Lounge "today" = sofa, table, TV, one picture, one lamp, bare walls
   (`fba-wide.jpg` left; `sofa-strip.jpg`). Half the frame is wall or ceiling with nothing on it. Real games fill
   every metre the camera sees: shelves, books, plants, rugs, cables, clutter. The demo added 38 free props and the
   room immediately read as lived-in (`fba-*.jpg` right).
3. **Bodies through things (clipping) and no contact.** [seen] Press scene: the player's hands sink into the desk,
   the crowd are capsules with ball heads, the journalist stands in a T-ish pose (`press-strip.jpg`, t=2.2-7.1 s).
   Signing scene: the shirt passes through his body, the camera sits inside a shoulder and inside a plant
   (`signing-strip.jpg`, t=11.4-14.2 s). Garden: he runs through flower beds (`garden-strip.jpg`). Demo: a stock
   sitting clip on our sofa puts the legs through the cushion and the back through the backrest (`life-sofa.png`).
   Nothing in the game knows where a seat, a desk edge or a hand-hold is.
4. **The camera is not art-directed.** [seen] A follow camera that clips into props and furniture (demo walk,
   `strip.jpg` bottom right: shelf between camera and player), cut-scene shots framed on a shoulder or a backdrop
   that says KNOWITBALL 20 times on a sky-blue outdoor background (`press-strip.jpg`), black frames between shots
   (`garden-strip.jpg`, `press-strip.jpg` t=7.8 s). AAA cut scenes use long lenses, depth of field, and blocking
   so faces are lit and readable; ours often frame the back of a head.
5. **Animation: clean loops, but no life between them.** [seen+code] The blending code is good (`animBlend.ts`
   stops pops and foot slide on flat ground). What is missing is everything AFTER the loop: no foot IK on steps or
   stairs, no lean into turns, no head look-at, no breathing or weight shifts in idles, no secondary motion
   (hair, shirt), no hand grips on props, no start/stop/turn-on-the-spot clips. The press-room journalist and the
   idle in `sofa-strip.jpg` stand like mannequins.
6. **Materials are all one roughness, no texture detail.** [seen] Sofa, table, walls are flat colours with the same
   soft plastic finish. No fabric weave, wood grain, edge wear, or roughness variation; no reflections in the TV
   or the window. Toon games (Zelda BOTW, Genshin, Hi-Fi Rush) still paint gradients, rim light and hand-made
   texture on every surface; they are flat by design, not flat by default.
7. **No post-processing that ties the frame together.** [seen] No ambient occlusion, no bloom on lamps and windows,
   no colour grade on the house, no vignette, no depth of field in cut scenes. Each object looks pasted in.
8. **Crowds and extras are placeholders.** [seen] Capsule people in the press room; the same four team-mates.
9. **Window views and "outside" are flat cards.** [seen] The lounge window is a green painted card
   (`ladder-0-today.png`); the press room is outside under a blue sky.
10. **UI over the 3D looks like a web app.** [seen] Yellow pill buttons, dark rounded cards and the chat bubble
    sit on top of the scene in a different style from it (`sofa-strip.jpg`). Console games theme the HUD to the world.

The 5 that matter most: (1) painted light, (2) empty rooms, (3) clipping/no contact, (4) camera, (5) no life
between clips. Fix those and "2010" goes away; none of them needs a new engine.

---

## 2. What the "amazing AI 3D games" online really are

- **Engines.** Almost all browser ones are three.js (often with Rapier physics), sometimes PlayCanvas or Babylon.
  The viral ones (e.g. Pieter Levels' flight sim, made with Cursor) and the Vibe Jam entries are small three.js
  games with simple low-poly art [source: indiehackers.com post; huggingface.co/blog/vibegame; discourse.threejs.org VIBE_WEAVERS].
  The ones that look AAA in short videos are usually **Unreal Engine 5 or Unity** projects built from marketplace
  packs (Fab, Synty, Unity Asset Store) with AI used for code and some assets, and filmed on a PC GPU.
  [reasoned from the listings; no single source ranks them]
- **"Perfect, no clipping" = authored, not generated.** Clean interactions in those clips come from mocap clips
  made for that prop and that seat, plus IK and a camera that never shows the bad angle. AI did not solve clipping.
- **AI asset generators** (Meshy, Tripo, Hunyuan3D, Rodin): good for props, poor for rigged characters and rooms.
  Licences: Meshy paid plans = commercial, free = CC BY 4.0 (one third-party source says free is non-commercial;
  check) [source: intercom.help/meshy/en/articles/16102098]; Tripo free = CC BY 4.0, paid = private + commercial
  [source: tripo3d.ai blog, Tripo's own]; **Hunyuan3D's community licence does not apply in the EU, UK and South
  Korea** — we are in the UK, so do not use it [source: Tencent Hunyuan 3D 2.0 community licence text]; Rodin: no
  licence found. Our Higgsfield route already covers this need.
- **Gaussian splats**: photo-real captured spaces. Spark (three.js) claims fast on low-power phones; PlayCanvas's
  own table shows WebGL2 at 38 fps for 1M splats, 20 fps at 4M (device not named) [source: sparkjs.dev,
  blog.playcanvas.com SuperSplat WebGPU]. Splats do not light, cast shadows, or collide, and look photo-real, not
  toon. **Hype for us**: maybe a backdrop (a stadium skyline), never the rooms people walk in.
- **WebGPU demos**: real, but WebGPU on Android needs Android 12+ and Qualcomm/ARM GPUs; still uneven, keep a WebGL2
  fallback [source: web.dev/blog/webgpu-supported-major-browsers; forum.babylonjs.com "WebGPU on mobile: is it ready?"].
  The look in those demos comes from lighting and art, which WebGL2 can also do.

---

## 3. Animation: sources, licences, techniques

### Libraries (commercial use)
| Source | Licence | Verdict |
|---|---|---|
| **Quaternius Universal Animation Library 1 + 2** (120+ and 130+ clips, one humanoid rig, glTF) | **CC0** [quaternius.com/packs/universalanimationlibrary.html, …library2.html; itch.io] | Best free base. Already used by the garden (`tools/garden3d/build_anims.py`) and in this demo (`life-*.png`): sit, sit-talk, idle-talk, push, pick-up, interact, crouch |
| **KayKit Character Animations** (133 clips, 28 tool/interaction clips in v1.1) | **CC0** [kaylousberg.itch.io/kaykit-character-animations; opengameart] | Good for prop interactions (tools, carrying). Chunky-style rig: retarget |
| **CMU mocap** (already our source) | "free for all uses"; may include in sold products, may not resell the data [CMU FAQ via paperswithcode; UPenn mirror]. Some converted copies are CC BY-NC: use the original | Keep |
| **Rokoko free packs** (sports, TV, dance etc.) and Rokoko Motion Library | Commercial use allowed [rokoko.com/resources/*] | Good sports and celebration moves; check each pack page |
| **Anderson Rohr free mocap** (130 FBX moves, 2026) | Commercial, no attribution [cgchannel.com, Sep 2026] | Worth a look |
| **Mixamo** | Free, royalty-free in games, must be embedded, may not redistribute raw files [Adobe community FAQ quotes; official page not reached] | Usable, but a web game ships the GLB the player can download: grey area for "raw files". Prefer CC0 |
| **Ubisoft LaFAN1** | **CC BY-NC-ND 4.0** [github.com/ubisoft/ubisoft-laforge-animation-dataset] | Not for us (non-commercial) |
| **Bandai Namco Research Motiondataset** | **CC BY-NC (or NC-ND) 4.0** [github README; automaton-media.com] | Not for us |
| **AMASS / HumanML3D**, and text-to-motion models trained on them (MDM, MoMask) | AMASS: non-commercial only [amass.is.tue.mpg.de/license.html] | Code may be MIT, the trained output inherits a non-commercial dataset: **avoid** |
| Paid packs on Fab / Unity Asset Store | Fab Standard licence: any engine [dev.epicgames.com/documentation/fab/licenses-and-pricing-in-fab]; Unity Asset Store EULA ties some content to Unity | Fab is the safer paid source for a three.js game; read the redistribution sections |

### Video-to-mocap
- **Rokoko Video** (free tier, commercial export per pricing page) [rokoko.com/pricing] — easiest for Harry filming himself.
- **Move.ai** — strong quality; free tier single camera, 15 s, FBX [secondary source]; API EULA licenses the files to you [move.ai/move-one-api-eula].
- **FreeMoCap** — software is AGPL-3.0 (the motion you capture is yours; AGPL binds the software, not its output) [pypi freemocap].
- DeepMotion, Plask: no licence terms found; check before use.
- Our own pipeline (`tools/mocap3d/retarget.py`) already retargets; any of these feeds it.

### Techniques behind the GTA / RDR2 feel, and which fit three.js
| Technique | What it does | three.js? |
|---|---|---|
| **Inertialization** (Gears of War, Bollo, GDC 2018) | Switch clip instantly, decay the pose difference as an offset: crisp, no mushy crossfade | **Yes, cheap.** ~150 lines on top of `animBlend.ts` [gdcvault.com/play/1025165] |
| **Two-bone foot IK + pelvis drop** | Feet on stairs/kerbs, no floating | **Yes.** Small solver; already in the stylised-bodies plan |
| **Procedural lean, look-at, breathing, weight shift** | Body tilts into turns, head tracks the ball/person, idle breathes | **Yes, cheap** (a few bone offsets after the mixer) |
| **Secondary motion** (springs on hair, shirt hem, bag) | Things that lag and settle | **Yes**: spring bones (the VRM spring-bone idea, MIT) on 2-6 extra bones |
| **Prop-synced interactions / smart objects** | Seat has an anchor + its own sit-enter clip; hand snaps to a socket; IK finishes the contact | **Yes**, this is the fix for `life-sofa.png` and the press desk. Already designed (`world3d/smartObject.ts`) |
| **Root motion + stride warping** | Feet match the ground speed in starts/stops | Yes (partly done in `gait.ts`) |
| **Motion matching** (For Honor, Clavet GDC 2016; RDR2-style) | Pick the best next frame from a big mocap pool each tick | Possible (a JS/WASM search over ~10-20 min of motion), no maintained library [gdcvault.com/play/1022985; masterallarts three.js article]. Needs a lot of good mocap: **later, for the 3D match only** |
| **Physics ragdoll / Euphoria-style active ragdoll** | Stumbles, falls | Hard on phones; skip |

---

## 4. Environments

- **Asset ecosystems**: Kenney furniture/city kits (CC0, used in this demo), Quaternius (CC0), KayKit (CC0),
  Synty POLYGON (paid; "not limited by engine, platform or device"; may not share source files or offer them for
  re-use; may not upload to AI 3D generators) [syntystore.com/pages/one-time-purchase-licence], Fab Standard licence.
  Synty is the fastest way to a consistent, dense "real game" look; the risk is that a web build exposes the GLBs,
  so ask Synty support in writing before buying. Kenney/Quaternius/KayKit carry no such risk.
- **Baked lighting into three.js**: bake in Blender Cycles (AO + indirect + lamps) into a lightmap on a second UV
  set, `lightMap.flipY = false` for glTF [discourse.threejs.org lightmap threads; Packt "Learn three.js" ch.13;
  hubs.mozilla.com/labs/ez-bake-lightmapping]. **We already have this pipeline** (`tools/bake3d`, `bakedLight.ts`)
  for four sets; the house, office and press room just need sets. This is the single biggest cheap win: the AO and
  bounce light of `ladder-3/4` for 0 ms per frame.
- **Stylised done well**: Hi-Fi Rush = toon shading on everything, a few light steps, static shadow maps + baked GI,
  60 fps [GDC 2024 "3D Toon Rendering in Hi-Fi RUSH", gdcvault.com/play/1034330; 80.lv write-up]. The lesson: the
  stylised look is carried by **light and colour design + baked GI**, not by geometry detail. Genshin, BOTW,
  Fortnite and Sea of Thieves share the same recipe: strong key light, coloured shadows, rim light, painted
  gradients, dense hand-placed dressing, heavy grade.
- **Post on phones**: grade inside the tone map (LUT) ≈ free; FXAA/MSAA instead of SMAA; bloom at half res on High
  only or glow cards; AO baked, never live on Medium/Low; DoF only in cut scenes (a still camera, cheap).
- **Performance**: we already have KTX2, meshopt, shadow cache, governor, frame meter. Add: merge static props per
  room (the 38 props are 26 extra draws; merged ≈ 3-5), InstancedMesh for repeats (books, plants).

---

## 5. THE PLATFORM QUESTION (the decider)

| Path | Licence / cost | Size | Phone evidence | Keeps the career game? | What Claude can do |
|---|---|---|---|---|---|
| **A. Stay three.js (WebGL2), add baked light + dressing + smart objects** | MIT, free | small (our GLBs) | Our own frame meter; this demo's ratios | **Yes, nothing moves** | Everything, headless, filmable, testable (as today) |
| B. three.js WebGPURenderer + TSL | MIT | same | Android 12+ Qualcomm/ARM only; uneven [web.dev; Babylon forum] | Yes | Yes, but our shaders/post would be rewritten; gain is mostly compute features we don't need yet |
| C. Unity as a Library inside the Capacitor app (3D native, career web) | Unity Personal free under $200k revenue; Pro $2,200/seat/yr [unity.com terms update Oct 2024] | **+~170 MB** reported for an exported library vs 30-35 MB standalone [discussions.unity.com] | Native Unity runs well on mid phones | Career stays web, but **one runtime only, intended full screen on Android**; bridge every state change [docs.unity.com UaaL] | Weak: Unity editor work (scenes, prefabs, lighting bakes) is GUI-driven; Claude can write C# but cannot see or bake headless here. Two codebases forever |
| D. Unity 6 Web build in the WebView | as C | tens of MB download + WASM | Unity: mobile web "targets high-end devices", may not suit low-RAM phones [Unity roadmap 415] | Yes | Same as C, plus slow phone loads |
| E. Godot 4 web / native | MIT | ~10-40 MB | Web = WebGL2 Compatibility renderer only, no threads by default; native far faster [docs.godotengine.org exporting_for_web] | Native: no (Godot can't host our React screens) | Good: text scenes (.tscn) are Claude-friendly. But a full rewrite of the 3D |
| F. PlayCanvas / Babylon.js | MIT / Apache-2.0 | small | PlayCanvas claims low-end phones (marketing) | Yes | Fine, but same WebGL as three.js: **no visual gain from switching**, only a rewrite |
| G. Needle Engine (author in Unity/Blender, export three.js) | **Commercial use needs Pro, about €49-67/user/month**; free tier watermarked [needle.tools/pricing] | small | three.js underneath | Yes | Unity editor in the loop again; we already have a Blender -> GLB path |
| H. Gaussian splats | MIT renderers | 10-100 MB per space | 20-40 fps at 1-4M splats [PlayCanvas table] | Yes | Photo-real, unlit, no collisions: wrong look |

**Verdict: stay on three.js/WebGL2 (path A), and spend the effort on light, dressing, contact and camera.**
Reasons: (1) the measured ladder shows the "revolutionary" part of the picture costs +19% when done the cheap way
— the engine is not the bottleneck, the content is; (2) Unity would not bake our lights for us here, can't be
driven or filmed headless by Claude, adds ~170 MB and a second codebase, and runs as one full-screen view beside
the web career; (3) every alternative web engine renders through the same WebGL2 as three.js; (4) the parts we need
(baked light, LUT, shadow cache, KTX2, governor, smart objects, mocap retarget) already exist in the repo.
Keep WebGPU as a later High/PC tier; a PC/Steam build can ship the same three.js game in Electron/Tauri with the
High tier (live AO, bloom, 2048 shadows) switched on.

What stays hard (honestly): hand contact and sitting on arbitrary furniture (needs anchors per prop + IK + an
intersection check, per prop); faces and lip-sync in cut scenes; crowds (VAT needed past ~8 people); and
motion matching (needs hours of good mocap we don't have). No engine change makes these free; Unity just sells
packs for them.

---

## 6. GitHub repos, skills, MCP servers that genuinely help

- **Blender MCP** (ahujasid, now "mcp-for-blender", MIT; telemetry opt-out — keep it off) [github.com/ahujasid/blender-mcp].
  Useful on Harry's own machine with the Blender app open; in our cloud sessions headless `blender -b -P script.py`
  (Blender is installed here) does the same job and is what `tools/bake3d` already uses.
- **three-mesh-bvh** (MIT): capsule vs room, and baking AO per vertex in the browser if needed.
- **@pixiv/three-vrm** (MIT): spring bones for hair/shirt secondary motion (copy the spring code, not VRM).
- **three.js addons we already ship**: `CCDIKSolver`, `GTAOPass` (High only), `SkeletonUtils.retarget`.
- **pmndrs/postprocessing** + N8AO (MIT): cheaper AO/bloom merged into fewer passes, for the PC/High tier.
- **sweriko/ai4anim-webgpu**, AI4Animation-js: neural motion matching in the browser — research toys; dataset
  licences are the blocker.
- Skill ideas for us: `bake-room` (Blender bake per house room, writes `tools/bake3d/sets/<room>.json`, renders
  before/after), `dress-room` (a seeded prop placer with collision checks + contact sheet), `seat-anchor`
  (sit clip + anchor + intersection test per seat), `cutscene-blocking` (camera never inside a mesh, face lit).

---

## 7. The revolution plan (phased; effort = estimates)

| Phase | What Harry sees | Effort | Cost on phone |
|---|---|---|---|
| 1. **Lounge proof in the real game** (this week): real light on walls, warm lamps, frozen soft shadows, 30-40 CC0 props, grade in the tone map, behind a test switch; frame meter on a real mid Android | The `ladder-2`/`fba` picture in his own house, at full speed | 2-3 days | ~+1-2 ms |
| 2. **Bake the house** in Blender (`tools/bake3d` set per room): AO + bounce + lamp pools; glow cards on lamps/windows; real window views | `ladder-4` look (AO, glow) without the cost; every room | 3-5 days | ≈0 |
| 3. **Contact pass**: smart-object anchors for sofa, chairs, desk, bed, press desk; enter/exit clips (Quaternius sit, KayKit tools); foot IK; hand sockets; intersection test in CI | Sits on the sofa without legs through it; hands on the desk, not in it | 5-8 days | small |
| 4. **Life layer**: inertialization, lean, head look-at, breathing idles, spring bones on hair/shirt; follow camera that never enters a mesh | Moves like a console game, not a loop | 4-6 days | small |
| 5. **Cut-scene rebuild, press scene first**: a real press room (dressed, baked), seated journalists from CC0 sit-talk clips instead of capsules, long lens + DoF, faces lit | The worst scene becomes the showcase | 5-7 days | cut scenes can afford DoF/bloom |
| 6. **Every room + garden/shop/casino** to the same recipe; prop budget per room; merged static props | Consistency everywhere | 2-3 weeks | held by budgets |
| 7. PC/Steam High tier: live AO, bloom, 2048 shadows, WebGPU when stable | Extra polish on PC | later | PC only |

Step-1 proof we can build this week: the demo already IS it, from outside the repo. Porting = a `lookUp` switch in
`lib/star/home3d/scene.ts` (lit materials, mood lights, frozen shadows, `DRESS` list), measured on a phone with `?fps=1`.

---

## 8. Files
- Demo source: `scratchpad/revolution/demo/src/entry.ts`, scene data `demo/scene.mjs`, scripts `ladder.mjs`, `bench2.mjs`, `bench3.mjs`, `video2.mjs`
- Pictures: `demo/out/ladder.png` (5-step ladder), `demo/out/fba-{wide,nook,game}.jpg` (before|after),
  `demo/out/life-sofa.png` (CC0 people + the clipping problem), `demo/out/run-before-after.mp4` + `run-strip.jpg`
- Logs: `demo/log-bench.txt` (dpr 1, old), `demo/log-bench2.txt`, `demo/log-bench3.txt`
