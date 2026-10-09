"""Pack the Higgsfield UI art for the new 2D shop into small WebPs."""
import os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

def save(im, name, q=78):
    p = os.path.join(OUT, name + ".webp")
    im.save(p, "WEBP", quality=q, method=6)
    print(name, im.size, os.path.getsize(p) // 1024, "KB")

def raw(n):
    return Image.open(os.path.join(RAW, n + ".png")).convert("RGB")

def fit(im, w):
    h = round(im.height * w / im.width)
    return im.resize((w, h), Image.LANCZOS)

# --- frames: crop to the metal border -----------------------------------
for k in range(1, 6):
    im = raw(f"frame{k}")
    a = np.asarray(im).astype(float)
    lum = a.mean(axis=2)
    bright = lum > 105
    cols = np.where(bright.mean(axis=0) > 0.28)[0]
    rows = np.where(bright.mean(axis=1) > 0.28)[0]
    x0, x1, y0, y1 = cols.min(), cols.max(), rows.min(), rows.max()
    pad = 4
    im = im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))
    im = im.resize((300, 400), Image.LANCZOS)
    save(im, f"frame-{k}", 80)

# --- chroma-key sheets ----------------------------------------------------
def key(im):
    a = np.asarray(im).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = np.maximum(r, b)
    greenness = (g - m)  # >0 means green dominant
    alpha = 1 - np.clip((greenness - 25) / 60, 0, 1)
    # despill
    g2 = np.where(greenness > 0, np.minimum(g, m + 10), g)
    out = np.dstack([r, g2, b, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")

def split(img, n=None, min_px=400):
    al = np.asarray(img)[..., 3] > 40
    colmask = al.any(axis=0)
    # runs of columns with content
    runs, start = [], None
    for x, v in enumerate(colmask):
        if v and start is None: start = x
        if not v and start is not None: runs.append((start, x)); start = None
    if start is not None: runs.append((start, len(colmask)))
    runs = [r for r in runs if r[1] - r[0] > 20]
    parts = []
    for x0, x1 in runs:
        sub = al[:, x0:x1]
        rowmask = sub.any(axis=1)
        ys = np.where(rowmask)[0]
        parts.append(img.crop((x0, ys.min(), x1, ys.max() + 1)))
    return parts

def square(im, size):
    s = max(im.size)
    c = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    c.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
    return c.resize((size, size), Image.LANCZOS)

ranks = key(raw("ranks"))
# drop the drop-shadows under each emblem: keep only alpha that is not dark-grey
rp = split(ranks)
print("rank parts", len(rp))
for i, p in enumerate(rp[:5]):
    save(square(p, 128), f"rank-{i+1}", 85)

badges = key(raw("badges"))
bp = split(badges)
print("badge parts", len(bp))
names = ["_skip", "badge-gold", "badge-blue"]
for p, n in zip(bp, names):
    if n == "_skip": continue
    save(fit(p, 240) if p.width > p.height else square(p, 128), n, 85)

icons = key(raw("icons"))
a = np.asarray(icons)
H = icons.height
rowsplit = [icons.crop((0, 0, icons.width, H // 2)), icons.crop((0, H // 2, icons.width, H))]
inames = ["cans", "boots", "style", "drip", "gadgets", "cars", "homes", "holiday"]
k = 0
for half in rowsplit:
    for p in split(half):
        al = np.asarray(p)[..., 3] > 40
        ys = np.where(al.any(axis=1))[0]
        p = p.crop((0, ys.min(), p.width, ys.max() + 1))
        if k < len(inames):
            save(square(p, 128), "icon-" + inames[k], 85)
        k += 1
print("icons", k)

# --- black-bg effects -> alpha -------------------------------------------
def unblack(im):
    a = np.asarray(im).astype(float) / 255
    al = a.max(axis=2)
    al = np.clip((al - 0.04) / 0.96, 0, 1)
    rgb = np.where(al[..., None] > 0, np.clip(a / np.maximum(al[..., None], 1e-3), 0, 1), 0)
    out = np.dstack([rgb, al]) * 255
    return Image.fromarray(out.astype(np.uint8), "RGBA")

for n in ["burst", "fx-energy", "fx-curve", "fx-touch", "fx-power"]:
    save(unblack(raw(n)).resize((320, 320), Image.LANCZOS), n, 62 if n == "burst" else 72)
div = unblack(raw("divider"))
al = np.asarray(div)[..., 3] > 20
ys, xs = np.where(al)
div = div.crop((xs.min(), max(0, ys.min() - 6), xs.max() + 1, ys.max() + 7))
save(fit(div, 640), "divider", 80)

save(fit(raw("hero"), 900), "hero", 72)
save(fit(raw("bgtex"), 420), "bg", 70)
save(raw("panel").resize((420, 560), Image.LANCZOS), "panel", 75)

# a green tag: the blue tag turned green (the green pill was keyed out with the backdrop)
bt = Image.open(os.path.join(OUT, "badge-blue.webp")).convert("RGBA")
hsv = bt.convert("RGB").convert("HSV")
h, sat, v = hsv.split()
h = h.point(lambda x: (x - 55) % 256)
g = Image.merge("HSV", (h, sat, v)).convert("RGB"); g.putalpha(bt.split()[3])
save(g, "badge-green", 85)
