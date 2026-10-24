"""Lay look.mjs's frames out as a sheet: one row per view, each frame labelled with its time;
the contact frame boxed in green. python3 sheet.py look-list.json out.(png|jpg) [--cols=6]"""
import json, sys
from PIL import Image, ImageDraw, ImageFont
spec = json.load(open(sys.argv[1]))
out = sys.argv[2]
cols = int(next((a.split("=")[1] for a in sys.argv[3:] if a.startswith("--cols=")), 6))
fr = spec["frames"]
views = list(dict.fromkeys(v for v, _, _ in fr))
per = len(fr) // len(views)
rows_per_view = (per + cols - 1) // cols
im0 = Image.open(fr[0][2]); w, h = im0.size
sheet = Image.new("RGB", (cols * w, len(views) * rows_per_view * h + 30), "white")
d = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
except OSError:
    font = small = ImageFont.load_default()
d.text((8, 4), f"{spec['clip']}  ·  contact {spec['contact']} s (green)", fill="black", font=small)
for vi, v in enumerate(views):
    items = [x for x in fr if x[0] == v]
    for i, (_, t, f) in enumerate(items):
        x, y = (i % cols) * w, 30 + (vi * rows_per_view + i // cols) * h
        sheet.paste(Image.open(f).convert("RGB"), (x, y))
        c = spec["contact"] is not None and abs(t - spec["contact"]) < 1e-6
        d.text((x + 8, y + 6), f"{t:.2f} s{'  CONTACT' if c else ''}  {v}", fill=(0, 120, 0) if c else "black", font=font)
        d.rectangle([x, y, x + w - 1, y + h - 1], outline=(0, 170, 0) if c else (190, 190, 190), width=5 if c else 1)
if out.lower().endswith((".jpg", ".jpeg")):
    sheet.save(out, quality=80, optimize=True)
else:
    sheet.save(out)
print(out, sheet.size)
