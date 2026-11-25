# The app's garden with the ride (KIB RIDE, 25 Nov 2026)

Mikey: "this is all for the app version, not the website". The website's garden (`lib/star/garden3d/scene.ts`) has no riding and no
driving, and `lib/` must not be edited for this, so the app has its own copy of the scene.

| File | What |
|---|---|
| `sceneRide.ts` | `lib/star/garden3d/scene.ts` copied, its `../x` imports turned into `@/lib/star/x`, plus the ride. Every change is marked `// KIB RIDE` (search for it: about 40 places, one block of about 420 lines before `const clock`). |
| `ride.ts` | The numbers: gaits, the horse's steering, the car's arcade physics, collision for a body made of circles. No three.js, so `tools/ride-check.ts` runs it alone. |
| `../gardenScene.ts` | Starts `sceneRide`; if that throws while starting it starts the website's own scene instead (no ride, buttons off). |

Used only by `src/screens/world/Garden.tsx`. The 3D shop, house, training and the rest still use the website's scenes.

## Bringing it back in step with the website's garden

The copy was taken from `lib/star/garden3d/scene.ts` at commit `5325312e9` (KIB Next: money sign question for Mikey). When the website's scene changes:

```bash
git diff 5325312e9 -- lib/star/garden3d/scene.ts > /tmp/garden.patch      # what the website changed since the copy
sed -i 's#a/lib/star/garden3d/scene.ts#a/phone/src/three/garden/sceneRide.ts#; s#b/lib/star/garden3d/scene.ts#b/phone/src/three/garden/sceneRide.ts#' /tmp/garden.patch
# the copy's imports were rewritten (`"../x"` -> `"@/lib/star/x"`), so the patch's import lines will not apply: apply with --reject and redo those by hand
git apply --3way --reject /tmp/garden.patch
```

Then `grep -n "KIB RIDE" sceneRide.ts` and check each marked place still sits where it should: the places are

1. imports from `./ride`, the `RideInfo` / `RideApi` types, `onRide` in the callbacks, `ride` on the controller, `fixedStep` on the data (checks only);
2. the cars (`carRecs`, the shadow as a child of the car, `hold()` on the picture that stands in for a far car);
3. the horse (`horseAnims`, `horseLoose`) and the horse's own walk-about guarded by `rMode !== "horse"`;
4. the big block before `const clock` (state, mount, dismount, camera offsets, `rideApi`);
5. in the frame: the walking is wrapped in `if (!rideOn) { ... }`, the camera takes `rcam`, the scan/emit, `mode` in `stats()`;
6. `tap` (a tap on the horse or a car), `place` (puts him down), `dispose`.

Checks: `cd phone && npx tsx tools/ride-check.ts` (the numbers alone), `npx tsx tools/walk-check.ts --place garden` (the scene in a worker, with the
ride flow), `node tools/look/garden-shots.mjs` (stills; needs `build-web.mjs` first).
