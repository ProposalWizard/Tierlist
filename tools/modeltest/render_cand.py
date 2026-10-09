"""Model test (Harry, 9 Oct 2026): renders a fitted, generated footballer in look A
(cel shading: 3 tone bands, rim light, ink outline) on the golden-hour pitch and in
the shop, plus a run-pose frame. Scene, lights and toon shader are copied from
tools/styletest/render.py (look test, commit 7d0bef0). Not used by the game.

blender -b --python tools/modeltest/render_cand.py -- <anim.glb> <repo> <outdir> [shots] [head] [hands]
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix, Quaternion

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, REPO, OUT = argv[:3]
SHOTS = argv[3].split(",") if len(argv) > 3 else ["wide", "close", "shop", "run"]
HEADS = float(argv[4]) if len(argv) > 4 else 1.08
HANDS = float(argv[5]) if len(argv) > 5 else 1.1
OPT = "A"
H3D = REPO + "/public/star/h3d/"
os.makedirs(OUT, exist_ok=True)
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y = 540, 960

def srgb(h):
    h = h.lstrip("#"); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


def img(path, nonColor=False):
    im = bpy.data.images.load(path, check_existing=True)
    if nonColor: im.colorspace_settings.name = "Non-Color"
    return im


def coll(name):
    c = bpy.data.collections.new(name); sc.collection.children.link(c); return c




# ───────────────────────── the player (a fitted generated model) ─────────────────────────
bpy.ops.import_scene.gltf(filepath=SRC)
arm = [o for o in bpy.data.objects if o.type == "ARMATURE"][0]
for pb in arm.pose.bones: pb.custom_shape = None
pl = [o for o in bpy.data.objects if o.type == "MESH" and o.parent == arm]
for o in list(bpy.data.objects):
    if o.type == "MESH" and o not in pl: bpy.data.objects.remove(o)
player = {"body": pl[0]}
print("TRIS", sum(len(p.vertices) - 2 for o in pl for p in o.data.polygons))
for p in pl[0].data.polygons: p.use_smooth = True
# The fit keeps MakeHuman's leg length; scale the whole rig (root node, so the clips'
# hip moves scale too) to the game's player height.
_top = max((pl[0].matrix_world @ v.co).z for v in pl[0].data.vertices)
FIT_SCALE = 1.83 / _top
arm.scale = arm.scale * FIT_SCALE
print("HEIGHT", round(_top, 3), "-> 1.83, root scale x", round(FIT_SCALE, 3))
ACTS = {a.name.split("_Armature")[0]: a for a in bpy.data.actions}
arm.animation_data_create()
for t in list(arm.animation_data.nla_tracks): arm.animation_data.nla_tracks.remove(t)


def set_pose(act, frame):
    arm.animation_data.action = ACTS[act]
    sc.frame_set(int(frame))
    # proportions, as in look A (bone scales only, clips still fit)
    for b, s in (("Head", HEADS), ("LeftHand", HANDS), ("RightHand", HANDS)):
        pb = arm.pose.bones.get(b)
        if pb: pb.scale = (s, s, s)
    bpy.context.view_layer.update()


def body_tex(o):
    for m in o.data.materials:
        if m and m.use_nodes:
            for nd in m.node_tree.nodes:
                if nd.type == "TEX_IMAGE": return nd.image
    return None

# ───────────────────────── node helpers ─────────────────────────


class NB:
    def __init__(self, mat):
        mat.use_nodes = True
        self.t = mat.node_tree; self.t.nodes.clear(); self.x = 0

    def n(self, kind, **kw):
        nd = self.t.nodes.new(kind); nd.location = (self.x, 0); self.x += 30
        for k, v in kw.items():
            if k.startswith("i_"):
                key = k[2:]
                key = int(key) if key.isdigit() else key.replace("_", " ")
                nd.inputs[key].default_value = v
            else: setattr(nd, k, v)
        return nd

    def L(self, a, b): self.t.links.new(a, b)

    def math(self, op, a, b=None, clamp=False):
        m = self.n("ShaderNodeMath", operation=op, use_clamp=clamp)
        for i, v in enumerate((a, b)):
            if v is None: continue
            if isinstance(v, (int, float)): m.inputs[i].default_value = v
            else: self.L(v, m.inputs[i])
        return m.outputs[0]

    def mix(self, fac, a, b, blend="MIX"):
        m = self.n("ShaderNodeMix", data_type="RGBA", blend_type=blend)
        for sock, v in ((m.inputs[0], fac), (m.inputs[6], a), (m.inputs[7], b)):
            if isinstance(v, (int, float)): sock.default_value = v
            elif isinstance(v, tuple): sock.default_value = v
            else: self.L(v, sock)
        return m.outputs[2]

    def rest(self):
        a = self.n("ShaderNodeAttribute", attribute_name="rest", attribute_type="GEOMETRY")
        s = self.n("ShaderNodeSeparateXYZ"); self.L(a.outputs["Vector"], s.inputs[0])
        return s.outputs[0], s.outputs[1], s.outputs[2], a.outputs["Vector"]

    def band(self, v, lo, hi):  # 1 inside [lo, hi]
        return self.math("MULTIPLY", self.math("GREATER_THAN", v, lo), self.math("LESS_THAN", v, hi))

    def decal(self, image, x, z, cx, cz, w, h):
        u = self.math("DIVIDE", self.math("SUBTRACT", x, cx - w / 2), w)
        v = self.math("DIVIDE", self.math("SUBTRACT", z, cz - h / 2), h)
        cmb = self.n("ShaderNodeCombineXYZ"); self.L(u, cmb.inputs[0]); self.L(v, cmb.inputs[1])
        t = self.n("ShaderNodeTexImage", image=image, extension="CLIP", interpolation="Cubic")
        self.L(cmb.outputs[0], t.inputs[0])
        return t.outputs["Color"], t.outputs["Alpha"]


def toon(nb, base, normal=None, bands=3, halftone=False, alpha=None):
    d = nb.n("ShaderNodeBsdfDiffuse")
    if normal is not None: nb.L(normal, d.inputs["Normal"])
    s2r = nb.n("ShaderNodeShaderToRGB"); nb.L(d.outputs[0], s2r.inputs[0])
    bw = nb.n("ShaderNodeRGBToBW"); nb.L(s2r.outputs[0], bw.inputs[0])
    ramp = nb.n("ShaderNodeValToRGB"); nb.L(bw.outputs[0], ramp.inputs[0])
    cr = ramp.color_ramp; cr.interpolation = "CONSTANT"
    if bands == 3:
        cr.elements[0].position = 0.0; cr.elements[0].color = (0.32, 0.30, 0.44, 1)
        cr.elements[1].position = 0.22; cr.elements[1].color = (0.78, 0.66, 0.56, 1)
        e = cr.elements.new(0.6); e.color = (1.12, 0.98, 0.80, 1)
    else:
        cr.elements[0].position = 0.0; cr.elements[0].color = (0.36, 0.22, 0.52, 1)
        cr.elements[1].position = 0.3; cr.elements[1].color = (1.15, 1.0, 0.82, 1)
    c = nb.mix(1.0, base, ramp.outputs[0], "MULTIPLY")
    if halftone:
        # screen-space dots in the half-lit zone (a 45° grid, ~7 px cells)
        tc = nb.n("ShaderNodeTexCoord")
        sx = nb.n("ShaderNodeSeparateXYZ"); nb.L(tc.outputs["Window"], sx.inputs[0])
        N = 150.0; asp = sc.render.resolution_x / sc.render.resolution_y
        u = nb.math("MULTIPLY", sx.outputs[0], N * asp); v = nb.math("MULTIPLY", sx.outputs[1], N)
        ru = nb.math("MULTIPLY", nb.math("ADD", u, v), 0.7071); rv = nb.math("MULTIPLY", nb.math("SUBTRACT", u, v), 0.7071)
        fu = nb.math("SUBTRACT", nb.math("FRACT", ru), 0.5); fv = nb.math("SUBTRACT", nb.math("FRACT", rv), 0.5)
        dd = nb.math("SQRT", nb.math("ADD", nb.math("MULTIPLY", fu, fu), nb.math("MULTIPLY", fv, fv)))
        # dot radius grows as light falls: lum 0.3 -> 0, lum 0.05 -> 0.5
        rad = nb.math("MULTIPLY", nb.math("SUBTRACT", 0.62, nb.math("MULTIPLY", bw.outputs[0], 1.9)), 1.0, clamp=True)
        dot = nb.math("LESS_THAN", dd, rad)
        zone = nb.math("LESS_THAN", bw.outputs[0], 0.42)
        dark = nb.mix(1.0, base, (0.16, 0.08, 0.30, 1), "MULTIPLY")
        c = nb.mix(nb.math("MULTIPLY", dot, zone), c, dark)
    # rim light on the lit edge
    lw = nb.n("ShaderNodeLayerWeight", i_Blend=0.35)
    if normal is not None: nb.L(normal, lw.inputs["Normal"])
    rim = nb.math("MULTIPLY", nb.math("GREATER_THAN", lw.outputs["Facing"], 0.72), nb.math("GREATER_THAN", bw.outputs[0], 0.25))
    c = nb.mix(nb.math("MULTIPLY", rim, 0.35), c, (1.0, 0.75, 0.45, 1), "ADD")
    em = nb.n("ShaderNodeEmission"); nb.L(c, em.inputs[0])
    out = em.outputs[0]
    if alpha is not None:
        tr = nb.n("ShaderNodeBsdfTransparent"); ms = nb.n("ShaderNodeMixShader")
        nb.L(alpha, ms.inputs[0]); nb.L(tr.outputs[0], ms.inputs[1]); nb.L(out, ms.inputs[2]); out = ms.outputs[0]
    o = nb.n("ShaderNodeOutputMaterial"); nb.L(out, o.inputs[0])




def build_materials():
    o = player["body"]
    tex = body_tex(o)
    m = bpy.data.materials.new("A_body"); nb = NB(m)
    t = nb.n("ShaderNodeTexImage", image=tex)
    hs = nb.n("ShaderNodeHueSaturation", i_Saturation=1.12, i_Value=1.05); nb.L(t.outputs[0], hs.inputs["Color"])
    toon(nb, hs.outputs[0], bands=3)
    o.data.materials.clear(); o.data.materials.append(m)
    ink = bpy.data.materials.new("ink"); nb = NB(ink)
    em = nb.n("ShaderNodeEmission"); em.inputs[0].default_value = (0.012, 0.01, 0.02, 1)
    o2 = nb.n("ShaderNodeOutputMaterial"); nb.L(em.outputs[0], o2.inputs[0])
    ink.use_backface_culling = True
    o.data.materials.append(ink)
    sm = o.modifiers.new("ink", "SOLIDIFY")
    sm.thickness = 0.007 / o.matrix_world.to_scale().x; sm.offset = 1.0; sm.use_flip_normals = True
    sm.material_offset = 1; sm.use_rim = False


build_materials()

# ───────────────────────── the golden-hour pitch ─────────────────────────
pitch_c = coll("pitch")


def add_obj(name, mesh, c, mat=None):
    o = bpy.data.objects.new(name, mesh); c.objects.link(o)
    if mat: o.data.materials.append(mat)
    return o


def plane(name, w, h, c, mat, loc=(0, 0, 0), rot=(0, 0, 0)):
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    for v in bm.verts: v.co.x *= w; v.co.y *= h
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    uv = me.uv_layers.new()
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (co.x / w + 0.5, co.y / h + 0.5)
    o = add_obj(name, me, c, mat); o.location = loc; o.rotation_euler = rot
    return o


def mat_pbr(name, col=None, tex=None, nrm=None, rep=(1, 1), rough=0.8, emit=None, mapping="UV"):
    m = bpy.data.materials.new(name); nb = NB(m)
    tc = nb.n("ShaderNodeTexCoord"); mp = nb.n("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (rep[0], rep[1], 1)
    nb.L(tc.outputs[mapping], mp.inputs[0])
    b = nb.n("ShaderNodeBsdfPrincipled", i_Roughness=rough)
    if tex:
        t = nb.n("ShaderNodeTexImage", image=img(tex)); nb.L(mp.outputs[0], t.inputs[0])
        if col: nb.L(nb.mix(1.0, t.outputs[0], col, "MULTIPLY"), b.inputs["Base Color"])
        else: nb.L(t.outputs[0], b.inputs["Base Color"])
    elif col: b.inputs["Base Color"].default_value = col
    if nrm:
        t2 = nb.n("ShaderNodeTexImage", image=img(nrm, True)); nb.L(mp.outputs[0], t2.inputs[0])
        nm = nb.n("ShaderNodeNormalMap", i_Strength=0.8); nb.L(t2.outputs[0], nm.inputs["Color"]); nb.L(nm.outputs[0], b.inputs["Normal"])
    out = b.outputs[0]
    if emit is not None:
        b.inputs["Emission Strength"].default_value = emit
        if tex: nb.L(t.outputs[0], b.inputs["Emission Color"])
        elif col: b.inputs["Emission Color"].default_value = col
    o = nb.n("ShaderNodeOutputMaterial"); nb.L(out, o.inputs[0])
    return m


# grass: the game's own grass maps, 18 mown stripes in the golden-hour shades
gm = bpy.data.materials.new("grass"); nb = NB(gm)
tc = nb.n("ShaderNodeTexCoord"); gs = nb.n("ShaderNodeSeparateXYZ"); nb.L(tc.outputs["Object"], gs.inputs[0])
mp = nb.n("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (0.33, 0.33, 1); nb.L(tc.outputs["Object"], mp.inputs[0])
gt = nb.n("ShaderNodeTexImage", image=img(H3D + "grass-col.webp")); nb.L(mp.outputs[0], gt.inputs[0])
gn = nb.n("ShaderNodeTexImage", image=img(H3D + "grass-nrm.webp", True)); nb.L(mp.outputs[0], gn.inputs[0])
band = nb.math("MODULO", nb.math("FLOOR", nb.math("DIVIDE", nb.math("ADD", gs.outputs[1], 52.5), 105 / 18)), 2.0)
stripe = nb.mix(band, srgb("#33602a"), srgb("#4a7a36"))
gcol = nb.mix(1.0, stripe, nb.mix(0.6, (1, 1, 1, 1), gt.outputs[0]), "MULTIPLY")
gcol = nb.mix(1.0, gcol, (2.2, 2.2, 2.2, 1), "MULTIPLY")
# pitch lines (white paint), drawn by distance
ax_ = nb.math("ABSOLUTE", gs.outputs[0]); ay_ = nb.math("ABSOLUTE", gs.outputs[1])


def lineband(v, at, w=0.06):
    return nb.math("LESS_THAN", nb.math("ABSOLUTE", nb.math("SUBTRACT", v, at)), w)


rr = nb.math("SQRT", nb.math("ADD", nb.math("MULTIPLY", gs.outputs[0], gs.outputs[0]), nb.math("MULTIPLY", gs.outputs[1], gs.outputs[1])))
L1 = lineband(gs.outputs[1], 0.0)                               # halfway
L2 = lineband(rr, 9.15)                                           # centre circle
L3 = nb.math("MULTIPLY", lineband(ax_, 34.0), nb.math("LESS_THAN", ay_, 52.56))
L4 = nb.math("MULTIPLY", lineband(ay_, 52.5), nb.math("LESS_THAN", ax_, 34.06))
L5 = nb.math("MULTIPLY", lineband(ay_, 36.0), nb.math("LESS_THAN", ax_, 20.16))
L6 = nb.math("MULTIPLY", lineband(ax_, 20.16), nb.math("GREATER_THAN", ay_, 36.0))
lines = nb.math("MINIMUM", 1.0, nb.math("ADD", nb.math("ADD", nb.math("ADD", L1, L2), nb.math("ADD", L3, L4)), nb.math("ADD", L5, L6)))
lines = nb.math("MULTIPLY", lines, nb.math("LESS_THAN", rr, 9.25) if False else 1.0)
gcol = nb.mix(nb.math("MULTIPLY", lines, 0.9), gcol, (0.85, 0.85, 0.8, 1))
gb = nb.n("ShaderNodeBsdfPrincipled", i_Roughness=0.85); nb.L(gcol, gb.inputs["Base Color"])
gnm = nb.n("ShaderNodeNormalMap", i_Strength=0.7); nb.L(gn.outputs[0], gnm.inputs["Color"]); nb.L(gnm.outputs[0], gb.inputs["Normal"])
o = nb.n("ShaderNodeOutputMaterial"); nb.L(gb.outputs[0], o.inputs[0])
plane("grass", 160, 220, pitch_c, gm)

# stands: crowd in tiers on all four sides, a roof edge, LED boards
crowd = mat_pbr("crowd", tex=H3D + "crowd.webp", rep=(20, 4), rough=0.9)
led = mat_pbr("led", tex=H3D + "led.webp", rep=(6, 1), emit=2.0, rough=0.4)
roof = mat_pbr("roof", col=srgb("#3a3d44"), rough=0.6)
for side, (cx, cy, rz, length) in enumerate([(46, 0, math.pi / 2, 130), (-46, 0, -math.pi / 2, 130), (0, 64, math.pi, 100), (0, -64, 0, 100)]):
    d = Vector((math.cos(rz - math.pi / 2), math.sin(rz - math.pi / 2), 0))
    plane(f"stand{side}", length, 20, pitch_c, crowd, loc=(cx - d.x * 2, cy - d.y * 2, 5.5), rot=(math.radians(68), 0, rz))
    plane(f"roof{side}", length, 14, pitch_c, roof, loc=(cx + d.x * 6, cy + d.y * 6, 15.5), rot=(math.radians(-12), 0, rz))
    plane(f"led{side}", length * 0.85, 0.9, pitch_c, led, loc=(cx * 0.83 + (d.x * 0 if True else 0), cy * 0.86, 0.45), rot=(math.radians(90), 0, rz))
# a goal at the far end
post = mat_pbr("post", col=srgb("#f2f2f2"), rough=0.3)
for gx, gz, l, axis in ((-3.66, 1.22, 2.44, "Z"), (3.66, 1.22, 2.44, "Z"), (0, 2.44, 7.32, "X")):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=l, location=(gx, -52.5, gz), rotation=(0, math.pi / 2, 0) if axis == "X" else (0, 0, 0))
    g = bpy.context.object; g.data.materials.append(post)
    for c in g.users_collection: c.objects.unlink(g)
    pitch_c.objects.link(g)
# a ball at his feet
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.11, location=(0.18, -0.35, 0.11), segments=24, ring_count=12)
ball = bpy.context.object; ball.data.materials.append(mat_pbr("ball", col=srgb("#f4f4f4"), rough=0.35))
bpy.ops.object.shade_smooth()
for c in ball.users_collection: c.objects.unlink(ball)
pitch_c.objects.link(ball)

# world: the game's golden HDR for light, its golden sky picture behind
w = bpy.data.worlds.new("golden"); sc.world = w; nb = NB(w)
tc = nb.n("ShaderNodeTexCoord")
env = nb.n("ShaderNodeTexEnvironment", image=img(H3D + "env-golden.hdr"))
sky = nb.n("ShaderNodeTexEnvironment", image=img(H3D + "sky-golden.webp"))
bg1 = nb.n("ShaderNodeBackground", i_Strength=0.5); nb.L(env.outputs[0], bg1.inputs[0])
bg2 = nb.n("ShaderNodeBackground", i_Strength=1.35); nb.L(sky.outputs[0], bg2.inputs[0])
lp = nb.n("ShaderNodeLightPath"); ms = nb.n("ShaderNodeMixShader")
nb.L(lp.outputs["Is Camera Ray"], ms.inputs[0]); nb.L(bg1.outputs[0], ms.inputs[1]); nb.L(bg2.outputs[0], ms.inputs[2])
wo = nb.n("ShaderNodeOutputWorld"); nb.L(ms.outputs[0], wo.inputs[0])
WORLD_BG = (bg1, bg2)

sun_d = bpy.data.lights.new("sun", "SUN"); sun_d.energy = 6.5; sun_d.color = srgb("#ffb36e")[:3]; sun_d.angle = math.radians(1.5)
sun = bpy.data.objects.new("sun", sun_d); pitch_c.objects.link(sun)
TO_SUN = Vector((-0.74, 0.58, 0.34)).normalized()
sun.rotation_euler = (-TO_SUN).to_track_quat("-Z", "Y").to_euler()

# ───────────────────────── the shop ─────────────────────────
shop_c = coll("shop")
SX = 500.0
RX, RZ, RH = 5.0, 6.0, 3.3
floor = mat_pbr("parquet", col=srgb("#b48a66"), tex=REPO + "/public/star/shop3d/h/parquet.webp", nrm=REPO + "/public/star/shop3d/h/parquet-nrm.webp", rep=(RX * 2 / 2.2, RZ * 2 / 2.2), rough=0.36)
panel = mat_pbr("planks", col=srgb("#a77e5c"), tex=REPO + "/public/star/shop3d/h/planks.webp", nrm=REPO + "/public/star/shop3d/h/planks-nrm.webp", rep=(4, 1), rough=0.5)
plaster = mat_pbr("plaster", col=srgb("#d8c3a2"), rough=0.9)
ceil = mat_pbr("ceil", col=srgb("#efe2cc"), rough=0.9)
dark = mat_pbr("dark", col=srgb("#2a2420"), rough=0.4)
white = mat_pbr("white", col=srgb("#efece6"), rough=0.35)
plane("floor", RX * 2, RZ * 2, shop_c, floor, loc=(SX, 0, 0))
plane("ceiling", RX * 2, RZ * 2, shop_c, ceil, loc=(SX, 0, RH), rot=(math.pi, 0, 0))
for i, (lx, ly, rz, ln) in enumerate([(SX, -RZ, 0, RX * 2), (SX, RZ, math.pi, RX * 2), (SX - RX, 0, -math.pi / 2, RZ * 2), (SX + RX, 0, math.pi / 2, RZ * 2)]):
    rot = (math.pi / 2, 0, rz)
    d = Vector((-math.sin(rz), math.cos(rz), 0)) * 0.01
    plane(f"panel{i}", ln, 1.15, shop_c, panel, loc=(lx + d.x, ly + d.y, 0.575), rot=rot)
    plane(f"wall{i}", ln, RH, shop_c, plaster, loc=(lx, ly, RH / 2), rot=rot)


def box(name, w, d, h, loc, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    b = bpy.context.object; b.scale = (w, d, h); b.name = name; b.data.materials.append(mat)
    for c in b.users_collection: c.objects.unlink(b)
    shop_c.objects.link(b); return b


# coffered ceiling beams
for i in range(-2, 3):
    box(f"beamx{i}", 0.18, RZ * 2, 0.22, (SX + i * 2.0, 0, RH - 0.11), white)
for j in range(-3, 4):
    box(f"beamy{j}", RX * 2, 0.18, 0.22, (SX, j * 1.7, RH - 0.11), white)
# counter at the back, a lit wall unit each side with boot boxes and balls
box("counter", 3.2, 0.7, 1.0, (SX, RZ - 1.6, 0.5), white)
box("ctop", 3.3, 0.8, 0.05, (SX, RZ - 1.6, 1.02), dark)
glowm = mat_pbr("glow", col=srgb("#ffd7a0"), emit=6.0)
cols = ["#d23a3a", "#1c46c8", "#f0c040", "#2bb673", "#ffffff", "#ff7a1a"]
for sx in (-1, 1):
    x = SX + sx * (RX - 0.35)
    box(f"unit{sx}", 0.6, 4.2, 2.4, (x, 0.5, 1.2), dark)
    for k in range(4):
        z = 0.45 + k * 0.55
        box(f"strip{sx}{k}", 0.05, 4.0, 0.02, (x - sx * 0.27, 0.5, z + 0.4), glowm)
        for j in range(5):
            box(f"bx{sx}{k}{j}", 0.32, 0.5, 0.22, (x - sx * 0.08, -1.1 + j * 0.8, z + 0.11), mat_pbr(f"bxm{k}{j}", col=srgb(cols[(k + j) % 6]), rough=0.5))
# sign (our own name)
bpy.ops.object.text_add(location=(SX, RZ - 0.02, 2.35), rotation=(math.pi / 2, 0, 0))
tx = bpy.context.object; tx.data.body = "KNOWITBALL STORE"; tx.data.align_x = "CENTER"; tx.data.size = 0.32; tx.data.extrude = 0.01
tx.data.materials.append(mat_pbr("signm", col=srgb("#fff3dc"), emit=3.0))
for c in tx.users_collection: c.objects.unlink(tx)
shop_c.objects.link(tx)
box("signbg", 3.6, 0.04, 0.6, (SX, RZ - 0.0, 2.45), dark)
# warm practical lights: pendants over the counter, a ceiling grid of warm points
for k in (-1, 0, 1):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.12, location=(SX + k * 1.1, RZ - 1.6, 2.1))
    p = bpy.context.object; p.data.materials.append(glowm)
    for c in p.users_collection: c.objects.unlink(p)
    shop_c.objects.link(p)
for (lx, ly, e) in [(-1.1, RZ - 1.6, 90), (0, RZ - 1.6, 90), (1.1, RZ - 1.6, 90), (-2.5, -2, 260), (2.5, -2, 260), (-2.5, 2, 200), (2.5, 2, 200), (0, -3.5, 300), (0, 0.5, 250)]:
    ld = bpy.data.lights.new("pl", "POINT"); ld.energy = e; ld.color = (1.0, 0.78, 0.55); ld.shadow_soft_size = 0.3
    lo = bpy.data.objects.new("pl", ld); lo.location = (SX + lx, ly, RH - 0.35 if e > 100 else 1.95); shop_c.objects.link(lo)
ad = bpy.data.lights.new("fill", "AREA"); ad.energy = 220; ad.size = 3; ad.color = (1.0, 0.86, 0.7)
ao = bpy.data.objects.new("fill", ad); ao.location = (SX, -4.5, 2.4); ao.rotation_euler = (math.radians(70), 0, 0); shop_c.objects.link(ao)

# ───────────────────────── render setup ─────────────────────────
r = sc.render
r.engine = "BLENDER_EEVEE"
r.resolution_x, r.resolution_y = 540, 960
r.film_transparent = False
ee = sc.eevee
ee.taa_render_samples = 24
ee.use_gtao = True; ee.gtao_distance = 0.6
ee.use_bloom = True; ee.bloom_threshold = 1.3; ee.bloom_intensity = 0.04
ee.use_soft_shadows = True
ee.shadow_cascade_size = "2048"; ee.shadow_cube_size = "1024"
sun_d.shadow_cascade_max_distance = 40; sun_d.shadow_cascade_count = 4
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Punchy" if OPT in ("A", "B", "C") else "AgX - Medium High Contrast"
sc.view_settings.exposure = 0.0

# Spider-Verse colour offset: compositor, on the player only (object index mask)
if OPT == "B":
    sc.view_layers[0].use_pass_cryptomatte_object = True
    pass
    sc.use_nodes = True; ct = sc.node_tree; ct.nodes.clear()
    rl = ct.nodes.new("CompositorNodeRLayers"); co = ct.nodes.new("CompositorNodeComposite")
    idm = ct.nodes.new("CompositorNodeCryptomatteV2")
    idm.source = "RENDER"; idm.scene = sc
    try: idm.layer_name = "ViewLayer.CryptoObject"
    except Exception as e: print("CRYPTO layer", e)
    idm.matte_id = ",".join(o.name for o in player.values())
    dil = ct.nodes.new("CompositorNodeDilateErode"); dil.distance = 4; ct.links.new(idm.outputs["Matte"], dil.inputs[0])
    sep = ct.nodes.new("CompositorNodeSeparateColor"); ct.links.new(rl.outputs["Image"], sep.inputs[0])
    tr = ct.nodes.new("CompositorNodeTranslate"); tr.inputs[1].default_value = 3; tr.inputs[2].default_value = 1
    tb = ct.nodes.new("CompositorNodeTranslate"); tb.inputs[1].default_value = -3; tb.inputs[2].default_value = -1
    ct.links.new(sep.outputs[0], tr.inputs[0]); ct.links.new(sep.outputs[2], tb.inputs[0])
    cmb = ct.nodes.new("CompositorNodeCombineColor")
    ct.links.new(tr.outputs[0], cmb.inputs[0]); ct.links.new(sep.outputs[1], cmb.inputs[1]); ct.links.new(tb.outputs[0], cmb.inputs[2]); ct.links.new(sep.outputs[3], cmb.inputs[3])
    mx = ct.nodes.new("CompositorNodeMixRGB"); ct.links.new(dil.outputs[0], mx.inputs[0])
    ct.links.new(rl.outputs["Image"], mx.inputs[1]); ct.links.new(cmb.outputs[0], mx.inputs[2])
    ct.links.new(mx.outputs[0], co.inputs[0])

cam_d = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam_d.sensor_fit = "VERTICAL"


def look_at(pos, target, fov_v):
    cam.location = pos
    cam.rotation_euler = (Vector(target) - Vector(pos)).to_track_quat("-Z", "Y").to_euler()
    cam_d.angle = math.radians(fov_v)


def place_player(x, y, yaw_deg):
    arm.rotation_mode = "XYZ"; arm.location = (x, y, 0); arm.rotation_euler = (0, 0, math.radians(yaw_deg))


def shot(name):
    in_shop = name == "shop"
    pitch_c.hide_render = in_shop; shop_c.hide_render = not in_shop
    sun.hide_render = in_shop
    WORLD_BG[0].inputs[1].default_value = 0.08 if in_shop else 0.5
    WORLD_BG[1].inputs[1].default_value = 0.0 if in_shop else 1.35
    if name == "wide":
        # the in-game chase camera: 6.2 m back, 2.7 m up, 56° tall
        place_player(-6.0, 4.0, 0.0)
        look_at((-6.0, 4.0 + 6.2, 2.7), (-6.0, 4.0 - 10.0, 0.9), 56)
    elif name == "close":
        sxy = Vector((TO_SUN.x, TO_SUN.y)).normalized()
        cdir = Matrix.Rotation(math.radians(-55), 2) @ sxy
        face = (sxy + cdir).normalized()
        yaw = math.degrees(math.atan2(face.x, -face.y))  # he faces -Y at yaw 0
        place_player(-6.0, 4.0, yaw)
        p = Vector((-6.0 + cdir.x * 2.3, 4.0 + cdir.y * 2.3, 1.45))
        look_at(p, (-6.0, 4.0, 1.32), 34)
    else:
        place_player(SX + 0.3, 0.0, -20.0)
        look_at((SX - 1.0, -3.8, 1.25), (SX + 0.2, 0.0, 0.95), 46)
    bpy.context.view_layer.update()
    r.filepath = f"{OUT}/{name}.png"
    bpy.ops.render.render(write_still=True)
    print("WROTE", r.filepath)




def shot2(name):
    if name == "run":
        pitch_c.hide_render = False; shop_c.hide_render = True; sun.hide_render = False
        WORLD_BG[0].inputs[1].default_value = 0.5; WORLD_BG[1].inputs[1].default_value = 1.35
        set_pose("run", 6)
        place_player(-6.0, 4.0, -35.0)
        look_at((-6.0 + 3.6, 4.0 - 2.4, 1.25), (-6.0, 4.0, 0.95), 42)
        bpy.context.view_layer.update()
        r.filepath = f"{OUT}/run.png"
        bpy.ops.render.render(write_still=True)
        print("WROTE", r.filepath)
    elif name == "face":
        pitch_c.hide_render = False; shop_c.hide_render = True; sun.hide_render = False
        WORLD_BG[0].inputs[1].default_value = 0.5; WORLD_BG[1].inputs[1].default_value = 1.35
        set_pose("idle", 20)
        yaw = -40.0
        place_player(-6.0, 4.0, yaw)   # turned towards the low sun
        bpy.context.view_layer.update()
        hd = arm.matrix_world @ arm.pose.bones["Head"].head
        fd = Matrix.Rotation(math.radians(yaw + 15), 3, "Z") @ Vector((0, -1, 0))
        look_at(hd + fd * 1.3 + Vector((0, 0, 0.08)), hd + Vector((0, 0, 0.07)), 24)
        bpy.context.view_layer.update()
        r.filepath = f"{OUT}/face.png"
        bpy.ops.render.render(write_still=True)
        print("WROTE", r.filepath)
    else:
        set_pose("idle", 20)
        shot(name)


for s in SHOTS: shot2(s)
