"""The build-up landing sheet (25 Oct 2026): per chance kind, the moment the
chance is yours with NO build-up next to the moment it is yours AFTER its
build-up, one row per build of the game.

    python3 scripts/camera/landing-sheet.py <stillsDir> <out.jpg> <tag:Row label>... [--kinds=k:i,...]

Reads <stillsDir>/<tag>-<kind>-<i>-nobuild.jpg / -after.jpg (written by
scripts/camera/landing-stills.mjs) and <tag>-frames.json is not needed.
Each still is cropped to the pitch and labelled with the frame width.
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opts = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--"))
src, out, rows = args[0], args[1], [r.split(":", 1) for r in args[2:]]
kinds = [k.split(":") for k in opts.get("kinds", "one_on_one:17,header:0,long_range:1,volley:0,tight_angle:0,cutback:1,free_kick:0,penalty:1").split(",")]
NAMES = {"one_on_one": "One-on-one", "header": "Header", "long_range": "Long range", "volley": "Volley", "tight_angle": "Tight angle", "cutback": "Cutback", "free_kick": "Free kick", "penalty": "Penalty"}

# The pitch on a 390x844 phone at 2x: below the page's buttons, above the bottom.
CROP = (20, 286, 760, 1676)
TW = 190
TH = round(TW * (CROP[3] - CROP[1]) / (CROP[2] - CROP[0]))
GAP, PAIR_GAP, LEFT, TOP, CAP = 6, 22, 190, 74, 26


def font(size, bold=False):
    for p in ([
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


frames = {}
for tag, _ in rows:
    fp = os.path.join(src, f"{tag}-frames.json")
    if os.path.exists(fp):
        for f in json.load(open(fp)):
            frames[f["name"]] = f.get("frame")

W = LEFT + len(kinds) * (2 * TW + GAP) + (len(kinds) - 1) * PAIR_GAP + 20
H = TOP + len(rows) * (TH + CAP + 18) + 10
sheet = Image.new("RGB", (W, H), (14, 18, 24))
d = ImageDraw.Draw(sheet)
f_big, f_mid, f_small = font(22, True), font(15, True), font(13)
for ci, (kind, idx) in enumerate(kinds):
    x0 = LEFT + ci * (2 * TW + GAP + PAIR_GAP)
    d.text((x0, 10), NAMES.get(kind, kind), font=f_big, fill=(240, 244, 248))
    d.text((x0, 42), "no build-up", font=f_small, fill=(160, 170, 180))
    d.text((x0 + TW + GAP, 42), "after build-up", font=f_small, fill=(160, 170, 180))
for ri, (tag, label) in enumerate(rows):
    y0 = TOP + ri * (TH + CAP + 18)
    words, line, lines = label.split(), "", []
    for w in words:
        if len(line + " " + w) > 16:
            lines.append(line)
            line = w
        else:
            line = (line + " " + w).strip()
    lines.append(line)
    for li, ln in enumerate(lines):
        d.text((14, y0 + 10 + li * 22), ln, font=f_mid, fill=(240, 244, 248))
    for ci, (kind, idx) in enumerate(kinds):
        x0 = LEFT + ci * (2 * TW + GAP + PAIR_GAP)
        widths = []
        for k, which in enumerate(["nobuild", "after"]):
            name = f"{tag}-{kind}-{idx}-{which}"
            p = os.path.join(src, name + ".jpg")
            x = x0 + k * (TW + GAP)
            if not os.path.exists(p):
                d.rectangle([x, y0, x + TW, y0 + TH], outline=(80, 80, 80))
                d.text((x + 10, y0 + 10), "missing", font=f_small, fill=(200, 80, 80))
                widths.append(None)
                continue
            im = Image.open(p).crop(CROP).resize((TW, TH), Image.LANCZOS)
            sheet.paste(im, (x, y0))
            fr = frames.get(name)
            w = (fr["cam"]["x2"] - fr["cam"]["x1"]) if fr else None
            widths.append(w)
            cap = (f"{w:.1f} m across" if w else "") + (f" · men {fr['figPx']:.1f}px" if fr and fr.get("figPx") else "")
            d.text((x + 2, y0 + TH + 4), cap, font=f_small, fill=(200, 208, 216))
        if widths[0] and widths[1]:
            same = abs(widths[1] / widths[0] - 1) < 0.01
            col = (74, 222, 128) if same else (248, 113, 113)
            d.rectangle([x0 - 3, y0 - 3, x0 + 2 * TW + GAP + 3, y0 + TH + 3], outline=col, width=3)
sheet.save(out, quality=88)
print(out, sheet.size)
