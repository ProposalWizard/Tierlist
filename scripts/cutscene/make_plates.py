#!/usr/bin/env python3
"""Builds the cut-scene backdrop plate and grass for the outdoor sets (training ground, garden).

    python3 scripts/cutscene/make_plates.py <sky.png> <Grass004_2K-JPG_Color.jpg>

  public/star/cutscene/plate-golden.webp  a 360° golden-hour plate: the sky (mirrored so it wraps
      round a cylinder with no seam), a painted line of trees along the bottom, lit gold at the top
      edge, then softened (it is always out of focus behind the people).
  public/star/cutscene/grass.webp         ambientCG Grass004 (CC0), 512 px, tiling.
Credits: public/star/cutscene/LICENSE.txt.
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "star", "cutscene")
os.makedirs(OUT, exist_ok=True)

sky = Image.open(sys.argv[1]).convert("RGB")
W, H = 2048, 512
s = sky.resize((W // 2, int(sky.height * (W // 2) / sky.width)))
s = s.crop((0, 0, W // 2, min(s.height, H)))
s = s.resize((W // 2, H))
pano = Image.new("RGB", (W, H))
pano.paste(s, (0, 0)); pano.paste(s.transpose(Image.FLIP_LEFT_RIGHT), (W // 2, 0))
a = np.asarray(pano).astype(np.float32) / 255

# a painted treeline: bumpy crowns from layered sines, darker lower down, gold rim on the top edge
rng = np.random.default_rng(7)
x = np.arange(W)
top = np.zeros(W)
for f, amp in [(3, 14), (11, 9), (29, 6), (71, 3)]:
    ph = rng.uniform(0, 6.28)
    top += amp * np.sin(2 * np.pi * f * x / W + ph)
crowns = np.abs(np.sin(2 * np.pi * 37 * x / W + 1.3)) * 10
top = (H * 0.66 - top - crowns).astype(int)
yy = np.arange(H)[:, None]
mask = yy >= top[None, :]
depth = np.clip((yy - top[None, :]) / (H * 0.3), 0, 1)
tree = np.stack([0.20 - 0.12 * depth, 0.27 - 0.15 * depth, 0.12 - 0.07 * depth], -1)
rim = np.exp(-((yy - top[None, :]) / 3.0) ** 2)[..., None] * np.array([0.9, 0.6, 0.25])
a = np.where(mask[..., None], tree + rim * 0.6, a)
# haze in front of the trees: the sun's warmth
haze = np.clip(1 - (yy - H * 0.55) / (H * 0.45), 0, 1)[..., None] * np.array([1.0, 0.72, 0.42]) * 0.18
a = np.clip(a + np.where(mask[..., None], haze, 0), 0, 1)
img = Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2))
img.save(os.path.join(OUT, "plate-golden.webp"), quality=82)

g = Image.open(sys.argv[2]).convert("RGB").resize((512, 512), Image.LANCZOS)
g.save(os.path.join(OUT, "grass.webp"), quality=72)
print("wrote", os.listdir(OUT))
