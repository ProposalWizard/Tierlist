"""Read CMU motion capture (ASF skeleton + AMC motion), numpy only.

    sk = Skeleton("10.asf");  mo = Motion(sk, "10_01.amc")
    mo.fps (120), mo.n (frames), mo.R[name] (n, 3, 3) world turn of each bone,
    mo.P[name] (n, 3) world position of each bone's END (the joint below it),
    mo.root (n, 3) the root (pelvis) position.

Everything comes out in METRES, y up. CMU's rest pose faces +z with the
subject's left at +x (the same frame as our characters). Each bone's world
turn in the rest pose is the identity, so mo.R[name][f] is directly the
turn away from the rest pose (a T-pose, legs straight down) in world space.

Format (CMU "ASF/AMC", the Acclaim format): for every bone, `axis` gives a
fixed local frame C; each frame's local turn M is built from the bone's dofs
(rx ry rz, degrees) as Rz·Ry·Rx; world = parent · C · M · C⁻¹. Lengths are
in units of 1/0.45 inch.
"""
import numpy as np

UNIT = (1.0 / 0.45) * 0.0254  # ASF length unit -> metres


def rx(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def ry(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rz(a):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def euler_xyz(a, b, c):
    """Static-axis X then Y then Z (radians): Rz·Ry·Rx."""
    return rz(c) @ ry(b) @ rx(a)


class Bone:
    def __init__(self):
        self.name = ""
        self.direction = np.zeros(3)
        self.length = 0.0
        self.axis = np.zeros(3)
        self.dof = []
        self.children = []
        self.parent = None


class Skeleton:
    def __init__(self, path):
        txt = open(path).read().split("\n")
        self.bones = {}
        root = Bone()
        root.name = "root"
        root.dof = ["tx", "ty", "tz", "rx", "ry", "rz"]
        self.bones["root"] = root
        i = 0
        section = None
        cur = None
        while i < len(txt):
            line = txt[i].strip()
            i += 1
            if not line or line.startswith("#"):
                continue
            if line.startswith(":"):
                section = line.split()[0][1:]
                continue
            if section == "root":
                parts = line.split()
                if parts[0] == "order":
                    root.dof = [p.lower() for p in parts[1:]]
                elif parts[0] == "axis":
                    root.axis_order = parts[1]
            elif section == "bonedata":
                parts = line.split()
                if parts[0] == "begin":
                    cur = Bone()
                elif parts[0] == "end":
                    self.bones[cur.name] = cur
                    cur = None
                elif parts[0] == "name":
                    cur.name = parts[1]
                elif parts[0] == "direction":
                    cur.direction = np.array([float(x) for x in parts[1:4]])
                elif parts[0] == "length":
                    cur.length = float(parts[1]) * UNIT
                elif parts[0] == "axis":
                    cur.axis = np.radians([float(x) for x in parts[1:4]])
                elif parts[0] == "dof":
                    cur.dof = parts[1:]
            elif section == "hierarchy":
                parts = line.split()
                if parts[0] in ("begin", "end"):
                    continue
                p = parts[0]
                for c in parts[1:]:
                    self.bones[p].children.append(c)
                    self.bones[c].parent = p
        for b in self.bones.values():
            n = np.linalg.norm(b.direction)
            if n > 0:
                b.direction = b.direction / n
            b.C = euler_xyz(*b.axis)
            b.Cinv = b.C.T
        self.order = []

        def visit(n):
            self.order.append(n)
            for c in self.bones[n].children:
                visit(c)
        visit("root")

    def rest_positions(self):
        P = {"root": np.zeros(3)}
        for n in self.order[1:]:
            b = self.bones[n]
            P[n] = P[b.parent] + b.direction * b.length
        return P


class Motion:
    def __init__(self, sk, path, fps=120):
        self.sk = sk
        self.fps = fps
        frames = []
        cur = None
        for line in open(path):
            line = line.strip()
            if not line or line.startswith("#") or line.startswith(":"):
                continue
            parts = line.split()
            if parts[0].isdigit() and len(parts) == 1:
                cur = {}
                frames.append(cur)
                continue
            if cur is not None:
                cur[parts[0]] = [float(x) for x in parts[1:]]
        self.n = len(frames)
        self.R = {n: np.zeros((self.n, 3, 3)) for n in sk.order}
        self.P = {n: np.zeros((self.n, 3)) for n in sk.order}
        for f, fr in enumerate(frames):
            for n in sk.order:
                b = sk.bones[n]
                vals = fr.get(n, [])
                if n == "root":
                    d = dict(zip(b.dof, vals))
                    pos = np.array([d.get("tx", 0), d.get("ty", 0), d.get("tz", 0)]) * UNIT
                    M = euler_xyz(np.radians(d.get("rx", 0)), np.radians(d.get("ry", 0)), np.radians(d.get("rz", 0)))
                    self.R[n][f] = b.C @ M @ b.Cinv
                    self.P[n][f] = pos
                    continue
                ang = {"rx": 0.0, "ry": 0.0, "rz": 0.0}
                for k, v in zip(b.dof, vals):
                    ang[k] = np.radians(v)
                M = euler_xyz(ang["rx"], ang["ry"], ang["rz"])
                W = self.R[b.parent][f] @ b.C @ M @ b.Cinv
                self.R[n][f] = W
                self.P[n][f] = self.P[b.parent][f] + W @ (b.direction * b.length)
        self.root = self.P["root"]

    def start(self, n):
        """World position of the START of bone n (its parent's end)."""
        b = self.sk.bones[n]
        return self.P[b.parent]
