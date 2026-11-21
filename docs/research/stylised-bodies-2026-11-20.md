# Stylised bodies, movement and lag at scale — research (20 Nov 2026)

Asked by Harry: "deep deep research on 3D modelling and any repos that offer help for
stylised 3D human bodies … these fixes may also come in handy for the 3d engine and 3d
training + 3d spaces and moving in them … lag scaling". Style stays the game's toon style
(RUL-3D-009); the goal is CORRECT bodies. [S] = read in a source, [R] = reasoning, not
verified. Licences are from listing pages: read the file in each download before use.
Licence pages saved in the session scratchpad (research-stylised/).

## Problems we are fixing
Proportions off; legs into the body when sitting; hands/wrists/arms "super weird"
(candy-wrapper twist, bent wrists, finger poses); bodies through each other and props;
poor contact when holding/picking up; everyone (managers) looking the same; foot sliding;
lag with many people.

## Tools / repos
| Tool | Licence | Use for us |
|---|---|---|
| MPFB2 / MakeHuman | CC0 assets and output; add-on code GPL/AGPL [S: static.makehumancommunity.org/about/license.html] | body sliders, finger rig, runs headless in Blender; the "realistic" proportions Harry liked come from here |
| Blender BVHTree (mathutils.bvhtree) | built in | overlap() finds intersecting triangle pairs, self-overlap too [S: docs.blender.org/api/4.3/mathutils.bvhtree.html] → the intersection tester |
| Quaternius Universal Base Characters | CC0 [S: quaternius.com/packs/universalbasecharacters.html] | ~13k-tri stylised bodies, humanoid rig: reference for rig layout and proportions (check finger/twist bones in the file) |
| three-mesh-bvh | MIT (secondary listing) [S: github.com/gkjohnson/three-mesh-bvh] | in-browser overlap checks; capsule character vs walls |
| @pixiv/three-vrm | MIT | copy the Roll-constraint idea (twist bones); do not convert to VRM |
| three-pathfinding | MIT [S: snyk.io/advisor/npm-package/three-pathfinding] | navmesh for staff walking rooms |
| recast-navigation-js | Recast/Detour zlib; JS repo licence to confirm | crowd walking with avoidance (WASM) |

Rejected: MB-Lab (AGPL models), CharMorph (mixed CC-BY/AGPL bases), UniRig (no licence,
needs a CUDA GPU), Rigify (fragile game export), Kenney (too blocky), Mixamo (no twist
bones, little over our own mocap), Auto-Rig Pro (paid), dual-quaternion skinning (not in
three.js; WebGPU port had wrong normals; bulges knees/elbows).

## Techniques (in order of value)
1. **Twist bones**: 2 per forearm, 1 on upper arm and thigh, weight ramp, copy a fraction
   of the hand roll; bake into the clips (no runtime code). Fixes candy-wrapper wrists.
   None exist in the repo today.
2. **Intersection tester**: bake the skinned mesh per frame, split by vertex group, BVH
   overlap body-vs-body and body-vs-prop; use an epsilon and a known control case.
3. **Sitting fix**: repaint hip weights, hip/knee/thigh limits in pose authoring, a hip
   corrective shape (bake shape-key drivers before glTF; drivers don't export).
4. **Grip presets**: JSON finger angles per prop + a socket empty on each prop; close the
   fingers step by step until contact (as the first-person phone hand does). Phone,
   contract, trophy, ball, pen, cup.
5. **Two-bone IK** with a pole target for hand-to-prop and foot-to-ground (three.js only
   ships CCDIKSolver; two-bone is small to write).
6. **Proportion gate** in the build using lib/star bodyMeasure.ts (stylised ≈ 2–4 heads).
7. **Variety**: seeded morph targets (face, nose, jaw, age, build), hair/skin/clothes swaps.

## Movement in 3D spaces
- In-place clips, root driven by game code; **stride warping** (playback rate matched to
  speed) [S: SIGGRAPH 2021 talk "The Right Foot in the Wrong Place"]; lock planted feet using
  the clips' existing `plants` data.
- Two-bone leg IK to pin planted feet and set pelvis height.
- Short turn-in-place (90/180) and start/stop clips, 0.1–0.2 s cross-fades.
- Motion matching: no light three.js library; skip.
- Walls: three-mesh-bvh capsule + one merged static collider.
- Pitch players don't need a navmesh (the 2D engine steers them).

## Lag at scale
- Mobile WebGL bone limits: uniforms cap around 27–59 bones on older phones; past that the
  bone-texture path (float textures) [S: three.js #13288, #16687; 2014–18 sources, re-test].
  Our rig with fingers is likely > 50 bones → drop fingers on far LODs.
- No built-in instanced skinning in three.js; for crowds use **vertex animation textures**
  (VAT) with a custom shader, or community InstancedSkinnedMesh / @three.ez/instanced-mesh
  (licences unchecked). VAT loses blending/IK: crowd only, never the 22 players.
- Budgets (other engines): ~100–200 draw calls on low-end mobile [S: PlayCanvas guidelines];
  Unity: 250 characters ≈ 1,100 draws vs 800 instanced ≈ 50 [S: Unity blog].
- LOD0 near (full), LOD1 mid (no fingers/twist, ~½ tris), LOD2 far (very low / impostor);
  update far mixers every 2nd–4th frame; one kit atlas and one face atlas.
- Order: measure on a real mid Android with the frame meter → bone/LOD trim → update
  throttling → crowd VAT only if the stands still lag.

## Recommended path
1. Intersection tester over all clips and bodies (1–2 days)
2. Twist bones baked into clips, re-run tools/motionref/settle_clips.mts (2–3 days)
3. Hip weights + sit-pose rules (1–2 days)
4. Grip presets + sockets for 5–6 props (2–3 days)
5. Proportion gate (1 day)
6. Seeded variety + manager silhouettes (3–5 days)
7. Stride warp + foot IK; then LOD/throttle; crowd VAT if needed
Effort figures are estimates, not measured. Hard parts: weights are per body (script the
ramps); baked twist can disturb arms already tuned by settle_clips; no free pack fixes our rig.

## Skill ideas for the agents
intersect-check · twist-rig-standard (bone names, weights sum to 1, 120° wrist-roll render
test) · grip-presets · sit-pose-rules · proportion-gate · variety-seed (24-person contact
sheet before merge) · look-at-it (render the worst failing frame and show it).
