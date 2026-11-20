"""Packed | KIB Next side by side, half size, for looking:  python3 pair.py <shots dir> <name> [scale]  -> <name>-pair.jpg"""
import sys, os
from PIL import Image, ImageDraw
d, name = sys.argv[1], sys.argv[2]
s = float(sys.argv[3]) if len(sys.argv) > 3 else 0.6
ims = []
for app in ("packed", "next"):
    f = os.path.join(d, f"{name}-{app}.png")
    im = Image.open(f).convert("RGB") if os.path.exists(f) else Image.new("RGB", (412, 915), (60, 60, 60))
    ims.append(im.resize((int(im.width * s), int(im.height * s))))
W = sum(i.width for i in ims) + 10
H = max(i.height for i in ims) + 18
out = Image.new("RGB", (W, H), (20, 20, 20))
dr = ImageDraw.Draw(out)
x = 0
for lab, im in zip(("PACKED", "KIB NEXT"), ims):
    out.paste(im, (x, 18)); dr.text((x + 4, 3), f"{lab}  {name}", fill=(255, 220, 80)); x += im.width + 10
p = os.path.join(d, f"{name}-pair.jpg"); out.save(p, quality=80); print(p)
