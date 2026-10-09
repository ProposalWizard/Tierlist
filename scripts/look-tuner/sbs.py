#!/usr/bin/env python3
"""scripts/look-tuner/sbs.py — pictures side by side at one height (before / after / reference), for checking by eye.
    python3 sbs.py out.jpg a.jpg b.jpg [c.jpg ...] [--h 844] [--labels "Before,After,Reference"]"""
import sys
from PIL import Image, ImageDraw

args = [a for a in sys.argv[1:]]
H = int(args[args.index("--h") + 1]) if "--h" in args else 844
labels = args[args.index("--labels") + 1].split(",") if "--labels" in args else []
files = [a for i, a in enumerate(args) if not a.startswith("--") and (i == 0 or args[i - 1] not in ("--h", "--labels"))]
out, ims = files[0], [Image.open(f).convert("RGB") for f in files[1:]]
ims = [im.resize((round(im.width * H / im.height), H)) for im in ims]
c = Image.new("RGB", (sum(im.width for im in ims) + 10 * (len(ims) - 1), H + (28 if labels else 0)), "#0b0f14")
x = 0
d = ImageDraw.Draw(c)
for i, im in enumerate(ims):
    c.paste(im, (x, 28 if labels else 0))
    if i < len(labels):
        d.text((x + 8, 8), labels[i], fill="#f2f5f8")
    x += im.width + 10
c.save(out, quality=90)
print("wrote", out)
