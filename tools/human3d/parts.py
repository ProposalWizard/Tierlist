"""
The human's parts — skin regions, kit, hair, outfits, eyes, glasses — and
the file writer. Used by build_human.py (read its header first).

Every part is its own set of vertices with its own triangles, tagged:
  part   which piece (PARTS below), so a person keeps only what they wear;
  zone   0 main colour, 1 second colour, 2 accent (a tie, a stripe, a sole);
and each part vertex is ANCHORED to the three nearest body vertices, so it
follows the body's build shapes (a heavier man's shirt is bigger) without
carrying its own copy of every shape.
"""
import json
import numpy as np
from scipy.spatial import cKDTree

import glb

# The parts, in file order. Skin regions first (hidden when something covers them).
PARTS = [
    "skin.head", "skin.neck", "skin.torso", "skin.hips", "skin.uparmTop", "skin.uparmLow", "skin.forearm", "skin.wrist", "skin.hand",
    "skin.thighTop", "skin.thighLow", "skin.knee", "skin.shin", "skin.foot",
    "eyes", "teeth",
    "kit.shirt", "kit.shirtLong", "kit.shorts", "kit.socks", "kit.boots", "kit.gkGloves",
    "hair.buzz", "hair.short", "hair.slick", "hair.curly", "hair.long", "hair.receding", "hair.sides",
    "hair.beard", "hair.stubble", "hair.moustache", "hair.goatee", "brows",
    "out.jacket", "out.trousers", "out.shoes", "out.trainers", "out.dressShirt", "out.trackTop", "out.trackPants",
    "out.quarterZip", "out.coat", "out.scarf", "out.glasses", "out.belly",
    "out.suit", "out.shirtJeans", "out.jacketJeans", "out.teeJeans", "out.formalShoes", "out.trainerShoes", "kit.tee", "kit.teeShorts", "kit.trainers",
    "hair.mh_short", "hair.mh_crop", "hair.mh_side", "hair.mh_swept", "hair.mh_afro", "hair.mh_long", "brows.mh", "teeth.mh",
]
PID = {n: i for i, n in enumerate(PARTS)}


def unit(v):
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    return v / np.maximum(n, 1e-12)


def tri(faces):
    out = []
    for f in faces:
        for k in range(1, len(f) - 1):
            out.append((f[0], f[k], f[k + 1]))
    return np.array(out, dtype=np.int64)


def vnormals(V, T):
    N = np.zeros_like(V)
    fn = np.cross(V[T[:, 1]] - V[T[:, 0]], V[T[:, 2]] - V[T[:, 0]])
    for k in range(3):
        np.add.at(N, T[:, k], fn)
    return unit(N)


def compact(V, T):
    """Keep only the vertices T uses; returns (old index array, new T)."""
    used = np.unique(T)
    remap = -np.ones(len(V), dtype=np.int64)
    remap[used] = np.arange(len(used))
    return used, remap[T]


def subdivide(V, T, attrs=(), pick=()):
    """One midpoint split (each triangle → 4). attrs: per-vertex arrays averaged at new
    points; `pick` (indices into attrs) take the lower endpoint's value instead (ids)."""
    edges = {}
    newV = [V]
    newA = [list(a) for a in attrs]
    nxt = len(V)
    mids = []
    extra = []
    extraA = [[] for _ in attrs]

    def mid(a, b):
        nonlocal nxt
        k = (a, b) if a < b else (b, a)
        if k not in edges:
            edges[k] = nxt
            nxt += 1
            extra.append((V[a] + V[b]) / 2)
            for ai, arr in enumerate(attrs):
                extraA[ai].append(arr[min(a, b)] if ai in pick else (arr[a] + arr[b]) / 2)
        return edges[k]
    T2 = []
    for a, b, c in T:
        ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
        T2 += [(a, ab, ca), (ab, b, bc), (ca, bc, c), (ab, bc, ca)]
    V2 = np.vstack([V, np.array(extra)])
    A2 = [np.vstack([np.asarray(arr), np.array(e)]) if np.asarray(arr).ndim > 1 else np.concatenate([np.asarray(arr), np.array(e)]) for arr, e in zip(attrs, extraA)]
    return V2, np.array(T2), A2


def smooth(V, T, it=2, lam=0.5, fixed=None):
    n = len(V)
    nb = [set() for _ in range(n)]
    for a, b, c in T:
        nb[a].update((b, c)); nb[b].update((a, c)); nb[c].update((a, b))
    for _ in range(it):
        avg = np.array([V[list(s)].mean(0) if s else V[i] for i, s in enumerate(nb)])
        upd = V + lam * (avg - V)
        if fixed is not None:
            upd[fixed] = V[fixed]
        V = upd
    return V


def noise3(P, freq, seed=0):
    """Smooth value noise in 3D (sum of a few sines; cheap and seamless)."""
    rng = np.random.default_rng(seed)
    out = np.zeros(len(P))
    for _ in range(6):
        d = unit(rng.normal(size=3))
        ph = rng.uniform(0, 6.283)
        f = freq * rng.uniform(0.7, 1.4)
        out += np.sin(P @ d * f + ph)
    return out / 6 * 1.7


def lip_vertices(FACES, FGROUP, FTEX, VT, mpfb):
    """Body vertices inside MakeHuman's own lips mask (its UV layout)."""
    from PIL import Image
    m = np.asarray(Image.open(f"{mpfb}/textures/mpfb_lips.jpg").convert("L")).astype(float) / 255
    H, W = m.shape
    out = set()
    for f, ft, g in zip(FACES, FTEX, FGROUP):
        if g != "body":
            continue
        for v, t in zip(f, ft):
            if t < 0:
                continue
            u, w = VT[t]
            if m[int((1 - w) * (H - 1)), int(u * (W - 1))] > 0.5:
                out.add(v)
    return np.array(sorted(out))


def build_parts(VB, BODY, FACES, FGROUP, FTEX, VT, VGROUPS, BONE_W, PB, SHAPES, vrange, mpfb=None, pose=None):
    """Returns a dict of everything write_glb needs."""
    groups = {}
    for f, g in zip(FACES, FGROUP):
        groups.setdefault(g, []).append(f)
    TB = tri(groups["body"])
    TT = tri(groups["helper-tights"])
    TS = tri(groups.get("helper-skirt", []))
    THair = tri(groups["helper-hair"])
    NB = vnormals(VB, TB)
    NT = vnormals(VB, TT)

    dom = np.array([max(w, key=lambda x: x[1])[0] if w else "Hips" for w in BONE_W])
    J = PB

    def along(P, a, b):
        A, B = J[a], J[b]
        ab = B - A
        return ((P - A) @ ab) / (ab @ ab)

    def side_of(name):
        return "Left" if name.startswith("Left") else "Right"

    def limb_t(P, d):
        """Per vertex: t along its own bone (shoulder→elbow etc.)."""
        t = np.zeros(len(P))
        for i, (p, b) in enumerate(zip(P, d)):
            S = side_of(b)
            if b.endswith("Arm") and not b.endswith("ForeArm"):
                t[i] = along(p[None], f"{S}Arm", f"{S}ForeArm")[0]
            elif b.endswith("ForeArm"):
                t[i] = along(p[None], f"{S}ForeArm", f"{S}Hand")[0]
            elif b.endswith("UpLeg"):
                t[i] = along(p[None], f"{S}UpLeg", f"{S}Leg")[0]
            elif b.endswith("Leg"):
                t[i] = along(p[None], f"{S}Leg", f"{S}Foot")[0]
        return t

    T_ALL = limb_t(VB, dom)
    hips_y = J["Hips"][1]
    neck_y = J["neck"][1]
    eye_y = (J["eyeL"][1] + J["eyeR"][1]) / 2
    hem_y = hips_y - 0.105
    waist_y = hips_y + 0.06

    def region(i):
        b, t, p = dom[i], T_ALL[i], VB[i]
        if b in ("Head",):
            return "skin.head"
        if b == "neck":
            return "skin.neck"
        if b in ("Spine", "Spine01", "Spine02", "LeftShoulder", "RightShoulder"):
            return "skin.torso"
        if b == "Hips":
            return "skin.hips"
        if b.endswith("ForeArm"):
            return "skin.wrist" if t > 0.84 else "skin.forearm"
        if b.endswith("Arm"):
            return "skin.uparmTop" if t < 0.42 else "skin.uparmLow"
        if "Hand" in b:
            return "skin.hand"
        if b.endswith("UpLeg"):
            return "skin.thighTop" if t < 0.56 else "skin.thighLow"
        if b.endswith("Leg"):
            return "skin.knee" if t < 0.13 else "skin.shin"
        return "skin.foot"

    out = []  # list of dicts: name, V, T, src (index into VB for weights/anchors), zone, offsetFrom

    # ── Skin regions: each body triangle goes to the region of its majority vertex.
    reg = np.array([region(i) for i in range(len(VB))])
    treg = np.array([max(set(reg[t]), key=list(reg[t]).count) for t in TB])
    for name in PARTS:
        if not name.startswith("skin."):
            continue
        T = TB[treg == name]
        if not len(T):
            continue
        used, Tn = compact(VB, T)
        out.append({"name": name, "V": VB[used], "T": Tn, "src": used, "zone": np.zeros(len(used)), "body": True})

    # ── Eyes: a ball in each socket, at MakeHuman's eye joint.
    def ball(c, r, nlat=14, nlon=20):
        Vs, Ts = [], []
        for i in range(nlat + 1):
            th = np.pi * i / nlat
            for j in range(nlon):
                ph = 2 * np.pi * j / nlon
                Vs.append(c + r * np.array([np.sin(th) * np.sin(ph), np.cos(th), np.sin(th) * np.cos(ph)]))
        for i in range(nlat):
            for j in range(nlon):
                a, b = i * nlon + j, i * nlon + (j + 1) % nlon
                c2, d = a + nlon, b + nlon
                Ts += [(a, c2, b), (b, c2, d)]
        return np.array(Vs), np.array(Ts)
    eye_r = 0.0118
    Ve, Te, Ze = [], [], []
    for k in ("eyeL", "eyeR"):
        v, t = ball(J[k], eye_r)
        d = unit(v - J[k])
        # zone: 0 white, 1 iris, 2 pupil (looking straight ahead, +z)
        z = np.where(d[:, 2] > np.cos(np.radians(15)), 2, np.where(d[:, 2] > np.cos(np.radians(33)), 1, 0))
        Te.append(t + sum(len(x) for x in Ve)); Ve.append(v); Ze.append(z)
    Ve = np.vstack(Ve); Te = np.vstack(Te); Ze = np.concatenate(Ze)
    out.append({"name": "eyes", "V": Ve, "T": Te, "src": None, "bone": "Head", "zone": Ze})

    # Teeth: MakeHuman's own (helpers), for an open mouth.
    for g in ("helper-upper-teeth", "helper-lower-teeth"):
        if g in groups:
            T = tri(groups[g])
            used, Tn = compact(VB, T)
            out.append({"name": "teeth", "V": VB[used], "T": Tn, "src": used, "zone": np.zeros(len(used))})

    # ── Garments from the tights (a close shell over the whole body).
    def boundary(Tn, n):
        from collections import Counter
        e = Counter()
        for a, b, c in Tn:
            for x, y in ((a, b), (b, c), (c, a)):
                e[(min(x, y), max(x, y))] += 1
        nb = [[] for _ in range(n)]
        for (x, y), k in e.items():
            if k == 1:
                nb[x].append(y); nb[y].append(x)
        return nb

    def bone_axis(b):
        S = side_of(b)
        if b.endswith("ForeArm"): return J[f"{S}ForeArm"], J[f"{S}Hand"]
        if b.endswith("Arm"): return J[f"{S}Arm"], J[f"{S}ForeArm"]
        if b.endswith("UpLeg"): return J[f"{S}UpLeg"], J[f"{S}Leg"]
        if b.endswith("Leg"): return J[f"{S}Leg"], J[f"{S}Foot"]
        return None

    def clean_edges(V, Tn, dv, hem):
        """Straight hems: each edge vertex goes onto its cut (a height, or a share
        of a limb's length), then the edge loops are smoothed."""
        nb = boundary(Tn, len(V))
        bv = np.array([i for i in range(len(V)) if nb[i]])
        if not len(bv):
            return V
        V = V.copy()
        for it in range(4):
            for i in bv:
                cut = hem(V[i], dv[i])
                if cut is None:
                    continue
                kind, val = cut
                if kind == "y":
                    V[i, 1] = val
                else:
                    ax = bone_axis(dv[i])
                    if ax is None:
                        continue
                    A, B = ax
                    ab = B - A
                    t = ((V[i] - A) @ ab) / (ab @ ab)
                    V[i] += ab * (val - t)
            if it < 3:
                newV = V.copy()
                for i in bv:
                    if len(nb[i]) >= 2:
                        newV[i] = 0.5 * V[i] + 0.25 * (V[nb[i][0]] + V[nb[i][1]])
                V = newV
        return V

    def garment(name, pick, offset, zone=None, src_T=None, src_N=None, subdiv=0, sm=0, post=None, stretch=None, hem=None, extra=0.003, drape=None, lip=0.0):
        src_T = TB if src_T is None else src_T
        cen = VB[src_T].mean(1)
        cdom = np.array([max(set(dom[t]), key=list(dom[t]).count) for t in src_T])
        ct = np.array([T_ALL[t].mean() for t in src_T])
        keep = np.array([pick(c, d, t) for c, d, t in zip(cen, cdom, ct)])
        T = src_T[keep]
        used, Tn = compact(VB, T)
        V = VB[used].copy()
        src = used.copy()
        tv = T_ALL[used]
        dv = dom[used]
        if hem is not None:
            V = clean_edges(V, Tn, dv, hem)
        N = vnormals(V, Tn)
        if subdiv:
            for _ in range(subdiv):
                V, Tn, (src, tv) = subdivide(V, Tn, (src.astype(float), tv), pick=(0,))
                src = np.rint(src).astype(np.int64)  # (midpoints take one end's weights)
            N = vnormals(V, Tn)
            dv = dom[np.clip(src, 0, len(dom) - 1)]
        off = offset(V, N, dv, tv) + (extra if src_T is TB else 0.0)
        V = V + N * off[:, None]
        if stretch is not None:
            V = stretch(V, N, dv, tv)
        if drape is not None:
            V = drape(V, dv, tv)
        if sm:
            nbv = boundary(Tn, len(V))
            fixed = np.array([i for i in range(len(V)) if nbv[i]], dtype=np.int64)
            V = smooth(V, Tn, sm, 0.4, fixed=fixed if len(fixed) else None)
        if post is not None:
            V = post(V, Tn)
        z = zone(V, dv, tv) if zone else np.zeros(len(V))
        if lip:
            V, Tn, src, z = add_lip(V, Tn, src, z, lip)
        out.append({"name": name, "V": V, "T": Tn, "src": src, "zone": z})


    def add_lip(V, Tn, src, z, depth):
        """A turned-back hem on every open edge: the cloth has a thickness at the
        sleeve ends, the hem and the collar."""
        nb = boundary(Tn, len(V))
        N = vnormals(V, Tn)
        nbr = [[] for _ in range(len(V))]
        for a, b, c in Tn:
            nbr[a] += [b, c]; nbr[b] += [a, c]; nbr[c] += [a, b]
        bv = [i for i in range(len(V)) if nb[i]]
        new = {}
        extraV = []
        for i in bv:
            inner = [k for k in nbr[i] if not nb[k]] or nbr[i]
            u = unit(V[inner].mean(0) - V[i])
            new[i] = len(V) + len(extraV)
            extraV.append(V[i] - N[i] * 0.0035 + u * depth)
        quads = []
        done = set()
        for i in bv:
            for k in nb[i]:
                e = (min(i, k), max(i, k))
                if e in done:
                    continue
                done.add(e)
                quads += [(i, new[i], k), (k, new[i], new[k])]
        V2 = np.vstack([V, np.array(extraV)])
        T2 = np.vstack([Tn, np.array(quads)])
        src2 = np.concatenate([src, src[bv]])
        z2 = np.concatenate([z, np.asarray(z)[bv]])
        return V2, T2, src2, z2

    def cyl_drape(V, mask, centre, axis, up, ref_band, below, grow, ease, nth=32):
        """Cloth falls straight from its widest band instead of following the body:
        around `axis` (through `centre`), each angle's radius is at least the
        reference band's at that angle, growing by `grow` per metre past it."""
        if not mask.any():
            return V
        V = V.copy()
        P = V[mask] - centre
        t = P @ axis
        Q = P - np.outer(t, axis)
        side = unit(np.cross(axis, up))
        upv = np.cross(side, axis)
        th = np.arctan2(Q @ side, Q @ upv)
        r = np.linalg.norm(Q, axis=1)
        tb = ((th + np.pi) / (2 * np.pi) * nth).astype(int) % nth
        inband = (t >= ref_band[0]) & (t <= ref_band[1])
        R = np.zeros(nth)
        np.maximum.at(R, tb[inband], r[inband])
        for _ in range(3):  # fill and soften round the angle
            R = np.maximum(R, 0.97 * np.maximum(np.roll(R, 1), np.roll(R, -1)))
        R = 0.5 * R + 0.25 * (np.roll(R, 1) + np.roll(R, -1))
        past = below(t)
        target = R[tb] * (1 + grow * np.maximum(past, 0)) + ease
        k = np.where(past > 0, np.maximum(r, target), r + ease)
        k = np.where((past > -0.03) & (past <= 0), np.maximum(r, r + (target - r) * (1 + past / 0.03)), k)
        V[mask] = centre + np.outer(t, axis) + unit(Q) * k[:, None]
        return V

    chest_y = J["Spine01"][1] + 0.06
    neck_c = J["neck"]

    def neckline(p, dip=0.03, rise=0.0):
        d = p - neck_c
        az = np.arctan2(d[..., 0], d[..., 2])
        return neck_c[1] + 0.012 + rise - dip * np.maximum(np.cos(az), 0) ** 2

    def drape_top(V, dv, tv, ease=0.009, grow=0.2):
        V = V.copy()
        m = np.isin(dv, ("Spine", "Spine01", "Spine02", "LeftShoulder", "RightShoulder") + ("Hips", "neck"))
        torso_c = np.array([0.0, chest_y, (J["Spine01"][2] + J["Spine"][2]) / 2 + 0.01])
        V = cyl_drape(V, m, torso_c, np.array([0, -1.0, 0]), np.array([0, 0, 1.0]), (-0.06, 0.04),
                      lambda t: t - 0.0, grow, ease)
        for S in ("Left", "Right"):
            a, b = J[f"{S}Arm"], J[f"{S}ForeArm"]
            ax = unit(b - a)
            m = np.isin(dv, (f"{S}Arm",))
            V = cyl_drape(V, m, a, ax, np.array([0, 0, 1.0]), (0.03, 0.09), lambda t: t - 0.09, 0.9, 0.006)
        return V

    def drape_shorts(V, dv, tv):
        V = V.copy()
        for S in ("Left", "Right"):
            a, b = J[f"{S}UpLeg"], J[f"{S}Leg"]
            ax = unit(b - a)
            m = np.isin(dv, (f"{S}UpLeg",)) | ((dv == "Hips") & (np.sign(V[:, 0]) == (1 if S == "Left" else -1)) & (V[:, 1] < hips_y - 0.05))
            V = cyl_drape(V, m, a, ax, np.array([0, 0, 1.0]), (0.04, 0.12), lambda t: t - 0.1, 0.35, 0.007)
        return V

    TORSO = ("Spine", "Spine01", "Spine02", "LeftShoulder", "RightShoulder")
    ARM = ("LeftArm", "RightArm")
    FORE = ("LeftForeArm", "RightForeArm")
    LEG = ("LeftUpLeg", "RightUpLeg")
    SHIN = ("LeftLeg", "RightLeg")
    FOOT = ("LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase")
    folds = lambda V, amp, f, s=1: amp * noise3(V, f, s)

    # The football shirt: torso and the top half of the arms, down past the waist.
    def shirt_pick(c, d, t, long=False):
        if d == "neck" or d in TORSO:
            return c[1] < neckline(c) + 0.003
        if d == "Hips":
            return c[1] > hem_y
        if d in ARM:
            return long or t < 0.52
        if d in FORE:
            return long and t < 0.93
        return False

    def shirt_off(V, N, d, t):
        return 0.003 + folds(V, 0.0022, 45)
    if False: garment("kit.shirt", lambda c, d, t: shirt_pick(c, d, t), shirt_off, sm=1,
            zone=lambda V, d, t: np.where(np.isin(d, ARM) & (t > 0.44), 1, np.where(V[:, 1] > neck_y - 0.03, 1, 0)), hem=lambda p, d: ("t", 0.5) if d in ARM else (("y", hem_y) if (d == "Hips" or p[1] < hips_y) else (("y", float(neckline(p))) if p[1] > neck_y - 0.06 else None)), drape=drape_top, lip=0.012)
    garment("kit.shirtLong", lambda c, d, t: shirt_pick(c, d, t, True), shirt_off, sm=1,
            zone=lambda V, d, t: np.where(np.isin(d, FORE) & (t > 0.85), 1, np.where(V[:, 1] > neck_y - 0.03, 1, 0)), hem=lambda p, d: ("t", 0.93) if d in FORE else (("y", hem_y) if (d == "Hips" or p[1] < hips_y) else (("y", float(neckline(p))) if p[1] > neck_y - 0.06 else None)), drape=drape_top, lip=0.012)

    def shorts_pick(c, d, t):
        if d == "Hips":
            return c[1] < waist_y
        if d in LEG:
            return t < 0.7
        return False

    def shorts_off(V, N, d, t):
        return 0.004 + folds(V, 0.0018, 45, 2)
    if False: garment("kit.shorts", shorts_pick, shorts_off, sm=1, zone=lambda V, d, t: np.where(V[:, 1] > waist_y - 0.03, 1, 0), hem=lambda p, d: ("t", 0.66) if d in LEG else (("y", waist_y) if p[1] > hips_y else None), drape=drape_shorts, lip=0.012)

    def socks_pick(c, d, t):
        return (d in SHIN and t > 0.1) or (d in FOOT and c[1] > 0.075)
    garment("kit.socks", socks_pick, lambda V, N, d, t: 0.0025 + np.where(np.isin(d, SHIN) & (t < 0.2), 0.0025, 0),
            zone=lambda V, d, t: np.where(np.isin(d, SHIN) & (t < 0.2), 1, 0), hem=lambda p, d: ("t", 0.1) if (d in SHIN and p[1] > 0.25) else (("y", 0.075) if p[1] < 0.2 else None))

    # Boots from the body's own feet: a little bigger, a flat sole.
    def boot_post(V, T):
        V = V.copy()
        low = V[:, 1] < 0.03
        V[low, 1] = np.minimum(V[low, 1], 0.004) - 0.002
        return V
    garment("kit.boots", lambda c, d, t: d in FOOT and c[1] < 0.105, lambda V, N, d, t: np.full(len(V), 0.0045),
            src_T=TB, src_N=NB, post=boot_post, sm=12, zone=lambda V, d, t: np.where(V[:, 1] < 0.012, 2, np.where(V[:, 1] < 0.05, 1, 0)), hem=lambda p, d: ("y", 0.105) if p[1] > 0.06 else None, extra=0.0)
    garment("kit.gkGloves", lambda c, d, t: "Hand" in d, lambda V, N, d, t: np.full(len(V), 0.003),
            src_T=TB, src_N=NB, extra=0.0)

    # ── Outfits (managers and everyone else).
    def jacket_pick(c, d, t, length=0.17, sleeve=0.93):
        if d == "neck":
            return c[1] < neck_y + 0.022
        if d in TORSO:
            return True
        if d == "Hips":
            return c[1] > hips_y - length
        if d in ARM:
            return True
        if d in FORE:
            return t < sleeve
        return False

    front_v = lambda V, top, w: (V[:, 2] > 0.02) & (np.abs(V[:, 0]) < w * np.clip((top - V[:, 1]) / 0.22, 0, 1)) & (V[:, 1] > J["Spine01"][1] - 0.02)

    def jacket_zone(V, d, t):
        z = np.zeros(len(V))
        v = front_v(V, neck_y + 0.005, 0.085)
        z[v] = 1  # the shirt in the V
        tie = v & (np.abs(V[:, 0]) < 0.011 + 0.006 * np.clip((neck_y - 0.02 - V[:, 1]) / 0.2, 0, 1))
        z[tie] = 2
        return z
    if False: garment("out.jacket", jacket_pick, lambda V, N, d, t: 0.008 + np.where(np.isin(d, ARM + FORE), -0.001, 0.002) + folds(V, 0.001, 40, 3),
            sm=1, zone=jacket_zone, hem=lambda p, d: ("t", 0.93) if d in FORE else (("y", hips_y - 0.17) if p[1] < hips_y else None))
    if False: garment("out.dressShirt", lambda c, d, t: jacket_pick(c, d, t, 0.1, 0.96), lambda V, N, d, t: 0.006 + folds(V, 0.0015, 55, 4), sm=1,
            zone=lambda V, d, t: np.where(front_v(V, neck_y + 0.005, 0.03) & (V[:, 1] > neck_y - 0.06), 1, 0), hem=lambda p, d: ("t", 0.96) if d in FORE else (("y", hips_y - 0.1) if p[1] < hips_y else None))

    def trouser_pick(c, d, t):
        if d == "Hips":
            return c[1] < waist_y + 0.01
        if d in LEG:
            return True
        if d in SHIN:
            return True
        if d in FOOT:
            return c[1] > 0.085
        return False
    if False: garment("out.trousers", trouser_pick, lambda V, N, d, t: 0.009 + np.where(np.isin(d, SHIN + FOOT), 0.009, 0) + folds(V, 0.0012, 45, 5), sm=1,
            zone=lambda V, d, t: np.where(V[:, 1] > waist_y - 0.015, 1, 0), hem=lambda p, d: ("y", waist_y + 0.01) if p[1] > hips_y else (("y", 0.085) if p[1] < 0.3 else None))
    if False: garment("out.trackPants", trouser_pick, lambda V, N, d, t: 0.011 + np.where(np.isin(d, SHIN), 0.006, 0) + folds(V, 0.002, 40, 6), sm=1,
            zone=lambda V, d, t: np.where(V[:, 1] > waist_y - 0.02, 1, 0), hem=lambda p, d: ("y", waist_y + 0.01) if p[1] > hips_y else (("y", 0.085) if p[1] < 0.3 else None))
    if False: garment("out.shoes", lambda c, d, t: d in FOOT and c[1] < 0.1, lambda V, N, d, t: np.full(len(V), 0.006), src_T=TB, src_N=NB, post=boot_post, sm=14,
            zone=lambda V, d, t: np.where(V[:, 1] < 0.012, 2, 0), hem=lambda p, d: ("y", 0.1) if p[1] > 0.06 else None, extra=0.0)
    if False: garment("out.trainers", lambda c, d, t: d in FOOT and c[1] < 0.105, lambda V, N, d, t: np.full(len(V), 0.008), src_T=TB, src_N=NB, post=boot_post, sm=14,
            zone=lambda V, d, t: np.where(V[:, 1] < 0.02, 2, 0), hem=lambda p, d: ("y", 0.105) if p[1] > 0.06 else None, extra=0.0)

    def track_zone(V, d, t):
        z = np.zeros(len(V))
        # a stripe down the outside of each sleeve, and the zip
        outside = np.isin(d, ARM + FORE) & (V[:, 1] > 0) & (np.abs(V[:, 2] - 0.0) < 0.012) & (np.abs(V[:, 0]) > 0.2)
        z[outside] = 2
        z[(np.abs(V[:, 0]) < 0.004) & (V[:, 2] > 0.02) & np.isin(d, TORSO + ("Hips",))] = 2
        z[V[:, 1] > neck_y - 0.025] = 1
        return z
    if False: garment("out.trackTop", lambda c, d, t: jacket_pick(c, d, t, 0.1, 0.95), lambda V, N, d, t: 0.011 + folds(V, 0.0018, 40, 7), sm=1, zone=track_zone, hem=lambda p, d: ("t", 0.95) if d in FORE else (("y", hips_y - 0.1) if p[1] < hips_y else None))
    if False: garment("out.quarterZip", lambda c, d, t: jacket_pick(c, d, t, 0.1, 0.95), lambda V, N, d, t: 0.009 + folds(V, 0.0012, 40, 8), sm=1,
            zone=lambda V, d, t: np.where((np.abs(V[:, 0]) < 0.005) & (V[:, 2] > 0.02) & (V[:, 1] > neck_y - 0.16), 2, np.where(V[:, 1] > neck_y - 0.02, 1, 0)), hem=lambda p, d: ("t", 0.95) if d in FORE else (("y", hips_y - 0.1) if p[1] < hips_y else None))
    if False: garment("out.coat", lambda c, d, t: jacket_pick(c, d, t, 0.3, 0.95), lambda V, N, d, t: 0.019 + folds(V, 0.0015, 35, 9), sm=1,
            zone=lambda V, d, t: np.where(front_v(V, neck_y + 0.005, 0.07), 1, 0), hem=lambda p, d: ("t", 0.95) if d in FORE else None)
    if False and len(TS):
        garment("out.coat", lambda c, d, t: c[1] > hips_y - 0.5 and c[1] < hips_y - 0.04, lambda V, N, d, t: 0.012 + folds(V, 0.002, 30, 10),
                src_T=TS, sm=1, hem=lambda p, d: ("y", hips_y - 0.5) if p[1] < hips_y - 0.3 else (("y", hips_y - 0.04) if p[1] > hips_y - 0.15 else None))
    if False: garment("out.belly", lambda c, d, t: False, lambda V, N, d, t: np.zeros(len(V)))

    # Collars: a band up round the neck for the quarter-zip, the coat and the shirt.
    neck_ring = [t for t in TB if dom[t[0]] == "neck" and dom[t[1]] == "neck" and dom[t[2]] == "neck"]

    # ── Hair: a cap from the body's own scalp, shaped per style.
    head_c = J["Head"] + np.array([0, 0.09, 0.0])
    brow_y = eye_y + 0.024

    def hairline(P, recede=0.0):
        d = P - head_c
        az = np.degrees(np.arctan2(d[:, 0], d[:, 2]))  # 0 = front
        a = np.abs(az)
        front = eye_y + 0.062 + recede * np.exp(-((a - 35) / 18) ** 2) * 0.03
        h = np.where(a < 60, front - (a / 60) ** 2 * 0.025, 0)
        h = np.where((a >= 60) & (a < 110), eye_y + 0.035 - (a - 60) / 50 * 0.02, h)
        h = np.where(a >= 110, eye_y + 0.015 - (a - 110) / 70 * 0.085, h)
        return h

    head_tris = TB[(treg == "skin.head")]

    def hair(name, thick, bump=0.0, bf=60, recede=0.0, fringe=0.0, seed=11, extra=None, sub=1):
        cen = VB[head_tris].mean(1)
        keep = cen[:, 1] > hairline(cen, recede)
        # not the face, not the ears
        d = cen - head_c
        ear = (np.abs(d[:, 0]) > 0.06) & (cen[:, 1] < eye_y + 0.03) & (cen[:, 1] > eye_y - 0.05) & (np.abs(d[:, 2]) < 0.035)
        keep &= ~ear
        T = head_tris[keep]
        used, Tn = compact(VB, T)
        V = VB[used].copy()
        src = used.copy()
        for _ in range(sub):
            V, Tn, (srcf,) = subdivide(V, Tn, (src.astype(float),), pick=(0,))
            src = np.rint(srcf).astype(np.int64)
            V = smooth(V, Tn, 1, 0.3)
        N = vnormals(V, Tn)
        top = np.clip((V[:, 1] - (eye_y + 0.02)) / 0.12, 0, 1)
        # Thin at the edges (it grows out of the skin there), full in the middle.
        edge = np.clip((V[:, 1] - hairline(V, recede)) / 0.025, 0, 1)
        o = (thick[0] + (thick[1] - thick[0]) * top) * edge ** 0.6
        o = o + bump * noise3(V, bf, seed) * edge
        V = V + N * o[:, None]
        if fringe:
            dz = V - head_c
            fr = (dz[:, 2] > 0.04) & (V[:, 1] < eye_y + 0.11)
            V[fr, 1] -= fringe * np.clip((eye_y + 0.11 - V[fr, 1]) / 0.05, 0, 1)
            V[fr, 2] += fringe * 0.4
        if extra is not None:
            V, Tn, src = extra(V, Tn, src)
        out.append({"name": name, "V": V, "T": Tn, "src": src, "zone": np.zeros(len(V))})

    hair("hair.buzz", (0.0012, 0.002), 0.0003, 120, sub=1)
    if False: hair("hair.short", (0.005, 0.02), 0.0035, 38, fringe=0.01, seed=3)
    if False: hair("hair.slick", (0.005, 0.012), 0.0012, 25, seed=5)
    if False: hair("hair.curly", (0.012, 0.03), 0.007, 70, seed=7)
    hair("hair.receding", (0.003, 0.008), 0.0015, 60, recede=1.0, seed=9)
    hair("hair.sides", (0.003, 0.006), 0.001, 60, recede=3.5, seed=13)

    # Facial hair: shells over the face's own skin, by region round the mouth.
    lips = lip_vertices(FACES, FGROUP, FTEX, VT, mpfb) if mpfb else np.array([], dtype=np.int64)
    LIP = VB[lips]
    mouth_c = LIP.mean(0) if len(LIP) else J["jaw"]
    mouth_w = (LIP[:, 0].max() - LIP[:, 0].min()) / 2 if len(LIP) else 0.025
    lip_top, lip_bot = (LIP[:, 1].max(), LIP[:, 1].min()) if len(LIP) else (mouth_c[1] + 0.01, mouth_c[1] - 0.01)
    LAND = {"mouth": mouth_c, "mouthW": mouth_w, "lipTop": lip_top, "lipBot": lip_bot, "lips": lips}

    def face_hair(name, sel, thick, bump=0.0004, seed=21):
        cen = VB[head_tris].mean(1)
        keep = sel(cen)
        T = head_tris[keep]
        if not len(T):
            return
        used, Tn = compact(VB, T)
        V = VB[used].copy()
        src = used.copy()
        V, Tn, (srcf,) = subdivide(V, Tn, (src.astype(float),), pick=(0,))
        src = np.rint(srcf).astype(np.int64)
        N = vnormals(V, Tn)
        nb = boundary(Tn, len(V))
        edge = np.array([0.35 if nb[i] else 1.0 for i in range(len(V))])
        V = V + N * ((thick + bump * noise3(V, 140, seed)) * edge)[:, None]
        out.append({"name": name, "V": V, "T": Tn, "src": src, "zone": np.zeros(len(V))})
    front = lambda c: c[:, 2] > J["Head"][2] - 0.005
    near_mouth = lambda c, rx, ry: ((c[:, 0] - mouth_c[0]) / rx) ** 2 + ((c[:, 1] - mouth_c[1]) / ry) ** 2 < 1
    cheek_line = lambda c: c[:, 1] < (eye_y - 0.045) + np.abs(c[:, 0]) * 0.25
    beard_zone = lambda c: front(c) & cheek_line(c) & ~near_mouth(c, mouth_w * 1.05, (lip_top - lip_bot) * 0.62)
    face_hair("hair.beard", beard_zone, 0.0035, 0.0012)
    face_hair("hair.stubble", beard_zone, 0.0006, 0.0002)
    face_hair("hair.moustache", lambda c: front(c) & (c[:, 1] > lip_top - 0.002) & (c[:, 1] < lip_top + 0.014) & (np.abs(c[:, 0] - mouth_c[0]) < mouth_w * 1.15), 0.0022, 0.0008)
    face_hair("hair.goatee", lambda c: front(c) & (c[:, 1] < lip_bot + 0.001) & (np.abs(c[:, 0] - mouth_c[0]) < mouth_w * 0.85)
              | (front(c) & (c[:, 1] > lip_top - 0.002) & (c[:, 1] < lip_top + 0.013) & (np.abs(c[:, 0] - mouth_c[0]) < mouth_w * 1.1)), 0.0025, 0.0008)
    # Brows: a thin shell strip over each brow ridge (gameplay distance; cut scenes paint their own).
    def brow_sel(c):
        ok = np.zeros(len(c), bool)
        for k in ("eyeL", "eyeR"):
            e = J[k]
            dx = (c[:, 0] - e[0]) * np.sign(e[0])
            yb = e[1] + 0.022 + 0.004 * np.cos(np.clip(dx / 0.025, -1.5, 1.5))
            ok |= (np.abs(dx) < 0.026) & (np.abs(c[:, 1] - yb) < 0.0045 - 0.0015 * np.clip(dx / 0.026, 0, 1)) & (c[:, 2] > e[2] - 0.01)
        return ok
    # (brows: MakeHuman's eyebrow card, below)

    # Long: the short cap plus MakeHuman's long-hair shell, its fringe cut back off the face.
    cen = VB[THair].mean(1)
    face_front = (cen[:, 2] > J["eyeL"][2] - 0.035) & (cen[:, 1] < eye_y + 0.05) & (np.abs(cen[:, 0]) < 0.075)
    T = THair[~face_front & (cen[:, 1] > J["neck"][1] - 0.06)]
    used, Tn = compact(VB, T)
    V = VB[used].copy()
    N = vnormals(V, Tn)
    out.append({"name": "hair.long", "V": V + N * 0.002, "T": Tn, "src": used, "zone": np.zeros(len(V))})

    # Glasses: two rounded frames over the eyes, a bridge, arms back to the ears.
    gV, gT = [], []

    def tube(path, r=0.0012, n=6):
        base = sum(len(x) for x in gV)
        P = np.array(path)
        vs = []
        for i, p in enumerate(P):
            tdir = unit(P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)])
            a = unit(np.cross(tdir, [0, 1, 0] if abs(tdir[1]) < 0.9 else [1, 0, 0]))
            b = np.cross(tdir, a)
            for k in range(n):
                th = 2 * np.pi * k / n
                vs.append(p + r * (np.cos(th) * a + np.sin(th) * b))
        gV.append(np.array(vs))
        for i in range(len(P) - 1):
            for k in range(n):
                a0, a1 = base + i * n + k, base + i * n + (k + 1) % n
                gT.append((a0, a0 + n, a1)); gT.append((a1, a0 + n, a1 + n))
    for k in ("eyeL", "eyeR"):
        c = J[k] + np.array([0, -0.001, 0.021])
        ring = [c + np.array([0.022 * np.cos(t) * (1 + 0.15 * np.cos(t) ** 2), 0.0155 * np.sin(t), -0.004 * np.cos(t) ** 2]) for t in np.linspace(0, 2 * np.pi, 25)]
        tube(ring)
        s = 1 if k == "eyeL" else -1
        hinge = c + np.array([s * 0.024, 0.004, -0.004])
        ear = J[k] + np.array([s * 0.05, 0.004, -0.085])
        tube([hinge, hinge + np.array([s * 0.008, 0, -0.02]), ear, ear + np.array([0, -0.02, -0.01])])
    cl, cr = J["eyeL"] + np.array([0, 0.003, 0.021]), J["eyeR"] + np.array([0, 0.003, 0.021])
    tube([cl - np.array([0.022, 0, 0]), (cl + cr) / 2 + np.array([0, 0.004, 0.004]), cr + np.array([0.022, 0, 0])])
    out.append({"name": "out.glasses", "V": np.vstack(gV), "T": np.array(gT), "src": None, "bone": "Head", "zone": np.zeros(sum(len(x) for x in gV))})

    # Scarf: a knitted loop round the neck, its two ends down the front.
    sV, sT = [], []
    nc = J["neck"] + np.array([0, 0.015, 0.0])
    rad = 0.075
    ring = [nc + np.array([rad * np.sin(t), 0.0, rad * np.cos(t) * 0.95]) for t in np.linspace(0, 2 * np.pi, 33)]
    gV.clear(); gT.clear()
    tube(ring, r=0.022, n=10)
    for s in (-1, 1):
        start = nc + np.array([s * 0.035, -0.01, 0.07])
        tube([start, start + np.array([s * 0.01, -0.12, 0.03]), start + np.array([s * 0.015, -0.32, 0.03])], r=0.016, n=8)
    out.append({"name": "out.scarf", "V": np.vstack(gV), "T": np.array(gT), "src": None, "bone": "Spine", "zone": np.zeros(sum(len(x) for x in gV))})


    # ── MakeHuman's own clothes and hair (CC0), fitted and posed like the body.
    if pose and pose.get("assets"):
        import os
        from proxies import read_mhclo, read_obj, fit, split_uv
        from PIL import Image
        A = pose["assets"]
        VMH, JMH, RP, PP, g0 = pose["V"], pose["J"], pose["R"], pose["P"], pose["ground"]
        tree_mh = cKDTree(VMH[:13380])

        def proxy(name, rel, slot, keep_face=None, tex=None, normal=None, alpha=False, post=None, drape=None, lip=0.0, hem=None, delete=True, zone=0, delete_above=None):
            folder = os.path.join(A, rel)
            base = os.path.basename(rel)
            if tex == "auto":
                tex = normal = None
                for f in os.listdir(folder):
                    if f.endswith(".mhmat"):
                        for line in open(os.path.join(folder, f), errors="ignore"):
                            t = line.split()
                            if len(t) >= 2 and t[0] == "diffuseTexture": tex = os.path.basename(t[1])
                            if len(t) >= 2 and t[0] == "normalmapTexture": normal = os.path.basename(t[1])
            clo = read_mhclo(os.path.join(folder, base + ".mhclo"))
            PV, PT, PF = read_obj(os.path.join(folder, clo["obj"] or base + ".obj"))
            P = fit(clo, VMH / 0.1) * 0.1
            src, uv, tris = split_uv(PV, PT, PF)
            if keep_face is not None:
                img = None
                if tex:
                    img = np.asarray(Image.open(os.path.join(folder, tex)).convert("RGB")).astype(float) / 255
                cen = P[src][tris].mean(1)
                cen[:, 1] -= g0
                cuv = uv[tris].mean(1)
                col = None
                if img is not None:
                    H, W = img.shape[:2]
                    col = img[np.clip(((1 - cuv[:, 1]) * (H - 1)).astype(int), 0, H - 1), np.clip((cuv[:, 0] * (W - 1)).astype(int), 0, W - 1)]
                if col is not None:
                    # Whole UV islands decide together (a pocket or a seam on the jeans stays with the jeans).
                    parent = list(range(len(uv)))
                    def find(x):
                        while parent[x] != x:
                            parent[x] = parent[parent[x]]; x = parent[x]
                        return x
                    for a_, b_, c_ in tris:
                        for x_, y_ in ((a_, b_), (b_, c_)):
                            rx, ry = find(x_), find(y_)
                            if rx != ry: parent[rx] = ry
                    isl = np.array([find(t[0]) for t in tris])
                    for k in np.unique(isl):
                        sel = isl == k
                        col[sel] = np.median(col[sel], axis=0)
                ok = np.array([keep_face(cen[i], None if col is None else col[i]) for i in range(len(tris))])
                tris = tris[ok]
                used = np.unique(tris)
                remap = -np.ones(len(src), dtype=np.int64); remap[used] = np.arange(len(used))
                tris = remap[tris]; src = src[used]; uv = uv[used]
            refs, rw = clo["refs"][src], clo["w"][src]
            Vp = P[src]
            outV = np.zeros_like(Vp)
            bw = []
            for i in range(len(src)):
                acc = {}
                for k in range(3):
                    for b, w in BONE_W[refs[i, k]]:
                        acc[b] = acc.get(b, 0) + w * rw[i, k]
                top = sorted(acc.items(), key=lambda x: -x[1])[:4]
                tot = sum(w for _, w in top) or 1
                top = [(b, w / tot) for b, w in top]
                bw.append(top)
                outV[i] = sum(w * (RP[b] @ (Vp[i] - JMH[b]) + PP[b]) for b, w in top)
            outV[:, 1] -= g0
            anc = refs.copy()
            helper = anc >= 13380
            if helper.any():
                _, near = tree_mh.query(VMH[anc[helper]])
                anc[helper] = near
            dv = np.array([max(b, key=lambda x: x[1])[0] for b in bw])
            if hem is not None:
                outV = clean_edges(outV, tris, dv, hem)
            if drape is not None:
                outV = drape(outV, dv, np.zeros(len(outV)))
            if post is not None:
                outV = post(outV, tris)
            z = np.full(len(outV), float(zone))
            if lip:
                srcs = np.arange(len(outV))
                outV2, tris2, s2, z2 = add_lip(outV, tris, srcs, z, lip)
                extra = s2[len(outV):]
                uv = np.vstack([uv, uv[extra]]); bw = bw + [bw[i] for i in extra]
                anc = np.vstack([anc, anc[extra]]); rw = np.vstack([rw, rw[extra]])
                outV, tris, z = outV2, tris2, z2
            out.append({"name": name, "V": outV, "T": tris, "src": None, "bw": bw, "anchor": anc, "anchorW": rw, "uv": uv, "zone": z,
                        "slot": slot, "tex": (os.path.join(folder, tex) if tex else None),
                        "normal": (os.path.join(folder, normal) if normal and os.path.exists(os.path.join(folder, normal)) else None), "alpha": alpha,
                        "delete": (clo["delete"][(clo["delete"] < 13380) & (VB[np.minimum(clo["delete"], 13379), 1] > (delete_above if delete_above is not None else -9))] if delete else np.zeros(0, dtype=np.int64))})

        blue = lambda c: c is not None and (c[2] - c[0]) > 0.08
        knee = J["LeftLeg"][1]
        proxy("kit.tee", "clothes/male_casualsuit06", "tee", keep_face=lambda p, c: not blue(c), tex="male_casualsuit06_diffuse.png", delete_above=hips_y - 0.06,
              normal="male_casualsuit06_normal.png", lip=0.01, drape=lambda V, dv, tv: drape_top(V, dv, tv, ease=0.004, grow=0.08))
        proxy("kit.teeShorts", "clothes/male_casualsuit06", "tee", keep_face=lambda p, c: blue(c) and p[1] > knee + 0.2, delete=False,
              tex="male_casualsuit06_diffuse.png", normal="male_casualsuit06_normal.png", lip=0.01, zone=3,
              hem=lambda p, d: ("t", 0.62) if d in LEG else None, drape=drape_shorts)
        proxy("kit.trainers", "clothes/shoes06", "shoes06", keep_face=lambda p, c: p[1] < 0.1, tex="shoes06_diffuse.png", delete=False)
        proxy("out.suit", "clothes/male_elegantsuit01", "suit", tex="male_elegantsuit01_diffuse.png")
        proxy("out.shirtJeans", "clothes/male_casualsuit01", "casual01", tex="male_casualsuit01_diffuse.png", normal="male_casualsuit01_normal.png")
        proxy("out.jacketJeans", "clothes/male_casualsuit05", "casual05", tex="male_casualsuit05_diffuse.png", normal="male_casualsuit05_normal.png")
        proxy("out.teeJeans", "clothes/male_casualsuit02", "casual02", tex="male_casualsuit02_diffuse.png", normal="male_casualsuit02_normal.png")
        proxy("out.formalShoes", "clothes/shoes04", "shoes04", keep_face=lambda p, c: p[1] < 0.105, tex="shoes04_diffuse.png", delete=False)
        proxy("out.trainerShoes", "clothes/shoes05", "shoes05", keep_face=lambda p, c: p[1] < 0.1, tex="shoes05_diffuse.png", delete=False)
        for nm, rel in (("hair.mh_short", "hair/short02"), ("hair.mh_crop", "hair/short04"), ("hair.mh_side", "hair/short01"),
                        ("hair.mh_swept", "hair/short03"), ("hair.mh_afro", "hair/afro01"), ("hair.mh_long", "hair/long01")):
            b = os.path.basename(rel)
            proxy(nm, rel, "hair-" + b, tex="auto", alpha=True, delete=False)
        proxy("brows.mh", "eyebrows/eyebrow002", "brows", tex="auto", alpha=True, delete=False)

    return {"parts": out, "TB": TB, "NB": NB, "land": LAND}


def write_glb(OUT, VB, built, PB, RBASE, SHAPES, height, REX, RJ, RJOINTS, RPAR, RROT, RNODES, RIDX, BONE_W):
    import io
    from PIL import Image
    parts = built["parts"]
    body_tree = cKDTree(VB[:13380])
    bone_index = {n: i for i, n in enumerate(RJOINTS)}

    # Which proxies hide which skin (their delete lists), one bit each.
    del_parts = [p["name"] for p in parts if len(p.get("delete", [])) and p["name"] not in ()]
    del_parts = list(dict.fromkeys(del_parts))
    delmask = np.zeros(len(VB), dtype=np.int64)
    for k, nm in enumerate(del_parts):
        for p in parts:
            if p["name"] == nm:
                delmask[p["delete"][p["delete"] < len(VB)]] |= (1 << k) if len(p.get("delete", [])) else 0

    slots = []
    by_slot = {}
    for p in parts:
        sl = p.get("slot", "body")
        if sl not in by_slot:
            by_slot[sl] = []; slots.append(sl)
        by_slot[sl].append(p)

    w = glb.Writer()
    j = {"asset": {"version": "2.0", "generator": "tools/human3d/build_human.py"}, "scene": 0}
    nodes = [{"name": "Armature", "scale": [0.01, 0.01, 0.01], "children": []}]
    nidx = {}
    for b in RJOINTS:
        nidx[b] = len(nodes)
        rn = RNODES[RIDX[b]]
        nodes.append({"name": b, "rotation": rn.get("rotation", [0, 0, 0, 1]), "children": []})

    def pos_of(b):
        if b in PB:
            return PB[b]
        if b == "headfront":
            return PB["Head"] + np.array([0, 0, 0.1])
        raise KeyError(b)
    W = {}
    for b in RJOINTS:
        par = RPAR[b]
        p = pos_of(b)
        if par == "Armature":
            t = p / 0.01
            nodes[0]["children"].append(nidx[b])
        else:
            t = RROT[par].T @ (p - pos_of(par)) / 0.01
            nodes[nidx[par]]["children"].append(nidx[b])
        nodes[nidx[b]]["translation"] = [float(x) for x in t]
        M = np.eye(4); M[:3, :3] = RROT[b] * 0.01; M[:3, 3] = p
        W[b] = M
    for n in nodes:
        if not n["children"]:
            del n["children"]
    ibm = np.stack([np.linalg.inv(W[b]).T.reshape(-1) for b in RJOINTS]).astype(np.float32)
    skin = {"joints": [nidx[b] for b in RJOINTS], "inverseBindMatrices": w.acc(ibm, "MAT4")}

    images, textures, materials, meshes, mesh_nodes = [], [], [], [], []
    tex_cache = {}

    def texture(path, size, mode):
        key = (path, size)
        if key in tex_cache:
            return tex_cache[key]
        im = Image.open(path).convert(mode)
        if "casualsuit06_diffuse" in path:
            a_ = np.asarray(im).astype(float)
            core = (a_[..., 0] - a_[..., 2] > 30) & (a_[..., 0] > 90)
            from scipy.ndimage import label, median_filter
            lab, n = label(core)
            white = median_filter(a_, size=(61, 61, 1))
            for k in range(1, n + 1):
                ys_, xs_ = np.nonzero(lab == k)
                if len(ys_) < 40:
                    continue
                y0, y1 = max(0, ys_.min() - 90), min(a_.shape[0], ys_.max() + 90)
                x0, x1 = max(0, xs_.min() - 220), min(a_.shape[1], xs_.max() + 90)
                box = a_[y0:y1, x0:x1]
                notblue = (box[..., 2] - box[..., 0]) < 20
                box[notblue] = white[y0:y1, x0:x1][notblue]
            im = Image.fromarray(a_.astype(np.uint8))
        if max(im.size) > size:
            im = im.resize((size, size), Image.LANCZOS)
        buf = io.BytesIO(); im.save(buf, "PNG", optimize=True)
        bv = w.view(buf.getvalue())
        images.append({"bufferView": bv, "mimeType": "image/png"})
        textures.append({"source": len(images) - 1})
        tex_cache[key] = len(textures) - 1
        return tex_cache[key]

    total_v = 0
    for sl in slots:
        ps = by_slot[sl]
        P, T, PART, ZONE, ANC, ANW, JI, JW, UV, DEL = [], [], [], [], [], [], [], [], [], []
        base = 0
        for p in ps:
            V = p["V"]; n = len(V)
            P.append(V); T.append(p["T"] + base)
            PART.append(np.full(n, PARTS.index(p["name"]))); ZONE.append(np.asarray(p["zone"], dtype=float))
            ji = np.zeros((n, 4), dtype=np.uint16); jw = np.zeros((n, 4), dtype=np.float32)
            if p.get("bw") is not None:
                for k, lst in enumerate(p["bw"]):
                    for m, (bn, ww) in enumerate(lst[:4]):
                        ji[k, m] = bone_index[bn]; jw[k, m] = ww
            elif p.get("src") is not None:
                for k, s_ in enumerate(p["src"]):
                    for m, (bn, ww) in enumerate(BONE_W[s_][:4]):
                        ji[k, m] = bone_index[bn]; jw[k, m] = ww
            else:
                ji[:, 0] = bone_index[p["bone"]]; jw[:, 0] = 1
            JI.append(ji); JW.append(jw)
            if p.get("anchor") is not None:
                a = p["anchor"]; aw = p["anchorW"]
            elif p.get("body"):
                a = np.stack([p["src"]] * 3, 1); aw = np.tile([1.0, 0, 0], (n, 1))
            else:
                dd, a = body_tree.query(V, k=3)
                aw = 1 / np.maximum(dd, 1e-4); aw /= aw.sum(1, keepdims=True)
            ANC.append(a); ANW.append(aw)
            UV.append(p["uv"] if p.get("uv") is not None else np.zeros((n, 2), np.float32))
            DEL.append(delmask[p["src"]].astype(np.float32) if p.get("body") else np.zeros(n, np.float32))
            base += n
        P = np.vstack(P).astype(np.float32); T = np.vstack(T).astype(np.uint32)
        JW_ = np.vstack(JW); JW_ = JW_ / np.maximum(JW_.sum(1, keepdims=True), 1e-9)
        N = vnormals(P.astype(np.float64), T.astype(np.int64)).astype(np.float32)
        attrs = {
            "POSITION": w.acc(P, "VEC3", 34962, minmax=True),
            "NORMAL": w.acc(N, "VEC3", 34962),
            "JOINTS_0": w.acc(np.vstack(JI).astype(np.uint16), "VEC4", 34962),
            "WEIGHTS_0": w.acc(JW_.astype(np.float32), "VEC4", 34962),
            "_PART": w.acc(np.concatenate(PART).astype(np.float32), "SCALAR", 34962),
            "_ZONE": w.acc(np.concatenate(ZONE).astype(np.float32), "SCALAR", 34962),
            "_ANCHOR": w.acc(np.vstack(ANC).astype(np.float32), "VEC3", 34962),
            "_ANCHORW": w.acc(np.vstack(ANW).astype(np.float32), "VEC3", 34962),
        }
        if any(p.get("uv") is not None for p in ps):
            uv = np.vstack(UV).astype(np.float32).copy(); uv[:, 1] = 1 - uv[:, 1]
            attrs["TEXCOORD_0"] = w.acc(uv, "VEC2", 34962)
        if sl == "body":
            attrs["_DEL"] = w.acc(np.concatenate(DEL).astype(np.float32), "SCALAR", 34962)
        mat = {"name": sl, "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0, "roughnessFactor": 0.75}, "doubleSided": True}
        t0 = ps[0].get("tex")
        if t0:
            size = 512 if sl.startswith("hair") or sl.startswith("shoes") else 256 if sl == "brows" else 1024
            mat["pbrMetallicRoughness"]["baseColorTexture"] = {"index": texture(t0, size, "RGBA" if ps[0].get("alpha") else "RGB")}
        n0 = ps[0].get("normal")
        if n0:
            mat["normalTexture"] = {"index": texture(n0, 512, "RGB"), "scale": 0.8}
        if ps[0].get("alpha"):
            mat["alphaMode"] = "MASK"; mat["alphaCutoff"] = 0.45
        materials.append(mat)
        idx = w.acc(T.reshape(-1), "SCALAR", 34963)
        meshes.append({"name": f"Body.{sl}", "primitives": [{"attributes": attrs, "indices": idx, "material": len(materials) - 1}]})
        mesh_nodes.append(len(nodes))
        nodes.append({"name": "Body" if sl == "body" else f"Body.{sl}", "mesh": len(meshes) - 1, "skin": 0})
        total_v += len(P)
        print(f"  slot {sl}: {len(P)} vertices")
    print(f"vertices {total_v}")

    shape_deltas = [(name, dV[:13380].astype(np.float32), {k: [round(float(x), 5) for x in v] for k, v in dJ.items()}, h) for name, dV, dJ, h in SHAPES]
    targets = [{"POSITION": w.acc(d, "VEC3", 34962, minmax=True)} for _, d, _, _ in shape_deltas]
    shape_mesh_pos = w.acc(VB[:13380].astype(np.float32), "VEC3", 34962, minmax=True)
    sidx = w.acc(np.arange(3, dtype=np.uint32), "SCALAR", 34963)
    meshes.append({"name": "Shapes", "primitives": [{"attributes": {"POSITION": shape_mesh_pos}, "indices": sidx, "targets": targets, "mode": 0}],
                   "extras": {"targetNames": [s_[0] for s_ in shape_deltas]}})
    shapes_node = len(nodes)
    nodes.append({"name": "Shapes", "mesh": len(meshes) - 1})

    eye_y = (PB["eyeL"][1] + PB["eyeR"][1]) / 2
    hips_y = PB["Hips"][1]
    meta = {
        "model": "human",
        "skinAvg": [0.62, 0.36, 0.24],
        "hairAvg": [0.044, 0.026, 0.0185],
        "face": {"chinY": round(float(built["land"]["lipBot"] - 0.036), 4), "eyeY": round(float(eye_y), 4), "browY": round(float(eye_y + 0.02), 4), "frontZ": round(float(PB["eyeL"][2] + 0.04), 4)},
        "kit": {"hemY": round(float(hips_y - 0.1), 4), "sockY": round(float(PB["LeftLeg"][1] - 0.055), 4), "bootY": 0.1},
        "joints": {k: [round(float(x), 4) for x in v] for k, v in PB.items()},
        "hands": hands_meta(PB, REX),
        "fingers": fingers_meta(PB, REX),
        "landmarks": {k: ([round(float(x), 5) for x in v] if np.ndim(v) else round(float(v), 5)) for k, v in built["land"].items() if k != "lips"},
        "human": {
            "version": 2, "height": round(float(height), 4), "parts": PARTS, "slots": slots, "bodyVerts": 13380, "deleteParts": del_parts,
            "alphaSlots": [sl for sl in slots if by_slot[sl][0].get("alpha")],
            "shapes": [{"name": n, "height": round(float(h), 4), "joints": dj} for n, _, dj, h in shape_deltas],
        },
    }
    j.update({
        "scenes": [{"nodes": [0] + mesh_nodes + [shapes_node], "extras": meta}],
        "nodes": nodes, "meshes": meshes, "skins": [skin], "materials": materials,
    })
    if images:
        j["images"] = images; j["textures"] = textures
        j["samplers"] = [{"magFilter": 9729, "minFilter": 9987}]
        for t in textures:
            t["sampler"] = 0
    size = w.save(OUT, j)
    print(f"wrote {OUT}: {size / 1e6:.2f} MB")


def hands_meta(PB, REX):
    out = {}
    for side, S in (("L", "Left"), ("R", "Right")):
        h = REX["hands"][side]
        tip = PB[f"{S}HandMiddleTip"]
        ln = float(np.linalg.norm(tip - PB[f"{S}Hand"]))
        out[side] = {"along": h["along"], "palm": h["palm"], "thumb": h["thumb"], "len": round(ln, 4)}
    return out


def fingers_meta(PB, REX):
    rot = lambda v, ax, ang: v * np.cos(ang) + np.cross(ax, v) * np.sin(ang) + ax * (ax @ v) * (1 - np.cos(ang))
    out = {}
    for side, S in (("L", "Left"), ("R", "Right")):
        pa = np.array(REX["hands"][side]["palm"])
        al = np.array(REX["hands"][side]["along"])
        m = {}
        for f, F in (("thumb", "Thumb"), ("index", "Index"), ("middle", "Middle"), ("ring", "Ring"), ("little", "Little")):
            b = [f"{S}Hand{F}{k}" for k in (1, 2, 3)]
            d = unit(PB[f"{S}Hand{F}Tip"] - PB[b[0]])
            ln = float(np.linalg.norm(PB[f"{S}Hand{F}Tip"] - PB[b[0]]))
            axis = unit(np.cross(d, pa))
            if rot(d, axis, 0.2) @ pa < d @ pa:
                axis = -axis
            e = {"bones": b, "axis": [round(float(x), 5) for x in axis], "dir": [round(float(x), 5) for x in d], "len": round(ln, 4)}
            if f == "thumb":
                sw = unit(pa - d * (pa @ d))
                if rot(d, sw, 0.2) @ al < d @ al:
                    sw = -sw
                e["swing"] = [round(float(x), 5) for x in sw]
            m[f] = e
        out[side] = m
    return out
