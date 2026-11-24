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
Not done on purpose: the web's "still 2.5x / moving 1.5x" pixel ratios (the GL buffer is one fixed size per tier),
KTX2 packed textures (need WebAssembly; `window.__ktx2Off` is set), the 3D phone in your hand.

## Needs from Mikey (collected, asked at the end)
(none yet)
