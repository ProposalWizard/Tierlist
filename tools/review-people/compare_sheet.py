#!/usr/bin/env python3
"""Side by side: today's people (a still from the game's test page) and the realistic proof still.
    python3 tools/review-people/compare_sheet.py <toon.png> <realistic.png> <out.jpg> [left label] [right label]
"""
import sys
from PIL import Image, ImageDraw, ImageFont

a, b, out = sys.argv[1:4]
la = sys.argv[4] if len(sys.argv) > 4 else "TODAY (the game, Style A)"
lb = sys.argv[5] if len(sys.argv) > 5 else "REALISTIC BODY (Blender proof still)"
H = 1080
ims = []
for f in (a, b):
    im = Image.open(f).convert("RGB")
    ims.append(im.resize((round(im.width * H / im.height), H), Image.LANCZOS))
pad, bar = 16, 56
sheet = Image.new("RGB", (ims[0].width + ims[1].width + pad * 3, H + bar + pad), (14, 16, 22))
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 26)
except Exception:
    font = ImageFont.load_default()
d = ImageDraw.Draw(sheet)
x = pad
for im, lab in zip(ims, (la, lb)):
    sheet.paste(im, (x, bar))
    d.text((x + 4, 14), lab, fill=(240, 240, 245), font=font)
    x += im.width + pad
sheet.save(out, quality=90)
print("wrote", out, sheet.size)
