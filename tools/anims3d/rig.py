"""The two 3D skeletons the game uses, and a small pose solver (numpy only).

  "p3"  the new 3D people (lib/star/people3d.ts): 23 joints, Mixamo-like names,
        rest pose an A-pose, Armature scaled 0.01 (centimetres).
  "ual" the old shop/garden footballer (public/star/shop3d/character.glb,
        Quaternius UBC): 65 joints, UE-like names, rest pose a T-pose.

Both face +z, their left at +x, y up, feet on y = 0.

A pose is described in the CHARACTER's own frame (metres, x = his left,
y = up, z = forward), never in either skeleton's bone frames:
  hips  {pos: [dx, dy, dz] from the rest hips, rot: (pitch, yaw, roll)}
  spine (pitch, yaw, roll) shared over the spine bones
  head  (pitch, yaw, roll) shared over neck and head
  legs  ankle target (lift above the rest ankle height), knee pole, foot pitch/yaw, toe bend
  arms  hand target (a function of the solved body, so "hand on head" works), elbow pole
Angles: pitch > 0 leans forward / looks down / points the toes down;
yaw > 0 turns to his left; roll > 0 tilts the top to his right.
The solver turns that into each skeleton's own local bone turns.
"""
import json, struct
import numpy as np


# ── quaternions [x, y, z, w] ─────────────────────────────────────────────
def qmul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return np.array([aw * bx + ax * bw + ay * bz - az * by,
                     aw * by - ax * bz + ay * bw + az * bx,
                     aw * bz + ax * by - ay * bx + az * bw,
                     aw * bw - ax * bx - ay * by - az * bz])


def qinv(q):
    return np.array([-q[0], -q[1], -q[2], q[3]])


def qrot(q, v):
    p = np.array([v[0], v[1], v[2], 0.0])
    return qmul(qmul(q, p), qinv(q))[:3]


def qaxis(axis, ang):
    axis = np.asarray(axis, float)
    n = np.linalg.norm(axis)
    if n < 1e-9 or abs(ang) < 1e-12:
        return np.array([0, 0, 0, 1.0])
    s = np.sin(ang / 2) / n
    return np.array([axis[0] * s, axis[1] * s, axis[2] * s, np.cos(ang / 2)])


def qfromto(a, b):
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    d = float(np.dot(a, b))
    if d > 0.999999:
        return np.array([0, 0, 0, 1.0])
    if d < -0.999999:
        ax = np.cross(a, [1, 0, 0])
        if np.linalg.norm(ax) < 1e-6:
            ax = np.cross(a, [0, 1, 0])
        return qaxis(ax, np.pi)
    ax = np.cross(a, b)
    q = np.array([ax[0], ax[1], ax[2], 1 + d])
    return q / np.linalg.norm(q)


def qnorm(q):
    return q / np.linalg.norm(q)


def euler(pitch=0.0, yaw=0.0, roll=0.0):
    """Character-frame turn: yaw (about y), then pitch (about x), then roll (about z)."""
    return qmul(qaxis([0, 1, 0], yaw), qmul(qaxis([1, 0, 0], pitch), qaxis([0, 0, 1], roll)))


# ── glb ──────────────────────────────────────────────────────────────────
def read_json(path):
    b = open(path, "rb").read()
    l = struct.unpack("<I", b[12:16])[0]
    return json.loads(b[20:20 + l])


CANON = ["hips", "spine1", "spine2", "spine3", "neck", "head",
         "shL", "armL", "foreL", "handL", "shR", "armR", "foreR", "handR",
         "thighL", "shinL", "footL", "toeL", "thighR", "shinR", "footR", "toeR"]

NAMES = {
    "p3": dict(hips="Hips", spine1="Spine02", spine2="Spine01", spine3="Spine", neck="neck", head="Head",
               shL="LeftShoulder", armL="LeftArm", foreL="LeftForeArm", handL="LeftHand",
               shR="RightShoulder", armR="RightArm", foreR="RightForeArm", handR="RightHand",
               thighL="LeftUpLeg", shinL="LeftLeg", footL="LeftFoot", toeL="LeftToeBase",
               thighR="RightUpLeg", shinR="RightLeg", footR="RightFoot", toeR="RightToeBase"),
    "ual": dict(hips="pelvis", spine1="spine_01", spine2="spine_02", spine3="spine_03", neck="neck_01", head="Head",
                shL="clavicle_l", armL="upperarm_l", foreL="lowerarm_l", handL="hand_l",
                shR="clavicle_r", armR="upperarm_r", foreR="lowerarm_r", handR="hand_r",
                thighL="thigh_l", shinL="calf_l", footL="foot_l", toeL="ball_l",
                thighR="thigh_r", shinR="calf_r", footR="foot_r", toeR="ball_r"),
}


class Rig:
    def __init__(self, kind, path, base_override=None):
        self.kind = kind
        j = read_json(path)
        self.json = j
        self.nodes = [n for n in j["nodes"]]
        self.parent = {}
        for i, n in enumerate(self.nodes):
            for c in n.get("children", []):
                self.parent[c] = i
        self.idx = {n["name"]: i for i, n in enumerate(self.nodes)}
        self.T = [np.array(n.get("translation", [0, 0, 0]), float) for n in self.nodes]
        self.R = [np.array(n.get("rotation", [0, 0, 0, 1]), float) for n in self.nodes]
        self.S = [float(n.get("scale", [1, 1, 1])[0]) for n in self.nodes]
        # what a bone the clips don't move is set to (UAL: the fingers from Idle_Loop)
        self.base = list(self.R)
        if base_override:
            for name, q in base_override.items():
                if name in self.idx:
                    self.base[self.idx[name]] = np.array(q, float)
        self.n = NAMES[kind]
        self.b = {k: self.idx[v] for k, v in self.n.items()}
        self.order = []
        seen = set()

        def visit(i):
            if i in seen:
                return
            if i in self.parent:
                visit(self.parent[i])
            seen.add(i)
            self.order.append(i)
        for i in range(len(self.nodes)):
            visit(i)
        # rest world
        self.restQ, self.restP, self.restS = self.fk(self.R, self.T)
        b = self.b
        P = lambda k: self.restP[b[k]]
        self.ankleY = (P("footL")[1] + P("footR")[1]) / 2
        self.hipsY = P("hips")[1]
        self.L = {}
        for s in "LR":
            self.L["thigh" + s] = np.linalg.norm(P("shin" + s) - P("thigh" + s))
            self.L["shin" + s] = np.linalg.norm(P("foot" + s) - P("shin" + s))
            self.L["arm" + s] = np.linalg.norm(P("fore" + s) - P("arm" + s))
            self.L["fore" + s] = np.linalg.norm(P("hand" + s) - P("fore" + s))
        # the child offset (bone direction, local) of each limb bone
        self.child = {}
        for s in "LR":
            for a, c in (("thigh", "shin"), ("shin", "foot"), ("arm", "fore"), ("fore", "hand")):
                self.child[a + s] = self.T[b[c + s]]

    def fk(self, R, T):
        Q, P, S = [None] * len(self.nodes), [None] * len(self.nodes), [None] * len(self.nodes)
        for i in self.order:
            if i in self.parent:
                p = self.parent[i]
                Q[i] = qnorm(qmul(Q[p], R[i]))
                P[i] = P[p] + qrot(Q[p], T[i]) * S[p]
                S[i] = S[p] * self.S[i]
            else:
                Q[i] = qnorm(R[i])
                P[i] = np.array(T[i], float)
                S[i] = self.S[i]
        return Q, P, S


class Ctx:
    """The body as solved so far: what an arm target can be relative to."""

    def __init__(self, rig, Q, P):
        self.rig, self.Q, self.P = rig, Q, P

    def pos(self, canon):
        return self.P[self.rig.b[canon]].copy()

    def delta(self, canon):
        i = self.rig.b[canon]
        return qmul(self.Q[i], qinv(self.rig.restQ[i]))

    def head_top(self, off=(0, 0, 0)):
        """A point on top of the head (+off, in the head's own turned frame)."""
        h = self.pos("head")
        return h + qrot(self.delta("head"), np.array([0, 0.19, 0.02]) + np.asarray(off, float))

    def head_at(self, off):
        return self.pos("head") + qrot(self.delta("head"), np.asarray(off, float))

    def chest(self, off=(0, 0, 0)):
        return self.pos("spine3") + qrot(self.delta("spine3"), np.asarray(off, float))

    def sh(self, side):
        return self.pos("arm" + side)

    def hip(self, off):
        return self.pos("hips") + qrot(self.delta("hips"), np.asarray(off, float))


def solve(rig, pose):
    """pose (dict, character frame) -> {bone index: local quaternion}, hips local translation, ctx."""
    b = rig.b
    R = list(rig.base)
    T = list(rig.T)
    Q = [None] * len(rig.nodes)
    P = [None] * len(rig.nodes)
    S = [None] * len(rig.nodes)
    restQ, restP = rig.restQ, rig.restP
    # every bone first: base local turns (fills in the parts nobody moves)
    Q0, P0, S0 = rig.fk(R, T)
    Q[:], P[:], S[:] = Q0, P0, S0

    def setW(canon, Wq, pos=None):
        i = b[canon]
        p = rig.parent[i]
        R[i] = qnorm(qmul(qinv(Q[p]), Wq))
        if pos is not None:
            T[i] = qrot(qinv(Q[p]), pos - P[p]) / S[p]
        refresh(i)

    def refresh(i):
        # recompute world of i and everything under it
        for j in rig.order:
            k, inside = j, False
            while True:
                if k == i:
                    inside = True
                    break
                if k not in rig.parent:
                    break
                k = rig.parent[k]
            if not inside:
                continue
            p = rig.parent[j]
            Q[j] = qnorm(qmul(Q[p], R[j]))
            P[j] = P[p] + qrot(Q[p], T[j]) * S[p]
            S[j] = S[p] * rig.S[j]

    def D(canon):
        i = b[canon]
        return qmul(Q[i], qinv(restQ[i]))

    def rel(canon, parent_canon, q):
        """World turn = parent's delta * q (character frame) * rest world."""
        i = b[canon]
        dp = D(parent_canon) if parent_canon else np.array([0, 0, 0, 1.0])
        setW(canon, qmul(dp, qmul(q, restQ[i])))

    # hips
    hp = pose.get("hips", {})
    pos = restP[b["hips"]] + np.asarray(hp.get("pos", (0, 0, 0)), float)
    if "y" in hp:
        pos[1] = hp["y"]
    i = b["hips"]
    setW("hips", qmul(euler(*hp.get("rot", (0, 0, 0))), restQ[i]), pos)
    # spine
    sp = pose.get("spine", (0, 0, 0))
    fr = (0.3, 0.35, 0.35)
    prev = "hips"
    for k, f in zip(("spine1", "spine2", "spine3"), fr):
        rel(k, prev, euler(sp[0] * f, sp[1] * f, sp[2] * f))
        prev = k
    hd = pose.get("head", (0, 0, 0))
    rel("neck", "spine3", euler(hd[0] * 0.4, hd[1] * 0.4, hd[2] * 0.4))
    rel("head", "neck", euler(hd[0] * 0.6, hd[1] * 0.6, hd[2] * 0.6))

    # legs
    for s in "LR":
        lg = pose.get("leg" + s)
        if not lg:
            rel("thigh" + s, "hips", euler())
            continue
        H = P[b["thigh" + s]]
        A = np.asarray(lg["ankle"], float) + np.array([0, rig.ankleY, 0])
        two(rig, Q, P, setW, D, "thigh" + s, "shin" + s, H, A, np.asarray(lg.get("pole", (0, 0, 1)), float), [0, 0, 1], "hips")
        f = b["foot" + s]
        setW("foot" + s, qmul(euler(lg.get("pitch", 0.0), lg.get("yaw", 0.0), lg.get("roll", 0.0)), restQ[f]))
        rel("toe" + s, "foot" + s, euler(-lg.get("toe", 0.0)))
    ctx = Ctx(rig, Q, P)
    # arms
    for s in "LR":
        rel("sh" + s, "spine3", euler(*pose.get("shrug" + s, (0, 0, 0))))
        am = pose.get("arm" + s)
        if not am:
            rel("arm" + s, "sh" + s, euler())
            continue
        S0 = P[b["arm" + s]]
        tgt = am["hand"](ctx) if callable(am["hand"]) else np.asarray(am["hand"], float)
        pole = np.asarray(am.get("pole", (0, -0.3, -1)), float)
        two(rig, Q, P, setW, D, "arm" + s, "fore" + s, S0, tgt, pole, [0, 0, -1], "sh" + s)
        h = b["hand" + s]
        hr = am.get("rot", (0, 0, 0))
        setW("hand" + s, qmul(D("fore" + s), qmul(euler(*hr), restQ[h])))
    out = {i: R[i].copy() for i in (b[k] for k in CANON)}
    return out, T[b["hips"]].copy(), Ctx(rig, Q, P)


def two(rig, Q, P, setW, D, upper, lower, H, A, pole, restref, parent):
    """Two-bone IK: put the end of `lower` at A, the middle joint bent towards `pole`."""
    b = rig.b
    L1, L2 = rig.L[upper], rig.L[lower]
    v = A - H
    d = np.linalg.norm(v)
    d = min(max(d, 0.25 * (L1 + L2)), 0.9995 * (L1 + L2))
    along = v / np.linalg.norm(v)
    a = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)
    a = max(-1, min(1, a))
    h = L1 * np.sqrt(1 - a * a)
    p = pole - along * np.dot(pole, along)
    if np.linalg.norm(p) < 1e-6:
        p = np.array([0, 0, 1.0]) - along * along[2]
    p = p / np.linalg.norm(p)
    K = H + along * (L1 * a) + p * h
    E = H + along * d
    iu, il = b[upper], b[lower]
    # upper: swing from where its parent carries it, then twist so its
    # rest "front" faces the bend
    Wc = qmul(D(parent), rig.restQ[iu])
    dc = qrot(Wc, rig.child[upper])
    W1 = qmul(qfromto(dc, K - H), Wc)
    du = (K - H) / np.linalg.norm(K - H)
    fr = qrot(qmul(W1, qinv(rig.restQ[iu])), np.asarray(restref, float))
    fr = fr - du * np.dot(fr, du)
    want = p - du * np.dot(p, du)
    if np.linalg.norm(fr) > 1e-6 and np.linalg.norm(want) > 1e-6:
        fr /= np.linalg.norm(fr)
        want /= np.linalg.norm(want)
        ang = np.arctan2(np.dot(np.cross(fr, want), du), np.dot(fr, want))
        W1 = qmul(qaxis(du, ang), W1)
    setW(upper, W1)
    Wc2 = qmul(D(upper), rig.restQ[il])
    dc2 = qrot(Wc2, rig.child[lower])
    setW(lower, qmul(qfromto(dc2, E - P[il]), Wc2))
