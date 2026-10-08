"""
THE OVATION GREETINGS, MADE IN BLENDER (Mikey, 8 Oct 2026).

Mikey's farewell playtest: team-mates and rivals stop you on your last walk
off "giving me like dap ups and hugs", the sub "hugs me", everyone clapping.
The first version posed every arm live in the game, one reach at a time.
This builds the moves once, here, with two real bodies standing face to face:

  hug-a / hug-b     both arms round each other, one high one low, a squeeze,
                    two pats on the back, heads past each other's shoulder
  dap-a / dap-b     right hands clasp in the middle and shake, he pulls you
                    in, right shoulders meet, a slap on the back
  pat-a / pat-b     you: a hand on his shoulder, two pats; him: his hand on
                    your forearm, a nod
  clap-chest        a footballer's clap at the chest (two claps, loops)
  clap-high         hands above the head to the stands (two claps, loops)

Each two-man move is posed on BOTH men together, so every hand is put on
the other man's real (skinned) body, not on a guess: a hand on a back is
pressed onto the nearest point of his back mesh. Every frame is measured:
how far each palm is from where it should be, and how deep any arm goes
into the other man. The numbers print at the end.

The partner's distance and sideways step for each frame go into the file
(scene extras "greet"), so the game stands the two men exactly where they
were here.

    node tools/ovation3d/unpack.mjs public/star/onebody/player.glb <dir>/player.glb
    node tools/ovation3d/unpack.mjs public/star/people3d/anims.glb <dir>/anims.glb
    blender -b --python tools/ovation3d/author_greetings.py -- <dir> public/star/ovation3d/greetings.glb [<render dir>]
    node scripts/perf3d/shrink-models.mjs star/ovation3d/greetings.glb

Blender 4.0 with numpy (apt: blender python3-numpy). Only bone rotations go
in the file, in the game's own bone frames, so one clip plays on every body.
"""
import bpy, math, os, sys, json
from mathutils import Vector, Matrix, Quaternion
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "scripts", "people3d"))
import glb  # noqa: E402
import numpy as np  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
PLAIN, OUT = argv[0], argv[1]
RENDER = argv[2] if len(argv) > 2 else None
FPS = 30

# The game's own numbers (lib/star/ovation.ts OVATION.hold): one frame per 1/30 s.
HOLD = {"hug": 1.7, "dap": 1.3, "pat": 1.3}
APART = 1.25  # where a man waits, off your path (ovation3d.ts)

# glTF (y up, facing +z) -> Blender (z up, facing -y).
GB = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
UP = Vector((0, 0, 1))


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def ramp(k, a, b):
    return smooth((k - a) / (b - a))


# ── The two men ───────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(PLAIN, "player.glb"))
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.name != "Body":
        bpy.data.objects.remove(o)
A = bpy.data.objects["Armature"]
bodyA = bpy.data.objects["Body"]
B = A.copy()
B.data = A.data.copy()
B.name = "B"
bpy.context.scene.collection.objects.link(B)
bodyB = bodyA.copy()
bodyB.name = "BodyB"
bodyB.parent = B
for m in bodyB.modifiers:
    if m.type == "ARMATURE":
        m.object = B
bpy.context.scene.collection.objects.link(bodyB)
MEN = (A, B)


def upd():
    bpy.context.view_layer.update()


def objrot(arm):
    return arm.matrix_world.to_3x3().normalized()


def wmat(arm, n):
    return arm.matrix_world @ arm.pose.bones[n].matrix


def wpos(arm, n):
    return wmat(arm, n).translation.copy()


def wrot(arm, n):
    return wmat(arm, n).to_3x3().normalized()


def set_wrot(arm, n, R):
    M = wmat(arm, n)
    s = M.to_scale()
    Mw = Matrix.Translation(M.translation) @ R.to_4x4() @ Matrix.Diagonal((s.x, s.y, s.z, 1))
    arm.pose.bones[n].matrix = arm.matrix_world.inverted() @ Mw
    upd()


def turn(arm, n, axis, ang):
    if abs(ang) < 1e-6:
        return
    set_wrot(arm, n, Quaternion(axis.normalized(), ang).to_matrix() @ wrot(arm, n))


def clear(arm):
    for p in arm.pose.bones:
        p.matrix_basis = Matrix.Identity(4)


def frame(arm):
    R = objrot(arm)
    return R @ Vector((0, -1, 0)), R @ Vector((1, 0, 0))  # fwd, left


def place(a_gap, lat):
    """You at the origin facing -y; him `a_gap` in front, `lat` to your left, facing you."""
    for m in MEN:
        m.rotation_mode = "XYZ"  # the importer leaves quaternions on; euler would be ignored
    A.location = (0, 0, 0)
    A.rotation_euler = (0, 0, 0)
    B.location = (lat, -a_gap, 0)
    B.rotation_euler = (0, 0, math.pi)
    upd()
    fa, fb = frame(A)[0], frame(B)[0]
    assert fa.dot(B.location - A.location) > 0 and fb.dot(A.location - B.location) > 0, "the two men must face each other"


# ── Rest measurements (character space = A at the origin) ────────────────
place(APART, 0)
for m in MEN:
    clear(m)
upd()
BONES = ["Hips", "Spine02", "Spine01", "Spine", "neck", "Head",
         "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand",
         "RightShoulder", "RightArm", "RightForeArm", "RightHand"]
SIDE = {"L": "Left", "R": "Right"}
OUTS = {"L": 1.0, "R": -1.0}
LEN = {s: ((wpos(A, SIDE[s] + "ForeArm") - wpos(A, SIDE[s] + "Arm")).length,
           (wpos(A, SIDE[s] + "Hand") - wpos(A, SIDE[s] + "ForeArm")).length) for s in "LR"}
REST_CHAR = {n: wrot(A, n) for n in A.pose.bones.keys()}

gj, gbin = glb.read(os.path.join(PLAIN, "player.glb"))
META = gj["scenes"][0]["extras"]
HAND = {s: {k: (GB @ Vector(META["hands"][s][k])).normalized() for k in ("along", "palm")} for s in "LR"}
HAND_LEN = {s: META["hands"][s]["len"] for s in "LR"}


def basis(a, p):
    a = a.normalized()
    p = (p - a * p.dot(a)).normalized()
    return Matrix((a, p, a.cross(p))).transposed()


def hand_rot(arm, s, along, palm):
    R = objrot(arm)
    Q = basis(along, palm) @ basis(R @ HAND[s]["along"], R @ HAND[s]["palm"]).transposed()
    return Q @ (R @ REST_CHAR[SIDE[s] + "Hand"])


def aim(arm, n, child, target):
    head = wpos(arm, n)
    cur = wpos(arm, child) - head
    want = target - head
    if cur.length < 1e-6 or want.length < 1e-6:
        return
    set_wrot(arm, n, cur.rotation_difference(want).to_matrix() @ wrot(arm, n))


MISS = []


def solve_arm(arm, s, W, pole, along, palm):
    """Two-bone reach: wrist to W, elbow towards `pole`, hand turned to along/palm."""
    sd = SIDE[s]
    S = wpos(arm, sd + "Arm")
    L1, L2 = LEN[s]
    d = W - S
    reach = (L1 + L2) * 0.998
    if d.length > reach:
        MISS.append(d.length - reach)
        W = S + d.normalized() * reach
        d = W - S
    dl = max(d.length, 1e-4)
    dn = d / dl
    a = (L1 * L1 - L2 * L2 + dl * dl) / (2 * dl)
    h = math.sqrt(max(0.0, L1 * L1 - a * a))
    pp = pole - dn * pole.dot(dn)
    pp = pp.normalized() if pp.length > 1e-6 else Vector((0, 0, -1))
    E = S + dn * a + pp * h
    aim(arm, sd + "Arm", sd + "ForeArm", E)
    aim(arm, sd + "ForeArm", sd + "Hand", W)
    H = hand_rot(arm, s, along, palm)
    # Half the wrist's twist goes into the forearm (no candy-wrapper wrist).
    F = wrot(arm, sd + "ForeArm")
    ax = (wpos(arm, sd + "Hand") - wpos(arm, sd + "ForeArm")).normalized()
    rel = (F.inverted() @ H).to_quaternion()
    axl = F.inverted() @ ax
    proj = axl * Vector(rel[1:]).dot(axl)
    tw = Quaternion((rel.w, proj.x, proj.y, proj.z)).normalized()
    ang = tw.angle if Vector(tw[1:]).dot(axl) >= 0 else -tw.angle
    if ang > math.pi:
        ang -= 2 * math.pi
    turn(arm, sd + "ForeArm", ax, ang * 0.5)
    set_wrot(arm, sd + "Hand", H)


def shoulder(arm, s, raise_deg, forward_deg):
    fwd, left = frame(arm)
    o = OUTS[s]
    turn(arm, SIDE[s] + "Shoulder", fwd, math.radians(raise_deg) * o)
    turn(arm, SIDE[s] + "Shoulder", UP, -math.radians(forward_deg) * o)


def spine(arm, lean_deg, twist_deg=0.0, bend_deg=0.0):
    fwd, left = frame(arm)
    for n, part in (("Spine02", 0.3), ("Spine01", 0.35), ("Spine", 0.35)):
        turn(arm, n, left, math.radians(lean_deg) * part)
        turn(arm, n, UP, math.radians(twist_deg) * part)
        turn(arm, n, fwd, math.radians(bend_deg) * part)


def head(arm, yaw_deg, nod_deg=0.0, tilt_deg=0.0):
    fwd, left = frame(arm)
    turn(arm, "neck", UP, math.radians(yaw_deg) * 0.4)
    turn(arm, "Head", UP, math.radians(yaw_deg) * 0.6)
    turn(arm, "Head", left, math.radians(nod_deg))
    turn(arm, "Head", fwd, math.radians(tilt_deg))


def arms_down(arm, s):
    """The neutral: arms hanging easy at the sides, palms in."""
    fwd, left = frame(arm)
    o = OUTS[s]
    S = wpos(arm, SIDE[s] + "Arm")
    L1, L2 = LEN[s]
    W = S - UP * (L1 + L2) * 0.93 + left * o * 0.09 + fwd * 0.04
    solve_arm(arm, s, W, -fwd + left * o * 0.3, -UP + fwd * 0.1, -left * o)


def body_bvh(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = ev.to_mesh()
    mw = ev.matrix_world
    verts = [mw @ v.co for v in me.vertices]
    polys = [tuple(p.vertices) for p in me.polygons]
    ev.to_mesh_clear()
    return BVHTree.FromPolygons(verts, polys)


def on_surface(bvh, guess, want_normal):
    """The nearest point of his body to `guess`, and its outward normal."""
    hit = bvh.find_nearest(guess)
    if hit[0] is None:
        return guess, want_normal
    p, n = hit[0], hit[1].normalized()
    if n.dot(want_normal) < 0:
        n = -n
    return p, n


def depth_into(bvh, pts):
    """How far the deepest of these points is inside his body (0 when none is)."""
    worst = 0.0
    for p in pts:
        hit = bvh.find_nearest(p)
        if hit[0] is None:
            continue
        q, n = hit[0], hit[1]
        d = (p - q).dot(n)
        if d < 0:
            worst = max(worst, -d)
    return worst


def arm_points(arm, s):
    sd = SIDE[s]
    a, b, c = wpos(arm, sd + "Arm"), wpos(arm, sd + "ForeArm"), wpos(arm, sd + "Hand")
    pts = [a.lerp(b, t) for t in (0.4, 0.6, 0.8, 1.0)] + [b.lerp(c, t) for t in (0.25, 0.5, 0.75, 1.0)]
    return pts


def palm_centre(arm, s):
    H = wrot(arm, SIDE[s] + "Hand")
    R0 = REST_CHAR[SIDE[s] + "Hand"]
    Rr = objrot(arm)
    along = (H @ (Rr @ R0).inverted()) @ (Rr @ HAND[s]["along"])
    palm = (H @ (Rr @ R0).inverted()) @ (Rr @ HAND[s]["palm"])
    return wpos(arm, SIDE[s] + "Hand") + along * HAND_LEN[s] * 0.45 - palm * 0.012, palm


def place_palm(arm, s, P, N, along, extra=0.0):
    """Wrist so the palm centre lies on P (palm facing -N), fingers along `along`."""
    return P + N * (0.018 + extra) - along.normalized() * HAND_LEN[s] * 0.45


def bez(p0, c, p1, t):
    return p0 * ((1 - t) ** 2) + c * (2 * (1 - t) * t) + p1 * (t * t)


# ── Export: Blender poses -> the game's bone rotations ────────────────────
def gl_parents(j):
    par = {}
    for i, n in enumerate(j["nodes"]):
        for c in n.get("children", []):
            par[c] = i
    return par


NODES = {n.get("name"): i for i, n in enumerate(gj["nodes"])}
PAR = gl_parents(gj)


def gl_world_rest(name):
    i = NODES[name]
    q = Quaternion()
    chain = []
    while i is not None:
        chain.append(i)
        i = PAR.get(i)
    for i in reversed(chain):
        r = gj["nodes"][i].get("rotation")
        if r:
            q = q @ Quaternion((r[3], r[0], r[1], r[2]))
    return q.to_matrix()


CORR = {n: REST_CHAR[n].inverted() @ GB @ gl_world_rest(n) for n in BONES}
PARENT_NAME = {n: gj["nodes"][PAR[NODES[n]]].get("name") for n in BONES}


def local_rotations(arm):
    R = objrot(arm)
    G = {}
    for n in BONES:
        Rc = R.inverted() @ wrot(arm, n)
        G[n] = GB.inverted() @ Rc @ CORR[n]
    out = {}
    for n in BONES:
        p = PARENT_NAME[n]
        Gp = G[p] if p in G else gl_world_rest(p)
        q = (Gp.inverted() @ G[n]).to_quaternion()
        out[n] = q
    return out


# The rest pose must come out as the file's own rotations.
place(APART, 0)
for m in MEN:
    clear(m)
upd()
chk = local_rotations(A)
for n in BONES:
    r = gj["nodes"][NODES[n]].get("rotation") or [0, 0, 0, 1]
    want = Quaternion((r[3], r[0], r[1], r[2]))
    if chk[n].rotation_difference(want).angle > 1e-3:
        raise SystemExit(f"export check failed on {n}: {chk[n]} vs {want}")
print("export check: rest pose matches the file")


# ── The moves ─────────────────────────────────────────────────────────────
def hug_pose(k, gap):
    """Both men: lean in, head past his shoulder, left arm high, right low."""
    reach = ramp(k, 0.10, 0.32) * (1 - ramp(k, 0.80, 0.97))
    squeeze = math.sin(math.pi * ramp(k, 0.40, 0.70))
    pats = [max(0.0, math.sin((k - 0.46) / 0.11 * math.pi)) if 0.46 < k < 0.68 else 0.0]
    sway = math.sin(math.pi * 2 * ramp(k, 0.30, 0.78)) * 4 * reach
    for m in MEN:
        clear(m)
    upd()
    for m in MEN:
        spine(m, 9 * reach + 2 * squeeze, sway, 0)
        head(m, 28 * reach, -6 * reach, 8 * reach)
        shoulder(m, "L", 14 * reach, 12 * reach)
        shoulder(m, "R", 4 * reach, 14 * reach)
    bv = {A: body_bvh(bodyB), B: body_bvh(bodyA)}
    for m, other in ((A, B), (B, A)):
        fwd, left = frame(m)
        ofwd, oleft = frame(other)
        for s in "LR":
            o = OUTS[s]
            high = s == "L"
            # His back: behind his chest (high) or his ribs (low), your side.
            anchor = wpos(other, "Spine" if high else "Spine01")
            guess = anchor - ofwd * 0.18 + left * o * (0.10 if high else 0.14) + UP * (0.02 if high else -0.04)
            P, N = on_surface(bv[m], guess, -ofwd + left * o * 0.3)
            spine_pt = anchor - ofwd * 0.12
            across = (spine_pt - P)
            across = across - N * across.dot(N)
            along = (across.normalized() * 0.8 - UP * (0.35 if high else 0.15)).normalized()
            pat = pats[0] * 0.04 if not high else 0.0
            W_on = place_palm(m, s, P, N, along, 0.008 * (1 - squeeze) + pat)
            # From the side, round his flank (never through him).
            S = wpos(m, SIDE[s] + "Arm")
            L1, L2 = LEN[s]
            W_down = S - UP * (L1 + L2) * 0.93 + left * o * 0.09 + fwd * 0.04
            ctrl = wpos(other, "Spine01") + left * o * 0.42 + fwd * 0.05 + UP * (0.10 if high else -0.05)
            W = bez(W_down, ctrl, W_on, reach)
            along_n = (-UP + fwd * 0.1).normalized().lerp(along, reach).normalized()
            palm_n = (-left * o).lerp(-N, reach).normalized()
            pole = (left * o * 0.9 + UP * (0.25 if high else -0.35) - fwd * 0.2).normalized()
            solve_arm(m, s, W, pole, along_n, palm_n)
    return reach


def dap_pose(k, gap):
    grip = ramp(k, 0.08, 0.28) * (1 - ramp(k, 0.82, 0.97))
    shake = math.sin((k - 0.28) / 0.17 * math.pi * 2) * 0.03 if 0.28 < k < 0.45 else 0.0
    pull = ramp(k, 0.45, 0.62) * (1 - ramp(k, 0.80, 0.95))
    slap = max(0.0, math.sin((k - 0.62) / 0.12 * math.pi)) if 0.62 < k < 0.74 else 0.0
    for m in MEN:
        clear(m)
    upd()
    for m in MEN:
        spine(m, 5 * grip + 8 * pull, -10 * pull, 0)
        head(m, 22 * pull, -4 * grip, 6 * pull)
        shoulder(m, "R", 6 * grip, 10 * grip)
        shoulder(m, "L", 10 * pull, 14 * pull)
    bv = {A: body_bvh(bodyB), B: body_bvh(bodyA)}
    fA, lA = frame(A)
    mid = (wpos(A, "Spine01") + wpos(B, "Spine01")) * 0.5 + UP * (0.14 - 0.06 * pull + shake)
    for m, other in ((A, B), (B, A)):
        fwd, left = frame(m)
        ofwd, oleft = frame(other)
        # Right hands: palms together on the plane between you, thumbs up.
        along = (fwd * 0.55 + UP * 0.8).normalized()
        P = mid - left * 0.021
        W_on = P - along * HAND_LEN["R"] * 0.45
        S = wpos(m, "RightArm")
        L1, L2 = LEN["R"]
        W_down = S - UP * (L1 + L2) * 0.93 - left * 0.09 + fwd * 0.04
        W = W_down.lerp(W_on, grip)
        solve_arm(m, "R", W, (-left * 0.6 - UP * 0.7 - fwd * 0.2).normalized(),
                  (-UP + fwd * 0.1).normalized().lerp(along, grip).normalized(), left.lerp(left, grip))
        # Left hand: round onto his back, one slap.
        anchor = wpos(other, "Spine")
        guess = anchor - ofwd * 0.18 + left * 0.10
        Pb, Nb = on_surface(bv[m], guess, -ofwd + left * 0.3)
        spine_pt = anchor - ofwd * 0.12
        across = spine_pt - Pb
        across = across - Nb * across.dot(Nb)
        along_b = (across.normalized() * 0.8 - UP * 0.3).normalized()
        Wb = place_palm(m, "L", Pb, Nb, along_b, 0.06 * slap)
        S = wpos(m, "LeftArm")
        L1, L2 = LEN["L"]
        Wd = S - UP * (L1 + L2) * 0.93 + left * 0.09 + fwd * 0.04
        ctrl = wpos(other, "Spine01") + left * 0.42 + fwd * 0.05 + UP * 0.1
        Wl = bez(Wd, ctrl, Wb, pull)
        solve_arm(m, "L", Wl, (left * 0.9 + UP * 0.2 - fwd * 0.2).normalized(),
                  (-UP + fwd * 0.1).normalized().lerp(along_b, pull).normalized(), (-left).lerp(-Nb, pull).normalized())
    return grip


def pat_pose(k, gap):
    reach = ramp(k, 0.08, 0.30) * (1 - ramp(k, 0.80, 0.97))
    pats = max(0.0, math.sin((k - 0.36) / 0.13 * math.pi)) if 0.36 < k < 0.62 else 0.0
    nod = math.sin(math.pi * ramp(k, 0.40, 0.70))
    for m in MEN:
        clear(m)
    upd()
    spine(A, 4 * reach, -8 * reach, 0)
    head(A, 0, -8 * reach, -4 * reach)
    shoulder(A, "R", 8 * reach, 12 * reach)
    spine(B, 2 * reach, 6 * reach, 0)
    head(B, -6 * reach, 14 * nod, 0)
    shoulder(B, "L", 4 * reach, 10 * reach)
    for m in MEN:
        arms_down(m, "L")
    # You: right hand on his left shoulder, fingers over the top.
    fA, lA = frame(A)
    fB, lB = frame(B)
    bvB = body_bvh(bodyB)
    guess = wpos(B, "LeftArm") * 0.6 + wpos(B, "LeftShoulder") * 0.4 + UP * 0.08
    P, N = on_surface(bvB, guess, (UP + fA * 0.3).normalized())
    along = (fA * 0.85 - UP * 0.2 - lA * 0.1).normalized()
    W_on = place_palm(A, "R", P, N, along, 0.05 * pats)
    S = wpos(A, "RightArm")
    L1, L2 = LEN["R"]
    W_down = S - UP * (L1 + L2) * 0.93 - lA * 0.09 + fA * 0.04
    ctrl = (S + W_on) * 0.5 - lA * 0.12 - UP * 0.15
    solve_arm(A, "R", bez(W_down, ctrl, W_on, reach), (-lA * 0.6 - UP * 0.7).normalized(),
              (-UP + fA * 0.1).normalized().lerp(along, reach).normalized(), lA.lerp(-N, reach).normalized())
    # Him: a nod, his right hand on his heart.
    grab = ramp(k, 0.22, 0.40) * (1 - ramp(k, 0.76, 0.94))
    bvSelf = body_bvh(bodyB)
    heart = wpos(B, "Spine") - UP * 0.04 + fB * 0.2 + lB * 0.07
    Ph, Nh = on_surface(bvSelf, heart, fB)
    along_h = (lB * 0.85 + UP * 0.3).normalized()
    Wh_on = place_palm(B, "R", Ph, Nh, along_h)
    S = wpos(B, "RightArm")
    L1, L2 = LEN["R"]
    Wh_down = S - UP * (L1 + L2) * 0.93 - lB * 0.09 + fB * 0.04
    ctrl = Wh_on + fB * 0.15 - UP * 0.2
    solve_arm(B, "R", bez(Wh_down, ctrl, Wh_on, grab), (-lB * 0.8 - UP * 0.6).normalized(),
              (-UP + fB * 0.1).normalized().lerp(along_h, grab).normalized(), lB.lerp(-Nh, grab).normalized())
    return reach


def clap_pose(arm, k, high):
    """Two claps over the clip; the start and end poses are the same (it loops)."""
    open_ = 0.5 + 0.5 * math.cos(k * math.pi * 4)  # 1 apart .. 0 together, twice
    open_ = open_ ** 0.7
    clear(arm)
    upd()
    fwd, left = frame(arm)
    if high:
        spine(arm, -4, 0, 0)
        head(arm, 0, -10, 0)
        shoulder(arm, "L", 22, 4)
        shoulder(arm, "R", 22, 4)
        centre = wpos(arm, "Head") + UP * 0.36 + fwd * 0.16
        along = (UP + fwd * 0.15).normalized()
    else:
        spine(arm, 4 + 2 * (1 - open_), 0, 0)
        shoulder(arm, "L", 4, 10)
        shoulder(arm, "R", 4, 10)
        centre = wpos(arm, "Spine") + fwd * 0.30 - UP * 0.04
        along = (fwd * 0.65 + UP * 0.7).normalized()
    gap = 0.012 + 0.16 * open_
    for s in "LR":
        o = OUTS[s]
        P = centre + left * o * (gap / 2)
        W = P - along * HAND_LEN[s] * 0.45 + left * o * 0.012
        pole = (left * o * 0.9 + fwd * 0.2).normalized() if high else (left * o * 0.7 - UP * 0.65 - fwd * 0.15).normalized()
        solve_arm(arm, s, W, pole, along, -left * o)


# ── Gap tables (partner distance, sideways step) ──────────────────────────
def hug_gap(k, close):
    return APART + (close - APART) * ramp(k, 0.0, 0.26) * (1 - ramp(k, 0.82, 1.0)), 0.0


def dap_gap(k, close, closer):
    d = APART + (close - APART) * ramp(k, 0.0, 0.22)
    d += (closer - close) * ramp(k, 0.45, 0.62)
    d = d + (APART - d) * ramp(k, 0.82, 1.0)
    # Right shoulders meet: he steps to your right as he pulls you in.
    lat = -0.16 * ramp(k, 0.45, 0.62) * (1 - ramp(k, 0.82, 1.0))
    return d, lat


def pat_gap(k, close):
    return APART + (close - APART) * ramp(k, 0.0, 0.24) * (1 - ramp(k, 0.84, 1.0)), 0.0


def chest_touch():
    """Root distance at which two men leaning in for a hug just touch (chest to chest)."""
    lo, hi = 0.05, 0.6
    for _ in range(14):
        mid = (lo + hi) / 2
        place(mid, 0)
        for m in MEN:
            clear(m)
        upd()
        for m in MEN:
            spine(m, 11, 0, 0)
        bv = body_bvh(bodyB)
        # Points down the front of your chest.
        fA, lA = frame(A)
        pts = []
        bvA = body_bvh(bodyA)
        for n in ("Spine02", "Spine01", "Spine"):
            c = wpos(A, n)
            for x in (-0.08, 0.0, 0.08):
                o = c + lA * x
                hit = bvA.ray_cast(o + fA * 0.4, -fA)
                if hit[0] is not None:
                    pts.append(hit[0])
        inside = depth_into(bv, pts)
        if inside > 0.004:
            lo = mid
        else:
            hi = mid
    return hi


# ── Build every clip ──────────────────────────────────────────────────────
RESULTS = {}
TRACKS = {}
GREET = {}
renders = []


def record(name, arm, frames):
    TRACKS.setdefault(name, []).append(frames)


hug_close = chest_touch() - 0.01
print(f"hug: chests touch at {hug_close + 0.01:.3f} m apart (roots)")
dap_close = hug_close + 0.36
dap_closer = hug_close + 0.10
pat_close = 0.47


def run(kind, pose_fn, gap_fn, stats_hand):
    n = int(round(HOLD[kind] * FPS)) + 1
    fa, fb, gaps = [], [], []
    palm_err, depth = [], []
    for i in range(n):
        k = i / (n - 1)
        d, lat = gap_fn(k)
        place(d, lat)
        w = pose_fn(k, d)
        fa.append(local_rotations(A))
        fb.append(local_rotations(B))
        gaps.append([round(d, 4), round(lat, 4)])
        if 0.4 <= k <= 0.7:
            bvB, bvA = body_bvh(bodyB), body_bvh(bodyA)
            dep = 0.0
            for s in "LR":
                dep = max(dep, depth_into(bvB, arm_points(A, s)), depth_into(bvA, arm_points(B, s)))
            depth.append(dep)
            for m, s, bv in stats_hand(bvA, bvB):
                pc, _ = palm_centre(m, s)
                hit = bv.find_nearest(pc)
                if hit[0] is not None:
                    palm_err.append((pc - hit[0]).length)
        if RENDER and i in (round((n - 1) * 0.15), round((n - 1) * 0.55), round((n - 1) * 0.68)):
            render(f"{kind}-{i:02d}")
    TRACKS[f"{kind}-a"] = fa
    TRACKS[f"{kind}-b"] = fb
    GREET[kind] = {"frames": n, "fps": FPS, "partner": gaps}
    RESULTS[kind] = {
        "palm_from_body_mm": [round(1000 * min(palm_err), 1), round(1000 * float(np.median(palm_err)), 1), round(1000 * max(palm_err), 1)] if palm_err else None,
        "deepest_arm_in_body_mm": round(1000 * max(depth), 1) if depth else None,
        "missed_reach_mm": round(1000 * max(MISS), 1) if MISS else 0,
    }
    MISS.clear()


# ── Renders (a quick look, Cycles on the CPU) ─────────────────────────────
cam = None
if RENDER:
    os.makedirs(RENDER, exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 10
    sc.cycles.use_denoising = False
    sc.render.resolution_x = 420
    sc.render.resolution_y = 420
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.62, 0.72, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
    sc.world = world
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(45), 0, math.radians(30))
    sc.collection.objects.link(sun)
    camd = bpy.data.cameras.new("cam")
    camd.lens = 40
    cam = bpy.data.objects.new("cam", camd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    # Tint him so the two men read apart.
    matB = bodyB.data.materials[0].copy() if bodyB.data.materials else None
    if matB:
        for nd in matB.node_tree.nodes:
            if nd.type == "BSDF_PRINCIPLED":
                mix = matB.node_tree.nodes.new("ShaderNodeMixRGB")
                mix.blend_type = "MULTIPLY"
                mix.inputs[0].default_value = 0.85
                mix.inputs[2].default_value = (0.35, 0.55, 1.0, 1)
                link = nd.inputs["Base Color"].links
                if link:
                    src = link[0].from_socket
                    matB.node_tree.links.new(src, mix.inputs[1])
                    matB.node_tree.links.new(mix.outputs[0], nd.inputs["Base Color"])
        bodyB.material_slots[0].link = "OBJECT"
        bodyB.material_slots[0].material = matB


def render(tag):
    mid = (wpos(A, "Spine01") + wpos(B, "Spine01")) * 0.5
    fA, lA = frame(A)
    views = {
        "left": mid + lA * 2.6 + UP * 0.15,          # side on, from your left
        "right": mid - lA * 2.6 + UP * 0.15,         # side on, from your right
        "behind-you": mid - fA * 2.4 + lA * 0.7 + UP * 0.35,
        "behind-him": mid + fA * 2.4 - lA * 0.7 + UP * 0.35,
    }
    for view, loc in views.items():
        cam.location = loc
        d = mid + UP * 0.05 - cam.location
        cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
        bpy.context.scene.render.filepath = os.path.join(RENDER, f"{tag}-{view}.png")
        bpy.ops.render.render(write_still=True)
        renders.append(f"{tag}-{view}")


run("hug", hug_pose, lambda k: hug_gap(k, hug_close),
    lambda bvA, bvB: [(A, "L", bvB), (A, "R", bvB), (B, "L", bvA), (B, "R", bvA)])
run("dap", dap_pose, lambda k: dap_gap(k, dap_close, dap_closer),
    lambda bvA, bvB: [(A, "L", bvB), (B, "L", bvA)])
run("pat", pat_pose, lambda k: pat_gap(k, pat_close),
    lambda bvA, bvB: [(A, "R", bvB)])

# Claps: one man on his own.
place(APART, 0)
for name, high, secs in (("clap-chest", False, 0.96), ("clap-high", True, 1.0)):
    n = int(round(secs * FPS)) + 1
    fr = []
    for i in range(n):
        clap_pose(A, i / (n - 1), high)
        fr.append(local_rotations(A))
    TRACKS[name] = fr
    RESULTS[name] = {"missed_reach_mm": round(1000 * max(MISS), 1) if MISS else 0}
    MISS.clear()

# ── Write the file ────────────────────────────────────────────────────────
aj, abin = glb.read(os.path.join(PLAIN, "anims.glb"))
w = glb.Writer()
nodes = [{k: v for k, v in n.items()} for n in aj["nodes"]]
name_to_node = {n.get("name"): i for i, n in enumerate(nodes)}
anims = []
for name, frames in TRACKS.items():
    t = np.arange(len(frames), dtype=np.float32) / FPS
    tin = w.acc(t, "SCALAR", minmax=True)
    chans, samps = [], []
    for bone in BONES:
        if bone not in name_to_node:
            continue
        q = np.array([[f[bone].x, f[bone].y, f[bone].z, f[bone].w] for f in frames], np.float32)
        # Keep each key on the same side as the one before (no flips mid-clip).
        for i in range(1, len(q)):
            if np.dot(q[i], q[i - 1]) < 0:
                q[i] = -q[i]
        samps.append({"input": tin, "output": w.acc(q, "VEC4"), "interpolation": "LINEAR"})
        chans.append({"sampler": len(samps) - 1, "target": {"node": name_to_node[bone], "path": "rotation"}})
    anims.append({"name": name, "channels": chans, "samplers": samps})
root = name_to_node["Armature"]
extras = {"hipsY": aj["scenes"][0]["extras"]["hipsY"], "greet": GREET,
          "made": "tools/ovation3d/author_greetings.py (Blender " + bpy.app.version_string + ")"}
out = {"asset": {"version": "2.0", "generator": "knowitball author_greetings.py"},
       "scene": 0, "scenes": [{"nodes": [root], "extras": extras}], "nodes": nodes, "animations": anims}
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
size = w.save(OUT, out)
print("RESULTS " + json.dumps({"bytes": size, "hug_close": round(hug_close, 3), "dap_close": round(dap_close, 3),
                               "dap_closer": round(dap_closer, 3), "pat_close": pat_close, "clips": RESULTS,
                               "renders": renders}))
