"""A before/after sheet of phone stills, labelled (B5c shoulders and arms).

  python3 -I tools/motionref/before_after_sheet.py out.jpg STILLS_DIR "Row label=prefix" ... --cols=idle-front,idle-side,walk-front,walk-side --crop=80,640

Each row is a body (prefix, e.g. S-p1); each column a pose; each cell the
BEFORE still (<prefix>-<col>-B.jpg) beside the AFTER one (-A.jpg).
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opt = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--"))
out, d = args[0], args[1]
rows = [r.split("=", 1) for r in args[2:]]
cols = opt.get("cols", "idle-front,idle-side,walk-front,walk-side").split(",")
y0, y1 = (int(x) for x in opt.get("crop", "80,640").split(","))
x0, x1 = (int(x) for x in opt.get("xcrop", "40,350").split(","))
W, H = x1 - x0, y1 - y0
TOP, LEFT, GAP = 64, 0, 14
font = None
for f in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"]:
    if os.path.exists(f):
        font = ImageFont.truetype(f, 20)
        small = ImageFont.truetype(f, 16)
        break
font = font or ImageFont.load_default()
small = small if font else font
cell = 2 * W + 6
sheet = Image.new("RGB", (len(cols) * (cell + GAP), TOP + len(rows) * (H + 40)), "white")
dr = ImageDraw.Draw(sheet)
for c, col in enumerate(cols):
    x = c * (cell + GAP)
    dr.text((x + 6, 6), col.replace("-", " · ").upper(), fill="black", font=font)
    dr.text((x + 6, 36), "BEFORE", fill="#b00020", font=small)
    dr.text((x + W + 12, 36), "AFTER", fill="#007a3d", font=small)
for r, (label, prefix) in enumerate(rows):
    y = TOP + r * (H + 40)
    dr.text((6, y + 4), label, fill="black", font=font)
    for c, col in enumerate(cols):
        x = c * (cell + GAP)
        for k, tag in enumerate(["B", "A"]):
            p = os.path.join(d, f"{prefix}-{col}-{tag}.jpg")
            if not os.path.exists(p):
                continue
            im = Image.open(p).convert("RGB").crop((x0, y0, x1, y1))
            sheet.paste(im, (x + k * (W + 6), y + 32))
sheet.save(out, quality=88)
print(out, sheet.size)
