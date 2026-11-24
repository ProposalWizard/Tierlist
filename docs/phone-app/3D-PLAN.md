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

## WP3 notes (your 3D house and the 3D phone in your hand, 24 Nov 2026)
What it is: `phone/src/screens/world/House3D.tsx` (`HouseView`) runs the website's own `lib/star/home3d/scene.ts` (not touched) through `Walk3D` and `walkHost`,
with the website's `Home3D.tsx` screen copied line for line: Back pill, the home's name, trophy count, room name and dots, the hint, and the cards (wardrobe with
Clothes / Kits / Boots, trophy cabinet, drive window, a living house's thing and team-mate cards, "Sleep till morning"). `phone/src/three/houseScene.ts` (the start),
`houseDeps.ts` (the scene's `import()`s named for the bundler) and `houseData.ts` (the website's `homeSceneData`, `livingFor`, sleep; no React, so the checks use it).
- Ways in: the Garden's house door (a "Your house ›" card, then the door; Back and the front door both go back out at the house's door: `comeBack = "house"`), the phone's
  new "Your house" app (hidden when the crash guard has `3d` off), and the nav screen `house` (`{ from?: "garden" | "phone" }`).
- The wardrobe saves on the career (`withOutfit`) as on the web: the Shop 3D now passes `worn: wornAt(career, "shop")` (the WP2 gap) and the Garden already did.
- The 3D phone in your hand (`screens/world/HousePhone.tsx`, as the web's `HousePhone.tsx`): the Phone tab (nav `phone`, now `PhoneRoute`) opens the hand holding the phone with the
  app's REAL phone screen (`Phone.tsx`, new `glass` prop: no backdrop, top bar or tab bar, fills the box) on the glass, your house loading behind it after 2.5 s in idle time and HELD
  (`HomeController.hold`: one frame, then no loop, so the phone costs nothing to run). Same moves as the web: eye-opening (0.6 s), BACK on the phone's home screen = hand lowers, camera
  eases out of your eyes into the house; "📱 Phone" pill takes it out again; "Your house" app = put away into the house; HOME = Home screen; a tap during a move skips it;
  Kickabout brings the glass flat. The web only opens it where `phone3dCan()`: here the 3D not off by the crash guard, not the Low tier, and the first-visit phone tour seen;
  else the flat phone as before (so the 2D fallback is the phone that was already there). A house that fails to start while the phone is up leaves the blurred room picture behind it.
- Walk3D additions (backward compatible): `inert` (no touch layer, no stick, no spinner: the house behind the glass), and `standIn.ts` now ignores a real browser node's read-only `parentNode`.
- Files added to the app: **3.5 MB** in 51 files (home3d: 8 boots, 6 cars, bike, jet, furniture, terrace props = 2.1 MB; the people-clip file `anims3d/casino.glb` 0.07 MB (a clip file the living
  rooms sit and cheer with, NOT the casino game); team-mate bodies toon-p7 to p9 0.84 MB; 30 hair files 0.72 MB) + 0.07 MB for the hand and the blurred room picture. Hermes bytecode 18 MB (was 17).
  The team-mates' bodies and hair are seeded per squad id, so all of them are bundled (a missing one would only lose that team-mate: the scene catches it and the house goes on without people).
- Differences from the web, on purpose: the web bends the phone onto the glass with a CSS matrix3d (full perspective); the phone's views take a turn and a scale only, because RN's
  hit-testing on Android follows a 2D matrix (a bent view would take taps in the wrong place). `glassFit()` is the best flat fit to the four corners: 6.8 degrees, x 0.574, y 0.657, worst
  corner 11.8 points out of a 390 x 844 picture (the phone's own edge-lit frame covers it; SEEN in the stills, it sits on the hand's phone). The house behind the phone is dimmed
  (a dark layer at 42%), not blurred (no cheap blur on the GL view). The club badge on the living room's cinema screen is missing (the scene draws an SVG `<img>`; the phone's canvas
  stand-in says "not supported yet", a warning only).
- SEEN, no-DOM run (`cd phone && npx tsx tools/walk-check.ts --place house [--tier starter|flat|penthouse|house|villa|estate] [--living off] [--sizes 412x915]`; a Web Worker like Hermes):
  the `house` home starts in 5 to 7.5 s; all 7 rooms visited (hallway, lounge, kitchen, bedroom, bathroom, trophy, garage); every file read is in `assetList.ts` and the bundled copy is used
  (11 at start, 16 after the rooms); the two clothes changes (kit, tracksuit) resolve; in his eyes and HELD = 0 frames in 2.5 s, then 2 to 3 frames in 2.5 s once released; pause 0 frames,
  resume brings them back; everything put back on leaving. The old one-room house (`--living off`): the wardrobe, cabinet and drive cards open by walking to them (near= each, 2 to 3 s).
  Software GL numbers (relative only): hallway 35 draws / 24k triangles, lounge 55 / 71k, kitchen 43 / 26k, bedroom 40 / 23k, bathroom 37 / 22k, trophy 37 / 30k, garage 46 / 125k;
  JS 2.5 to 3.8 ms a frame in V8 (Hermes has no JIT: several times that); a room swap 1.1 to 4.1 s here (the fade hides it).
- SEEN, web build (`node phone/tools/look/build-web.mjs`, then `node phone/tools/look/house-shots.mjs --sizes 412x915,360x780`; real Chromium touches, software GL, 3D quality set to Medium as an
  Android phone gets on Auto): Garden door card -> "Your house ›" -> the house up on top of the Garden (22 to 29 s here); a real finger tap on the wardrobe opens its card, a tap on "Club tracksuit" changes
  him and saves `career.outfit`; the cabinet card; the stick (2.2 to 2.7 m in 5 s), a tap on the floor, a drag; the front door walked out of with the stick -> back in the Garden at the house's door (x 16.2 of 18);
  the Phone tab: eye-opening, the hand and the real phone on the glass, a real tap on Squad opens the Squad app, BACK inside an app returns to the grid, the house loads behind it (`houseReady`), BACK on the
  grid lowers the hand and the house shows with the Phone pill, the pill brings the phone up again, "Your house" on the grid puts it away, HOME leaves for the Home screen; no big GL canvas is left after.
  The Shop 3D wears the hoodie from the wardrobe (walk-check --place shop still). Stills for 412x915 and 360x780 were looked at; they are in the session's scratchpad, not the repo.
  A web-only error is logged ("house: team-mates ... drawImage"): the web build mixes a real canvas with the stand-in's pictures, so the living rooms' team-mates are missing in the web build; the
  no-DOM run (the phone's own path) shows them seated in the lounge. REASONED, not seen on the phone.
- Checks: match-parity 12/12 identical, match-features, career-flow, screens, world, boot-sim pass; tsc 9 errors (the old 9 in ../lib), none new; Android Metro export OK (hbc 18 MB).
  `walk-check` now has `--place house` (every room, the wardrobe change, hold) and `--step` defaults to 0.1 for the shop and house.
- REASONED, not seen: that Hermes runs the house as the worker did (same as the garden and shop); that the held house costs nothing on the phone (the loop stops: seen as 0 frames in the worker);
  that Android's hit-testing follows the flat turn and scale exactly (it does for 2D matrices; seen only in the web build, where the browser does it); the touch feel of dragging the phone UI at 0.57 scale.
- In a living house a card for the wardrobe or cabinet does not open when he is only placed there by the check (the scene keeps the arrival shot until he moves, `quietArrival`); walking there with a
  finger or the stick does open it (SEEN in the web build).
Only a real phone can say: fps and heat in the house at each tier (the house is lighter than the shop: 22 to 125k triangles a room; the garage's cars are the heaviest), the time from the Garden door and
from the Phone tab to a house behind the glass, memory with the house, the phone's apps and the GL all alive at once (the Phone tab holds a house in memory while you use the phone), whether taps land right on the
turned glass on Android, scroll lists (Squad, Fixtures) dragging inside the turned box, the 0.6 s eye-opening's smoothness (it animates only opacity and a transform), expo-gl's Reflector (the mirror) and
half-float targets, the GL surviving a trip to the background with the house behind the phone.
Not done on purpose: the website's CSS blur behind the phone, the true perspective bend of the glass, a 2D house (the website has none either: its error card says the phone may not run 3D),
the 3D Scene Editor edits for the house, the test page's tier / cam switches.

## Needs from Mikey (collected, asked at the end)
- The 3D shop draws prices with a pound sign (the website's scene paints "£" on every tag and card) while the app's 2D Shop shows "★". Same as the website;
  say if you want the card at least to use the app's sign (the tags inside the picture cannot change without touching the website's scene).
- The "BETA" tag on the 3D shop's top bar is copied from the website. Keep or drop?
- The casual clothes from your wardrobe in the shop come with WP3 (your house).
- Your house and the 3D phone (WP3): keep the dim behind the glass or do you want a blur? (a blur needs a still picture of the house made once and blurred: a small extra job).
- The "Your house" app is on the phone's grid for everyone, as on the website (shown from the start, like the Garden). Say if it should come from the App Store like the Garden.
- The phone's glass is a flat fit (see WP3 notes). If the corner at the bottom right looks off on the real phone, the hand picture can be redrawn flatter (a design job).
