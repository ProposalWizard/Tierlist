#!/usr/bin/env python3
"""A labelled strip of stills, all the same height.
    python3 tools/review-people/strip_sheet.py <out.jpg> <height> <label>=<file> [<label>=<file> ...]
"""
import sys
from PIL import Image, ImageDraw, ImageFont

out, H = sys.argv[1], int(sys.argv[2])
items = [a.split("=", 1) for a in sys.argv[3:]]
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
except Exception:
    font = ImageFont.load_default()
ims = []
for lab, f in items:
    im = Image.open(f).convert("RGBA")
    bg = Image.new("RGBA", im.size, (22, 26, 36, 255))
    im = Image.alpha_composite(bg, im).convert("RGB")
    ims.append((lab, im.resize((round(im.width * H / im.height), H), Image.LANCZOS)))
pad, bar = 12, 44
sheet = Image.new("RGB", (sum(i.width for _, i in ims) + pad * (len(ims) + 1), H + bar + pad), (14, 16, 22))
d = ImageDraw.Draw(sheet)
x = pad
for lab, im in ims:
    sheet.paste(im, (x, bar))
    d.text((x + 2, 10), lab, fill=(240, 240, 245), font=font)
    x += im.width + pad
sheet.save(out, quality=90)
print("wrote", out, sheet.size)
