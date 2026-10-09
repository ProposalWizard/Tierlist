"""Every clip, as a pose (character frame) at time t. See rig.py for the frame.

Each clip: CLIPS[name] = (duration, loop, fn(rig, t) -> pose, meta)
meta marks the moments code times things to (contact, touches, where the
ball sits, where he ends up).
"""
import numpy as np
from curves import K, ease, lerp, foot
from rig import qrot, euler

PI = np.pi
SX = {"L": 1.0, "R": -1.0}


def chest(c, side, off):
    """A point off the shoulder, in the chest's own turned frame."""
    o = np.array([SX[side] * off[0], off[1], off[2]], float)
    return c.sh(side) + qrot(c.delta("spine3"), o)


def hang(side, out=0.05, down=0.47, fwd=0.03):
    return lambda c: chest(c, side, (out, -down, fwd))


def arm(hand, side, pole=None, rot=(0, 0, 0)):
    return {"hand": hand, "pole": pole if pole is not None else (SX[side] * 0.35, -0.2, -1.0), "rot": rot}


def rest_ankle(rig, side):
    p = rig.restP[rig.b["foot" + side]]
    return np.array([p[0], p[2]])


def leg(ankle, pitch=0.0, toe=0.0, side="L", pole=None, yaw=0.0):
    return {"ankle": ankle, "pitch": pitch, "toe": toe, "yaw": yaw,
            "pole": pole if pole is not None else (SX[side] * 0.12, 0, 1)}


def neutral(rig, t=0.0, dz=0.0, breathe=True):
    b = 0.006 * np.sin(2 * PI * t / 3.2) if breathe else 0.0
    out = {"hips": {"pos": (0, -0.012 + b, dz)}, "spine": (0.02 - b * 2, 0, 0), "head": (0.05, 0, 0)}
    for s in "LR":
        a = rest_ankle(rig, s)
        out["leg" + s] = leg((a[0] * 0.95, 0, a[1] + dz), side=s)
        out["arm" + s] = arm(hang(s), s)
    return out


def blend(p, q, k):
    """Mix two poses (k=0 -> p, 1 -> q). Hand targets mix as points."""
    if k <= 0:
        return p
    if k >= 1:
        return q
    out = {}
    for key in set(p) | set(q):
        a, b = p.get(key), q.get(key)
        if a is None or b is None:
            out[key] = a if b is None else b
            continue
        if isinstance(a, dict):
            d = {}
            for kk in set(a) | set(b):
                x, y = a.get(kk), b.get(kk)
                if x is None or y is None:
                    d[kk] = x if y is None else y
                elif kk == "hand":
                    fx, fy = x, y
                    d[kk] = (lambda fx, fy: lambda c: lerp(fx(c) if callable(fx) else fx, fy(c) if callable(fy) else fy, k))(fx, fy)
                else:
                    d[kk] = lerp(x, y, k)
            out[key] = d
        else:
            out[key] = lerp(a, b, k)
    return out


# ── 3D KICKING ───────────────────────────────────────────────────────────

KICK_CONTACT = 1.26
KICK_END_Z = 3.95


def kick(rig, t):
    """Right foot: three running steps, plant the left, strike, follow through,
    run on one step and stand. Starts standing at the origin, ends standing
    KICK_END_Z further on (meta "end")."""
    aL, aR = rest_ankle(rig, "L"), rest_ankle(rig, "R")
    z0 = aR[1]
    E = KICK_END_Z
    # left foot: two strides, the plant, then a step to finish alongside
    fl, pl, tl = foot(t, [(0.30, 0.56, (0.10, z0 + 1.60), 0.16),
                          (0.80, 1.05, (0.14, z0 + 3.22), 0.16),
                          (1.86, 2.10, (aL[0] * 0.95, z0 + E), 0.1)], (aL[0] * 0.95, z0))
    if t < 0.98:
        fr, pr, tr = foot(t, [(0.08, 0.34, (-0.11, z0 + 0.80), 0.16),
                              (0.56, 0.80, (-0.09, z0 + 2.40), 0.18)], (aR[0] * 0.95, z0))
    else:
        # the strike: knee drawn back, whip through the ball, follow through high, land
        keys = [(0.98, (-0.09, 0.07, z0 + 2.40)), (1.10, (-0.12, 0.40, z0 + 2.80)), (1.19, (-0.15, 0.30, z0 + 3.14)),
                (KICK_CONTACT, (-0.17, 0.10, z0 + 3.40)), (1.36, (-0.13, 0.42, z0 + 3.80)), (1.50, (-0.08, 0.86, z0 + 4.05)),
                (1.66, (-0.08, 0.50, z0 + 4.08)), (1.84, (-0.10, 0.0, z0 + E))]
        fr = K(keys, t)
        pr = K([(0.98, 0.55), (1.10, 1.15), (1.20, 1.25), (KICK_CONTACT, 1.20), (1.40, 1.0), (1.55, 0.55), (1.72, 0.1), (1.84, -0.2), (1.95, 0.0)], t)
        tr = 0.0
        fr = np.array([fr[0], max(0.0, fr[1]), fr[2]])
        if t > 1.84:
            fr = np.array([aR[0] * 0.95, 0, z0 + E])
    hz = K([(0, 0.0), (0.20, 0.42), (0.45, 1.18), (0.68, 1.98), (0.92, 2.72), (1.05, 3.04), (1.16, 3.22), (KICK_CONTACT, 3.32),
            (1.45, 3.58), (1.70, 3.82), (1.95, E - 0.02), (2.3, E)], t)
    hy = K([(0, -0.012), (0.20, -0.05), (0.33, -0.02), (0.45, -0.045), (0.56, -0.02), (0.68, -0.045), (0.80, -0.02), (0.92, -0.05),
            (1.05, -0.09), (1.16, -0.11), (KICK_CONTACT, -0.085), (1.45, -0.02), (1.65, -0.06), (1.85, -0.07), (2.05, -0.03), (2.3, -0.012)], t)
    hx = K([(0, 0), (0.21, 0.02), (0.43, -0.02), (0.68, 0.02), (0.91, -0.01), (1.05, 0.07), (KICK_CONTACT, 0.05), (1.5, 0.0), (1.9, -0.02), (2.3, 0)], t)
    # pelvis: leans into the run, swings with the strides; at the strike the
    # right hip draws back (yaw > 0) then drives through (yaw < 0)
    hyaw = K([(0, 0), (0.21, -0.10), (0.43, 0.10), (0.68, -0.10), (0.91, 0.12), (1.05, 0.22), (1.12, 0.38), (KICK_CONTACT, 0.0),
              (1.45, -0.38), (1.7, -0.15), (2.0, 0.0)], t)
    hpitch = K([(0, 0), (0.25, 0.12), (0.9, 0.12), (1.1, 0.0), (KICK_CONTACT, -0.06), (1.5, -0.1), (1.8, 0.04), (2.2, 0.0)], t)
    hroll = K([(0, 0), (0.95, 0), (1.10, -0.10), (KICK_CONTACT, -0.16), (1.5, -0.05), (1.9, 0)], t)
    spitch = K([(0, 0.02), (0.25, 0.12), (0.9, 0.12), (1.1, 0.10), (KICK_CONTACT, 0.16), (1.45, 0.02), (1.8, 0.06), (2.3, 0.02)], t)
    syaw = -0.7 * hyaw
    head = (K([(0, 0.1), (0.5, 0.3), (1.0, 0.5), (KICK_CONTACT, 0.55), (1.45, 0.15), (1.7, -0.05), (2.3, 0.05)], t), -0.4 * syaw, 0)
    pose = {"hips": {"pos": (hx, hy, hz), "rot": (hpitch, hyaw, hroll)}, "spine": (spitch, syaw, -hroll * 0.4), "head": head,
            "legL": leg(fl, pl, tl, "L"), "legR": leg(fr, pr, tr, "R", pole=(-0.15, 0.1, 1))}
    # arms: running swing, then the left flung wide for balance, the right across
    f = K([(0, 0), (0.21, -1), (0.43, 1), (0.68, -1), (0.91, 1), (1.05, 0.4)], t)
    runL = lambda c, f=f: chest(c, "L", (0.10, -0.30 + 0.07 * -f, 0.02 + 0.24 * -f))
    runR = lambda c, f=f: chest(c, "R", (0.10, -0.30 + 0.07 * f, 0.02 + 0.24 * f))
    wideL = lambda c: chest(c, "L", (0.52, -0.08, 0.18))
    acrossR = lambda c: chest(c, "R", (-0.02, -0.32, 0.30))
    w = ease((t - 0.95) / 0.2) * (1 - ease((t - 1.75) / 0.45))
    st = 1 - ease((t - 1.9) / 0.4)  # running arms -> hanging at the end
    hl = lambda c: lerp(lerp(hang("L")(c), runL(c), st), wideL(c), w)
    hr = lambda c: lerp(lerp(hang("R")(c), runR(c), st), acrossR(c), w)
    pose["armL"] = arm(hl, "L", pole=(0.4, -0.6, -0.6))
    pose["armR"] = arm(hr, "R", pole=(-0.3, -0.4, -1))
    if t >= 2.3:
        return neutral(rig, 0, E, breathe=False)
    return pose


def mirror(fn):
    """Left-footed version: the same move reflected (x -> -x, left <-> right)."""
    def g(rig, t):
        p = fn(rig, t)
        out = {}
        for k, v in p.items():
            nk = k[:-1] + {"L": "R", "R": "L"}[k[-1]] if k[-1] in "LR" and k[:-1] in ("leg", "arm", "shrug") else k
            if k == "hips":
                v = {"pos": (-v["pos"][0], v["pos"][1], v["pos"][2]), "rot": (v.get("rot", (0, 0, 0))[0], -v.get("rot", (0, 0, 0))[1], -v.get("rot", (0, 0, 0))[2])}
            elif k in ("spine", "head"):
                v = (v[0], -v[1], -v[2])
            elif k.startswith("leg"):
                v = dict(v)
                v["ankle"] = np.array([-v["ankle"][0], v["ankle"][1], v["ankle"][2]])
                v["pole"] = (-v["pole"][0], v["pole"][1], v["pole"][2])
                v["yaw"] = -v.get("yaw", 0)
            elif k.startswith("arm"):
                v = dict(v)
                h = v["hand"]
                v["hand"] = (lambda h: lambda c: _mirror_hand(c, h))(h)
                v["pole"] = (-v["pole"][0], v["pole"][1], v["pole"][2])
                r = v.get("rot", (0, 0, 0))
                v["rot"] = (r[0], -r[1], -r[2])
            out[nk] = v
        return out
    return g


class _MirrorCtx:
    """Hands a hand-target function the mirrored body, and mirrors its answer back."""
    def __init__(self, c):
        self.c = c

    def _m(self, v):
        return np.array([-v[0], v[1], v[2]])

    def _q(self, q):
        return np.array([q[0], -q[1], -q[2], q[3]])

    def pos(self, canon):
        sw = {"L": "R", "R": "L"}
        if canon[-1] in "LR" and canon not in ("head",):
            canon = canon[:-1] + sw[canon[-1]]
        return self._m(self.c.pos(canon))

    def delta(self, canon):
        sw = {"L": "R", "R": "L"}
        if canon[-1] in "LR":
            canon = canon[:-1] + sw[canon[-1]]
        return self._q(self.c.delta(canon))

    def sh(self, side):
        return self.pos("arm" + side)

    def head_top(self, off=(0, 0, 0)):
        return self._m(self.c.head_top((-off[0], off[1], off[2])))

    def head_at(self, off):
        return self._m(self.c.head_at((-off[0], off[1], off[2])))

    def chest(self, off=(0, 0, 0)):
        return self._m(self.c.chest((-off[0], off[1], off[2])))

    def hip(self, off):
        return self._m(self.c.hip((-off[0], off[1], off[2])))


def _mirror_hand(c, h):
    v = h(_MirrorCtx(c)) if callable(h) else np.asarray(h, float)
    return np.array([-v[0], v[1], v[2]])


# ── reactions ────────────────────────────────────────────────────────────

def celebrate(rig, t):
    """Arms flung up, a little jump, two right-fist pumps, back to standing."""
    p = neutral(rig, t, breathe=False)
    jump = K([(0, 0), (0.2, -0.07), (0.38, 0.09), (0.52, 0.02), (0.62, -0.06), (0.8, -0.02), (1.0, -0.05), (1.2, -0.02),
              (1.35, -0.05), (1.55, -0.02), (2.0, -0.012)], t)
    lift = K([(0, 0), (0.28, 0), (0.40, 0.10), (0.54, 0), (2, 0)], t)
    p["hips"] = {"pos": (0, jump, 0), "rot": (K([(0, 0), (0.2, 0.15), (0.4, -0.05), (0.7, 0.08), (1.6, 0.05), (2, 0)], t), 0, 0)}
    p["spine"] = (K([(0, 0.02), (0.2, 0.15), (0.45, -0.18), (0.8, 0.1), (1.0, 0.18), (1.35, 0.18), (1.7, 0.05), (2, 0.02)], t),
                  K([(0, 0), (0.8, 0), (1.0, 0.15), (1.6, 0.1), (2, 0)], t), 0)
    p["head"] = (K([(0, 0.05), (0.4, -0.35), (0.8, -0.1), (1.0, 0.1), (1.6, 0.0), (2, 0.05)], t), 0, 0)
    for s in "LR":
        a = rest_ankle(rig, s)
        p["leg" + s] = leg((a[0] * 1.15, lift, a[1]), pitch=0.5 * lift / 0.1, side=s)
    up = K([(0, 0), (0.18, 0.2), (0.38, 1), (0.7, 1), (0.85, 0.5), (1.7, 0.4), (2, 0)], t)
    upL = lambda c, k=up: lerp(hang("L")(c), chest(c, "L", (0.30, 0.62, 0.12)), k)
    # the right: an arm up, then two pumps (fist from beside the head down to the hip)
    pump = K([(0, 0), (0.85, 0), (0.95, 1), (1.12, 0), (1.27, 1), (1.45, 0), (2, 0)], t)
    pw = K([(0, 0), (0.7, 0), (0.85, 1), (1.6, 1), (1.9, 0)], t)
    upR = lambda c, k=up: lerp(hang("R")(c), chest(c, "R", (0.30, 0.62, 0.12)), k)
    pumpR = lambda c, k=pump: lerp(chest(c, "R", (0.10, 0.10, 0.22)), chest(c, "R", (0.0, -0.28, 0.22)), k)
    p["armL"] = arm(lambda c: lerp(upL(c), chest(c, "L", (0.12, -0.30, 0.18)), pw * 0.6), "L", pole=(0.5, -0.5, -0.6))
    p["armR"] = arm(lambda c: lerp(upR(c), pumpR(c), pw), "R", pole=(-0.6, -0.6, -0.5))
    return p


def frustrated(rig, t):
    """Both hands on top of the head, head back, half a step back; then drop them."""
    p = neutral(rig, t, breathe=False)
    k = K([(0, 0), (0.45, 1), (1.7, 1), (2.2, 0)], t)
    sway = 0.05 * np.sin(2 * PI * t / 1.3) * k
    back = K([(0, 0), (0.35, -0.20), (1.8, -0.20), (2.2, 0)], t)
    p["hips"] = {"pos": (0, -0.02 * k - 0.012, back * 0.45), "rot": (-0.06 * k, sway, 0)}
    p["spine"] = (-0.12 * k + 0.02, -sway, 0)
    p["head"] = (-0.42 * k + 0.05 + 0.08 * np.sin(2 * PI * t / 1.7) * k, sway * 2, 0)
    aL, aR = rest_ankle(rig, "L"), rest_ankle(rig, "R")
    p["legR"] = leg(K([(0, (aR[0], 0, aR[1])), (0.2, (aR[0], 0.08, aR[1] - 0.1)), (0.35, (aR[0], 0, aR[1] - 0.2)),
                       (1.8, (aR[0], 0, aR[1] - 0.2)), (2.0, (aR[0], 0.06, aR[1] - 0.1)), (2.2, (aR[0], 0, aR[1]))], t), side="R")
    p["legL"] = leg((aL[0] * 0.95, 0, aL[1]), side="L")
    for s in "LR":
        on = (lambda s: lambda c: c.head_top((SX[s] * 0.10, -0.01, -0.03)))(s)
        p["arm" + s] = arm((lambda s, on: lambda c: lerp(hang(s)(c), on(c), k))(s, on), s, pole=(SX[s] * 1.0, 0.1, 0.25), rot=(0, 0, 0))
    return p


JUGGLE_PERIOD = 1.2
JUGGLE_TOUCHES = [(0.30, "R"), (0.90, "L")]


def juggle(rig, t):
    """Keepy-uppies while waiting: right, left, right, left (loops)."""
    p = neutral(rig, t, breathe=False)
    t = t % JUGGLE_PERIOD
    p["hips"] = {"pos": (0.025 * np.sin(2 * PI * (t - 0.3) / 1.2), -0.04 + 0.012 * np.cos(4 * PI * t / 1.2), 0.0), "rot": (0.08, 0, 0)}
    p["spine"] = (0.16, 0.06 * np.sin(2 * PI * (t - 0.3) / 1.2), 0)
    p["head"] = (0.55 - 0.1 * np.cos(4 * PI * (t - 0.3) / 1.2), 0, 0)
    for s, tt in (("R", 0.30), ("L", 0.90)):
        a = rest_ankle(rig, s)
        st = (a[0] * 0.95, 0.0, a[1])
        top = (SX[s] * 0.07, 0.17, a[1] + 0.30)
        keys = [(tt - 0.22, st), (tt - 0.08, (SX[s] * 0.09, 0.12, a[1] + 0.2)), (tt, top), (tt + 0.1, (SX[s] * 0.08, 0.13, a[1] + 0.22)), (tt + 0.25, st)]
        ank = K(keys, t, loop=None) if keys[0][0] <= t <= keys[-1][0] else np.array(st)
        pit = K([(tt - 0.22, 0.0), (tt - 0.08, 0.25), (tt, 0.32), (tt + 0.25, 0.0)], t) if tt - 0.22 <= t <= tt + 0.25 else 0.0
        p["leg" + s] = leg(np.array([ank[0], max(0, ank[1]), ank[2]]), pitch=pit, side=s)
    for s in "LR":
        p["arm" + s] = arm((lambda s: lambda c: chest(c, s, (0.18, -0.36, 0.10)))(s), s, pole=(SX[s] * 0.6, -0.3, -0.8))
    return p


# ── training pitch ───────────────────────────────────────────────────────

PASS_CONTACT = 0.55
PASS_TRAP = 1.30


def pass_drill(rig, t):
    """Side-foot pass with the right, then trap the return under the sole. Loops."""
    p = neutral(rig, t, breathe=False)
    aL, aR = rest_ankle(rig, "L"), rest_ankle(rig, "R")
    p["hips"] = {"pos": (K([(0, 0), (0.3, 0.05), (0.7, 0.04), (1.0, 0), (1.6, 0)], t), K([(0, -0.03), (0.4, -0.07), (0.7, -0.05), (1.1, -0.04), (1.3, -0.06), (1.6, -0.03)], t), K([(0, 0), (0.3, 0.06), (0.8, 0.06), (1.1, 0.0), (1.6, 0)], t)),
                 "rot": (0.1, K([(0, 0), (0.35, 0.25), (PASS_CONTACT, -0.15), (0.8, -0.1), (1.0, 0), (1.6, 0)], t), 0)}
    p["spine"] = (0.12, K([(0, 0), (0.35, -0.15), (PASS_CONTACT, 0.1), (1.0, 0), (1.6, 0)], t), 0)
    p["head"] = (0.5, 0, 0)
    p["legL"] = leg(K([(0, (aL[0], 0, aL[1])), (0.15, (aL[0], 0.06, aL[1] + 0.08)), (0.3, (aL[0] + 0.03, 0, aL[1] + 0.14)),
                       (0.95, (aL[0] + 0.03, 0, aL[1] + 0.14)), (1.1, (aL[0], 0.05, aL[1] + 0.07)), (1.25, (aL[0], 0, aL[1])), (1.6, (aL[0], 0, aL[1]))], t), side="L")
    ankR = K([(0, (aR[0], 0, aR[1])), (0.3, (aR[0] - 0.05, 0.12, aR[1] - 0.25)), (PASS_CONTACT, (-0.02, 0.06, aR[1] + 0.22)),
              (0.72, (0.02, 0.12, aR[1] + 0.42)), (0.95, (aR[0], 0.02, aR[1] + 0.05)), (1.05, (aR[0], 0, aR[1])),
              (1.18, (aR[0] + 0.02, 0.10, aR[1] + 0.22)), (PASS_TRAP, (aR[0] + 0.03, 0.17, aR[1] + 0.30)), (1.45, (aR[0], 0.05, aR[1] + 0.1)), (1.6, (aR[0], 0, aR[1]))], t)
    yawR = K([(0, 0), (0.25, -0.9), (PASS_CONTACT, -1.25), (0.8, -0.9), (1.0, 0), (1.6, 0)], t)
    pitR = K([(0, 0), (0.3, 0.2), (PASS_CONTACT, -0.05), (0.8, 0.1), (1.0, 0), (1.15, -0.2), (PASS_TRAP, -0.55), (1.45, -0.1), (1.6, 0)], t)
    p["legR"] = leg(np.array([ankR[0], max(0, ankR[1]), ankR[2]]), pitch=pitR, yaw=yawR, side="R", pole=(-0.8, 0.1, 0.6) if t < 1.0 else (-0.12, 0, 1))
    for s in "LR":
        p["arm" + s] = arm((lambda s: lambda c: chest(c, s, (0.22, -0.38, 0.06)))(s), s, pole=(SX[s] * 0.6, -0.3, -0.8))
    return p


def stretch(rig, t):
    """Quad stretch, right then left, holding the ankle behind; the free arm out. Loops (6 s)."""
    p = neutral(rig, t, breathe=True)
    for s, t0 in (("R", 0.3), ("L", 3.3)):
        o = "L" if s == "R" else "R"
        k = K([(t0 - 0.3, 0), (t0 + 0.5, 1), (t0 + 2.2, 1), (t0 + 2.7, 0)], t) if t0 - 0.3 <= t <= t0 + 2.7 else 0.0
        if k <= 0:
            continue
        a = rest_ankle(rig, s)
        up = np.array([a[0] * 0.8, 0.0, a[1]]) * (1 - k) + np.array([SX[s] * 0.10, 0.62, a[1] - 0.30]) * k
        p["leg" + s] = leg(up, pitch=1.2 * k, side=s, pole=(SX[s] * 0.05, -1, 0.15 * (1 - k) + 0.05))
        hold = (lambda s: lambda c: c.pos("foot" + s) + np.array([SX[s] * 0.02, 0.03, -0.06]))(s)
        p["arm" + s] = arm((lambda s, hold, k: lambda c: lerp(hang(s)(c), hold(c), k))(s, hold, k), s, pole=(SX[s] * 0.3, -0.2, -1))
        p["arm" + o] = arm((lambda o, k: lambda c: lerp(hang(o)(c), chest(c, o, (0.55, 0.0, 0.10)), k))(o, k), o, pole=(SX[o] * 0.2, -1, -0.3))
        p["hips"] = {"pos": (-SX[s] * 0.05 * k, -0.012, 0), "rot": (0.05 * k, 0, SX[s] * -0.05 * k)}
        p["spine"] = (0.05 * k, 0, 0)
        p["head"] = (0.1, 0, 0)
    return p


DRIBBLE_PERIOD = 1.2
DRIBBLE_TOUCHES = [(0.25, "R"), (0.85, "L")]


def cone_dribble(rig, t):
    """Low, quick weaving touches round a cone (in place, the scene moves him). Loops."""
    p = neutral(rig, t, breathe=False)
    t = t % DRIBBLE_PERIOD
    sw = np.sin(2 * PI * t / DRIBBLE_PERIOD)
    p["hips"] = {"pos": (0.16 * sw, -0.09 + 0.02 * np.cos(8 * PI * t / DRIBBLE_PERIOD), 0.0), "rot": (0.22, 0.15 * sw, -0.08 * sw)}
    p["spine"] = (0.18, -0.1 * sw, 0.05 * sw)
    p["head"] = (0.45, 0, 0)
    for s, ph in (("L", 0.0), ("R", 0.5)):
        a = rest_ankle(rig, s)
        u = (t / DRIBBLE_PERIOD * 2 + ph) % 1.0  # two quick steps a cycle each foot
        lift = max(0.0, np.sin(2 * PI * u)) * 0.10
        x = a[0] * 1.3 + 0.16 * sw
        z = a[1] + 0.12 * np.cos(2 * PI * u)
        p["leg" + s] = leg((x, lift, z), pitch=0.3 * max(0.0, np.sin(2 * PI * u)), side=s)
    for s in "LR":
        p["arm" + s] = arm((lambda s: lambda c: chest(c, s, (0.20, -0.33, 0.14)))(s), s, pole=(SX[s] * 0.6, -0.3, -0.8))
    return p


# ── casino ───────────────────────────────────────────────────────────────

def _feet(p, rig, spread=1.0, dz=0.0):
    for s in "LR":
        a = rest_ankle(rig, s)
        p["leg" + s] = leg((a[0] * spread, 0, a[1] + dz), side=s)


def dealer_idle(rig, t):
    """Croupier behind the table: hands resting on the table edge, looking round. Loops (4 s)."""
    p = neutral(rig, t)
    p["spine"] = (0.14, 0.0, 0.0)
    p["head"] = (0.25, 0.25 * np.sin(2 * PI * t / 4.0), 0.0)
    for s in "LR":
        tap = 0.015 * max(0.0, np.sin(2 * PI * (t * 2 + (0.5 if s == "L" else 0)) / 4.0)) ** 8
        p["arm" + s] = arm((lambda s, tap: lambda c: np.array([SX[s] * 0.20, 0.97 + tap, 0.36]))(s, tap), s, pole=(SX[s] * 0.5, -0.4, -0.7), rot=(0.5, 0, 0))
    return p


def dealer_deal(rig, t):
    """Deals one card: the left hand holds the deck, the right flicks a card out. Loops (1 s)."""
    p = dealer_idle(rig, 0)
    k = K([(0, 0), (0.25, 0.15), (0.45, 1), (0.55, 1), (0.95, 0), (1.0, 0)], t)
    side = K([(0, 0), (0.45, 0.25)], t)
    p["head"] = (0.4, -0.25 * k, 0)
    p["spine"] = (0.16, -0.1 * k, 0)
    p["armL"] = arm(lambda c: np.array([0.06, 1.00, 0.36]), "L", pole=(0.6, -0.5, -0.5), rot=(0.6, 0, 0))
    p["armR"] = arm(lambda c: lerp(np.array([-0.02, 1.02, 0.37]), np.array([-0.15 - side, 0.97, 0.62]), k), "R", pole=(-0.6, -0.4, -0.6), rot=(0.4, 0, 0))
    return p


def dealer_spin(rig, t):
    """Roulette: reaches to the wheel on his right, sends it round with a sweep, back. 1.6 s."""
    p = dealer_idle(rig, 0)
    reach = K([(0, 0), (0.35, 1), (0.45, 1), (1.6, 1)], t)
    sweep = K([(0, 0), (0.45, 0), (0.65, 1), (0.9, 1), (1.4, 0.0), (1.6, 0)], t)
    back = K([(0, 0), (0.9, 0), (1.4, 1), (1.6, 1)], t)
    rest = np.array([-0.20, 0.97, 0.36])
    a = np.array([-0.48, 1.00, 0.38])
    b = np.array([-0.10, 1.03, 0.50])
    p["armR"] = arm(lambda c: lerp(lerp(lerp(rest, a, reach), b, sweep), rest, back), "R", pole=(-0.8, -0.3, -0.4), rot=(0.5, 0, 0))
    p["spine"] = (0.16, K([(0, 0), (0.4, -0.3), (0.7, 0.05), (1.4, 0), (1.6, 0)], t), 0)
    p["head"] = (0.35, K([(0, 0), (0.4, -0.45), (0.8, -0.2), (1.6, 0)], t), 0)
    return p


def lean_table(rig, t):
    """Leaning on a table on his forearms, weight shifting. Loops (4 s)."""
    p = neutral(rig, t)
    sh = 0.03 * np.sin(2 * PI * t / 4.0)
    p["hips"] = {"pos": (sh, -0.03, -0.12), "rot": (0.18, 0, -sh)}
    p["spine"] = (0.55, 0.05 * np.sin(2 * PI * t / 4.0 + 1), 0)
    p["head"] = (-0.25, 0.2 * np.sin(2 * PI * t / 4.0 + 2), 0)
    _feet(p, rig, 1.25, -0.10)
    for s in "LR":
        p["arm" + s] = arm((lambda s: lambda c: np.array([SX[s] * 0.12, 1.00, 0.52]))(s), s, pole=(SX[s] * 0.5, -1.0, 0.0), rot=(0, 0, -SX[s] * 0.5))
    return p


SEAT_Y = 0.70


def slot_sit(rig, t):
    """Sat on a stool at a slot machine, hands by the buttons. Loops (4 s)."""
    p = neutral(rig, t)
    p["hips"] = {"y": SEAT_Y, "pos": (0, 0, -0.05), "rot": (0.05, 0, 0)}
    p["spine"] = (0.12 + 0.01 * np.sin(2 * PI * t / 4.0), 0, 0)
    p["head"] = (-0.12, 0.08 * np.sin(2 * PI * t / 4.0), 0)
    for s in "LR":
        p["leg" + s] = leg((SX[s] * 0.15, 0, 0.42), side=s, pole=(SX[s] * 0.15, 0.3, 1))
        p["arm" + s] = arm((lambda s: lambda c: np.array([SX[s] * 0.16, 0.96, 0.42]))(s), s, pole=(SX[s] * 0.5, -0.6, -0.5), rot=(0.4, 0, 0))
    return p


def slot_pull(rig, t):
    """Sat at the slot machine: reaches up to the lever on his right and pulls it down. 1.4 s."""
    p = slot_sit(rig, 0)
    top = np.array([-0.40, 1.22, 0.32])
    bot = np.array([-0.40, 0.88, 0.38])
    rest = np.array([-0.16, 0.96, 0.42])
    reach = K([(0, 0), (0.35, 1), (1.4, 1)], t)
    pull = K([(0, 0), (0.42, 0), (0.75, 1), (1.4, 1)], t)
    back = K([(0, 0), (0.95, 0), (1.35, 1), (1.4, 1)], t)
    p["armR"] = arm(lambda c: lerp(lerp(lerp(rest, top, reach), bot, pull), rest, back), "R", pole=(-0.7, -0.6, -0.3), rot=(0, 0, 0.6))
    p["spine"] = (0.12, K([(0, 0), (0.35, -0.12), (0.8, -0.05), (1.4, 0)], t), K([(0, 0), (0.35, 0.12), (0.8, 0.05), (1.4, 0)], t))
    p["head"] = (-0.12, 0, 0)
    return p


def cheer_win(rig, t):
    """A win: fists up and pumping, bouncing. Loops (1.2 s)."""
    p = neutral(rig, t, breathe=False)
    b = np.sin(2 * PI * t / 0.6)
    p["hips"] = {"pos": (0, -0.04 + 0.035 * b, 0), "rot": (-0.05, 0.08 * np.sin(2 * PI * t / 1.2), 0)}
    p["spine"] = (-0.12, -0.1 * np.sin(2 * PI * t / 1.2), 0)
    p["head"] = (-0.25, 0, 0)
    for s in "LR":
        ph = 0 if s == "L" else PI
        p["arm" + s] = arm((lambda s, ph: lambda c: chest(c, s, (0.18, 0.40 + 0.12 * np.sin(2 * PI * t / 0.6 + ph), 0.12)))(s, ph), s, pole=(SX[s] * 0.8, -0.4, -0.3))
    return p


def groan_loss(rig, t):
    """A loss: a hand to the forehead, the other on the hip, slumped. 2.4 s, back to standing."""
    p = neutral(rig, t)
    k = K([(0, 0), (0.45, 1), (1.9, 1), (2.4, 0)], t)
    p["hips"] = {"pos": (0, -0.012 - 0.02 * k, -0.08 * k), "rot": (0.04 * k, 0.1 * k, 0)}
    p["spine"] = (0.02 + 0.32 * k, -0.08 * k, 0.05 * k)
    p["head"] = (0.05 + 0.4 * k + 0.05 * np.sin(2 * PI * t / 1.1) * k, 0.1 * np.sin(2 * PI * t / 1.6) * k, 0)
    p["armR"] = arm(lambda c: lerp(hang("R")(c), c.head_at((-0.04, 0.09, 0.17)), k), "R", pole=(-1.0, -0.3, 0.1), rot=(0, 0, 0))
    p["armL"] = arm(lambda c: lerp(hang("L")(c), c.hip((0.22, 0.06, -0.04)), k), "L", pole=(0.6, 0.0, -0.8))
    return p


def bartender_idle(rig, t):
    """Behind the bar, wiping it down in circles. Loops (4 s)."""
    p = neutral(rig, t)
    a = 2 * PI * t / 2.0
    p["spine"] = (0.22, 0.06 * np.sin(a), 0)
    p["head"] = (K([(0, 0.35), (1.6, 0.35), (2.2, -0.05), (3.2, -0.05), (4.0, 0.35)], t, loop=4.0), 0.1 * np.sin(2 * PI * t / 4), 0)
    p["armR"] = arm(lambda c: np.array([-0.14 + 0.10 * np.cos(a), 1.02, 0.44 + 0.07 * np.sin(a)]), "R", pole=(-0.6, -0.5, -0.5), rot=(0.6, 0, 0))
    p["armL"] = arm(lambda c: np.array([0.22, 1.02, 0.38]), "L", pole=(0.6, -0.5, -0.5), rot=(0.6, 0, 0))
    return p


# ── 3D TRAINING DRILLS (play3d: Headers & Volleys, Wembley, Two Touch, Free Roam) ──
#
# Everything here is in place (the game moves him), except where a clip says
# otherwise. The moment the ball is met is `contact` (s) and `part` says what
# meets it; build.py measures that part on the solved body and writes the
# point as `contactPoint` [x, y, z] (his frame, metres, from his feet).

def body_at(rig, off, rot, local):
    """A point fixed to the hips (local = his rest frame, from the hips joint), with the hips moved/turned."""
    h = rig.restP[rig.b["hips"]] + np.asarray(off, float)
    return h + qrot(euler(*rot), np.asarray(local, float))


def leg_dir(rig, side, off, rot, d, k=0.96):
    """Ankle target for a leg pointing along `d` (in the hips' own turned frame), k of its full length."""
    b = rig.b
    hj = rig.restP[b["thigh" + side]] - rig.restP[b["hips"]]
    d = np.asarray(d, float)
    d = d / np.linalg.norm(d)
    L = rig.L["thigh" + side] + rig.L["shin" + side]
    a = body_at(rig, off, rot, hj + d * L * k)
    return np.array([a[0], a[1] - rig.ankleY, a[2]])


def in_place_leg(u, front, back, stance, lift, swing_lift_back=0.6):
    """One leg of an in-place run or walk. u = 0..1 through the stride; the foot is
    down for the first `stance` of it, sliding from `front` to -`back` (z), then
    swings up (heel first, `lift` high) and through to land at `front` again.
    Returns (y, z, pitch)."""
    u = u % 1.0
    if u < stance:
        k = u / stance
        return 0.0, front + (-back - front) * k, K([(0, -0.2), (0.2, 0.0), (0.75, 0.05), (1.0, 0.55)], k)
    k = (u - stance) / (1 - stance)
    z = K([(0, -back), (0.3, -back * 0.75), (0.7, front * 0.7), (1, front)], k)
    y = K([(0, 0.02), (0.3, lift * swing_lift_back + 0.06), (0.55, lift), (0.85, lift * 0.35), (1, 0.0)], k)
    pitch = K([(0, 0.6), (0.3, 0.45), (0.7, -0.1), (1, -0.2)], k)
    return float(y), float(z), float(pitch)


def runner(rig, t, P, stance, front, back, lift, lean, bob, swing, arm_raise=0.0, yawk=0.12, head=0.1, low=0.0, elbow=0.0):
    """A whole in-place running/walking body: legs, bob, hips swing, arms swinging opposite."""
    u = (t / P) % 1.0
    out = {}
    for s, ph in (("R", 0.0), ("L", 0.5)):
        y, z, pit = in_place_leg(u + ph, front, back, stance, lift)
        a = rest_ankle(rig, s)
        out["leg" + s] = leg((a[0] * 0.85, y, z), pitch=pit, side=s)
    # lowest at the middle of each foot's time down
    hy = -0.02 - low - bob * 0.5 + bob * 0.5 * np.cos(4 * PI * (u - stance / 2))
    hyaw = yawk * np.cos(2 * PI * u)
    out["hips"] = {"pos": (0.012 * np.cos(2 * PI * u), hy, 0.0), "rot": (lean, hyaw, 0.0)}
    out["spine"] = (lean * 0.6, -0.8 * hyaw, 0)
    out["head"] = (head - lean * 0.4, 0.4 * hyaw, 0)
    sw = np.cos(2 * PI * u)  # +1: right leg forward -> right arm back, left arm forward
    for s, k in (("R", -sw), ("L", sw)):
        out["arm" + s] = arm((lambda s, k: lambda c: chest(c, s, (0.10, -0.30 + elbow + arm_raise + 0.08 * max(0, k) * swing, 0.03 + 0.26 * k * swing)))(s, k),
                             s, pole=(SX[s] * 0.3, -0.4, -1))
    return out


# -- running ------------------------------------------------------------

SPRINT_PERIOD = 0.62
SPRINT_SPEED = 7.4


def sprint(rig, t):
    """A real sprint: forward lean, knees high, heels up under him, big arm drive. Loops (in place)."""
    p = runner(rig, t, SPRINT_PERIOD, 0.27, 0.42, 0.62, 0.42, lean=0.24, bob=0.05, swing=1.25, yawk=0.16, head=0.05, low=0.03, elbow=0.05)
    # fists drive higher in front (sprinters' arms come up to the chin)
    u = (t / SPRINT_PERIOD) % 1.0
    sw = np.cos(2 * PI * u)
    for s, k in (("R", -sw), ("L", sw)):
        p["arm" + s] = arm((lambda s, k: lambda c: chest(c, s, (0.07, -0.30 + 0.20 * max(0, k), 0.05 + 0.36 * k)))(s, k), s, pole=(SX[s] * 0.2, -0.3, -1))
    return p


DRIB_PERIOD = 0.70
DRIB_SPEED = 4.6
DRIB_TOUCH = 0.60  # right foot nudges the ball on, every stride


def dribble_run(rig, t):
    """Running with the ball: shorter, quicker strides, hunched over it, eyes down;
    every stride the right foot pushes it on with the laces (`touches`). Loops (in place)."""
    p = runner(rig, t, DRIB_PERIOD, 0.36, 0.30, 0.36, 0.20, lean=0.22, bob=0.03, swing=0.8, yawk=0.10, head=0.35, low=0.05)
    # the touch: the right foot reaches a little further forward and low, toes down
    tt = t % DRIB_PERIOD
    k = max(0.0, 1 - abs(tt - DRIB_TOUCH) / 0.12)
    if k > 0:
        lg = p["legR"]
        an = np.array(lg["ankle"], float)
        an = an + np.array([0.04 * k, -an[1] * 0.6 * k + 0.02 * k, 0.16 * k])
        p["legR"] = leg(an, pitch=lg["pitch"] * (1 - k) + 0.7 * k, side="R")
    return p


# -- headers -------------------------------------------------------------

HEAD_CONTACT = 0.50


def header_stand(rig, t):
    """Standing header: dip, spring up off both feet, arch back, then snap the neck and
    chest through the ball at the top of the jump (`contact`), land, stand. 1.1 s."""
    p = neutral(rig, t, breathe=False)
    hy = K([(0, -0.012), (0.18, -0.16), (0.30, -0.10), (0.40, 0.16), (HEAD_CONTACT, 0.26), (0.62, 0.14), (0.72, -0.14), (0.85, -0.06), (1.1, -0.012)], t)
    arch = K([(0, 0.02), (0.18, 0.18), (0.36, -0.30), (0.44, -0.38), (HEAD_CONTACT, 0.22), (0.62, 0.30), (0.74, 0.20), (1.1, 0.02)], t)
    nod = K([(0, 0.05), (0.30, -0.30), (0.44, -0.45), (HEAD_CONTACT, 0.35), (0.6, 0.45), (0.8, 0.15), (1.1, 0.05)], t)
    p["hips"] = {"pos": (0, hy, K([(0, 0), (0.4, 0.05), (0.7, 0.10), (1.1, 0.1)], t)), "rot": (K([(0, 0), (0.18, 0.25), (0.36, -0.08), (HEAD_CONTACT, 0.10), (0.72, 0.2), (1.1, 0)], t), 0, 0)}
    p["spine"] = (arch, 0, 0)
    p["head"] = (nod, 0, 0)
    air = K([(0, 0), (0.32, 0), (0.42, 1), (0.62, 1), (0.72, 0)], t)
    tuck = K([(0, 0), (0.36, 0), (0.46, 0.25), (0.6, 0.15), (0.7, 0)], t)
    for s in "LR":
        a = rest_ankle(rig, s)
        z = a[1] + K([(0, 0), (0.7, 0.1), (1.1, 0.1)], t)
        p["leg" + s] = leg((a[0] * 1.05, max(0.0, hy * air * 0.9 + tuck * 0.5 + 0.26 * air), z), pitch=0.6 * air, side=s)
    # arms: swung back on the dip, up and out for lift, pulled down hard as the head snaps
    back = K([(0, 0), (0.18, 1), (0.3, 0.6), (0.42, 0), (1.1, 0)], t)
    up = K([(0, 0), (0.28, 0), (0.42, 1), (HEAD_CONTACT - 0.02, 1), (0.62, 0.2), (0.9, 0), (1.1, 0)], t)
    for s in "LR":
        bk = (lambda s: lambda c: chest(c, s, (0.12, -0.40, -0.25)))(s)
        hi = (lambda s: lambda c: chest(c, s, (0.30, 0.15, 0.30)))(s)
        p["arm" + s] = arm((lambda s, bk, hi, back=back, up=up: lambda c: lerp(lerp(hang(s)(c), bk(c), back), hi(c), up))(s, bk, hi), s, pole=(SX[s] * 0.6, -0.4, -0.8))
    return p


DIVE_HEAD_CONTACT = 0.40


def header_diving(rig, t):
    """Diving header: one hard step, launch flat out forward, head through the ball
    about chest-high (`contact`), land on the chest with the hands, lie a beat. 1.3 s.
    The body travels ~0.8 m forward of where he took off."""
    pit = K([(0, 0.15), (0.14, 0.35), (0.28, 1.15), (DIVE_HEAD_CONTACT, 1.35), (0.62, 1.45), (0.75, 1.5), (1.3, 1.5)], t)
    hy = K([(0, -0.05), (0.14, -0.14), (0.26, -0.06), (DIVE_HEAD_CONTACT, -0.10), (0.55, -0.45), (0.68, -0.80), (1.3, -0.82)], t)
    hz = K([(0, 0), (0.14, 0.15), (DIVE_HEAD_CONTACT, 0.55), (0.68, 0.80), (1.3, 0.82)], t)
    off, rot = (0, hy, hz), (pit, 0, 0)
    p = {"hips": {"pos": off, "rot": rot}}
    p["spine"] = (K([(0, 0.15), (0.3, -0.25), (DIVE_HEAD_CONTACT, -0.35), (0.7, -0.15), (1.3, -0.1)], t), 0, 0)
    p["head"] = (K([(0, 0.2), (0.28, -0.85), (DIVE_HEAD_CONTACT, -0.55), (0.55, -0.95), (0.75, -0.6), (1.3, -0.7)], t), 0, 0)
    # legs: the push-off leg (left) drives, then both trail straight behind, landing on the thighs
    aL, aR = rest_ankle(rig, "L"), rest_ankle(rig, "R")
    if t < 0.24:
        k = ease(t / 0.24)
        p["legL"] = leg((aL[0], 0.0, aL[1] + 0.25 * k), pitch=0.6 * k, side="L")
        p["legR"] = leg((aR[0], 0.15 * k, aR[1] + 0.35 * k), pitch=0.3 * k, side="R")
    else:
        k = ease((t - 0.24) / 0.2)
        for s, spread in (("L", 0.12), ("R", -0.10)):
            trail = leg_dir(rig, s, off, rot, (spread, -1, -0.12 * (1 - k)), 0.97)
            st = np.array([rest_ankle(rig, s)[0], 0.0, rest_ankle(rig, s)[1] + 0.3])
            a = lerp(st, trail, k)
            a[1] = max(0.0, a[1])
            p["leg" + s] = leg(a, pitch=0.9 * k, side=s, pole=(SX[s] * 0.1, -1, 0))
    # arms: back for the launch, out wide in the air, then forward to land on
    for s in "LR":
        wide = (lambda s: lambda c: chest(c, s, (0.40, 0.05, 0.10)))(s)
        land = (lambda s: lambda c: chest(c, s, (0.12, 0.45, 0.25)))(s)
        bk = (lambda s: lambda c: chest(c, s, (0.10, -0.38, -0.25)))(s)
        a1 = K([(0, 0), (0.14, 1), (0.30, 0), (1.3, 0)], t)
        a2 = K([(0, 0), (0.25, 1), (0.45, 1), (0.6, 0), (1.3, 0)], t)
        a3 = K([(0, 0), (0.45, 0), (0.62, 1), (1.3, 1)], t)
        p["arm" + s] = arm((lambda s, wide, land, bk, a1=a1, a2=a2, a3=a3: lambda c: lerp(lerp(lerp(lerp(hang(s)(c), bk(c), a1), wide(c), a2), land(c), a3), land(c), 0))(s, wide, land, bk), s, pole=(SX[s] * 0.8, -0.3, -0.4))
    return p


# -- volleys ---------------------------------------------------------------

VOLLEY_CONTACT = 0.45


def volley(rig, t):
    """Side-on volley with the right: plant the left, lean away, the right leg swings
    round at hip height and through the ball (`contact`), follow through across, land. 1.15 s."""
    p = neutral(rig, t, breathe=False)
    aL, aR = rest_ankle(rig, "L"), rest_ankle(rig, "R")
    roll = K([(0, 0), (0.2, -0.20), (VOLLEY_CONTACT, -0.62), (0.6, -0.45), (0.85, -0.1), (1.15, 0)], t)
    yaw = K([(0, 0), (0.22, 0.55), (0.36, 0.45), (VOLLEY_CONTACT, -0.05), (0.62, -0.55), (0.9, -0.2), (1.15, 0)], t)
    hy = K([(0, -0.012), (0.2, -0.08), (VOLLEY_CONTACT, -0.06), (0.7, -0.10), (0.9, -0.05), (1.15, -0.012)], t)
    hx = K([(0, 0), (0.2, 0.06), (VOLLEY_CONTACT, 0.16), (0.7, 0.10), (1.15, 0)], t)
    p["hips"] = {"pos": (hx, hy, 0.0), "rot": (0.05, yaw, roll)}
    p["spine"] = (0.08, -0.4 * yaw, roll * 0.5)
    p["head"] = (0.35, K([(0, 0), (0.3, -0.4), (VOLLEY_CONTACT, -0.1), (0.7, 0.2), (1.15, 0)], t), -roll * 0.6)
    p["legL"] = leg(K([(0, (aL[0], 0, aL[1])), (0.1, (aL[0] + 0.05, 0.08, aL[1] + 0.12)), (0.2, (aL[0] + 0.10, 0, aL[1] + 0.22)),
                       (0.85, (aL[0] + 0.10, 0, aL[1] + 0.22)), (0.98, (aL[0], 0.06, aL[1] + 0.12)), (1.15, (aL[0], 0, aL[1]))], t),
                    pitch=0, yaw=K([(0, 0), (0.2, 0.4), (0.9, 0.4), (1.15, 0)], t), side="L", pole=(0.6, 0, 1))
    ank = K([(0, (aR[0], 0.0, aR[1])), (0.18, (-0.30, 0.18, -0.35)), (0.32, (-0.62, 0.55, -0.05)),
             (VOLLEY_CONTACT, (-0.30, 0.74, 0.50)), (0.58, (0.08, 0.66, 0.62)), (0.72, (0.16, 0.30, 0.45)),
             (0.90, (aR[0] * 0.6, 0.06, 0.18)), (1.15, (aR[0], 0.0, aR[1]))], t)
    p["legR"] = leg(np.array([ank[0], max(0.0, ank[1]), ank[2]]), pitch=K([(0, 0), (0.3, 0.6), (VOLLEY_CONTACT, 0.85), (0.7, 0.4), (1.0, 0)], t),
                    yaw=K([(0, 0), (0.3, -0.3), (VOLLEY_CONTACT, -0.5), (0.7, -0.2), (1.0, 0)], t), side="R", pole=(-1.0, 0.25, 0.4))
    # left arm flung wide and high for balance, right across the body
    w = K([(0, 0), (0.2, 0.7), (VOLLEY_CONTACT, 1), (0.75, 0.8), (1.15, 0)], t)
    p["armL"] = arm(lambda c: lerp(hang("L")(c), chest(c, "L", (0.58, 0.12, 0.10)), w), "L", pole=(0.4, -0.8, -0.4))
    p["armR"] = arm(lambda c: lerp(hang("R")(c), chest(c, "R", (0.10, -0.20, 0.35)), w), "R", pole=(-0.4, -0.5, -1))
    return p


# -- first touches --------------------------------------------------------

TOUCH_CONTACT = 0.32


def first_touch(rig, t):
    """Cushion it with the right foot: the foot comes up to meet the ball, and gives
    with it back under him (`contact`), it drops dead. 0.85 s."""
    p = neutral(rig, t, breathe=False)
    aR = rest_ankle(rig, "R")
    p["hips"] = {"pos": (0.03, K([(0, -0.03), (0.2, -0.07), (0.5, -0.06), (0.85, -0.03)], t), 0), "rot": (0.12, 0.05, 0.04)}
    p["spine"] = (0.18, 0, 0)
    p["head"] = (0.6, 0, 0)
    ank = K([(0, (aR[0], 0, aR[1])), (0.18, (-0.12, 0.16, aR[1] + 0.38)), (TOUCH_CONTACT, (-0.11, 0.12, aR[1] + 0.32)),
             (0.48, (-0.12, 0.05, aR[1] + 0.12)), (0.62, (aR[0], 0.02, aR[1] + 0.04)), (0.85, (aR[0], 0, aR[1]))], t)
    p["legR"] = leg(ank, pitch=K([(0, 0), (0.18, -0.25), (TOUCH_CONTACT, -0.30), (0.55, -0.05), (0.85, 0)], t),
                    yaw=K([(0, 0), (0.18, -0.55), (0.5, -0.5), (0.85, 0)], t), side="R", pole=(-0.6, 0.1, 0.8))
    for s in "LR":
        p["arm" + s] = arm((lambda s: lambda c: chest(c, s, (0.20, -0.42, 0.10)))(s), s, pole=(SX[s] * 0.5, -0.5, -0.7))
    return p


CHEST_CONTACT = 0.38


def chest_control(rig, t):
    """Chest it down: lean back, chest out, arms wide; the chest gives as it lands
    (`contact`), then he folds forward to drop it at his feet. 1.0 s."""
    p = neutral(rig, t, breathe=False)
    back = K([(0, 0), (0.25, 1), (CHEST_CONTACT, 1), (0.5, 1.15), (0.7, 0.2), (1.0, 0)], t)
    give = K([(0, 0), (CHEST_CONTACT, 0), (0.48, 1), (0.7, 0), (1.0, 0)], t)
    p["hips"] = {"pos": (0, -0.02 - 0.06 * back, 0.07 * back), "rot": (-0.08 * back, 0, 0)}
    p["spine"] = (0.02 - 0.58 * back + 0.35 * give, 0, 0)
    p["head"] = (0.05 + 0.25 * back + K([(0, 0), (0.6, 0), (0.8, 0.5), (1.0, 0.1)], t), 0, 0)
    for s in "LR":
        a = rest_ankle(rig, s)
        p["leg" + s] = leg((a[0] * 1.05, 0, a[1] + (0.06 if s == "L" else -0.05)), side=s)
        wide = (lambda s: lambda c: chest(c, s, (0.48, -0.12, 0.02)))(s)
        p["arm" + s] = arm((lambda s, wide, k=back: lambda c: lerp(hang(s)(c), wide(c), min(1, k)))(s, wide), s, pole=(SX[s] * 0.4, -0.6, -0.7))
    return p


THIGH_CONTACT = 0.30


def thigh_control(rig, t):
    """Take it on the thigh: the right knee comes up to meet it (`contact`), the thigh
    drops with the ball to kill it, foot back down. 0.9 s."""
    p = neutral(rig, t, breathe=False)
    aR = rest_ankle(rig, "R")
    p["hips"] = {"pos": (0.04, K([(0, -0.02), (0.2, -0.05), (0.6, -0.04), (0.9, -0.02)], t), 0), "rot": (K([(0, 0), (0.2, -0.05), (THIGH_CONTACT, -0.08), (0.5, 0.05), (0.9, 0)], t), 0, 0.05)}
    p["spine"] = (K([(0, 0.02), (THIGH_CONTACT, -0.05), (0.5, 0.15), (0.9, 0.05)], t), 0, 0)
    p["head"] = (0.55, 0, 0)
    ank = K([(0, (aR[0], 0, aR[1])), (0.2, (aR[0] + 0.03, 0.38, aR[1] + 0.12)), (THIGH_CONTACT, (aR[0] + 0.03, 0.40, aR[1] + 0.10)),
             (0.48, (aR[0], 0.18, aR[1] + 0.08)), (0.65, (aR[0], 0.02, aR[1] + 0.03)), (0.9, (aR[0], 0, aR[1]))], t)
    p["legR"] = leg(ank, pitch=K([(0, 0), (0.2, 0.3), (0.5, 0.15), (0.9, 0)], t), side="R")
    for s in "LR":
        p["arm" + s] = arm((lambda s: lambda c: chest(c, s, (0.20, -0.42, 0.10)))(s), s, pole=(SX[s] * 0.5, -0.5, -0.7))
    return p


# -- passes ---------------------------------------------------------------

LOFT_CONTACT = 0.50


def pass_lofted(rig, t):
    """Lofted pass with the right: a step in, plant the left beside it, lean back and
    get the laces under the ball (`contact`), follow through high. 1.15 s."""
    p = neutral(rig, t, breathe=False)
    aL, aR = rest_ankle(rig, "L"), rest_ankle(rig, "R")
    lean = K([(0, 0), (0.3, 0.1), (LOFT_CONTACT, -0.22), (0.72, -0.28), (1.0, -0.05), (1.15, 0)], t)
    p["hips"] = {"pos": (K([(0, 0), (0.35, 0.06), (0.8, 0.04), (1.15, 0)], t), K([(0, -0.02), (0.36, -0.10), (LOFT_CONTACT, -0.07), (0.75, -0.04), (1.15, -0.012)], t), K([(0, 0), (0.36, 0.12), (0.8, 0.22), (1.15, 0.22)], t)),
                 "rot": (lean * 0.5, K([(0, 0), (0.32, 0.30), (LOFT_CONTACT, 0.0), (0.75, -0.25), (1.15, 0)], t), K([(0, 0), (0.35, -0.1), (LOFT_CONTACT, -0.12), (0.8, -0.05), (1.15, 0)], t))}
    p["spine"] = (lean, K([(0, 0), (0.32, -0.2), (LOFT_CONTACT, 0.05), (0.75, 0.15), (1.15, 0)], t), 0)
    p["head"] = (K([(0, 0.3), (LOFT_CONTACT, 0.55), (0.75, 0.1), (1.15, 0.05)], t), 0, 0)
    p["legL"] = leg(K([(0, (aL[0], 0, aL[1])), (0.18, (aL[0], 0.10, aL[1] + 0.12)), (0.34, (aL[0] + 0.02, 0, aL[1] + 0.26)),
                       (0.9, (aL[0] + 0.02, 0, aL[1] + 0.26)), (1.15, (aL[0] + 0.02, 0, aL[1] + 0.26))], t), side="L")
    ank = K([(0, (aR[0], 0, aR[1])), (0.30, (aR[0] + 0.02, 0.32, aR[1] - 0.30)), (0.42, (-0.10, 0.12, aR[1] + 0.08)),
             (LOFT_CONTACT, (-0.06, 0.02, aR[1] + 0.34)), (0.62, (-0.03, 0.40, aR[1] + 0.62)), (0.75, (-0.03, 0.72, aR[1] + 0.68)),
             (0.92, (aR[0], 0.25, aR[1] + 0.45)), (1.05, (aR[0], 0.0, aR[1] + 0.30)), (1.15, (aR[0], 0, aR[1] + 0.30))], t)
    p["legR"] = leg(np.array([ank[0], max(0.0, ank[1]), ank[2]]), pitch=K([(0, 0), (0.3, 0.7), (LOFT_CONTACT, 0.75), (0.75, 0.6), (1.05, 0)], t),
                    yaw=K([(0, 0), (LOFT_CONTACT, -0.15), (1.0, 0)], t), side="R", pole=(-0.15, 0.1, 1))
    w = K([(0, 0), (0.35, 1), (0.8, 1), (1.15, 0.2)], t)
    p["armL"] = arm(lambda c: lerp(hang("L")(c), chest(c, "L", (0.50, -0.05, 0.20)), w), "L", pole=(0.4, -0.6, -0.6))
    p["armR"] = arm(lambda c: lerp(hang("R")(c), chest(c, "R", (0.30, -0.25, -0.10)), w), "R", pole=(-0.3, -0.4, -1))
    return p


# -- shooting from where he stands ---------------------------------------

SHOT_FROM = 0.95
SHOT_SHIFT = 3.0  # the kick's ball spot (3.45) less 0.45: the ball sits where the game keeps it, 0.45 m ahead


def shot_r(rig, t):
    """The kick's plant-and-strike without the run-up, in place (the game moves him):
    last stride in, plant, strike (`contact` 0.31), follow through, stand. 1.35 s."""
    p = kick(rig, t + SHOT_FROM)
    out = dict(p)
    hp = dict(p["hips"])
    pos = hp.get("pos", (0, 0, 0))
    hp["pos"] = (pos[0], pos[1], pos[2] - SHOT_SHIFT)
    out["hips"] = hp
    for s in "LR":
        lg = dict(p["leg" + s])
        a = np.array(lg["ankle"], float)
        lg["ankle"] = np.array([a[0], a[1], a[2] - SHOT_SHIFT])
        out["leg" + s] = lg
    return out


# -- tackles ------------------------------------------------------------

POKE_CONTACT = 0.26


def poke_tackle(rig, t):
    """A poke: lunge in off the left, stab the right toe at the ball (`contact`), recover. 0.75 s."""
    p = neutral(rig, t, breathe=False)
    aL, aR = rest_ankle(rig, "L"), rest_ankle(rig, "R")
    p["hips"] = {"pos": (0.02, K([(0, -0.03), (0.15, -0.14), (POKE_CONTACT, -0.20), (0.45, -0.16), (0.75, -0.04)], t), K([(0, 0), (POKE_CONTACT, 0.18), (0.75, 0.12)], t)),
                 "rot": (K([(0, 0.05), (POKE_CONTACT, 0.18), (0.75, 0.05)], t), 0.15, 0.05)}
    p["spine"] = (K([(0, 0.1), (POKE_CONTACT, 0.28), (0.75, 0.1)], t), -0.1, 0)
    p["head"] = (0.45, 0, 0)
    p["legL"] = leg(K([(0, (aL[0], 0, aL[1])), (0.1, (aL[0], 0.06, aL[1] + 0.15)), (0.18, (aL[0], 0, aL[1] + 0.30)), (0.75, (aL[0], 0, aL[1] + 0.30))], t), side="L")
    ank = K([(0, (aR[0], 0, aR[1])), (0.14, (-0.14, 0.10, aR[1] + 0.25)), (POKE_CONTACT, (-0.12, 0.04, aR[1] + 0.92)),
             (0.42, (-0.13, 0.05, aR[1] + 0.70)), (0.6, (-0.14, 0.02, aR[1] + 0.40)), (0.75, (aR[0], 0, aR[1] + 0.22))], t)
    p["legR"] = leg(ank, pitch=K([(0, 0), (0.14, 0.4), (POKE_CONTACT, 0.7), (0.5, 0.2), (0.75, 0)], t), side="R")
    for s in "LR":
        p["arm" + s] = arm((lambda s: lambda c: chest(c, s, (0.20, -0.42, 0.10)))(s), s, pole=(SX[s] * 0.5, -0.5, -0.7))
    return p


SLIDE_CONTACT = 0.40


def sliding_tackle(rig, t):
    """Sliding tackle: down on the left hip, the right leg out straight along the grass
    into the ball (`contact`), slide ~0.9 m, then get up. 1.5 s."""
    roll = K([(0, 0), (0.12, -0.15), (0.26, -0.55), (SLIDE_CONTACT, -0.70), (0.75, -0.70), (1.0, -0.45), (1.25, -0.1), (1.5, 0)], t)
    pit = K([(0, 0.15), (0.14, 0.1), (0.28, -0.75), (SLIDE_CONTACT, -0.85), (0.75, -0.8), (1.0, -0.2), (1.25, 0.25), (1.5, 0)], t)
    hy = K([(0, -0.03), (0.14, -0.15), (0.28, -0.66), (SLIDE_CONTACT, -0.76), (0.8, -0.78), (1.0, -0.55), (1.25, -0.18), (1.5, -0.012)], t)
    hz = K([(0, 0), (0.14, 0.25), (SLIDE_CONTACT, 0.75), (0.8, 0.95), (1.5, 0.95)], t)
    hx = K([(0, 0), (0.3, 0.12), (0.9, 0.12), (1.5, 0)], t)
    off, rot = (hx, hy, hz), (pit, 0.1, roll)
    p = {"hips": {"pos": off, "rot": rot}}
    p["spine"] = (K([(0, 0.15), (0.3, 0.45), (SLIDE_CONTACT, 0.5), (0.8, 0.45), (1.25, 0.25), (1.5, 0.02)], t), 0, -roll * 0.4)
    p["head"] = (K([(0, 0.3), (0.3, 0.45), (0.8, 0.5), (1.5, 0.05)], t), 0, -roll * 0.5)
    down = K([(0, 0), (0.24, 0), (0.32, 1), (0.95, 1), (1.2, 0), (1.5, 0)], t)
    aL, aR = rest_ankle(rig, "L"), rest_ankle(rig, "R")
    # right: out straight along the grass; left: folded under
    b = rig.b
    hR = body_at(rig, off, rot, rig.restP[b["thighR"]] - rig.restP[b["hips"]])
    hL = body_at(rig, off, rot, rig.restP[b["thighL"]] - rig.restP[b["hips"]])
    Lr = (rig.L["thighR"] + rig.L["shinR"]) * 0.97
    drop = max(0.0, hR[1] - rig.ankleY)
    rs = np.array([hR[0] - 0.04, 0.0, hR[2] + np.sqrt(max(0.01, Lr * Lr - drop * drop))])
    ls = np.array([hL[0] + 0.12, 0.0, hL[2] - 0.05])
    stR = np.array([aR[0], 0.0, aR[1] + hz])
    stL = np.array([aL[0], 0.0, aL[1] + hz])
    if t < 0.24:
        k = ease(t / 0.24)
        stR = np.array([aR[0], 0.18 * np.sin(PI * k), aR[1] + 0.5 * k])
        stL = np.array([aL[0], 0.0, aL[1] + 0.1 * k])
    p["legR"] = leg(lerp(stR, rs, down), pitch=0.7 * down, side="R", pole=(-0.12, 1, 0.3) if down > 0.5 else (-0.12, 0, 1))
    p["legL"] = leg(lerp(stL, ls, down), pitch=0.3 * down, side="L", pole=(1, 0.2, 0.5))
    # left hand down to the grass behind, right arm up for balance
    p["armL"] = arm(lambda c, k=down: lerp(hang("L")(c), chest(c, "L", (0.38, -0.55, -0.20)), k), "L", pole=(0.6, -0.2, -0.8))
    p["armR"] = arm(lambda c, k=down: lerp(hang("R")(c), chest(c, "R", (0.45, 0.10, 0.10)), k), "R", pole=(-0.5, -0.6, -0.5))
    return p


# -- the keeper -------------------------------------------------------------

def keeper_set(rig, t, sway=0.0, step=None):
    """The keeper's ready stance: wide, knees bent, weight forward, hands out at waist height."""
    p = neutral(rig, t, breathe=False)
    p["hips"] = {"pos": (sway, -0.17, 0.02), "rot": (0.22, 0, 0)}
    p["spine"] = (0.22, 0, 0)
    p["head"] = (-0.2, 0, 0)
    for s in "LR":
        a = rest_ankle(rig, s)
        lift = step(s) if step else 0.0
        p["leg" + s] = leg((a[0] * 1.55 + sway, lift, a[1] + 0.02), pitch=0.15 + lift * 1.5, side=s, pole=(SX[s] * 0.35, 0, 1))
        p["arm" + s] = arm((lambda s: lambda c: chest(c, s, (0.14, -0.30, 0.34)))(s), s, pole=(SX[s] * 0.8, -0.4, -0.4), rot=(0.3, 0, 0))
    return p


READY_PERIOD = 1.0


def ready_shuffle(rig, t):
    """The keeper on his toes: ready stance, a little set-step side to side. Loops."""
    u = (t / READY_PERIOD) % 1.0
    sway = 0.05 * np.sin(2 * PI * u)
    step = lambda s: 0.05 * max(0.0, np.sin(2 * PI * (u * 2 + (0.0 if s == "L" else 0.5)))) ** 2
    p = keeper_set(rig, t, sway, step)
    p["hips"]["pos"] = (sway, -0.17 + 0.015 * np.cos(4 * PI * u), 0.02)
    return p


DIVE_LAUNCH = 0.12
DIVE_REACH = 0.42   # full stretch: hands furthest out
DIVE_LAND = 0.70


def dive_left(rig, t):
    """A real dive to his left: drop step, spring off the right leg, body flat out in
    the air, both hands stretched at `reach` (DIVE_REACH), land on his side, lie. 1.5 s.
    His body ends ~0.9 m to the side (the game moves him further)."""
    roll = K([(0, 0), (DIVE_LAUNCH, -0.15), (0.26, -0.85), (DIVE_REACH, -1.30), (0.58, -1.45), (DIVE_LAND, -1.52), (1.5, -1.50)], t)
    hx = K([(0, 0), (DIVE_LAUNCH, 0.06), (0.26, 0.08), (DIVE_REACH, 0.02), (DIVE_LAND, 0.10), (1.5, 0.12)], t)
    hy = K([(0, -0.17), (DIVE_LAUNCH, -0.24), (0.26, -0.14), (DIVE_REACH, -0.22), (0.58, -0.55), (DIVE_LAND, -0.80), (1.5, -0.82)], t)
    off, rot = (hx, hy, 0.05), (0.15, 0.05, roll)
    p = {"hips": {"pos": off, "rot": rot}}
    p["spine"] = (K([(0, 0.22), (0.3, 0.05), (1.5, 0.05)], t), 0.05, K([(0, 0), (DIVE_REACH, -0.25), (DIVE_LAND, -0.05), (1.5, 0)], t))
    p["head"] = (K([(0, -0.2), (DIVE_REACH, -0.15), (1.5, -0.1)], t), 0.15, K([(0, 0), (DIVE_REACH, 0.35), (1.5, 0.45)], t))
    aL, aR = rest_ankle(rig, "L"), rest_ankle(rig, "R")
    air = K([(0, 0), (DIVE_LAUNCH, 0), (0.24, 1), (1.5, 1)], t)
    # stance: the left steps out (the drop step), the right pushes
    stL = np.array([aL[0] * 1.55 + K([(0, 0), (DIVE_LAUNCH, 0.18)], t), K([(0, 0), (0.05, 0.06), (DIVE_LAUNCH, 0)], t), aL[1]])
    stR = np.array([aR[0] * 1.55, 0.0, aR[1]])
    flyL = leg_dir(rig, "L", off, rot, (0.05, -1, 0.25), 0.80)
    flyR = leg_dir(rig, "R", off, rot, (-0.12, -1, -0.05), 0.97)
    for a in (flyL, flyR):
        a[1] = max(0.0, a[1])
    p["legL"] = leg(lerp(stL, flyL, air), pitch=0.2 + 0.5 * air, side="L", pole=(0.4, 0.2, 1))
    p["legR"] = leg(lerp(stR, flyR, air), pitch=0.2 + 0.7 * air, side="R", pole=(-0.3, 0, 1))
    # hands: from the set, both arms thrown along the line of the dive, past his head
    reach = K([(0, 0), (DIVE_LAUNCH, 0.1), (0.3, 0.85), (DIVE_REACH, 1), (0.58, 1), (DIVE_LAND, 0.8), (1.5, 0.75)], t)
    setH = (lambda s: lambda c: chest(c, s, (0.14, -0.30, 0.34)))
    p["armL"] = arm(lambda c, k=reach: lerp(setH("L")(c), chest(c, "L", (0.06, 0.62, 0.22)), k), "L", pole=(0.2, 0.2, -1), rot=(0, 0, 0))
    p["armR"] = arm(lambda c, k=reach: lerp(setH("R")(c), chest(c, "R", (-0.14, 0.60, 0.26)), k), "R", pole=(-0.2, 0.2, -1), rot=(0, 0, 0))
    return p


CLAIM_CATCH = 0.46


def high_claim(rig, t):
    """Come for a high ball: a step, take off the left, right knee up for protection,
    both hands high to catch at the top (`contact`), bring it into the chest, land. 1.2 s."""
    p = neutral(rig, t, breathe=False)
    aL, aR = rest_ankle(rig, "L"), rest_ankle(rig, "R")
    hy = K([(0, -0.10), (0.18, -0.16), (0.30, 0.05), (CLAIM_CATCH, 0.36), (0.62, 0.22), (0.78, -0.12), (0.95, -0.05), (1.2, -0.012)], t)
    p["hips"] = {"pos": (0, hy, K([(0, 0), (0.3, 0.12), (0.8, 0.25), (1.2, 0.25)], t)), "rot": (K([(0, 0.15), (0.3, -0.05), (CLAIM_CATCH, -0.08), (0.7, 0.15), (1.2, 0)], t), 0, 0)}
    p["spine"] = (K([(0, 0.15), (CLAIM_CATCH, -0.15), (0.7, 0.25), (1.2, 0.05)], t), 0, 0)
    p["head"] = (K([(0, -0.1), (0.3, -0.55), (CLAIM_CATCH, -0.6), (0.7, 0.1), (1.2, 0.05)], t), 0, 0)
    air = K([(0, 0), (0.26, 0), (0.36, 1), (0.66, 1), (0.78, 0)], t)
    p["legL"] = leg((aL[0], max(0.0, hy * air + 0.12 * air), aL[1] + 0.15), pitch=0.6 * air, side="L")
    knee = K([(0, 0), (0.24, 0), (0.36, 1), (0.6, 1), (0.78, 0)], t)
    p["legR"] = leg((aR[0], max(0.0, hy * air) + 0.40 * knee, aR[1] + 0.15 + 0.12 * knee), pitch=0.5 * knee, side="R")
    up = K([(0, 0), (0.22, 0.2), (0.38, 1), (CLAIM_CATCH, 1), (0.66, 0), (1.2, 0)], t)
    hug = K([(0, 0), (CLAIM_CATCH, 0), (0.66, 1), (1.2, 1)], t)
    for s in "LR":
        hi = (lambda s: lambda c: chest(c, s, (-0.02, 0.62, 0.22)))(s)
        hold = (lambda s: lambda c: chest(c, s, (-0.04, -0.10, 0.28)))(s)
        p["arm" + s] = arm((lambda s, hi, hold, up=up, hug=hug: lambda c: lerp(lerp(lerp(hang(s)(c), hold(c), hug), hi(c), up), hi(c), 0))(s, hi, hold), s, pole=(SX[s] * 0.8, -0.5, -0.3), rot=(0.4, 0, 0))
    return p


THROW_RELEASE = 0.72


def throw_out(rig, t):
    """Keeper's overarm throw: ball held at the chest, step in on the left, the right arm
    goes back and over the top straight (`release`), follow through down across. 1.3 s."""
    p = neutral(rig, t, breathe=False)
    aL, aR = rest_ankle(rig, "L"), rest_ankle(rig, "R")
    lean = K([(0, 0.05), (0.45, -0.15), (THROW_RELEASE, 0.25), (0.95, 0.35), (1.3, 0.05)], t)
    yaw = K([(0, 0), (0.25, -0.3), (0.5, -0.55), (THROW_RELEASE, 0.15), (0.95, 0.35), (1.3, 0)], t)
    p["hips"] = {"pos": (0, K([(0, -0.02), (0.5, -0.07), (0.95, -0.06), (1.3, -0.02)], t), K([(0, 0), (0.4, 0.10), (0.95, 0.35), (1.3, 0.38)], t)), "rot": (lean * 0.5, yaw, 0)}
    p["spine"] = (lean, yaw * 0.6, K([(0, 0), (0.5, 0.2), (THROW_RELEASE, 0.05), (1.3, 0)], t))
    p["head"] = (0.0, -yaw * 0.8, 0)
    p["legL"] = leg(K([(0, (aL[0], 0, aL[1])), (0.22, (aL[0], 0.10, aL[1] + 0.25)), (0.42, (aL[0] + 0.02, 0, aL[1] + 0.55)), (1.3, (aL[0] + 0.02, 0, aL[1] + 0.55))], t), side="L")
    p["legR"] = leg(K([(0, (aR[0], 0, aR[1])), (0.85, (aR[0], 0, aR[1])), (1.0, (aR[0], 0.12, aR[1] + 0.3)), (1.15, (aR[0], 0, aR[1] + 0.45)), (1.3, (aR[0], 0, aR[1] + 0.45))], t),
                    pitch=K([(0, 0), (0.6, 0), (THROW_RELEASE, 0.5), (0.95, 0.4), (1.15, 0)], t), side="R")
    held = lambda c: c.chest((0.0, -0.05, 0.30))
    # right hand: with the ball at the chest, back and down, up behind, over the top
    wr = lambda c: chest(c, "R", (0.10, 0.10, -0.42))
    top = lambda c: chest(c, "R", (0.05, 0.62, 0.10))
    rel = lambda c: chest(c, "R", (0.02, 0.45, 0.45))
    thru = lambda c: chest(c, "R", (-0.30, -0.35, 0.35))

    def handR(c):
        if t < 0.18:
            return held(c) + np.array([-0.10, 0, 0])
        if t < 0.45:
            return lerp(held(c) + np.array([-0.10, 0, 0]), wr(c), ease((t - 0.18) / 0.27))
        if t < 0.60:
            return lerp(wr(c), top(c), ease((t - 0.45) / 0.15))
        if t < THROW_RELEASE:
            return lerp(top(c), rel(c), (t - 0.60) / (THROW_RELEASE - 0.60))
        if t < 0.98:
            return lerp(rel(c), thru(c), ease((t - THROW_RELEASE) / 0.26))
        return lerp(thru(c), hang("R")(c), ease((t - 0.98) / 0.32))
    p["armR"] = arm(handR, "R", pole=(-0.6, -0.5, -0.4) if t < 0.5 else (-0.3, -0.8, -0.3))
    aim = K([(0, 0), (0.18, 0), (0.4, 1), (THROW_RELEASE, 1), (1.0, 0.3), (1.3, 0)], t)
    p["armL"] = arm(lambda c, k=aim: lerp(held(c) + np.array([0.10, 0, 0]), chest(c, "L", (0.15, 0.10, 0.50)), k) if t > 0.18 else held(c) + np.array([0.10, 0, 0]), "L", pole=(0.6, -0.5, -0.4))
    return p


# -- walking off ------------------------------------------------------------

SAFE_PERIOD = 0.70
SAFE_SPEED = 3.4


def celebrate_safe(rig, t):
    """Through! Jogging off with both arms up, fists clenched, head back. Loops (in place)."""
    p = runner(rig, t, SAFE_PERIOD, 0.40, 0.32, 0.36, 0.22, lean=0.04, bob=0.05, swing=0.0, yawk=0.08, head=-0.25)
    u = (t / SAFE_PERIOD) % 1.0
    for s in "LR":
        ph = 0.0 if s == "L" else PI
        p["arm" + s] = arm((lambda s, ph: lambda c: chest(c, s, (0.24, 0.60 + 0.06 * np.sin(2 * PI * u * 2 + ph), 0.12)))(s, ph), s, pole=(SX[s] * 0.8, -0.4, -0.3))
    return p


SLUMP_PERIOD = 1.25
SLUMP_SPEED = 1.15


def slump_walk(rig, t):
    """Knocked out: the slow walk off, head down, shoulders dropped, arms hanging. Loops (in place)."""
    p = runner(rig, t, SLUMP_PERIOD, 0.62, 0.27, 0.27, 0.07, lean=0.10, bob=0.015, swing=0.0, yawk=0.06, head=0.0)
    u = (t / SLUMP_PERIOD) % 1.0
    sw = np.cos(2 * PI * u)
    p["spine"] = (0.32, p["spine"][1], 0)
    p["head"] = (0.62 + 0.05 * np.sin(2 * PI * u / 2), 0.08 * np.sin(PI * u), 0)
    p["shrugL"] = (0.12, 0, 0)
    p["shrugR"] = (0.12, 0, 0)
    for s, k in (("R", -sw), ("L", sw)):
        p["arm" + s] = arm((lambda s, k: lambda c: chest(c, s, (0.03, -0.50, 0.06 + 0.07 * k)))(s, k), s)
    return p


# name: (duration, loop, fn, meta)
FOOTBALL = {
    "kick_r": (2.3, False, kick, {"contact": KICK_CONTACT, "foot": "R", "end": [0, KICK_END_Z]}),
    "kick_l": (2.3, False, mirror(kick), {"contact": KICK_CONTACT, "foot": "L", "end": [0, KICK_END_Z]}),
    "celebrate_fist": (2.0, False, celebrate, {}),
    "frustrated": (2.2, False, frustrated, {}),
    "juggle": (JUGGLE_PERIOD, True, juggle, {"touches": JUGGLE_TOUCHES}),
    "pass": (1.6, True, pass_drill, {"contact": PASS_CONTACT, "trap": PASS_TRAP, "foot": "R"}),
    "stretch": (6.0, True, stretch, {}),
    "cone_dribble": (DRIBBLE_PERIOD, True, cone_dribble, {"touches": DRIBBLE_TOUCHES}),
    # the 3D training drills (play3d). `part` = what meets the ball; `contactPoint` is measured.
    "sprint": (SPRINT_PERIOD, True, sprint, {"speed": SPRINT_SPEED}),
    "dribble_run": (DRIB_PERIOD, True, dribble_run, {"speed": DRIB_SPEED, "touches": [(DRIB_TOUCH, "R")]}),
    "header_stand": (1.1, False, header_stand, {"contact": HEAD_CONTACT, "part": "head"}),
    "header_diving": (1.3, False, header_diving, {"contact": DIVE_HEAD_CONTACT, "part": "head", "end": [0, 0.82]}),
    "volley": (1.15, False, volley, {"contact": VOLLEY_CONTACT, "foot": "R"}),
    "first_touch": (0.85, False, first_touch, {"contact": TOUCH_CONTACT, "foot": "R"}),
    "chest_control": (1.0, False, chest_control, {"contact": CHEST_CONTACT, "part": "chest"}),
    "thigh_control": (0.9, False, thigh_control, {"contact": THIGH_CONTACT, "part": "thighR"}),
    "pass_lofted": (1.15, False, pass_lofted, {"contact": LOFT_CONTACT, "foot": "R"}),
    "shot_r": (1.35, False, shot_r, {"contact": round(KICK_CONTACT - SHOT_FROM, 3), "foot": "R"}),
    "poke_tackle": (0.75, False, poke_tackle, {"contact": POKE_CONTACT, "foot": "R"}),
    "sliding_tackle": (1.5, False, sliding_tackle, {"contact": SLIDE_CONTACT, "foot": "R", "end": [0, 0.95]}),
    "ready_shuffle": (READY_PERIOD, True, ready_shuffle, {}),
    "dive_left": (1.5, False, dive_left, {"contact": DIVE_REACH, "part": "hands", "launch": DIVE_LAUNCH, "land": DIVE_LAND}),
    "dive_right": (1.5, False, mirror(dive_left), {"contact": DIVE_REACH, "part": "hands", "launch": DIVE_LAUNCH, "land": DIVE_LAND}),
    "high_claim": (1.2, False, high_claim, {"contact": CLAIM_CATCH, "part": "hands"}),
    "throw_out": (1.3, False, throw_out, {"contact": THROW_RELEASE, "release": THROW_RELEASE, "part": "handR"}),
    "celebrate_safe": (SAFE_PERIOD, True, celebrate_safe, {"speed": SAFE_SPEED}),
    "slump_walk": (SLUMP_PERIOD, True, slump_walk, {"speed": SLUMP_SPEED}),
}
CASINO = {
    "dealer_idle": (4.0, True, dealer_idle, {}),
    "dealer_deal": (1.0, True, dealer_deal, {"flick": 0.45}),
    "dealer_spin": (1.6, False, dealer_spin, {"release": 0.65}),
    "lean_table": (4.0, True, lean_table, {}),
    "slot_sit": (4.0, True, slot_sit, {"seatY": SEAT_Y}),
    "slot_pull": (1.4, False, slot_pull, {"pulled": 0.75, "seatY": SEAT_Y}),
    "cheer_win": (1.2, True, cheer_win, {}),
    "groan_loss": (2.4, False, groan_loss, {}),
    "bartender_idle": (4.0, True, bartender_idle, {}),
}
