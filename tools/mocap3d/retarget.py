"""Put CMU motion capture onto our two skeletons (numpy only).

The idea (the standard "rest-pose alignment" retarget):
  - every CMU bone's world turn away from ITS rest pose is known (cmu.py);
  - our matching bone gets the same world turn, after first swinging our
    rest bone onto the CMU rest bone's direction (our people stand in an
    A-pose or T-pose, CMU's in a T-pose). So each limb points exactly where
    the actor's limb pointed, and twists the way it twisted.
  - the hips go where the actor's pelvis went, scaled by leg length;
  - each ankle is then put (two-bone IK) where the actor's ankle went,
    scaled the same way and lifted so a flat foot stands on y = 0: our
    legs are a different length ratio, and without this the feet float,
    sink or skate;
  - while a foot is planted (low and still in the capture) it is pinned to
    one spot: no sliding.
A loop (a run cycle) is cut where the pose repeats, its travel taken out
(the game moves him; the measured speed goes in the file), and the last
frame bent onto the first so it never pops.
"""
import numpy as np
from rig import qmul, qinv, qrot, qfromto, qnorm, qaxis, CANON

# our canonical bone -> CMU bone
MAP = dict(hips="root", spine1="lowerback", spine2="upperback", spine3="thorax", neck="lowerneck", head="head",
           shL="lclavicle", armL="lhumerus", foreL="lradius", handL="lhand",
           shR="rclavicle", armR="rhumerus", foreR="rradius", handR="rhand",
           thighL="lfemur", shinL="ltibia", footL="lfoot", toeL="ltoes",
           thighR="rfemur", shinR="rtibia", footR="rfoot", toeR="rtoes")
# our bone -> the joint its rest direction points to (None: special)
CHILD = dict(spine1="spine2", spine2="spine3", spine3="neck", neck="head",
             shL="armL", armL="foreL", foreL="handL", shR="armR", armR="foreR", foreR="handR",
             thighL="shinL", shinL="footL", footL="toeL", thighR="shinR", shinR="footR", footR="toeR")
MIRROR = np.diag([-1.0, 1.0, 1.0])


def m2q(m):
    """3x3 rotation matrix -> quaternion [x, y, z, w]."""
    t = np.trace(m)
    if t > 0:
        s = np.sqrt(t + 1.0) * 2
        q = [(m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s, 0.25 * s]
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = np.sqrt(1.0 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        q = [0.25 * s, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s, (m[2, 1] - m[1, 2]) / s]
    elif m[1, 1] > m[2, 2]:
        s = np.sqrt(1.0 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        q = [(m[0, 1] + m[1, 0]) / s, 0.25 * s, (m[1, 2] + m[2, 1]) / s, (m[0, 2] - m[2, 0]) / s]
    else:
        s = np.sqrt(1.0 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
        q = [(m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, 0.25 * s, (m[1, 0] - m[0, 1]) / s]
    return qnorm(np.array(q))


def axis_angle(axis, a):
    axis = np.asarray(axis, float)
    axis = axis / np.linalg.norm(axis)
    x, y, z = axis
    c, s, C = np.cos(a), np.sin(a), 1 - np.cos(a)
    return np.array([[c + x * x * C, x * y * C - z * s, x * z * C + y * s],
                     [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
                     [z * x * C - y * s, z * y * C + x * s, c + z * z * C]])


def env(t, a, b, c, d):
    """0 before a, eases up to 1 by b, holds, eases down to 0 from c to d."""
    if t <= a or t >= d:
        return 0.0
    if t < b:
        w = (t - a) / (b - a)
    elif t <= c:
        return 1.0
    else:
        w = (d - t) / (d - c)
    return w * w * (3 - 2 * w)


def roty(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def slerp(a, b, k):
    d = float(np.dot(a, b))
    if d < 0:
        b, d = -b, -d
    if d > 0.9995:
        return qnorm(a + (b - a) * k)
    th = np.arccos(d)
    return (np.sin((1 - k) * th) * a + np.sin(k * th) * b) / np.sin(th)


def smooth(x, passes=1):
    """Binomial [1 2 1]/4 along axis 0, ends held."""
    x = np.array(x, float)
    for _ in range(passes):
        y = x.copy()
        y[1:-1] = (x[:-2] + 2 * x[1:-1] + x[2:]) / 4
        x = y
    return x


class Source:
    """One cut of one CMU trial, already in the character's own frame (x = his
    left, z = forward, y up, metres, his starting facing = +z)."""

    def __init__(self, mo, t0, t1, mirror=False, face="start", face_t=None, yaw_extra=0.0, speed=1.0):
        fps = mo.fps
        f0, f1 = int(round(t0 * fps)), min(int(round(t1 * fps)), mo.n - 1)
        self.fps = fps / speed
        self.n = f1 - f0 + 1
        sl = slice(f0, f1 + 1)
        def swap(n):
            if not mirror or n[0] not in "lr" or n in ("lowerback", "lowerneck", "root"):
                return n
            o = ("r" if n[0] == "l" else "l") + n[1:]
            return o if o in mo.R else n
        self.R, self.P = {}, {}
        for n in mo.R:
            src = swap(n)
            R, P = mo.R[src][sl].copy(), mo.P[src][sl].copy()
            if mirror:
                R = MIRROR @ R @ MIRROR
                P = P @ MIRROR
            self.R[n], self.P[n] = R, P
        root = self.P["root"]
        # facing
        if face == "travel":
            d = root[-1] - root[0]
            yaw0 = np.arctan2(d[0], d[2])
        elif face == "mean":
            fw = np.einsum("nij,j->ni", self.R["root"], np.array([0, 0, 1.0])).mean(axis=0)
            yaw0 = np.arctan2(fw[0], fw[2])
        else:
            k = 0 if face == "start" else (self.n - 1 if face == "end" else int(round((face_t - t0) * fps)))
            fw = self.R["root"][k] @ np.array([0, 0, 1.0])
            yaw0 = np.arctan2(fw[0], fw[2])
        yaw0 += yaw_extra
        G = roty(-yaw0)
        o = root[0].copy()
        o[1] = 0
        for n in self.R:
            self.R[n] = G @ self.R[n]
            self.P[n] = (self.P[n] - o) @ G.T
        self.sk = mo.sk
        self.mirror = mirror
        self.t0 = t0
        self.speed = speed

    # ── careful changes on top of the capture (the "adapted" clips) ──────
    def t(self, f):
        """Seconds into the cut (after `rate`) of capture frame f."""
        return f / self.fps

    def subtree(self, bone):
        out = [bone]
        for c in self.sk.bones[bone].children:
            out += self.subtree(c)
        return out

    def yaw(self, f):
        fw = self.R["root"][f] @ np.array([0, 0, 1.0])
        return np.arctan2(fw[0], fw[2])

    def body_axis(self, f, axis):
        """A direction given in his own (yaw-only) frame at frame f -> world."""
        return roty(self.yaw(f)) @ np.asarray(axis, float)

    def turn_subtree(self, bone, f, axis_world, ang, pivot=None):
        """Turn bone and everything below it about its start joint (or pivot) at frame f."""
        if abs(ang) < 1e-9:
            return
        Rm = axis_angle(axis_world, ang)
        names = self.subtree(bone)
        J = self.P[self.sk.bones[bone].parent][f].copy() if pivot is None else np.asarray(pivot, float)
        for n in names:
            self.R[n][f] = Rm @ self.R[n][f]
            self.P[n][f] = J + Rm @ (self.P[n][f] - J)

    def bend(self, bone, axis_local, ang_fn):
        """For every frame: turn bone's subtree about an axis in his own frame by ang_fn(t) (radians)."""
        for f in range(self.n):
            a = ang_fn(self.t(f))
            if a:
                self.turn_subtree(bone, f, self.body_axis(f, axis_local), a)

    def aim(self, bone, f, want_dir, k=1.0):
        """Swing bone (with its subtree) so it points along want_dir (world), by fraction k."""
        b = self.sk.bones[bone]
        cur = self.R[bone][f] @ b.direction
        want = np.asarray(want_dir, float)
        want = want / np.linalg.norm(want)
        ax = np.cross(cur, want)
        s = np.linalg.norm(ax)
        if s < 1e-8:
            return
        ang = np.arctan2(s, np.dot(cur, want)) * k
        self.turn_subtree(bone, f, ax / s, ang)

    def reach(self, side, f, target, k=1.0, pole_local=(0, -0.5, -1.0)):
        """Two-bone IK on the captured arm (humerus + radius) so the wrist goes to
        target (world), blended by k; the elbow bends towards pole (his frame)."""
        if k <= 0:
            return
        s = side.lower()
        hu, ra = s + "humerus", s + "radius"
        S = self.P[self.sk.bones[hu].parent][f]
        E = self.P[hu][f]
        W = self.P[ra][f]
        L1, L2 = np.linalg.norm(E - S), np.linalg.norm(W - E)
        tg = W + (np.asarray(target, float) - W) * k
        v = tg - S
        d = min(max(np.linalg.norm(v), 0.2 * (L1 + L2)), 0.999 * (L1 + L2))
        along = v / np.linalg.norm(v)
        a = max(-1, min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)))
        h = L1 * np.sqrt(1 - a * a)
        pole = self.body_axis(f, pole_local)
        p = pole - along * np.dot(pole, along)
        p /= np.linalg.norm(p) + 1e-9
        # blend the current elbow side in, so a small move keeps his own elbow
        cur = E - S - along * np.dot(E - S, along)
        if np.linalg.norm(cur) > 1e-6 and k < 1:
            cur /= np.linalg.norm(cur)
            p = p * k + cur * (1 - k)
            p /= np.linalg.norm(p)
        E2 = S + along * (L1 * a) + p * h
        self.aim(hu, f, E2 - S)
        self.aim(ra, f, S + along * d - self.P[hu][f])

    def unturn(self, t_a, t_b, pivot="ltibia", ref_t=None):
        """Undo the body's own turn between t_a and t_b (eased), turning everything
        about the planted foot, so he ends facing the way he faced at ref_t (default t_a)."""
        n = self.n
        yaw = np.unwrap(np.array([self.yaw(f) for f in range(n)]))
        yaw = smooth(yaw, 6)
        fr = int(round((t_a if ref_t is None else ref_t) * self.fps))
        y0 = yaw[min(fr, n - 1)]
        piv = self.P[pivot][min(int(round(t_a * self.fps)), n - 1)].copy()
        for f in range(n):
            t = self.t(f)
            w = 0 if t <= t_a else (1 if t >= t_b else (t - t_a) / (t_b - t_a))
            w = w * w * (3 - 2 * w)
            c = -(yaw[f] - y0) * w
            if abs(c) < 1e-6:
                continue
            Rm = roty(c)
            for nm in self.R:
                self.R[nm][f] = Rm @ self.R[nm][f]
                p = self.P[nm][f] - piv
                self.P[nm][f] = piv + Rm @ p


def rest_dirs(rig):
    """Our rest direction for each canonical bone (world, character frame)."""
    P = lambda k: rig.restP[rig.b[k]]
    d = {}
    for k in CANON:
        if k == "hips":
            continue
        if k in CHILD:
            v = P(CHILD[k]) - P(k)
        elif k.startswith("hand"):
            s = k[-1]
            mid = [c for c in rig.nodes[rig.b[k]].get("children", []) if "middle" in rig.nodes[c]["name"].lower()]
            v = rig.restP[mid[0]] - P(k) if mid else P(k) - P("fore" + s)
        elif k.startswith("toe"):
            s = k[-1]
            v = P(k) - P("foot" + s)
            v[1] = 0
        elif k == "head":
            ch = [c for c in rig.nodes[rig.b[k]].get("children", []) if rig.nodes[c]["name"] == "head_end"]
            v = rig.restP[ch[0]] - P(k) if ch else np.array([0, 1.0, 0])
        d[k] = v / np.linalg.norm(v)
    return d


class Retarget:
    def __init__(self, rig, sk):
        self.rig, self.sk = rig, sk
        self.dirs = rest_dirs(rig)
        self.A = {}
        for k, d in self.dirs.items():
            dm = sk.bones[MAP[k]].direction
            if k.startswith("toe"):
                dm = dm.copy()
                dm[1] = 0
            self.A[k] = qfromto(d, dm)
        self.A["hips"] = np.array([0, 0, 0, 1.0])
        restm = sk.rest_positions()
        b = rig.b
        # leg length: hip joint to ankle, ours / theirs
        ours = np.linalg.norm(rig.restP[b["shinL"]] - rig.restP[b["thighL"]]) + np.linalg.norm(rig.restP[b["footL"]] - rig.restP[b["shinL"]])
        theirs = sk.bones["lfemur"].length + sk.bones["ltibia"].length
        self.s = ours / theirs
        # our hips above our hip joints (the CMU root sits at the hip joints' height, near enough)
        self.hip_over = rig.restP[b["hips"]][1] - (rig.restP[b["thighL"]][1] + rig.restP[b["thighR"]][1]) / 2
        self.mroot_over = -(restm["lhipjoint"][1] + restm["rhipjoint"][1]) / 2

    # ── per-frame solve ────────────────────────────────────────────────
    def fk(self, W, hips_pos):
        """W: {canon: world quat}. -> R (local), T, Q, P for every node."""
        rig = self.rig
        R = list(rig.base)
        T = list(rig.T)
        Q, P, S = [None] * len(rig.nodes), [None] * len(rig.nodes), [None] * len(rig.nodes)
        canon_of = {rig.b[k]: k for k in CANON}
        for i in rig.order:
            k = canon_of.get(i)
            if i in rig.parent:
                p = rig.parent[i]
                if k is not None and k in W:
                    R[i] = qnorm(qmul(qinv(Q[p]), W[k]))
                    if k == "hips":
                        T[i] = qrot(qinv(Q[p]), hips_pos - P[p]) / S[p]
                Q[i] = qnorm(qmul(Q[p], R[i]))
                P[i] = P[p] + qrot(Q[p], T[i]) * S[p]
                S[i] = S[p] * rig.S[i]
            else:
                Q[i], P[i], S[i] = qnorm(R[i]), np.array(T[i], float), rig.S[i]
        return R, T, Q, P

    def world_turns(self, src, f):
        rig = self.rig
        W = {}
        for k in CANON:
            D = m2q(src.R[MAP[k]][f])
            W[k] = qnorm(qmul(D, qmul(self.A[k], rig.restQ[rig.b[k]])))
        # Shins and forearms: swing only. A knee or elbow is a hinge; the
        # capture's own twist of the shin is calibration noise on some actors
        # (subject 141's shins turn in 30-40°), which would wring the mesh at
        # the ankle. So each one keeps the twist its thigh / upper arm gives
        # it and only swings to point where the actor's did.
        for up, lo in (("thighL", "shinL"), ("thighR", "shinR"), ("armL", "foreL"), ("armR", "foreR")):
            iu, il = rig.b[up], rig.b[lo]
            carry = qmul(W[up], qinv(rig.restQ[iu]))
            Wc = qmul(carry, rig.restQ[il])
            dc = qrot(carry, self.dirs[lo])
            dm = src.R[MAP[lo]][f] @ self.sk.bones[MAP[lo]].direction
            W[lo] = qnorm(qmul(qfromto(dc, dm), Wc))
        return W

    def place(self, src, p, floor):
        """A captured point -> our character frame: scaled about the start, the floor at y = floor-scaled."""
        q = p * self.s
        q[..., 1] = (p[..., 1] - floor) * self.s
        return q


def leg_ik(rt, W, Q, P, side, target):
    """Turn thigh and shin (world) so the ankle lands on target, knee bent the way it was."""
    rig = rt.rig
    b = rig.b
    H, K, A = P[b["thigh" + side]], P[b["shin" + side]], P[b["foot" + side]]
    L1, L2 = np.linalg.norm(K - H), np.linalg.norm(A - K)
    v = target - H
    d = np.linalg.norm(v)
    d = min(max(d, 0.3 * (L1 + L2)), 0.9999 * (L1 + L2))
    along = v / np.linalg.norm(v)
    a = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)
    a = max(-1, min(1, a))
    h = L1 * np.sqrt(1 - a * a)
    pole = K - H
    p = pole - along * np.dot(pole, along)
    if np.linalg.norm(p) < 1e-6:
        p = np.array([0, 0, 1.0]) - along * along[2]
    p /= np.linalg.norm(p)
    K2 = H + along * (L1 * a) + p * h
    E = H + along * d
    r1 = qfromto(K - H, K2 - H)
    W["thigh" + side] = qnorm(qmul(r1, W["thigh" + side]))
    shin_dir = qrot(r1, A - K)
    r2 = qfromto(shin_dir, E - K2)
    W["shin" + side] = qnorm(qmul(r2, qmul(r1, W["shin" + side])))


def contacts(y, xz, fps, y_thr, v_thr):
    """Bool per frame: the point is low and nearly still."""
    v = np.zeros(len(y))
    v[1:-1] = np.linalg.norm(xz[2:] - xz[:-2], axis=1) * fps / 2
    v[0], v[-1] = v[1], v[-2]
    c = (y < y_thr) & (v < v_thr)
    # drop one-frame flickers
    out = c.copy()
    for i in range(1, len(c) - 1):
        if c[i - 1] == c[i + 1] != c[i]:
            out[i] = c[i - 1]
    return out, v


def lock(tg, mask, fps, blend_s=0.06):
    """Pin xz of target over each planted run to the run's stillest spot; ease in/out."""
    tg = tg.copy()
    n = len(tg)
    nb = max(1, int(blend_s * fps))
    i = 0
    runs = []
    while i < n:
        if mask[i]:
            j = i
            while j + 1 < n and mask[j + 1]:
                j += 1
            runs.append((i, j))
            i = j + 1
        else:
            i += 1
    out = tg.copy()
    for i, j in runs:
        seg = tg[i:j + 1]
        sp = np.linalg.norm(np.diff(seg[:, [0, 2]], axis=0), axis=1) if j > i else np.zeros(1)
        k = i + int(np.argmin(sp)) if j > i else i
        anchor = tg[k, [0, 2]]
        yfix = tg[i:j + 1, 1].min()
        for f in range(max(0, i - nb), min(n, j + nb + 1)):
            if f < i:
                w = (f - (i - nb)) / nb
            elif f > j:
                w = 1 - (f - j) / nb
            else:
                w = 1.0
            w = w * w * (3 - 2 * w)
            out[f, 0] = tg[f, 0] + (anchor[0] - tg[f, 0]) * w
            out[f, 2] = tg[f, 2] + (anchor[1] - tg[f, 2]) * w
            if i <= f <= j:
                out[f, 1] = tg[f, 1] + (yfix - tg[f, 1]) * w
    return out, runs


def solve_clip(rt, src, loop=False, lock_feet=True, inplace=None, ik=True, floor_pct=3.0, hip_drop=0.0,
               floor=None, pre_smooth=1):
    """-> dict with per-capture-frame world turns W, hips positions, solved Q/P, and info."""
    rig, b = rt.rig, rt.rig.b
    n = src.n
    # floor: where the actor's ankles sit when standing flat
    if floor is None:
        ank = np.concatenate([src.P["ltibia"][:, 1], src.P["rtibia"][:, 1]])
        floor = float(np.percentile(ank, floor_pct))
    root = src.P["root"].copy()
    hips = rt.place(src, root, floor)
    # the hips: the actor's pelvis height above flat-ankle level (scaled), plus our
    # ankle height, plus how far our hips bone sits over our hip joints minus how
    # far CMU's root sits over the actor's
    hips[:, 1] += rig.ankleY + rt.hip_over - rt.mroot_over * rt.s - hip_drop
    off = rig.restP[b["hips"]][[0, 2]]
    tg = {}
    for s, m in (("L", "ltibia"), ("R", "rtibia")):
        t = rt.place(src, src.P[m].copy(), floor)
        t[:, 1] += rig.ankleY
        tg[s] = t
    for arr in [hips] + list(tg.values()):
        arr[:, 0] += off[0]
        arr[:, 2] += off[1]
    # planted feet
    info = {"floor": floor, "runs": {}}
    if lock_feet:
        for s, m, bm in (("L", "ltibia", "lfoot"), ("R", "rtibia", "rfoot")):
            t = tg[s]
            c, v = contacts(t[:, 1], t[:, [0, 2]], src.fps, rig.ankleY + 0.035, 0.45)
            tg[s], runs = lock(t, c, src.fps)
            info["runs"][s] = runs
    # never below the flat-foot ankle height
    for s in "LR":
        tg[s][:, 1] = np.maximum(tg[s][:, 1], rig.ankleY * 0.97)
    # Feet: each actor's rest-pose foot angle differs (subject 141's points
    # nearly flat, subject 82's 17° down), so line our foot up with how the
    # actor's foot actually sits when it is planted, not with his rest pose:
    # planted in the capture = our foot at its own rest angle (flat).
    saveA = {}
    for s, mt, mf in (("L", "ltibia", "lfoot"), ("R", "rtibia", "rfoot")):
        y = src.P[mt][:, 1]
        v = np.zeros(n)
        v[1:] = np.linalg.norm(np.diff(src.P[mt][:, [0, 2]], axis=0), axis=1) * src.fps
        low = (y < floor + 0.03) & (v < 0.3)
        if low.sum() < 5:
            low = y <= np.percentile(y, 20)
        dm = rt.sk.bones[mf].direction
        pw = np.array([np.arcsin(np.clip((src.R[mf][f] @ dm)[1], -1, 1)) for f in np.nonzero(low)[0]])
        p_plant = float(np.median(pw))
        our = rt.dirs["foot" + s]
        p_o = float(np.arcsin(np.clip(our[1], -1, 1)))
        p_rest = float(np.arcsin(np.clip(dm[1], -1, 1)))
        want = p_o - (p_plant - p_rest)
        h = np.array([dm[0], 0, dm[2]])
        h = h / (np.linalg.norm(h) + 1e-9)
        dm2 = h * np.cos(want) + np.array([0, np.sin(want), 0])
        saveA["foot" + s] = rt.A["foot" + s]
        rt.A["foot" + s] = qfromto(our, dm2)
        info.setdefault("footPitch", {})[s] = round(np.degrees(p_plant), 1)
    W_all = [rt.world_turns(src, f) for f in range(n)]
    rt.A.update(saveA)
    # travel out (loops / in-place)
    speed = None
    vel = None
    if inplace:
        tt = np.arange(n) / src.fps
        d = hips[-1, [0, 2]] - hips[0, [0, 2]]
        vel = d / (tt[-1] if tt[-1] > 0 else 1)
        speed = float(np.linalg.norm(vel))
        for arr in (hips, tg["L"], tg["R"]):
            arr[:, 0] -= vel[0] * tt
            arr[:, 2] -= vel[1] * tt
        # centre the hips over the origin on average
        c = hips[:, [0, 2]].mean(axis=0) - off
        for arr in (hips, tg["L"], tg["R"]):
            arr[:, 0] -= c[0]
            arr[:, 2] -= c[1]
    for k in (hips, tg["L"], tg["R"]):
        k[:] = smooth(k, pre_smooth)
    frames = []
    for f in range(n):
        W = W_all[f]
        R, T, Q, P = rt.fk(W, hips[f])
        if ik:
            for s in "LR":
                leg_ik(rt, W, Q, P, s, tg[s][f])
            R, T, Q, P = rt.fk(W, hips[f])
        frames.append((W, hips[f].copy(), R, T, Q, P))
    info["speed"] = speed
    info["vel"] = None if vel is None else [float(vel[0]), float(vel[1])]
    return frames, info


def local_tracks(rt, frames):
    """-> {canon: (n,4) local quats (sign-continuous)}, (n,3) hips local translation."""
    rig = rt.rig
    rots = {k: [] for k in CANON}
    hipsT = []
    for (W, hp, R, T, Q, P) in frames:
        for k in CANON:
            q = np.array(R[rig.b[k]], float)
            if rots[k] and np.dot(rots[k][-1], q) < 0:
                q = -q
            rots[k].append(q)
        hipsT.append(np.array(T[rig.b["hips"]], float))
    return {k: np.array(v) for k, v in rots.items()}, np.array(hipsT)


def close_loop(rots, hipsT):
    """Bend the last frame onto the first, spread over the cycle."""
    n = len(hipsT)
    out = {}
    for k, q in rots.items():
        err = qmul(q[-1], qinv(q[0]))
        if err[3] < 0:
            err = -err
        inv = qinv(err)
        I = np.array([0, 0, 0, 1.0])
        qq = np.array([qnorm(qmul(slerp(I, inv, i / (n - 1)), q[i])) for i in range(n)])
        for i in range(1, n):
            if np.dot(qq[i - 1], qq[i]) < 0:
                qq[i] = -qq[i]
        out[k] = qq
    d = hipsT[-1] - hipsT[0]
    h = hipsT - np.outer(np.arange(n) / (n - 1), d)
    return out, h


def resample(rots, hipsT, fps_in, times):
    """Sample the tracks at `times` (s) with slerp / lerp."""
    n = len(hipsT)
    out = {k: [] for k in rots}
    hh = []
    for t in times:
        x = min(max(t * fps_in, 0), n - 1)
        i = int(np.floor(x))
        j = min(i + 1, n - 1)
        a = x - i
        for k, q in rots.items():
            out[k].append(slerp(q[i], q[j], a))
        hh.append(hipsT[i] * (1 - a) + hipsT[j] * a)
    res = {}
    for k, v in out.items():
        v = np.array(v)
        for i in range(1, len(v)):
            if np.dot(v[i - 1], v[i]) < 0:
                v[i] = -v[i]
        res[k] = v
    return res, np.array(hh)


def find_cycle(src_mo, t_from, t_to, min_len, max_len, step=1):
    """The cut [a, b] (s) inside [t_from, t_to] whose two ends look most alike
    (joint positions relative to the pelvis, and their velocities)."""
    fps = src_mo.fps
    names = ["lfemur", "ltibia", "lfoot", "rfemur", "rtibia", "rfoot", "lhumerus", "lradius", "rhumerus", "rradius", "head", "thorax"]
    F0, F1 = int(t_from * fps), min(int(t_to * fps), src_mo.n - 2)
    rel = np.stack([src_mo.P[n] - src_mo.root for n in names], axis=1)  # (n, j, 3)
    # remove yaw: express in the root's heading frame
    fw = np.einsum("nij,j->ni", src_mo.R["root"], np.array([0, 0, 1.0]))
    yaw = np.arctan2(fw[:, 0], fw[:, 2])
    c, s = np.cos(-yaw), np.sin(-yaw)
    x = rel[..., 0] * c[:, None] + rel[..., 2] * s[:, None]
    z = -rel[..., 0] * s[:, None] + rel[..., 2] * c[:, None]
    feat = np.stack([x, rel[..., 1], z], axis=-1)
    vel = np.zeros_like(feat)
    vel[1:-1] = (feat[2:] - feat[:-2]) / 2 * fps
    best = (1e9, None, None)
    for a in range(F0, F1, step):
        for L in range(int(min_len * fps), int(max_len * fps) + 1, step):
            bb = a + L
            if bb > F1:
                break
            e = np.sum((feat[a] - feat[bb]) ** 2) + 0.004 * np.sum((vel[a] - vel[bb]) ** 2)
            if e < best[0]:
                best = (e, a, bb)
    e, a, bb = best
    return a / fps, bb / fps, e
