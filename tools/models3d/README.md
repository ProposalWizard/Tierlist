# Model prep tools (Higgsfield picture -> 3D -> game-ready GLB)

Used for every generated shop item (cars, boots, homes, watches...) and for
the new stylised bodies. Full steps: `docs/3D_HANDBOOK.md`, section 4.

```bash
cd tools/models3d && npm i        # installs the glTF tools next to the scripts
node prep.mjs raw.glb out.glb 24000 [1024]      # weld, simplify to <= 24000 triangles, textures <= 1024 px
node deplate.mjs in.glb out.glb [debug.png]     # cars only: paints invented number plates plain dark grey
node info.mjs a.glb b.glb                       # triangles, textures, materials
node inspect.mjs a.glb                          # vertex attribute types and ranges
WORK=./work OUT=./public/star/shop3d/items bash prep_batch.sh car 24000 hatch suv    # raw/<name>.glb -> items/car-<name>-hf.glb
```

If the packages live somewhere else, set `GLTOOLS=<folder with node_modules>`.
After prep: add a POLICY line in `scripts/perf3d/shrink-models.mjs` and run it
(that makes the file small). Add a line to the folder's `LICENSE.txt`.

`examples/hf-car/` is one real run, kept as a sample: `car.png` is the picture
the model was made from, `raw.glb` is the untouched Higgsfield download.
