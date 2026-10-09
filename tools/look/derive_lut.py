#!/usr/bin/env python3
"""tools/look/derive_lut.py — make the day and night grades from golden hour's (Harry, 9 Oct 2026:
"golden hour/mix quality everywhere cos it can't always be golden hour").

Golden hour's LUT has the best tone curve (deep blacks, a smooth S, grass contrast). The day and night LUTs
take its LIGHTNESS curve and keep their own colour:
  day    golden's tone curve in place of its own; its per-colour lightness moves and colour (Lab a, b) kept
         (it was matched to the broadcast frame)
  night  lightness from golden; colour = the input's own hue, at golden's colourfulness change (no warm move)

    python3 tools/look/derive_lut.py --golden public/star/look/lut-golden.png \
        --day-in public/star/look/lut-day.png --out-day public/star/look/lut-day.png \
        --out-night public/star/look/lut-night.png

The old night LUT had a flat patch in the mids (grey 81 -> 91 over a quarter of the range): that is what
washed the floodlit grass grey. The old day LUT is read before it is overwritten.
"""
import argparse
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("--golden", required=True)
ap.add_argument("--day-in", required=True)
ap.add_argument("--out-day", required=True)
ap.add_argument("--out-night", required=True)
ap.add_argument("--night-cool", type=float, default=2.0, help="Lab b taken off night's mids and lights (cool floodlight)")
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
    c = xyz @ np.linalg.inv(M).T
    c = np.clip(c, 0, 1)
    return np.clip(np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055), 0, 1)


def read(path):
    s = np.asarray(Image.open(path).convert("RGB")).astype(np.float64) / 255.0  # 32 x 1024
    # strip -> cube[b, g, r]
    return s.reshape(32, 32, 32, 3).transpose(1, 0, 2, 3)


def write(cube, path):
    s = cube.transpose(1, 0, 2, 3).reshape(32, 1024, 3)
    Image.fromarray(np.clip(np.round(s * 255), 0, 255).astype(np.uint8)).save(path)


g = np.linspace(0, 1, 32)
B, G, R = np.meshgrid(g, g, g, indexing="ij")
ident = np.stack([R, G, B], -1)
lab_in = to_lab(ident)
gold = to_lab(read(a.golden))
day = to_lab(read(a.day_in))



def curve(out):
    """A LUT's tone curve: its output lightness as a function of input lightness, from its near-grey points."""
    li, lo = lab_in[..., 0].ravel(), out[..., 0].ravel()
    w = np.exp(-(np.hypot(lab_in[..., 1], lab_in[..., 2]).ravel() / 12.0) ** 2)
    xs = np.linspace(0, 100, 101)
    ys = np.array([np.sum(w * lo * np.exp(-((li - x) / 4.0) ** 2)) / max(np.sum(w * np.exp(-((li - x) / 4.0) ** 2)), 1e-9) for x in xs])
    return lambda L: np.interp(L, xs, ys)


cg, cd = curve(gold), curve(day)
# day: golden's tone curve in place of day's own; day's per-colour lightness moves (grass vs kits) and its colour kept
# — only on the grass and the near-greys: strong non-green colours (the kits, the boards) keep the day grade
# as it was (golden's curve lifted the blue kit's lightness and the clip turned it violet)
hue_in = np.degrees(np.arctan2(lab_in[..., 2], lab_in[..., 1])) % 360
c_in = np.hypot(lab_in[..., 1], lab_in[..., 2])
greenish = np.clip(1 - np.abs(hue_in - 135) / 45, 0, 1)
keep = np.maximum(np.exp(-(c_in / 14.0) ** 2), greenish)
out_day = day.copy()
out_day[..., 0] = day[..., 0] + keep * (cg(lab_in[..., 0]) - cd(lab_in[..., 0]))

chroma_in = np.hypot(lab_in[..., 1], lab_in[..., 2])
chroma_g = np.hypot(gold[..., 1], gold[..., 2])
ratio = np.clip(chroma_g / np.maximum(chroma_in, 1e-3), 0.6, 1.4)
ratio = np.where(chroma_in < 2, 1.0, ratio)
out_night = lab_in.copy()
out_night[..., 0] = gold[..., 0]
out_night[..., 1:] *= ratio[..., None]
mid = np.clip((lab_in[..., 0] - 20) / 40, 0, 1)
out_night[..., 2] -= a.night_cool * mid

write(to_rgb(out_day), a.out_day)
write(to_rgb(out_night), a.out_night)
for n, c in (("golden", gold), ("day", out_day), ("night", out_night)):
    print(n, "grey L:", [int(c[i, i, i, 0]) for i in range(0, 32, 4)])
print("blue (r6,g9,b26) in/day:", to_rgb(lab_in[26, 9, 6]).round(2), to_rgb(out_day[26, 9, 6]).round(2), "old day:", to_rgb(day[26, 9, 6]).round(2))
