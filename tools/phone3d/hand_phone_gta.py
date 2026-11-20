"""THE 3D PHONE, FIRST PERSON, ONE HAND (Harry, 20 Nov 2026: "try use the same angle
as the gta one - also make PERFECT HANDS! They don't have to type or press just hold").

A still of ONE right hand holding a phone, first person: the arm comes in from the
bottom right, the phone stands upright in the palm, the fingers wrap the left edge
and the thumb lies along the right edge (never on the screen). Rendered on a
see-through background; the real phone UI is laid over the green screen.

THE HAND is the game's own realistic player (public/star/human3d/human.glb, the
CC0 MakeHuman body: real finger bones, knuckles, creases and nails), not primitives.
Its right forearm and hand are cut out and posed here:
  1. the hand is laid behind the phone (palm to the phone's back),
  2. every finger joint is closed, one after another, until it touches the phone
     (a grasp solver against the phone's exact rounded-box shape),
  3. the thumb is swung onto the right edge the same way,
  4. skin that would press into the phone is flattened onto it (a contact patch,
     as real finger pads do), so nothing passes into the phone (RUL-3D-005),
  5. the script counts faces of one finger that cut another finger and prints it.
Skin colour is ONE value (the last argument); the body's own skin picture only
adds its light and dark detail (nails, creases, knuckles) on top of that colour.

Blender cannot read the game's packed file, so unpack it once (as tools/bodies does):
  S=/tmp/phone3d && mkdir -p $S
  npm i --prefix $S/gt @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4 meshoptimizer draco3dgltf sharp
  node tools/ovation3d/unpack.mjs public/star/human3d/human.glb $S/human.glb --tools=$S/gt
  node tools/styletest/strip.mjs $S/human.glb $S/human_s.glb $S/gt
The script reads $PHONE3D_HUMAN, or /tmp/phone3d/human_s.glb.

usage: blender -b -P hand_phone_gta.py -- <out.png> [width height samples] [skin hex]
       (780 1688 220 "#c58a66" by default)
It prints one line: SCREEN {"w":..,"h":..,"corners":{"tl":[x,y],"tr":..,"br":..,"bl":..}}
(the screen's four corners in picture pixels) and one line CHECK {...} (contact and
crossing numbers). Extra views for checking: PHONE3D_VIEW=front|left|right|back|top.
"""
import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "blender-shop", "scripts"))
import studio as S  # noqa: E402

a = S.args()
OUT = a[0]
W = int(a[1]) if len(a) > 1 else 780
H = int(a[2]) if len(a) > 2 else 1688
SAMPLES = int(a[3]) if len(a) > 3 else 220
SKIN = a[4] if len(a) > 4 else "#c58a66"  # the ONE skin value: later it follows the player
HUMAN = os.environ.get("PHONE3D_HUMAN", "/tmp/phone3d/human_s.glb")
VIEW = os.environ.get("PHONE3D_VIEW", "")
E = lambda k, d: float(os.environ.get(k, d))  # noqa: E731  dials, for trying things out

MM = 0.001

# ------------------------------------------------------------------ the phone
# Phone space IS world space: centre at the origin, long side along Z, the screen
# faces -Y (the camera side). The camera and lights move round it, never the phone,
# so the phone's shape stays a simple formula for the grasp solver.
PW, PH, PT = 71.5 * MM, 147.5 * MM, 8.0 * MM
RC = 11.0 * MM   # corner radius seen from the front
RE = 2.0 * MM    # how round the long edges are
BEZEL = 2.7 * MM
SW, SH = PW - 2 * BEZEL, PH - 2 * BEZEL


def phone_sd(P):
    """Signed distance (m) from points P (n,3) to the phone body. Negative = inside."""
    x, y, z = np.abs(P[:, 0]), np.abs(P[:, 1]), np.abs(P[:, 2])
    qx, qz = x - (PW / 2 - RC), z - (PH / 2 - RC)
    d2 = np.hypot(np.maximum(qx, 0), np.maximum(qz, 0)) + np.minimum(np.maximum(qx, qz), 0) - RC
    u, v = d2 + RE, y - (PT / 2 - RE)
    return np.hypot(np.maximum(u, 0), np.maximum(v, 0)) + np.minimum(np.maximum(u, v), 0) - RE


def phone_grad(P, h=2e-5):
    g = np.zeros_like(P)
    for k in range(3):
        d = np.zeros(3)
        d[k] = h
        g[:, k] = (phone_sd(P + d) - phone_sd(P - d)) / (2 * h)
    n = np.linalg.norm(g, axis=1, keepdims=True)
    return g / np.maximum(n, 1e-9)


def rrect(hw, hh, r, n=14):
    """A rounded rectangle in X,Z (counter-clockwise seen from -Y)."""
    pts = []
    for cx, cz, a0 in ((hw - r, hh - r, 0), (-(hw - r), hh - r, 90), (-(hw - r), -(hh - r), 180), (hw - r, -(hh - r), 270)):
        for k in range(n + 1):
            t = math.radians(a0 + 90 * k / n)
            pts.append((cx + r * math.cos(t), cz + r * math.sin(t)))
    return pts


def plate(name, hw, hh, r, y, mat):
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, z)) for x, z in rrect(hw, hh, r)]
    f = bm.faces.new(vs)
    if f.normal.y > 0:
        f.normal_flip()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(mat)
    return ob


def build_phone(mats):
    rings = []
    steps = 8
    prof = [(-PT / 2, RE)]  # (y, inset)
    for k in range(steps + 1):
        t = math.pi / 2 * k / steps
        prof.append((-(PT / 2 - RE) - RE * math.cos(t), RE * (1 - math.sin(t))))
    for k in range(steps + 1):
        t = math.pi / 2 * k / steps
        prof.append(((PT / 2 - RE) + RE * math.sin(t), RE * (1 - math.cos(t))))
    prof.append((PT / 2, RE))
    for y, inset in prof:
        rings.append([(x, y, z) for x, z in rrect(PW / 2 - inset, PH / 2 - inset, RC - inset)])
    body = S.loft("PhoneBody", rings, cap=True, smooth=True, subsurf=0)
    try:
        body.data.use_auto_smooth = True
        body.data.auto_smooth_angle = math.radians(40)
    except Exception:
        pass
    body.data.materials.append(mats["frame"])
    plate("Glass", PW / 2 - 0.7 * MM, PH / 2 - 0.7 * MM, RC - 0.7 * MM, -PT / 2 - 0.05 * MM, mats["glass"])
    plate("ScreenPlane", SW / 2, SH / 2, RC - BEZEL, -PT / 2 - 0.12 * MM, mats["screen"])


def build_buttons(mats, P):
    """Side buttons, placed only where no finger is: above the highest skin on each edge."""
    from kit import box
    top = PH / 2 - RC
    for side, lens in ((-1, (10, 10)), (1, (14,))):
        near = P[(P[:, 0] * side > PW / 2 - 1 * MM) & (np.abs(P[:, 1]) < 9 * MM) & (P[:, 0] * side < PW / 2 + 6 * MM)]
        z = (float(near[:, 2].max()) if len(near) else -PH / 2) + 5 * MM
        z = max(z, 22 * MM)
        for k, ln in enumerate(lens):
            if z + ln * MM > top:
                break
            box(f"Button{side}{k}", (side * (PW / 2 + 0.15 * MM), 0, z + ln * MM / 2), (0.9 * MM, 2.6 * MM, ln * MM), mats["button"], bevel=0.4 * MM, seg=3)
            z += (ln + 3) * MM


# ------------------------------------------------------------------ materials
def mat_screen():
    """Flat pure green to the camera only: it lights nothing and shows no glare,
    so the UI laid over it is not fighting a tint."""
    m = bpy.data.materials.new("Screen")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*S.srgb("#00ff66"), 1)
    lp = nt.nodes.new("ShaderNodeLightPath")
    nt.links.new(lp.outputs["Is Camera Ray"], em.inputs["Strength"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return m


def mat_skin(tex, avg):
    m = bpy.data.materials.new("Skin")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tone = S.srgb(SKIN)
    lk = nt.links.new
    col = None
    if tex is not None:
        # detail = the body's skin picture divided by its own average on the hand:
        # 1 on plain skin, lighter on nails and palm, darker in creases
        ti = nt.nodes.new("ShaderNodeTexImage")
        ti.image = tex
        div = nt.nodes.new("ShaderNodeVectorMath")
        div.operation = "DIVIDE"
        div.inputs[1].default_value = avg
        lk(ti.outputs["Color"], div.inputs[0])
        # keep 85% of the detail so the tone stays the chosen one
        mixd = nt.nodes.new("ShaderNodeMix")
        mixd.data_type = "RGBA"
        mixd.inputs["Factor"].default_value = 0.85
        mixd.inputs["A"].default_value = (1, 1, 1, 1)
        lk(div.outputs[0], mixd.inputs["B"])
        mul = nt.nodes.new("ShaderNodeVectorMath")
        mul.operation = "MULTIPLY"
        mul.inputs[1].default_value = tone
        lk(mixd.outputs["Result"], mul.inputs[0])
        col = mul.outputs[0]
    # a little blotch of colour, as living skin has
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n1 = nt.nodes.new("ShaderNodeTexNoise")
    n1.inputs["Scale"].default_value = 60
    n1.inputs["Detail"].default_value = 3
    lk(tc.outputs["Object"], n1.inputs["Vector"])
    hsv = nt.nodes.new("ShaderNodeHueSaturation")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.3
    mr.inputs["From Max"].default_value = 0.7
    mr.inputs["To Min"].default_value = 0.93
    mr.inputs["To Max"].default_value = 1.07
    lk(n1.outputs["Fac"], mr.inputs["Value"])
    lk(mr.outputs["Result"], hsv.inputs["Value"])
    hsv.inputs["Saturation"].default_value = E("PHONE3D_SAT", 0.84)
    if col is not None:
        lk(col, hsv.inputs["Color"])
    else:
        hsv.inputs["Color"].default_value = (*tone, 1)
    cr = nt.nodes.new("ShaderNodeVertexColor")
    cr.layer_name = "crease"
    dark = nt.nodes.new("ShaderNodeMix")
    dark.data_type = "RGBA"
    dark.blend_type = "MULTIPLY"
    lk(cr.outputs["Color"], dark.inputs["Factor"])
    lk(hsv.outputs["Color"], dark.inputs["A"])
    dark.inputs["B"].default_value = (0.80, 0.66, 0.62, 1)
    lk(dark.outputs["Result"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.5
    b.inputs["Specular IOR Level"].default_value = 0.36
    b.inputs["Subsurface Weight"].default_value = 1.0
    b.inputs["Subsurface Radius"].default_value = (1.0, 0.5, 0.34)
    b.inputs["Subsurface Scale"].default_value = E("PHONE3D_SSS", 0.0022)
    try:
        b.subsurface_method = "RANDOM_WALK"
    except Exception:
        pass
    b.inputs["Sheen Weight"].default_value = 0.08
    # the skin's own fine net of lines, a little unevenness, and the joint folds as grooves
    n2 = nt.nodes.new("ShaderNodeTexVoronoi")
    n2.feature = "DISTANCE_TO_EDGE"
    n2.inputs["Scale"].default_value = 520
    lk(tc.outputs["Object"], n2.inputs["Vector"])
    cl = nt.nodes.new("ShaderNodeMath")
    cl.operation = "MINIMUM"
    cl.inputs[1].default_value = 0.12
    lk(n2.outputs["Distance"], cl.inputs[0])
    n3 = nt.nodes.new("ShaderNodeTexNoise")
    n3.inputs["Scale"].default_value = 140
    n3.inputs["Detail"].default_value = 3
    lk(tc.outputs["Object"], n3.inputs["Vector"])
    add = nt.nodes.new("ShaderNodeMath")
    add.operation = "MULTIPLY_ADD"
    lk(cl.outputs[0], add.inputs[0])
    add.inputs[1].default_value = 2.2
    sc3 = nt.nodes.new("ShaderNodeMath")
    sc3.operation = "MULTIPLY"
    sc3.inputs[1].default_value = 0.35
    lk(n3.outputs["Fac"], sc3.inputs[0])
    lk(sc3.outputs[0], add.inputs[2])
    grv = nt.nodes.new("ShaderNodeMath")
    grv.operation = "MULTIPLY_ADD"
    lk(cr.outputs["Color"], grv.inputs[0])
    grv.inputs[1].default_value = -3.0
    lk(add.outputs[0], grv.inputs[2])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = E("PHONE3D_BUMP", 0.5)
    bump.inputs["Distance"].default_value = 0.00012
    lk(grv.outputs[0], bump.inputs["Height"])
    lk(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_cloth(name, col):
    m = S.principled(name, col, rough=0.9, sheen=0.12)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wv = nt.nodes.new("ShaderNodeTexNoise")
    wv.inputs["Scale"].default_value = 1400
    wv.inputs["Detail"].default_value = 2
    nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.5
    bump.inputs["Distance"].default_value = 0.0003
    nt.links.new(wv.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


# ------------------------------------------------------------------- the scene
S.reset()
scn = bpy.context.scene

if not os.path.exists(HUMAN):
    raise SystemExit(f"hand_phone_gta: no unpacked body at {HUMAN}. See the top of this file for the three commands.")
bpy.ops.import_scene.gltf(filepath=HUMAN)
arm = [o for o in bpy.data.objects if o.type == "ARMATURE"][0]
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.name != "Body.skin":
        bpy.data.objects.remove(o)
sk = bpy.data.objects["Body.skin"]
skin_tex = None
for n in sk.data.materials[0].node_tree.nodes:
    if n.type == "TEX_IMAGE":
        skin_tex = n.image

# keep the right forearm and hand only; weld the picture seams shut
gname = {g.index: g.name for g in sk.vertex_groups}
bm = bmesh.new()
bm.from_mesh(sk.data)
dl = bm.verts.layers.deform.verify()
kill = []
for v in bm.verts:
    w = sum(wt for gi, wt in v[dl].items() if gname[gi].startswith("RightHand") or gname[gi] == "RightForeArm")
    if w <= 0.5:
        kill.append(v)
bmesh.ops.delete(bm, geom=kill, context="VERTS")
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.15 * MM / sk.matrix_world.to_scale().x)
bm.to_mesh(sk.data)
bm.free()
for p in sk.data.polygons:
    p.use_smooth = True
for m_ in sk.modifiers:
    if m_.type == "ARMATURE":
        m_.use_deform_preserve_volume = True

# which bone owns each vertex (the solver looks at one finger segment at a time)
nv = len(sk.data.vertices)
dom = []
for v in sk.data.vertices:
    best = max(v.groups, key=lambda g: g.weight) if v.groups else None
    dom.append(gname[best.group] if best else "")
dom = np.array(dom)

# the average of the skin picture over the hand (for the detail-only shader)
avg = (0.6, 0.36, 0.25)
if skin_tex is not None:
    px = np.array(skin_tex.pixels[:], dtype=np.float32).reshape(skin_tex.size[1], skin_tex.size[0], 4)
    uvl = sk.data.uv_layers.active.data
    acc = []
    for lp in sk.data.loops:
        if dom[lp.vertex_index].startswith("RightHand"):
            u, v = uvl[lp.index].uv
            acc.append(px[min(int(v % 1 * px.shape[0]), px.shape[0] - 1), min(int(u % 1 * px.shape[1]), px.shape[1] - 1), :3])
    avg = tuple(float(x) for x in np.median(np.array(acc), axis=0))

mats = {
    "frame": S.principled("PhoneFrame", "#23262c", rough=0.32, metal=0.9),
    "glass": S.principled("PhoneGlass", "#020304", rough=0.06, coat=1.0, coat_rough=0.03),
    "button": S.principled("PhoneButton", "#2b2f36", rough=0.3, metal=0.9),
    "screen": mat_screen(),
    "skin": mat_skin(skin_tex, avg),
    "sleeve": mat_cloth("Sleeve", os.environ.get("PHONE3D_SLEEVE", "#1c2233")),
    "cuff": mat_cloth("Cuff", os.environ.get("PHONE3D_CUFF", "#141926")),
}
sk.data.materials.clear()
sk.data.materials.append(mats["skin"])
build_phone(mats)


# ------------------------------------------------------------- posing helpers
def upd():
    bpy.context.view_layer.update()


def jpos(name):
    return (arm.matrix_world @ arm.pose.bones[name].matrix).translation.copy()


def turn(name, axis, deg, pivot=None):
    """Turn a bone (and all it carries) by deg about a WORLD axis through pivot (its own joint by default)."""
    pb = arm.pose.bones[name]
    Mw = arm.matrix_world @ pb.matrix
    pv = Mw.translation.copy() if pivot is None else Vector(pivot)
    R = Matrix.Rotation(math.radians(deg), 4, Vector(axis).normalized())
    pb.matrix = arm.matrix_world.inverted() @ (Matrix.Translation(pv) @ R @ Matrix.Translation(-pv) @ Mw)
    upd()


def aim(name, cur, target, pivot=None, frac=1.0):
    """Turn a bone by the smallest turn that takes direction cur onto target."""
    cur, target = Vector(cur).normalized(), Vector(target).normalized()
    ax = cur.cross(target)
    if ax.length < 1e-8:
        return
    turn(name, ax, math.degrees(cur.angle(target)) * frac, pivot)


def skin_points():
    """The hand's vertices in world space, as posed (no smoothing yet)."""
    dg = bpy.context.evaluated_depsgraph_get()
    oe = sk.evaluated_get(dg)
    me = oe.to_mesh()
    co = np.empty(len(me.vertices) * 3, dtype=np.float64)
    me.vertices.foreach_get("co", co)
    oe.to_mesh_clear()
    co = co.reshape(-1, 3)
    M = np.array(oe.matrix_world)
    return co @ M[:3, :3].T + M[:3, 3]


def guard_sd(P):
    """The space in front of the glass (all but 1.5 mm of the rim): no finger may enter it,
    so nothing ever covers the screen."""
    q = np.stack([np.abs(P[:, 0]) - (PW / 2 - 1.5 * MM), np.abs(P[:, 1] + 0.03) - 0.03, np.abs(P[:, 2]) - (PH / 2 - 1.5 * MM)], axis=1)
    return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(axis=1), 0)


def depth(names, joint=None, clear=9 * MM):
    """How far the deepest vertex of these bones sits inside the phone (m, + = inside).
    Skin right at the turning joint is left out: there the flesh folds, it does not block."""
    P = skin_points()
    sel = names if isinstance(names, np.ndarray) else np.isin(dom, names)
    if joint is not None:
        sel &= np.linalg.norm(P - np.array(jpos(joint)), axis=1) > clear
    if not sel.any():
        return -1.0
    return float(-np.minimum(phone_sd(P[sel]), guard_sd(P[sel])).min())


# ------------------------------------------------------- 1. lay the hand down
bones0 = {b.name: arm.matrix_world @ b.head_local for b in arm.data.bones}
W0 = bones0["RightHand"]
f0 = (bones0["RightHandMiddle1"] - W0).normalized()                     # along the fingers
a0 = bones0["RightHandIndex1"] - bones0["RightHandLittle1"]
a0 = (a0 - f0 * a0.dot(f0)).normalized()                                # towards the thumb side
p0 = a0.cross(f0)                                                       # out of the palm

_rest = skin_points()
rest_a = (_rest - np.array(W0)) @ np.array(a0)      # each vertex: how far to the thumb side, at rest

TH = math.radians(E("PHONE3D_THETA", 52))   # fingers lean this far left of straight up
ROLL = E("PHONE3D_ROLL", 0)                # the hand cups: thumb side comes forward
f1 = Vector((-math.sin(TH), 0, math.cos(TH)))
a1 = Vector((math.cos(TH), 0, math.sin(TH)))
Rr = Matrix.Rotation(math.radians(ROLL), 3, f1)
a1 = Rr @ a1
p1 = a1.cross(f1)
R0 = Matrix((a0, f0, p0)).transposed()      # columns = rest axes
R1 = Matrix((a1, f1, p1)).transposed()
Rhand = R1 @ R0.inverted()
# where the index finger's knuckle goes: behind the phone, so its tip just reaches the left edge
IDX1 = Vector((E("PHONE3D_IDX1X", 13) * MM, PT / 2 + 20 * MM, E("PHONE3D_IDXZ", 14) * MM))
ANCHOR = "RightHandIndex1"


def place_hand(shift=Vector((0, 0, 0))):
    M = Matrix.Translation(shift) @ Rhand.to_4x4() @ arm_rest
    arm.matrix_world = M
    upd()


arm_rest = arm.matrix_world.copy()
place_hand()
# open the fingers flat first (the rest pose has them half curled), then measure
FINGERS = ("Index", "Middle", "Ring", "Little")
OPEN = {"Index": (-22, -14, -6), "Middle": (-22, -14, -6), "Ring": (-22, -14, -6), "Little": (-24, -12, -6)}
SPREAD = {"Index": E("PHONE3D_SPI", 5), "Middle": 0, "Ring": -4, "Little": E("PHONE3D_SPL", -9)}


def flex_axis(fg, j):
    """The axis a finger joint curls about (towards the palm)."""
    n1 = f"RightHand{fg}{j}"
    n2 = f"RightHand{fg}{j + 1}" if j < 3 else None
    if n2:
        d = jpos(n2) - jpos(n1)
    else:
        d = jpos(n1) - jpos(f"RightHand{fg}{j - 1}")
    pw = (arm.matrix_world.to_3x3() @ arm_rest.to_3x3().inverted() @ p0).normalized()
    ax = d.normalized().cross(pw)
    return ax.normalized(), pw


for fg in FINGERS:
    for j in (1, 2, 3):
        ax, pw = flex_axis(fg, j)
        turn(f"RightHand{fg}{j}", ax, OPEN[fg][j - 1])
    turn(f"RightHand{fg}1", p1, SPREAD[fg])
# slide the whole hand so the index finger's last joint sits at IDX3
place_hand(IDX1 - jpos(ANCHOR))
shift = IDX1 - jpos(ANCHOR) + (arm.matrix_world.translation - (Rhand.to_4x4() @ arm_rest).translation)
place_hand(shift)

# seat the palm: back away from the phone until the palm only presses lightly
PRESS = E("PHONE3D_PRESS", 1.2) * MM
# (the thumb's ball is soft and sits behind the phone's right half: it does not hold the hand off)
palm_names = ((dom == "RightHand") & (rest_a < E("PHONE3D_THENAR", 8) * MM)) | np.isin(dom, [f"RightHand{fg}1" for fg in FINGERS])
lo, hi = -12 * MM, 30 * MM
for _ in range(22):
    mid = (lo + hi) / 2
    place_hand(shift + Vector((0, mid, 0)))
    if depth(palm_names) > PRESS:
        lo = mid
    else:
        hi = mid
SEAT = hi + E("PHONE3D_SEAT", 0) * MM
shift = shift + Vector((0, SEAT, 0))
place_hand(shift)

# ----------------------------------------------- 2. close the fingers on the phone
# Each finger is first curled into a relaxed hook (middle joint, then half as much at the
# last joint); then the knuckle closes until the finger meets the phone; then the middle
# and the last joint each close further until they meet it too. The hook is what brings
# the pad onto the phone's left edge instead of letting a straight finger sail past it.
LIMIT = {1: 85, 2: 105, 3: 70}
HOOK = {"Index": E("PHONE3D_HKI", 45), "Middle": E("PHONE3D_HKM", 62), "Ring": E("PHONE3D_HKR", 66), "Little": E("PHONE3D_HKL", 60)}
closed = {}
DIPK = E("PHONE3D_DIPK", 0.6)


def close_joint(name, ax, mine, limit, clear=9 * MM, step=1.5):
    """Turn joint `name` about ax until `mine` presses the phone by PRESS. Returns (deg, met)."""
    pbm = arm.pose.bones[name]
    base = pbm.matrix.copy()

    def at(angle):
        pbm.matrix = base
        upd()
        if angle:
            turn(name, ax, angle)
        return depth(mine, name, clear) > PRESS

    ang, got = 0.0, None
    if at(0):                       # already in: open until free
        while ang > -40 and at(ang):
            ang -= step
        got = ang
    else:
        while ang < limit:
            ang += step
            if at(ang):
                lo_, hi_ = ang - step, ang
                for _ in range(8):
                    mid_ = (lo_ + hi_) / 2
                    if at(mid_):
                        hi_ = mid_
                    else:
                        lo_ = mid_
                got = lo_
                break
    at(got if got is not None else 0)
    return (got if got is not None else 0.0), got is not None


for fg in FINGERS:
    n1, n2, n3 = (f"RightHand{fg}{j}" for j in (1, 2, 3))
    turn(n2, flex_axis(fg, 2)[0], HOOK[fg])
    turn(n3, flex_axis(fg, 3)[0], HOOK[fg] * DIPK)
    for j, name in ((1, n1), (2, n2), (3, n3)):
        mine = [f"RightHand{fg}{k}" for k in range(j, 4)]
        ang, met = close_joint(name, flex_axis(fg, j)[0], mine, LIMIT[j] - (0 if j == 1 else HOOK[fg] * (1 if j == 2 else DIPK)))
        closed[name[9:]] = (round(ang, 1), met)


def dbg(tag):
    if os.environ.get("PHONE3D_DEBUG"):
        print("DBG", tag, {n[9:] or "Wrist": [round(c * 1000) for c in jpos(n)] for n in arm.pose.bones.keys() if n.startswith("RightHand")})


dbg("fingers")
# ---------------------------------------------- 3. the thumb onto the right edge
T1, T2, T3 = "RightHandThumb1", "RightHandThumb2", "RightHandThumb3"


def reach(name, child, x, y):
    """Turn bone `name` so its child joint lands on the upright line (x, y, any z), above it."""
    o, c = jpos(name), jpos(child)
    L = (c - o).length
    dx, dy = x - o.x, y - o.y
    dz = math.sqrt(max(L * L - dx * dx - dy * dy, (0.25 * L) ** 2))
    aim(name, c - o, Vector((dx, dy, dz)))


# the thumb's knuckle beside the phone's right edge, the next joint on the edge, the tip up along it
for _ in range(2):
    reach(T1, T2, PW / 2 + E("PHONE3D_T2X", 20) * MM, E("PHONE3D_T2Y", 5) * MM)
    reach(T2, T3, PW / 2 + E("PHONE3D_T3X", 12) * MM, E("PHONE3D_T3Y", 0) * MM)
tipdir = Vector((E("PHONE3D_TTX", -0.10), E("PHONE3D_TTY", 0.0), 1.0))
aim(T3, jpos(T3) - jpos(T2), tipdir, frac=0.9)
# turn the thumb about its own length so its pad (not its side) faces the phone's edge
bl = arm.data.bones[T3].matrix_local
Mrest = (arm_rest @ bl).to_3x3()
sel3 = dom == T3
bdir0 = (bones0[T3] - bones0[T2]).normalized()
Q = _rest[sel3] - _rest[sel3].mean(axis=0)
Q = Q - np.outer(Q @ np.array(bdir0), np.array(bdir0))
wv, vv = np.linalg.eigh(Q.T @ Q)
pad0 = Vector(vv[:, 1])                      # the thin way through the thumb tip: nail to pad
if pad0.dot(a0) > 0:
    pad0 = -pad0                             # the pad is the side away from the thumb's outer edge
Mnow = (arm.matrix_world @ arm.pose.bones[T3].matrix).to_3x3()
pad = (Mnow @ Mrest.inverted() @ pad0).normalized()
tax = (jpos(T3) - jpos(T2)).normalized()
want = Vector((-1, E("PHONE3D_PADY", 0.25), 0))
pp, ww = (pad - tax * pad.dot(tax)).normalized(), (want - tax * want.dot(tax)).normalized()
tw = math.degrees(math.atan2(pp.cross(ww).dot(tax), pp.dot(ww)))
tw = max(-70, min(70, tw)) * E("PHONE3D_TWK", 1.0)
turn(T1, jpos(T2) - jpos(T1), tw * 0.5)
turn(T2, jpos(T3) - jpos(T2), tw * 0.5)
closed["ThumbTwist"] = (round(tw, 1), True)
# open the thumb a little, then close each joint in turn until it presses the edge
SWING_AX = Vector((0, -1, 0))
turn(T2, SWING_AX, -E("PHONE3D_TOPEN", 14))
for name, lim, clear in ((T2, 45, 14 * MM), (T3, 40, 10 * MM)):
    mine = [T3] if name == T3 else [T2, T3]
    ang, met = close_joint(name, SWING_AX, mine, lim, clear=clear, step=1.0)
    closed[name[9:]] = (round(ang, 1), met)
dbg("thumb")

# ------------------------------------------------------------------ the camera
# The eye: below and a little left of the screen's straight-ahead line, so the phone
# leans back and shows its left edge, as in the reference; then rolled a few degrees.
DIST = E("PHONE3D_DIST", 0.28)
PITCH, YAW, CROLL = math.radians(E("PHONE3D_PITCH", 13)), math.radians(E("PHONE3D_YAW", 7)), E("PHONE3D_CROLL", 5)
LOOK = Vector((E("PHONE3D_LX", 7.5) * MM, 0, E("PHONE3D_LZ", -16) * MM))
cdir = Vector((-math.sin(YAW) * math.cos(PITCH), -math.cos(YAW) * math.cos(PITCH), -math.sin(PITCH)))
cam = S.camera(tuple(LOOK + cdir * DIST), tuple(LOOK), lens=E("PHONE3D_LENS", 38))
cam.data.sensor_fit = "VERTICAL"
cam.data.sensor_height = 36
cam.data.clip_start = 0.01
cam.rotation_euler.rotate(Matrix.Rotation(math.radians(-CROLL), 3, -cdir))
upd()

# -------------------------------------------- the wrist: the forearm goes to the elbow
# A real first-person arm: the elbow is low and to the right of the eye. The forearm
# turns about the wrist to point there; the hand itself does not move.
elbow = cam.matrix_world @ Vector((E("PHONE3D_EX", 0.24), E("PHONE3D_EY", -0.36), E("PHONE3D_EZ", -0.04)))
Wp = jpos("RightHand")
hand_keep = arm.pose.bones["RightHand"].matrix.copy()
cur = (jpos("RightForeArm") - Wp).normalized()      # a straight wrist: the rest pose
tgt = (elbow - Wp).normalized()
# The wrist stays nearly straight. It may fold towards the palm (that brings the forearm
# towards the eye, where it is foreshortened and reads as natural), but only a few degrees
# sideways: a big sideways bend is what makes a pinched neck and a sagging palm heel.
FLEX_MAX, SIDE_MAX = E("PHONE3D_WFLEX", 26), E("PHONE3D_WSIDE", 5)
best = (9.0, 0.0, 0.0)
for fl in np.linspace(-8, FLEX_MAX, 35):
    for sd_ in np.linspace(-SIDE_MAX, SIDE_MAX, 11):
        d_ = Matrix.Rotation(math.radians(sd_), 3, p1) @ (Matrix.Rotation(math.radians(fl), 3, a1) @ cur)
        ang_ = d_.angle(tgt)
        if ang_ < best[0]:
            best = (ang_, float(fl), float(sd_))
_, wflex, wside = best
turn("RightForeArm", a1, wflex, Wp)
turn("RightForeArm", p1, wside, Wp)
angw = math.hypot(wflex, wside)
arm.pose.bones["RightHand"].matrix = hand_keep
upd()

# ------------------------------------------------- 4. bake, smooth, flatten contacts
sub = sk.modifiers.new("smooth", "SUBSURF")
sub.levels = 3
sub.render_levels = 3
dg = bpy.context.evaluated_depsgraph_get()
hand_me = bpy.data.meshes.new_from_object(sk.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
hand = bpy.data.objects.new("Hand", hand_me)
scn.collection.objects.link(hand)
hand.matrix_world = sk.matrix_world.copy()
upd()
hand_me.transform(hand.matrix_world)
hand.matrix_world = Matrix.Identity(4)
bpy.data.objects.remove(sk)
for p in hand_me.polygons:
    p.use_smooth = True

n = len(hand_me.vertices)
P = np.empty(n * 3)
hand_me.vertices.foreach_get("co", P)
P = P.reshape(-1, 3)
d = phone_sd(P)
deep_before = float(-d.min())
GAP = 0.06 * MM
for _ in range(4):
    d = phone_sd(P)
    inside = d < GAP
    if not inside.any():
        break
    P[inside] += phone_grad(P[inside]) * (GAP - d[inside])[:, None]
touching = int((phone_sd(P) < 0.25 * MM).sum())
hand_me.vertices.foreach_set("co", P.reshape(-1))
hand_me.update()

build_buttons(mats, P)

# who owns each baked vertex, for the checks
gnames = [g.name for g in hand.vertex_groups]
domf = np.empty(n, dtype=object)
for v in hand_me.vertices:
    best = max(v.groups, key=lambda g: g.weight) if v.groups else None
    domf[v.index] = gnames[best.group] if best else ""


def digit(nm):
    for k in ("Thumb", "Index", "Middle", "Ring", "Little"):
        if k in nm:
            return k
    return "Palm" if nm == "RightHand" else "Arm"


# 5. count faces of one finger cutting another finger, or a fingertip cutting the palm
bmh = bmesh.new()
bmh.from_mesh(hand_me)
bvh = BVHTree.FromBMesh(bmh, epsilon=0.0)
bmh.faces.ensure_lookup_table()
cross, cross_at = {}, {}
for i, j in bvh.overlap(bvh):
    if i >= j:
        continue
    fi, fj = bmh.faces[i], bmh.faces[j]
    vi, vj = {v.index for v in fi.verts}, {v.index for v in fj.verts}
    if vi & vj:
        continue
    di, dj = digit(domf[next(iter(vi))]), digit(domf[next(iter(vj))])
    if di == dj or "Arm" in (di, dj):
        continue
    if "Palm" in (di, dj):
        other = domf[next(iter(vi))] if dj == "Palm" else domf[next(iter(vj))]
        if other.endswith("1"):       # a finger's first segment grows out of the palm
            continue
    key = "-".join(sorted((di, dj)))
    cross[key] = cross.get(key, 0) + 1
    cross_at.setdefault(key, []).append(tuple(fi.calc_center_median()))
bmh.free()

if os.environ.get("PHONE3D_DEBUG"):
    for k_, pts_ in cross_at.items():
        print("DBG cross", k_, [round(c * 1000) for c in np.mean(np.array(pts_), axis=0)], [round(c * 1000) for c in np.ptp(np.array(pts_), axis=0)])

# the skin folds at every finger joint: two fine lines across the palm side of each joint,
# painted on the baked mesh (the shader turns them into a shallow groove and a darker line)
crease = np.zeros(n)
pw_now = (arm.matrix_world.to_3x3() @ arm_rest.to_3x3().inverted() @ p0).normalized()
for dg_ in ("Thumb", "Index", "Middle", "Ring", "Little"):
    for j in (2, 3):
        nm = f"RightHand{dg_}{j}"
        J = np.array(jpos(nm))
        prev = np.array(jpos(f"RightHand{dg_}{j - 1}"))
        along = (J - prev) / np.linalg.norm(J - prev)
        rel_ = P - J
        tco = rel_ @ along
        side = rel_ - np.outer(tco, along)
        rad_ = np.linalg.norm(side, axis=1)
        own = np.array([dg_ in x for x in domf])
        # palm side of this finger: the way the joint folds (thumb: the side facing the fingers)
        fold = np.array(pw_now) if dg_ != "Thumb" else np.array(pad)
        facing = np.clip((side @ fold) / np.maximum(rad_, 1e-6) + 0.35, 0, 1)
        for off, wd, amt in ((-1.0 * MM, 0.38 * MM, 0.8), (1.2 * MM, 0.32 * MM, 0.5)):
            crease = np.maximum(crease, own * (rad_ < 14 * MM) * facing * amt * np.exp(-((tco - off) / wd) ** 2))
col = hand_me.color_attributes.new("crease", "FLOAT_COLOR", "POINT")
col.data.foreach_set("color", np.repeat(crease, 4))

# ------------------------------------------------------------------ the sleeve
Wp = Vector(jpos("RightHand"))
axis = (Vector(jpos("RightForeArm")) - Wp).normalized()
fa = P[np.array([digit(x) == "Arm" for x in domf])]
rel = fa - np.array(Wp)
t = rel @ np.array(axis)
rad = np.linalg.norm(rel - np.outer(t, np.array(axis)), axis=1)
ux = axis.cross(Vector((0, 1, 0))).normalized()
uy = axis.cross(ux).normalized()
CUFF0 = E("PHONE3D_CUFF0", 32) * MM          # the cuff starts this far up from the wrist joint
segs = 144
rings, ring_r = [], []
tt = [CUFF0 + k * 3.5 * MM for k in range(0, 13)] + [CUFF0 + 45 * MM + k * 12 * MM for k in range(1, 34)]
for s in tt:
    near = rad[(t > s - 14 * MM) & (t < s + 14 * MM)]
    body_r = float(near.max()) if len(near) else (ring_r[-1] - 6 * MM if ring_r else 30 * MM)
    cuff = s < CUFF0 + 42 * MM
    r = body_r + (2.2 * MM if cuff else 7.5 * MM)
    if ring_r and not cuff:
        r = max(r, ring_r[-1] * 0.995)
    ring_r.append(r)
    ring = []
    for k in range(segs):
        ang = 2 * math.pi * k / segs
        rr = r
        if cuff:
            rr += 0.55 * MM * math.cos(ang * 36)     # the cuff's ribs
            rr += -1.2 * MM * math.exp(-((s - CUFF0) / (3 * MM)) ** 2)  # rolled-in lip at the wrist end
        elif s < CUFF0 + 70 * MM:
            rr += 1.3 * MM * math.sin(ang * 5 + s * 90)  # soft gathers where the sleeve meets the cuff
        ring.append(tuple(Wp + axis * s + (ux * math.cos(ang) + uy * math.sin(ang)) * rr))
    rings.append(ring)
sleeve = S.loft("Sleeve", rings, cap=False, smooth=True, subsurf=0)
sleeve.data.materials.append(mats["cuff"])
sleeve.data.materials.append(mats["sleeve"])
for p in sleeve.data.polygons:
    ring_i = p.index // segs
    p.material_index = 0 if ring_i < 12 else 1
sol = sleeve.modifiers.new("thick", "SOLIDIFY")
sol.thickness = 1.6 * MM
sol.offset = 1.0
# the arm inside the sleeve is not needed, and must not poke through it
bmh = bmesh.new()
bmh.from_mesh(hand_me)
tv = np.array([(Vector(v.co) - Wp).dot(axis) for v in bmh.verts])
bmesh.ops.delete(bmh, geom=[v for v in bmh.verts if tv[v.index] > CUFF0 + 30 * MM], context="VERTS")
bmh.to_mesh(hand_me)
bmh.free()

# ------------------------------------------------------------------ the light
# A lived-in flat in the evening: one warm lamp up and to the left behind the eye,
# a soft warm bounce from the right wall, a dusk-blue window behind, and the faint
# glow of the screen itself on the thumb and fingertips.
S.setup_render((W, H), SAMPLES, view="Standard")
scn.view_settings.exposure = E("PHONE3D_EXPO", 0.0)
scn.view_settings.look = "None"
scn.cycles.use_denoising = False          # this Blender build has no denoiser
scn.cycles.adaptive_threshold = 0.008
scn.cycles.filter_width = 1.5
scn.render.dither_intensity = 0.0       # the screen green stays exactly #00ff66
scn.render.threads_mode = "AUTO"
S.world(E("PHONE3D_AMB", 0.32), top=(0.92, 0.80, 0.68), bottom=(0.28, 0.23, 0.20))
Mc = cam.matrix_world


def cs(x, y, z):
    return tuple(Mc @ Vector((x, y, z)))


aimp = (0.02, 0, -0.03)
S.area("Lamp", cs(-0.55, 0.55, 0.25), E("PHONE3D_KEY", 32), 0.5, (1.0, 0.88, 0.74), aim=aimp)
S.area("Bounce", cs(0.70, 0.05, 0.10), E("PHONE3D_FILL", 14), 0.9, (1.0, 0.86, 0.70), aim=aimp)
S.area("Window", cs(0.45, 0.35, -0.95), E("PHONE3D_RIM", 26), 0.6, (0.62, 0.74, 1.0), aim=aimp)
glow = S.area("ScreenGlow", (0, -PT / 2 - 0.6 * MM, 0), E("PHONE3D_GLOW", 0.035), SW * 0.9, (0.80, 0.90, 1.0), aim=(0, -1, 0), size_y=SH * 0.9)
glow.visible_camera = False

# ---------------------------------------------------------- screen corners
y = -PT / 2 - 0.12 * MM
corners = {"tl": Vector((-SW / 2, y, SH / 2)), "tr": Vector((SW / 2, y, SH / 2)),
           "br": Vector((SW / 2, y, -SH / 2)), "bl": Vector((-SW / 2, y, -SH / 2))}
px = {}
for k, v in corners.items():
    c = world_to_camera_view(scn, cam, v)
    px[k] = [round(c.x * W, 1), round((1 - c.y) * H, 1)]
print("SCREEN " + json.dumps({"w": W, "h": H, "corners": px, "corner_radius_of_width": round((RC - BEZEL) / SW, 4)}))
print("CHECK " + json.dumps({
    "joints_deg_and_touching": closed,
    "deepest_before_flatten_mm": round(deep_before * 1000, 2),
    "deepest_into_phone_after_mm": round(max(0.0, float(-phone_sd(P).min())) * 1000, 3),
    "vertices_touching_phone": touching,
    "faces_crossing_between_fingers": cross,
    "wrist_fold_to_palm_deg": round(wflex, 1), "wrist_sideways_deg": round(wside, 1),
    "skin": SKIN,
}))

# extra straight-on views for checking the grip (not the deliverable)
if VIEW:
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 0.30
    dv = {"front": (0, -1, 0), "back": (0, 1, 0), "left": (-1, 0, 0), "right": (1, 0, 0), "top": (0, 0, 1), "bottom": (0, 0, -1)}[VIEW]
    c0 = Vector((0.01, 0, -0.03))
    cam.location = c0 + Vector(dv) * 0.6
    cam.rotation_euler = (c0 - cam.location).to_track_quat("-Z", "Y").to_euler()
    glow.hide_render = True
    S.area("Dbg", tuple(cam.location), 6, 0.6, aim=tuple(c0))

S.render(OUT)
