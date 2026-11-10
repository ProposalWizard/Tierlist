"""
tools/preview-film/scene.py — the preview film's dressing-room set, built by script.

    blender -b -P tools/preview-film/scene.py -- --screen <frames dir or one picture> \
        --out <dir> [--frames 1-96] [--w 720] [--h 1280] [--samples 48] [--still 48]

One small set (Mikey, 10 Nov 2026: a preview of the game, free to make): a
wooden bench under pegs, a phone leaning on a football, the real game on its
screen, evening floodlight through a slatted window. The camera pushes in
slowly. Everything is made here; no downloaded models. See README.md.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def val(flag, d):
    return argv[argv.index(flag) + 1] if flag in argv else d
SCREEN = val("--screen", "")
OUT = val("--out", "/tmp/preview-film")
W, H = int(val("--w", 720)), int(val("--h", 1280))
SAMPLES = int(val("--samples", 48))
F0, F1 = [int(x) for x in val("--frames", "1-96").split("-")]
STILL = val("--still", None)
FPS, LENGTH = 24, 96

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = False  # this Blender build has no denoiser: more samples + a light clean-up in ffmpeg instead
scene.cycles.max_bounces = 5
scene.cycles.use_adaptive_sampling = True
scene.cycles.adaptive_threshold = 0.03
scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 1, LENGTH
scene.view_settings.view_transform = "Standard"  # the game's own colours must survive on the screen
scene.render.threads_mode = "AUTO"
scene.render.use_persistent_data = True


# ---------- materials ----------
def mat(name, color, rough=0.5, metal=0.0, **kw):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    for k, v in kw.items():
        b.inputs[k].default_value = v
    return m

def wood(name, a, b_, scale=3.0):
    m = mat(name, a, rough=0.55)
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (scale * 0.5, scale * 10, scale * 10)  # grain runs along the bench
    noise = nt.nodes.new("ShaderNodeTexNoise"); noise.inputs["Scale"].default_value = 4; noise.inputs["Detail"].default_value = 8
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*a, 1); ramp.color_ramp.elements[1].color = (*b_, 1)
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.15
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], noise.inputs["Vector"])
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m

def brick(name):
    m = mat(name, (0.5, 0.5, 0.5), rough=0.8)
    nt = m.node_tree; bsdf = nt.nodes["Principled BSDF"]
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.inputs["Color1"].default_value = (0.055, 0.075, 0.11, 1)
    br.inputs["Color2"].default_value = (0.07, 0.09, 0.13, 1)
    br.inputs["Mortar"].default_value = (0.02, 0.025, 0.035, 1)
    br.inputs["Scale"].default_value = 3.2
    br.inputs["Mortar Size"].default_value = 0.012
    bump = nt.nodes.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.5
    nt.links.new(br.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(br.outputs["Fac"], bump.inputs["Height"]); bump.invert = True
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m

def add(obj_mat, obj=None):
    obj = obj or bpy.context.object
    obj.data.materials.append(obj_mat)
    return obj

def box(name, size, loc, material, bevel=0.004, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        md = o.modifiers.new("bevel", "BEVEL"); md.width = bevel; md.segments = 3
    bpy.ops.object.shade_smooth()
    o.data.use_auto_smooth = True; o.data.auto_smooth_angle = math.radians(40)
    return add(material, o)


M_BENCH = wood("bench", (0.09, 0.045, 0.02), (0.22, 0.12, 0.055))
M_WALL = brick("wall")
M_FLOOR = mat("floor", (0.03, 0.035, 0.04), rough=0.35)
M_METAL = mat("metal", (0.55, 0.55, 0.57), rough=0.3, metal=1.0)
M_BLACK = mat("phone body", (0.012, 0.012, 0.014), rough=0.28, metal=0.6)
M_WHITE = mat("ball white", (0.86, 0.86, 0.84), rough=0.42)
M_DARK = mat("ball dark", (0.03, 0.03, 0.035), rough=0.4)
M_SHIRT = mat("shirt", (0.55, 0.03, 0.04), rough=0.85)
M_SHIRT.node_tree.nodes["Principled BSDF"].inputs["Sheen Weight"].default_value = 0.6
M_GOLD = mat("gold", (1.0, 0.72, 0.25), rough=0.18, metal=1.0)
M_BOTTLE = mat("bottle", (0.02, 0.25, 0.12), rough=0.25)

# ---------- the room ----------
box("floor", (6, 6, 0.1), (0, 0, -0.05), M_FLOOR, bevel=0)
box("wall", (6, 0.1, 3), (0, 0.42, 1.5), M_WALL, bevel=0)
BENCH_Z = 0.46
for i in range(4):  # four slats
    box(f"slat{i}", (2.4, 0.085, 0.03), (0, -0.14 + i * 0.095, BENCH_Z - 0.015), M_BENCH, bevel=0.005)
for x in (-0.9, 0.9):
    box("leg", (0.04, 0.34, BENCH_Z - 0.03), (x, 0, (BENCH_Z - 0.03) / 2), M_METAL, bevel=0.003)
box("rail", (2.6, 0.02, 0.09), (0, 0.36, 1.32), M_BENCH, bevel=0.004)
for x in (-0.55, -0.15, 0.25, 0.65):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.008, depth=0.07, location=(x, 0.32, 1.32), rotation=(math.radians(75), 0, 0))
    add(M_METAL); bpy.ops.object.shade_smooth()

# ---------- the football: a smooth ball, dark five-sided panels painted on ----------
def football(loc, r=0.11):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
    corners = [v.co.normalized() for v in bm.verts if True][:]
    bm.free()
    # the 12 corners of the icosahedron are the 12 dark panels' centres
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=0, radius=1.0) if False else None
    bm2 = bmesh.new(); bmesh.ops.create_icosphere(bm2, subdivisions=1, radius=1.0)
    ico = sorted({tuple(round(c, 5) for c in v.co.normalized()) for v in bm2.verts}); bm2.free()
    import itertools
    # keep the 12 true corners (the ones with 5 neighbours at the icosahedron edge angle)
    vs = [Vector(c) for c in ico]
    def near(v): return [u for u in vs if 0.40 < v.dot(u) < 0.50]
    twelve = [v for v in vs if len(near(v)) == 5]
    edges_of = {}
    for v in twelve:
        ns = [(u - v * u.dot(v)).normalized() for u in near(v)]
        mids = [(p_ + q_).normalized() for p_, q_ in itertools.combinations(ns, 2) if p_.dot(q_) > 0.2]
        edges_of[tuple(v)] = mids
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=6, radius=1.0)
    me = bpy.data.meshes.new("football"); me.materials.append(M_WHITE); me.materials.append(M_DARK)
    APO = 0.275
    for f in bm.faces:
        c = f.calc_center_median().normalized()
        v = max(twelve, key=lambda t: t.dot(c))
        q = c - v * c.dot(v)
        f.material_index = 1 if all(q.dot(m_) <= APO for m_ in edges_of[tuple(v)]) else 0
        f.smooth = True
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("football", me); scene.collection.objects.link(o)
    o.scale = (r, r, r); o.location = loc
    return o

ball = football((0.05, 0.085, BENCH_Z + 0.11))
ball.rotation_euler = (0.5, 0.3, 1.1)

# ---------- the phone ----------
PW, PH, PT = 0.0715, 0.1467, 0.008  # a 6.1-inch phone, metres
phone = box("phone", (PW, PT, PH), (0, 0, 0), M_BLACK, bevel=0.0035)
phone.modifiers["bevel"].segments = 6
# rounder corners: bevel the four upright edges first
bpy.context.view_layer.objects.active = phone
bpy.ops.object.mode_set(mode="EDIT")
bm = bmesh.from_edit_mesh(phone.data)
up = [e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).normalized().y) > 0.9]
bmesh.ops.bevel(bm, geom=up, offset=0.0095, segments=10, affect="EDGES", profile=0.5)
bmesh.update_edit_mesh(phone.data)
bpy.ops.object.mode_set(mode="OBJECT")

# the screen: a rounded picture just proud of the front face
SW, SH = PW - 0.005, PH - 0.005
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -PT / 2 - 0.0002, 0), rotation=(math.radians(90), 0, 0))
screen = bpy.context.object; screen.name = "screen"; screen.scale = (SW, SH, 1)
bpy.ops.object.transform_apply(scale=True)
screen.parent = phone
sm = bpy.data.materials.new("screen"); sm.use_nodes = True
nt = sm.node_tree; nt.nodes.clear()
out = nt.nodes.new("ShaderNodeOutputMaterial")
mix = nt.nodes.new("ShaderNodeMixShader")
emi = nt.nodes.new("ShaderNodeEmission"); emi.inputs["Strength"].default_value = 1.15
gloss = nt.nodes.new("ShaderNodeBsdfGlossy"); gloss.inputs["Roughness"].default_value = 0.04
fres = nt.nodes.new("ShaderNodeFresnel"); fres.inputs["IOR"].default_value = 1.5
tex = nt.nodes.new("ShaderNodeTexImage")
uv = nt.nodes.new("ShaderNodeTexCoord")
# rounded corners: outside the rounded rectangle the screen is black glass
corner = nt.nodes.new("ShaderNodeMath"); corner.operation = "GREATER_THAN"
if SCREEN:
    if os.path.isdir(SCREEN):
        files = sorted(f for f in os.listdir(SCREEN) if f.lower().endswith((".png", ".jpg")))
        img = bpy.data.images.load(os.path.join(SCREEN, files[0]))
        img.source = "SEQUENCE"
        tex.image_user.frame_duration = len(files)
        tex.image_user.frame_start = 1
        tex.image_user.frame_offset = 0
        tex.image_user.use_auto_refresh = True
    else:
        img = bpy.data.images.load(SCREEN)
    tex.image = img
tex.extension = "EXTEND"
nt.links.new(uv.outputs["UV"], tex.inputs["Vector"])
# rounded mask from UV
sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(uv.outputs["UV"], sep.inputs["Vector"])
def n(op, a=None, b=None, va=None, vb=None):
    m_ = nt.nodes.new("ShaderNodeMath"); m_.operation = op
    if a is not None: nt.links.new(a, m_.inputs[0])
    elif va is not None: m_.inputs[0].default_value = va
    if b is not None: nt.links.new(b, m_.inputs[1])
    elif vb is not None: m_.inputs[1].default_value = vb
    return m_.outputs[0]
R = 0.0075
dx = n("SUBTRACT", n("ABSOLUTE", n("MULTIPLY", n("SUBTRACT", sep.outputs["X"], vb=0.5), vb=SW)), vb=SW / 2 - R)
dy = n("SUBTRACT", n("ABSOLUTE", n("MULTIPLY", n("SUBTRACT", sep.outputs["Y"], vb=0.5), vb=SH)), vb=SH / 2 - R)
dist = n("SQRT", n("ADD", n("POWER", n("MAXIMUM", dx, vb=0.0), vb=2.0), n("POWER", n("MAXIMUM", dy, vb=0.0), vb=2.0)))
inside = n("LESS_THAN", dist, vb=R)
col = nt.nodes.new("ShaderNodeMixRGB"); col.inputs["Color1"].default_value = (0, 0, 0, 1)
nt.links.new(inside, col.inputs["Fac"]); nt.links.new(tex.outputs["Color"], col.inputs["Color2"])
nt.links.new(col.outputs["Color"], emi.inputs["Color"])
nt.links.new(fres.outputs["Fac"], mix.inputs["Fac"])
nt.links.new(emi.outputs["Emission"], mix.inputs[1]); nt.links.new(gloss.outputs["BSDF"], mix.inputs[2])
nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
screen.data.materials.append(sm)

# lean the phone back against the ball, turned a little to the camera
LEAN = math.radians(20)
phone.rotation_euler = (-LEAN, 0, math.radians(-10))
phone.location = (-0.035, -0.045, BENCH_Z + PH / 2 * math.cos(LEAN) + 0.002)

# ---------- things out of focus ----------
# a shirt on a peg: a draped sheet
bpy.ops.mesh.primitive_grid_add(x_subdivisions=40, y_subdivisions=50, size=1, location=(-0.15, 0.3, 0.98), rotation=(math.radians(90), 0, 0))
shirt = bpy.context.object; shirt.scale = (0.46, 0.62, 1); bpy.ops.object.transform_apply(scale=True)
t = bpy.data.textures.new("folds", "CLOUDS"); t.noise_scale = 0.22
d = shirt.modifiers.new("folds", "DISPLACE"); d.texture = t; d.strength = 0.07
w = shirt.modifiers.new("hang", "WAVE"); w.height = 0.02; w.width = 0.12; w.use_y = False; w.time_offset = 3
shirt.modifiers.new("sub", "SUBSURF"); bpy.ops.object.shade_smooth(); add(M_SHIRT, shirt)
shirt2 = shirt.copy(); shirt2.data = shirt.data.copy(); scene.collection.objects.link(shirt2)
shirt2.location.x = 0.65; shirt2.data.materials[0] = mat("shirt2", (0.75, 0.75, 0.78), rough=0.85)
# a bottle
bpy.ops.mesh.primitive_cylinder_add(radius=0.033, depth=0.19, location=(-0.42, 0.1, BENCH_Z + 0.095)); add(M_BOTTLE); bpy.ops.object.shade_smooth()
bpy.ops.mesh.primitive_cylinder_add(radius=0.016, depth=0.04, location=(-0.42, 0.1, BENCH_Z + 0.205)); add(M_DARK); bpy.ops.object.shade_smooth()
# a golden ball on a stand, far along the bench: what the game is about
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.075, segments=48, ring_count=24, location=(-0.11, 0.2, BENCH_Z + 0.17)); add(M_GOLD); bpy.ops.object.shade_smooth()
bpy.ops.mesh.primitive_cone_add(radius1=0.05, radius2=0.03, depth=0.1, location=(-0.11, 0.2, BENCH_Z + 0.05)); add(M_DARK); bpy.ops.object.shade_smooth()

# ---------- light ----------
world = bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.012, 0.018, 0.035, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6

def light(kind, loc, energy, color, size=0.5, aim=(0, 0, BENCH_Z + 0.08), **kw):
    ld = bpy.data.lights.new(kind, kind); ld.energy = energy; ld.color = color
    if kind == "AREA": ld.size = size
    for k, v in kw.items(): setattr(ld, k, v)
    o = bpy.data.objects.new(kind, ld); scene.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o

# the floodlight outside: warm, low, from the left, cut into bars by window slats
flood = light("SPOT", (-2.6, -1.3, 1.9), 1500, (1.0, 0.72, 0.42), spot_size=math.radians(30), spot_blend=0.4, shadow_soft_size=0.02)
for i in range(7):
    box("slat", (0.02, 1.4, 0.06), (-1.9, -0.95, 1.18 + i * 0.13), M_DARK, bevel=0, rot=(0, 0, math.radians(-25)))
light("AREA", (1.4, -1.2, 1.5), 9, (0.45, 0.6, 1.0), size=1.6)          # cool fill
light("AREA", (0.4, 0.3, 1.9), 7, (1.0, 0.85, 0.7), size=0.6)           # top, picks out the shirts
flood.data.keyframe_insert("energy", frame=1)

# ---------- camera: a slow push-in with a little drift ----------
cam_d = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cam_d); scene.collection.objects.link(cam); scene.camera = cam
cam_d.sensor_fit = "VERTICAL"; cam_d.sensor_height = 24; cam_d.lens = 50
cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 2.4
target = bpy.data.objects.new("target", None); scene.collection.objects.link(target)
aim = bpy.data.objects.new("aim", None); scene.collection.objects.link(aim)
aim.location = phone.location + Vector((0.0, 0, 0.055))  # look a little above the phone: less dead floor
target.location = phone.location
cam_d.dof.focus_object = target
tr = cam.constraints.new("TRACK_TO"); tr.target = aim; tr.track_axis = "TRACK_NEGATIVE_Z"; tr.up_axis = "UP_Y"
A = Vector((-0.42, -1.02, BENCH_Z + 0.30)); B = Vector((-0.20, -0.62, BENCH_Z + 0.17))
for f in range(1, LENGTH + 1):
    k = (f - 1) / (LENGTH - 1); e = k * k * (3 - 2 * k) * 0.85 + k * 0.15  # ease, never quite stopping
    cam.location = A.lerp(B, e); cam.keyframe_insert("location", frame=f)

# ---------- render ----------
os.makedirs(OUT, exist_ok=True)
scene.render.image_settings.file_format = "PNG"
if STILL:
    scene.frame_set(int(STILL)); scene.render.filepath = os.path.join(OUT, f"still_{int(STILL):04d}.png")
    bpy.ops.render.render(write_still=True)
else:
    scene.frame_start, scene.frame_end = F0, F1
    scene.render.filepath = os.path.join(OUT, "f_")
    bpy.ops.render.render(animation=True)
