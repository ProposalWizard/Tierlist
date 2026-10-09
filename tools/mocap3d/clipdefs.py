"""Which capture each clip comes from (CMU trial "SS_TT", seconds), and the
careful changes on top of the ADAPTED ones. See build.py and README.md.

Times: `cut` is in the trial's own seconds; `moments`, `unturn` and the
edits' times are seconds from the start of the cut (after `rate`).
"""
import numpy as np
from retarget import env

X, Y, Z = (1.0, 0, 0), (0, 1.0, 0), (0, 0, 1.0)  # his left, up, forward


# ── edits (each one is a small change on top of a real capture) ──────────
def head_snap(contact, back=0.22, through=0.5):
    """A header: the neck cocks back before the ball, then snaps through it."""
    def f(src):
        def ang(t):
            return -back * env(t, contact - 0.35, contact - 0.12, contact - 0.1, contact) + \
                through * env(t, contact - 0.1, contact + 0.02, contact + 0.06, contact + 0.35)
        src.bend("lowerneck", X, ang)
        src.bend("thorax", X, lambda t: 0.5 * ang(t))
    return f


def arms_up(a, b, c, d, spread=0.35, bend_elbow=0.25):
    """Both arms up overhead (fists to the sky), eased in a..b, out c..d."""
    def f(src):
        for fr in range(src.n):
            k = env(src.t(fr), a, b, c, d)
            if k <= 0:
                continue
            for s, sx in (("l", 1), ("r", -1)):
                up = src.body_axis(fr, (sx * spread, 1.0, 0.08))
                src.aim(s + "humerus", fr, up, k)
                fore = src.body_axis(fr, (sx * spread * 0.6, 1.0, bend_elbow))
                src.aim(s + "radius", fr, fore, k)
    return f


def arms_wide(a, b, c, d, lift=0.15):
    """Arms out to the sides like wings (the airplane run)."""
    def f(src):
        for fr in range(src.n):
            k = env(src.t(fr), a, b, c, d)
            if k <= 0:
                continue
            for s, sx in (("l", 1), ("r", -1)):
                src.aim(s + "humerus", fr, src.body_axis(fr, (sx, lift, -0.12)), k)
                src.aim(s + "radius", fr, src.body_axis(fr, (sx, lift + 0.05, -0.05)), k)
    return f


def leg_lift(side, contact, ang=0.55, lean=0.22):
    """A volley: the kicking leg swings through higher, the body leans back away from it."""
    def f(src):
        s = side.lower()
        e = lambda t: env(t, contact - 0.3, contact - 0.04, contact + 0.06, contact + 0.35)
        src.bend(s + "femur", X, lambda t: -ang * e(t))
        src.bend("lowerback", X, lambda t: -lean * e(t))
        src.bend("lowerback", Z, lambda t: (lean if s == "r" else -lean) * e(t))
    return f


def inside_foot(side, contact, ang=0.95):
    """A side-foot pass: the kicking leg turned out so the inside of the foot faces the ball."""
    def f(src):
        s = side.lower()
        sx = -1 if s == "r" else 1  # turning out = toes away from the body's middle
        src.bend(s + "femur", Y, lambda t: sx * ang * env(t, contact - 0.45, contact - 0.1, contact + 0.04, contact + 0.22))
    return f


def hold_hands(points, a, b, c, d, wobble=0.0):
    """Both hands to points in his frame (from his feet), eased; optional breathing wobble."""
    def f(src):
        for fr in range(src.n):
            t = src.t(fr)
            k = env(t, a, b, c, d)
            if k <= 0:
                continue
            hips = src.P["root"][fr]
            base = np.array([hips[0], 0, hips[2]])
            for s, pt in points.items():
                p = np.array(pt, float) + np.array([0, wobble * np.sin(2 * np.pi * t / 3.0), 0])
                src.reach(s, fr, base + src.body_axis(fr, p), k, pole_local=(0.6 * np.sign(p[0]), -1.0, -0.3))
    return f


def clap(a, d, period=0.42, y=1.2, z=0.4):
    """Applause: hands meet in front of the chest, about two claps a second."""
    def f(src):
        for fr in range(src.n):
            t = src.t(fr)
            k = env(t, a, a + 0.35, d - 0.35, d)
            if k <= 0:
                continue
            ph = ((t - a) % period) / period
            gap = 0.06 + 0.14 * (0.5 - 0.5 * np.cos(2 * np.pi * ph)) ** 1.5
            hips = src.P["root"][fr]
            base = np.array([hips[0], 0, hips[2]])
            for s, sx in (("L", 1), ("R", -1)):
                src.reach(s, fr, base + src.body_axis(fr, (sx * gap, y, z)), k, pole_local=(sx * 0.3, -1.0, -0.2))
    return f


def nod(times, depth=0.32, dur=0.42):
    """Yes: the head dips and comes back up at each time (a real stand under it)."""
    def f(src):
        def ang(t):
            return sum(depth * env(t, a, a + dur * 0.4, a + dur * 0.45, a + dur) for a in times)
        src.bend("lowerneck", X, lambda t: 0.55 * ang(t))
        src.bend("head", X, lambda t: 0.45 * ang(t))
    return f


def hug(a, b, c, d, lean=0.22):
    """A hug: lean in, both arms round a man's back (his chest 0.3 m in front), the left over the shoulder, the right under the arm."""
    def f(src):
        src.bend("lowerback", X, lambda t: lean * env(t, a, b, c, d))
        src.bend("lowerneck", Y, lambda t: 0.35 * env(t, a, b, c, d))
        hold_hands({"L": (-0.16, 1.42, 0.42), "R": (0.18, 1.12, 0.40)}, a, b, c, d)(src)
    return f


def chest_down(contact):
    """Chest control: lean back, chest out, arms wide to meet it, the chest gives, then he folds over to drop it at his feet."""
    def f(src):
        back = lambda t: env(t, contact - 0.40, contact - 0.12, contact + 0.06, contact + 0.40)
        fold = lambda t: env(t, contact + 0.15, contact + 0.40, contact + 0.55, contact + 0.90)
        src.bend("lowerback", X, lambda t: -0.38 * back(t) + 0.30 * fold(t))
        src.bend("thorax", X, lambda t: -0.22 * back(t) + 0.12 * fold(t))
        src.bend("lowerneck", X, lambda t: 0.40 * back(t) + 0.35 * fold(t))
        arms_wide(contact - 0.40, contact - 0.12, contact + 0.15, contact + 0.60, lift=-0.25)(src)
    return f


def thigh_up(side, contact):
    """Thigh control: the knee comes up to meet the ball (thigh flat), then drops with it to kill it."""
    def f(src):
        s = side.lower()
        e = lambda t: env(t, contact - 0.32, contact - 0.04, contact + 0.06, contact + 0.40)
        src.bend(s + "femur", X, lambda t: -1.25 * e(t))
        src.bend(s + "tibia", X, lambda t: 1.15 * e(t))
        src.bend("lowerneck", X, lambda t: 0.45 * env(t, contact - 0.5, contact - 0.2, contact + 0.3, contact + 0.6))
        src.bend("lowerback", X, lambda t: -0.08 * e(t))
    return f


def roar(a, b, c, d):
    """The roar: chest out, head back, both fists clenched down and out by the hips, then pumped once."""
    def f(src):
        src.bend("lowerback", X, lambda t: -0.18 * env(t, a, b, c, d))
        src.bend("lowerneck", X, lambda t: -0.45 * env(t, a, b, c, d))
        hold_hands({"L": (0.42, 0.95, 0.12), "R": (-0.42, 0.95, 0.12)}, a, b, c, d)(src)
    return f


def fist_pump(a, d, pumps=3, period=0.45):
    """Fist pump: the right fist driven down from the shoulder to the hip, three times; head nods with it."""
    def f(src):
        for fr in range(src.n):
            t = src.t(fr)
            k = env(t, a, a + 0.25, d - 0.3, d)
            if k <= 0:
                continue
            ph = min(pumps, max(0.0, (t - a - 0.2) / period))
            u = 0.5 - 0.5 * np.cos(2 * np.pi * (ph % 1.0)) if ph < pumps else 0.0
            hips = src.P["root"][fr]
            base = np.array([hips[0], 0, hips[2]])
            src.reach("R", fr, base + src.body_axis(fr, (-0.22, 1.45 - 0.42 * u, 0.25)), k, pole_local=(-0.6, -1.0, 0.1))
        src.bend("lowerneck", X, lambda t: -0.25 * env(t, a, a + 0.3, d - 0.3, d))
    return f


def chain(*fs):
    def f(src):
        for g in fs:
            g(src)
    return f


CLIPS = {
    # ── on his feet ─────────────────────────────────────────────────────
    "idle": dict(trial="82_08", cut=(0.2, 8.0), loop=True, period=(3.0, 5.5)),
    "walk": dict(trial="16_15", cut=(0.0, 3.0), loop=True, period=(0.9, 1.3)),
    "jog": dict(trial="35_17", cut=(0.0, 1.39), loop=True, period=(0.6, 0.8)),
    "run": dict(trial="09_01", cut=(0.0, 1.23), loop=True, period=(0.55, 0.8)),
    "sprint": dict(trial="143_01", cut=(0.0, 0.83), loop=True, period=(0.5, 0.75)),
    "dribble_run": dict(trial="16_35", cut=(0.0, 1.35), loop=True, period=(0.6, 0.85), touch_foot="R"),
    # sideways: he faces +z and travels along x (`speed` says how fast); _l = to his left
    "side_step_l": dict(trial="141_33", cut=(0.0, 3.0), loop=True, period=(0.8, 1.6), face="mean", mirror=True),
    "side_step_r": dict(trial="141_33", cut=(0.0, 3.0), loop=True, period=(0.8, 1.6), face="mean"),
    "shuffle_l": dict(trial="78_29", cut=(0.3, 1.43), loop=True, period=(0.4, 1.1), face="mean", mirror=True),
    "shuffle_r": dict(trial="78_29", cut=(0.3, 1.43), loop=True, period=(0.4, 1.1), face="mean"),
    "turn_l": dict(trial="16_41", cut=(0.0, 2.2)),
    "turn_r": dict(trial="16_43", cut=(0.0, 2.2)),

    # ── on the ball ─────────────────────────────────────────────────────
    "kick_r": dict(trial="11_01", cut=(2.0, 4.3), moments={"contact": 1.37}, meta={"foot": "R"}, end=True,
                   unturn=(1.45, 2.1, "ltibia", 1.2)),
    "kick_l": dict(trial="11_01", cut=(2.0, 4.3), mirror=True, moments={"contact": 1.37}, meta={"foot": "L"}, end=True,
                   unturn=(1.45, 2.1, "rtibia", 1.2)),
    "shot_low": dict(trial="10_05", cut=(1.0, 3.4), moments={"contact": 1.50}, meta={"foot": "R"}, end=True,
                     unturn=(1.6, 2.3, "ltibia", 1.4)),
    "shot_r": dict(trial="11_01", cut=(2.95, 4.3), moments={"contact": 0.42}, meta={"foot": "R"},
                   unturn=(0.5, 1.2, "ltibia", 0.3)),
    "chip": dict(trial="10_03", cut=(0.3, 2.2), moments={"contact": 0.83}, meta={"foot": "R"}, unturn=(0.9, 1.6, "ltibia", 0.7)),
    "pass_lofted": dict(trial="10_02", cut=(2.2, 3.9), moments={"contact": 0.72}, meta={"foot": "R"}, unturn=(0.8, 1.5, "ltibia", 0.6)),
    "pass_inside": dict(trial="143_24", cut=(4.6, 5.9), moments={"contact": 0.46}, meta={"foot": "R"},
                        src_edit=inside_foot("R", 0.46), adapted="the kicking leg turned out for a side-foot pass"),
    "volley": dict(trial="143_24", cut=(4.5, 5.9), moments={"contact": 0.56}, meta={"foot": "R"},
                   src_edit=leg_lift("R", 0.56), adapted="the kicking leg lifted, body leaning away, to meet a ball in the air"),
    "first_touch": dict(trial="143_24", cut=(0.8, 1.9), mirror=True, moments={"contact": 0.51}, meta={"foot": "R"}),
    "header_stand": dict(trial="13_39", cut=(0.9, 2.4), moments={"contact": 0.7}, meta={"part": "head"},
                         src_edit=head_snap(0.7), adapted="a real jump; the neck snaps through the ball at the top"),

    # ── keeper ──────────────────────────────────────────────────────────
    "high_claim": dict(trial="14_07", cut=(7.0, 8.4), moments={"contact": 0.67}, meta={"part": "hands"},
                       src_edit=hold_hands({"L": (0.10, 1.25, 0.22), "R": (-0.10, 1.25, 0.22)}, 0.8, 1.05, 9, 10),
                       adapted="a real jump to grab; after the catch the ball is brought into the chest"),

    "catch_chest": dict(trial="141_11", cut=(1.0, 2.3), moments={"contact": 0.55}, meta={"part": "hands"}),
    "throw_out": dict(trial="141_11", cut=(3.95, 5.4), moments={"contact": 0.48, "release": 0.48}, meta={"part": "handR"}),

    # ── feelings ────────────────────────────────────────────────────────
    "celebrate_fist": dict(trial="79_69", cut=(0.6, 2.8)),
    "celebrate_jump": dict(trial="16_01", cut=(0.6, 2.3), src_edit=arms_up(0.35, 0.5, 0.95, 1.3),
                           adapted="a real jump, both fists thrown up at the top"),
    "celebrate_airplane": dict(trial="143_36", cut=(0.6, 3.6), end=True),
    "celebrate_safe": dict(trial="35_17", cut=(0.0, 1.39), loop=True, period=(0.6, 0.8), src_edit=arms_up(-1, 0, 9, 10),
                           adapted="a real jog with both arms held up"),
    "frustrated": dict(trial="79_74", cut=(1.5, 5.0)),
    "dejected": dict(trial="79_71", cut=(0.5, 5.5)),
    "slump_walk": dict(trial="82_10", cut=(0.5, 4.5), loop=True, period=(0.9, 1.6)),

    # ── cut scenes ──────────────────────────────────────────────────────
    "handshake": dict(trial="141_23", cut=(0.0, 2.13)),
    "wave": dict(trial="141_16", cut=(0.0, 2.49)),
    "applause": dict(trial="82_08", cut=(0.4, 3.4), src_edit=clap(0.1, 2.9), adapted="a real stand with the hands clapping in front of the chest"),
    "shirt_hold": dict(trial="82_08", cut=(4.0, 7.5),
                       src_edit=hold_hands({"L": (0.25, 1.2, 0.34), "R": (-0.25, 1.2, 0.34)}, 0.0, 0.5, 9, 10, wobble=0.004),
                       adapted="a real stand with both hands holding a shirt up at the chest for the camera"),
    # ── round 2 (9 Oct 2026): gaps filled ───────────────────────────────
    "walk_confident": dict(trial="82_09", cut=(0.5, 4.5), loop=True, period=(0.9, 1.4)),
    "sit_down": dict(trial="143_18", cut=(0.5, 2.1), face="end", end=True),
    "sit_idle": dict(trial="143_18", cut=(1.65, 2.35), face="start"),
    "stand_up": dict(trial="143_18", cut=(2.15, 3.5), face="start", end=True),
    "get_up_side": dict(trial="140_03", cut=(1.0, 6.6), rate=0.67, face="end"),
    "talk": dict(trial="18_08", cut=(2.0, 7.0)),
    "point": dict(trial="13_27", cut=(11.8, 13.6), face="start"),
    "nod": dict(trial="82_08", cut=(1.0, 3.0), src_edit=nod([0.3, 0.95]), adapted="a real stand with two nods"),
    "hug": dict(trial="82_08", cut=(1.0, 4.0), src_edit=hug(0.1, 0.6, 2.4, 2.9), adapted="a real stand, leaning in with both arms round a man's back"),
    "chest_control": dict(trial="82_08", cut=(4.2, 5.4), moments={"contact": 0.45}, meta={"part": "chest"}, src_edit=chest_down(0.45),
                          adapted="a real stand: lean back, chest out, arms wide, then fold over to drop it"),
    "thigh_control": dict(trial="82_08", cut=(5.4, 6.4), moments={"contact": 0.36}, meta={"part": "thighR"}, src_edit=thigh_up("R", 0.36),
                          adapted="a real stand: the right knee up to meet the ball, then down with it"),
    "celebrate_roar": dict(trial="79_69", cut=(0.6, 2.8), src_edit=roar(0.25, 0.55, 1.8, 2.15), adapted="the real 'very happy' capture with chest out, head back and fists down by the hips"),
    "celebrate_pump": dict(trial="82_08", cut=(2.0, 4.2), src_edit=fist_pump(0.1, 2.1), adapted="a real stand with three right-fist pumps"),
}

# the old footballer (shop/garden) calls its loops by these names
UAL_NAMES = {"idle": ["Idle_Loop"], "jog": ["Jog_Fwd_Loop"], "walk": ["Walk_Loop"]}
