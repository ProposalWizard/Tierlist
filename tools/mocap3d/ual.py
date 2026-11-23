"""Quaternius Universal Animation Library 1 (CC0) as a motion source for retarget.py.

The FBX is read once by Blender (read_ual.py) into tools/mocap3d/ual/ual1.json.gz:
every joint's world position and world turn away from its rest pose, per frame,
in our frame (x his left, y up, z his front). This file gives that the shape of
cmu.py's Skeleton / Motion, with the CMU bone names, so make.py and retarget.py
take a UAL clip exactly like a capture (trial "ual:<Clip_Name>" in clipdefs.py).
Same idea as video.py; never a second pipeline.

UAL loops are made IN PLACE (the feet slide back under him). retarget.py wants
real travel so it can see a planted foot as still and pin it, so a loop is
given back its travel first: his speed is the planted foot's own backward
speed (median over the stance), added to every point. The retarget then takes
it out again and writes it into the file as `speed`, like a CMU walk.
"""
import gzip, json, os
import numpy as np
from cmu import Bone

HERE = os.path.dirname(os.path.abspath(__file__))
DUMP = os.path.join(HERE, "ual", "ual1.json.gz")

# CMU bone -> (parent, UAL start joint, UAL end joint, UAL bone whose turn it takes)
SPEC = [
    ("root", None, None, None, "pelvis"),
    ("lhipjoint", "root", "pelvis", "thigh_l", "pelvis"), ("lfemur", "lhipjoint", "thigh_l", "calf_l", "thigh_l"),
    ("ltibia", "lfemur", "calf_l", "foot_l", "calf_l"), ("lfoot", "ltibia", "foot_l", "ball_l", "foot_l"),
    ("ltoes", "lfoot", "ball_l", "ball_leaf_l", "ball_l"),
    ("rhipjoint", "root", "pelvis", "thigh_r", "pelvis"), ("rfemur", "rhipjoint", "thigh_r", "calf_r", "thigh_r"),
    ("rtibia", "rfemur", "calf_r", "foot_r", "calf_r"), ("rfoot", "rtibia", "foot_r", "ball_r", "foot_r"),
    ("rtoes", "rfoot", "ball_r", "ball_leaf_r", "ball_r"),
    ("lowerback", "root", "spine_01", "spine_02", "spine_01"), ("upperback", "lowerback", "spine_02", "spine_03", "spine_02"),
    ("thorax", "upperback", "spine_03", "neck_01", "spine_03"),
    ("lowerneck", "thorax", "neck_01", "Head", "neck_01"), ("upperneck", "lowerneck", "neck_01", "Head", "neck_01"),
    ("head", "upperneck", "Head", "head_end", "Head"),
    ("lclavicle", "thorax", "clavicle_l", "upperarm_l", "clavicle_l"), ("lhumerus", "lclavicle", "upperarm_l", "lowerarm_l", "upperarm_l"),
    ("lradius", "lhumerus", "lowerarm_l", "hand_l", "lowerarm_l"), ("lwrist", "lradius", "lowerarm_l", "hand_l", "lowerarm_l"),
    ("lhand", "lwrist", "hand_l", "middle_01_l", "hand_l"),
    ("rclavicle", "thorax", "clavicle_r", "upperarm_r", "clavicle_r"), ("rhumerus", "rclavicle", "upperarm_r", "lowerarm_r", "upperarm_r"),
    ("rradius", "rhumerus", "lowerarm_r", "hand_r", "lowerarm_r"), ("rwrist", "rradius", "lowerarm_r", "hand_r", "lowerarm_r"),
    ("rhand", "rwrist", "hand_r", "middle_01_r", "hand_r"),
]
SHORT = {"upperneck", "lwrist", "rwrist"}  # stand-in bones CMU has and UAL does not: almost no length

_dump = None


def dump():
    global _dump
    if _dump is None:
        _dump = json.load(gzip.open(DUMP, "rt"))
    return _dump


class USkeleton:
    """cmu.Skeleton's fields, from the UAL rest pose."""

    def __init__(self, rest):
        self.bones = {}
        for name, parent, a, b, _ in SPEC:
            bo = Bone()
            bo.name, bo.parent = name, parent
            if a is None:
                bo.direction, bo.length = np.zeros(3), 0.0
            else:
                v = np.array(rest[b]) - np.array(rest[a])
                L = float(np.linalg.norm(v))
                bo.direction = v / L
                bo.length = 0.001 if name in SHORT else L
            bo.C, bo.Cinv, bo.dof = np.eye(3), np.eye(3), []
            self.bones[name] = bo
        for name, parent, *_ in SPEC:
            if parent:
                self.bones[parent].children.append(name)
        self.order = [s[0] for s in SPEC]
        self.rest = rest

    def rest_positions(self):
        P = {"root": np.zeros(3)}
        for n in self.order[1:]:
            b = self.bones[n]
            P[n] = P[b.parent] + b.direction * b.length
        return P


def stance_speed(fr, fps):
    """In place: how fast a planted foot slides back under him (m/s), median over both feet's stances."""
    out = []
    for f in ("ball_l", "ball_r"):  # the ball of the foot: a jog lands on it, the heel never comes down
        p = np.array([r[f][0] for r in fr])
        y = p[:, 1]
        low = y < y.min() + 0.006
        v = -np.gradient(p[:, 2]) * fps
        if low.sum() > 3:
            out.append(np.median(v[low]))
    return float(np.median(out)) if out else 0.0


class UMotion:
    """cmu.Motion's fields (sk, fps, n, R, P, root) for one UAL clip.
    repeat: play the clip this many times end to end (a loop's cycle search
    needs room); travel: True = give an in-place loop its walking travel back."""

    def __init__(self, clip, repeat=1, travel=False, speed=None):
        d = dump()
        fr = d["clips"][clip]
        self.fps = float(d["fps"])
        base = fr[:-1] if repeat > 1 else fr  # a loop's last frame is its first
        frames = base * repeat + ([fr[-1]] if repeat > 1 else [])
        self.n = len(frames)
        self.sk = USkeleton(d["rest"])
        self.speed = (stance_speed(fr, self.fps) if speed is None else speed) if travel else 0.0
        t = np.arange(self.n) / self.fps
        shift = np.zeros((self.n, 3))
        shift[:, 2] = self.speed * t
        pos = lambda j: np.array([r[j][0] for r in frames]) + shift
        rot = lambda j: np.array([np.array(r[j][1]).reshape(3, 3) for r in frames])
        self.R, self.P = {}, {}
        for name, parent, a, b, rb in SPEC:
            self.R[name] = rot(rb)
            if a is None:
                self.P[name] = pos("pelvis")
            elif b == "head_end":
                self.P[name] = pos("Head") + np.einsum("nij,j->ni", self.R[name], np.array(d["rest"]["head_end"]) - np.array(d["rest"]["Head"]))
            elif name in SHORT:
                self.P[name] = pos(a) + np.einsum("nij,j->ni", self.R[name], self.sk.bones[name].direction * 0.001)
            else:
                self.P[name] = pos(b)
        self.root = self.P["root"]

    def start(self, name):
        return self.P[self.sk.bones[name].parent]


def motion(trial):
    """trial "ual:<Clip>[:x<repeat>][:travel]"."""
    parts = trial.split(":")
    clip = parts[1]
    rep = next((int(p[1:]) for p in parts[2:] if p.startswith("x")), 1)
    return UMotion(clip, repeat=rep, travel="travel" in parts[2:])
