"""Build the motion-capture clip files, for both 3D skeletons.

    python3 tools/mocap3d/build.py --cmu <dir with the CMU .asf/.amc files> [--only a,b] [--out <dir>] [--no-shrink]

Writes (then packs small with scripts/perf3d/shrink-models.mjs):
  public/star/anims3d/mocap.glb      the new 3D people (people3d.ts / the one body)
  public/star/anims3d/mocap-ual.glb  the old shop/garden footballer (shop3d/character.glb)

Every clip here is REAL human motion capture from the CMU Graphics Lab Motion
Capture Database (mocap.cs.cmu.edu; free for any use, see LICENSE-mocap.txt next
to the output), retargeted onto our skeletons by retarget.py. The CMU trial
of each clip is in CLIPS below and in the file (scene extras clips[name].source).
A few football moves the database never captured are ADAPTED: a real capture
with a careful change on top (the `adapted` note says what). README.md lists them.

Fetch the CMU files first (only those used):
    python3 tools/mocap3d/fetch.py --out <dir>
The clip NAMES match football.glb (lib/star/three3d/footballAnims.ts) and the
bodies' own idle / jog / walk, so the "Motion: Mocap" setting is a drop-in:
lib/star/motionLook.ts swaps these in over the old hand-made clips by name.
"""
import os, sys, json
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path[:0] = [HERE, os.path.join(ROOT, "tools", "anims3d"), os.path.join(ROOT, "scripts", "people3d")]
import rig as rigmod  # noqa: E402
from rig import Rig  # noqa: E402
import make  # noqa: E402
from clipdefs import CLIPS, UAL_NAMES  # noqa: E402
import importlib.util  # noqa: E402
_spec = importlib.util.spec_from_file_location("anims3d_build", os.path.join(ROOT, "tools", "anims3d", "build.py"))
_ab = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_ab)
write_glb = _ab.write  # tools/anims3d/build.py's writer: bone turns + hips, no mesh

OUT = os.path.join(ROOT, "public", "star", "anims3d")

# THE BODIES THE CLIPS ARE CUT FOR. A new body (another skeleton) is a line
# here, or --target on the command line, never a code change:
#   (bone-name table in tools/anims3d/rig.py NAMES, its .glb, output suffix)
# The .glb only needs the skeleton (nodes) in its rest pose, facing +z, his
# left at +x, feet on y = 0. A skeleton with other bone names: pass
# --bones <file.json> ({"name": "<kind>", "hips": "...", "spine1": ..., one
# entry per canonical bone in rig.py CANON}) and --target <kind>:<glb>:<suffix>.
TARGETS = [
    ("p3", os.path.join(ROOT, "public", "star", "people3d", "anims.glb"), ""),
    ("ual", os.path.join(ROOT, "public", "star", "shop3d", "character.glb"), "-ual"),
]


def main():
    args = sys.argv[1:]
    opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
    cmu = opt("--cmu")
    if not cmu:
        sys.exit("--cmu <dir> needed (python3 tools/mocap3d/fetch.py --out <dir> fetches the files)")
    only = set(opt("--only").split(",")) if opt("--only") else None
    out = opt("--out", OUT)
    sheet_dir = opt("--sheet")
    os.makedirs(out, exist_ok=True)
    if opt("--bones"):
        bones = json.load(open(opt("--bones")))
        rigmod.NAMES[bones.pop("name")] = bones
    targets = TARGETS
    if opt("--target"):
        targets = [tuple(t.split(":")) for t in opt("--target").split(",")]
    written = []
    for kind, glb, suffix in targets:
        rig = Rig(kind, glb)
        baked, meta, rows = [], {}, []
        for name, spec in CLIPS.items():
            if only and name not in only:
                continue
            b, m, dbg = make.bake_clip(rig, cmu, name, spec)
            baked.append(b)
            meta[name] = m
            rows.append((name, *dbg[:3], {k: v for k, v in m.items() if k in ("contact", "launch", "land", "release")}))
            # the old footballer's own loops go by their UAL names too
            if suffix and name in UAL_NAMES:
                for alias in UAL_NAMES[name]:
                    baked.append((alias,) + b[1:])
                    meta[alias] = m
            print(f"{rig.kind:4s} {name:16s} {m['duration']:5.2f}s {m['source']}" +
                  "".join(f" {k}={m[k]}" for k in ("contact", "speed", "end", "ball") if k in m))
        path = os.path.join(out, f"mocap{suffix}.glb")
        hy = float(rig.T[rig.b["hips"]][1])
        size = write_glb(rig, rig.json, baked, meta, path, hy)
        print(path, size, "bytes")
        written.append(path)
        if sheet_dir:
            os.makedirs(sheet_dir, exist_ok=True)
            for i in range(0, len(rows), 6):
                make.sheet(rows[i:i + 6], os.path.join(sheet_dir, f"sticks{suffix}-{i // 6}.png"))
    return written, out


if __name__ == "__main__":
    files, out = main()
    if "--no-shrink" not in sys.argv and os.path.abspath(out) == os.path.abspath(OUT):
        sys.path.insert(0, os.path.join(ROOT, "scripts", "perf3d"))
        from shrink_after_build import shrink
        shrink(files)
