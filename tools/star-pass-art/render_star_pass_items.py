"""Star Pass test rewards on their podiums (Mikey, 1 Oct 2026).

  blender.exe -b --factory-startup --python tools/star-pass-art/render_star_pass_items.py -- <out_dir> <samples> <job> [frames]

job:    car      level 10: a red sports car turning on the great podium (72 frames)
        penalty  level 5:  a player's hop run-up penalty on the medium podium (frames 0-80)
        ball     level 15: a Champions-League-style star ball on the medium podium (1 frame)
frames: "all" (default) or a comma list, e.g. "0,30,37" for a quick look.

Each frame is the podium AND the reward together, so the lighting and the
shadows match. tools/star-pass-art/make_webp.py turns the frames into an
animated WebP for public/star/star-pass/.

The car is models/ferrari.glb from the three.js examples ("Ferrari 458 Italia
model by vicent091036", CC BY). Its badges are painted over. It is a test
only: swap it for an unbranded car before it goes in the game.
"""
import bpy, math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import render_star_pass as base  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "."
JOB = argv[2] if len(argv) > 2 else None
FRAMES = argv[3] if len(argv) > 3 else "all"
mat = base.mat


def camera(z_center, dist, lens=70, tilt=70):
    cam = bpy.context.scene.camera
    cam.data.lens = lens
    cam.rotation_euler = (math.radians(tilt), 0, 0)
    cam.location = (0, -dist, z_center + dist / math.tan(math.radians(tilt)))


def render_frames(name, frames):
    sc = bpy.context.scene
    for f in frames:
        sc.frame_set(f)
        sc.render.filepath = os.path.join(OUT, f"{name}-{f:03d}.png")
        bpy.ops.render.render(write_still=True)
        print("WROTE", sc.render.filepath, flush=True)


def pick(all_frames):
    if FRAMES == "all":
        return all_frames
    return [int(x) for x in FRAMES.split(",")]


# ── Level 10: the car ───────────────────────────────────────────────────────

DECK_GREAT = 1.55
DECK_MEDIUM = 0.79


def car():
    base.plinth("premier", True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, "models", "ferrari.glb"))
    root = bpy.data.objects["RootNode"]
    turn = bpy.data.objects.new("turn", None)
    bpy.context.scene.collection.objects.link(turn)
    root.parent = turn
    s = 1.0
    root.scale = (s, s, s)
    turn.location = (0, 0, DECK_GREAT)
    # Paint: deep glossy red, the badges painted over in dark chrome.
    paint = mat("paint", (0.62, 0.0, 0.01), metallic=0.35, rough=0.32, coat=1.0)
    paint.node_tree.nodes["Principled BSDF"].inputs["Coat Roughness"].default_value = 0.03
    badge = mat("badge", (0.08, 0.08, 0.09), metallic=1.0, rough=0.25)
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        for slot in o.material_slots:
            if not slot.material:
                continue
            n = slot.material.name
            if n == "Body_Color":
                slot.material = paint
            elif n in ("Ferrari_Yellow", "_0098_DodgerBlue"):
                slot.material = badge
    # A full turn over the frames, starting three-quarters on to the camera.
    n = 72
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 0, n
    for f, a in ((0, 0.0), (n, 360.0)):
        turn.rotation_euler = (0, 0, math.radians(145 + a))
        turn.keyframe_insert("rotation_euler", frame=f)
    for fc in turn.animation_data.action.fcurves:
        for k in fc.keyframe_points:
            k.interpolation = "LINEAR"
    camera(1.85, 16.5)
    render_frames("car", pick(list(range(n))))


# ── Level 15: the ball ──────────────────────────────────────────────────────

def star_ball_images(w=2048, h=1024):
    """A white ball with eight navy stars (one at each corner of a cube,
    silver-edged), drawn straight onto the sphere so nothing stretches."""
    lat = (0.5 - (np.arange(h) + 0.5) / h) * math.pi
    lon = ((np.arange(w) + 0.5) / w) * 2 * math.pi - math.pi
    LON, LAT = np.meshgrid(lon, lat)
    d = np.stack([np.cos(LAT) * np.cos(LON), np.cos(LAT) * np.sin(LON), np.sin(LAT)], -1)
    col = np.ones((h, w, 3)) * np.array([0.93, 0.94, 0.96])
    height = np.ones((h, w))
    R, r_in = 0.60, 0.25
    po = np.array([R, 0.0])
    pi_ = np.array([r_in * math.cos(math.pi / 5), r_in * math.sin(math.pi / 5)])
    e = pi_ - po
    elen = np.linalg.norm(e)
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                c = np.array([sx, sy, sz]) / math.sqrt(3)
                up = np.array([0, 0, 1.0])
                t1 = np.cross(up, c); t1 /= np.linalg.norm(t1)
                t2 = np.cross(c, t1)
                z = d @ c
                m = z > 0.3
                x = (d @ t1) / np.maximum(z, 1e-3)
                y = (d @ t2) / np.maximum(z, 1e-3)
                rot = 0.3 * sx + 0.7 * sy * sz
                th = np.arctan2(y, x) + rot
                rr = np.hypot(x, y)
                seg = 2 * math.pi / 5
                a = np.abs(np.mod(th, seg) - seg / 2)
                a = seg / 2 - a  # 0 at an outer point, pi/5 at an inner corner
                px, py = rr * np.cos(a), rr * np.sin(a)
                cr = e[0] * (py - po[1]) - e[1] * (px - po[0])
                dist = cr / elen  # >0 inside the star (origin side), <0 outside
                inside = m & (dist > 0)
                edge = m & (np.abs(dist) < 0.022)
                col[inside] = (0.004, 0.008, 0.04)
                ring = m & (dist < 0) & (dist > -0.022)
                col[ring] = (0.55, 0.58, 0.64)
                groove = m & (np.abs(dist) < 0.007)
                height[groove] = 0.0
                height[edge & ~groove] = np.minimum(height[edge & ~groove], 0.6)
    def to_img(name, arr):
        img = bpy.data.images.new(name, w, h, alpha=False, float_buffer=True)
        rgba = np.ones((h, w, 4), dtype=np.float32)
        if arr.ndim == 2:
            arr = np.repeat(arr[..., None], 3, -1)
        rgba[..., :3] = arr[::-1]  # Blender stores rows bottom-up
        img.pixels.foreach_set(rgba.ravel())
        return img
    return to_img("ball_col", col), to_img("ball_h", height)


def ball_object(radius, loc):
    col, hgt = star_ball_images()
    m = bpy.data.materials.new("ball")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.32
    b.inputs["Coat Weight"].default_value = 0.6
    tc = nt.nodes.new("ShaderNodeTexCoord")
    tex = nt.nodes.new("ShaderNodeTexEnvironment")  # reads by direction
    tex.image = col
    texh = nt.nodes.new("ShaderNodeTexEnvironment")
    texh.image = hgt
    texh.image.colorspace_settings.name = "Non-Color"
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.5
    bump.inputs["Distance"].default_value = 0.02
    nt.links.new(tc.outputs["Object"], tex.inputs["Vector"])
    nt.links.new(tc.outputs["Object"], texh.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
    nt.links.new(texh.outputs["Color"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc, segments=96, ring_count=48)
    o = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    o.data.materials.append(m)
    return o


def ball():
    base.plinth("premier", False)
    # A short chrome cup for it to sit in.
    chrome = mat("chrome", (0.9, 0.9, 0.92), metallic=1.0, rough=0.12)
    base.torus(0.55, 0.07, DECK_MEDIUM + 0.07, chrome)
    o = ball_object(0.95, (0, 0, DECK_MEDIUM + 0.95 + 0.04))
    o.rotation_euler = (math.radians(18), math.radians(-12), math.radians(28))
    camera(1.55, 13.5)
    render_frames("ball", [0])


# ── Level 5: the hop penalty ────────────────────────────────────────────────

SKIN = (0.55, 0.36, 0.25)
KIT = {
    "shirt": (0.75, 0.03, 0.06), "shorts": (0.92, 0.92, 0.94), "socks": (0.75, 0.03, 0.06),
    "boot": (0.04, 0.04, 0.05), "hair": (0.03, 0.02, 0.015),
}


def empty(name, parent, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.parent = parent
    e.location = loc
    e.rotation_mode = "XYZ"
    return e


def part(parent, kind, size, loc, m, rot=(0, 0, 0), subsurf=2):
    if kind == "cyl":
        r1, r2, depth = size
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=r1, radius2=r2, depth=depth)
    elif kind == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=32, ring_count=16)
    else:
        bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    if kind != "cyl":
        o.scale = size
        bpy.ops.object.transform_apply(scale=True)
    if subsurf:
        if kind != "sphere":
            bev = o.modifiers.new("bev", "BEVEL"); bev.width = 0.02; bev.segments = 2
        sub = o.modifiers.new("sub", "SUBSURF"); sub.levels = subsurf; sub.render_levels = subsurf
    bpy.ops.object.shade_smooth()
    o.data.materials.append(m)
    o.parent = parent
    o.location = loc
    o.rotation_euler = rot
    return o


def footballer():
    """A figurine footballer facing +X (left side +Y), joints as empties.
    Returns the joints by name. Hip height 0.95, about 1.78 tall."""
    M = {k: mat(k, v, rough=0.45, coat=0.4) for k, v in KIT.items()}
    M["skin"] = mat("skin", SKIN, rough=0.5, coat=0.15)
    M["boot"] = mat("bootm", KIT["boot"], rough=0.25, coat=0.8, metallic=0.2)
    M["stripe"] = mat("stripe", (1.0, 0.85, 0.1), rough=0.3)
    J = {}
    root = empty("root", None, (0, 0, 0))
    J["root"] = root
    pelvis = empty("pelvis", root, (0, 0, 0.95)); J["pelvis"] = pelvis
    part(pelvis, "cyl", (0.16, 0.15, 0.2), (0, 0, -0.02), M["shorts"]).scale = (0.72, 1, 1)
    chest = empty("chest", pelvis, (0, 0, 0.06)); J["chest"] = chest
    torso = part(chest, "cyl", (0.135, 0.19, 0.46), (0, 0, 0.24), M["shirt"])
    torso.scale = (0.62, 1, 1)
    neck = empty("neck", chest, (0, 0, 0.5)); J["neck"] = neck
    part(neck, "cyl", (0.05, 0.045, 0.1), (0, 0, 0.03), M["skin"])
    head = empty("head", neck, (0, 0, 0.08)); J["head"] = head
    part(head, "sphere", (0.1, 0.088, 0.115), (0.005, 0, 0.1), M["skin"], subsurf=1)
    part(head, "sphere", (0.098, 0.094, 0.09), (-0.012, 0, 0.145), M["hair"], subsurf=1)
    part(head, "sphere", (0.03, 0.02, 0.03), (0.095, 0, 0.09), M["skin"], subsurf=1)  # nose
    for side, y in (("L", 1), ("R", -1)):
        sh = empty("shoulder" + side, chest, (0, 0.205 * y, 0.43)); J["shoulder" + side] = sh
        part(sh, "sphere", (0.07, 0.07, 0.07), (0, 0, 0), M["shirt"], subsurf=1)
        part(sh, "cyl", (0.052, 0.068, 0.17), (0, 0, -0.07), M["shirt"])
        part(sh, "cyl", (0.042, 0.05, 0.16), (0, 0, -0.2), M["skin"])
        el = empty("elbow" + side, sh, (0, 0, -0.29)); J["elbow" + side] = el
        part(el, "cyl", (0.033, 0.042, 0.26), (0, 0, -0.12), M["skin"])
        part(el, "sphere", (0.045, 0.03, 0.055), (0, 0, -0.28), M["skin"], subsurf=1)
        hp = empty("hip" + side, pelvis, (0, 0.09 * y, -0.04)); J["hip" + side] = hp
        part(hp, "cyl", (0.068, 0.085, 0.22), (0, 0, -0.09), M["shorts"])
        part(hp, "cyl", (0.06, 0.072, 0.24), (0, 0, -0.27), M["skin"])
        kn = empty("knee" + side, hp, (0, 0, -0.43)); J["knee" + side] = kn
        part(kn, "cyl", (0.045, 0.058, 0.22), (0, 0, -0.08), M["skin"])
        part(kn, "cyl", (0.04, 0.056, 0.26), (0, 0, -0.27), M["socks"])
        an = empty("ankle" + side, kn, (0, 0, -0.43)); J["ankle" + side] = an
        part(an, "cube", (0.25, 0.1, 0.075), (0.06, 0, -0.035), M["boot"])
        part(an, "cube", (0.12, 0.102, 0.02), (0.03, 0, -0.02), M["stripe"], subsurf=0)
    return J


# Poses: degrees. hip/shoulder "swing" forward is positive; knee and elbow
# bend are positive; "out" lifts an arm away from the body.
def apply_pose(J, p, frame):
    def setr(name, x=0.0, y=0.0, z=0.0):
        o = J[name]
        o.rotation_euler = (math.radians(x), math.radians(y), math.radians(z))
        o.keyframe_insert("rotation_euler", frame=frame)
    root = J["root"]
    root.location = p["at"]
    root.rotation_euler = (0, 0, math.radians(p.get("face", 0)))
    root.keyframe_insert("location", frame=frame)
    root.keyframe_insert("rotation_euler", frame=frame)
    setr("pelvis", y=p.get("lean", 0) * 0.3, z=p.get("twist", 0))
    setr("chest", y=p.get("lean", 0), z=-p.get("twist", 0) * 0.6)
    setr("head", y=-p.get("lean", 0) * 0.6)
    for s, sign in (("L", 1), ("R", -1)):
        hs, kb = p["hip" + s]
        setr("hip" + s, y=-hs)
        setr("knee" + s, y=kb)
        setr("ankle" + s, y=p.get("toe" + s, 0))
        sw, out, eb = p["arm" + s]
        setr("shoulder" + s, x=out * sign, y=-sw)
        setr("elbow" + s, y=-eb)


def penalty():
    base.plinth("premier", False)
    sc = bpy.context.scene
    sc.render.fps = 20
    sc.render.resolution_y = 620  # tall enough for the raised arms and the whole podium
    # The figure is a statuette, bigger than life against the podium so he
    # reads at phone size; the run-up is squeezed to fit on the deck.
    FIG = 1.5
    K = FIG / 0.9
    BX, D = 0.95, 1.25
    white = mat("spot", (0.95, 0.95, 0.95), rough=0.6)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.13, depth=0.006, location=(BX, 0.0, DECK_MEDIUM + 0.003))
    bpy.context.active_object.data.materials.append(white)

    J = footballer()
    root = J["root"]
    root.scale = (FIG, FIG, FIG)
    BR = 0.17
    ballo = ball_object(BR, (BX, 0.0, DECK_MEDIUM + BR))
    Z = DECK_MEDIUM
    Y = 0.1  # his line: the kicking (right) foot passes over the ball

    stand = dict(hipL=(0, 4), hipR=(0, 4), armL=(4, 8, 15), armR=(4, 8, 15), lean=4)
    def run(phase_right_forward, x, up=0.0):
        if phase_right_forward:
            return dict(at=(x, Y, Z + up), lean=14, hipR=(30, 12), hipL=(-22, 45),
                        armR=(-38, 10, 85), armL=(38, 10, 85))
        return dict(at=(x, Y, Z + up), lean=14, hipL=(30, 12), hipR=(-22, 45),
                    armL=(-38, 10, 85), armR=(38, 10, 85))
    def passing(left_driving, x, up=0.035):
        if left_driving:
            return dict(at=(x, Y, Z + up), lean=12, hipL=(38, 95), hipR=(-2, 12),
                        armL=(0, 10, 85), armR=(0, 10, 85))
        return dict(at=(x, Y, Z + up), lean=12, hipR=(38, 95), hipL=(-2, 12),
                    armL=(0, 10, 85), armR=(0, 10, 85))

    keys = {
        0: dict(stand, at=(-1.5, Y, Z)),
        8: dict(stand, at=(-1.5, Y, Z), lean=8, hipL=(8, 14), hipR=(-6, 10)),
        12: run(True, -1.38),
        15: passing(False, -1.22),
        18: run(False, -1.02),
        21: passing(True, -0.84),
        24: run(True, -0.64),
        27: passing(False, -0.46),
        # The hop: off the right foot, both feet off the ground, arms out.
        30: dict(at=(-0.3, Y, Z + 0.06), lean=6, hipL=(20, 55), hipR=(-8, 35), armL=(10, 40, 40), armR=(10, 30, 40)),
        32: dict(at=(-0.18, Y, Z + 0.24), lean=4, hipL=(25, 60), hipR=(10, 70), armL=(15, 55, 30), armR=(5, 40, 30)),
        34: dict(at=(-0.06, Y, Z + 0.07), lean=0, hipL=(15, 25), hipR=(-15, 80), armL=(10, 60, 25), armR=(15, 35, 30)),
        # Plant the left foot beside the ball, right leg cocked back.
        36: dict(at=(0.08, Y, Z), lean=-6, twist=-10, hipL=(18, 14), hipR=(-48, 105), toeR=30,
                 armL=(5, 75, 20), armR=(30, 25, 40)),
        # Strike.
        38: dict(at=(0.16, Y, Z), lean=0, twist=8, hipL=(10, 12), hipR=(12, 30), toeR=20,
                 armL=(-5, 70, 20), armR=(10, 35, 40)),
        40: dict(at=(0.22, Y, Z + 0.02), lean=6, twist=14, hipL=(4, 8), hipR=(62, 8), toeR=10,
                 armL=(-15, 60, 25), armR=(5, 40, 40)),
        43: dict(at=(0.28, Y, Z + 0.04), lean=4, twist=10, hipL=(-2, 10), hipR=(70, 15),
                 armL=(-10, 50, 30), armR=(10, 40, 40)),
        47: dict(at=(0.42, Y, Z), lean=6, hipL=(-14, 25), hipR=(22, 20), armL=(0, 30, 40), armR=(10, 30, 40)),
        52: dict(stand, at=(0.5, Y, Z), face=-25),
        # Arms up: it's in.
        58: dict(at=(0.5, Y, Z + 0.04), face=-45, lean=-6, hipL=(4, 10), hipR=(-4, 10),
                 armL=(165, 25, 10), armR=(165, 25, 10)),
        66: dict(at=(0.5, Y, Z), face=-45, lean=-4, hipL=(2, 6), hipR=(-2, 6),
                 armL=(150, 30, 25), armR=(150, 30, 25)),
        80: dict(at=(0.5, Y, Z), face=-45, lean=-4, hipL=(2, 6), hipR=(-2, 6),
                 armL=(150, 30, 25), armR=(150, 30, 25)),
    }
    for f, p in keys.items():
        p = dict(p)
        p.setdefault("hipL", (0, 4)); p.setdefault("hipR", (0, 4))
        p.setdefault("armL", (4, 8, 15)); p.setdefault("armR", (4, 8, 15))
        x, y, z = p["at"]
        p["at"] = (BX + (x - 0.42) * D, y * K, Z + (z - Z) * K)
        apply_pose(J, p, f)

    # The ball: appears with a pop, sits on the spot, struck on frame 38.
    bl = ballo.location.copy()
    def bkey(f, loc, s):
        ballo.location = loc; ballo.scale = (s, s, s)
        ballo.keyframe_insert("location", frame=f); ballo.keyframe_insert("scale", frame=f)
    bkey(0, bl, 0.01)
    bkey(3, bl, 1.25)
    bkey(5, bl, 1.0)
    bkey(38, bl, 1.0)
    bkey(44, (bl.x + 2.2 * K, bl.y + 1.6 * K, bl.z + 1.1 * K), 1.0)
    bkey(48, (bl.x + 4.0 * K, bl.y + 3.4 * K, bl.z + 1.6 * K), 1.0)
    bkey(49, (bl.x + 4.0 * K, bl.y + 3.4 * K, bl.z + 1.6 * K), 0.0)
    bkey(80, (bl.x + 4.0 * K, bl.y + 3.4 * K, bl.z + 1.6 * K), 0.0)
    for fc in ballo.animation_data.action.fcurves:
        for k in fc.keyframe_points:
            k.interpolation = "LINEAR"
    ballo.rotation_mode = "XYZ"
    ballo.rotation_euler = (0, 0, 0); ballo.keyframe_insert("rotation_euler", frame=38)
    ballo.rotation_euler = (math.radians(-500), 0, math.radians(200)); ballo.keyframe_insert("rotation_euler", frame=48)

    camera(2.15, 15.0)
    render_frames("penalty", pick(list(range(0, 81))))


# ── The header's badge: a gold star the level number sits on ─────────────────

def star_badge():
    import bmesh
    sc = bpy.context.scene
    sc.render.resolution_x = sc.render.resolution_y = 360
    gold = mat("gold", (1.0, 0.72, 0.2), metallic=1.0, rough=0.16)
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (1.0, 0.88, 0.62, 1)
    sc.world.node_tree.nodes["Background"].inputs[1].default_value = 0.8
    sc.view_settings.look = "AgX - Punchy"
    me = bpy.data.meshes.new("star")
    bm = bmesh.new()
    top, bot = [], []
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5
        rr = 1.0 if i % 2 == 0 else 0.48
        top.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), 0.16)))
        bot.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), 0.0)))
    apex = bm.verts.new((0, 0, 0.42))
    for i in range(10):
        k = (i + 1) % 10
        bm.faces.new((apex, top[i], top[k]))
        bm.faces.new((top[k], top[i], bot[i], bot[k]))
    bm.faces.new(list(reversed(bot)))
    bm.normal_update()
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new("star", me)
    sc.collection.objects.link(o)
    bev = o.modifiers.new("bev", "BEVEL"); bev.width = 0.03; bev.segments = 3; bev.limit_method = "ANGLE"
    o.data.materials.append(gold)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    o.rotation_euler = (math.radians(90), 0, 0)
    o.location = (0, 0.11, 0)
    cam = sc.camera
    cam.data.type = "ORTHO"; cam.data.ortho_scale = 2.35
    cam.location = (0, -10, 0.02); cam.rotation_euler = (math.radians(90), 0, 0)
    render_frames("star", [0])


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    base.reset()
    {"car": car, "ball": ball, "penalty": penalty, "star": star_badge}[JOB]()
