#!/usr/bin/env python3
"""tools/look/build_lut.py — build Look H's broadcast colour grade: a 3D LUT that moves a game frame's colours
towards a benchmark picture's.

    python3 tools/look/build_lut.py --src frame.png [--src2 ...] --bench file.jpg:l,t,r,b [--bench ...]
        --frame-crop 0,0.19,1,1 --mode full|tone --out public/star/look/lut-day.png [--preview out.jpg]

How (colour matching, in Lab — lightness and two colour axes — so a change of brightness never tints):
  1. Both pictures are split into grass and everything else (green pixels vs the rest).
  2. In each part, each Lab channel of the frame is matched to the benchmark's by its histogram (the same
     share of pixels below each value): the grass's colour to the grass's, the rest to the rest.
  3. That gives, for thousands of frame colours, where each should move to. The LUT's 32 x 32 x 32 grid
     points take the smooth average move of the frame colours near them; a colour the frame never shows
     (a kit's red, skin) only gets the overall lightness curve, so kits keep their real colours.
  mode "tone": the lightness curve only, minus its overall brightening (golden hour and night keep their own
  colours and level; only the shape of the tone curve — the contrast — matches).
Output: a 1024 x 32 PNG strip — 32 tiles of 32 x 32, blue picks the tile, red across, green down.
"""
import argparse
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("--src", action="append", required=True)
ap.add_argument("--bench", action="append", required=True)
ap.add_argument("--frame-crop", default="0,0,1,1")
ap.add_argument("--mode", default="full")
ap.add_argument("--out", required=True)
ap.add_argument("--preview")
ap.add_argument("--sigma", type=float, default=9.0)
ap.add_argument("--max-shift", type=float, default=22.0)
ap.add_argument("--yellow-cap", type=float, default=0.0, help="most yellow (Lab b) the grade may add")
ap.add_argument("--cool", type=float, default=4.0, help="Lab b taken off greens (cooler grass)")
ap.add_argument("--contrast", type=float, default=0.35, help="S-curve strength on lightness, 0..1")
ap.add_argument("--black", type=float, default=0.6, help="extra depth in the darkest tones")
ap.add_argument("--warm", type=float, default=7.0, help="degrees the light greens turn towards yellow")
ap.add_argument("--warm-b", type=float, default=7.0, help="most yellow (Lab b) the grade may add to light greens")
ap.add_argument("--mid", type=float, default=0.1, help="midtone lift (shadows and whites untouched)")
ap.add_argument("--white", type=float, default=5.0, help="lightness added to near-whites (lines, posts, shirts)")
ap.add_argument("--grass-sat", type=float, default=0.92, help="grass colourfulness, x")
ap.add_argument("--grass-contrast", type=float, default=1.3, help="stretch of the grass's own light-to-dark range")
ap.add_argument("--chroma", type=float, default=1.0, help="how much of the colour (a,b) move to keep")
a = ap.parse_args()

M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
WP = np.array([0.95047, 1.0, 1.08883])


def to_lab(rgb01):
    c = np.where(rgb01 <= 0.04045, rgb01 / 12.92, ((rgb01 + 0.055) / 1.055) ** 2.4)
    xyz = c @ M.T / WP
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def to_rgb(lab):
    fy = (lab[..., 0] + 16) / 116
    fx = fy + lab[..., 1] / 500
    fz = fy - lab[..., 2] / 200
    f = np.stack([fx, fy, fz], -1)
    xyz = np.where(f ** 3 > 0.008856, f ** 3, (f - 16 / 116) / 7.787) * WP
    lin = xyz @ np.linalg.inv(M).T
    lin = np.clip(lin, 0, None)
    s = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055)
    return np.clip(s, 0, 1)


def load(spec, frac=None):
    path, box = (spec.split(":") + [None])[:2]
    im = Image.open(path).convert("RGB")
    if box:
        im = im.crop(tuple(int(v) for v in box.split(",")))
    elif frac:
        im = im.crop((round(frac[0] * im.width), round(frac[1] * im.height), round(frac[2] * im.width), round(frac[3] * im.height)))
    w = 300
    im = im.resize((w, round(im.height * w / im.width)), Image.BILINEAR)
    return np.asarray(im).reshape(-1, 3) / 255.0


frac = [float(v) for v in a.frame_crop.split(",")]
src = np.concatenate([load(s, frac) for s in a.src])
ben = np.concatenate([load(b) for b in a.bench])
Ls, Lb = to_lab(src), to_lab(ben)
grass = lambda lab: (lab[:, 1] < -6) & (lab[:, 0] > 12) & (lab[:, 2] > -5)
gs, gb = grass(Ls), grass(Lb)
Q = np.linspace(0, 100, 101)


def matcher(s, b):
    """Per-channel histogram matching s → b (each a Nx3 Lab array): returns f(x) for x Nx3."""
    qs = [np.percentile(s[:, k], Q) for k in range(3)]
    qb = [np.percentile(b[:, k], Q) for k in range(3)]
    def f(x):
        out = x.copy()
        for k in range(3):
            xs, ys = qs[k], qb[k]
            xs = np.maximum.accumulate(xs + np.arange(len(xs)) * 1e-6)
            out[:, k] = np.interp(x[:, k], xs, ys)
        return out
    return f


f_all = matcher(Ls, Lb)
f_grass = matcher(Ls[gs], Lb[gb]) if gs.mean() > 0.03 and gb.mean() > 0.03 else f_all
f_other = matcher(Ls[~gs], Lb[~gb]) if (~gs).mean() > 0.03 and (~gb).mean() > 0.03 else f_all

rng = np.random.default_rng(1)
pick = rng.choice(len(Ls), size=min(5000, len(Ls)), replace=False)
S = Ls[pick]
T = np.where(gs[pick][:, None], f_grass(S), f_other(S))
D = T - S
shift = 0.0
if a.mode == "tone":
    D[:, 1:] = 0
    # the benchmark's contrast curve, not its brightness: golden hour and night keep their own level
    shift = float(D[:, 0].mean())
    D[:, 0] -= shift
else:
    D[:, 1:] *= a.chroma
D = np.clip(D, -a.max_shift, a.max_shift)

# the grid
n = 32
g = np.linspace(0, 1, n)
B, G, R = np.meshgrid(g, g, g, indexing="ij")  # [b][g][r]
grid = np.stack([R, G, B], -1).reshape(-1, 3)
C = to_lab(grid)
# the overall lightness curve for colours the frame never shows
Dg = np.zeros_like(C)
Dg[:, 0] = np.clip(f_all(C)[:, 0] - C[:, 0] - shift, -a.max_shift, a.max_shift)
w0 = 0.35
num = np.zeros_like(C)
den = np.zeros(len(C))
for i in range(0, len(C), 2048):
    c = C[i:i + 2048]
    d2 = ((c[:, None, :] - S[None, :, :]) ** 2).sum(-1)
    w = np.exp(-d2 / (2 * a.sigma ** 2))
    num[i:i + 2048] = w @ D
    den[i:i + 2048] = w.sum(1)
Dn = (num + w0 * Dg) / (den[:, None] + w0)
# shadows are never lifted (a lifted black reads grey and cheap, worst at night): below L 35 a move may only darken
dark = np.clip((35 - C[:, 0]) / 15, 0, 1)
Dn[:, 0] = Dn[:, 0] * (1 - dark) + np.minimum(Dn[:, 0], 0) * dark
# ── art direction on top of the match (9 Oct review: "yellow-olive and flat" next to the reference) ──
Lab = C + Dn
# 1. greens: shadows cool, highlights warm (two reviews, 9 Oct: "pull the yellow out", then "the light stripes have
#    yellow-green highlights, more alive"). Below the grass's middle lightness: no yellow added, hue turned a few
#    degrees cooler. Above it: a little warmth allowed, hue turned towards yellow-green.
gT = (T[:, 1] < -6) & (T[:, 0] > 12)
gmid = float(np.median((S + D)[gT, 0])) if gT.any() else 45.0
hi = np.clip((C[:, 0] - gmid) / 12, 0, 1)
lo = 1 - hi
Lab[:, 2] = np.minimum(Lab[:, 2], C[:, 2] + a.yellow_cap + hi * a.warm_b)
green = np.clip((-C[:, 1] - 6) / 14, 0, 1)
h0 = np.degrees(np.arctan2(C[:, 2], C[:, 1]))
ch = np.hypot(Lab[:, 1], Lab[:, 2])
hm = np.degrees(np.arctan2(Lab[:, 2], Lab[:, 1]))
h = np.maximum(hm, h0 + a.cool) * lo + (h0 - a.warm) * hi
hr = np.radians(np.where(green > 0, h, hm))
Lab[:, 1] = Lab[:, 1] * (1 - green) + ch * np.cos(hr) * green
Lab[:, 2] = Lab[:, 2] * (1 - green) + ch * np.sin(hr) * green
#    second review ("flat, saturated cartoon green"): grass a little less colourful, and its own
#    light-to-dark range stretched round its middle so blade texture and mowing stripes read stronger
Lab[:, 1] *= 1 - (1 - a.grass_sat) * green
Lab[:, 2] *= 1 - (1 - a.grass_sat) * green
near = green * np.exp(-((Lab[:, 0] - gmid) / 22) ** 2)
Lab[:, 0] = Lab[:, 0] + (Lab[:, 0] - gmid) * (a.grass_contrast - 1) * near
# 2. contrast: an S-curve on lightness round the middle, deeper blacks, lifted midtones
x = np.clip(Lab[:, 0] / 100, 0, 1)
s = x * x * (3 - 2 * x)
x = x + a.contrast * (s - x)
x = x - a.black * (1 - x) ** 4 * x
xm = np.clip((x - 0.15) / 0.35, 0, 1)
x = x + a.mid * 4 * x * (1 - x) * xm * xm * (3 - 2 * xm)
Lab[:, 0] = np.clip(x, 0, 1) * 100
# 3. whites stay white: near-white, near-grey colours (lines, posts, shirts) keep where they were
white = np.clip((C[:, 0] - 78) / 12, 0, 1) * np.clip(1 - np.hypot(C[:, 1], C[:, 2]) / 14, 0, 1)
Lab = Lab * (1 - white[:, None]) + C * white[:, None]
#    ... and a touch brighter (the reference's crisp lines and shirts)
Lab[:, 0] = np.minimum(100, Lab[:, 0] + white * a.white)
out = to_rgb(Lab).reshape(n, n, n, 3)  # [b][g][r]
strip = np.zeros((n, n * n, 3))
for b in range(n):
    strip[:, b * n:(b + 1) * n] = out[b]
Image.fromarray((strip * 255 + 0.5).astype(np.uint8), "RGB").save(a.out, optimize=True)
print("wrote", a.out)

if a.preview:
    im = np.asarray(Image.open(a.src[0]).convert("RGB")) / 255.0
    lut = out
    x = im * (n - 1)
    i0 = np.floor(x).astype(int).clip(0, n - 2)
    f = x - i0
    res = np.zeros_like(im)
    for db in (0, 1):
        for dg in (0, 1):
            for dr in (0, 1):
                w = (f[..., 2] if db else 1 - f[..., 2]) * (f[..., 1] if dg else 1 - f[..., 1]) * (f[..., 0] if dr else 1 - f[..., 0])
                res += w[..., None] * lut[i0[..., 2] + db, i0[..., 1] + dg, i0[..., 0] + dr]
    Image.fromarray((res * 255 + 0.5).astype(np.uint8)).save(a.preview, quality=92)
    print("preview", a.preview)
