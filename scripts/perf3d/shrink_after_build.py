"""Called at the end of the 3D builders: packs the files they just wrote small
(scripts/perf3d/shrink-models.mjs — meshopt geometry and clips, WebP
textures). A rebuild writes them big again, so without this a rebuild would
silently undo the shrink. If node or the packing tools are missing it says so
loudly and leaves the (working, just bigger) files as they are.
"""
import os
import subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def shrink(paths):
    rel = [os.path.relpath(os.path.abspath(p), os.path.join(ROOT, "public")) for p in paths]
    cmd = ["node", "scripts/perf3d/shrink-models.mjs", *rel]
    try:
        r = subprocess.run(cmd, cwd=ROOT)
        ok = r.returncode == 0
    except OSError:
        ok = False
    if not ok:
        print("\n!! NOT SHRUNK. These files are big until you run:\n   " + " ".join(cmd) +
              "\n   (tools: npm i --no-save @gltf-transform/core@4 @gltf-transform/functions@4"
              " @gltf-transform/extensions@4 meshoptimizer draco3dgltf sharp)\n")
    return ok
