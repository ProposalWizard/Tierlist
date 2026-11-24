"""Blender script: pack the house furniture (Kenney Furniture Kit, CC0) into one small web file.

    blender -b --python tools/home3d/make_furniture.py -- tools/home3d/kenney-furniture public/star/home3d/furniture.glb
    node scripts/perf3d/shrink-models.mjs star/home3d/furniture.glb   (packs it: meshopt)

The OBJ + MTL sources are committed in tools/home3d/kenney-furniture/ (the kit's own
License.txt is there: CC0). Each piece becomes ONE object named by its file name,
scaled to real metres (the kit's unit x 0.2), centred on x/z with its feet at y = 0,
its materials kept by name (wood, carpet, metal, ...) so a room can tint them.
The game clones pieces by name (lib/star/home3d/furniture.ts) and joins them into the
room's still draws (freezeStatic). Nothing here runs at build time; the output is committed.
"""
import bpy, sys, os, json

args = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = args[0], args[1]
SCALE = 0.2

bpy.ops.wm.read_factory_settings(use_empty=True)
names = sorted(f[:-4] for f in os.listdir(SRC) if f.endswith(".obj"))
sizes = {}
for name in names:
    before = set(bpy.data.objects)
    bpy.ops.wm.obj_import(filepath=os.path.join(SRC, name + ".obj"))
    objs = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.scale = (SCALE, SCALE, SCALE)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    xs = [v.co.x for v in ob.data.vertices]; ys = [v.co.y for v in ob.data.vertices]; zs = [v.co.z for v in ob.data.vertices]
    cx, cy, z0 = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)
    for v in ob.data.vertices:
        v.co.x -= cx; v.co.y -= cy; v.co.z -= z0
    ob.location = (0, 0, 0)
    ob.name = name
    ob.data.name = name
    # glTF y-up: width x, height (blender z), depth (blender y)
    sizes[name] = [round(max(xs) - min(xs), 3), round(max(zs) - min(zs), 3), round(max(ys) - min(ys), 3)]

# space them out so nothing overlaps in the file (the game reads each by name, at its own origin)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_yup=True, export_animations=False)
print("wrote", OUT, os.path.getsize(OUT), "bytes,", len(names), "pieces")
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "furniture-sizes.json"), "w") as f:
    json.dump(sizes, f, indent=0, sort_keys=True)
