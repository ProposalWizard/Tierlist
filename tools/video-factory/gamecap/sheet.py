#!/usr/bin/env python3
"""Contact sheet of a captured clip, to check it by eye.

    python3 tools/video-factory/gamecap/sheet.py <outdir>/<clip> [out.jpg] [--n 8]

One row per camera, N frames spread over it, the key frames (pass, shot,
goal/miss/save) always included and marked. Needs Pillow.
"""
import json, os, sys
from PIL import Image, ImageDraw

args = [a for a in sys.argv[1:] if not a.startswith("--")]
n = int(sys.argv[sys.argv.index("--n") + 1]) if "--n" in sys.argv else 8
if "--n" in sys.argv: args = [a for a in args if a != str(n)]
clip = args[0]
out = args[1] if len(args) > 1 else os.path.join(clip, "sheet.jpg")
meta = json.load(open(os.path.join(clip, "meta.json")))
W, H = 200, 356
rows = []
for name, cam in meta["cameras"].items():
    total = cam["frames"]
    keys = {k: v for k, v in cam["key_frames"].items() if v is not None and v < total}
    picks = sorted(set([round(i * (total - 1) / (n - 1)) for i in range(n)] + list(keys.values())))
    rows.append((name, picks, keys))
cols = max(len(r[1]) for r in rows)
sheet = Image.new("RGB", (cols * W, len(rows) * (H + 18)), (16, 16, 16))
d = ImageDraw.Draw(sheet)
for ri, (name, picks, keys) in enumerate(rows):
    for ci, f in enumerate(picks):
        im = Image.open(os.path.join(clip, name, f"{f:05d}.jpg")).resize((W, H))
        x, y = ci * W, ri * (H + 18)
        sheet.paste(im, (x, y + 18))
        label = f"{name} {f}" + "".join(f" {k}" for k, v in keys.items() if v == f)
        d.text((x + 4, y + 3), label, fill=(255, 220, 80) if any(v == f for v in keys.values()) else (220, 220, 220))
sheet.save(out, quality=82)
print(out)
