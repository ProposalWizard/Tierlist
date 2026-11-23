"""Render a Quaternius UAL 1 clip on the library's OWN mannequin (a plain grey figure): the SOURCE half of the
proof sheet (tools/mocap3d/README.md, UAL section). Blender 4.0 headless, Workbench, orthographic.

    blender -b --python tools/mocap3d/ual_render.py -- <UAL1_Standard.fbx> <outdir> <Clip> <frame,frame,...> [size]

Writes <outdir>/<Clip>-<view>-<frame>.png for view front, side, top (top: a 10 cm floor grid, bold every 50 cm).
Frames are the library's own (30 fps, from 1).
"""
import bpy, sys, os, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
fbx, out, clip, frames = argv[0], argv[1], argv[2], [int(f) for f in argv[3].split(",")]
size = int(argv[4]) if len(argv) > 4 else 600
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=fbx)
arm = [o for o in bpy.data.objects if o.type == "ARMATURE"][0]
act = [a for a in bpy.data.actions if a.name.split("|")[-1] == clip][0]
arm.animation_data_create()
arm.animation_data.action = act
sc = bpy.context.scene
# Cycles on the CPU (a machine with no graphics card: Workbench and EEVEE need OpenGL)
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = 12
sc.cycles.use_denoising = False
sc.render.resolution_x = size
sc.render.resolution_y = int(size * 1.6)
sc.render.film_transparent = False
sc.world = bpy.data.worlds.new("w")
sc.world.use_nodes = True
sc.world.node_tree.nodes["Background"].inputs[0].default_value = (1, 1, 1, 1)
sc.world.node_tree.nodes["Background"].inputs[1].default_value = 1.0
def flat(name, rgb):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs[0].default_value = (*rgb, 1)
    return m
grey, ink = flat("grey", (0.45, 0.45, 0.47)), flat("ink", (0.05, 0.05, 0.05))
# floor grid: thin boxes every 10 cm, bold every 50 cm, 3 m square (y forward in this frame: he faces +y)
for i in range(-15, 16):
    for axis in (0, 1):
        w = 0.006 if i % 5 else 0.014
        bpy.ops.mesh.primitive_cube_add(size=1)
        c = bpy.context.object
        c.scale = (w, 3.0, 0.001) if axis == 0 else (3.0, w, 0.001)
        c.location = (i * 0.1, 0, 0) if axis == 0 else (0, i * 0.1, 0)
        c.data.materials.append(ink)
for o in bpy.data.objects:
    if o.type == "MESH" and not o.name.startswith("Cube"):
        o.data.materials.clear()
        o.data.materials.append(grey)
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(35), 0, math.radians(150))
sc.collection.objects.link(sun)
cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
cam = bpy.data.objects.new("cam", cam_data)
sc.collection.objects.link(cam)
sc.camera = cam
VIEWS = {  # name: (location, rotation euler) — he faces +y, his left is -x in world
    "front": ((0, 6, 0.95), (math.radians(90), 0, math.radians(180))),
    "side": ((-6, 0, 0.95), (math.radians(90), 0, math.radians(-90))),
    "top": ((0, 0, 6), (0, 0, math.radians(180))),
}
for f in frames:
    sc.frame_set(f)
    for v, (loc, rot) in VIEWS.items():
        cam.location = Vector(loc)
        cam.rotation_euler = rot
        cam_data.ortho_scale = 2.2 if v != "top" else 1.4
        sc.render.filepath = os.path.join(out, f"{clip}-{v}-{f:03d}.png")
        bpy.ops.render.render(write_still=True)
print("done")
