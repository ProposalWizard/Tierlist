# Rebuilding ONE clip in mocap.glb (22 Oct 2026, Leo, chat 1)

`build.py --only X` writes ONLY the listed clips (it would drop every other
clip from mocap.glb), and re-running `settle_clips.mts` on the whole file
changes other clips. So to replace one clip (first used for the knee slide,
whose knees pressed together):

1. build the clip alone into a scratch folder (`build.py --only knee_slide --out <scratch>`; a keyed clip needs no CMU files),
2. settle that one clip (`tools/motionref/settle_clips.mts`),
3. `splice.mjs` it into the committed `public/star/anims3d/mocap.glb` / `mocap-ual.glb` (replaces the clip and its meta, keeps the order),
4. pack with `scripts/perf3d/shrink-models.mjs`, then compare every other clip (they should be within re-quantization).

`rebuild.sh` is the whole pipeline as it was run (paths point at the scratch
folder used then; edit them). `measure-knee-slide.py` measures joint-to-joint
distances across the clip (knees 5.1 cm → 33 cm apart after the fix).
