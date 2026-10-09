"""Render clips on the real body in Blender (Workbench, works with no GPU).

    blender -b --python tools/mocap3d/render_sheet.py -- <body+clips.glb> <out_dir> <clip>[:n] ...

<body+clips.glb>: an unpacked body with the clips added (tools/mocap3d/README.md
shows how). For each clip, n frames (default 8) evenly through it, from the
side and from the front-left, a grid floor and shadows so a foot through the
floor or floating shows. Writes <out_dir>/<clip>-<view>-<i>.png; sheet.py
puts them on one page.
"""
import bpy, sys, os, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
src, out = argv[0], argv[1]
clips = argv[2:]
os.makedirs(out, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = 30
bpy.ops.import_scene.gltf(filepath=src)
arm = next(o for o in sc.objects if o.type == "ARMATURE")
hipsname = "Hips" if "Hips" in arm.pose.bones else "pelvis"

# floor
bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
floor = bpy.context.active_object
mat = bpy.data.materials.new("floor")
mat.diffuse_color = (0.55, 0.7, 0.5, 1)
floor.data.materials.append(mat)
# grid lines on the floor every 0.5 m
for i in range(-20, 21):
    for axis in (0, 1):
        bpy.ops.mesh.primitive_cube_add(size=1, location=((i * 0.5, 0, 0.001) if axis == 0 else (0, i * 0.5, 0.001)))
        c = bpy.context.active_object
        c.scale = (0.008, 20, 0.0005) if axis == 0 else (20, 0.008, 0.0005)
        m2 = bpy.data.materials.get("grid") or bpy.data.materials.new("grid")
        m2.diffuse_color = (0.3, 0.42, 0.3, 1)
        c.data.materials.append(m2)

camd = bpy.data.cameras.new("cam")
camd.type = "ORTHO"
camd.ortho_scale = 2.6
cam = bpy.data.objects.new("cam", camd)
sc.collection.objects.link(cam)
sc.camera = cam
sc.render.engine = "BLENDER_WORKBENCH"
sh = sc.display.shading
sh.light = "STUDIO"
sh.color_type = "MATERIAL"
sh.show_shadows = True
sh.shadow_intensity = 0.6
sh.show_cavity = True
sc.display.light_direction = (0.4, -0.3, 0.86)
sc.render.resolution_x = 220
sc.render.resolution_y = 300
sc.render.film_transparent = False
sc.world = bpy.data.worlds.new("w")
sc.world.color = (0.85, 0.88, 0.92)

acts = {a.name: a for a in bpy.data.actions}


def action_for(name):
    for n, a in acts.items():
        if n == name or n.startswith(name + "_") or n.startswith(name + "|"):
            return a
    return None


for spec in clips:
    name, *rest = spec.split(":")
    times = [float(x) for x in rest[0][1:].split(",")] if rest and rest[0].startswith("@") else None
    n = len(times) if times else (int(rest[0]) if rest else 8)
    a = action_for(name)
    if name == "rest":
        if arm.animation_data:
            arm.animation_data.action = None
        for pb in arm.pose.bones:
            pb.matrix_basis.identity()
        hp = arm.matrix_world @ arm.pose.bones[hipsname].head
        for view, (dx, dy) in (("side", (3.5, 0)), ("front", (-2.2, -2.8))):
            cam.location = Vector((hp.x + dx, hp.y + dy, 1.0))
            d = Vector((hp.x, hp.y, 0.95)) - cam.location
            cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
            sc.render.filepath = os.path.join(out, f"rest-{view}-00.png")
            bpy.ops.render.render(write_still=True)
        continue
    if a is None:
        print("NO ACTION", name, list(acts)[:5])
        continue
    arm.animation_data_create()
    arm.animation_data.action = a
    f0, f1 = a.frame_range
    for i in range(n):
        fr = f0 + (f1 - f0) * i / max(1, n - 1) if not times else f0 + times[i] * sc.render.fps
        sc.frame_set(int(math.floor(fr)), subframe=fr - math.floor(fr))
        hp = arm.matrix_world @ arm.pose.bones[hipsname].head
        for view, (dx, dy) in (("side", (3.5, 0)), ("front", (-2.2, -2.8))):
            cam.location = Vector((hp.x + dx, hp.y + dy, 1.0))
            d = Vector((hp.x, hp.y, 0.95)) - cam.location
            cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
            sc.render.filepath = os.path.join(out, f"{name}-{view}-{i:02d}.png")
            bpy.ops.render.render(write_still=True)
    print("DONE", name, f0, f1)
