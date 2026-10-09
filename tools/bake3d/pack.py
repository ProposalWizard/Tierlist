#!/usr/bin/env python3
"""tools/bake3d/pack.py — turn a bake (tools/bake3d/bake_light.py's .npy grids) into the game's small files.

    python3 tools/bake3d/pack.py <bakedir> <public/star/bake/SET>   (keep lossless: lossy WebP bleeds one number into another, measured p99 error 66/255 on the volume at q92)

Per time of day, two WebP pictures (RGB = open sky, sun reaches, bounced light):
    <tod>-floor.webp   the ground, seen from above (one pixel per grid point)
    <tod>-vol.webp     the air, as horizontal slices stacked top to bottom (slice y=0 first)
plus meta.json (where the grids sit in the world, their sizes, the bounced light's scale per time of day).
Grid points that fell inside a solid wall are refilled from their open neighbours (no dark smudge leaking
through a wall's surface).
"""
import json, os, sys
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
q = int(sys.argv[sys.argv.index("--quality") + 1]) if "--quality" in sys.argv else 100
os.makedirs(dst, exist_ok=True)
meta = json.load(open(os.path.join(src, "meta.json")))
tods = meta["tods"]
T = len(tods)
out = {"tods": tods, "aoRadius": meta.get("aoRadius", 0), "bounce": {}, "files": {}}


def fill_inside(g, inside, passes=12):
    """Replace grid points inside solid geometry with the mean of their open neighbours (6-connected)."""
    g = g.copy()
    bad = inside.copy()
    for _ in range(passes):
        if not bad.any():
            break
        acc = np.zeros_like(g)
        cnt = np.zeros(bad.shape, dtype=np.float32)
        for ax in range(bad.ndim):
            if bad.shape[ax] < 2:
                continue
            for sh in (1, -1):
                gv = np.roll(g, sh, axis=ax)
                ok = ~np.roll(bad, sh, axis=ax)
                # no wrap-around
                sl = [slice(None)] * bad.ndim
                sl[ax] = 0 if sh == 1 else -1
                ok[tuple(sl)] = False
                acc += gv * ok[..., None]
                cnt += ok
        fix = bad & (cnt > 0)
        g[fix] = acc[fix] / cnt[fix][:, None]
        bad = bad & ~fix
    return g


def blur2(a, k=1):
    """A small box blur in x/z (floor only): hides the ray-sampling noise."""
    out = a.copy()
    for _ in range(k):
        p = np.pad(out, ((1, 1), (1, 1), (0, 0)), mode="edge")
        out = (p[:-2, :-2] + p[:-2, 1:-1] + p[:-2, 2:] + p[1:-1, :-2] + 2 * p[1:-1, 1:-1] + p[1:-1, 2:] + p[2:, :-2] + p[2:, 1:-1] + p[2:, 2:]) / 10.0
    return out


total = 0
for kind in ("floor", "volume"):
    if kind not in meta:
        continue
    g = np.load(os.path.join(src, f"{kind}.npy"))  # [y][z][x][ch]
    ny, nz, nx, nch = g.shape
    inside = g[..., 1] > 0.35
    data = np.concatenate([g[..., :1], g[..., 2:]], axis=-1)  # sky, sun*T, bounce*T
    data = fill_inside(data, inside) if kind == "volume" else data
    if kind == "floor":
        data = blur2(data[0], 1)[None]
    out[kind] = {**meta[kind], "dims": [nx, ny, nz]}
    for k, tod in enumerate(tods):
        sky = data[..., 0]
        sun = data[..., 1 + k]
        bnc = data[..., 1 + T + k]
        scale = float(np.percentile(bnc, 99.5)) or 1.0
        out["bounce"].setdefault(kind, {})[tod] = round(scale, 5)
        rgb = np.stack([sky, sun, np.clip(bnc / scale, 0, 1)], axis=-1)
        img = (np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8).reshape(ny * nz, nx, 3)
        name = f"{tod}-{'floor' if kind == 'floor' else 'vol'}.webp"
        Image.fromarray(img, "RGB").save(os.path.join(dst, name), "WEBP", lossless=q >= 100, quality=q, method=6)
        sz = os.path.getsize(os.path.join(dst, name))
        total += sz
        out["files"][name] = sz
        print(f"{name}: {nx}x{ny * nz} px, {sz / 1024:.1f} KB")
json.dump(out, open(os.path.join(dst, "meta.json"), "w"), indent=1)
print(f"total {total / 1024:.1f} KB -> {dst}")
