"""Run pose_video.py on every reference video of a round.

  python3 -I tools/motionref/pose_all.py <videos dir> <out dir> <model.task>

How many people to track in each one is in PEOPLE (default 1: the one in front).
"""
import os
import subprocess
import sys

PEOPLE = {"handshake": 2, "shirt-photo": 2, "mentor": 2, "greeting": 2}
vids, out, model = sys.argv[1:4]
here = os.path.dirname(os.path.abspath(__file__))
os.makedirs(out, exist_ok=True)
for f in sorted(os.listdir(vids)):
    if not (f.startswith("ref-") and f.endswith(".mp4")):
        continue
    name = f[4:-4]
    dst = os.path.join(out, name + ".npz")
    if os.path.exists(dst):
        continue
    subprocess.run([sys.executable, "-I", os.path.join(here, "pose_video.py"), os.path.join(vids, f), dst,
                    f"--people={PEOPLE.get(name, 1)}", f"--model={model}",
                    f"--overlay={os.path.join(out, name + '-overlay.mp4')}"], check=False,
                   stderr=subprocess.DEVNULL)
