"""Keep reference videos small for the repo and make a contact sheet of each.

  python3 tools/motionref/shrink.py <folder> <keep-originals-dir>

Every ref-*.mp4 in <folder> that is bigger than 3 MB (a Higgsfield original,
1076x1924, 5-20 MB) is moved to <keep-originals-dir> (outside git), and a
540-wide copy (~1 MB) is written back in its place, plus a strip of 9 frames
in <folder>/raw/sheet-<name>.jpg.
"""
import os
import shutil
import subprocess
import sys

folder, keep = sys.argv[1], sys.argv[2]
os.makedirs(keep, exist_ok=True)
os.makedirs(os.path.join(folder, "raw"), exist_ok=True)
for f in sorted(os.listdir(folder)):
    p = os.path.join(folder, f)
    if not (f.startswith("ref-") and f.endswith(".mp4")) or os.path.getsize(p) < 3_000_000:
        continue
    src = os.path.join(keep, f)
    shutil.move(p, src)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", "scale=540:-2", "-c:v", "libx264", "-crf", "27",
                    "-preset", "slow", "-an", "-movflags", "+faststart", p], check=True)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src],
                               capture_output=True, text=True, check=True).stdout.strip())
    sheet = os.path.join(folder, "raw", "sheet-" + f.replace(".mp4", ".jpg"))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", f"fps={9 / dur:.4f},scale=180:-2,tile=9x1",
                    "-frames:v", "1", sheet], check=True)
    print("ok", f, os.path.getsize(p) // 1024, "KB")
