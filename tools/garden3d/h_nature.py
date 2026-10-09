#!/usr/bin/env python3
"""
THE GARDEN'S REAL-NATURE TEXTURES (look H) — public/star/garden3d/h/.

Harry, 9 Oct 2026, on the garden: "look at the trees, the hay, the back of the
player, the flowers." The cartoon pieces are swapped (look H only; Old keeps
today's garden) for cards and surfaces made from real photo-scanned CC0 maps:

  leaves.webp    a leafy spray (512², RGBA): real leaves from Poly Haven's
                 island_tree_02 (CC0) on a drawn twig. A tree's crown is a
                 hundred or so of these cards (lib/star/garden3d/realNature.ts)
  needles.webp   a fir spray (512², RGBA): Poly Haven fir_tree_01's twigs (CC0)
  bark.webp / bark-nrm.webp       island_tree_02's bark (CC0)
  paving.webp / paving-nrm.webp   Poly Haven concrete_pavers_02 (CC0)
  straw.webp / straw-nrm.webp     ambientCG ThatchedRoof001A (CC0): hay bales
  blooms.webp    three hydrangea heads (white, blue, pink; 768×256, RGBA),
                 drawn here floret by floret (ours)

Usage (sources downloaded first, see the README note in LICENSE.txt):
  python3 -I tools/garden3d/h_nature.py SRC_DIR public/star/garden3d/h

SRC_DIR holds: it2_leaves_diff.jpg, it2_leaves_alpha.jpg, it2_branches_diff.jpg,
it2_branches_nor.jpg (island_tree_02, 1k), fir_twig_diff.jpg, fir_twig_alpha.jpg
(fir_tree_01, 1k), pav_diff.jpg, pav_nor.jpg (concrete_pavers_02, 1k),
thatch_col.jpg, thatch_nor.jpg (ThatchedRoof001A 1K-JPG Color / NormalGL).
Needs Pillow and numpy. Seeded: the same sources make the same files.
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
rng = random.Random(9102026)


def src(name):
    return Image.open(os.path.join(SRC, name))


def save(img, name, q=82):
    img.save(os.path.join(OUT, name), "WEBP", quality=q, method=6)
    print(f"{name}: {os.path.getsize(os.path.join(OUT, name)) / 1024:.0f} KB")


def components(mask, min_px=400):
    """Bounding boxes of the separate shapes in a boolean mask (4-connected), big ones only."""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    boxes = []
    for y0 in range(h):
        row = mask[y0] & ~seen[y0]
        if not row.any():
            continue
        for x0 in np.nonzero(row)[0]:
            if seen[y0, x0]:
                continue
            stack = [(y0, x0)]
            seen[y0, x0] = True
            x1 = x2 = x0
            y1 = y2 = y0
            n = 0
            while stack:
                y, x = stack.pop()
                n += 1
                x1, x2, y1, y2 = min(x1, x), max(x2, x), min(y1, y), max(y2, y)
                for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not seen[yy, xx]:
                        seen[yy, xx] = True
                        stack.append((yy, xx))
            if n >= min_px:
                boxes.append((x1, y1, x2 + 1, y2 + 1))
    return boxes


def rgba(diff, alpha):
    d = diff.convert("RGB")
    a = alpha.convert("L").resize(d.size)
    out = d.copy()
    out.putalpha(a)
    return out


# ── 1. The leafy spray ──
leaves_rgba = rgba(src("it2_leaves_diff.jpg"), src("it2_leaves_alpha.jpg"))
small = np.array(leaves_rgba.split()[3].resize((256, 256))) > 100
leaf_imgs = []
for (x1, y1, x2, y2) in components(small, 300):
    k = leaves_rgba.width / 256
    box = (int(x1 * k), int(y1 * k), int(x2 * k), int(y2 * k))
    leaf_imgs.append(leaves_rgba.crop(box))
print(f"leaves found: {len(leaf_imgs)}")


def spray(size=512, n=34):
    c = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    # the twig: from the bottom middle, curving up
    pts = []
    for i in range(40):
        t = i / 39
        pts.append((size * (0.5 + 0.06 * math.sin(t * 2.6)), size * (0.98 - 0.86 * t)))
    for i in range(len(pts) - 1):
        wdt = max(2, int(9 * (1 - i / len(pts))))
        d.line([pts[i], pts[i + 1]], fill=(86, 64, 44, 255), width=wdt)
    order = []
    for i in range(n):
        t = 0.12 + 0.86 * (i / (n - 1))
        side = 1 if i % 2 else -1
        order.append((t, side))
    rng.shuffle(order)
    for t, side in sorted(order, key=lambda o: -o[0]):  # top leaves first, lower ones over them
        px, py = pts[min(39, int(t * 39))]
        leaf = rng.choice(leaf_imgs)
        hgt = size * (0.30 - 0.12 * t) * (0.85 + rng.random() * 0.3)
        sc = hgt / leaf.height
        lf = leaf.resize((max(4, int(leaf.width * sc)), max(4, int(leaf.height * sc))), Image.LANCZOS)
        lf = ImageEnhance.Brightness(lf).enhance(0.82 + rng.random() * 0.32)
        ang = side * (35 + rng.random() * 40) + (rng.random() - 0.5) * 16  # degrees from straight up
        rot = lf.rotate(-ang, resample=Image.BICUBIC, expand=True)
        # its base on the twig, the leaf pointing out along `ang`
        a = math.radians(ang)
        cx = px + math.sin(a) * hgt * 0.5
        cy = py - math.cos(a) * hgt * 0.5
        c.alpha_composite(rot, (int(cx - rot.width / 2), int(cy - rot.height / 2)))
    # one leaf on the tip
    lf = rng.choice(leaf_imgs)
    sc = size * 0.2 / lf.height
    lf = lf.resize((int(lf.width * sc), int(lf.height * sc)), Image.LANCZOS)
    tx, ty = pts[-1]
    c.alpha_composite(lf, (int(tx - lf.width / 2), int(ty - lf.height * 0.9)))
    return c


save(spray(), "leaves.webp", 84)

# ── 2. The fir spray ──
fir = rgba(src("fir_twig_diff.jpg"), src("fir_twig_alpha.jpg"))
fa = np.array(fir.split()[3].resize((256, 256))) > 110
# twigs only: not the bark strip on the left or the branch along the bottom
twigs = [b for b in components(fa, 120) if b[0] > 40 and b[3] < 230 and (b[2] - b[0]) > 20]
twig_imgs = [fir.crop(tuple(int(v * fir.width / 256) for v in b)) for b in twigs]
print(f"fir twigs found: {len(twig_imgs)}")
twig_imgs.sort(key=lambda im: -im.width * im.height)
big = twig_imgs[:4] or twig_imgs
nd = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
for i in range(9):
    tw = big[i % len(big)]
    s = 300 / max(tw.width, tw.height) * (0.75 + rng.random() * 0.4)
    t2 = tw.resize((int(tw.width * s), int(tw.height * s)), Image.LANCZOS)
    t2 = ImageEnhance.Brightness(t2).enhance(0.8 + rng.random() * 0.35)
    ang = -70 + i * 17 + (rng.random() - 0.5) * 10
    r2 = t2.rotate(-ang, resample=Image.BICUBIC, expand=True)
    a = math.radians(ang)
    cx, cy = 256 + math.sin(a) * 110, 300 - math.cos(a) * 110
    nd.alpha_composite(r2, (int(cx - r2.width / 2), int(cy - r2.height / 2)))
save(nd, "needles.webp", 84)

# ── 3. Bark ──
save(src("it2_branches_diff.jpg").convert("RGB").resize((512, 512), Image.LANCZOS), "bark.webp", 80)
save(src("it2_branches_nor.jpg").convert("RGB").resize((256, 256), Image.LANCZOS), "bark-nrm.webp", 88)

# ── 4. Paving ──
# lifted towards pale sandstone (the scan is a wet-looking brown; the benchmark's flags are pale)
pav = src("pav_diff.jpg").convert("RGB").resize((1024, 1024), Image.LANCZOS)
pav = ImageEnhance.Color(pav).enhance(0.62)
pav = ImageEnhance.Brightness(pav).enhance(1.55)
pav = Image.blend(pav, Image.new("RGB", pav.size, (214, 196, 166)), 0.18)
save(pav, "paving.webp", 80)
save(src("pav_nor.jpg").convert("RGB").resize((512, 512), Image.LANCZOS), "paving-nrm.webp", 88)

# ── 5. Straw ──
save(src("thatch_col.jpg").convert("RGB").resize((512, 512), Image.LANCZOS), "straw.webp", 80)
save(src("thatch_nor.jpg").convert("RGB").resize((256, 256), Image.LANCZOS), "straw-nrm.webp", 88)

# ── 6. Hydrangea heads: white, blue, pink ──
PALETTES = [
    [(246, 244, 238), (232, 236, 240), (250, 248, 236), (226, 232, 214)],
    [(150, 170, 236), (176, 160, 230), (130, 156, 226), (196, 186, 240)],
    [(240, 158, 196), (232, 132, 182), (248, 186, 214), (214, 128, 196)],
]


def head(pal, size=256):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    R = size * 0.44
    cx, cy = size / 2, size * 0.53
    pts = []
    for _ in range(140):
        a = rng.random() * math.tau
        r = R * math.sqrt(rng.random())
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r * 0.86, r / R))
    pts.sort(key=lambda p: p[1])  # lower florets drawn last (nearer the viewer on a dome)
    for x, y, rr in pts:
        base = rng.choice(pal)
        shade = 1.0 - 0.32 * rr ** 2 - 0.12 * max(0.0, (y - cy) / R)
        col = tuple(max(0, min(255, int(ch * shade * (0.92 + rng.random() * 0.14)))) for ch in base)
        pr = size * (0.035 + rng.random() * 0.018)
        rot = rng.random() * math.pi
        for k in range(4):
            a = rot + k * math.pi / 2
            px, py = x + math.cos(a) * pr * 0.8, y + math.sin(a) * pr * 0.8
            d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=col + (255,), outline=tuple(int(ch * 0.78) for ch in col) + (255,))
        d.ellipse([x - pr * 0.28, y - pr * 0.28, x + pr * 0.28, y + pr * 0.28], fill=(200, 196, 120, 255))
    return im.filter(ImageFilter.SMOOTH)


blooms = Image.new("RGBA", (768, 256), (0, 0, 0, 0))
for i, pal in enumerate(PALETTES):
    blooms.alpha_composite(head(pal), (i * 256, 0))
save(blooms, "blooms.webp", 86)
