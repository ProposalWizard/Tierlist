# A labelled side-by-side sheet of stills (Style A match pass, 12 Oct 2026).
# python3 scripts/perf3d/sheet.py out.png "Title" "label|file|x0,y0,x1,y1" ...   (box "-" = whole picture)
# Small crops are enlarged with square pixels, so the blockiness shows as it is.
import sys
from PIL import Image, ImageDraw, ImageFont

out, title, specs = sys.argv[1], sys.argv[2], sys.argv[3:]
H = 600
try:
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    ft = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 26)
except Exception:
    f = ft = ImageFont.load_default()
tiles = []
for s in specs:
    lab, fn, box = s.split("|")
    im = Image.open(fn).convert("RGB")
    if box != "-":
        im = im.crop(tuple(int(v) for v in box.split(",")))
    w = round(im.width * H / im.height)
    tiles.append((lab, im.resize((w, H), Image.NEAREST if im.height < 300 else Image.LANCZOS)))
W = max(sum(t[1].width for t in tiles) + 20 * (len(tiles) + 1), 900)
S = Image.new("RGB", (W, H + 110), "#111")
d = ImageDraw.Draw(S)
d.text((20, 12), title, fill="white", font=ft)
x = 20
for lab, im in tiles:
    S.paste(im, (x, 90))
    d.text((x, 55), lab, fill="#ffd34d", font=f)
    x += im.width + 20
S.save(out)
