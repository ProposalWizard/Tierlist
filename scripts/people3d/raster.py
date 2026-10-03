"""Triangle rasterising helpers (numpy), for reading and painting textures by
where on the body each texel is."""
import numpy as np


def raster(tris_xy, values, W, H, out=None, zbuf=None, depth=None):
    """Fill triangles (n,3,2 pixel coords) with per-vertex `values` (n,3,k),
    interpolated. With `depth` (n,3) keeps the nearest (smallest)."""
    k = values.shape[2]
    if out is None:
        out = np.full((H, W, k), np.nan, np.float32)
    if depth is not None and zbuf is None:
        zbuf = np.full((H, W), np.inf, np.float32)
    for t in range(tris_xy.shape[0]):
        p = tris_xy[t]
        x0, y0 = np.floor(p.min(0)).astype(int)
        x1, y1 = np.ceil(p.max(0)).astype(int)
        x0 = max(x0, 0); y0 = max(y0, 0); x1 = min(x1, W - 1); y1 = min(y1, H - 1)
        if x1 < x0 or y1 < y0:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        (ax, ay), (bx, by), (cx, cy) = p
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-12:
            continue
        w0 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den
        w1 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den
        w2 = 1 - w0 - w1
        m = (w0 >= -1e-4) & (w1 >= -1e-4) & (w2 >= -1e-4)
        if not m.any():
            continue
        v = values[t]
        val = w0[..., None] * v[0] + w1[..., None] * v[1] + w2[..., None] * v[2]
        sub = out[y0:y1 + 1, x0:x1 + 1]
        if depth is not None:
            d = w0 * depth[t, 0] + w1 * depth[t, 1] + w2 * depth[t, 2]
            zs = zbuf[y0:y1 + 1, x0:x1 + 1]
            m = m & (d < zs)
            zs[m] = d[m]
        sub[m] = val[m]
    return out
