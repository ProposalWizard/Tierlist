"""KEYED clips for moves no free capture has (a goalkeeper's dive, a slide
tackle, a knee slide). Made by hand in the same pose language as
tools/anims3d/clips.py, baked onto the same skeletons and written into
mocap.glb next to the captured clips (so Settings → Look → Motion: Old still
plays the old hand-made ones).

Each is checked against what real footage shows (written down per clip):
weight loads onto the push-off foot, the body leaves the ground extended with
the hands leading, the ground is met hip-and-forearm first with a small
bounce, and he gets up through a kneel, never by floating upright.

Same meta keys the game already reads: contact (the reach / the strike),
launch, land, part, foot, end. `getUp` marks a dive that gets back up inside
the clip (lib/star/play3d/scene.ts lets it finish).
"""
import os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "anims3d"))
from curves import K, ease, lerp  # noqa: E402
from clips import (chest, hang, arm, rest_ankle, leg, neutral, keeper_set, leg_dir, mirror, SX,  # noqa: E402
                   runner)

PI = np.pi


def _clampY(a):
    a = np.array(a, float)
    a[1] = max(0.0, a[1])
    return a


# ── keeper dives ─────────────────────────────────────────────────────────
# One generator, three heights. Real technique (described from broadcast
# footage of top keepers): from the set position a short power step out with
# the NEAR foot (left for a dive to his left), the weight drops onto it, he
# explodes off it while the far knee drives up and across; the body goes out
# straight and on its side, both hands leading, the top hand over the bottom
# one; he lands on the side of the hip and forearm, never the elbow point,
# bounces a little, gathers, then rolls to a knee and gets back up into the set.

DIVE_LAUNCH = 0.16
DIVE_REACH = {"low": 0.40, "mid": 0.44, "high": 0.48}
DIVE_LAND = {"low": 0.56, "mid": 0.66, "high": 0.80}
DIVE_DUR = 2.35


def dive(height):
    reach_t = DIVE_REACH[height]
    land_t = DIVE_LAND[height]
    # peak hips lift and how the body lies at full stretch
    lift = {"low": -0.30, "mid": 0.02, "high": 0.30}[height]
    hand_up = {"low": -0.35, "mid": 0.05, "high": 0.45}[height]  # hands below/along/above the line of the body

    def fn(rig, t):
        T0, T1 = 1.12, 2.05  # the get-up: starts, back in the set
        # roll: he goes onto his left side; after the gather he rolls back toward his front
        roll = K([(0, 0), (DIVE_LAUNCH - 0.04, 0.10), (DIVE_LAUNCH + 0.06, -0.55), (reach_t, -1.35), (land_t, -1.52),
                  (land_t + 0.12, -1.45), (0.98, -1.40), (T0, -1.30), (T0 + 0.28, -0.55), (T0 + 0.55, -0.12), (T1, 0.0), (DIVE_DUR, 0.0)], t)
        pit = K([(0, 0.22), (DIVE_LAUNCH, 0.30), (reach_t, 0.12), (land_t, 0.18), (0.98, 0.30), (T0, 0.35),
                 (T0 + 0.28, 0.85), (T0 + 0.55, 0.55), (T0 + 0.8, 0.35), (T1, 0.22), (DIVE_DUR, 0.22)], t)
        hy = K([(0, -0.17), (DIVE_LAUNCH - 0.06, -0.20), (DIVE_LAUNCH, -0.27), (DIVE_LAUNCH + 0.08, -0.12 + 0.5 * lift),
                (reach_t, -0.22 + lift), (land_t - 0.06, -0.62 + 0.4 * max(lift, 0)), (land_t, -0.80), (land_t + 0.07, -0.74),
                (land_t + 0.16, -0.80), (T0, -0.80), (T0 + 0.28, -0.60), (T0 + 0.55, -0.50), (T0 + 0.8, -0.30), (T1, -0.17), (DIVE_DUR, -0.17)], t)
        hx = K([(0, 0), (DIVE_LAUNCH, 0.10), (reach_t, 0.12), (land_t, 0.14), (T0, 0.14), (T0 + 0.55, 0.10), (T1, 0.0), (DIVE_DUR, 0.0)], t)
        hz = K([(0, 0.02), (reach_t, 0.10), (T0, 0.10), (T1, 0.02), (DIVE_DUR, 0.02)], t)
        off, rot = (hx, hy, hz), (pit, K([(0, 0), (reach_t, 0.10), (T0, 0.1), (T1, 0)], t), roll)
        p = {"hips": {"pos": off, "rot": rot}}
        # body straight in the air, a slight crunch on the gather, upright at the end
        p["spine"] = (K([(0, 0.22), (DIVE_LAUNCH, 0.30), (reach_t, 0.0), (land_t, 0.05), (0.98, 0.35), (T0 + 0.4, 0.35), (T1, 0.22), (DIVE_DUR, 0.22)], t),
                      0.05, K([(0, 0), (reach_t, -0.22), (land_t, -0.08), (T0, -0.05), (T1, 0), (DIVE_DUR, 0)], t))
        # eyes on the ball the whole way: head counter-rolls to stay level-ish
        p["head"] = (K([(0, -0.2), (reach_t, -0.10), (land_t, 0.0), (T0, -0.05), (T1, -0.2), (DIVE_DUR, -0.2)], t), 0.15,
                     K([(0, 0), (reach_t, 0.40), (land_t, 0.55), (T0, 0.5), (T0 + 0.5, 0.15), (T1, 0), (DIVE_DUR, 0)], t))
        aL, aR = rest_ankle(rig, "L"), rest_ankle(rig, "R")
        set_l = np.array([aL[0] * 1.55, 0.0, aL[1] + 0.02])
        set_r = np.array([aR[0] * 1.55, 0.0, aR[1] + 0.02])
        air = K([(0, 0), (DIVE_LAUNCH, 0), (DIVE_LAUNCH + 0.10, 1), (T0, 1), (T0 + 0.25, 0), (DIVE_DUR, 0)], t)
        # LEFT (near) foot: the power step out, loads, pushes off last (toes)
        stepL = set_l + np.array([K([(0, 0), (0.08, 0.20)], t), K([(0, 0), (0.04, 0.07), (0.08, 0.0)], t), 0.0])
        flyL = leg_dir(rig, "L", off, rot, (0.05, -1, 0.10), 0.97)  # straight out behind the line of the body
        flyR = leg_dir(rig, "R", off, rot, (-0.20, -0.80, 0.55), 0.70)  # the far knee driven up and across
        # get-up: right knee down under him, left foot planted, then stand
        kneelR = np.array([aR[0] * 1.2 + 0.05, 0.04, aR[1] - 0.30])
        plantL = set_l  # the near foot comes down where it stays: no sliding on the get-up
        up = K([(0, 0), (T0 + 0.25, 0), (T0 + 0.55, 1), (T1, 1), (DIVE_DUR, 1)], t)
        stand = K([(0, 0), (T0 + 0.55, 0), (T1, 1), (DIVE_DUR, 1)], t)
        gL = lerp(lerp(stepL, flyL, air), lerp(plantL, set_l, stand), up)
        gR = lerp(lerp(set_r, flyR, air), lerp(kneelR, set_r, stand), up) + np.array([0, K([(0, 0), (T0 + 0.55, 0), (T0 + 0.78, 0.14), (T1 - 0.08, 0), (DIVE_DUR, 0)], t), 0])
        p["legL"] = leg(_clampY(gL), pitch=K([(0, 0.15), (DIVE_LAUNCH - 0.02, -0.25), (DIVE_LAUNCH + 0.05, 0.6), (T0, 0.5), (T0 + 0.55, 0.1), (T1, 0.15), (DIVE_DUR, 0.15)], t),
                        side="L", pole=(0.5, 0.1, 1))
        p["legR"] = leg(_clampY(gR), pitch=K([(0, 0.15), (DIVE_LAUNCH + 0.05, 0.4), (T0, 0.4), (T0 + 0.4, 0.9), (T0 + 0.8, 0.3), (T1, 0.15), (DIVE_DUR, 0.15)], t),
                        side="R", pole=(-0.3, 0, 1))
        # hands: from the set, thrown along the line of the dive (top hand over bottom), gather the ball in, push off the grass, back to the set
        reach = K([(0, 0), (DIVE_LAUNCH, 0.12), (DIVE_LAUNCH + 0.12, 0.8), (reach_t, 1), (land_t - 0.04, 1), (land_t + 0.18, 0.0), (DIVE_DUR, 0)], t)
        gather = K([(0, 0), (land_t - 0.04, 0), (land_t + 0.18, 1), (T0, 1), (T0 + 0.2, 0), (DIVE_DUR, 0)], t)
        push = K([(0, 0), (T0, 0), (T0 + 0.2, 1), (T0 + 0.6, 1), (T0 + 0.85, 0), (DIVE_DUR, 0)], t)
        setH = (lambda s: lambda c: chest(c, s, (0.14, -0.30, 0.34)))
        reachL = lambda c: chest(c, "L", (0.02, 0.66, 0.18 + 0.12 * hand_up))
        reachR = lambda c: chest(c, "R", (-0.18, 0.63, 0.30 + 0.12 * hand_up))
        held = lambda c: c.chest((0.0, -0.10, 0.30))
        pushL = lambda c: c.chest((0.32, -0.55, 0.20))

        def hand(s, rch):
            def f(c):
                h = lerp(setH(s)(c), rch(c), reach)
                h = lerp(h, held(c) + np.array([SX[s] * 0.07, 0, 0]), gather)
                if s == "L":
                    g = pushL(c)
                    g = np.array([g[0], max(0.04, g[1]), g[2]])
                    h = lerp(h, g, push)
                return h
            return f
        p["armL"] = arm(hand("L", reachL), "L", pole=(0.3, 0.1, -1))
        p["armR"] = arm(hand("R", reachR), "R", pole=(-0.3, 0.1, -1))
        return p
    return fn


# ── slide tackle ─────────────────────────────────────────────────────────
# Real: two running strides in, he drops onto the outside of the LEFT thigh and
# hip (left leg bent under), the RIGHT leg goes out straight along the grass, the
# foot hooked, and meets the ball; left hand trails on the grass, right arm out
# for balance; slides about a metre and a half on the thigh; pushes up off the
# left hand and the bent leg.
SLIDE_CONTACT = 0.62
SLIDE_END = 2.15


def sliding_tackle(rig, t):
    aL, aR = rest_ankle(rig, "L"), rest_ankle(rig, "R")
    down = K([(0, 0), (0.30, 0), (0.44, 1), (1.22, 1), (1.55, 0), (1.9, 0)], t)
    roll = K([(0, 0), (0.30, -0.10), (0.46, -0.62), (SLIDE_CONTACT, -0.72), (1.15, -0.70), (1.45, -0.35), (1.75, -0.05), (1.9, 0)], t)
    pit = K([(0, 0.18), (0.30, 0.10), (0.46, -0.70), (SLIDE_CONTACT, -0.82), (1.15, -0.78), (1.45, -0.15), (1.75, 0.2), (2.0, 0.05)], t)
    hy = K([(0, -0.04), (0.12, -0.02), (0.22, -0.06), (0.30, -0.16), (0.46, -0.66), (SLIDE_CONTACT, -0.76), (1.15, -0.78),
            (1.45, -0.55), (1.75, -0.16), (2.0, -0.03), (SLIDE_END, -0.012)], t)
    # run in at ~5 m/s, then the slide decelerates on the grass
    # (the game starts this clip at the strike, so the run-in is short and the hips stay near where he is)
    hz = K([(0, 0), (0.30, 0.40), (0.46, 0.62), (SLIDE_CONTACT, 0.85), (0.9, 1.18), (1.15, 1.34), (1.5, 1.40), (SLIDE_END, 1.45)], t)
    hx = K([(0, 0), (0.4, 0.10), (1.2, 0.12), (SLIDE_END, 0.02)], t)
    off, rot = (hx, hy, hz), (pit, 0.08, roll)
    p = {"hips": {"pos": off, "rot": rot}}
    p["spine"] = (K([(0, 0.15), (0.3, 0.2), (0.46, 0.50), (SLIDE_CONTACT, 0.55), (1.15, 0.45), (1.5, 0.35), (1.9, 0.08), (SLIDE_END, 0.02)], t), 0, -roll * 0.35)
    p["head"] = (K([(0, 0.25), (0.46, 0.45), (1.15, 0.5), (1.9, 0.1), (SLIDE_END, 0.05)], t), 0, -roll * 0.5)
    # running strides before the drop (R, L, then the right goes out)
    run = 1 - down
    fr = K([(0, (aR[0], 0, aR[1])), (0.10, (aR[0], 0.18, aR[1] + 0.25)), (0.18, (aR[0], 0.0, aR[1] + 0.45)),
            (0.30, (aR[0], 0.05, aR[1] + 0.55))], t)
    fl = K([(0, (aL[0], 0, aL[1])), (0.10, (aL[0], 0, aL[1])), (0.20, (aL[0], 0.20, aL[1] + 0.45)), (0.28, (aL[0], 0.0, aL[1] + 0.75)),
            (0.36, (aL[0], 0.0, aL[1] + 0.80))], t)
    if t >= 0.30:
        fr = np.array([aR[0], 0.05, aR[1] + 0.55 + (hz - 0.40)])
    b = rig.b
    from clips import body_at
    hR = body_at(rig, off, rot, rig.restP[b["thighR"]] - rig.restP[b["hips"]])
    hL = body_at(rig, off, rot, rig.restP[b["thighL"]] - rig.restP[b["hips"]])
    Lr = (rig.L["thighR"] + rig.L["shinR"]) * 0.98
    drop = max(0.0, hR[1] - rig.ankleY)
    rs = np.array([hR[0] - 0.05, 0.0, hR[2] + np.sqrt(max(0.01, Lr * Lr - drop * drop))])
    ls = np.array([hL[0] + 0.16, 0.0, hL[2] - 0.08])
    # getting up: the left foot plants under him, then the right comes back
    up = K([(0, 0), (1.25, 0), (1.6, 1), (SLIDE_END, 1)], t)
    standL = np.array([aL[0], 0.0, aL[1] + hz])
    standR = np.array([aR[0], 0.0, aR[1] + hz])
    gR = lerp(lerp(fr, rs, down), lerp(np.array([hR[0] - 0.05, 0.0, hR[2] + 0.45]), standR, K([(0, 0), (1.6, 0), (2.0, 1)], t)), up)
    gL = lerp(lerp(fl, ls, down), lerp(np.array([hL[0] + 0.10, 0.0, hL[2] + 0.05]), standL, K([(0, 0), (1.55, 0), (1.85, 1)], t)), up)
    p["legR"] = leg(_clampY(gR), pitch=K([(0, 0), (0.3, 0.2), (0.46, -0.35), (1.2, -0.35), (1.6, 0.1), (2.0, 0)], t), side="R",
                    pole=(-0.12, 1, 0.3) if down > 0.5 else (-0.12, 0, 1))
    p["legL"] = leg(_clampY(gL), pitch=0.35 * down, side="L", pole=(1, 0.2, 0.5) if down > 0.5 else (0.12, 0, 1))
    sw = K([(0, 0), (0.10, 1), (0.20, -1), (0.30, 1)], t) * run
    runL = lambda c: chest(c, "L", (0.10, -0.30 + 0.06 * sw, 0.02 - 0.24 * sw))
    runR = lambda c: chest(c, "R", (0.10, -0.30 - 0.06 * sw, 0.02 + 0.24 * sw))
    trail = lambda c: np.array([chest(c, "L", (0.42, -0.55, -0.25))[0], 0.05, chest(c, "L", (0.42, -0.55, -0.25))[2]])
    p["armL"] = arm(lambda c, k=down: lerp(runL(c), trail(c), k), "L", pole=(0.6, -0.2, -0.8))
    p["armR"] = arm(lambda c, k=down: lerp(runR(c), chest(c, "R", (0.45, 0.10, 0.12)), k), "R", pole=(-0.5, -0.6, -0.5))
    return p


# ── knee slide celebration ───────────────────────────────────────────────
# Real: three quick strides, he drops onto both knees together, shins flat on
# the grass and the laces down, slides about three metres leaning back, arms
# flung wide with clenched fists, chest out, head back roaring; stops, arms up.
KS_DROP = 0.55
KS_END = 3.2


def knee_slide(rig, t):
    aL, aR = rest_ankle(rig, "L"), rest_ankle(rig, "R")
    th = (rig.L["thighL"] + rig.L["thighR"]) / 2
    hips0 = rig.restP[rig.b["hips"]][1]
    kneel_y = (th + 0.06) - hips0  # hips over the knees, knees on the grass
    down = K([(0, 0), (KS_DROP - 0.10, 0), (KS_DROP + 0.05, 1), (KS_END, 1)], t)
    lean = K([(0, 0.15), (KS_DROP, 0.10), (KS_DROP + 0.25, -0.30), (1.9, -0.45), (2.4, -0.25), (KS_END, -0.15)], t)
    hz = K([(0, 0), (0.18, 0.95), (0.36, 1.95), (KS_DROP, 2.90), (KS_DROP + 0.5, 4.60), (1.4, 5.55), (1.9, 5.85), (KS_END, 5.88)], t)
    hy = K([(0, -0.03), (0.09, 0.0), (0.18, -0.05), (0.27, 0.0), (0.36, -0.05), (KS_DROP - 0.08, -0.08), (KS_DROP + 0.05, kneel_y - 0.02),
            (KS_DROP + 0.12, kneel_y + 0.01), (1.9, kneel_y), (KS_END, kneel_y + 0.02)], t)
    off, rot = (0.0, hy, hz), (lean * 0.6, 0, 0)
    p = {"hips": {"pos": off, "rot": rot}}
    p["spine"] = (lean * 0.8 + 0.1 * (1 - down), 0, 0)
    p["head"] = (K([(0, 0.1), (KS_DROP, 0.0), (KS_DROP + 0.3, -0.45), (1.9, -0.55), (2.5, -0.35), (KS_END, -0.3)], t), 0, 0)
    # strides: R, L, R, then both drop
    fr = K([(0, (aR[0], 0, aR[1])), (0.09, (aR[0], 0.25, aR[1] + 0.95)), (0.18, (aR[0], 0, aR[1] + 1.80)),
            (0.36, (aR[0], 0, aR[1] + 1.80)), (0.45, (aR[0], 0.25, aR[1] + 2.70)), (KS_DROP, (aR[0], 0.1, aR[1] + 3.0))], t)
    fl = K([(0, (aL[0], 0, aL[1])), (0.18, (aL[0], 0, aL[1])), (0.27, (aL[0], 0.25, aL[1] + 1.4)), (0.36, (aL[0], 0, aL[1] + 2.4)),
            (KS_DROP - 0.05, (aL[0], 0.05, aL[1] + 2.6)), (KS_DROP, (aL[0], 0.1, aL[1] + 2.9))], t)
    sh = (rig.L["shinL"] + rig.L["shinR"]) / 2
    for s, f in (("L", fl), ("R", fr)):
        a = aL if s == "L" else aR
        knee = np.array([a[0] * 1.15, 0.0, hz + a[1] + 0.12])
        kneel_ank = np.array([a[0] * 1.2, 0.06, knee[2] - sh * 0.96])
        g = lerp(np.asarray(f, float), kneel_ank, down)
        p["leg" + s] = leg(_clampY(g), pitch=lerp(0.0, 1.35, down), side=s, pole=(SX[s] * 0.1, -0.3, 1))
    wide = K([(0, 0), (KS_DROP, 0.2), (KS_DROP + 0.25, 1), (1.9, 1), (2.3, 0), (KS_END, 0)], t)
    upk = K([(0, 0), (1.9, 0), (2.3, 1), (KS_END, 1)], t)
    sw = K([(0, 0), (0.09, 1), (0.18, -1), (0.27, 1), (0.36, -1), (0.45, 1)], t) * (1 - wide)
    for s in "LR":
        k = SX[s] if s == "L" else -1
        run = (lambda s, k: lambda c: chest(c, s, (0.10, -0.30 + 0.06 * k * sw, 0.02 + 0.24 * k * sw)))(s, k)
        wd = (lambda s: lambda c: chest(c, s, (0.62, 0.02, 0.08)))(s)
        hi = (lambda s: lambda c: chest(c, s, (0.22, 0.62, 0.10)))(s)
        p["arm" + s] = arm((lambda run, wd, hi: lambda c: lerp(lerp(run(c), wd(c), wide), hi(c), upk))(run, wd, hi), s, pole=(SX[s] * 0.6, -0.6, -0.4))
    return p


# ── poke tackle ──────────────────────────────────────────────────────────
# Real: a short approach step, he sinks low, the standing (left) leg bends deep,
# the right leg shoots out and the toe stabs at the ball at full stretch, arms
# out for balance, then he pulls the leg back and recovers onto both feet.
POKE_CONTACT = 0.36


def poke_tackle(rig, t):
    p = neutral(rig, t, breathe=False)
    aL, aR = rest_ankle(rig, "L"), rest_ankle(rig, "R")
    p["hips"] = {"pos": (0.04, K([(0, -0.04), (0.12, -0.06), (0.24, -0.20), (POKE_CONTACT, -0.30), (0.55, -0.24), (0.8, -0.08), (1.0, -0.03)], t),
                         K([(0, 0), (0.12, 0.12), (POKE_CONTACT, 0.42), (0.6, 0.45), (1.0, 0.40)], t)),
                 "rot": (K([(0, 0.08), (POKE_CONTACT, 0.22), (0.7, 0.1), (1.0, 0.05)], t), K([(0, 0), (0.24, 0.25), (POKE_CONTACT, 0.15), (1.0, 0)], t), 0.06)}
    p["spine"] = (K([(0, 0.12), (POKE_CONTACT, 0.38), (0.7, 0.18), (1.0, 0.08)], t), -0.12, 0)
    p["head"] = (0.5, -0.1, 0)
    p["legL"] = leg(K([(0, (aL[0], 0, aL[1])), (0.08, (aL[0], 0.07, aL[1] + 0.18)), (0.18, (aL[0] + 0.02, 0, aL[1] + 0.40)), (1.0, (aL[0] + 0.02, 0, aL[1] + 0.40))], t),
                    pitch=K([(0, 0), (0.2, 0), (POKE_CONTACT, -0.15), (0.6, 0), (1.0, 0)], t), side="L")
    ank = K([(0, (aR[0], 0, aR[1])), (0.18, (aR[0] - 0.02, 0.10, aR[1] + 0.20)), (0.28, (-0.16, 0.08, aR[1] + 0.85)),
             (POKE_CONTACT, (-0.17, 0.05, aR[1] + 1.22)), (0.48, (-0.16, 0.06, aR[1] + 1.10)), (0.66, (-0.14, 0.08, aR[1] + 0.70)),
             (0.82, (aR[0], 0.0, aR[1] + 0.42)), (1.0, (aR[0], 0, aR[1] + 0.42))], t)
    p["legR"] = leg(_clampY(ank), pitch=K([(0, 0), (0.2, 0.3), (POKE_CONTACT, 0.75), (0.55, 0.45), (0.82, 0), (1.0, 0)], t), side="R")
    bal = K([(0, 0), (0.24, 1), (0.6, 1), (1.0, 0)], t)
    p["armL"] = arm(lambda c: lerp(hang("L")(c), chest(c, "L", (0.48, -0.15, 0.25)), bal), "L", pole=(0.5, -0.5, -0.7))
    p["armR"] = arm(lambda c: lerp(hang("R")(c), chest(c, "R", (0.36, -0.20, -0.20)), bal), "R", pole=(-0.5, -0.5, -0.7))
    return p


# name: (duration, loop, fn, meta) — the same shape as tools/anims3d/clips.py
def _dive_meta(h):
    return {"contact": DIVE_REACH[h], "part": "hands", "launch": DIVE_LAUNCH, "land": DIVE_LAND[h], "getUp": 1.12,
            "source": "keyed (no free capture of a goalkeeper dive exists)"}


KEYED = {
    "dive_left": (DIVE_DUR, False, dive("mid"), _dive_meta("mid")),
    "dive_right": (DIVE_DUR, False, mirror(dive("mid")), _dive_meta("mid")),
    "dive_left_low": (DIVE_DUR, False, dive("low"), _dive_meta("low")),
    "dive_right_low": (DIVE_DUR, False, mirror(dive("low")), _dive_meta("low")),
    "dive_left_high": (DIVE_DUR, False, dive("high"), _dive_meta("high")),
    "dive_right_high": (DIVE_DUR, False, mirror(dive("high")), _dive_meta("high")),
    "sliding_tackle": (SLIDE_END, False, sliding_tackle, {"contact": SLIDE_CONTACT, "foot": "R", "end": [0, 1.45],
                                                          "source": "keyed (no free capture of a slide tackle exists)"}),
    "poke_tackle": (1.0, False, poke_tackle, {"contact": POKE_CONTACT, "foot": "R", "source": "keyed (no free capture of a poke tackle exists)"}),
    "knee_slide": (KS_END, False, knee_slide, {"end": [0, 5.88], "source": "keyed (no free capture of a knee slide exists)"}),
}
