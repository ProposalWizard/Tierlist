# tools/bake3d/bake_light.py — BAKE A 3D SET'S LIGHT, with Blender's ray engine (headless).
#
#   blender -b --python tools/bake3d/bake_light.py -- <set.json> <config.json> <outdir>
#
# Reads the still triangles that tools/bake3d/capture.mjs caught from the live scene, and for every point of
# two grids works out how light really reaches it there:
#   - FLOOR: a top-down map of the ground (every 0.1–0.35 m). Per point: how much open sky it sees
#     (corner shade under walls, boards, goals, stands), whether the sun reaches it (soft-edged, every
#     stand's and roof's shadow over the WHOLE pitch, not just the 96 m the live shadow covers), and the light
#     bounced onto it off the lit stands and walls round it.
#   - VOLUME: the same three numbers through the air of the whole set (a 3D grid), for walls, stands, the
#     crowd, roofs — and for the people and the ball, which move through it and pick up the set's shade.
# One set of numbers per time of day (the sun moves). Writes .npy grids + meta.json; tools/bake3d/pack.py
# turns them into small WebP files for the game.
import json, math, os, sys, time
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
SET, CFG, OUT = argv[0], argv[1], argv[2]
os.makedirs(OUT, exist_ok=True)
cfg = json.load(open(CFG))
meta = json.load(open(SET))
raw = open(SET.replace(".json", ".bin"), "rb").read()
nV, nT = meta["nVert"], meta["nTri"]
pos = np.frombuffer(raw[: nV * 12], dtype=np.float32).reshape(-1, 3)
idx = np.frombuffer(raw[nV * 12: nV * 12 + nT * 12], dtype=np.uint32).reshape(-1, 3)

# per-triangle colour (brightness) and whether it is two-sided
tri_alb = np.zeros(nT, dtype=np.float32)
tri_two = np.zeros(nT, dtype=np.bool_)
keep = np.ones(nT, dtype=np.bool_)
drop_names = cfg.get("drop", [])
for m in meta["meshes"]:
    a, n = m["firstTri"], m["triCount"]
    r, g, b = m["albedo"]
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    tri_alb[a:a + n] = min(0.9, lum) if not m.get("emissive") else 0.3
    tri_two[a:a + n] = m.get("side", 0) == 2
    # inside-out meshes are sky domes (drawn from inside): they would roof the whole set over
    if any(d in m["name"] for d in drop_names) or m.get("side", 0) == 1:
        keep[a:a + n] = False
# triangles that are degenerate add nothing
p0, p1, p2 = pos[idx[:, 0]], pos[idx[:, 1]], pos[idx[:, 2]]
area = np.linalg.norm(np.cross(p1 - p0, p2 - p0), axis=1)
keep &= area > 1e-6
tri_map = np.nonzero(keep)[0]
polys = [tuple(int(i) for i in t) for t in idx[keep]]
verts = [Vector((float(x), float(y), float(z))) for x, y, z in pos]
t0 = time.time()
bvh = BVHTree.FromPolygons(verts, polys, all_triangles=True)
print(f"BVH: {len(polys)} triangles in {time.time() - t0:.1f}s", flush=True)

GROUND = cfg.get("groundAlbedo", 0.12)  # the ground plane at y=0 (grass) for rays that go down past everything
RADIUS = cfg.get("aoRadius", 0)  # 0: open sky (outdoors); >0: anything within this many metres shades (indoors)
TODS = cfg["tods"]  # [{ id, sun:[x,y,z] towards the sun, sky: sky-to-sun light ratio, soft: degrees }]
FAR = 1e4


def cast(o, d, dist=FAR):
    loc, nrm, i, dd = bvh.ray_cast(o, d, dist)
    if loc is None:
        if d.y < -1e-4 and o.y > 0:
            t = -o.y / d.y
            if t < dist:
                return (o + d * t, Vector((0, 1, 0)), -1, t)
        return None
    return (loc, nrm, i, dd)


def fib_dirs(n, hemi=False, cosine=False):
    out = []
    ga = math.pi * (3 - math.sqrt(5))
    for k in range(n):
        if cosine:  # cosine-weighted hemisphere (y up)
            r = math.sqrt((k + 0.5) / n); phi = k * ga
            x, z = r * math.cos(phi), r * math.sin(phi)
            out.append((x, math.sqrt(max(0.0, 1 - r * r)), z))
        elif hemi:
            y = 1 - (k + 0.5) / n
            r = math.sqrt(max(0.0, 1 - y * y)); phi = k * ga
            out.append((r * math.cos(phi), y, r * math.sin(phi)))
        else:
            y = 1 - 2 * (k + 0.5) / n
            r = math.sqrt(max(0.0, 1 - y * y)); phi = k * ga
            out.append((r * math.cos(phi), y, r * math.sin(phi)))
    return np.array(out)


def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def soft_sun(sun, soft, k):
    """k directions spread over the sun's disc (a soft shadow edge)."""
    s = np.array(sun, dtype=np.float64); s /= np.linalg.norm(s)
    up = np.array([0, 1, 0]) if abs(s[1]) < 0.95 else np.array([1, 0, 0])
    u = np.cross(s, up); u /= np.linalg.norm(u); v = np.cross(s, u)
    rad = math.radians(soft)
    out = [s]
    for j in range(1, k):
        a = j * 2.399963; r = rad * math.sqrt(j / (k - 1))
        d = s + u * math.cos(a) * r + v * math.sin(a) * r
        out.append(d / np.linalg.norm(d))
    return [Vector(tuple(x)) for x in out]


SUNS = [soft_sun(t["sun"], t.get("soft", 1.2), cfg.get("sunRays", 4)) for t in TODS]
SUN1 = [Vector(tuple(np.array(t["sun"]) / np.linalg.norm(t["sun"]))) for t in TODS]
SKYI = [t.get("sky", 0.3) for t in TODS]
EPS = 0.02


def sun_vis(p, k, rays):
    if RADIUS > 0:
        return 1.0
    v = 0
    for d in rays:
        if bvh.ray_cast(p + d * EPS, d, FAR)[0] is None:
            v += 1
    return v / len(rays)


def shade_point(p, dirs, floor):
    """(sky, sun[tods], bounce[tods], inside) at point p, rays along dirs (numpy Nx3)."""
    n = len(dirs)
    sky = 0.0; up = 0; back = 0; hits = 0
    bounce = [0.0] * len(TODS)
    for d in dirs:
        dv = Vector((d[0], d[1], d[2]))
        h = cast(p, dv, RADIUS if RADIUS > 0 else FAR)
        if d[1] > 0:
            up += 1
        if h is None:
            if floor or d[1] > 0:
                sky += 1
            continue
        hits += 1
        loc, nrm, ti, dist = h
        two = ti >= 0 and tri_two[tri_map[ti]]
        if ti >= 0 and nrm.dot(dv) > 0:
            if not two:
                back += 1
                continue
            nrm = -nrm
        alb = GROUND if ti < 0 else float(tri_alb[tri_map[ti]])
        q = loc + nrm * EPS
        for k in range(len(TODS)):
            cs = nrm.dot(SUN1[k])
            # the sky that surface sees: open ground ~all of it, a wall half, a ceiling none
            e = SKYI[k] * (0.9 if ti < 0 else 0.6 * (0.5 + 0.5 * nrm.y))
            if cs > 0 and RADIUS == 0:
                if bvh.ray_cast(q, SUN1[k], FAR)[0] is None:
                    e += cs
            bounce[k] += alb * e
    if floor:
        skyv = sky / n
        bnc = [b / n for b in bounce]
    else:
        skyv = sky / max(1, up)
        bnc = [b / n for b in bounce]
    suns = [sun_vis(p, k, SUNS[k]) for k in range(len(TODS))]
    return skyv, suns, bnc, back / n


def run_grid(kind, g, worker, nworkers):
    lo, hi, res = g["min"], g["max"], g["res"]
    dims = [max(2, int(round((hi[i] - lo[i]) / res[i])) + 1) for i in range(3)]
    if kind == "floor":
        dims[1] = 1
    nx, ny, nz = dims
    total = nx * ny * nz
    N = g.get("rays", 48)
    base = fib_dirs(N, cosine=(kind == "floor"))
    rots = [base @ rot_y(a).T for a in np.linspace(0, 2 * math.pi, 37)[:-1]]
    res_arr = np.zeros((total, 2 + 2 * len(TODS)), dtype=np.float32)
    for lin in range(worker, total, nworkers):
        ix = lin % nx; iz = (lin // nx) % nz; iy = lin // (nx * nz)
        x = lo[0] + ix * (hi[0] - lo[0]) / (nx - 1)
        z = lo[2] + iz * (hi[2] - lo[2]) / (nz - 1)
        y = g.get("y", 0.03) if kind == "floor" else lo[1] + iy * (hi[1] - lo[1]) / (ny - 1)
        p = Vector((x, y, z))
        dirs = rots[(ix * 7 + iz * 13 + iy * 5) % len(rots)]
        sky, suns, bnc, inside = shade_point(p, dirs, kind == "floor")
        res_arr[lin, 0] = sky
        res_arr[lin, 1] = inside
        for k in range(len(TODS)):
            res_arr[lin, 2 + k] = suns[k]
            res_arr[lin, 2 + len(TODS) + k] = bnc[k]
    return dims, res_arr


def bake(kind, g):
    nw = cfg.get("workers", 4)
    t0 = time.time()
    if nw > 1:
        # fork: every worker shares the BVH already built
        import multiprocessing as mp
        ctx = mp.get_context("fork")
        with ctx.Pool(nw) as pool:
            parts = pool.starmap(run_grid, [(kind, g, w, nw) for w in range(nw)])
        dims = parts[0][0]
        arr = parts[0][1]
        for w in range(1, nw):
            arr[w::nw] = parts[w][1][w::nw]
    else:
        dims, arr = run_grid(kind, g, 0, 1)
    print(f"{kind}: {dims} = {arr.shape[0]} points in {time.time() - t0:.1f}s", flush=True)
    return dims, arr


out_meta = {"tods": [t["id"] for t in TODS], "aoRadius": RADIUS}
for kind in ("floor", "volume"):
    if kind not in cfg:
        continue
    g = cfg[kind]
    dims, arr = bake(kind, g)
    nx, ny, nz = dims
    grid = arr.reshape(ny, nz, nx, -1)  # [y][z][x][ch]
    np.save(os.path.join(OUT, f"{kind}.npy"), grid)
    out_meta[kind] = {"min": g["min"], "max": g["max"], "dims": dims, "y": g.get("y", 0.03)}
json.dump(out_meta, open(os.path.join(OUT, "meta.json"), "w"), indent=1)
print("done", flush=True)
