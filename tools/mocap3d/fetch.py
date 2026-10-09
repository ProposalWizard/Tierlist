"""Download the CMU motion-capture files the clips use (ASF skeleton + AMC motion).

    python3 tools/mocap3d/fetch.py --out <dir>

From mocap.cs.cmu.edu (free for any use; see public/star/anims3d/LICENSE-mocap.txt).
Only the trials named in clipdefs.py; about 25 MB. Not kept in the repo.
"""
import os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", "anims3d"))
from clipdefs import CLIPS  # noqa: E402

out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else "cmu"
os.makedirs(out, exist_ok=True)
trials = sorted({c["trial"] for c in CLIPS.values()})
for t in trials:
    s = t.split("_")[0]
    for name in (f"{s}.asf", f"{t}.amc"):
        dst = os.path.join(out, name)
        if os.path.exists(dst):
            continue
        url = f"http://mocap.cs.cmu.edu/subjects/{s}/{name}"
        print("get", url)
        urllib.request.urlretrieve(url, dst)
print(len(trials), "trials in", out)
