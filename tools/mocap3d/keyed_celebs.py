"""Four more goal celebrations, KEYED by hand (no free capture has them): the
Star Pass rewards (25 Oct 2026). Same pose language and skeleton as keyed.py's
knee slide; they go into mocap.glb next to it (keyed.py KEYED).

  celebrate_corner_flag  Corner Flag Dance: at the flag, one hand over the
                         belly, the other arm up and waving, hips swaying on
                         bent knees, small tapping steps that turn him a
                         quarter round and back, then both arms up.
  celebrate_backflip     Backflip: a standing back tuck. Dip and arms back,
                         arms thrown up, off both feet, knees pulled in, one
                         full turn backwards, lands on bent knees, arms up.
  celebrate_own_name     Your Own Celebration: turns his back in three steps,
                         both thumbs point back over his shoulders at the name
                         on his shirt (two little jabs), looks back over his
                         left shoulder, holds.
  celebrate_statue       Statue Pose: stops dead, one step out wide, arms
                         folded high across the chest, chin up, then not one
                         part of him moves.

Every one is checked with tools/motionref/body_overlap.mts (RUL-3D-005: no
body part inside another). Blend weights are smoothstep pieces (`seg`), never
Catmull-Rom over a hold, so nothing overshoots into the body.
"""
import numpy as np

from curves import ease, lerp  # noqa: E402
from clips import chest, arm, rest_ankle, leg, leg_dir, SX  # noqa: E402
from clips import hang as _hang  # noqa: E402
from rig import qrot, euler  # noqa: E402

PI = np.pi


def hang(side):
    """Arms down, the hand a hand's width off the thigh: the clips start from here (clips.hang touches a wide thigh)."""
    return _hang(side, out=0.14, down=0.44, fwd=0.05)


def seg(keys, t):
    """Piecewise smoothstep through (t, v) keys: flat at every key, no overshoot."""
    if t <= keys[0][0]:
        return np.asarray(keys[0][1], float) if np.ndim(keys[0][1]) else float(keys[0][1])
    for i in range(1, len(keys)):
        t0, v0 = keys[i - 1]
        t1, v1 = keys[i]
        if t <= t1:
            k = ease((t - t0) / max(1e-9, t1 - t0))
            return lerp(v0, v1, k) if np.ndim(v0) else float(v0 + (v1 - v0) * k)
    v = keys[-1][1]
    return np.asarray(v, float) if np.ndim(v) else float(v)


def _turned(rig, s, yaw, wide=1.0, dx=0.0, dz=0.0):
    """His rest ankle (x a little wider), turned `yaw` about the spot he stands on."""
    a = rest_ankle(rig, s)
    return qrot(euler(0, yaw, 0), np.array([a[0] * wide + dx, 0.0, a[1] + dz]))


def _lift(t, t0, t1, h):
    if t <= t0 or t >= t1:
        return 0.0
    return h * np.sin(PI * (t - t0) / (t1 - t0))


# ── statue pose ──────────────────────────────────────────────────────────
# Real: the player stops, plants his feet a little wider than his hips, folds
# his arms high across his chest (the right forearm over the left, each hand
# tucked by the other arm's elbow), lifts his chin, and holds it like a bronze.
# No breathing, no sway: after 0.8 s every bone stays where it is.
STATUE_END = 2.6


def statue(rig, t):
    step = seg([(0, 0), (0.10, 0), (0.42, 1)], t)
    foldA = seg([(0, 0), (0.04, 0), (0.60, 1)], t)  # the left forearm goes in first, underneath
    foldB = seg([(0, 0), (0.16, 0), (0.76, 1)], t)
    chin = seg([(0, 0), (0.30, 0), (0.80, 1)], t)
    dip = seg([(0, 0), (0.10, -0.03), (0.40, -0.02), (0.80, -0.012)], t)
    p = {"hips": {"pos": (-0.03 * step, dip, 0.0), "rot": (0.0, 0.0, 0.0)}}
    p["spine"] = (lerp(0.03, -0.07, chin), 0, 0)
    p["head"] = (lerp(0.05, -0.30, chin), 0, 0)
    # the left foot stays; the right steps out and a touch back
    fl = _turned(rig, "L", 0.0, 1.0)
    fr = lerp(_turned(rig, "R", 0.0, 1.0), _turned(rig, "R", 0.0, 1.0, dx=-0.08, dz=-0.03), step)
    fr = fr + np.array([0, _lift(t, 0.10, 0.42, 0.06), 0])
    p["legL"] = leg(fl, side="L", yaw=0.10)
    p["legR"] = leg(fr, side="R", yaw=-0.10 * step - 0.0, pitch=0.4 * _lift(t, 0.10, 0.42, 1.0))
    # folded arms (chest frame, from each shoulder): the left forearm lower and
    # nearer the chest, the right one above it and further out; hands by the
    # other arm's elbow
    foldL = lambda c: chest(c, "L", (-0.22, -0.29, 0.20))
    foldR = lambda c: chest(c, "R", (-0.22, -0.15, 0.24))
    # on the way in the right hand rides over the top and out in front, the left one under: they never meet
    arcR = lambda c: qrot(c.delta("spine3"), np.array([0.0, 0.08, 0.10])) * np.sin(PI * foldB)
    arcL = lambda c: qrot(c.delta("spine3"), np.array([0.0, -0.03, 0.04])) * np.sin(PI * foldA)
    p["armL"] = arm(lambda c: lerp(hang("L")(c), foldL(c), foldA) + arcL(c), "L", pole=(0.6, -0.8, 0.1))
    p["armR"] = arm(lambda c: lerp(hang("R")(c), foldR(c), foldB) + arcR(c), "R", pole=(-0.6, -0.8, 0.1))
    return p


# ── your own celebration (the name on the back) ─────────────────────────
# Real: he turns his back to the camera in a few steps, raises both hands to
# his shoulders, elbows out, and jabs both thumbs back over his shoulders at
# the name and number on his shirt; he looks back over one shoulder at the
# camera and holds it.
NAME_END = 3.0
# the hand's turn at the hold: fingers back over the shoulder (found with a search, scratch handrot.py)
NAME_HAND = {"L": (0.0, 0.0, 2.0), "R": (0.0, 0.0, -2.0)}


def own_name(rig, t):
    # each foot steps round on its own beat; the hips follow the feet
    yl = seg([(0, 0), (0.12, 0), (0.38, PI * 0.45), (0.56, PI * 0.45), (0.82, PI)], t)
    yr = seg([(0, 0), (0.26, 0), (0.52, PI * 0.78), (0.68, PI * 0.78), (0.92, PI)], t)
    yaw = seg([(0, 0), (0.12, 0), (0.92, PI)], t)
    up = seg([(0, 0), (0.80, 0), (1.20, 1)], t)
    jab = _lift(t, 1.35, 1.55, 1.0) + _lift(t, 1.70, 1.90, 1.0)
    look = seg([(0, 0), (0.85, 0), (1.25, 1)], t)
    bob = -0.012 - _lift(t, 0.12, 0.92, 0.035)
    p = {"hips": {"pos": (0.0, bob, 0.0), "rot": (0.04 * up, yaw, 0.0)}}
    p["spine"] = (lerp(0.03, -0.05, up), 0.25 * look, 0)
    # looks back over his left shoulder (the camera is behind him now), chin up a little
    p["head"] = (lerp(0.05, -0.10, look), 0.55 * look, 0)
    for s, ys, t0, t1, t2, t3 in (("L", yl, 0.12, 0.38, 0.56, 0.82), ("R", yr, 0.26, 0.52, 0.68, 0.92)):
        lift = _lift(t, t0, t1, 0.07) + _lift(t, t2, t3, 0.07)
        g = _turned(rig, s, ys, 1.22) + np.array([0, lift, 0])
        pole = qrot(euler(0, ys, 0), np.array([SX[s] * 0.12, 0, 1.0]))
        p["leg" + s] = leg(g, side=s, yaw=ys, pitch=4.0 * lift, pole=tuple(float(x) for x in pole))
    # hands up at the shoulders, elbows out to the sides, the fingers turned
    # back over the shoulders at the name (two little jabs back, then held)
    yq = euler(0, yaw, 0)
    for s in "LR":
        def hand(c, s=s):
            # off the thighs while the feet step round
            h0 = lerp(hang(s)(c), chest(c, s, (0.17, -0.30, 0.10)), seg([(0, 0), (0.04, 0), (0.30, 0.8), (0.92, 0.6)], t))
            hp = chest(c, s, (0.13 - 0.01 * jab, 0.07 + 0.03 * jab, 0.19 - 0.04 * jab))
            return lerp(h0, hp, up)
        pole = qrot(yq, np.array([SX[s] * 1.0, -0.45, -0.10]))
        p["arm" + s] = arm(hand, s, pole=tuple(float(x) for x in pole), rot=tuple(float(v) * up for v in NAME_HAND[s]))
    return p


# ── backflip ─────────────────────────────────────────────────────────────
# Real (a standing back tuck): a quick dip with the arms swung back, the arms
# thrown up as the legs drive and the hips extend, off both feet, the knees
# pulled in to the chest at the top (he spins fastest tucked), a full turn
# backwards, opens out, lands on both feet with the knees bent and the arms
# forward for balance, stands, arms up.
BF_TO = 0.46  # takeoff
BF_LD = 1.08  # landing
BF_END = 2.6
G = 9.81


def _flip_pitch(t):
    """The whole body's turn about his left-right axis (rad, negative = backwards)."""
    p0, p1 = -0.30, -2 * PI + 0.40
    if t <= BF_TO:
        return seg([(0, 0), (0.28, 0.32), (BF_TO, p0)], t)
    if t <= BF_LD:
        u = (t - BF_TO) / (BF_LD - BF_TO)
        # spins faster in the tuck: a smoothstep spin, rate peaks mid-air
        return p0 + (p1 - p0) * (u * u * (3 - 2 * u) * 0.7 + u * 0.3)
    return seg([(BF_LD, p1), (BF_LD + 0.16, -2 * PI + 0.48), (BF_LD + 0.70, -2 * PI)], t)


def _flip_hips_y(t):
    yT, yL = 0.04, -0.12
    if t <= BF_TO:
        return seg([(0, -0.012), (0.28, -0.30), (BF_TO, yT)], t)
    if t <= BF_LD:
        u, T = t - BF_TO, BF_LD - BF_TO
        return yT + (yL - yT) * u / T + 0.5 * G * u * (T - u)
    return seg([(BF_LD, yL), (BF_LD + 0.14, -0.30), (BF_LD + 0.65, -0.03), (BF_LD + 1.0, -0.012)], t)


def backflip(rig, t):
    P = _flip_pitch(t)
    hy = _flip_hips_y(t)
    off, rot = (0.0, hy, 0.0), (P, 0.0, 0.0)
    p = {"hips": {"pos": off, "rot": rot}}
    tuck = seg([(0, 0), (BF_TO + 0.04, 0), (BF_TO + 0.22, 1), (BF_LD - 0.24, 1), (BF_LD - 0.06, 0)], t)
    sp = seg([(0, 0.02), (0.28, 0.30), (BF_TO - 0.04, -0.22), (BF_TO + 0.22, 0.45), (BF_LD - 0.20, 0.45),
              (BF_LD, 0.10), (BF_LD + 0.16, 0.35), (BF_LD + 0.70, -0.04), (BF_END, -0.04)], t)
    p["spine"] = (sp, 0, 0)
    p["head"] = (seg([(0, 0.05), (0.28, 0.15), (BF_TO, -0.45), (BF_TO + 0.22, 0.20), (BF_LD - 0.15, 0.10),
                      (BF_LD + 0.16, 0.25), (BF_LD + 0.8, -0.25), (BF_END, -0.25)], t), 0, 0)
    air = seg([(0, 0), (BF_TO - 0.04, 0), (BF_TO + 0.06, 1), (BF_LD - 0.08, 1), (BF_LD, 0)], t)
    opn = seg([(0, 0), (BF_LD - 0.26, 0), (BF_LD - 0.06, 1)], t)
    bodyq = euler(P, 0, 0)
    for s in "LR":
        stand = _turned(rig, s, 0.0, 1.12)
        # in the air: legs straight down the body, then folded in (thighs to the chest)
        straight = np.array([SX[s] * 0.04, -1.0, -0.05])
        tucked = np.array([SX[s] * 0.12, -0.72, 0.48])
        d = lerp(straight, tucked, tuck)
        # opening out for the landing: the legs reach for the grass under him (world down, a touch forward)
        down = qrot(np.array([-bodyq[0], -bodyq[1], -bodyq[2], bodyq[3]]), np.array([SX[s] * 0.05, -1.0, 0.12]))
        d = lerp(d / np.linalg.norm(d), down, opn)
        k = lerp(lerp(0.97, 0.50, tuck), 0.80, opn)
        fly = leg_dir(rig, s, off, rot, d, k)
        g = lerp(stand, fly, air)
        g[1] = max(g[1], 0.0)
        pole = qrot(bodyq, np.array([SX[s] * 0.12, lerp(0.0, 0.5, tuck), 1.0]))
        # toes pointed in the air, flat on the grass (the foot turns with the body while he is up)
        fly_p = (P + 0.35 + PI) % (2 * PI) - PI  # the same turn, wrapped, so the blend to flat never goes the long way round
        fp = float(lerp(seg([(0, 0), (BF_TO - 0.10, 0), (BF_TO, 0.55), (BF_TO + 0.1, 0.0)], t), fly_p, air))
        if t >= BF_LD:
            fp = 0.0
        p["leg" + s] = leg(g, pitch=fp, side=s, pole=tuple(float(x) for x in pole))
    swing_back = seg([(0, 0), (0.06, 0), (0.28, 1), (BF_TO - 0.08, 0)], t)
    throw = seg([(0, 0), (0.28, 0), (BF_TO, 1), (BF_TO + 0.22, 0)], t)
    tuckA = seg([(0, 0), (BF_TO + 0.06, 0), (BF_TO + 0.24, 1), (BF_LD - 0.22, 1), (BF_LD - 0.04, 0)], t)
    landA = seg([(0, 0), (BF_LD - 0.20, 0), (BF_LD - 0.02, 1), (BF_LD + 0.50, 1), (BF_LD + 0.85, 0)], t)
    vee = seg([(0, 0), (BF_LD + 0.55, 0), (BF_LD + 1.0, 1)], t)
    for s in "LR":
        def hand(c, s=s):
            h = hang(s)(c)
            h = lerp(h, chest(c, s, (0.12, -0.42, -0.22)), swing_back)
            h = lerp(h, chest(c, s, (0.14, 0.56, 0.06)), throw)
            # tucked: arms out wide of the knees, hands forward (never on the shins)
            h = lerp(h, chest(c, s, (0.34, -0.05, 0.30)), tuckA)
            h = lerp(h, chest(c, s, (0.14, -0.08, 0.42)), landA)
            h = lerp(h, chest(c, s, (0.30, 0.60, 0.10)), vee)
            return h
        pole = qrot(bodyq, np.array([SX[s] * 0.5, -0.5, -0.6]))
        p["arm" + s] = arm(hand, s, pole=tuple(float(x) for x in pole))
    return p


# ── corner flag dance ────────────────────────────────────────────────────
# Real (the classic at the flag): knees bent, the hips rolling side to side on
# the beat, one hand held over the belly, the other arm up by the head and
# waving; little tapping steps, each foot in turn, that turn him a quarter
# round and back; it ends with both arms up to the cameras.
CF_END = 3.2
CF_BEAT = 0.42
CF_DANCE = 2.52  # six beats


def _cf_yaw(t):
    if t >= CF_DANCE:
        return 0.0
    return 0.55 * np.sin(PI * t / CF_DANCE)


def corner_flag(rig, t):
    on = seg([(0, 0), (0.18, 1), (CF_DANCE, 1), (CF_DANCE + 0.25, 0)], t)
    ph = 2 * PI * t / (2 * CF_BEAT)  # one sway left-right every two beats
    sway = np.sin(ph) * on
    bounce = abs(np.sin(PI * t / CF_BEAT)) * on
    yaw = _cf_yaw(t)
    hy = -0.012 - 0.07 * on - 0.03 * bounce
    p = {"hips": {"pos": (0.05 * sway, hy, 0.0), "rot": (0.06 * on, yaw, -0.14 * sway)}}
    p["spine"] = (0.10 * on + 0.03 * bounce, -0.10 * sway, 0.18 * sway)
    p["head"] = (0.05 - 0.10 * bounce, 0.10 * sway, -0.12 * sway)
    # taps: the left foot on even beats, the right on odd ones; each lands
    # turned to where the hips are by then (so he steps round, never twists)
    for s, first in (("L", 0), ("R", 1)):
        beats = [b for b in range(first, 6, 2)]
        y_prev, lift, ys = 0.0, 0.0, 0.0
        for b in beats:
            t0, t1 = b * CF_BEAT, b * CF_BEAT + CF_BEAT * 0.62
            y_new = _cf_yaw(t1) if b < 5 else 0.0
            if t < t0:
                ys = y_prev
                break
            if t < t1:
                ys = y_prev + (y_new - y_prev) * ease((t - t0) / (t1 - t0))
                lift = _lift(t, t0, t1, 0.06)
                break
            y_prev = y_new
            ys = y_new
        g = _turned(rig, s, ys, 1.28) + np.array([0, lift, 0])
        pole = qrot(euler(0, ys, 0), np.array([SX[s] * 0.25, 0, 1.0]))
        p["leg" + s] = leg(g, side=s, yaw=ys + SX[s] * 0.12, pitch=5.0 * lift, pole=tuple(float(x) for x in pole))
    ta = seg([(0, 0), (CF_DANCE - 0.05, 0), (CF_DANCE + 0.35, 1)], t)
    wave = np.sin(2 * PI * t / CF_BEAT)
    yq = euler(0, yaw, 0)
    poleL = tuple(float(x) for x in qrot(yq, np.array([0.8, -0.4, -0.4])))
    poleR = tuple(float(x) for x in qrot(yq, np.array([-0.8, -0.5, -0.2])))
    belly = lambda c: chest(c, "L", (-0.10, -0.27, 0.22))  # elbow bent, the hand over the belly
    upL = lambda c: chest(c, "L", (0.30, 0.58, 0.10))
    p["armL"] = arm(lambda c: lerp(lerp(hang("L")(c), belly(c), on), upL(c), ta), "L", pole=poleL)
    upR_d = lambda c: chest(c, "R", (0.30 + 0.12 * wave, 0.36, 0.14))
    upR = lambda c: chest(c, "R", (0.30, 0.58, 0.10))
    p["armR"] = arm(lambda c: lerp(lerp(hang("R")(c), upR_d(c), on), upR(c), ta), "R", pole=poleR)
    return p


# name: (duration, loop, fn, meta, steady rates) — rates: the backflip turns the whole body ~14 rad/s
CELEB_KEYED = {
    "celebrate_corner_flag": (CF_END, False, corner_flag, {"source": "keyed (no free capture of a corner-flag dance exists)"}, {}),
    "celebrate_backflip": (BF_END, False, backflip, {"launch": BF_TO, "land": BF_LD, "source": "keyed (no free capture of a standing backflip exists)"},
                           {"pole_rate": 24.0, "line_rate": 30.0}),
    "celebrate_own_name": (NAME_END, False, own_name, {"source": "keyed (no free capture of the thumbs-at-the-name celebration exists)"}, {}),
    "celebrate_statue": (STATUE_END, False, statue, {"source": "keyed (no free capture of a statue pose exists)"}, {}),
}
