"""
ANIME GOAL — a look test (Mikey, 8 Oct 2026).

"how this could look" in the style of Blue Lock's Kunigami goal: one REAL
recorded goal (a goal clip track, lib/star/goalClip/track.ts, dumped to JSON
by dump_track.mts) replayed in Blender with flat anime shading, ink outlines,
a white arena and set camera shots. Effects (white-out, speed lines, impact
frame, captions) are added afterwards by post.py.

    blender -b --python tools/anime3d/render_goal.py -- <plain dir> <track.json> <out dir> [--test]

<plain dir> holds player.glb unpacked by tools/ovation3d/unpack.mjs.
Every frame is posed from the recording: positions, the ball, the keeper's
dive. Only the limbs (run cycle, the kick, the keeper's reach) are made here.
"""
import bpy, math, os, sys, json
from mathutils import Vector, Matrix, Quaternion
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:]
PLAIN, TRACK, OUT = argv[0], argv[1], argv[2]
TEST = "--test" in argv
FPS_OUT = 24
UP = Vector((0, 0, 1))

D = json.load(open(TRACK))
FR = D["frames"]
TFPS = D["fps"]
BODIES = D["bodies"]
NB = len(BODIES)


def smooth(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def lerp(a, b, k):
    return a + (b - a) * k


# ── The recording ─────────────────────────────────────────────────────────
def _v(p):
    return Vector((p["x"], p["y"], p["z"]))


def raw_frame(t):
    f = max(0.0, min(len(FR) - 1.0, t * TFPS))
    i = int(math.floor(f))
    j = min(i + 1, len(FR) - 1)
    return FR[i], FR[j], f - i


def raw_ball(t):
    a, b, k = raw_frame(t)
    return _v(a["ball"]).lerp(_v(b["ball"]), k)


def body_at(t, n):
    a, b, k = raw_frame(t)
    return _v(a["bodies"][n]).lerp(_v(b["bodies"][n]), k)


def keeper_at(t):
    a, b, k = raw_frame(t)
    return {key: lerp(a["keeper"][key] or 0, b["keeper"][key] or 0, k) for key in ("dive", "lunge", "dir")}


# The recording snaps the ball to the receiver's feet on the frame he takes
# it (a 3 m jump between two frames). Find that jump and bridge it with a
# smooth flight onto his foot, so slow motion does not show a teleport.
SHOT = next(e for e in D["events"] if e["kind"] == "shot")
SCORER = next(i for i, b in enumerate(BODIES) if b["id"] == SHOT["who"])
fi = int(round(SHOT["t"] * TFPS))
jump = max(range(max(1, fi - 2), min(len(FR), fi + 4)), key=lambda i: (_v(FR[i]["ball"]) - _v(FR[i - 1]["ball"])).length)
T_CONTACT = jump / TFPS
P_CONTACT = _v(FR[jump]["ball"])
P_CONTACT.z = 0.32  # a first-time strike at shin height
T_BRIDGE = T_CONTACT - 0.17


def ball_at(t):
    if T_BRIDGE < t < T_CONTACT:
        p0 = raw_ball(T_BRIDGE)
        v0 = (raw_ball(T_BRIDGE) - raw_ball(T_BRIDGE - 0.03)) / 0.03
        dt = T_CONTACT - T_BRIDGE
        c1 = p0 + v0 * dt / 3
        c2 = P_CONTACT + Vector((0, 0.25, 0.2))
        k = (t - T_BRIDGE) / dt
        m = 1 - k
        return p0 * m ** 3 + c1 * 3 * m * m * k + c2 * 3 * m * k * k + P_CONTACT * k ** 3
    if abs(t - T_CONTACT) < 1e-6:
        return P_CONTACT.copy()
    return raw_ball(t)


def kicks():
    out = []
    for e in D["events"]:
        if e["kind"] in ("pass", "shot") and e.get("who"):
            i = next((n for n, b in enumerate(BODIES) if b["id"] == e["who"]), None)
            if i is None:
                continue
            t = T_CONTACT if i == SCORER and e["kind"] == "shot" else e["t"]
            if not any(o[0] == i and abs(o[1] - t) < 0.2 for o in out):
                out.append((i, t))
    return out


KICKS = kicks()


def kick_dir(t):
    d = ball_at(t + 0.12) - ball_at(t)
    d.z = 0
    return d.normalized() if d.length > 1e-4 else Vector((0, -1, 0))


# ── Scene ─────────────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=os.path.join(PLAIN, "player.glb"))
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.name != "Body":
        bpy.data.objects.remove(o)
A0 = bpy.data.objects["Armature"]
B0 = bpy.data.objects["Body"]
A0.rotation_mode = "XYZ"


def upd():
    bpy.context.view_layer.update()


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
    if abs(ang) > 1e-6:
        set_wrot(arm, n, Quaternion(axis.normalized(), ang).to_matrix() @ wrot(arm, n))


def aim(arm, n, child, target):
    head = wpos(arm, n)
    cur = wpos(arm, child) - head
    want = target - head
    if cur.length > 1e-6 and want.length > 1e-6:
        set_wrot(arm, n, cur.rotation_difference(want).to_matrix() @ wrot(arm, n))


def clear(arm):
    for p in arm.pose.bones:
        p.matrix_basis = Matrix.Identity(4)


upd()
REST = {n: wrot(A0, n) for n in A0.pose.bones.keys()}
RESTP = {n: wpos(A0, n) for n in A0.pose.bones.keys()}
L_UP = (RESTP["LeftLeg"] - RESTP["LeftUpLeg"]).length
L_LO = (RESTP["LeftFoot"] - RESTP["LeftLeg"]).length
A_UP = (RESTP["LeftForeArm"] - RESTP["LeftArm"]).length
A_LO = (RESTP["LeftHand"] - RESTP["LeftForeArm"]).length
ANKLE_Z = RESTP["LeftFoot"].z
HIP_Z = RESTP["Hips"].z


def two_bone(arm, upper, lower, end, W, pole, l1, l2):
    S = wpos(arm, upper)
    d = W - S
    reach = (l1 + l2) * 0.995
    if d.length > reach:
        W = S + d.normalized() * reach
        d = W - S
    dl = max(d.length, 1e-4)
    dn = d / dl
    a = (l1 * l1 - l2 * l2 + dl * dl) / (2 * dl)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    pp = pole - dn * pole.dot(dn)
    pp = pp.normalized() if pp.length > 1e-6 else Vector((0, 0, -1))
    aim(arm, upper, lower, S + dn * a + pp * h)
    aim(arm, lower, end, W)


# Kit painting by bone weight: shirt, shorts, socks, boots; skin and face keep
# the body's own texture.
def kit_layer(body, arm):
    me = body.data
    groups = {g.index: g.name for g in body.vertex_groups}
    Mw = body.matrix_world
    bones = arm.data.bones
    labels = []
    for v in me.vertices:
        if not v.groups:
            labels.append(None)
            continue
        g = max(v.groups, key=lambda x: x.weight)
        name = groups.get(g.group, "")
        p = Mw @ v.co
        def along(bn):
            b = bones[bn]
            h, tl = arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local
            ax = tl - h
            return (p - h).dot(ax) / max(ax.length_squared, 1e-6)
        lab = None
        if name.startswith("Spine") or name.endswith("Shoulder"):
            lab = "shirt"
        elif name in ("LeftArm", "RightArm"):
            lab = "shirt" if along(name) < 0.5 else None
        elif name == "Hips":
            lab = "shirt" if p.z > HIP_Z + 0.03 else "shorts"
        elif name.endswith("UpLeg"):
            lab = "shorts" if along(name) < 0.62 else None
        elif name in ("LeftLeg", "RightLeg"):
            lab = "sock" if along(name) > 0.22 else None
        elif "Foot" in name or "Toe" in name:
            lab = "boot"
        labels.append(lab)
    return labels


LABELS = kit_layer(B0, A0)


def hexc(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


KITS = {
    "us": {"shirt": "#d3202a", "shorts": "#15151c", "sock": "#d3202a", "boot": "#1d2a6e"},
    "them": {"shirt": "#f4f4f6", "shorts": "#1b2340", "sock": "#f4f4f6", "boot": "#111111"},
    "keeper": {"shirt": "#f2c230", "shorts": "#202020", "sock": "#f2c230", "boot": "#111111"},
}

LIGHT = Vector((0.45, 0.55, 0.75)).normalized()


def toon_nodes(mat, base_socket_fn, shadow=(0.56, 0.58, 0.80)):
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = LIGHT
    nt.links.new(geo.outputs["Normal"], dot.inputs[0])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (*shadow, 1)
    ramp.color_ramp.elements[1].position = 0.38
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    nt.links.new(dot.outputs["Value"], ramp.inputs[0])
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs[0].default_value = 1.0
    nt.links.new(base_socket_fn(nt), mul.inputs[6])
    nt.links.new(ramp.outputs[0], mul.inputs[7])
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(mul.outputs[2], em.inputs[0])
    nt.links.new(em.outputs[0], out.inputs[0])


def outline_mat(name="ink", col=(0.02, 0.02, 0.04)):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = (*col, 1)
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(geo.outputs["Backfacing"], mix.inputs[0])
    nt.links.new(em.outputs[0], mix.inputs[1])
    nt.links.new(tr.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    return m


INK = outline_mat()
tex_img = next((n.image for n in B0.data.materials[0].node_tree.nodes if n.type == "TEX_IMAGE" and n.image), None)


def body_mat(team):
    m = bpy.data.materials.new("toon-" + team)
    m.use_nodes = True

    def base(nt):
        tx = nt.nodes.new("ShaderNodeTexImage")
        tx.image = tex_img
        at = nt.nodes.new("ShaderNodeAttribute")
        at.attribute_name = "kit"
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        nt.links.new(at.outputs["Alpha"], mix.inputs[0])
        nt.links.new(tx.outputs[0], mix.inputs[6])
        nt.links.new(at.outputs["Color"], mix.inputs[7])
        return mix.outputs[2]
    toon_nodes(m, base)
    return m


def add_outline(obj, thick):
    obj.data.materials.append(INK)
    sol = obj.modifiers.new("ink", "SOLIDIFY")
    sol.thickness = thick
    sol.offset = 1
    sol.use_flip_normals = True
    sol.use_rim = False
    sol.material_offset = len(obj.data.materials) - 1


MEN = []
PAIRS = [(A0, B0)]
for i in range(1, NB):  # copy the bare man first, then dress each copy
    arm = A0.copy()
    arm.data = A0.data.copy()
    sc.collection.objects.link(arm)
    body = B0.copy()
    body.data = B0.data.copy()
    body.parent = arm
    for m in body.modifiers:
        if m.type == "ARMATURE":
            m.object = arm
    sc.collection.objects.link(body)
    PAIRS.append((arm, body))
for i, b in enumerate(BODIES):
    team = "keeper" if b["role"] == "keeper" else ("us" if b["side"] == "us" else "them")
    arm, body = PAIRS[i]
    body.data.materials.clear()
    body.data.materials.append(body_mat(team))
    ca = body.data.color_attributes.get("kit") or body.data.color_attributes.new("kit", "FLOAT_COLOR", "POINT")
    kit = KITS[team]
    for vi, lab in enumerate(LABELS):
        ca.data[vi].color = (*hexc(kit[lab]), 1.0) if lab else (0, 0, 0, 0)
    add_outline(body, 0.026)
    arm.rotation_mode = "XYZ"
    MEN.append({"arm": arm, "body": body, "team": team, "phase": 0.0, "last": None})

# The ball: a football from an icosphere (black patches round the 12 corners).
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.11)
BALL = bpy.context.object
bm_white = bpy.data.materials.new("ballw"); bm_white.use_nodes = True
bm_black = bpy.data.materials.new("ballb"); bm_black.use_nodes = True


def _const(nt, c):
    rgb = nt.nodes.new("ShaderNodeRGB")
    rgb.outputs[0].default_value = (*c, 1)
    return rgb.outputs[0]


toon_nodes(bm_white, lambda nt: _const(nt, (0.92, 0.92, 0.94)))
toon_nodes(bm_black, lambda nt: _const(nt, (0.03, 0.03, 0.04)))
BALL.data.materials.append(bm_white)
BALL.data.materials.append(bm_black)
phi = (1 + 5 ** 0.5) / 2
corners = [Vector(v).normalized() for v in [(-1, phi, 0), (1, phi, 0), (-1, -phi, 0), (1, -phi, 0), (0, -1, phi), (0, 1, phi), (0, -1, -phi), (0, 1, -phi), (phi, 0, -1), (phi, 0, 1), (-phi, 0, -1), (-phi, 0, 1)]]
for p in BALL.data.polygons:
    c = p.center.normalized()
    p.material_index = 1 if max(c.dot(k) for k in corners) > 0.93 else 0
    p.use_smooth = True
add_outline(BALL, 0.012)
BALL.rotation_mode = "XYZ"


def flat_mat(name, col):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = (*col, 1)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(em.outputs[0], out.inputs[0])
    return m, nt, em


# Pitch: mown stripes, as one plane with a stripe shader.
bpy.ops.mesh.primitive_plane_add(size=1, location=(34, 30, 0))
PITCH = bpy.context.object
PITCH.scale = (130, 130, 1)
pm, nt, em = flat_mat("pitch", (0, 0, 0))
tc = nt.nodes.new("ShaderNodeTexCoord")
sep = nt.nodes.new("ShaderNodeSeparateXYZ")
nt.links.new(tc.outputs["Object"], sep.inputs[0])
mth = nt.nodes.new("ShaderNodeMath"); mth.operation = "MULTIPLY"; mth.inputs[1].default_value = 130 / 5.5
nt.links.new(sep.outputs[1], mth.inputs[0])
fl = nt.nodes.new("ShaderNodeMath"); fl.operation = "FLOOR"
nt.links.new(mth.outputs[0], fl.inputs[0])
md = nt.nodes.new("ShaderNodeMath"); md.operation = "PINGPONG"; md.inputs[1].default_value = 1
nt.links.new(fl.outputs[0], md.inputs[0])
mx = nt.nodes.new("ShaderNodeMix"); mx.data_type = "RGBA"
mx.inputs[6].default_value = (*hexc("#3fae2e"), 1)
mx.inputs[7].default_value = (*hexc("#58c43c"), 1)
nt.links.new(md.outputs[0], mx.inputs[0])
nt.links.new(mx.outputs[2], em.inputs[0])
PITCH.data.materials.append(pm)

white, _, _ = flat_mat("line", (0.95, 0.97, 0.95))
SCENERY = [PITCH]


def strip(x0, y0, x1, y1, w=0.12):
    d = Vector((x1 - x0, y1 - y0, 0))
    bpy.ops.mesh.primitive_plane_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, 0.005))
    o = bpy.context.object
    o.scale = (w, d.length + w, 1)
    o.rotation_euler = (0, 0, math.atan2(-d.x, d.y))
    o.data.materials.append(white)
    SCENERY.append(o)


strip(-10, 0, 78, 0)
for x0, x1, dpt in ((24.84, 43.16, 5.5), (13.84, 54.16, 16.5)):
    strip(x0, 0, x0, dpt); strip(x1, 0, x1, dpt); strip(x0, dpt, x1, dpt)
bpy.ops.mesh.primitive_cylinder_add(radius=0.12, depth=0.01, location=(34, 11, 0.006))
bpy.context.object.data.materials.append(white); SCENERY.append(bpy.context.object)

# Goal: posts, bar, and a net from a grid with a wireframe.
GOAL = []
for x in (30.34, 37.66):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.065, depth=2.44, location=(x, 0, 1.22))
    GOAL.append(bpy.context.object)
bpy.ops.mesh.primitive_cylinder_add(radius=0.065, depth=7.45, location=(34, 0, 2.44), rotation=(0, math.pi / 2, 0))
GOAL.append(bpy.context.object)
postm = bpy.data.materials.new("post"); postm.use_nodes = True
toon_nodes(postm, lambda nt: _const(nt, (0.97, 0.97, 0.97)))
for o in GOAL:
    o.data.materials.append(postm)
    add_outline(o, 0.02)
netm, _, _ = flat_mat("net", (0.92, 0.94, 0.96))


def net_panel(loc, size, rot, cuts):
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=cuts[0], y_subdivisions=cuts[1], size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = (*size, 1)
    bpy.ops.object.transform_apply(scale=True)
    w = o.modifiers.new("wire", "WIREFRAME")
    w.thickness = 0.018
    o.data.materials.append(netm)
    GOAL.append(o)


net_panel((34, -1.2, 1.22), (7.32, 2.44), (math.pi / 2, 0, 0), (44, 15))
net_panel((34, -0.6, 2.44), (7.32, 1.2), (0, 0, 0), (44, 8))
net_panel((30.34, -0.6, 1.22), (1.2, 2.44), (math.pi / 2, 0, math.pi / 2), (8, 15))
net_panel((37.66, -0.6, 1.22), (1.2, 2.44), (math.pi / 2, 0, math.pi / 2), (8, 15))

# The white arena (Blue Lock's training room): panelled walls.
wallm = bpy.data.materials.new("wall"); wallm.use_nodes = True
nt = wallm.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
out = nt.nodes.new("ShaderNodeOutputMaterial")
br = nt.nodes.new("ShaderNodeTexBrick")
br.inputs["Color1"].default_value = (0.86, 0.88, 0.91, 1)
br.inputs["Color2"].default_value = (0.92, 0.93, 0.95, 1)
br.inputs["Mortar"].default_value = (0.55, 0.58, 0.64, 1)
br.inputs["Scale"].default_value = 0.25
br.inputs["Mortar Size"].default_value = 0.025
br.inputs["Brick Width"].default_value = 1.0
br.inputs["Row Height"].default_value = 0.6
br.offset = 0
tcw = nt.nodes.new("ShaderNodeTexCoord")
nt.links.new(tcw.outputs["Object"], br.inputs["Vector"])
emw = nt.nodes.new("ShaderNodeEmission")
nt.links.new(br.outputs["Color"], emw.inputs[0])
nt.links.new(emw.outputs[0], out.inputs[0])
lightm, _, _ = flat_mat("lamp", (1, 1, 1))
WALLS = []
for loc, rot, size in (((34, -14, 9), (math.pi / 2, 0, 0), (90, 18)),
                       ((-8, 30, 9), (math.pi / 2, 0, math.pi / 2), (90, 18)),
                       ((76, 30, 9), (math.pi / 2, 0, math.pi / 2), (90, 18)),
                       ((34, 72, 9), (math.pi / 2, 0, 0), (90, 18))):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = (*size, 1)
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(wallm)
    WALLS.append(o)
for x in range(-2, 72, 12):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, -13.6, 15))
    o = bpy.context.object
    o.scale = (5, 0.3, 0.6)
    o.data.materials.append(lightm)
    WALLS.append(o)
for y in range(0, 70, 12):
    for x in (-7.6, 75.6):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 15))
        o = bpy.context.object
        o.scale = (0.3, 5, 0.6)
        o.data.materials.append(lightm)
        WALLS.append(o)

world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.94, 0.95, 0.97, 1)
sc.world = world
camd = bpy.data.cameras.new("cam")
CAM = bpy.data.objects.new("cam", camd)
sc.collection.objects.link(CAM)
sc.camera = CAM
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = 6
sc.cycles.use_denoising = False
sc.cycles.max_bounces = 0
sc.cycles.transparent_max_bounces = 12
sc.render.resolution_x = 960
sc.render.resolution_y = 540
sc.view_settings.view_transform = "Standard"
camd.clip_start = 0.05
camd.clip_end = 400

# ── Posing ────────────────────────────────────────────────────────────────
def facing_rot(d):
    return math.atan2(d.x, -d.y)


def char_axes(arm):
    R = arm.matrix_world.to_3x3().normalized()
    return R @ Vector((0, -1, 0)), R @ Vector((1, 0, 0))  # fwd, left


KICK_KEYS = [(-1.0, -0.05, 0.02), (-0.45, -0.5, 0.42), (0.0, 0.24, 0.20), (0.5, 0.55, 0.62), (1.0, 0.38, 0.36)]


def kick_curve(u):
    for a, b in zip(KICK_KEYS, KICK_KEYS[1:]):
        if u <= b[0]:
            k = smooth((u - a[0]) / (b[0] - a[0]))
            return lerp(a[1], b[1], k), lerp(a[2], b[2], k)
    return KICK_KEYS[-1][1], KICK_KEYS[-1][2]


def pose_man(i, t):
    man = MEN[i]
    arm = man["arm"]
    b = BODIES[i]
    pos = body_at(t, i)
    vel = (body_at(t + 0.05, i) - body_at(t - 0.05, i)) / 0.1
    vel.z = 0
    speed = vel.length
    ball = ball_at(t)
    kick = None
    for (ki, kt) in KICKS:
        if ki == i and kt - 0.36 <= t <= kt + 0.4:
            kick = kt
    # facing
    if kick is not None:
        d = kick_dir(kick)
    elif b["role"] == "keeper":
        d = Vector((0, 1, 0))
    elif speed > 0.6:
        d = vel.normalized()
    else:
        d = ball - pos
        d.z = 0
        d = d.normalized() if d.length > 1e-3 else Vector((0, -1, 0))
    rot = facing_rot(d)
    clear(arm)
    arm.location = (pos.x, pos.y, 0)
    arm.rotation_euler = (0, 0, rot)
    upd()
    fwd, left = char_axes(arm)
    right = -left
    # run phase from distance covered
    if man["last"] is not None:
        man["phase"] += (pos - man["last"]).length / 2.4 * 2 * math.pi
    man["last"] = pos.copy()
    ph = man["phase"]
    a = min(1.0, speed / 6.0)

    if b["role"] == "keeper":
        kp = keeper_at(t)
        dive, lunge = kp["dive"], kp["lunge"]
        side = 1 if dive >= 0 else -1
        k = min(1.0, abs(dive) / 2.0)
        arm.location = (pos.x + dive * 0.35, pos.y, 0.5 * k)
        # +x is to his right as he faces +y (towards play): roll that way
        arm.rotation_euler = (0, -side * math.radians(80) * k, rot)
        upd()
        fwd, left = char_axes(arm)
        hips = wpos(arm, "Hips")
        for s, sd in (("Left", 1), ("Right", -1)):
            two_bone(arm, s + "UpLeg", s + "Leg", s + "Foot", hips + left * sd * 0.22 - UP * (HIP_Z - ANKLE_Z) * 0.92 + fwd * 0.05,
                     fwd, L_UP, L_LO)
            sh = wpos(arm, s + "Arm")
            reach = left * sd * 0.35 + UP * (0.25 + 0.5 * k) + fwd * 0.3
            two_bone(arm, s + "Arm", s + "ForeArm", s + "Hand", sh + reach.normalized() * (A_UP + A_LO) * 0.9,
                     -UP + left * sd, A_UP, A_LO)
        return

    hips = wpos(arm, "Hips")
    ground = Vector((hips.x, hips.y, 0))
    if kick is not None:
        u = max(-1.0, min(1.0, (t - kick) / (0.32 if t < kick else 0.38)))
        f_, z_ = kick_curve(u)
        # shift the body so the kicking foot meets the ball at contact
        target = ball_at(kick)
        foot_at = Vector((ground.x, ground.y, 0)) + fwd * 0.24 + right * 0.12
        off = Vector((target.x - foot_at.x, target.y - foot_at.y, 0)) * smooth(1 - abs(u))
        arm.location = (pos.x + off.x, pos.y + off.y, -0.07 * smooth(1 - abs(u)))
        upd()
        hips = wpos(arm, "Hips")
        ground = Vector((hips.x, hips.y, 0))
        for n, ang in (("Spine02", -10), ("Spine01", -8)):
            turn(arm, n, left, math.radians(ang) * max(0, u))
        rf = ground + fwd * f_ + right * 0.12 + UP * (ANKLE_Z + z_)
        two_bone(arm, "RightUpLeg", "RightLeg", "RightFoot", rf, fwd, L_UP, L_LO)
        lf = ground + fwd * 0.02 + left * 0.17 + UP * ANKLE_Z
        two_bone(arm, "LeftUpLeg", "LeftLeg", "LeftFoot", lf, fwd, L_UP, L_LO)
        spread = smooth((u + 1) / 1.2)
        for s, sd, out in (("Left", 1, (0.75, 0.25, 0.35)), ("Right", -1, (0.65, -0.3, 0.05))):
            sh = wpos(arm, s + "Arm")
            hang = sh - UP * (A_UP + A_LO) * 0.95
            wide = sh + (left * sd * out[0] + fwd * out[1] + UP * out[2]).normalized() * (A_UP + A_LO) * 0.95
            two_bone(arm, s + "Arm", s + "ForeArm", s + "Hand", hang.lerp(wide, spread), -fwd, A_UP, A_LO)
        Rf = arm.matrix_world.to_3x3().normalized()
        set_wrot(arm, "RightFoot", Quaternion(left, -math.radians(35) * smooth(1 - abs(u))).to_matrix() @ (Rf @ REST["RightFoot"]))
        set_wrot(arm, "LeftFoot", Rf @ REST["LeftFoot"])
        return

    # run / stand
    arm.location = (pos.x, pos.y, -0.025 * a * abs(math.sin(ph)))
    upd()
    hips = wpos(arm, "Hips")
    ground = Vector((hips.x, hips.y, 0))
    for n in ("Spine02", "Spine01"):
        turn(arm, n, left, -math.radians(6) * a)
    for s, sd, p in (("Left", 1, ph), ("Right", -1, ph + math.pi)):
        ft = ground + left * sd * 0.13 + fwd * (0.42 * a * math.sin(p)) + UP * (ANKLE_Z + 0.28 * a * max(0.0, -math.cos(p)))
        two_bone(arm, s + "UpLeg", s + "Leg", s + "Foot", ft, fwd, L_UP, L_LO)
        sh = wpos(arm, s + "Arm")
        hand = sh - UP * (0.42 - 0.08 * a) + fwd * (0.06 - 0.3 * a * math.sin(p)) + left * sd * 0.1
        two_bone(arm, s + "Arm", s + "ForeArm", s + "Hand", hand, -fwd + left * sd * 0.3, A_UP, A_LO)
    Rf = arm.matrix_world.to_3x3().normalized()
    for s in ("Left", "Right"):
        set_wrot(arm, s + "Foot", Rf @ REST[s + "Foot"])


# ── Shots ────────────────────────────────────────────────────────────────
TC = T_CONTACT
SC = SCORER
GOAL_T = D["goalT"]
pass_t = min((kt for ki, kt in KICKS if kt < TC - 0.1), default=TC - 0.4)


def look(loc, target, lens, roll=0.0):
    CAM.location = loc
    d = target - loc
    q = d.to_track_quat("-Z", "Y")
    q = q @ Quaternion((0, 0, 1), math.radians(roll))
    CAM.rotation_mode = "QUATERNION"
    CAM.rotation_quaternion = q
    CAM.data.lens = lens


def scorer_axes():
    d = kick_dir(TC)
    return d, Vector((-d.y, d.x, 0))  # fwd, his left


def shot_wide(t, k):
    b = ball_at(t)
    p = body_at(t, SC)
    tgt = Vector((lerp(b.x, 34, 0.35), lerp(b.y, p.y, 0.5) - 2, 0.9))
    look(Vector((b.x + 1.5, b.y + 8.5 - 2.0 * k, 1.1)), tgt, 22)


def shot_hero(t, k):
    f, l = scorer_axes()
    p = body_at(TC, SC)
    loc = p + f * (3.0 - 0.6 * k) - l * 1.4 + UP * 0.28
    look(loc, p + UP * 1.0 - l * 0.2, 18, roll=-7)


def shot_impact(t, k):
    f, l = scorer_axes()
    b = P_CONTACT
    loc = b - l * 1.7 + f * 0.6 + UP * 0.1
    look(loc, b + UP * 0.3 - f * 0.15, 28, roll=4)


def shot_follow(t, k):
    f, l = scorer_axes()
    p = body_at(TC, SC)
    loc = p - l * 7.5 + f * 1.5 + UP * 0.45
    look(loc, p + f * 1.2 + UP * 0.7, 26, roll=-14)


def shot_net(t, k):
    gb = ball_at(GOAL_T)
    loc = Vector((gb.x - 0.4, -2.3, 1.05))
    look(loc, ball_at(t) * 0.6 + Vector((gb.x, 8, 0.9)) * 0.4, 24)


def shot_top(t, k):
    look(Vector((35.5, 17 - 3 * k, 17)), Vector((35.5, 6 - 1.5 * k, 0)), 26)


# (name, t0, t1, seconds on screen, camera fn, white-out)
SHOTS = [
    ("wide", max(0.0, pass_t - 0.5), TC - 0.32, None, shot_wide, False),
    ("hero", TC - 0.32, TC - 0.06, 1.3, shot_hero, False),
    ("impact", TC - 0.06, TC + 0.03, 1.0, shot_impact, True),
    ("follow", TC + 0.03, TC + 0.22, 0.9, shot_follow, True),
    ("net", TC + 0.18, GOAL_T + 0.12, 1.5, shot_net, False),
    ("top", max(0.0, pass_t - 0.3), GOAL_T + 0.5, None, shot_top, False),
]

plan = []
for name, t0, t1, secs, fn, wo in SHOTS:
    n = int(round((secs if secs else (t1 - t0)) * FPS_OUT))
    for j in range(n):
        k = j / max(1, n - 1)
        plan.append((name, lerp(t0, t1, k), k, fn, wo))
# hold the last top-down frame for the GOAL card
for j in range(int(1.2 * FPS_OUT)):
    plan.append(("card", plan[-1][1], 1.0, shot_top, False))

if TEST:
    want = {"wide": 0.5, "hero": 0.9, "impact": 0.5, "follow": 0.5, "net": 0.6, "top": 0.5}
    pick = []
    for nm, k0 in want.items():
        cand = [p for p in plan if p[0] == nm]
        pick.append(min(cand, key=lambda p: abs(p[2] - k0)))
    plan = pick

os.makedirs(os.path.join(OUT, "frames"), exist_ok=True)
meta = []
last_t = None
for idx, (name, t, k, fn, wo) in enumerate(plan):
    # posing: keep meshes out of the update while bones move
    for m in MEN:
        m["body"].hide_viewport = True
        if last_t is None or t < last_t - 1e-6 or (t - last_t) > 0.3:
            m["phase"], m["last"] = 0.0, None
    for i in range(NB):
        pose_man(i, t)
    last_t = t
    for m in MEN:
        m["body"].hide_viewport = False
    b = ball_at(t)
    BALL.location = b
    BALL.rotation_euler = (b.y * 3.0, b.x * 3.0, 0)
    for o in WALLS:
        o.hide_render = wo
    sc.render.film_transparent = wo
    fn(t, k)
    upd()
    sx = world_to_camera_view(sc, CAM, b)
    path = os.path.join(OUT, "frames", f"{idx:04d}.png")
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    meta.append({"i": idx, "shot": name, "t": round(t, 4), "k": round(k, 3), "whiteout": wo,
                 "ball": [round(sx.x, 4), round(sx.y, 4), round(sx.z, 3)], "contact": abs(t - TC) < 0.012})
    print(f"FRAME {idx+1}/{len(plan)} {name} t={t:.3f}", flush=True)

json.dump({"fps": FPS_OUT, "frames": meta, "scorer": D["meta"].get("scorerShort"), "tc": TC}, open(os.path.join(OUT, "frames.json"), "w"))
print("DONE", len(plan))
