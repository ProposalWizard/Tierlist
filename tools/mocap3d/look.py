"""Render clips on the real body and put them on contact sheets, to LOOK at them.

    python3 tools/mocap3d/look.py <clips.glb> <body.glb (unpacked)> <out dir> clip[:n] ...

Needs node + @gltf-transform (as scripts/perf3d/shrink-models.mjs: --tools / SHRINK_TOOLS)
and Blender. The body must be unpacked first (tools/mocap3d/unpack.mjs). Writes
<out dir>/sheet-<i>.png, four clips a page, side and front views.
"""
import os, sys, subprocess, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
clips_glb, body, out = sys.argv[1:4]
specs = sys.argv[4:]
os.makedirs(out, exist_ok=True)
comb = os.path.join(out, "combined.glb")
names = [s.split(":")[0] for s in specs]
subprocess.run(["node", os.path.join(HERE, "combine.mjs"), body, clips_glb, comb, ",".join(n for n in names if n != "rest")], check=True)
frames = os.path.join(out, "frames")
shutil.rmtree(frames, ignore_errors=True)
r = subprocess.run(["blender", "-b", "--python", os.path.join(HERE, "render_sheet.py"), "--", comb, frames, *specs],
                   capture_output=True, text=True)
if r.returncode:
    print(r.stdout[-3000:], r.stderr[-3000:])
for i in range(0, len(names), 4):
    subprocess.run([sys.executable, os.path.join(HERE, "sheet.py"), frames, os.path.join(out, f"sheet-{i // 4}.png"), *names[i:i + 4]], check=True)
