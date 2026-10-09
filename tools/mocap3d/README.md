# tools/mocap3d — real motion capture on our 3D people

Settings → Look → **Motion: Mocap | Old** (`lib/star/motionLook.ts`, default
Mocap). Mocap plays these clips; Old plays the hand-made ones (`tools/anims3d`)
exactly as before.

Source: the CMU Graphics Lab Motion Capture Database (mocap.cs.cmu.edu,
"free for all uses"). Licence and the trial behind every clip:
`public/star/anims3d/LICENSE-mocap.txt`.

## Build

```bash
python3 tools/mocap3d/fetch.py --out /tmp/cmu          # ~25 MB of CMU .asf/.amc, only the trials used
python3 tools/mocap3d/build.py --cmu /tmp/cmu          # writes public/star/anims3d/mocap.glb + mocap-ual.glb, then packs them
```

Python 3 + numpy only. No Blender needed to build. Packing needs node and
the shrink tools (`scripts/perf3d/README.md`); `SHRINK_TOOLS=<dir>` if they
live outside the repo.

## How it works (`retarget.py`)

1. `cmu.py` reads the ASF skeleton and AMC motion: each bone's world turn
   away from CMU's T-pose, in metres.
2. Each of our bones gets the actor's world turn, after its rest direction
   is swung onto the CMU bone's (our A-pose / T-pose → theirs).
3. Shins and forearms swing only (a knee is a hinge; some actors' shin twist
   is noise). Feet are lined up so "planted in the capture" = our foot flat.
4. The hips go where the actor's pelvis went, scaled by leg length.
5. Each ankle is put (two-bone IK) where the actor's ankle went, so feet
   never float or sink, and **pinned while planted** (no sliding).
6. Loops: the cut where the pose repeats is found, the travel taken out (the
   game moves him; `speed` / `travel` go in the file) and the seam closed.
7. Times are resampled to 30 fps. Moments the game times things to are
   MEASURED off the solved body and written into the file (scene extras
   `clips[name]`): `contact` (the instant the kicking foot is fastest),
   `ball`, `contactPoint`, `end` (root motion), `touches`, `speed`, and
   `plants` (contact markers: when each foot is planted).

## Clips (`clipdefs.py`)

Same names as `football.glb`, so it is a drop-in: `kick_r`, `kick_l`,
`shot_r`, `pass_lofted`, `volley`, `first_touch`, `header_stand`,
`high_claim`, `throw_out`, `sprint`, `dribble_run`, `celebrate_fist`,
`celebrate_safe`, `frustrated`, `slump_walk`; the bodies' own `idle` and
`jog` (and the old footballer's `Idle_Loop`, `Jog_Fwd_Loop`, `Walk_Loop`).
New: `walk`, `run`, `turn_l/_r`, `side_step_l/_r`, `shuffle_l/_r`,
`shot_low`, `chip`, `pass_inside`, `catch_chest`, `celebrate_jump`,
`celebrate_airplane`, `dejected`, `handshake`, `wave`, `applause`,
`shirt_hold`.

**Adapted** (a real capture with a hand-made change on top; the file's
`source` says so): `pass_inside` (leg turned out for a side-foot pass),
`volley` (leg lifted), `header_stand` (neck snap at the top of a real jump),
`high_claim` (ball brought into the chest after the real grab),
`celebrate_jump` (fists up), `celebrate_safe` (arms held up over a real jog),
`applause` (clapping hands over a real stand), `shirt_hold` (hands holding a
shirt up over a real stand).

**Round 2 (9 Oct 2026).** Captured: `walk_confident` (82_09), `sit_down`,
`sit_idle`, `stand_up` (143_18), `get_up_side` (140_03), `talk` (18_08),
`point` (13_27). Adapted from a real stand: `nod`, `hug`, `chest_control`,
`thigh_control`, `celebrate_pump`; from 79_69: `celebrate_roar`.
**Keyed by hand** in `keyed.py` (no free capture exists): the keeper dives
`dive_left/_right` plus `_low` and `_high` (each lands, gathers and gets back up
into the set inside the clip; `getUp` in the file), `sliding_tackle`,
`poke_tackle`, `knee_slide`. They go into mocap.glb under the same names, so
Motion: Old keeps the old ones. build.py prints FOOT SLIDE per clip (worst
drift of a planted foot inside one planted run, cm) and writes `plants` for the
keyed clips too. Every keyed clip goes through `steady()` (keyed.py): no knee or
elbow can swap sides in one key (they used to flip a thigh 180°);
`tests/star/animSmooth.mts` fails any keyed clip turning a bone over 60° in one
60 fps frame.

**Still the old hand-made clip**: `header_diving`, `ready_shuffle`, the drill
loops `juggle`, `pass`, `cone_dribble`, `stretch`.

## Looking at them (`look.py`)

```bash
node tools/mocap3d/unpack.mjs public/star/onebody/player.glb /tmp/body.glb   # Blender 4.0 can't read meshopt
python3 tools/mocap3d/look.py public/star/anims3d/mocap.glb /tmp/body.glb /tmp/look kick_r:@0.5,1.0,1.37,1.8 idle:5
```

Blender (headless, Workbench) renders each clip on the real body, side and
front, with a grid floor and shadows; `sheet-*.png` puts them on pages.

## A new body (a new skeleton)

The retarget is driven by a bone-name table, so a new skeleton is config,
not code:

1. Its bones need a name for each canonical bone in `tools/anims3d/rig.py`
   `CANON` (hips, spine1-3, neck, head, shL/armL/foreL/handL, the same R,
   thighL/shinL/footL/toeL, the same R). Either add an entry to `rig.py`
   `NAMES`, or write a JSON file: `{"name": "mybody", "hips": "Hips",
   "spine1": "Spine", …}`.
2. The skeleton (a .glb; the mesh is ignored) must stand in its rest pose
   facing +z, his left at +x, feet on y = 0. Any rest pose works (T, A).
3. Build for it:
   `python3 tools/mocap3d/build.py --cmu /tmp/cmu --bones mybody.json --target mybody:public/star/mybody/body.glb:-mybody`
   → `public/star/anims3d/mocap-mybody.glb`. Or add it to `TARGETS` in
   `build.py` so every build makes it. Add a POLICY line for the new file in
   `scripts/perf3d/shrink-models.mjs`, and an entry in
   `lib/star/three3d/footballAnims.ts` `MOCAP_FILES`.

Quaternius "Universal Base Characters" already has a table (`ual`, the old
shop/garden footballer). The Higgsfield rigged humans (24 bones: Hips,
Spine02, Spine01, Spine, neck, Head, LeftShoulder/Arm/ForeArm/Hand,
LeftUpLeg/Leg/Foot/ToeBase …) use exactly the `p3` table — tried on
`player.glb` (9 Oct 2026, idle / jog / kick / jump rendered, all fine):
`--target p3:<their player.glb>:-higgs`. A MakeHuman / MPFB "game engine"
rig needs a new table.

## Bodies of other heights and builds

The clips hold only bone turns plus the hips' position. A body with longer or
shorter bones plays them as they are: `addClips` / `makePerson3d` scale the
hips' motion by that body's hips height over the clips' (`hipsY`), so the
stride grows with the legs. Scale everything in metres in the clip's info by
the same factor: `scaleInfo(info, k)` (footballAnims.ts). Feet: `plants` says
when each foot is planted; `plantedAt(info, foot, t)` reads it. A runtime
ground lock pins a planted foot where it landed (two-bone IK on thigh + shin)
so a 1.65 m or a 2.00 m body never slides or floats. Not wired into any scene
yet.
