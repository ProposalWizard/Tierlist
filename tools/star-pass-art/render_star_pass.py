"""Star Pass art: platforms and placeholder reward boxes (Mikey, 2 Oct 2026).

Run with the portable Blender (see memory/reference_blender.md):
  blender.exe -b --factory-startup --python tools/star-pass-art/render_star_pass.py -- <out_dir> [samples]

Renders, all transparent PNGs, one camera so they line up:
  plinth-<theme>-medium.png   the platform at every 5th level
  plinth-<theme>-great.png    the bigger, grander platform at every 10th
  box-medium.png / box-great.png   placeholder reward boxes ("?") until the
                                    real rewards are decided
  crown-100.png                the level-100 centrepiece: a golden ball on a
                                royal stand

Themes run every 20 levels: Premier League, Europa League, Champions League,
World Cup, Ballon d'Or. "Vibes" only: colours and materials, no real logos.
"""
import bpy, bmesh, math, os, sys

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else os.path.join(os.path.dirname(__file__), "out")
SAMPLES = int(argv[1]) if len(argv) > 1 else 64
os.makedirs(OUT, exist_ok=True)

THEMES = {
    # name: (base, accent glow, trim)
    "premier": ((0.14, 0.02, 0.17), (0.0, 0.95, 0.85), (0.95, 0.15, 0.6)),
    "europa": ((0.05, 0.05, 0.06), (1.0, 0.38, 0.02), (0.9, 0.9, 0.9)),
    "champions": ((0.01, 0.03, 0.12), (0.75, 0.85, 1.0), (0.85, 0.87, 0.92)),
    "worldcup": ((0.02, 0.22, 0.12), (1.0, 0.78, 0.2), (1.0, 0.76, 0.25)),
    "ballondor": ((0.32, 0.02, 0.04), (1.0, 0.84, 0.35), (1.0, 0.8, 0.3)),
}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    sc.cycles.device = "CPU"
    sc.render.film_transparent = True
    sc.render.resolution_x = 640
    sc.render.resolution_y = 480
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("w")
    sc.world = world
    world.use_nodes = True
    # A soft studio sky: the background itself is transparent in the render,
    # but metal (gold, chrome) needs something bright to reflect or it reads
    # as black.
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.58, 0.68, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
    # Camera: from the front, a little above, like looking up the road.
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 70
    cam = bpy.data.objects.new("cam", cam_data)
    sc.collection.objects.link(cam)
    cam.location = (0, -9.6, 4.2)
    cam.rotation_euler = (math.radians(68), 0, 0)
    sc.camera = cam
    # Lights: a soft key from the top-left, a rim from behind, a fill from below.
    for name, loc, energy, size, rot in [
        ("key", (-4, -4, 7), 900, 4, (math.radians(40), 0, math.radians(-35))),
        ("rim", (3, 5, 5), 700, 3, (math.radians(-50), 0, math.radians(150))),
        ("fill", (4, -6, 1.5), 200, 4, (math.radians(80), 0, math.radians(35))),
    ]:
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = energy
        ld.size = size
        lo = bpy.data.objects.new(name, ld)
        lo.location = loc
        lo.rotation_euler = rot
        sc.collection.objects.link(lo)


def mat(name, color, metallic=0.0, rough=0.35, emit=None, strength=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = coat
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    return m


def cyl(r, h, z, verts=48, bevel=0.04, material=None, name="c"):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=(0, 0, z + h / 2))
    o = bpy.context.active_object
    o.name = name
    if bevel:
        mod = o.modifiers.new("bev", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = "ANGLE"
    bpy.ops.object.shade_smooth()
    if material:
        o.data.materials.append(material)
    return o


def torus(R, r, z, material):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=(0, 0, z), major_segments=64, minor_segments=12)
    o = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    o.data.materials.append(material)
    return o


def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("WROTE", path, flush=True)


def plinth(theme, great):
    base, accent, trim = THEMES[theme]
    stone = mat("stone", base, metallic=0.1, rough=0.28, coat=0.6)
    glow = mat("glow", accent, emit=accent, strength=6.0 if great else 3.5)
    trimm = mat("trim", trim, metallic=1.0, rough=0.18)
    deck = mat("deck", tuple(min(1.0, c * 2.2 + 0.12) for c in base), metallic=0.4, rough=0.22, coat=1.0)
    if not great:
        cyl(2.6, 0.55, 0, material=stone, name="base")
        torus(2.62, 0.045, 0.55, glow)
        cyl(2.25, 0.18, 0.55, material=trimm, name="top")
        cyl(2.0, 0.06, 0.73, material=deck, name="deck", bevel=0.02)
    else:
        cyl(3.1, 0.5, 0, material=stone, name="base")
        torus(3.12, 0.05, 0.5, glow)
        cyl(2.75, 0.45, 0.5, material=trimm, name="tier")
        cyl(2.5, 0.4, 0.95, material=stone, name="tier2")
        torus(2.52, 0.05, 1.35, glow)
        cyl(2.2, 0.14, 1.35, material=trimm, name="top")
        cyl(1.95, 0.06, 1.49, material=deck, name="deck", bevel=0.02)
        # Four short posts round the edge, lit at the tips.
        for k in range(8):
            a = k * math.pi / 4 + math.pi / 8
            bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.1, depth=0.9, location=(2.95 * math.cos(a), 2.95 * math.sin(a), 0.95))
            p = bpy.context.active_object
            bpy.ops.object.shade_smooth()
            p.data.materials.append(trimm)
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.15, location=(2.95 * math.cos(a), 2.95 * math.sin(a), 1.45))
            s = bpy.context.active_object
            bpy.ops.object.shade_smooth()
            s.data.materials.append(glow)


def box(great):
    body = mat("body", (0.9, 0.72, 0.25) if great else (0.62, 0.66, 0.74), metallic=1.0, rough=0.22)
    band = mat("band", (0.35, 0.05, 0.6) if great else (0.1, 0.25, 0.6), metallic=0.3, rough=0.3, coat=0.8)
    mark = mat("mark", (1, 1, 1), emit=(1, 0.95, 0.75) if great else (0.75, 0.9, 1), strength=4)
    s = 1.25 if great else 1.0
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.75 * s))
    c = bpy.context.active_object
    c.scale = (1.7 * s, 1.3 * s, 1.5 * s)
    bpy.ops.object.transform_apply(scale=True)
    mod = c.modifiers.new("bev", "BEVEL"); mod.width = 0.12; mod.segments = 4
    c.data.materials.append(body)
    # Coloured lid band and base.
    for z in (0.08 * s, 1.42 * s):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, z))
        b = bpy.context.active_object
        b.scale = (1.78 * s, 1.38 * s, 0.14 * s)
        bpy.ops.object.transform_apply(scale=True)
        m2 = b.modifiers.new("bev", "BEVEL"); m2.width = 0.04; m2.segments = 3
        b.data.materials.append(band)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.75 * s))
    v = bpy.context.active_object
    v.scale = (0.3 * s, 1.36 * s, 1.52 * s)
    bpy.ops.object.transform_apply(scale=True)
    v.data.materials.append(band)
    # The "?" on the front.
    bpy.ops.object.text_add(location=(0, -0.7 * s, 0.75 * s))
    t = bpy.context.active_object
    t.data.body = "?"
    t.data.align_x = "CENTER"; t.data.align_y = "CENTER"
    t.data.size = 1.0 * s
    t.data.extrude = 0.06
    t.data.bevel_depth = 0.02
    t.rotation_euler = (math.radians(90), 0, 0)
    t.data.materials.append(mark)
    for o in bpy.context.scene.objects:
        if o.type in {"MESH", "FONT"}:
            o.location.z += 0.0


def crown():
    gold = mat("gold", (1.0, 0.76, 0.3), metallic=1.0, rough=0.16)
    velvet = mat("velvet", (0.35, 0.02, 0.06), rough=0.7)
    marble = mat("marble", (0.92, 0.9, 0.86), rough=0.2, coat=0.6)
    glow = mat("glow", (1.0, 0.84, 0.35), emit=(1.0, 0.84, 0.35), strength=8)
    cyl(3.2, 0.5, 0, material=marble, name="b1")
    torus(3.22, 0.06, 0.5, glow)
    cyl(2.8, 0.35, 0.5, material=gold, name="b2")
    cyl(2.5, 0.5, 0.85, material=velvet, name="b3", bevel=0.08)
    cyl(1.0, 0.3, 1.35, material=gold, name="cup")
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.25, location=(0, 0, 2.85), segments=64, ring_count=32)
    ball = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    ball.data.materials.append(gold)
    # A ring of light round the ball.
    torus(1.6, 0.04, 2.85, glow).rotation_euler = (math.radians(70), 0, 0)


def frame_camera_for(z_center, dist=13.5):
    # Far enough back that the widest piece (the great platform's posts, the
    # level-100 stand) sits inside the frame with room to spare.
    cam = bpy.context.scene.camera
    cam.rotation_euler = (math.radians(70), 0, 0)
    cam.location = (0, -dist, 5.0 + z_center)


if __name__ == "__main__":
    jobs = []
    for t in THEMES:
        jobs.append((f"plinth-{t}-medium", lambda t=t: plinth(t, False), 0.6))
        jobs.append((f"plinth-{t}-great", lambda t=t: plinth(t, True), 0.9))
    jobs.append(("box-medium", lambda: box(False), 0.8))
    jobs.append(("box-great", lambda: box(True), 1.0))
    jobs.append(("crown-100", lambda: crown(), 2.3))

    only = argv[2].split(",") if len(argv) > 2 else None
    for name, build, zc in jobs:
        if only and name not in only:
            continue
        reset()
        build()
        frame_camera_for(zc, 17.5 if name == "crown-100" else 9.0 if name.startswith("box") else 13.5)
        render(os.path.join(OUT, name + ".png"))
