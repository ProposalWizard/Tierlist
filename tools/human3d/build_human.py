"""
THE HUMAN BODY — one parametric person for every 3D scene (players, managers,
chairmen, journalists, fans), built from the MakeHuman base mesh (CC0).

Harry, 9 Oct 2026: "the player in-game model just doesn't even look human …
think of how in Pro Clubs on FIFA you can fully customise your player and then
he works into the animations and physics of the game."

    python3 tools/human3d/build_human.py <mpfb2 data dir> [out.glb]

<mpfb2 data dir> is src/mpfb/data of https://github.com/makehumancommunity/mpfb2
(its assets — base mesh, targets, rig, weights — are CC0; LICENSE.ASSETS.md).
Writes public/star/human3d/human.glb (then pack it: scripts/perf3d/shrink-models.mjs).

What is in the file:
  - One skinned mesh "Body": the body AND every part a person can wear (kit,
    hair styles, outfits, glasses), each triangle tagged with its part
    (attribute _PART). The game keeps only the parts a person has.
  - The SAME skeleton as the one body (lib/star/people3d.ts): same bone names,
    same parents, same rest turns, so every clip — today's and the motion-capture
    ones — plays on it unchanged. The MakeHuman body is posed into that rest
    pose first (arms, legs and hands turned to the old bones' directions).
  - Build shapes (morph targets): heavier, leaner, more muscle, softer, older,
    taller, shorter, belly, broad shoulders, longer legs, thick neck, and face
    shapes. Each shape also says how far every joint moves (scene extras
    `shapes[*].joints`), so a taller man's skeleton grows with him.
  - The measurements people3d.ts reads (joints, hands, fingers, face, kit lines).
"""
import gzip, json, os, struct, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
MPFB = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "-" else os.path.join(ROOT, "public", "star", "human3d", "human.glb")
ASSETS = sys.argv[3] if len(sys.argv) > 3 else None  # MakeHuman system assets (CC0), unzipped
REF = os.path.join(ROOT, "public", "star", "onebody", "player.glb")
sys.path.insert(0, os.path.join(ROOT, "scripts", "people3d"))
import glb  # noqa: E402

DM = 0.1  # MakeHuman units are decimetres


def unit(v):
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    return v / np.maximum(n, 1e-12)


# ── The base mesh ──────────────────────────────────────────────────────────

def load_obj(path):
    V, VT, F, FT, G = [], [], [], [], []
    group = ""
    for line in open(path):
        if line.startswith("v "):
            V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith("vt "):
            VT.append([float(x) for x in line.split()[1:3]])
        elif line.startswith("g "):
            group = line.split()[1]
        elif line.startswith("f "):
            vs, ts = [], []
            for tok in line.split()[1:]:
                a = tok.split("/")
                vs.append(int(a[0]) - 1)
                ts.append(int(a[1]) - 1 if len(a) > 1 and a[1] else -1)
            F.append(vs); FT.append(ts); G.append(group)
    return np.array(V), np.array(VT), F, FT, G


V0, VT, FACES, FTEX, FGROUP = load_obj(f"{MPFB}/3dobjs/base.obj")
VGROUPS = json.load(open(f"{MPFB}/mesh_metadata/basemesh_vertex_groups.json"))


def vrange(name):
    out = []
    for a, b in VGROUPS[name]:
        out.extend(range(a, b + 1))
    return np.array(out)


# ── Targets ────────────────────────────────────────────────────────────────

_tcache = {}


def target(rel):
    if rel not in _tcache:
        p = f"{MPFB}/targets/{rel}.target.gz"
        idx, d = [], []
        for line in gzip.open(p).read().decode().splitlines():
            s = line.split()
            if len(s) == 4 and s[0].isdigit():
                idx.append(int(s[0])); d.append([float(x) for x in s[1:]])
        _tcache[rel] = (np.array(idx, dtype=np.int64), np.array(d) if d else np.zeros((0, 3)))
    return _tcache[rel]


def two(v, lo_name, mid_name, hi_name):
    """A 0..1 slider over three stops (0, 0.5, 1) → weights."""
    if v < 0.5:
        return {lo_name: 1 - 2 * v, mid_name: 2 * v}
    return {mid_name: 2 - 2 * v, hi_name: 2 * v - 1}


def macro(m):
    """MakeHuman's macro sliders → {target: weight} (its own interpolation)."""
    g = {"male": m["gender"], "female": 1 - m["gender"]}
    a = m["age"]
    if a < 0.1875:
        ages = {"baby": 1 - a / 0.1875, "child": a / 0.1875}
    elif a < 0.5:
        k = (a - 0.1875) / (0.5 - 0.1875)
        ages = {"child": 1 - k, "young": k}
    else:
        k = (a - 0.5) / 0.5
        ages = {"young": 1 - k, "old": k}
    mu = two(m["muscle"], "minmuscle", "averagemuscle", "maxmuscle")
    we = two(m["weight"], "minweight", "averageweight", "maxweight")
    h = m["height"]
    hs = {"minheight": max(0, (0.5 - h) * 2), "maxheight": max(0, (h - 0.5) * 2)}
    pr = m["proportions"]
    ps = {"idealproportions": max(0, (pr - 0.5) * 2), "uncommonproportions": max(0, (0.5 - pr) * 2)}
    out = {}
    for gn, gw in g.items():
        for an, aw in ages.items():
            if gw * aw <= 0:
                continue
            for race, rw in m["race"].items():
                if rw > 0:
                    out[f"macrodetails/{race}-{gn}-{an}"] = out.get(f"macrodetails/{race}-{gn}-{an}", 0) + gw * aw * rw
            for mn, mw in mu.items():
                for wn, ww in we.items():
                    base = gw * aw * mw * ww
                    if base <= 0:
                        continue
                    out[f"macrodetails/universal-{gn}-{an}-{mn}-{wn}"] = base
                    for hn, hw in hs.items():
                        if hw > 0:
                            out[f"macrodetails/height/{gn}-{an}-{mn}-{wn}-{hn}"] = base * hw
                    for pn, pw in ps.items():
                        if pw > 0:
                            out[f"macrodetails/proportions/{gn}-{an}-{mn}-{wn}-{pn}"] = base * pw
    return out


def shape(m, extra=None):
    V = V0.copy()
    w = macro(m)
    for k, v in (extra or {}).items():
        w[k] = w.get(k, 0) + v
    for rel, wt in w.items():
        if abs(wt) < 1e-6:
            continue
        p = f"{MPFB}/targets/{rel}.target.gz"
        if not os.path.exists(p):
            continue
        idx, d = target(rel)
        if len(idx):
            V[idx] += d * wt
    return V


# The default: a 25-year-old athletic footballer, ~1.80 m.
BASE = {"gender": 1.0, "age": 0.5, "muscle": 0.72, "weight": 0.42, "height": 0.5, "proportions": 1.0,
        "race": {"caucasian": 1 / 3, "african": 1 / 3, "asian": 1 / 3}}
BASE_EXTRA = {"torso/torso-vshape-incr": 0.25, "neck/measure-neck-circ-incr": 0.2, "stomach/stomach-tone-incr": 0.4,
              "chin/chin-width-incr": 0.2, "chin/chin-prominent-incr": 0.15}

# Build shapes (morph targets): (name, macro changes, extra targets).
SHAPES = [
    ("heavy", {"weight": 0.85}, {}),
    ("lean", {"weight": 0.12}, {}),
    ("muscle", {"muscle": 1.0}, {}),
    ("soft", {"muscle": 0.3}, {}),
    ("old", {"age": 0.85}, {}),
    ("tall", {"height": 0.65}, {}),
    ("short", {"height": 0.38}, {}),
    ("belly", {}, {"stomach/stomach-pregnant-incr": 0.6, "stomach/stomach-tone-decr": 0.6}),
    ("shoulders", {}, {"torso/measure-shoulder-dist-incr": 0.8, "torso/torso-vshape-incr": 0.5}),
    ("legs", {}, {"legs/upperlegs-height-incr": 0.6, "legs/lowerlegs-height-incr": 0.6}),
    ("neck", {}, {"neck/measure-neck-circ-incr": 0.8}),
    ("jaw", {}, {"chin/chin-width-incr": 0.8, "chin/chin-bones-incr": 0.5}),
    ("chin", {}, {"chin/chin-prominent-incr": 0.8, "chin/chin-height-incr": 0.4}),
    ("cheeks", {}, {"cheek/l-cheek-bones-incr": 0.8, "cheek/r-cheek-bones-incr": 0.8}),
    ("nose", {}, {"nose/nose-scale-horiz-incr": 0.5, "nose/nose-scale-vert-incr": 0.5, "nose/nose-hump-incr": 0.4}),
    ("noseSmall", {}, {"nose/nose-scale-horiz-decr": 0.5, "nose/nose-scale-vert-decr": 0.4, "nose/nose-point-up": 0.4}),
    ("faceLong", {}, {"head/head-scale-vert-incr": 0.5, "head/head-oval": 0.5}),
    ("faceRound", {}, {"head/head-round": 0.7, "head/head-fat-incr": 0.4}),
    ("faceSquare", {}, {"head/head-square": 0.8}),
    ("lips", {}, {"mouth/mouth-upperlip-volume-incr": 0.6, "mouth/mouth-lowerlip-volume-incr": 0.6}),
    ("eyes", {}, {"eyes/l-eye-scale-incr": 0.5, "eyes/r-eye-scale-incr": 0.5}),
    ("african", {"race": {"african": 1.0, "caucasian": 0, "asian": 0}}, {}),
    ("asian", {"race": {"asian": 1.0, "caucasian": 0, "african": 0}}, {}),
    ("caucasian", {"race": {"caucasian": 1.0, "african": 0, "asian": 0}}, {}),
]

# ── The rig: MakeHuman's game-engine rig, named as the one body's ───────────

RIG = json.load(open(f"{MPFB}/rigs/standard/rig.game_engine.json"))
WTS = json.load(open(f"{MPFB}/rigs/standard/weights.game_engine.json"))["weights"]
NAME = {"pelvis": "Hips", "spine_01": "Spine02", "spine_02": "Spine01", "spine_03": "Spine", "neck_01": "neck", "head": "Head"}
for s, S in (("l", "Left"), ("r", "Right")):
    NAME.update({f"clavicle_{s}": f"{S}Shoulder", f"upperarm_{s}": f"{S}Arm", f"lowerarm_{s}": f"{S}ForeArm", f"hand_{s}": f"{S}Hand",
                 f"thigh_{s}": f"{S}UpLeg", f"calf_{s}": f"{S}Leg", f"foot_{s}": f"{S}Foot", f"ball_{s}": f"{S}ToeBase"})
    for mh, ob in (("thumb", "Thumb"), ("index", "Index"), ("middle", "Middle"), ("ring", "Ring"), ("pinky", "Little")):
        for k in (1, 2, 3):
            NAME[f"{mh}_0{k}_{s}"] = f"{S}Hand{ob}{k}"
MHNAME = {v: k for k, v in NAME.items()}


def joint_point(V, spec):
    if spec["strategy"] == "CUBE":
        return V[vrange(spec["cube_name"])].mean(0)
    return V[np.array(spec["vertex_indices"])].mean(0)


def joints_of(V):
    """Each one-body bone's head (and Head's tail as head_end), metres, y up, feet on the ground later."""
    J = {}
    for mh, ob in NAME.items():
        J[ob] = joint_point(V, RIG[mh]["head"]) * DM
    J["head_end"] = joint_point(V, RIG["head"]["tail"]) * DM
    for s, S in (("l", "Left"), ("r", "Right")):
        for mh, ob in (("thumb", "Thumb"), ("index", "Index"), ("middle", "Middle"), ("ring", "Ring"), ("pinky", "Little")):
            J[f"{S}Hand{ob}Tip"] = joint_point(V, RIG[f"{mh}_03_{s}"]["tail"]) * DM
        J[f"{S}ToeEnd"] = joint_point(V, RIG[f"ball_{s}"]["tail"]) * DM
    # Face landmarks (MakeHuman's own joint cubes): eyeball centres, eyelids, jaw, mouth.
    for k, cube in (("eyeL", "joint-l-eye"), ("eyeR", "joint-r-eye"), ("lidUL", "joint-l-upperlid"), ("lidLL", "joint-l-lowerlid"),
                    ("lidUR", "joint-r-upperlid"), ("lidLR", "joint-r-lowerlid"), ("jaw", "joint-jaw"), ("mouth", "joint-mouth")):
        J[k] = V[vrange(cube)].mean(0) * DM
    return J


# Skin weights, per vertex, onto one-body bone names (top 4).
NV = len(V0)
_wl = [[] for _ in range(NV)]
for mh, lst in WTS.items():
    if mh not in NAME:
        continue
    for i, w in lst:
        _wl[i].append((NAME[mh], w))
BONE_W = []
for lst in _wl:
    lst.sort(key=lambda x: -x[1])
    lst = lst[:4]
    s = sum(w for _, w in lst) or 1
    BONE_W.append([(n, w / s) for n, w in lst])

BONE_IDX = {}
for i, lst in enumerate(BONE_W):
    for n, w in lst:
        BONE_IDX.setdefault(n, ([], []))
        BONE_IDX[n][0].append(i); BONE_IDX[n][1].append(w)
BONE_IDX = {k: (np.array(a), np.array(b)) for k, (a, b) in BONE_IDX.items()}

# ── The reference skeleton (the one body's) ────────────────────────────────

def q2m(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


RJ, RB = glb.read(REF)
RNODES = RJ["nodes"]
RSKIN = RJ["skins"][0]
RJOINTS = [RNODES[i]["name"] for i in RSKIN["joints"]]
RPARENT = {}
for i, n in enumerate(RNODES):
    for c in n.get("children", []):
        RPARENT[c] = i
RIDX = {n.get("name"): i for i, n in enumerate(RNODES)}
REX = RJ["scenes"][0]["extras"]


def rworld(i):
    n = RNODES[i]
    M = np.eye(4)
    M[:3, :3] = q2m(n.get("rotation", [0, 0, 0, 1])) * np.array(n.get("scale", [1, 1, 1]))[None, :]
    M[:3, 3] = n.get("translation", [0, 0, 0])
    return rworld(RPARENT[i]) @ M if i in RPARENT else M


RPOS = {name: rworld(RIDX[name])[:3, 3] for name in RJOINTS}
RROT = {name: rworld(RIDX[name])[:3, :3] / 0.01 for name in RJOINTS}  # pure rotation (Armature scale removed)
RPAR = {name: RNODES[RPARENT[RIDX[name]]]["name"] for name in RJOINTS}


def rot_between(a, b):
    a, b = unit(a), unit(b)
    v = np.cross(a, b)
    c = float(a @ b)
    if c < -0.9999:
        ax = unit(np.cross(a, [1, 0, 0] if abs(a[0]) < 0.9 else [0, 1, 0]))
        return 2 * np.outer(ax, ax) - np.eye(3)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx / (1 + c)


def frame(along, palm):
    a = unit(along)
    p = unit(palm - a * (palm @ a))
    return np.stack([a, p, np.cross(a, p)], 1)


AIM = {}  # bone → child it aims at (limbs only: the spine and neck keep their own lean)
for S in ("Left", "Right"):
    AIM.update({f"{S}Shoulder": f"{S}Arm", f"{S}Arm": f"{S}ForeArm", f"{S}ForeArm": f"{S}Hand",
                f"{S}UpLeg": f"{S}Leg", f"{S}Leg": f"{S}Foot", f"{S}Foot": f"{S}ToeBase"})


def hand_frame_mh(J, S):
    al = J[f"{S}HandMiddle1"] - J[f"{S}Hand"]
    side = J[f"{S}HandIndex1"] - J[f"{S}HandLittle1"]
    n = unit(np.cross(al, side))
    # The palm is the side the thumb's tip curls towards.
    if (J[f"{S}HandThumbTip"] - J[f"{S}HandMiddle1"]) @ n < 0:
        n = -n
    return frame(al, n)


def repose(V, J):
    """Turn the MakeHuman body into the one body's rest pose. Returns the new
    vertices, the new joint positions and each bone's turn."""
    order = [b for b in RJOINTS if b in J]  # parents come first in the skin list
    R = {}
    P = {}
    for b in order:
        par = RPAR.get(b)
        Rp = R.get(par, np.eye(3))
        P[b] = J[b] if par not in P else P[par] + Rp @ (J[b] - J[par])
        if b in AIM:
            c = AIM[b]
            cur = Rp @ (J[c] - J[b])
            want = RPOS[c] - RPOS[b]
            R[b] = rot_between(cur, want) @ Rp
        elif b in ("LeftHand", "RightHand"):
            S = b[:-4]
            side = "L" if S == "Left" else "R"
            Fm = hand_frame_mh(J, S)
            Fo = frame(np.array(REX["hands"][side]["along"]), np.array(REX["hands"][side]["palm"]))
            R[b] = Fo @ Fm.T
        else:
            R[b] = Rp
    # Extra points (fingertips, toe ends, head_end) follow their bone.
    for k in J:
        if k in P:
            continue
        if k == "head_end":
            P[k] = P["Head"] + R["Head"] @ (J[k] - J["Head"])
        elif k.endswith("Tip"):
            base = k[:-3] + "3"
            P[k] = P[base] + R[base] @ (J[k] - J[base])
        elif k in ("eyeL", "eyeR", "lidUL", "lidLL", "lidUR", "lidLR", "jaw", "mouth"):
            P[k] = P["Head"] + R["Head"] @ (J[k] - J["Head"])
        elif k.endswith("ToeEnd"):
            S = k[:-6]
            P[k] = P[f"{S}ToeBase"] + R[f"{S}ToeBase"] @ (J[k] - J[f"{S}ToeBase"])
    # Linear-blend skinning of every vertex.
    out = np.zeros_like(V)
    for b, (idx, w) in BONE_IDX.items():
        out[idx] += w[:, None] * ((V[idx] - J[b]) @ R[b].T + P[b])
    return out, P, R


def build_pose(m, extra, keep=False):
    V = shape(m, extra) * DM
    J = joints_of(V / DM)
    Vr, P, R = repose(V, J)
    if keep:
        return Vr, P, R, V, J
    return Vr, P, R


print("base …")
VB, PB, RBASE, VMH, JMH = build_pose(BASE, BASE_EXTRA, keep=True)
BODY = vrange("body")
ground = VB[BODY, 1].min()
VB[:, 1] -= ground
for k in PB:
    PB[k] = PB[k] - np.array([0, ground, 0])
height = VB[BODY, 1].max()
print(f"height {height:.3f} m")

SHAPE_OUT = []
for name, mch, ext in SHAPES:
    m = json.loads(json.dumps(BASE))
    for k, v in mch.items():
        m[k] = v
    e = dict(BASE_EXTRA)
    for k, v in ext.items():
        e[k] = e.get(k, 0) + v
    Vs, Ps, _ = build_pose(m, e)
    g = Vs[BODY, 1].min()
    Vs[:, 1] -= g
    for k in Ps:
        Ps[k] = Ps[k] - np.array([0, g, 0])
    dV = Vs - VB
    dJ = {k: (Ps[k] - PB[k]) for k in PB}
    if name in ("african", "asian", "caucasian"):
        # Heritage changes the face (and the head's own shape) only: the build sliders do the body.
        headw = np.array([sum(w for b, w in BONE_W[i] if b in ("Head",)) for i in range(len(VB))])
        dV = ((Vs - Ps["Head"]) - (VB - PB["Head"])) * headw[:, None]
        dJ = {k: ((Ps[k] - Ps["Head"]) - (PB[k] - PB["Head"]) if k in ("eyeL", "eyeR", "lidUL", "lidLL", "lidUR", "lidLR", "jaw", "mouth", "head_end") else v * 0) for k, v in dJ.items()}
        # (the Head joint itself stays: the face moves round it)
        Vs = VB + dV
    h = Vs[BODY, 1].max()
    SHAPE_OUT.append((name, dV, dJ, h))
    print(f"  {name}: height {h:.3f}, max move {np.abs(dV).max() * 100:.1f} cm")

if os.environ.get("STAGE1"):
    with open(os.environ["STAGE1"], "w") as f:
        for v in VB: f.write(f"v {v[0]:.5f} {v[1]:.5f} {v[2]:.5f}\n")
        last = None
        for fv, g in zip(FACES, FGROUP):
            if g.startswith("joint-"): continue
            if g != last: f.write(f"o {g}\n"); last = g
            f.write("f " + " ".join(str(i + 1) for i in fv) + "\n")
    json.dump({k: [float(x) for x in v] for k, v in PB.items()}, open(os.environ["STAGE1"] + ".joints.json", "w"))
    sys.exit(0)

# Hand the rest of the build to parts.py (garments, hair, glasses) and the writer.
from parts import build_parts, write_glb  # noqa: E402

POSE = {"V": VMH, "J": JMH, "R": RBASE, "P": {k: v + np.array([0, ground, 0]) for k, v in PB.items()}, "ground": ground, "assets": ASSETS}
parts = build_parts(VB, BODY, FACES, FGROUP, FTEX, VT, VGROUPS, BONE_W, PB, SHAPE_OUT, vrange, MPFB, POSE)
write_glb(OUT, VB, parts, PB, RBASE, SHAPE_OUT, height, REX, RJ, RJOINTS, RPAR, RROT, RNODES, RIDX, BONE_W)
