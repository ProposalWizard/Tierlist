"""Quick front + side preview of a GLB (Workbench, textures), for checking a fit.
blender -b --python tools/modeltest/preview.py -- <in.glb> <out.png> [action] [frame]
The camera looks from -Y (the game's player faces -Y in Blender)."""
import bpy, sys, math
from mathutils import Vector
argv = sys.argv[sys.argv.index("--") + 1:]
src, out = argv[:2]
act = argv[2] if len(argv) > 2 else None
fr = float(argv[3]) if len(argv) > 3 else 0
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
if act and arms:
    a = bpy.data.actions.get(act) or next(x for x in bpy.data.actions if x.name.split("_Arm")[0] == act)
    print("ACTIONS", [x.name for x in bpy.data.actions])
    arms[0].animation_data_create(); arms[0].animation_data.action = a
    for t in arms[0].animation_data.nla_tracks: t.mute = True
    sc.frame_set(int(fr))
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
pts = []
for o in bpy.data.objects:
    if o.type == "MESH":
        e = o.evaluated_get(dg); m = e.to_mesh()
        pts += [o.matrix_world @ v.co for v in m.vertices]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
c = (lo + hi) / 2; h = max(hi.z - lo.z, hi.x - lo.x)
print("BBOX", tuple(round(x, 3) for x in lo), tuple(round(x, 3) for x in hi))
sc.render.engine = "BLENDER_WORKBENCH"
sc.display.shading.color_type = "TEXTURE"; sc.display.shading.light = "STUDIO"
sc.render.resolution_x, sc.render.resolution_y = 900, 700
cd = bpy.data.cameras.new("c"); cd.type = "ORTHO"; cd.ortho_scale = h * 1.15
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
import os
base = out[:-4]
for name, d in (("front", Vector((0, -1, 0))), ("side", Vector((1, 0, 0))), ("back", Vector((0, 1, 0)))):
    cam.location = c + d * 6
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = f"{base}_{name}.png"
    bpy.ops.render.render(write_still=True)
print("WROTE", base)
