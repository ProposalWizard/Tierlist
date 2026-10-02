"""Star Pass road backgrounds, one per 20-level stretch (Mikey, 1 Oct 2026).

  python tools/star-pass-art/make_backgrounds.py <out_dir>

Every stretch is the same idea, a floodlit pitch at night seen from above
(mown stripes, faint white markings, floodlight glow pouring in from the
sides, an out-of-focus crowd of camera flashes down both edges), lit in
that stretch's colours with one touch of its own:
  premier    magenta and teal neon
  europa     orange haze and drifting smoke
  champions  deep navy, a field of stars
  worldcup   green and gold, falling confetti
  ballondor  royal red velvet drapes and gold sparkle
Painted with numpy so the light is soft, with a little film grain.
"""
import math, os, sys
import numpy as np
from PIL import Image

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
W, H = 720, 1500
rng0 = np.random.default_rng(7)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
u, v = xx / W, yy / H


def hexc(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)


def glow(cx, cy, rx, ry, power=2.0):
    d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    return np.exp(-d * power)


def add(img, mask, col, amt=1.0):
    img += mask[..., None] * hexc(col)[None, None] * amt


def screen(img, mask, col, amt=1.0):
    c = hexc(col)[None, None] * mask[..., None] * amt
    return 1 - (1 - img) * (1 - np.clip(c, 0, 1))


def lines_mask():
    """Faint pitch markings: touchlines, a halfway line, centre circle, both
    penalty areas with their arcs. Thin, slightly glowing."""
    m = np.zeros((H, W), np.float32)
    def seg_dist(d, w=1.6):
        return np.clip(1 - np.abs(d) / w, 0, 1) + 0.25 * np.exp(-(d / 7) ** 2)
    L, R = W * 0.16, W * 0.84
    m += seg_dist(xx - L) + seg_dist(xx - R)
    mid = H * 0.5
    m += seg_dist(yy - mid) * ((xx > L) & (xx < R))
    r = np.hypot(xx - W / 2, yy - mid)
    m += seg_dist(r - W * 0.16)
    m += glow(W / 2, mid, 4, 4, 1) * 1.5
    for top in (True, False):
        y0 = 0 if top else H
        sgn = 1 if top else -1
        bw, bd = W * 0.30, H * 0.13
        inside_x = (xx > W / 2 - bw) & (xx < W / 2 + bw)
        m += seg_dist(yy - (y0 + sgn * bd)) * inside_x
        within_y = (sgn * (yy - y0) > 0) & (sgn * (yy - y0) < bd)
        m += (seg_dist(xx - (W / 2 - bw)) + seg_dist(xx - (W / 2 + bw))) * within_y
        ra = np.hypot(xx - W / 2, yy - (y0 + sgn * H * 0.09))
        arc = seg_dist(ra - W * 0.14) * (sgn * (yy - (y0 + sgn * bd)) > 0)
        m += arc
    return np.clip(m, 0, 1.4)


LINES = lines_mask()


def stripes(n=14, amt=0.06):
    s = 0.5 + 0.5 * np.sign(np.sin(v * n * math.pi))
    # Soften the stripe edges a touch.
    s = 0.5 + 0.5 * np.tanh(np.sin(v * n * math.pi) * 6)
    return (s - 0.5) * 2 * amt


def crowd(img, rng, cols, n=340, amt=0.5):
    """Out-of-focus flashes and lights down both edges."""
    for _ in range(n):
        side = rng.random() < 0.5
        x = (rng.random() ** 2.2) * W * 0.18
        x = x if side else W - x
        y = rng.random() * H
        r = rng.uniform(3, 15)
        col = cols[rng.integers(len(cols))]
        a = rng.uniform(0.15, 1.0) * amt
        x0, x1 = int(max(0, x - r * 2)), int(min(W, x + r * 2))
        y0, y1 = int(max(0, y - r * 2)), int(min(H, y + r * 2))
        if x1 <= x0 or y1 <= y0:
            continue
        d = np.hypot(xx[y0:y1, x0:x1] - x, yy[y0:y1, x0:x1] - y) / r
        disc = np.clip(1.2 - d, 0, 1) ** 1.5
        img[y0:y1, x0:x1] = 1 - (1 - img[y0:y1, x0:x1]) * (1 - disc[..., None] * hexc(col) * a)
    return img


def beams(img, col, amt=0.22):
    """Floodlight beams angling in from the top corners."""
    for cx, ang in ((-0.05 * W, 0.62), (1.05 * W, math.pi - 0.62)):
        dx, dy = xx - cx, yy + 0.05 * H
        a = np.arctan2(dy, dx)
        for k, spread in ((0, 0.10), (0.16, 0.06), (-0.14, 0.05)):
            m = np.exp(-((a - (ang + k)) / spread) ** 2) * np.exp(-np.hypot(dx, dy) / (H * 0.7))
            img = screen(img, m, col, amt)
    return img


def finish(img, rng, name, vignette=0.55, grain=0.035):
    vg = 1 - vignette * (((u - 0.5) * 1.6) ** 2 + ((v - 0.5) * 0.9) ** 2)
    img = img * np.clip(vg, 0, 1)[..., None]
    img += (rng.standard_normal((H, W, 1)).astype(np.float32)) * grain * 0.5
    img = np.clip(img, 0, 1) ** (1 / 1.08)
    Image.fromarray((img * 255).astype(np.uint8)).save(os.path.join(OUT, f"bg-{name}.webp"), quality=80, method=6)
    print("wrote", name)


def base(top, bottom):
    t, b = hexc(top), hexc(bottom)
    return (t[None, None] * (1 - v[..., None]) + b[None, None] * v[..., None]).astype(np.float32)


def pitch(img, line_col, stripe_amt=0.06, line_amt=0.22):
    img = img * (1 + stripes(amt=stripe_amt))[..., None]
    return screen(img, LINES, line_col, line_amt)


# Premier League: magenta night, teal neon.
r = np.random.default_rng(11)
img = base("#2a0633", "#14031c")
img = screen(img, glow(W * 0.9, H * 0.15, W * 0.7, H * 0.25), "#e9007b", 0.55)
img = screen(img, glow(W * 0.05, H * 0.72, W * 0.6, H * 0.25), "#00ffe0", 0.28)
img = pitch(img, "#c9fff7", 0.05, 0.2)
img = beams(img, "#ff9be0", 0.16)
img = crowd(img, r, ["#ffffff", "#ff4fb0", "#5ff7e6", "#ffd6f0"])
finish(img, r, "premier")

# Europa League: burnt orange, smoke.
r = np.random.default_rng(12)
img = base("#1c0f07", "#0c0806")
img = screen(img, glow(W * 0.5, H * 0.5, W * 0.9, H * 0.45), "#ff6a10", 0.38)
for _ in range(18):
    m = glow(r.uniform(0, W), r.uniform(0, H), r.uniform(120, 300), r.uniform(60, 140), 1.2)
    img = screen(img, m, "#ff9a55", r.uniform(0.04, 0.1))
img = pitch(img, "#ffe1c4", 0.05, 0.18)
img = beams(img, "#ffb36b", 0.2)
img = crowd(img, r, ["#ffffff", "#ff8a2a", "#ffd2a0", "#ff5a00"])
finish(img, r, "europa")

# Champions League: navy, a field of stars.
r = np.random.default_rng(13)
img = base("#071338", "#02061a")
img = screen(img, glow(W * 0.5, H * 0.42, W * 0.8, H * 0.38), "#3d5cff", 0.4)
for _ in range(900):
    x, y, s = r.uniform(0, W), r.uniform(0, H), r.uniform(0.6, 2.4)
    x0, x1, y0, y1 = int(max(0, x - 8)), int(min(W, x + 8)), int(max(0, y - 8)), int(min(H, y + 8))
    d = np.hypot(xx[y0:y1, x0:x1] - x, yy[y0:y1, x0:x1] - y)
    m = np.exp(-(d / s) ** 2) + 0.15 * np.exp(-(d / (s * 3)) ** 2)
    img[y0:y1, x0:x1] = 1 - (1 - img[y0:y1, x0:x1]) * (1 - m[..., None] * r.uniform(0.3, 1.0))
# Three big faint stars, the competition's own symbol.
def star_mask(cx, cy, R):
    a = np.arctan2(yy - cy, xx - cx) + math.pi / 2
    rr = np.hypot(xx - cx, yy - cy)
    seg = 2 * math.pi / 5
    t = np.abs(np.mod(a, seg) - seg / 2) / (seg / 2)  # 0 point .. 1 notch
    edge = R * (0.42 + 0.58 * (1 - t) ** 1.6)
    return np.clip((edge - rr) / 3, 0, 1)
for cx, cy, R in ((W * 0.78, H * 0.2, 150), (W * 0.2, H * 0.55, 120), (W * 0.74, H * 0.86, 100)):
    img = screen(img, star_mask(cx, cy, R), "#9fb4ff", 0.06)
img = pitch(img, "#dfe7ff", 0.04, 0.16)
img = beams(img, "#b9c8ff", 0.16)
img = crowd(img, r, ["#ffffff", "#a8bcff", "#e6ecff"], amt=0.45)
finish(img, r, "champions")

# World Cup: deep green and gold, confetti.
r = np.random.default_rng(14)
img = base("#063a22", "#031c11")
img = screen(img, glow(W * 0.5, H * 0.38, W * 0.85, H * 0.4), "#ffcc4d", 0.3)
img = pitch(img, "#fff2c2", 0.08, 0.2)
img = beams(img, "#ffe08a", 0.22)
for _ in range(700):
    x, y = r.uniform(0, W), r.uniform(0, H)
    w, h = r.uniform(3, 7), r.uniform(1.5, 3.5)
    a = r.uniform(0, math.pi)
    col = ["#ffd44d", "#ffffff", "#f5b400", "#3ddc84", "#ff5a5a"][r.integers(5)]
    x0, x1, y0, y1 = int(max(0, x - 8)), int(min(W, x + 8)), int(max(0, y - 8)), int(min(H, y + 8))
    dx, dy = xx[y0:y1, x0:x1] - x, yy[y0:y1, x0:x1] - y
    px, py = dx * math.cos(a) + dy * math.sin(a), -dx * math.sin(a) + dy * math.cos(a)
    m = np.clip(1.5 - np.maximum(np.abs(px) / w, np.abs(py) / h) * 1.5, 0, 1)
    img[y0:y1, x0:x1] = img[y0:y1, x0:x1] * (1 - m[..., None] * 0.8) + m[..., None] * hexc(col) * 0.8
img = crowd(img, r, ["#ffffff", "#ffe07a", "#9cffc4"], amt=0.45)
finish(img, r, "worldcup")

# Ballon d'Or: royal red velvet, gold sparkle.
r = np.random.default_rng(15)
img = base("#4c0712", "#1e0208")
folds = 0.5 + 0.5 * np.sin(u * math.pi * 9 + np.sin(v * 5) * 0.6)
img = img * (0.72 + 0.5 * folds ** 2)[..., None]
img = screen(img, glow(W * 0.5, H * 0.3, W * 0.7, H * 0.35), "#ffcf6a", 0.38)
img = beams(img, "#ffdc8a", 0.24)
for _ in range(500):
    x, y, s = r.uniform(0, W), r.uniform(0, H), r.uniform(0.8, 2.6)
    x0, x1, y0, y1 = int(max(0, x - 14)), int(min(W, x + 14)), int(max(0, y - 14)), int(min(H, y + 14))
    dx, dy = np.abs(xx[y0:y1, x0:x1] - x), np.abs(yy[y0:y1, x0:x1] - y)
    m = np.exp(-(np.hypot(dx, dy) / s) ** 2) + 0.5 * np.exp(-(dx / 0.8) ** 2 - (dy / (s * 4)) ** 2) + 0.5 * np.exp(-(dy / 0.8) ** 2 - (dx / (s * 4)) ** 2)
    img[y0:y1, x0:x1] = 1 - (1 - img[y0:y1, x0:x1]) * (1 - np.clip(m, 0, 1)[..., None] * hexc("#ffe39a") * r.uniform(0.3, 1))
img = crowd(img, r, ["#ffe7a8", "#ffffff", "#ffb84d"], amt=0.4)
finish(img, r, "ballondor")
