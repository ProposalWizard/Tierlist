"""The walk-out from above, frame by frame: the check sheet for "players walking through each other".

Reads the JSON from scripts/walk3d/spacing.mts and draws, for the walk-out as filmed on 28 Nov (left) and now
(right), the 22 men from above at 24 moments across the 12 s (each man a 0.54 m circle: shoulders and arms;
red when he is inside another man's circle, or less than 0.65 m behind the man ahead), plus a line of every
frame (30 a second) coloured red where any two men overlap.

    python3 scripts/walk3d/spacing_sheet.py spacing.json sheet.png
"""
import json
import math
import sys

from PIL import Image, ImageDraw

src, dst = sys.argv[1], sys.argv[2]
data = json.load(open(src))
BODY, FRONT, SIDEW = 0.54, 0.65, 0.45


def bad_men(p):
    bad = set()
    for i, a in enumerate(p):
        for j, b in enumerate(p):
            if i == j:
                continue
            dx, dz = b[0] - a[0], b[1] - a[1]
            if math.hypot(dx, dz) < BODY:
                bad.add(i); bad.add(j)
            fx, fz = math.sin(a[2]), math.cos(a[2])
            al, la = dx * fx + dz * fz, abs(-dx * fz + dz * fx)
            if 0 < al < FRONT and la < SIDEW:
                bad.add(i); bad.add(j)
    return bad


COLS, ROWS = 12, 2
PW, PH = 150, 330  # panel size
PX = 21  # pixels per metre
W = COLS * PW
img = Image.new("RGB", (W, 60 + 2 * (ROWS * PH + 70)), "white")
d = ImageDraw.Draw(img)
d.text((10, 8), "THE 22-MAN WALK-OUT FROM ABOVE (camera at the bottom; walking up the page). Circle = one man, 0.54 m across. RED = inside another man.", fill="black")
d.text((10, 26), "Each strip under a half: every frame of the 12 s (30 a second), red where any two men overlap.", fill="black")
for half, key in enumerate(["before", "after"]):
    r = data[key]
    y0 = 60 + half * (ROWS * PH + 70)
    frames = r["frames"]
    nbad = 0
    for k in range(COLS * ROWS):
        f = frames[min(len(frames) - 1, round((k + 0.5) / (COLS * ROWS) * (len(frames) - 1)))]
        ox, oy = (k % COLS) * PW, y0 + 20 + (k // COLS) * PH
        panel = Image.new("RGB", (PW - 4, PH - 8), "white")
        pd = ImageDraw.Draw(panel)
        px, py = -2, 0
        bad = bad_men(f["p"])
        zs = [q[1] for q in f["p"]]
        zc = (max(zs) + min(zs)) / 2
        for i, q in enumerate(f["p"]):
            cx = px + PW / 2 + q[0] * PX
            cy = py + PH / 2 - (q[1] - zc) * PX
            rr = BODY / 2 * PX
            if i in bad:
                col = (230, 0, 0)
            elif r["ids"][i].startswith("away"):
                col = (40, 90, 210)
            else:
                col = (230, 120, 40)
            pd.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=col, width=3 if i in bad else 2)
            # which way he faces
            pd.line([cx, cy, cx + math.sin(q[2]) * rr, cy - math.cos(q[2]) * rr], fill=col, width=2)
        pd.rectangle([0, 0, PW - 5, PH - 9], outline=(200, 200, 200))
        pd.text((4, 4), f"{f['t']:.1f} s", fill=(90, 90, 90))
        img.paste(panel, (ox + 2, oy))
    # every frame
    sy = y0 + 20 + ROWS * PH
    for i, f in enumerate(frames):
        x = int(i / len(frames) * W)
        b = bool(bad_men(f["p"]))
        nbad += b
        d.rectangle([x, sy, int((i + 1) / len(frames) * W), sy + 14], fill=(230, 30, 30) if b else (60, 170, 80))
    label = "AS FILMED 28 NOV (no spacing)" if key == "before" else "NOW (spacing pass)"
    d.text((10, y0 + 4), f"{label}: {nbad} of {len(frames)} frames with two men inside each other; closest front-to-back {r['minFront'] * 100:.0f} cm, closest any two {r['minSide'] * 100:.0f} cm", fill=(160, 0, 0) if nbad else (0, 110, 0))
img.save(dst)
print("saved", dst)
