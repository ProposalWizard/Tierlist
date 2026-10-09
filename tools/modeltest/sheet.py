"""sheet.jpg: one row per candidate (concept, pitch, close-up, face, shop, run pose).
python3 tools/modeltest/sheet.py <model-test dir> c1 c2 c3"""
import sys
from PIL import Image, ImageDraw
D = sys.argv[1]; CS = sys.argv[2:]
H = 640; GAP = 8
rows = []
for c in CS:
    ims = [Image.open(f"{D}/{c}/concept.png").convert("RGB")] + [Image.open(f"{D}/{c}/look/{n}.png").convert("RGB") for n in ("wide", "close", "face", "shop", "run")]
    ims = [im.resize((int(im.width * H / im.height), H)) for im in ims]
    row = Image.new("RGB", (sum(i.width for i in ims) + GAP * (len(ims) - 1), H), (18, 18, 18)); x = 0
    for i in ims: row.paste(i, (x, 0)); x += i.width + GAP
    ImageDraw.Draw(row).text((10, 10), c.upper(), fill=(255, 255, 255))
    rows.append(row)
W = max(r.width for r in rows)
s = Image.new("RGB", (W, len(rows) * (H + GAP)), (18, 18, 18))
for k, r in enumerate(rows): s.paste(r, (0, k * (H + GAP)))
s.save(f"{D}/sheet.jpg", quality=86)
print("WROTE", f"{D}/sheet.jpg", s.size)
