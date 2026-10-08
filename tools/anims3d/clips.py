"""Every clip, as a pose (character frame) at time t. See rig.py for the frame.

Each clip: CLIPS[name] = (duration, loop, fn(rig, t) -> pose, meta)
meta marks the moments code times things to (contact, touches, where the
ball sits, where he ends up).
"""
import numpy as np
from curves import K, ease, lerp, foot
from rig import qrot

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
