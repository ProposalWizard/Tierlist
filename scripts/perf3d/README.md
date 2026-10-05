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
