# Style A bodies at real proportions (B5b, 20 Oct 2026)

Harry rejected bone-scaled proportions (20 Oct, 16:29: "none of those body proportions look
remotely good"). These are three ways of making the BODY itself right, each ending in an ordinary
Style A body file (`public/star/people3d/toon-<tag>.glb`) built by
`scripts/people3d/build_toon_bodies.py`, so every one keeps the toon shader, kit paint, skin
tones, the moving face, the clips and the hands. Judged on the bench's Body page
(`/star-3d-bench-dev/body?file=/star/people3d/toon-<tag>.glb`: the guide outline of a real
1.83 m footballer and the measures beside it) and in the game's scenes with `?bodies=<set>` on a
test page (`TOON_BODY_SETS` in `lib/star/style3d/toon/bodies.ts`; the real game never sees it).

| Way | Tag | How | Script |
|-----|-----|-----|--------|
| A | `a1` | the MakeHuman player (lib/star/human3d) in its kit, the Style A head (Curls) and neck put on | `graft.py` → `paint_atlas.py` → build |
| B | `q1` | a new body generated at real proportions on Higgsfield (`q1/concept.jpg` → Tripo image-to-3D `q1/gen.glb` → `tools/modeltest/fit.py` → `q1/fit.glb`) | fit.py → build |
| B1–B3 | `b1` `b2` `b3` | B made leaner and upright (Harry 17:46: "arms and body too big for the head … a bit like a dinosaur") | `reshape.py` on `q1/fit.glb` → build |
| C | `r1` | today's Curls body, its mesh re-shaped (smaller head, longer neck, legs and arms, broader chest) | `reshape.py` on the Curls fit → build |

**Kept (20 Oct, after Harry's 18:41 notes): B (`q1`) and B2/B3 with today's face (`f2`, `f3`).**
A, C and B1–B4 were judged and dropped; their files are not in `public/`, the commands below remake them.

B2/B3 with today's face: B's fit re-shaped flatter (`RS_CHESTD`), then today's Curls head and neck put
on it (the head's own picture, eyes and moving face), its own neck kept only under the collar:

```bash
# B2: RS_FOREARM=0.74 RS_HANDS=0.86 RS_HEADBACK=0.02 RS_NECK=0.8 RS_CHESTD=0.6 … reshape.py q1/fit.glb b2f/fit.glb 1.0 1 1 0 0.88 0.95 0.95 0.8
# B3: RS_FOREARM=0.8 RS_HANDS=0.9 RS_HEADBACK=0.015 RS_NECK=0.85 RS_CHESTD=0.65 … reshape.py q1/fit.glb b3f/fit.glb 1.0 1 1 0 0.92 0.97 1 0.86
python3 tools/bodies/dump_fit.py $S/b2f/fit.glb $S/f2/body.json
GRAFT_KEEPNECK=1 blender -b --python tools/bodies/graft.py -- $S/f2/body.json $S/p1/fit.glb $S/human_s.glb $S/f2/fit.glb 0.277   # B3: 0.295
python3 tools/bodies/paint_atlas.py $S/f2/paint.npz $S/f2/mh_skin.png $S/f2/atlas.png
TOON_REAL=1 TOON_TEX=2048 TOON_BASE=$S/f2/atlas.png python3 scripts/people3d/build_toon_bodies.py $S f2:f2/fit.glb
```
`$S/p1/fit.glb` is today's Curls body fitted again: `tools/modeltest/fit.py` on `tools/modeltest/p1/gen.glb`, yaw -90.

Build every one with `TOON_REAL=1` (the file keeps its own head, neck and hand size: `meta.look`,
and its kit lines sit at the cloth's own edges). Then measure its face
(`node scripts/bench3d/faces.mjs --files=/star/people3d/toon-<tag>.glb --write` → 
`lib/star/style3d/toon/faceFileLandmarks.ts`), or the moving face uses another head's eyes.

```bash
S=<scratch>   # human_s.glb and mocap-unpacked.glb as tools/modeltest/README.md says
# B1 (lean): head legs arms neck chest hips girth armg, plus the RS_* dials (reshape.py's header)
RS_FOREARM=0.8 RS_HANDS=0.9 RS_HEADBACK=0.015 RS_NECK=0.85 RS_CHESTD=0.85 \
  blender -b --python tools/bodies/reshape.py -- tools/bodies/q1/fit.glb $S/b1/fit.glb 1.04 1 1 0 0.92 0.97 1 0.86
TOON_REAL=1 python3 scripts/people3d/build_toon_bodies.py $S b1:b1/fit.glb
# B2 (leaner): RS_FOREARM=0.74 RS_HANDS=0.86 RS_HEADBACK=0.02 RS_NECK=0.8 RS_CHESTD=0.8 … 1.04 1 1 0 0.88 0.95 0.95 0.8
# B3 (bigger head): as B1 with head 1.09
# A: dump the MakeHuman player off the bench (window.__dumpBody() on /star-3d-bench-dev/body?kind=human) to human.json, then
blender -b --python tools/bodies/graft.py -- human.json $S/p1/fit.glb $S/human_s.glb $S/a1/fit.glb 0.26
python3 tools/bodies/paint_atlas.py $S/a1/paint.npz $S/a1/mh_skin.png $S/a1/atlas.png
TOON_REAL=1 TOON_TEX=2048 TOON_BASE=$S/a1/atlas.png python3 scripts/people3d/build_toon_bodies.py $S a1:a1/fit.glb
```

Notes
- This machine's Blender 4.0 package bakes nothing with Cycles (a plane bakes black), so `graft.py`
  writes what each triangle reads and `paint_atlas.py` paints the picture in numpy.
- `tools/modeltest/fit.py` takes `FIT_CROTCH` when the ray would find a shorts hem, not the crotch.
- Higgsfield items made for B: `docs/handoffs/2026-10-20-builds/b5b/higgsfield.md`.

## B5d: a cartoon body for our cartoon faces (20 Oct 2026)

Harry (20:15): "nah the b2 + today's face is ass, gotta try and keep our cartoon like faces." So no new
body and no head graft: TODAY's own Style A bodies (Curls `p1`, Buzz & beard `p3`), re-shaped in Blender
by `reshape.py` into a stylised cartoon athlete. One mesh, so no neck seam; the head is today's head moved
and scaled as one piece (`RS_RIGIDHEAD=1`), so the face, its paint and its shading are today's.
See them with `?bodies=d1|d2|d3` (test pages only). Sheet: `docs/handoffs/2026-10-20-builds/b5d/`.

| Set | What | Heads tall (bench) |
|-----|------|-----|
| `d1` | A: today's body grown up: same chunky shapes, longer thighs, a less boxy chest | ~6.0 |
| `d2` | B: slim stylised athlete: slimmer limbs and trunk, narrow hips, longer arms | ~6.5 |
| `d3` | C: hero V: broad natural shoulders, narrow hips, long legs, hands a touch bigger | ~6.3 |

New reshape.py dials (all default "no change", so B5b's commands still remake B5b's bodies):
`RS_RIGIDHEAD=1` the head moves as one piece; `RS_SHIN` the shin's own stretch (then `legs` is the
thigh's: today's bodies are short in the thigh, not the shin); `RS_CHESTD_FROM` where the chest
flattening starts above the hip joint. Today's runtime dials (head 1.1, neck 1.25, hands 0.88) are BAKED
into these files (head factor x1.1, `RS_NECK=1.25`, `RS_HANDS` x0.88) and the file says `look: 1,1,1`,
as bodyGuide.mts asks of a judged body. `TOON_HEIGHT` (build_toon_bodies.py) keeps the man today's height (bench: 1.863 m Curls, 1.861 m Buzz).

```bash
S=<scratch>   # human_s.glb as tools/modeltest/README.md says; p1/fit.glb, p3/fit.glb = fit.py on tools/modeltest/pN/gen.glb, yaw -90
export RS_RIGIDHEAD=1 RS_CHESTD_FROM=0.07 RS_NECK=1.25
# d1 (Curls; the Buzz head takes head 1.1 / 1.056 / 1.078 so every head lands at the same heads-tall)
RS_SHIN=1.13 RS_HANDS=0.88 RS_CHESTD=0.94 blender -b --python tools/bodies/reshape.py -- $S/p1/fit.glb $S/d1/fit.glb 0.99 1.6 1.12 0.006 0.97 0.98 1.06 1.04
# d2
RS_SHIN=1.2 RS_FOREARM=0.86 RS_HANDS=0.968 RS_CHESTD=0.86 … reshape.py -- $S/p1/fit.glb $S/d2/fit.glb 0.946 1.9 1.2 0.012 1.0 0.92 0.9 0.88
# d3
RS_SHIN=1.16 RS_FOREARM=0.94 RS_HANDS=0.95 RS_CHESTD=0.9 RS_HEADBACK=0.01 … reshape.py -- $S/p1/fit.glb $S/d3/fit.glb 0.968 1.75 1.18 0.01 1.1 0.9 0.96 0.97
TOON_HEIGHT=1.851 python3 scripts/people3d/build_toon_bodies.py $S d1:d1/fit.glb      # Buzz: 1.849, tag d1-h3
# the file's chin carried from today's (the build's own chin estimate lands on the neck clamp on a smaller
# head) and look 1,1,1; then its moving face carried exactly:
python3 tools/bodies/patch_chin.py public/star/people3d/toon-p1.glb public/star/people3d/toon-d1.glb
python3 tools/bodies/carry_face.py h1 public/star/people3d/toon-p1.glb public/star/people3d/toon-d1.glb …
node scripts/perf3d/shrink-models.mjs star/people3d/toon-d1.glb …   # POLICY lines are in
```
`patch_chin.py`: extras.face.chinY = Head - (Head - chin)_today x k, k = the head's scale
(head_end - Head, new over today's), and extras.look = {head 1, neck 1, hands 1}. `carry_face.py` does
the same carry for the moving face's landmarks (faceFileLandmarks.ts).
