# perf3d — measure a 3D scene without running Next

Runs the REAL scene modules (`lib/star/garden3d/scene.ts`, `shop3d/scene.ts`,
`signing3dScene.ts`) in a bare page with the real GLBs, in headless Chrome,
and times every frame. Built 5 Oct 2026 for the shared perf layer
(`lib/star/three3d/perf.ts`); use it to check a scene before and after it
adopts that layer.

```bash
node scripts/perf3d/build.mjs        # bundles into scripts/perf3d/www (npx fetches esbuild)
node scripts/perf3d/serve.mjs &      # port 3502; serves www/ and public/star/
node scripts/perf3d/drive.mjs garden '{}' --dpr=1 --steady=20000 --exp=ab_shadowpass
python3 scripts/perf3d/sum.py results.jsonl   # if you saved the lines
```

- **No GPU here.** Headless Chrome draws with SwiftShader (software). Frame
  times are 10-100× a phone's; read the % change, not the ms. `--throttle=4`
  (default) slows the page's own thread 4× like a phone; it does not slow the
  software GPU.
- **Same-page A/B** (`exp/ab_*.js`): A and B alternate every 3 frames in one
  page, so both see the same machine load. Trust these over two separate runs
  — on a shared machine two runs of the same thing differed by up to 50%.
- `--nofinish` times only `render()` on the page thread (draw-call cost);
  default waits for the picture to finish (pixel cost).
- `--shot=file.png` saves the screen at the end, to check the look by eye.
- The scenes' own "slow → drop to low quality" fallback is switched off in
  the harness (`fixedStep`), or it would fire on this machine every time.

Other pages: `mini.mjs main|worker` (the same garden-sized scene on the
page vs in a Web Worker, and how much the page froze), `hop.mjs fresh|shared`
(entering a scene 4 times with a new renderer each time vs one kept).
`squeeze.mjs` measures GLB sizes with meshopt (see its header).

## Shrinking the model files (`shrink-models.mjs`, 6 Oct 2026)

The GLBs the 3D scenes load are packed small **in place**: meshopt geometry
and clips (`EXT_meshopt_compression`), clip keys resampled (1e-4 tolerance),
JPEG/PNG textures as WebP (iOS 14+). Draco files stay Draco where Draco is
smaller over the wire (props, boots, cars). Each file has a policy in the
script saying which vertex data may become 8/16-bit, because some game code
reads raw vertex data (`people3d.ts` dequantize, `dressInKit`, the garden's
pieces).

```bash
npm i --no-save @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4 meshoptimizer draco3dgltf sharp
node scripts/perf3d/shrink-models.mjs                 # every file, in place (already-packed files are skipped)
node scripts/perf3d/shrink-models.mjs --out=/tmp/x star/onebody/player.glb   # a try, written elsewhere
```

- **Every GLTFLoader must call `withMeshopt(loader)`** (`lib/star/three3d/meshopt.ts`,
  three's own decoder). A loader without it fails on these files.
- **Rebuilds:** `build_onebody.py`, `build_people3d.py`, `tools/shop3d/build_assets.py`,
  `tools/garden3d/build_anims.py` and `tools/garden3d/export_models.py` run it at
  their end (`shrink_after_build.py`); without the tools they print the command.
  `build_onebody.py` reads the plain people3d bodies: its header says how to get them back.
- **A new 3D file** needs a POLICY line in the script before it can be packed.
- `exp/old_people.js` switches a harness run to Settings → Look → "3D people: Old";
  `drive.mjs garden '{"look":"old"}'` / `shop '{"look":"old"}'` use the old player.
