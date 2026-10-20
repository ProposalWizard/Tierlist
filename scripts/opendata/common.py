"""Shared helpers for the open-data reducers (scripts/opendata/reduce_*.py).

Every pattern file uses ONE pitch frame, whatever the source:
  x 0..100  from the acting team's own goal line (0) to the goal it attacks (100)
  y 0..100  from the attacker's LEFT touchline (0) to its RIGHT touchline (100)
To get metres on a 105 x 68 pitch: x * 1.05, y * 0.68.

Zones:
  COARSE  6 x 5  (x thirds split in two; y = left wing, left half-space,
                  centre, right half-space, right wing - the centre band is
                  the width of the penalty box)
  FINE   12 x 8  equal cells, for heatmaps
Zone ids are row-major: id = ix * ny + iy (ix along x, iy along y).
"""
import json, math, os

COARSE_X = [0, 16.7, 33.3, 50, 66.7, 83.3, 100.001]
COARSE_Y = [0, 19, 37, 63, 81, 100.001]
FINE_NX, FINE_NY = 12, 8


def clamp(v, lo=0.0, hi=100.0):
    return lo if v < lo else hi if v > hi else v


def _bin(edges, v):
    v = clamp(v, 0, 100)
    for i in range(len(edges) - 1):
        if v < edges[i + 1]:
            return i
    return len(edges) - 2


def coarse(x, y):
    return _bin(COARSE_X, x) * (len(COARSE_Y) - 1) + _bin(COARSE_Y, y)


def fine(x, y, nx=FINE_NX, ny=FINE_NY):
    ix = min(nx - 1, int(clamp(x) / (100.0 / nx)))
    iy = min(ny - 1, int(clamp(y) / (100.0 / ny)))
    return ix * ny + iy


N_COARSE = (len(COARSE_X) - 1) * (len(COARSE_Y) - 1)
N_FINE = FINE_NX * FINE_NY


def metres(dx, dy):
    return math.hypot(dx * 1.05, dy * 0.68)


def r(v, n=3):
    return round(v, n) if isinstance(v, float) else v


def norm(counts, n=4):
    s = float(sum(counts))
    return [round(c / s, n) if s else 0 for c in counts]


def quantiles(vals, qs=(0.1, 0.25, 0.5, 0.75, 0.9)):
    if not vals:
        return {}
    v = sorted(vals)
    out = {}
    for q in qs:
        k = (len(v) - 1) * q
        f, c = math.floor(k), math.ceil(k)
        out[f"p{int(q * 100)}"] = round(v[f] + (v[c] - v[f]) * (k - f), 2)
    out["mean"] = round(sum(v) / len(v), 2)
    out["n"] = len(v)
    return out


def hist(vals, edges):
    """Counts per bin; values below/above the edges fall in the first/last bin."""
    import bisect
    out = [0] * (len(edges) - 1)
    for v in vals:
        i = bisect.bisect_right(edges, v) - 1
        out[max(0, min(len(out) - 1, i))] += 1
    return out


GRID_DOC = {
    "frame": "x 0..100 own goal -> attacked goal; y 0..100 attacker's left -> right touchline; metres = x*1.05, y*0.68",
    "coarse": {"x_edges": COARSE_X[:-1] + [100], "y_edges": COARSE_Y[:-1] + [100],
               "id": "ix * 5 + iy"},
    "fine": {"nx": FINE_NX, "ny": FINE_NY, "id": "ix * 8 + iy"},
}


def write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"))
    print(f"wrote {path} {os.path.getsize(path) / 1024:.1f} KB")
