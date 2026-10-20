"""A VIDEO as a motion source: MediaPipe body landmarks -> the same Skeleton/Motion shape as cmu.py.

B5c (20 Oct 2026, Harry: "generate the cutscenes exactly how they are now …
that's going to give you fluid movement to copy off of"). A reference video
of real-looking people (Higgsfield) is read by tools/motionref/pose_video.py
(MediaPipe Pose, 33 points a frame, metres, centred on the hips) into
tools/mocap3d/video/<name>.npz. This file turns those points into a CMU-style
skeleton and motion, with the CMU bone names, so retarget.py / make.py take
it exactly like a capture: a new source is this converter plus a clip entry
(clipdefs.py, trial "video:<name>:<person>"), never a second pipeline.

How each bone's turn is found from points (rest = CMU's T-pose: x his left,
y up, z his front):
  - hips/spine: up = hips' middle -> shoulders' middle; across = the hip
    line (hips), blended to the shoulder line up the spine (twist);
  - neck/head: the ears and the nose;
  - upper arm: along shoulder -> elbow; its twist from the plane the elbow
    bends in (the forearm's side), the chest's front when the arm is straight;
  - forearm, hand: swing only onto elbow -> wrist and wrist -> knuckles (the
    retarget keeps forearm twist from the upper arm anyway);
  - thigh: hip -> knee, twisted by the knee's bend plane; shin, foot: swing.
Points are cleaned first: a 7-frame running median (a hidden limb's one-frame
jumps) and a 6 Hz two-way low-pass (no lag). There is no travel in the points
(MediaPipe centres them on the hips each frame), so clips from video are
in-place; feet are pinned while planted by the retarget as usual.
"""
import numpy as np

from cmu import Bone

# MediaPipe Pose landmark indices
NOSE, EAR_L, EAR_R = 0, 7, 8
SH_L, SH_R, EL_L, EL_R, WR_L, WR_R = 11, 12, 13, 14, 15, 16
PK_L, PK_R, IX_L, IX_R = 17, 18, 19, 20
HIP_L, HIP_R, KN_L, KN_R, AN_L, AN_R = 23, 24, 25, 26, 27, 28
HEEL_L, HEEL_R, FT_L, FT_R = 29, 30, 31, 32

X, Y, Z = np.array([1.0, 0, 0]), np.array([0, 1.0, 0]), np.array([0, 0, 1.0])
# the collarbones rise a little and run back to the shoulder, as a CMU actor's do (subject 82's ASF):
# a flat one put our shoulders forward and down (a rounded back on the first video idle)
CLAV_L = np.array([0.968, 0.236, -0.082]) / np.linalg.norm([0.968, 0.236, -0.082])
CLAV_R = np.array([-0.978, 0.208, 0.002]) / np.linalg.norm([-0.978, 0.208, 0.002])


def _lowpass(x, fps, hz=6.0):
    w = np.tan(np.pi * hz / fps)
    k1, k2 = np.sqrt(2) * w, w * w
    a0 = 1 + k1 + k2
    b = np.array([k2, 2 * k2, k2]) / a0
    a = np.array([1, 2 * (k2 - 1) / a0, (1 - k1 + k2) / a0])

    def run(y):
        out = np.zeros_like(y)
        x1 = x2 = y[0]
        y1 = y2 = y[0]
        for i in range(len(y)):
            v = b[0] * y[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2
            x2, x1 = x1, y[i]
            y2, y1 = y1, v
            out[i] = v
        return out

    return np.stack([run(run(x[:, j])[::-1])[::-1] for j in range(x.shape[1])], axis=1)


def clean(P, fps):
    """(n,33,3) -> median then low-pass, every coordinate."""
    n = len(P)
    pad = np.concatenate([P[:1].repeat(3, 0), P, P[-1:].repeat(3, 0)])
    P = np.median(np.stack([pad[i:i + n] for i in range(7)]), axis=0)
    return _lowpass(P.reshape(n, -1), fps).reshape(n, 33, 3)


def unit(v):
    return v / (np.linalg.norm(v, axis=-1, keepdims=True) + 1e-9)


def basis(d, t):
    """Rows-to-columns frame [d, t', d x t'] (t' = t made square to d)."""
    d = unit(d)
    t = unit(t - d * np.sum(t * d, axis=-1, keepdims=True))
    return np.stack([d, t, np.cross(d, t)], axis=-1)  # (..., 3, 3) columns


def turn(d_obs, t_obs, d_rest, t_rest):
    """World turn taking the rest frame (d_rest, t_rest) onto the observed one."""
    B_obs = basis(d_obs, t_obs)
    B_rest = basis(np.broadcast_to(d_rest, d_obs.shape), np.broadcast_to(t_rest, d_obs.shape))
    return B_obs @ np.swapaxes(B_rest, -1, -2)


def swing(R_parent, d_rest, d_obs):
    """R_parent carried, then swung (shortest turn) so d_rest points along d_obs."""
    cur = unit(np.einsum("nij,j->ni", R_parent, d_rest))
    want = unit(d_obs)
    ax = np.cross(cur, want)
    s = np.linalg.norm(ax, axis=1)
    c = np.sum(cur * want, axis=1)
    ang = np.arctan2(s, c)
    ax = ax / (s[:, None] + 1e-12)
    K = np.zeros((len(ax), 3, 3))
    K[:, 0, 1], K[:, 0, 2], K[:, 1, 0] = -ax[:, 2], ax[:, 1], ax[:, 2]
    K[:, 1, 2], K[:, 2, 0], K[:, 2, 1] = -ax[:, 0], -ax[:, 1], ax[:, 0]
    I = np.eye(3)[None]
    Rs = I + np.sin(ang)[:, None, None] * K + (1 - np.cos(ang))[:, None, None] * (K @ K)
    return Rs @ R_parent


class VSkeleton:
    """CMU-shaped skeleton (cmu.Skeleton's fields) with lengths from the video."""

    def __init__(self, lengths):
        self.bones = {}
        spec = [  # name, parent, rest direction, length key
            ("root", None, None, None),
            ("lhipjoint", "root", X, "hipw"), ("lfemur", "lhipjoint", -Y, "thigh"), ("ltibia", "lfemur", -Y, "shin"),
            ("lfoot", "ltibia", Z, "foot"), ("ltoes", "lfoot", Z, "toe"),
            ("rhipjoint", "root", -X, "hipw"), ("rfemur", "rhipjoint", -Y, "thigh"), ("rtibia", "rfemur", -Y, "shin"),
            ("rfoot", "rtibia", Z, "foot"), ("rtoes", "rfoot", Z, "toe"),
            ("lowerback", "root", Y, "spine"), ("upperback", "lowerback", Y, "spine"), ("thorax", "upperback", Y, "spine"),
            ("lowerneck", "thorax", Y, "neck"), ("upperneck", "lowerneck", Y, "neck2"), ("head", "upperneck", Y, "head"),
            ("lclavicle", "thorax", CLAV_L, "shw"), ("lhumerus", "lclavicle", X, "upper"), ("lradius", "lhumerus", X, "fore"),
            ("lwrist", "lradius", X, "wrist"), ("lhand", "lwrist", X, "hand"),
            ("rclavicle", "thorax", CLAV_R, "shw"), ("rhumerus", "rclavicle", -X, "upper"), ("rradius", "rhumerus", -X, "fore"),
            ("rwrist", "rradius", -X, "wrist"), ("rhand", "rwrist", -X, "hand"),
        ]
        for name, parent, d, lk in spec:
            b = Bone()
            b.name = name
            b.parent = parent
            b.direction = np.zeros(3) if d is None else np.asarray(d, float)
            b.length = 0.0 if lk is None else float(lengths[lk])
            b.C = np.eye(3)
            b.Cinv = np.eye(3)
            b.dof = []
            self.bones[name] = b
        for name, parent, _, _ in spec:
            if parent:
                self.bones[parent].children.append(name)
        self.order = [s[0] for s in spec]

    def rest_positions(self):
        P = {"root": np.zeros(3)}
        for n in self.order[1:]:
            b = self.bones[n]
            P[n] = P[b.parent] + b.direction * b.length
        return P


class VMotion:
    """cmu.Motion's fields (sk, fps, n, R, P, root) from video landmarks."""

    def __init__(self, world, fps):
        P = clean(np.asarray(world, float), fps)
        n = len(P)
        self.fps, self.n = fps, n
        g = lambda i: P[:, i]
        hipC = (g(HIP_L) + g(HIP_R)) / 2
        shC = (g(SH_L) + g(SH_R)) / 2
        ankle = {"l": g(AN_L), "r": g(AN_R)}
        med = lambda a, b: float(np.median(np.linalg.norm(a - b, axis=1)))
        L = dict(
            hipw=med(g(HIP_L), hipC), thigh=(med(g(HIP_L), g(KN_L)) + med(g(HIP_R), g(KN_R))) / 2,
            shin=(med(g(KN_L), g(AN_L)) + med(g(KN_R), g(AN_R))) / 2,
            foot=(med(g(AN_L), g(FT_L)) + med(g(AN_R), g(FT_R))) / 2, toe=0.04,
            spine=med(shC, hipC) / 3, neck=med((g(EAR_L) + g(EAR_R)) / 2, shC) * 0.6,
            neck2=med((g(EAR_L) + g(EAR_R)) / 2, shC) * 0.2, head=0.12,
            shw=med(g(SH_L), shC), upper=(med(g(SH_L), g(EL_L)) + med(g(SH_R), g(EL_R))) / 2,
            fore=(med(g(EL_L), g(WR_L)) + med(g(EL_R), g(WR_R))) / 2, wrist=0.02,
            hand=(med(g(WR_L), (g(IX_L) + g(PK_L)) / 2) + med(g(WR_R), (g(IX_R) + g(PK_R)) / 2)) / 2 + 0.03,
        )
        self.sk = VSkeleton(L)
        sk = self.sk
        R = {}
        up = shC - hipC
        hipLine, shLine = g(HIP_L) - g(HIP_R), g(SH_L) - g(SH_R)

        def neutral(vec, Rparent):
            """The clip's own average of a direction in its parent's frame: the points' bias.
            MediaPipe puts the ears ahead of the shoulders and the shoulders a little behind
            the hips in depth; taken literally, every video man stands with his chin pushed
            out and his back arched (seen on the first video idle: head 53° forward of the
            neck vs 11° in the CMU idle). Measured against this average instead, he keeps
            every movement of his own but stands the way a capture actor does on average."""
            loc = unit(np.einsum("nji,nj->ni", Rparent, unit(vec)))
            m = unit(np.median(loc, axis=0))
            return m

        I3 = np.repeat(np.eye(3)[None], n, axis=0)
        upN = neutral(up, I3)
        upN = unit(upN * np.array([0.3, 1.0, 0.3]))  # keep a little of his own average lean, not all
        R["root"] = turn(up, hipLine, upN, X)
        R["lowerback"] = turn(up, hipLine * 0.75 + shLine * 0.25, upN, X)
        R["upperback"] = turn(up, hipLine * 0.35 + shLine * 0.65, upN, X)
        R["thorax"] = turn(up, shLine, upN, X)
        earC = (g(EAR_L) + g(EAR_R)) / 2
        neckN = neutral(earC - shC, R["thorax"])
        R["lowerneck"] = turn(earC - shC, shLine, neckN, X)
        R["upperneck"] = R["lowerneck"]
        earLine = g(EAR_L) - g(EAR_R)
        face = g(NOSE) - earC
        headUp = np.cross(face, earLine)
        headN = neutral(headUp, R["lowerneck"])
        R["head"] = turn(headUp, earLine, headN, X)
        chestFwd = np.einsum("nij,j->ni", R["thorax"], Z)
        pelvFwd = np.einsum("nij,j->ni", R["root"], Z)
        for s, sx, SH, EL, WR, IX, PK in (("l", 1, SH_L, EL_L, WR_L, IX_L, PK_L), ("r", -1, SH_R, EL_R, WR_R, IX_R, PK_R)):
            R[s + "clavicle"] = R["thorax"]
            upper = g(EL) - g(SH)
            fore = g(WR) - g(EL)
            bend = np.linalg.norm(np.cross(unit(upper), unit(fore)), axis=1)  # sin of the elbow bend
            perp = fore - unit(upper) * np.sum(fore * unit(upper), axis=1, keepdims=True)
            k = np.clip((bend - 0.15) / 0.35, 0, 1)[:, None]
            t = unit(perp) * k + chestFwd * (1 - k)
            R[s + "humerus"] = turn(upper, t, sx * X, Z)
            R[s + "radius"] = swing(R[s + "humerus"], sx * X, fore)
            R[s + "wrist"] = R[s + "radius"]
            R[s + "hand"] = swing(R[s + "radius"], sx * X, (g(IX) + g(PK)) / 2 - g(WR))
        for s, HP, KN, AN, FT in (("l", HIP_L, KN_L, AN_L, FT_L), ("r", HIP_R, KN_R, AN_R, FT_R)):
            R[s + "hipjoint"] = R["root"]
            thigh = g(KN) - g(HP)
            shin = g(AN) - g(KN)
            bend = np.linalg.norm(np.cross(unit(thigh), unit(shin)), axis=1)
            perp = shin - unit(thigh) * np.sum(shin * unit(thigh), axis=1, keepdims=True)
            k = np.clip((bend - 0.12) / 0.3, 0, 1)[:, None]
            t = unit(perp) * k + (-pelvFwd) * (1 - k)
            R[s + "femur"] = turn(thigh, t, -Y, -Z)
            R[s + "tibia"] = swing(R[s + "femur"], -Y, shin)
            R[s + "foot"] = swing(R[s + "tibia"], Z, g(FT) - g(AN))
            R[s + "toes"] = R[s + "foot"]
        self.R = R
        # positions: forward kinematics from the hips' middle with the video's own bone lengths
        Pp = {"root": hipC.copy()}
        for name in sk.order[1:]:
            b = sk.bones[name]
            Pp[name] = Pp[b.parent] + np.einsum("nij,j->ni", R[name], b.direction * b.length)
        self.P = Pp
        self.root = Pp["root"]
        del ankle

    def start(self, name):
        return self.P[self.sk.bones[name].parent]


def motion(npz_path, person="p0", t0=None, t1=None):
    z = np.load(npz_path, allow_pickle=True)
    fps = float(z["fps"])
    W = z[f"world_{person}"].copy()
    ok = z[f"ok_{person}"]
    for f in range(1, len(W)):
        if not ok[f]:
            W[f] = W[f - 1]
    first = int(np.argmax(ok))
    W[:first] = W[first]
    return VMotion(W, fps)
