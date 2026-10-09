"""Put render_sheet.py's frames on one page per batch of clips.

    python3 tools/mocap3d/sheet.py <frames dir> <out.png> clip ...
"""
import sys, os, glob
from PIL import Image, ImageDraw

d, out, clips = sys.argv[1], sys.argv[2], sys.argv[3:]
rows = []
for c in clips:
    for view in ("side", "front"):
        fs = sorted(glob.glob(os.path.join(d, f"{c}-{view}-*.png")))
        if fs:
            rows.append((f"{c} ({view})", fs))
if not rows:
    sys.exit("no frames")
w, h = Image.open(rows[0][1][0]).size
cols = max(len(fs) for _, fs in rows)
img = Image.new("RGB", (cols * w, len(rows) * (h + 16)), "white")
dr = ImageDraw.Draw(img)
for r, (label, fs) in enumerate(rows):
    y = r * (h + 16)
    dr.text((4, y + 2), label, fill="black")
    for i, f in enumerate(fs):
        img.paste(Image.open(f).convert("RGB"), (i * w, y + 16))
img.save(out)
print(out, img.size)
