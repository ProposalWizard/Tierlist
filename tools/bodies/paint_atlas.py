"""Paint the grafted body's one picture (tools/bodies/graft.py writes what each triangle reads).

    python3 tools/bodies/paint_atlas.py <paint.npz> <mh_skin.png> <out atlas.png> [size]

Each texel of the new layout reads, through its triangle: the MakeHuman skin picture
(times the body's own painted shading), a flat kit colour (red shirt, white shorts, red
socks, dark boots: build_toon_bodies.py reads them as kit; the game repaints them), or
the Style A head's own picture. Then the gaps between pieces are filled from their
neighbours (no dark seams when the picture is shrunk).
"""
import os, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "scripts", "people3d"))
import raster  # noqa: E402
from build_toon_bodies import dilate_into  # noqa: E402

NPZ, SKIN, OUT = sys.argv[1:4]
N = int(sys.argv[4]) if len(sys.argv) > 4 else 2048
d = np.load(NPZ)
TINT = {1: (0.80, 0.16, 0.12), 2: (0.93, 0.93, 0.94), 3: (0.80, 0.16, 0.12), 4: (0.10, 0.10, 0.11)}
skin = np.asarray(Image.open(SKIN).convert("RGB"), np.float32) / 255
heads = [np.asarray(d[k], np.float32) / 255 for k in sorted(k for k in d.files if k.startswith("head"))]


def sample(img, u, v):
    """Bilinear, row = v (top-down), wrapped."""
    h, w = img.shape[:2]
    x = (u % 1) * w - 0.5; y = (v % 1) * h - 0.5
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int)
    fx = (x - x0)[..., None]; fy = (y - y0)[..., None]
    g = lambda yy, xx: img[np.clip(yy, 0, h - 1), np.clip(xx, 0, w - 1)]
    return (g(y0, x0) * (1 - fx) + g(y0, x0 + 1) * fx) * (1 - fy) + (g(y0 + 1, x0) * (1 - fx) + g(y0 + 1, x0 + 1) * fx) * fy


cls = d["cls"].astype(np.float32)
vals = np.concatenate([d["orig"], d["col"], np.repeat(cls[:, None, None], 3, 1)], axis=2)  # u v r g b cls
grid = raster.raster(d["atlas"] * [N, N], vals, N, N)
cov = ~np.isnan(grid[..., 0])
out = np.zeros((N, N, 3), np.float32)
c = np.where(cov, np.round(grid[..., 5]), -1).astype(int)
for k in np.unique(c[cov]):
    m = c == k
    u, v, col = grid[m, 0], grid[m, 1], grid[m, 2:5]
    if k == 0: out[m] = sample(skin, u, v) * col
    elif k in TINT: out[m] = np.array(TINT[k], np.float32) * col
    else: out[m] = sample(heads[k - 5], u, v)
# one skin: the MakeHuman skin brought to the head's own skin colour (median of each), so the
# game's skin tone reads the same on the face and the arms (it keeps each picture's detail)
def skinlike(px):
    """Skin tones only: warm, neither the red kit (green far below red) nor white or dark."""
    r, g, bb = px[..., 0], px[..., 1], px[..., 2]
    return (r > 0.2) & (g > 0.45 * r) & (g < 0.85 * r) & (bb > 0.4 * g) & (bb < 0.95 * g)


hs = out[c >= 5]
hs = hs[skinlike(hs)]
body = (c == 0)
bs = body & skinlike(out)
if bs.any() and len(hs) > 100:
    gain = np.median(hs, 0) / np.maximum(np.median(out[bs], 0), 1e-4)
    out[bs] *= gain
    print("SKIN gain", np.round(gain, 3), "on", int(bs.sum()), "of", int(body.sum()), "body texels")
out = dilate_into(out, cov, 12)
Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)).save(OUT)
print("PAINTED", OUT, N, "covered", round(float(cov.mean()), 3), {int(k): int((c == k).sum()) for k in np.unique(c[cov])})
