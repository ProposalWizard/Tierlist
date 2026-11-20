"""Contact sheet of the worst pairs: packed app (left) | KIB Next (right), labelled.
    python3 -I phone/tools/playtest/worst.py <media dir> <out.jpg>
"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

M, OUT = sys.argv[1], sys.argv[2]
PAIRS = [
    ("1 Aim: packed arrow vs KIB plain line (zoomed)", "aim-zoom-trial.png", None),
    ("2 Aim in a match: arrow vs long flat line", "pk-m1-aim-hold.png", "nx-m1-aim-hold.png"),
    ("3 Run-up: packed keeps the arrow, KIB drops it", "pk-trial-05-runup-00.png", "nx-trial-05-runup-00.png"),
    ("4 Strike screen: steel title + draining bar vs plain", "pk-trial-06-ring-00.png", "nx-trial-06-ring-00.png"),
    ("5 Match strike screen: KIB ball cut off at the bottom", "pk-m1-shot-05.png", "nx-m1-shot-05.png"),
    ("6 Volley: HEIGHT bar, hint, green band vs none", "pk6-c4-00.png", "fr3/v-07.png"),
    ("7 Ball flight: landing X + trail vs none", "pk-gate-05-02.png", "nx-gate-05-02.png"),
    ("8 Result: one caption, held ~1 s vs two captions, ~0.4 s", "pk-trial-07-flight-03.png", "nx-trial-07-flight-01.png"),
    ("9 Penalties: names over takers vs none", "pk-pens-02-00.png", "nx-pens-02-00.png"),
    ("10 Training: result shown vs blank navy, back to list", "tr-pk-c1-c-04.png", "tr-nx-c1-c-03.png"),
    ("11 360x640 bench: icons cover the feed in KIB", "p640-feed.png", "n640-now3.png"),
    ("12 360x780 match HUD: 'ASSIS...' cut in KIB", "p780-chance.png", "n780-chance.png"),
]
H = 560
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
except OSError:
    font = ImageFont.load_default()
cells = []
for title, a, b in PAIRS:
    ims = []
    for f in (a, b):
        if f is None:
            continue
        im = Image.open(os.path.join(M, f)).convert("RGB")
        ims.append(im.resize((int(im.width * H / im.height), H)))
    w = sum(i.width for i in ims) + 8 * (len(ims) - 1)
    cell = Image.new("RGB", (max(w, 520), H + 30), (24, 24, 24))
    d = ImageDraw.Draw(cell)
    d.text((6, 6), title, fill=(255, 255, 255), font=font)
    x = 0
    for i in ims:
        cell.paste(i, (x, 30)); x += i.width + 8
    cells.append(cell)
cols = 4
rows = [cells[i:i + cols] for i in range(0, len(cells), cols)]
W = max(sum(c.width for c in r) + 12 * (len(r) + 1) for r in rows)
sheet = Image.new("RGB", (W, sum(max(c.height for c in r) + 12 for r in rows) + 40), (12, 12, 12))
d = ImageDraw.Draw(sheet)
d.text((12, 10), "Left of each pair: packed app (reference). Right: KIB Next. 412x915 unless marked.", fill=(255, 220, 120), font=font)
y = 40
for r in rows:
    x = 12
    for c in r:
        sheet.paste(c, (x, y)); x += c.width + 12
    y += max(c.height for c in r) + 12
sheet.save(OUT, quality=85)
print(OUT, sheet.size)
