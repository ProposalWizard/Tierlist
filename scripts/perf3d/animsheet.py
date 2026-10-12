# Contact sheet from animgrid.mjs: one row per clip, one column per moment through it.
# python3 scripts/perf3d/animsheet.py DIR grid.json out.png   (DIR holds grid-f0.png ...; tiles 120x150, 6 a row)
import json, sys, glob
from PIL import Image, ImageDraw, ImageFont

d, js, out = sys.argv[1], sys.argv[2], sys.argv[3]
info = json.loads(open(js).read().strip().splitlines()[-1])["info"]
frames = [Image.open(f).convert("RGB") for f in sorted(glob.glob(f"{d}/grid-f*.png"))]
TW, TH, COLS = 120, 150, 6
sx = frames[0].width / (TW * COLS)
try:
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
except Exception:
    f = ImageFont.load_default()
half = (len(info) + 1) // 2
LW = 150
W = 2 * (LW + len(frames) * TW + 20)
S = Image.new("RGB", (W, 40 + half * TH), "#111")
dr = ImageDraw.Draw(S)
dr.text((10, 10), "3D animation grid, Style A (Home build + light): each clip at 0%, 25%, 50%, 75% of its length", fill="white", font=f)
for i, t in enumerate(info):
    col, row = i % COLS, i // COLS
    ox = 0 if i < half else LW + len(frames) * TW + 20
    oy = 40 + (i % half) * TH
    dr.text((ox + 8, oy + TH // 2 - 16), t["label"], fill="#ffd34d", font=f)
    dr.text((ox + 8, oy + TH // 2 + 4), f'{t["clip"]} {t["duration"]:.2f}s', fill="#bbb", font=f)
    for k, fr in enumerate(frames):
        c = fr.crop((int(col * TW * sx), int(row * TH * sx), int((col + 1) * TW * sx), int((row + 1) * TH * sx))).resize((TW, TH))
        S.paste(c, (ox + LW + k * TW, oy))
S.save(out)
