"""TOON HAIR, MODELLED IN BLENDER (Harry, 20 Nov 2026: "still more hairstyles, dreads are common in
football, try and model new head shapes and hair").

Each style is built on a Style A head's own scalp (the head dumped by dump_head.mjs), in the head's
rest pose and metres, as chunky toon shapes: caps that follow the scalp, tapered tubes (locs, braids,
twists) that fall under gravity and rest ON the head, and blobs (curls, buns). Every vertex carries the
bone weights of the scalp under it (a strand: of its root), so the hair bends with the head exactly as
the scalp does. Nothing goes into the head: checked with a BVH (0 crossing triangles, the nearest
distance printed).

    blender -b --python tools/hair3d/build_hair.py -- <head dump dir> <out dir> <base name> [style ...]
    blender -b --python tools/hair3d/build_hair.py -- --check <head dump dir> <hair dir> <base name> [lift]

Out: <out dir>/hair-<base>-<style>.glb (POSITION, NORMAL, TEXCOORD_0 = shade and along-the-strand,
JOINTS_0/WEIGHTS_0 into extras.joints by name) and hair-<base>.json (triangles, clearances).
Then: node scripts/perf3d/shrink-models.mjs star/people3d/hair/hair-<base>-<style>.glb
"""
import bpy, bmesh, sys, os, math, json, random
import numpy as np
from mathutils import Vector, Matrix, noise
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "scripts", "people3d"))
import glb as GLB  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
RIM = 0.0014          # the hair's edge sits this far off the scalp (metres)
RAD = math.radians


def smooth(a, b, x):
    if a == b:
        return 1.0 if x >= b else 0.0
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def dirv(az, el):
    return Vector((math.sin(az) * math.cos(el), math.sin(el), math.cos(az) * math.cos(el)))


class Head:
    def __init__(self, d, lift=0.0):
        self.meta = json.load(open(os.path.join(d, "head.json")))
        ex = self.meta["extras"]
        self.P = np.fromfile(os.path.join(d, "pos.f32"), np.float32).reshape(-1, 3)
        self.I = np.fromfile(os.path.join(d, "idx.u32"), np.uint32).reshape(-1, 3)
        self.UV = np.fromfile(os.path.join(d, "uv.f32"), np.float32).reshape(-1, 2)
        self.J4 = np.fromfile(os.path.join(d, "joints.u16"), np.uint16).reshape(-1, 4)
        self.W4 = np.fromfile(os.path.join(d, "weights.f32"), np.float32).reshape(-1, 4)
        img = bpy.data.images.load(os.path.join(d, "mask.png"))
        self.mw, self.mh = img.size
        self.mpx = np.array(img.pixels[:], dtype=np.float32).reshape(self.mh, self.mw, 4)
        keep = (self.P[self.I][:, :, 1] > 1.36).any(axis=1)
        self.tris = self.I[keep]
        self.verts = [Vector(p) for p in self.P]
        self.bvh = BVHTree.FromPolygons(self.verts, [tuple(int(k) for k in t) for t in self.tris])
        self.eyeY = ex["face"]["eyeY"]; self.browY = ex["face"]["browY"]; self.chinY = ex["face"]["chinY"]
        self.collarY = ex["kit"]["collarY"]
        sk = self.P[self.P[:, 1] > self.eyeY + 0.03]
        self.top = float(sk[:, 1].max())
        self.halfW = float(np.abs(sk[:, 0]).max())
        self.zBack, self.zFront = float(sk[:, 2].min()), float(sk[:, 2].max())
        self.S = self.halfW / 0.105
        self.C = Vector((0.0, self.top - 0.13 * self.S, (self.zBack + self.zFront) / 2 - 0.006))
        # the ears: what sticks out past the skull between the jaw and the brow
        band = self.P[(self.P[:, 1] > self.eyeY - 0.07) & (self.P[:, 1] < self.eyeY + 0.05) & (np.abs(self.P[:, 0]) > self.halfW + 0.004)]
        self.earTop = float(band[:, 1].max()) if len(band) else self.eyeY + 0.03
        self.earZ = float(band[:, 2].mean()) if len(band) else 0.0
        self.napeY = self.eyeY - 0.07
        self._hairline()

    # ── the surface ──
    def ray(self, az, el, origin=None):
        d = dirv(az, el)
        loc, nor, fi, dist = self.bvh.ray_cast(origin or self.C, d)
        if loc is None:
            raise RuntimeError(f"no scalp at az {math.degrees(az):.0f} el {math.degrees(el):.0f}")
        if nor.dot(d) < 0:
            nor = -nor
        return loc, nor, fi

    def bary(self, fi, loc):
        a, b, c = (int(k) for k in self.tris[fi])
        pa, pb, pc = self.verts[a], self.verts[b], self.verts[c]
        v0, v1, v2 = pb - pa, pc - pa, loc - pa
        d00, d01, d11, d20, d21 = v0.dot(v0), v0.dot(v1), v1.dot(v1), v2.dot(v0), v2.dot(v1)
        den = d00 * d11 - d01 * d01 or 1e-12
        v = (d11 * d20 - d01 * d21) / den; w = (d00 * d21 - d01 * d20) / den
        v = max(0.0, min(1.0, v)); w = max(0.0, min(1.0 - v, w))
        return (a, b, c), (1 - v - w, v, w)

    def mask(self, fi, loc):
        (a, b, c), (u, v, w) = self.bary(fi, loc)
        uv = self.UV[a] * u + self.UV[b] * v + self.UV[c] * w
        x = min(self.mw - 1, max(0, int(uv[0] * self.mw))); y = min(self.mh - 1, max(0, int((1 - uv[1]) * self.mh)))
        return self.mpx[y, x, :3]

    def weights(self, p):
        loc, nor, fi, dist = self.bvh.find_nearest(p)
        (a, b, c), bw = self.bary(fi, loc)
        acc = {}
        for vi, k in zip((a, b, c), bw):
            for j, w in zip(self.J4[vi], self.W4[vi]):
                if w > 0:
                    acc[int(j)] = acc.get(int(j), 0.0) + float(w) * k
        top = sorted(acc.items(), key=lambda t: -t[1])[:4]
        s = sum(w for _, w in top) or 1.0
        return [(j, w / s) for j, w in top]

    def inside(self, p):
        """Is the point inside the head? (how many times a ray from it leaves the mesh: odd = inside; three rays vote)"""
        votes = 0
        for d in (Vector((0.131, 0.985, 0.113)), Vector((-0.213, 0.957, -0.197)), Vector((0.071, 0.931, -0.358))):
            d = d.normalized()
            o = Vector(p); n = 0
            for _ in range(12):
                loc, nor, fi, dist = self.bvh.ray_cast(o, d)
                if loc is None:
                    break
                n += 1
                o = loc + d * 1e-5
            votes += n % 2
        return votes >= 2

    def sdist(self, p):
        """Signed distance to the head: + outside."""
        loc, nor, fi, dist = self.bvh.find_nearest(p)
        return -dist if self.inside(p) else dist

    def push_out(self, p, dmin):
        for _ in range(3):
            loc, nor, fi, dist = self.bvh.find_nearest(p)
            v = p - loc
            if dist < 0.03 and self.inside(p):
                p = loc + nor * dmin
            elif dist < dmin:
                p = loc + (v / dist if dist > 1e-7 else nor) * dmin
            else:
                break
        return p

    # ── the hairline, read off the head's own mask ──
    def _hairline(self):
        n = 72
        raw = []
        for i in range(n):
            az = -math.pi + 2 * math.pi * i / n
            el = RAD(84); last = el; miss = 0
            while el > RAD(-40):
                loc, nor, fi = self.ray(az, el)
                front = abs(az) < RAD(100)
                floor = self.earTop + 0.006 if RAD(48) < abs(az) < RAD(118) else (self.napeY if not front else self.browY + 0.02)
                if loc.y < floor:
                    break
                if self.mask(fi, loc)[2] > 0.5:
                    last = el; miss = 0
                else:
                    miss += 1
                    if miss >= 3:
                        break
                el -= RAD(1)
            raw.append(last)
        sym = [(raw[i] + raw[(n - i) % n]) / 2 for i in range(n)]
        self.hl_tab = [(sym[(i - 1) % n] + 2 * sym[i] + sym[(i + 1) % n]) / 4 for i in range(n)]

    def hl(self, az):
        """The hairline's elevation (radians) at this azimuth (0 front, + his left, pi the back)."""
        n = len(self.hl_tab)
        f = ((az + math.pi) % (2 * math.pi)) / (2 * math.pi) * n
        i = int(f) % n
        return lerp(self.hl_tab[i], self.hl_tab[(i + 1) % n], f - int(f))


class Hair:
    def __init__(self, H):
        self.H = H; self.V = []; self.F = []; self.SH = []; self.AL = []; self.W = []

    def add(self, verts, faces, shade, along, w=None):
        o = len(self.V)
        self.V += verts
        self.F += [tuple(o + k for k in f) for f in faces]
        self.SH += shade; self.AL += along
        self.W += [w] * len(verts)

    def tris(self):
        return sum(len(f) - 2 for f in self.F)


def cap(M, lo, thick, naz=32, rings=(0, 0.05, 0.16, 0.3, 0.45, 0.6, 0.75, 0.9), blend=0.5, hi=None, az0=None, az1=None, shade=None, wall=0.7, pos=None):
    """A cap on the scalp. lo(az)/hi(az): elevations of its lower edge and (a band) its upper edge;
    thick(az, el, f, loc) metres. az0..az1: an open band (the ends taper to the scalp)."""
    H = M.H
    closed = az0 is None
    cols = naz if closed else naz + 1
    V, SH, AL, F = [], [], [], []
    idx = {}
    for i in range(cols):
        az = -math.pi + 2 * math.pi * i / naz if closed else lerp(az0, az1, i / naz)
        e0 = lo(az); e1 = hi(az) if hi else RAD(90)
        endk = 1.0 if closed else smooth(0, 2.2, min(i, naz - i))
        for j, f in enumerate(rings):
            el = lerp(e0, e1, f)
            loc, nor, fi = H.ray(az, el)
            d = dirv(az, el)
            n = (nor * blend + d * (1 - blend)).normalized()
            edge = j == 0 or (hi is not None and j == len(rings) - 1) or (not closed and (i == 0 or i == naz))
            if edge:
                t = RIM
            else:
                t = thick(az, el, f, loc) * endk
                if j == 1:
                    t *= wall
                if hi is not None and j == len(rings) - 2:
                    t *= wall
                t = max(t, RIM)
            p = pos(az, el, f, loc, n, t) if pos and not edge else loc + n * t
            idx[(i, j)] = len(V)
            V.append(p); AL.append(f)
            SH.append(shade(az, el, f, p) if shade else 1.0)
    nr = len(rings)
    for i in range(naz):
        i2 = (i + 1) % cols if closed else i + 1
        for j in range(nr - 1):
            F.append((idx[(i, j)], idx[(i2, j)], idx[(i2, j + 1)], idx[(i, j + 1)]))
    if hi is None:
        loc, nor, fi = H.ray(0, RAD(90))
        t = thick(0, RAD(90), 1.0, loc)
        p = pos(0, RAD(90), 1.0, loc, nor, t) if pos else loc + nor * t
        V.append(p); AL.append(1.0); SH.append(shade(0, RAD(90), 1.0, p) if shade else 1.0)
        pole = len(V) - 1
        for i in range(naz):
            i2 = (i + 1) % cols if closed else i + 1
            F.append((idx[(i, nr - 1)], idx[(i2, nr - 1)], pole))
    M.add(V, F, SH, AL)


def tube(M, path, radii, sides=5, twist=0.0, shade=(0.78, 1.0), w=None, tip=0.6, flat=1.0, hint=None, bead=0.0, root_shade=None):
    """A tapered tube along `path` (parallel-transported frame). flat < 1 squashes it along `hint`.
    bead: every other ring fatter (a braid). twist: radians per ring (a rope twist)."""
    n = len(path)
    V, SH, AL, F = [], [], [], []
    T = []
    for k in range(n):
        a = path[max(0, k - 1)]; b = path[min(n - 1, k + 1)]
        T.append((b - a).normalized())
    up = hint or Vector((0, 1, 0))
    nrm = (up - T[0] * up.dot(T[0]))
    if nrm.length < 1e-4:
        nrm = Vector((1, 0, 0)) - T[0] * T[0].x
    nrm.normalize()
    for k in range(n):
        if k > 0:
            nrm = (nrm - T[k] * nrm.dot(T[k]))
            if nrm.length < 1e-5:
                nrm = T[k].orthogonal()
            nrm.normalize()
        bn = T[k].cross(nrm).normalized()
        r = radii[k] if hasattr(radii, "__len__") else radii
        if bead and k % 2 == 1:
            r *= 1 + bead
        elif bead:
            r *= 1 - bead * 0.55
        for s in range(sides):
            a = 2 * math.pi * s / sides + twist * k
            V.append(path[k] + (nrm * math.cos(a) * flat + bn * math.sin(a)) * r)
            f = k / (n - 1)
            sh = lerp(shade[0], shade[1], smooth(0, 0.35, f))
            if bead:
                sh *= 1.0 if k % 2 == 1 else 0.8
            if root_shade is not None and k == 0:
                sh = root_shade
            SH.append(sh); AL.append(f)
    for k in range(n - 1):
        for s in range(sides):
            a = k * sides + s; b = k * sides + (s + 1) % sides
            F.append((a, b, b + sides, a + sides))
    r = radii[-1] if hasattr(radii, "__len__") else radii
    V.append(path[-1] + T[-1] * r * tip); SH.append(shade[1]); AL.append(1.0)
    tipi = len(V) - 1
    for s in range(sides):
        F.append(((n - 1) * sides + s, (n - 1) * sides + (s + 1) % sides, tipi))
    M.add(V, F, SH, AL, w)


def simplify(path, tol):
    """Douglas-Peucker: a straight hanging stretch needs two points, a bend keeps its own."""
    if len(path) < 3:
        return list(path)
    a, b = path[0], path[-1]
    ab = b - a; L = ab.length or 1e-9
    best, bi = 0.0, 0
    for i in range(1, len(path) - 1):
        d = (path[i] - a).cross(ab).length / L
        if d > best:
            best, bi = d, i
    if best <= tol:
        return [a, b]
    return simplify(path[:bi + 1], tol)[:-1] + simplify(path[bi:], tol)


def drape(H, loc, nor, length, r, d0, seg=0.014, grav=0.3, clear=0.002, base=0.0, stop_y=None, keep_face=True, flick=None):
    """A strand from the scalp: it leaves along d0, bends down under its weight and rests on the head
    (never nearer than r + clear + base). Stops at `length`, at stop_y, or before it would hang over the face."""
    dmin = r + clear + base
    p = H.push_out(loc + nor * dmin, dmin)
    d = d0.normalized()
    pts = [p]
    run = 0.0
    G = Vector((0, -1, 0))
    while run < length:
        d = (d + G * grav).normalized()
        if flick and run > length * 0.75:
            d = (d + flick * 0.35).normalized()
        q = H.push_out(p + d * seg, dmin)
        if (q - p).length < seg * 0.25:
            break
        if keep_face and q.y < H.browY + 0.03 and q.z > H.earZ + 0.05 and abs(q.x) < H.halfW + 0.03:
            break
        d = (q - p).normalized()
        run += (q - p).length
        p = q
        pts.append(p)
        if stop_y is not None and p.y < stop_y:
            break
    return pts


def blob(M, c, radii, sub=1, bump=0.0, freq=40.0, shade=(0.8, 1.0), rot=None, swirl=0.0, w=None, clear=RIM):
    H = M.H
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub + 1, radius=1.0)
    V, SH, AL = [], [], []
    for v in bm.verts:
        u = v.co.normalized()
        k = 1.0
        if bump:
            k += bump * noise.noise((c + u * 0.02) * freq)
        if swirl:
            k += swirl * math.sin(math.atan2(u.x, u.z) * 3 + u.y * 5)
        q = Vector((u.x * radii[0], u.y * radii[1], u.z * radii[2])) * k
        if rot:
            q = rot @ q
        p = H.push_out(c + q, clear)
        V.append(p)
        SH.append(lerp(shade[0], shade[1], smooth(-0.6, 0.7, u.y)) * (1 + (0.12 * math.sin(math.atan2(u.x, u.z) * 3 + u.y * 5) if swirl else 0)))
        AL.append(0.5 + 0.5 * u.y)
    F = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    M.add(V, F, SH, AL, w)


def fib_roots(H, n, lo, rnd, hi=RAD(88), jitter=0.5, front_bias=0.0):
    """Roots spread evenly over the hair above lo(az) (a golden-angle spiral on the scalp)."""
    out = []
    N = n * 10
    ga = math.pi * (3 - math.sqrt(5))
    for k in range(N):
        y = 1 - (k + 0.5) / N * 1.15          # from the pole down past the equator
        el = math.asin(max(-0.3, min(1.0, y)))
        az = ((k * ga + rnd.uniform(-jitter, jitter) * 0.15) + math.pi) % (2 * math.pi) - math.pi
        if el < lo(az) or el > hi:
            continue
        out.append((az, el))
    # thin evenly to n
    if len(out) > n:
        step = len(out) / n
        out = [out[int(i * step)] for i in range(n)]
    return out


# ───────────────────────────── the styles ─────────────────────────────

def cell(p, f):
    """0 at a cell's edge … 1 at its middle (chunky lumps)."""
    d = noise.voronoi(p * f)[0]
    return max(0.0, 1.0 - d[0] / max(d[1], 1e-5))


def lumps(p, f=27.0):
    """Coily lumps: big soft cells with a finer bobble on top (-0.2 … 1)."""
    return 0.75 * cell(p, f) + 0.25 * cell(p + Vector((0.31, 0.17, 0.23)), f * 2.1) + 0.12 * noise.noise(p * f * 1.3)


def s_afro(H, M, rnd):
    S = H.S

    def lo(az):   # a slightly uneven hairline
        return H.hl(az) - RAD(2) + RAD(1.6) * noise.noise(Vector((math.sin(az) * 2.2, math.cos(az) * 2.2, 0.4))) + RAD(0.8) * math.sin(az * 9)

    def thick(az, el, f, loc):
        t = lerp(0.02, 0.028, smooth(RAD(5), RAD(60), el))
        t = lerp(t, 0.017, smooth(RAD(120), RAD(180), abs(az)) * (1 - smooth(RAD(10), RAD(45), el)))
        return (t - 0.004 + 0.019 * lumps(loc) * smooth(0.0, 0.1, f)) * S

    def shade(az, el, f, p):
        return 0.7 + 0.3 * max(0.0, lumps(p))
    cap(M, lo, thick, naz=60, rings=(0, 0.03, 0.08, 0.14, 0.21, 0.28, 0.35, 0.42, 0.5, 0.58, 0.66, 0.74, 0.82, 0.9, 0.96), blend=0.35, shade=shade, wall=0.75)


def s_hightop(H, M, rnd):
    S = H.S
    ytop = H.top + 0.04 * S
    c = Vector((0, 0, H.C.z + 0.008))

    def lo(az):   # where the tall hair starts: the forehead's hairline, round the sides above the fade
        side = lerp(RAD(26), RAD(17), smooth(RAD(35), RAD(85), abs(az)))
        side = lerp(side, RAD(13), smooth(RAD(110), RAD(170), abs(az)))
        return max(H.hl(az) - RAD(1), side) + RAD(0.8) * math.sin(az * 11)

    # the outline, from the fade line (0) up the side (it leans out a little: wider at the top), round the
    # top edge, and in across a gently domed top (1): (how far up, how far out in metres, how far in to the middle)
    PROF = ((0.0, 0.0, 1.0), (0.14, 0.0035, 1.0), (0.34, 0.0065, 1.0), (0.56, 0.009, 1.0), (0.76, 0.0105, 1.0), (0.9, 0.009, 0.99),
            (0.975, 0.005, 0.95), (1.0, 0.0, 0.86), (1.012, 0.0, 0.66), (1.02, 0.0, 0.4), (1.024, 0.0, 0.16))
    rings = tuple(i / len(PROF) for i in range(len(PROF)))

    def pos(az, el, f, loc, n, t):
        i = min(len(PROF) - 1, int(round(f * len(PROF))))
        up, out_, k = PROF[i]
        loc0, nor0, _ = H.ray(az, lo(az))
        out = Vector((loc0.x - c.x, 0, loc0.z - c.z))
        r0 = out.length; out.normalize()
        q = Vector((c.x + out.x * r0 * k, lerp(loc0.y, ytop, up), c.z + out.z * r0 * k)) + out * out_ * S
        b = (lumps(q, 30) - 0.35) * smooth(0.0, 0.3, up)
        side = smooth(0.8, 1.0, k)
        q += out * (0.012 * b * side * S) + Vector((0, 0.009 * b * (1 - side) * S, 0))
        return H.push_out(q, RIM)

    def shade(az, el, f, p):
        return 0.72 + 0.28 * max(0.0, lumps(p, 30))
    cap(M, lo, lambda az, el, f, loc: 0.02, naz=52, rings=rings, blend=0.5, shade=shade, wall=1.0, pos=pos)
    loc, nor, fi = H.ray(0, RAD(90))
    M.V[-1] = Vector((c.x, ytop + 0.001 * S, c.z))


def loc_radii(n, r0, r1):
    return [lerp(r0, r1, smooth(0.0, 1.0, k / max(1, n - 1))) for k in range(n)]


def s_locs_short(H, M, rnd):
    S = H.S
    fade = lambda az: max(H.hl(az) - RAD(1), RAD(20))
    cap(M, fade, lambda az, el, f, loc: (0.007 + 0.003 * cell(loc, 50)) * S, naz=32, rings=(0, 0.08, 0.3, 0.55, 0.8), shade=lambda az, el, f, p: 0.7 + 0.1 * cell(p, 50))
    for az, el in fib_roots(H, 34, lambda a: fade(a) + RAD(9), rnd):
        loc, nor, fi = H.ray(az, el)
        front = smooth(RAD(70), RAD(25), abs(az)) * smooth(RAD(75), RAD(40), el)
        length = lerp(rnd.uniform(0.085, 0.115), rnd.uniform(0.05, 0.062), front) * S
        r0 = rnd.uniform(0.0082, 0.0094) * S
        radial = Vector((loc.x - H.C.x, 0, loc.z - H.C.z))
        if radial.length < 0.02:
            radial = dirv(rnd.uniform(-math.pi, math.pi), 0)
        radial.normalize()
        d0 = nor * 0.7 + radial * 0.7 + Vector((rnd.uniform(-0.2, 0.2), 0.0, rnd.uniform(-0.2, 0.2)))
        pts = drape(H, loc, nor, length, r0, d0, seg=0.013 * S, grav=0.2, base=0.004 * S, clear=0.002)
        if len(pts) < 3:
            continue
        pts = [loc + nor * (RIM + r0 * 0.4)] + simplify(pts, 0.0012)
        w = H.weights(loc)
        k = rnd.uniform(0.9, 1.06)
        tube(M, pts, loc_radii(len(pts), r0, r0 * 0.78), sides=5, shade=(0.74 * k, 1.0 * k), w=w, tip=0.5, hint=nor, root_shade=0.62)


def s_locs_long(H, M, rnd):
    S = H.S
    full = lambda az: H.hl(az) - RAD(2)
    cap(M, full, lambda az, el, f, loc: (0.006 + 0.003 * cell(loc, 50)) * S, naz=32, rings=(0, 0.06, 0.25, 0.5, 0.75), shade=lambda az, el, f, p: 0.68 + 0.1 * cell(p, 50))
    stop = H.collarY + 0.03
    roots = fib_roots(H, 36, lambda a: full(a) + RAD(7), rnd)
    for n_, (az, el) in enumerate(roots):
        loc, nor, fi = H.ray(az, el)
        r0 = rnd.uniform(0.0085, 0.0098) * S
        # worn back off the face: a front loc runs back over the top before it hangs
        back = smooth(RAD(95), RAD(50), abs(az))
        side = 1.0 if az >= 0 else -1.0
        radial = Vector((loc.x - H.C.x, 0, loc.z - H.C.z))
        if radial.length < 0.02:
            radial = Vector((side * 0.4, 0, -1))
        radial.normalize()
        sweep = Vector((side * 0.55, 0.1, -1.0)).normalized()
        d0 = nor * lerp(0.3, 0.35, back) + radial * (1 - back) * 0.3 + Vector((0, -0.5 * (1 - back), 0)) + sweep * back * 1.1
        layer = (n_ % 3) * 0.004 * S + back * 0.005 * S
        pts = drape(H, loc, nor, 0.46 * S, r0, d0, seg=0.014 * S, grav=lerp(0.42, 0.1, back), base=0.003 * S + layer, clear=0.0022,
                    stop_y=stop + rnd.uniform(0.0, 0.035))
        if len(pts) < 4:
            continue
        pts = [loc + nor * (RIM + r0 * 0.4)] + simplify(pts, 0.0011)
        w = H.weights(loc)
        k = rnd.uniform(0.88, 1.06)
        tube(M, pts, loc_radii(len(pts), r0, r0 * 0.74), sides=5, shade=(0.72 * k, 1.0 * k), w=w, tip=0.5, hint=nor, root_shade=0.6)


def scalp_path(H, a0, e0, a1, e1, n, off):
    """Along the scalp from one direction to another, `off` above it."""
    d0, d1 = dirv(a0, e0), dirv(a1, e1)
    out = []
    for k in range(n + 1):
        d = d0.slerp(d1, k / n)
        loc, nor, fi, dist = H.bvh.ray_cast(H.C, d)
        if nor.dot(d) < 0:
            nor = -nor
        out.append(H.push_out(loc + nor * off, off))
    return out


def s_locs_bun(H, M, rnd):
    S = H.S
    full = lambda az: H.hl(az) - RAD(2)
    cap(M, full, lambda az, el, f, loc: (0.0055 + 0.002 * cell(loc, 50)) * S, naz=32, rings=(0, 0.06, 0.25, 0.5, 0.75), shade=lambda az, el, f, p: 0.66 + 0.08 * cell(p, 50))
    ta, te = math.pi, RAD(46)
    tloc, tnor, _ = H.ray(ta, te)
    bun_c = tloc + tnor * 0.04 * S
    roots = []
    for i in range(22):
        az = -math.pi + 2 * math.pi * (i + 0.5) / 22
        roots.append((az, full(az) + RAD(rnd.uniform(5, 9))))
    for i in range(8):
        az = -math.pi + 2 * math.pi * (i + 0.25) / 8
        roots.append((az, lerp(full(az), RAD(90), 0.45)))
    for az, el in roots:
        if abs(abs(az) - math.pi) < RAD(14) and el > RAD(25):
            continue
        r0 = rnd.uniform(0.0078, 0.009) * S
        pts = scalp_path(H, az, el, ta + rnd.uniform(-0.12, 0.12), te + rnd.uniform(-0.1, 0.1), 7, 0.0055 * S + r0 + 0.002)
        pts[-1] = pts[-1].lerp(bun_c, 0.5)
        loc, nor, fi = H.ray(az, el)
        pts = [loc + nor * (RIM + r0 * 0.4)] + pts
        k = rnd.uniform(0.9, 1.05)
        tube(M, pts, loc_radii(len(pts), r0, r0 * 0.92), sides=5, shade=(0.72 * k, 0.98 * k), tip=0.3, hint=nor, root_shade=0.6)
    w = H.weights(tloc)
    # the knot: locs wound round on themselves
    for j in range(3):
        ring = []
        tilt = Matrix.Rotation(RAD(-38 + j * 26), 3, "X") @ Matrix.Rotation(RAD(j * 50), 3, "Y")
        R = (0.036 - j * 0.004) * S
        for k in range(13):
            a = 2 * math.pi * k / 12
            ring.append(H.push_out(bun_c + tilt @ Vector((math.cos(a) * R, (j - 1) * 0.011 * S, math.sin(a) * R)), 0.012 * S))
        tube(M, ring, 0.012 * S, sides=5, shade=(0.8, 1.0), w=w, tip=0.2, hint=tnor)
    blob(M, bun_c, (0.026 * S, 0.024 * S, 0.026 * S), sub=1, shade=(0.7, 0.9), w=w)
    # loose ends out of the knot
    for j in range(7):
        a = RAD(-75 + j * 25)
        d0 = Vector((math.sin(a) * 0.9, 0.25, -0.6)).normalized()
        r0 = 0.0082 * S
        start = bun_c + d0 * 0.022 * S
        pts = drape(H, start, d0, rnd.uniform(0.06, 0.1) * S, r0, d0, seg=0.014 * S, grav=0.3, clear=0.002, keep_face=False)
        if len(pts) >= 3:
            tube(M, [bun_c + d0 * 0.01 * S] + simplify(pts, 0.0012), loc_radii(len(pts) + 1, r0, r0 * 0.75), sides=5, shade=(0.78, 1.0), w=w, tip=0.5, hint=tnor)


def s_twists(H, M, rnd):
    S = H.S
    fade = lambda az: max(H.hl(az) - RAD(1), RAD(12)) if abs(az) > RAD(42) else H.hl(az) - RAD(2)
    cap(M, fade, lambda az, el, f, loc: (0.006 + 0.003 * cell(loc, 60)) * S, naz=32, rings=(0, 0.08, 0.3, 0.55, 0.8), shade=lambda az, el, f, p: 0.68 + 0.1 * cell(p, 60))
    for az, el in fib_roots(H, 62, lambda a: fade(a) + RAD(6), rnd):
        loc, nor, fi = H.ray(az, el)
        r0 = rnd.uniform(0.0064, 0.0074) * S
        radial = Vector((loc.x - H.C.x, 0, loc.z - H.C.z))
        radial = radial.normalized() if radial.length > 0.02 else Vector((0, 0, 0))
        d = (nor * 0.9 + radial * 0.35 + Vector((rnd.uniform(-0.25, 0.25), 0.1, rnd.uniform(-0.25, 0.25)))).normalized()
        L = rnd.uniform(0.034, 0.05) * S
        p0 = loc + nor * (RIM + r0 * 0.5)
        pts = [p0]
        for k in range(1, 4):
            d = (d + Vector((0, -0.12, 0))).normalized()
            pts.append(H.push_out(pts[-1] + d * L / 3, r0 + 0.008 * S))
        kk = rnd.uniform(0.9, 1.06)
        tube(M, pts, [r0, r0 * 0.95, r0 * 0.8, r0 * 0.55], sides=4, twist=RAD(48), shade=(0.72 * kk, 1.0 * kk), w=H.weights(loc), tip=0.7, hint=nor, root_shade=0.62)


def s_braids(H, M, rnd):
    S = H.S
    stop = H.collarY + 0.035
    lanes = 9
    for i in range(lanes):
        u = (i / (lanes - 1)) * 2 - 1
        x = u * 0.088 * S
        o = Vector((x, H.C.y - 0.035 * S, H.C.z))
        r0 = 0.0074 * S
        off = r0 * 1.05 + 0.0022
        pts = []
        started = False
        t = RAD(8)
        last = None
        while t < RAD(232):
            d = Vector((0, math.sin(t), math.cos(t)))
            loc, nor, fi, dist = H.bvh.ray_cast(o, d)
            t += RAD(6.4) / max(0.45, (dist or 0.1) / 0.11)
            if loc is None:
                continue
            if nor.dot(d) < 0:
                nor = -nor
            isHair = H.mask(fi, loc)[2] > 0.5
            if not started:
                if not isHair or loc.y < H.browY + 0.03:
                    continue
                started = True
                pts.append(loc + nor * (RIM + r0 * 0.3))
            if loc.z < H.C.z and loc.y < H.napeY + 0.012:
                break
            if abs(u) > 0.7 and loc.y < H.earTop + 0.012:   # the outer rows stay above the ear
                continue
            last = (loc, nor)
            pts.append(H.push_out(loc + nor * off, off))
        if last is None or len(pts) < 5:
            continue
        loc, nor = last
        d0 = Vector((u * 0.25, -1, -0.35)).normalized()
        hang = drape(H, loc, nor, 0.2 * S, r0, d0, seg=0.013 * S, grav=0.3, clear=0.0022, stop_y=stop + rnd.uniform(0, 0.03), keep_face=False)
        pts += hang[1:]
        w0 = H.weights(pts[0])
        tube(M, pts, loc_radii(len(pts), r0, r0 * 0.85), sides=5, shade=(0.8, 1.0), tip=0.6, hint=Vector((0, 1, 0)), bead=0.2, root_shade=0.7, w=None if len(hang) < 2 else None)
        # the hanging part follows the nape's bones
        n_h = len(hang) - 1
        if n_h > 0:
            wn = H.weights(loc)
            total = len(M.W)
            for k in range(total - 1 - (n_h * 5), total):
                M.W[k] = wn
        del w0


def s_curly_top(H, M, rnd):
    S = H.S
    fade = lambda az: max(H.hl(az) - RAD(1), RAD(27)) if abs(az) > RAD(38) else H.hl(az) - RAD(2)
    cap(M, fade, lambda az, el, f, loc: (0.011 + 0.004 * cell(loc, 44)) * S, naz=32, rings=(0, 0.08, 0.3, 0.55, 0.8), shade=lambda az, el, f, p: 0.7 + 0.12 * cell(p, 44))
    for az, el in fib_roots(H, 30, lambda a: fade(a) + RAD(3), rnd, jitter=1.0):
        loc, nor, fi = H.ray(az, el)
        front = smooth(RAD(80), RAD(20), abs(az))
        r = rnd.uniform(0.019, 0.026) * S * lerp(0.9, 1.15, front)
        c = loc + nor * (0.011 * S + r * 0.45) + Vector((0, 0, 0.008 * S * front))
        rot = Matrix.Rotation(rnd.uniform(0, 6.28), 3, nor) @ Matrix.Rotation(rnd.uniform(-0.4, 0.4), 3, "X")
        blob(M, c, (r, r * rnd.uniform(0.78, 0.95), r * rnd.uniform(0.9, 1.1)), sub=1, bump=0.16, freq=70, shade=(0.74, 1.0), rot=rot, swirl=0.08, w=H.weights(loc))


def comb(p, n=20.0):
    return 0.5 + 0.5 * math.sin(math.atan2(p.x, 0.16) * n * 6.0)


def s_crew(H, M, rnd):
    S = H.S

    def thick(az, el, f, loc):
        t = lerp(0.0045, 0.0105, smooth(RAD(15), RAD(55), el))
        t += 0.005 * smooth(RAD(70), RAD(15), abs(az)) * smooth(RAD(75), RAD(40), el) * smooth(RAD(20), RAD(40), el)
        return (t + 0.0012 * noise.noise(loc * 90)) * S
    cap(M, lambda az: H.hl(az) - RAD(2), thick, naz=36, rings=(0, 0.05, 0.16, 0.3, 0.45, 0.6, 0.75, 0.9), blend=0.6, shade=lambda az, el, f, p: 0.86 + 0.1 * noise.noise(p * 90), wall=0.8)


def s_slick(H, M, rnd, tight=False):
    S = H.S

    def thick(az, el, f, loc):
        front = smooth(RAD(85), RAD(20), abs(az))
        t = lerp(0.006, 0.011, smooth(RAD(10), RAD(50), el))
        if not tight:
            t += 0.014 * front * smooth(RAD(88), RAD(48), el)
        return (t + (0.0013 if not tight else 0.0009) * (comb(loc) - 0.5) * smooth(0.03, 0.2, f)) * S
    cap(M, lambda az: H.hl(az) - RAD(2), thick, naz=48, rings=(0, 0.045, 0.14, 0.26, 0.4, 0.55, 0.7, 0.85), blend=0.5,
        shade=lambda az, el, f, p: 0.8 + 0.2 * comb(p), wall=0.85 if not tight else 0.75)


def s_ponytail(H, M, rnd):
    S = H.S
    s_slick(H, M, rnd, tight=True)
    loc, nor, fi = H.ray(math.pi, RAD(12))
    w = H.weights(loc)
    d0 = (nor * 0.8 + Vector((0, -0.25, -0.3))).normalized()
    base = loc + nor * 0.004 * S
    pts = [base, base + d0 * 0.02 * S]
    p = pts[-1]; d = d0.copy()
    for k in range(12):
        d = (d + Vector((0, -0.7, 0.04))).normalized()
        p = H.push_out(p + d * 0.021 * S, 0.022 * S)
        pts.append(p)
        if p.y < H.collarY + 0.02:
            break
    if os.environ.get('HAIR_DEBUG'):
        print('PONY', [tuple(round(x, 3) for x in q) for q in pts])
    n = len(pts)
    rad = [lerp(0.012, 0.023, smooth(0, 0.3, k / (n - 1))) * lerp(1.0, 0.4, smooth(0.5, 1.0, k / (n - 1))) * S for k in range(n)]
    tube(M, pts, rad, sides=7, shade=(0.82, 1.0), w=w, tip=1.2, hint=Vector((1, 0, 0)), flat=1.5)
    # the band
    tube(M, [base + d0 * 0.012 * S, base + d0 * 0.02 * S, base + d0 * 0.028 * S], [0.0135 * S, 0.0145 * S, 0.0135 * S], sides=7, shade=(0.45, 0.45), w=w, tip=0.0, hint=Vector((1, 0, 0)))


def s_manbun(H, M, rnd):
    S = H.S
    s_slick(H, M, rnd, tight=True)
    loc, nor, fi = H.ray(math.pi, RAD(50))
    w = H.weights(loc)
    c = loc + nor * 0.034 * S
    rot = Matrix.Rotation(math.atan2(nor.z, nor.y), 3, "X")
    blob(M, c, (0.037 * S, 0.033 * S, 0.037 * S), sub=2, shade=(0.78, 1.0), rot=rot, swirl=0.1, w=w, clear=RIM)
    ring = [H.push_out(loc + nor * 0.008 * S + rot @ Vector((math.cos(a) * 0.02 * S, 0, math.sin(a) * 0.02 * S)), 0.006 * S) for a in [2 * math.pi * k / 10 for k in range(11)]]
    tube(M, ring, 0.0045 * S, sides=4, shade=(0.45, 0.45), w=w, tip=0.0, hint=nor)


def s_mullet(H, M, rnd):
    S = H.S

    def thick(az, el, f, loc):
        t = lerp(0.005, 0.014, smooth(RAD(18), RAD(52), el))
        t += 0.004 * smooth(RAD(70), RAD(15), abs(az)) * smooth(RAD(80), RAD(45), el)
        t += 0.006 * smooth(RAD(115), RAD(160), abs(az)) * (1 - smooth(RAD(20), RAD(60), el))
        return (t + 0.003 * cell(loc, 55) * smooth(RAD(25), RAD(50), el)) * S
    cap(M, lambda az: H.hl(az) - RAD(2), thick, naz=40, rings=(0, 0.05, 0.16, 0.3, 0.45, 0.6, 0.75, 0.9), blend=0.5, shade=lambda az, el, f, p: 0.8 + 0.2 * cell(p, 55), wall=0.8)
    stop = H.collarY + 0.022
    k = 0
    for row, (eoff, n) in enumerate(((RAD(4), 5), (RAD(18), 4))):
        for i in range(n):
            az = math.pi + RAD(lerp(-66, 66, (i + 0.5 * (row % 2) * 0 + 0.5) / n))
            el = H.hl(az) + eoff
            loc, nor, fi = H.ray(az, el)
            r0 = rnd.uniform(0.03, 0.034) * S
            out = Vector((loc.x, 0, loc.z - H.C.z)).normalized()
            d0 = (nor * 0.25 + Vector((0, -1, 0)) + out * 0.1).normalized()
            pts = drape(H, loc, nor, 0.2 * S, r0 * 0.3, d0, seg=0.016 * S, grav=0.3, clear=0.002, base=row * 0.006 * S, stop_y=stop + rnd.uniform(0, 0.02), keep_face=False, flick=out)
            if len(pts) < 3:
                continue
            pts = [loc + nor * (RIM + 0.004)] + simplify(pts, 0.001)
            n_ = len(pts)
            rad = [r0 * lerp(1.0, 0.45, smooth(0.5, 1.0, q / (n_ - 1))) for q in range(n_)]
            kk = rnd.uniform(0.9, 1.05)
            tube(M, pts, rad, sides=6, shade=(0.93, 1.0), w=H.weights(loc), tip=0.7, hint=out, flat=0.28)
            k += 1


def s_thinning(H, M, rnd):
    S = H.S
    a0, a1 = RAD(60), RAD(300)

    def az_n(az):   # 50..310 → the same angle in -180..180
        return ((az + math.pi) % (2 * math.pi)) - math.pi

    def lo(az):
        return H.hl(az_n(az)) - RAD(2)

    def hi(az):
        a = abs(az_n(az))
        top = lerp(RAD(34), RAD(47), smooth(RAD(60), RAD(150), a))
        return max(lo(az) + RAD(5), lerp(lo(az) + RAD(5), top, smooth(RAD(62), RAD(95), a)))
    cap(M, lo, lambda az, el, f, loc: (0.0058 + 0.0012 * noise.noise(loc * 80)) * S, naz=34, rings=(0, 0.08, 0.3, 0.55, 0.8, 0.93, 1.0), hi=hi, az0=a0, az1=a1,
        blend=0.6, shade=lambda az, el, f, p: 0.86 + 0.12 * comb(p, 26), wall=0.75)


def s_receding(H, M, rnd):
    S = H.S

    def lo(az):
        a = abs(az)
        rec = RAD(15) * smooth(RAD(72), RAD(40), a) + RAD(11) * math.exp(-((a - RAD(34)) / RAD(13)) ** 2)
        return H.hl(az) - RAD(2) + rec

    def thick(az, el, f, loc):
        t = lerp(0.005, 0.0095, smooth(RAD(15), RAD(55), el))
        return (t + 0.0012 * (comb(loc) - 0.5)) * S
    cap(M, lo, thick, naz=44, rings=(0, 0.05, 0.16, 0.3, 0.45, 0.6, 0.75, 0.9), blend=0.6, shade=lambda az, el, f, p: 0.82 + 0.18 * comb(p), wall=0.7)


STYLES = {
    "locsShort": s_locs_short, "locsLong": s_locs_long, "locsBun": s_locs_bun, "afro": s_afro, "highTop": s_hightop,
    "twists": s_twists, "braids": s_braids, "curlyTop": s_curly_top, "crew": s_crew, "slickBack": s_slick,
    "ponytail": s_ponytail, "manBun": s_manbun, "mullet": s_mullet, "thinning": s_thinning, "receding": s_receding,
}


# ───────────────────────────── build, check, write ─────────────────────────────

def to_object(M, name):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in M.V], [], M.F)
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def tri_arrays(M, ob):
    me = ob.data
    me.calc_loop_triangles()
    V = np.array([tuple(v.co) for v in me.vertices], np.float32)
    N = np.array([tuple(v.normal) for v in me.vertices], np.float32)
    T = np.array([tuple(t.vertices) for t in me.loop_triangles], np.uint32)
    return V, N, T


def check(H, V, T):
    """Crossing triangle pairs, and the least distance of the hair from the head (+ outside)."""
    hb = BVHTree.FromPolygons([Vector(v) for v in V], [tuple(int(k) for k in t) for t in T])
    pairs = hb.overlap(H.bvh)
    for a_, b_ in pairs[:3]:
        print("  CROSS at", tuple(round(float(x), 3) for x in V[T[a_]].mean(axis=0)))
    least = 1e9; where = None
    for t in T:
        a, b, c = (Vector(V[int(k)]) for k in t)
        for p in (a, b, c, (a + b) / 2, (b + c) / 2, (c + a) / 2, (a + b + c) / 3):
            d = H.sdist(p)
            if d < least:
                least = d; where = p
    if least < 0:
        print("  LEAST at", tuple(round(x, 3) for x in where))
    return pairs, least


def resolve(H, M):
    """Lift any vertex of a triangle that still crosses the head, until none does."""
    for it in range(40):
        ob = to_object(M, "tmp")
        V, N, T = tri_arrays(M, ob)
        bpy.data.objects.remove(ob)
        hb = BVHTree.FromPolygons([Vector(v) for v in V], [tuple(int(k) for k in t) for t in T])
        pairs = hb.overlap(H.bvh)
        low = set()
        for t in T:
            a, b, c = (Vector(V[int(k)]) for k in t)
            for p in ((a + b) / 2, (b + c) / 2, (c + a) / 2, (a + b + c) / 3):
                if H.sdist(p) < 0.0008:
                    low.update(int(k) for k in t)
        bad = set(low)
        for hi_, _ in pairs:
            bad.update(int(k) for k in T[hi_])
        if not bad:
            return it
        for vi in bad:
            p = M.V[vi]
            loc, nor, fi, dist = H.bvh.find_nearest(p)
            sd = -dist if H.inside(p) else dist
            out = (p - loc).normalized() if sd > 1e-6 else nor
            M.V[vi] = loc + out * (max(sd, 0.0) + 0.0009)
    return -1


def write(path, H, M, V, N, T, style, base, stats):
    n = len(V)
    J = np.zeros((n, 4), np.uint16); W = np.zeros((n, 4), np.float32)
    names = H.meta["joints"]
    for i in range(n):
        ws = M.W[i] or H.weights(M.V[i])
        for k, (j, w) in enumerate(ws[:4]):
            J[i, k] = j; W[i, k] = w
    uv = np.stack([np.clip(np.array(M.SH, np.float32), 0, 1.2) / 1.2, np.clip(np.array(M.AL, np.float32), 0, 1)], axis=1).astype(np.float32)
    w = GLB.Writer()
    prim = {"attributes": {
        "POSITION": w.acc(V, "VEC3", 34962, minmax=True), "NORMAL": w.acc(N, "VEC3", 34962), "TEXCOORD_0": w.acc(uv, "VEC2", 34962),
        "JOINTS_0": w.acc(J, "VEC4", 34962), "WEIGHTS_0": w.acc(W, "VEC4", 34962)},
        "indices": w.acc(T.reshape(-1), "SCALAR", 34963), "material": 0}
    j = {"asset": {"version": "2.0", "generator": "tools/hair3d/build_hair.py"}, "scene": 0,
         "scenes": [{"nodes": [0], "extras": {"hair": style, "base": base, "joints": names, "shadeMax": 1.2, **stats}}],
         "nodes": [{"name": "Hair", "mesh": 0}], "meshes": [{"name": "Hair", "primitives": [prim]}],
         "materials": [{"name": "Hair", "pbrMetallicRoughness": {"baseColorFactor": [0.08, 0.06, 0.05, 1], "metallicFactor": 0, "roughnessFactor": 0.9}}]}
    return w.save(path, j)


def read_hair(path):
    j, b = GLB.read(path)
    pr = j["meshes"][0]["primitives"][0]
    return GLB.accessor(j, b, pr["attributes"]["POSITION"]).astype(np.float32), GLB.accessor(j, b, pr["indices"]).reshape(-1, 3)


def main():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    if argv[0] == "--check":
        head_dir, hair_dir, base = argv[1:4]
        lift = float(argv[4]) if len(argv) > 4 else 0.0
        H = Head(head_dir)
        worst = 0
        for style in STYLES:
            f = os.path.join(hair_dir, f"hair-{base}-{style}.raw.glb")
            if not os.path.exists(f):
                continue
            V, T = read_hair(f)
            V = V + np.array([0, lift, 0], np.float32)
            pairs, least = check(H, V, T)
            worst += len(pairs)
            print(f"CHECK {os.path.basename(head_dir)} {style:10s} lift {lift * 1000:.0f} mm: {len(pairs)} crossing pairs, least distance {least * 1000:+.2f} mm")
        print("CHECK TOTAL crossing", worst)
        return
    head_dir, out_dir, base = argv[:3]
    want = argv[3:] or list(STYLES)
    os.makedirs(out_dir, exist_ok=True)
    H = Head(head_dir)
    print(f"HEAD {base}: C {tuple(round(x, 3) for x in H.C)} S {H.S:.3f} top {H.top:.3f} earTop {H.earTop:.3f} earZ {H.earZ:.3f} nape {H.napeY:.3f}")
    print("HAIRLINE", " ".join(f"{math.degrees(H.hl(RAD(a))):.0f}" for a in range(0, 181, 15)))
    sf = os.path.join(out_dir, f"hair-{base}.json")
    stats = json.load(open(sf)) if os.path.exists(sf) else {}
    for style in want:
        noise.seed_set(7)
        rnd = random.Random(f"{style}")
        M = Hair(H)
        STYLES[style](H, M, rnd)
        it = resolve(H, M)
        ob = to_object(M, f"hair-{style}")
        V, N, T = tri_arrays(M, ob)
        pairs, least = check(H, V, T)
        st = {"tris": int(len(T)), "verts": int(len(V)), "crossing": len(pairs), "leastMm": round(least * 1000, 2)}
        stats[style] = st
        size = write(os.path.join(out_dir, f"hair-{base}-{style}.raw.glb"), H, M, V, N, T, style, base, st)
        print(f"HAIR {base} {style:10s} {len(T):5d} tris {len(V):5d} verts, crossing {len(pairs)}, least {least * 1000:+.2f} mm, lifted in {it} passes, {size / 1024:.0f} KB")
    json.dump(stats, open(sf, "w"), indent=1)
    if os.environ.get("HAIR_BLEND"):
        bpy.ops.wm.save_as_mainfile(filepath=os.environ["HAIR_BLEND"])


main()
