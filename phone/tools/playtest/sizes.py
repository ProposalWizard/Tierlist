"""Both apps at the three phone sizes, half scale:  python3 sizes.py <dir> <name>  -> 200-<name>-sizes.jpg
Reads 200-<name>-<WxH>-<packed|next>.png (drive.mjs SZ())."""
import sys, os
from PIL import Image, ImageDraw
d, name = sys.argv[1], sys.argv[2]
sizes = ["412x915", "360x780", "360x640"]
rows = []
for app in ("packed", "next"):
    ims = []
    for s in sizes:
        f = os.path.join(d, f"200-{name}-{s}-{app}.png")
        ims.append(Image.open(f).convert("RGB") if os.path.exists(f) else Image.new("RGB", (360, 640), (60, 60, 60)))
    rows.append(ims)
s = 0.5
W = int(sum(i.width for i in rows[0]) * s) + 40
H = int(915 * s * 2) + 60
out = Image.new("RGB", (W, H), (20, 20, 20))
dr = ImageDraw.Draw(out)
y = 0
for lab, ims in zip(("PACKED", "KIB NEXT"), rows):
    x = 0
    dr.text((4, y + 2), f"{lab} {name}  (412x915 | 360x780 | 360x640)", fill=(255, 220, 80))
    for im in ims:
        im2 = im.resize((int(im.width * s), int(im.height * s)))
        out.paste(im2, (x, y + 16))
        x += im2.width + 20
    y += int(915 * s) + 30
p = os.path.join(d, f"200-{name}-sizes.jpg")
out.save(p, quality=80)
print(p)
