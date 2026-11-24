# KIB Next: bring every 3D part of the web version into the app (24 Nov 2026)

Mikey: "add all of the 3D elements to the best of your ability into the game and get them working
seamlessly without adding any additional lag … looking clean and working perfectly … use Sonnet 5.5 …
keep working … if you need any permissions leave it till the end." The web version (origin/main) is
the reference; the handbook is `docs/3D_HANDBOOK.md` (read section 1, the map). This reverses the
earlier "no garden/house/3D shop/3D training" choice.

## What makes this possible
The web scenes live in `lib/star/**` and are shared with `phone/`. They take their container and WebGL
canvas from the host: `startGarden(container, callbacks, data, opts) -> controller`
(`lib/star/garden3d/scene.ts`; the Garden already holds the horse/stable, parked cars, trophy cabinet,
fountain, gazebo, bench team-mates and the shop / house / training / casino doors). The app already has
the harness for this: `phone/src/three/env.ts` (`withSceneDocument` = a stand-in `document`),
`gl.ts` (GL canvas), `assets.ts` + `assetList.ts` (bundled 3D files by web path), `Farewell3D.tsx`
(a lib scene hosted in the app: copy its pattern). Missing today: a stand-in HTML element (the scenes
call container.appendChild, `document.createElement("div")` for captions/fades, window.devicePixelRatio,
key listeners), touch -> controller (setStick / tap / orbit), and each scene's screen around it.

## Work packages (do in this order; one builder at a time, Sonnet 5.5)
1. WP1 Walk3D host + the Garden (`components/star/Garden3D.tsx` is the web screen to copy: stick, tap to
   move, orbit, the small card when near something, Back, doors). Unhide Phone -> Garden.
2. WP2 3D Shop (`Shop3D.tsx`, `lib/star/shop3d/scene.ts`; assets 25.8 MB: bundle only what the scene loads).
3. WP3 Your house (`Home3D.tsx`, `lib/star/home3d/`) + the 3D phone in your hand (`HousePhone.tsx`).
4. WP4 3D training (`Training3D.tsx`, `Play3D.tsx`, `lib/star/play3d/`, Crossbar Challenge).
5. WP5 Signing scene + manager's office (`SigningScene3D(Career).tsx`, `Office3D.tsx`).
6. WP6 Ballon d'Or night, Season awards night, Star Pass podium (`Podium3D.tsx`).
7. WP7 Match: Match Radar (`MatchRadar.tsx`), Dribble3D, the 3D match view (`Match3DLayer.tsx`, the "2D" button).
No casino (Play rule).

## Rules for every package
- Edit only `phone/**` (plus `docs/`). Never lib/, app/, components/, data/, public/, mobile/.
- Copy the web screen's behaviour and look; same callbacks, same data (`gardenData(career)` etc.).
- NO extra lag: draw only while the scene is on screen and awake (sleep when the app is in the
  background or the screen is left), use the web's own quality tier (`lib/star/three3d/quality.ts`),
  load assets before the screen opens where possible (a drawn "loading" with the same look), never
  block the JS thread more than ~50 ms at once. Report `controller.stats()` (draw calls, triangles,
  fps) in the web build.
- Crash safety: wrap each scene in the `"3d"` part of `phone/src/safety.ts`; on failure show the
  web's drawn fallback (e.g. GardenScreen look) or hide the door. Never close the app.
- Checks stay green: `scratchpad/checks-main.sh` (match-parity identical, career-flow, screens, world,
  boot-sim, tsc: 9 old errors in ../lib, add none).
- Look at it: the app's web build renders three in headless Chromium (SwiftShader): take stills at
  412x915 and 360x780 and compare with the web version's page (e.g. `/star-garden3d-dev`).
- Keep assets small: say what each package adds to the app size.

## Only a real phone can confirm
Frame rate and heat on the S20+, touch feel of the stick and orbit, memory (a 2020 phone), load times.
Each test app comes with a short list of what to check, and a "Show 3D speed" switch (Settings).

## WP1 notes (the Walk3D host and the Garden, 24 Nov 2026)
What the next packages reuse (all in `phone/src/three/`):
- `walkHost.ts` `startWalkScene({start, data, callbacks, gl, width, height, pixelRatio, quality})`: runs any
  `start*(container, cb, data, opts)` scene; gives it a stand-in container/canvas/document/fetch (`standIn.ts`,
  `env.ts`, `bundledFetch.ts`), holds frames while paused, stretches whatever pixel ratio the scene picks to the
  fixed GL buffer, and puts everything back on `dispose()` (also drops the shared renderer: its GL goes with the view).
- `Walk3D.tsx` `<Walk3D load data callbacks onBack onController showSpeed>`: the screen: GL view at the tier's pixel
  count, stick (lower left ring), look-round drag, tap (`controller.tap`, else `pick`), pinch (the scene's own
  listeners get pointer events), pause on AppState, plain "3D could not start" card, `useRiskyPart("3d")`.
  A new place = a `load` function (a plain `require` of its `start*`), its data builder, its callbacks, its screen.
- Files: add each file's website address to `assetList.ts` + `assets.ts`, copy it to `phone/assets/3d/`. A Draco file
  (Hermes has no WebAssembly) is unpacked first with `node phone/tools/garden-props-unpack.mjs /star/x.glb`
  (the six cars and the garden props are done). A `.json` is kept as `.bin`.
- Check with `phone/tools/walk-check.ts` (a Web Worker: no document, like Hermes): add the new place's start to
  `walk-worker-entry.ts`. It lists every file the place read (each must be in `assetList.ts`).
Measured (24 Nov, software GL, so only draws/triangles and JS time mean anything): garden at Medium, 412x915:
67 to 253 draw calls and 103k to 232k triangles by spot (gate 241/164k, horse 67/103k, cars 76 to 253/203k to 228k, shop 107/107k);
the scene's JavaScript costs about 3 to 6 ms a frame in V8 (Hermes has no JIT: expect several times that, so the phone's
fps is the open question). Start: 13 s in the worker (software GL), 23 s in the web build. Files added to the app: 9.9 MB
(the 6 cars unpacked from Draco are 6.6 MB of it; gltfpack-style quantising would cut them to about a third).
Only a real phone can say: fps and heat at Medium on the S20+, whether expo-gl gives the extensions the scene asks for
(half-float targets, 3D texture for the baked light: the scene drops each to plain light if missing), touch feel, memory,
start time, the GL surviving a trip to the background.
Not done on purpose: the web's "still 2.5x / moving 1.5x" pixel ratios (the GL buffer is one fixed size per tier),
KTX2 packed textures (need WebAssembly; `window.__ktx2Off` is set), the 3D phone in your hand.

## WP2 notes (the 3D Shop, 24 Nov 2026)
What it is: `phone/src/screens/world/Shop3D.tsx` (screen name `shop-3d`) runs the website's own `lib/star/shop3d/scene.ts` (not touched) through
`Walk3D` and `walkHost`. Same look as the web: look H room, the motorbike / six cars / jet on the turntable, seven boots on plinths, the KIB can fridge,
five watches and jewels in lit niches, the homes' model table, the new player in your skin, hair and club kit. The screen copies the web's
`Shop3D.tsx`: top bar, stick, tap (pick first, then walk), drag to look round, pinch, and the item card (items, five levels, what each gives, price).
Nothing is bought in 3D, as on the web: "See it in the shop" opens that item's sheet in the app's own Shop (`Shop.tsx` now reads params
`{ cat?, focus?: { id, level } }`), so buying and saving are exactly the 2D Shop's (`world/shop.ts`); there is no second set of rules.
- Ways in: the Garden's shop door (`from: "garden", atDoor: true`: steps in at the doors; Back and the doorway return to the Garden outside the door)
  and a new big "3D" button in the middle of the Shop's bar (as the web's; greyed when the crash guard has the 3D off). The doorway from a Shop-opened
  3D shop leads out to the Garden when the Garden app is installed.
- Fallback: the Garden's door goes straight to the 2D Shop when the guard has `3d` off; if the 3D cannot start the plain card now has a second button
  "Open the normal shop" (new `fallback` prop on Walk3D); Back from a Shop-opened 3D shop is the 2D Shop. No crash path closes the app: a tap that makes the
  scene throw (the check saw the scene throw on a tap near himself; the cause is read from its path code, not proven) is caught in Walk3D.
- Walk3D additions, all backward compatible: `onTap` (the shop picks, then walks), `hideStick` (a card is open), `fallback`, `loading` words, the screen's
  buttons now sit above the loading cover (Back works while it loads), and "Show 3D speed" counts draw calls from the GL itself (the shop's own count is
  only its last pass: it said 1 draw). The triangle count shows "?" when the scene's count is only the last pass.
- Shared files changed in the app: `Garden.tsx` (shop door), `Shop.tsx` (3D button, focus params), `areas/world.tsx` (screen), `assetList.ts` / `assets.ts`.
- Not done on purpose: the casual clothes from the house's wardrobe (the shop player wears the club kit; they come with WP3), the old-body retry (the old
  character files are not bundled; if the new body fails the plain card shows), approved 3D Scene Editor edits, the test page's club switch / pretend Buy.
Files added to the app: **9.3 MB** (30 generated models `*-hf.glb` 9.05 MB, the room's four maps and the baked light 0.27 MB) + 0.11 MB for the website's
newer `mocap.glb` (the phone copy was stale: `three-check` now passes that file). The website's shop folder is 26.6 MB because it also holds the packed
`*.ktx2.glb` twins (need WebAssembly: off on the phone), the older Blender models and the Draco decoder: none of those are bundled. The `-hf` models are
meshopt-packed (not Draco), so none needed unpacking; the six `car-N.glb` already in the app (WP1) are not used by this look and not read by the shop.
Every file the scene read is in `assetList.ts`: `walk-check --place shop` lists 40 files (the 10.1 MB above includes the player and clips that were already in).
What was checked:
- SEEN (web build of the app, 412x915 and 360x780 at 2x, real Chromium touches, software GL): from the Garden: stand at the shop door, the "Shop ›" card,
  tap it, the shop opens at the doors (z 4.6 of 8); stood at each of the six displays (start, boots, cars, cans, counter, homes) and every card opens by itself with
  its levels and prices; stick moves him (2.8 to 3.8 m in 5 s), a tap on the floor starts a walk, a drag turns the camera, a real tap on the turntable opens the
  car card; "See it in the shop" lands on the Shop's Cars tab with the Motorbike sheet open at L5 (the card's level); the Shop's 3D button opens it (starts
  mid-room); the doorway leads out to the Garden; Back returns to the Shop and leaves no GL canvas behind. Stills are in `phone/tools/look/shop-shots.mjs`
  (`node phone/tools/look/shop-shots.mjs --sizes 412x915,360x780 [--speed]`, needs `build-web.mjs` first).
- SEEN (no-DOM run, `cd phone && npx tsx tools/walk-check.ts --place shop`; a Web Worker, so no document, like Hermes): starts in 12 s; all 40 files bundled; the
  buy gesture, camera-in on a card, five picks, the doorway calls `onDoor`; pause holds frames (0 in 1.5 s), resume brings them back; everything is put back on leaving.
  `--step 0.1` makes each frame move the game 0.1 s (software GL draws 1 to 2 frames a second, the dwell timer needs game time). The garden check still passes.
- Checks: match-parity 12/12 identical, career-flow, screens, world, boot, match-features pass; tsc 9 errors (the old 9 in ../lib); Android Metro export OK (Hermes bytecode 17 MB).
  `three-check` has one failure that is not from this work (`tools/three-interp-bench.ts` is missing, so its no-JIT run cannot start).
- Numbers (software GL, so only draw counts and JS time mean anything): 68 draw calls a frame at the start spot at Low (GL-counted, 360x780); the scene's JavaScript
  costs about 2 to 3 ms a frame in V8 (Hermes has no JIT: several times that). 22 to 27 s from the door to a walking shop in the web build (software GL: most of it is
  shader work a phone's GPU does faster). Quality: the phone rule from WP1 (a small screen opens one step lower: Low on the 412 and 360 wide stills).
- REASONED, not seen: that Hermes runs the scene as the worker did (the worker has no document/WebAssembly like Hermes but is still V8); frame rate and heat.
Only a real phone can say: fps and heat at each tier on the S20+ (the shop is heavier than the garden: look H bloom and 2 to 3 lights), start time from the Garden's
door, whether expo-gl gives the half-float targets the H pass wants (the web check warned "HALF_FLOAT_OES" once, as before), memory with 9 MB of models decoded
(a car and a home are held at most two at a time by the scene), touch feel of tap-versus-drag (a 10 point wobble limit), Back and the doorway while it loads.

## Needs from Mikey (collected, asked at the end)
- The 3D shop draws prices with a pound sign (the website's scene paints "£" on every tag and card) while the app's 2D Shop shows "★". Same as the website;
  say if you want the card at least to use the app's sign (the tags inside the picture cannot change without touching the website's scene).
- The "BETA" tag on the 3D shop's top bar is copied from the website. Keep or drop?
- The casual clothes from your wardrobe in the shop come with WP3 (your house).
