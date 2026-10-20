"""The Style A proportions options sheet: three shots (rows) x A / B / C (columns).

    python3 scripts/bench3d/proportions_sheet.py STILLS_DIR props.json OUT.jpg

STILLS_DIR holds home-{a,b,c}.jpg, sign-{a,b,c}.jpg, two-{a,b,c}.jpg, each a
390 x 844 phone still (the Home bench at 3 s, the signing at 10.1 s and 15 s,
each with ?prop=a|b|c). props.json comes from
`npx tsx scripts/bench3d/proportions.mts --json=props.json`. The sheet is
saved under 300 KB.
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

src, pj, out = sys.argv[1], sys.argv[2], sys.argv[3]
P = json.load(open(pj))
ids = ["a", "b", "c"]
names = {"a": "A  today", "b": "B  modest", "c": "C  bolder"}
rows = [("home", "Home player (zoomed in)", (85, 360, 305, 705)), ("sign", "Signing: his close-up", (0, 60, 390, 520)), ("two", "Signing: the photo (two-shot)", (0, 210, 390, 700))]

def font(sz, bold=False):
    for f in (["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"] if bold else []) + ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if os.path.exists(f):
            return ImageFont.truetype(f, sz)
    return ImageFont.load_default()

CW = 300  # column width
cells = []
for key, label, box in rows:
    ims = []
    for i in ids:
        im = Image.open(os.path.join(src, f"{key}-{i}.jpg")).convert("RGB").crop(box)
        h = round(im.height * CW / im.width)
        ims.append(im.resize((CW, h), Image.LANCZOS))
    cells.append((label, ims))

head = 150
gap = 8
rowlab = 26
H = head + sum(rowlab + c[1][0].height + gap for c in cells) + 40
W = CW * 3 + gap * 4
sheet = Image.new("RGB", (W, H), (16, 20, 30))
d = ImageDraw.Draw(sheet)
d.text((gap, 8), "Style A proportions: pick A, B or C", font=font(22, True), fill=(255, 255, 255))
d.text((gap, 36), "Same height for all three (1.86 m). Smaller head, shorter body, longer thighs, squarer shoulders.", font=font(13), fill=(200, 210, 225))
o = P["options"]; r = P["real"]
lines = [
    ("heads tall", "headsTall", "{:.1f}"), ("hips / height", "hipFrac", "{:.2f}"), ("body (hip to neck) m", "torso", "{:.2f}"),
    ("thigh m", "thigh", "{:.2f}"), ("shoulders / height", "shoulderFrac", "{:.2f}"), ("upper arm m", "upperArm", "{:.2f}"),
]
y0 = 60
d.text((gap, y0), "", font=font(12))
for n, (lab, k, fmt) in enumerate(lines):
    x = gap + (n % 3) * 300
    y = y0 + (n // 3) * 40
    vals = "  ".join(f"{i.upper()} {fmt.format(o[i][k])}" for i in ids)
    d.text((x, y), lab, font=font(11, True), fill=(160, 200, 255))
    d.text((x, y + 15), f"{vals}  · real {fmt.format(r[k])}", font=font(11), fill=(235, 235, 235))
y = head
for (label, ims) in cells:
    d.text((gap, y + 4), label, font=font(14, True), fill=(255, 255, 255))
    y += rowlab
    for n, im in enumerate(ims):
        x = gap + n * (CW + gap)
        sheet.paste(im, (x, y))
        d.rectangle([x, y, x + 92, y + 22], fill=(0, 0, 0))
        d.text((x + 6, y + 3), names[ids[n]], font=font(13, True), fill=(255, 215, 90))
    y += ims[0].height + gap
d.text((gap, H - 30), "Phone stills, 390 x 844, cropped. Test pages: ?prop=b or ?prop=c. Today (A) is unchanged in the game.", font=font(11), fill=(170, 180, 195))
q = 82
while True:
    sheet.save(out, quality=q, optimize=True)
    if os.path.getsize(out) <= 300_000 or q <= 40:
        break
    q -= 6
print(out, os.path.getsize(out), "bytes, quality", q, sheet.size)
