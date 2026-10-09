# Generated footballer model test (Harry, 9 Oct 2026)

A test, not part of the game. Three invented stylised footballers: concept picture
(GPT Image 2.5) → 3D (Tripo H3.1 image-to-3D, ~10k triangles, textured) → fitted to
the game's MakeHuman skeleton so every mocap clip plays on them → rendered in look A
(cel shading, from `tools/styletest`).

```bash
S=<scratch>   # holds human_s.glb, mocap-unpacked.glb and gt/ (see tools/styletest/README.md)
D=$S/model-test          # c1/gen.glb, c2/gen.glb, ... (the Tripo downloads) + c*/concept.png
bash tools/modeltest/run_cand.sh $PWD $S $D/c1 -90   # fit + clips + quick Workbench previews (Tripo faces +X: turn -90)
bash tools/modeltest/render_all.sh $PWD $D "c1 c2 c3" # tear check + look-A renders (pitch, close, shop, run)
blender -b --python tools/modeltest/render_cand.py -- $D/c1/anim.glb $PWD $D/c1/look face
python3 tools/modeltest/sheet.py $D c1 c2 c3          # sheet.jpg
```

How the fit works (`fit.py`):
1. Scale the model so its crotch sits at the MakeHuman crotch height: same leg length,
   so the clips' hip height is right.
2. Find his joints from the mesh (ray cast for the crotch, slice centroids for knees and
   ankles, narrowest slice for the neck, the lowest far-out point for each fingertip).
3. Temporary armature on those joints, bone-heat weights, then far-bone leaks pruned
   (a hand bone weighting a boot) and smoothed.
4. Bend his arms and legs into the MakeHuman rest directions (done in Python, not pose
   mode) and bake.
5. Move the MakeHuman bone heads onto his joints, keeping every bone's direction and
   roll, so each clip's rotations mean the same on him. Export.

`addclips.mjs` copies clips from mocap.glb by bone name (the same as three.js does).
`tearcheck.py` plays run, kick and sprint and reports the largest gap any edge opens.
The fitted model is ~2 m tall (cartoon head); `render_cand.py` scales the root node to
1.83 m, which also scales the clips' hip movement.
