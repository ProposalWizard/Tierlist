"""Blender script: pack the 3D garden's downloaded models into small web files.

    blender -b --python tools/garden3d/export_models.py -- <raw dir> <out dir>

<raw dir> holds the free packs as downloaded (see public/star/garden3d/LICENSE.txt):
  kenney_nature-kit, kenney_furniture-kit, kenney_fantasy-town-kit_2.0,
  kenney_survival-kit (Kenney, CC0), and farm/, animals2/ (Quaternius, CC0).

Writes:
  props.glb   every static piece, one object per piece, named by its key
              below (the garden clones them by name). Draco-compressed.
  horse.glb   Quaternius' horse with its animations.
  bird.glb    Quaternius' eagle with its animations (shrunk to a garden bird
              in the scene).
Nothing here runs at build time; the outputs are committed.
Afterwards horse.glb and bird.glb are packed small (meshopt) by
scripts/perf3d/shrink-models.mjs, run at the end here; props.glb stays Draco
(smaller than meshopt for it).
"""
import bpy, sys, os

args = sys.argv[sys.argv.index("--") + 1:]
RAW, OUT = args[0], args[1]
os.makedirs(OUT, exist_ok=True)

NAT = os.path.join(RAW, "kenney_nature-kit", "Models", "GLTF format")
FUR = os.path.join(RAW, "kenney_furniture-kit", "Models", "GLTF format")
TOWN = os.path.join(RAW, "kenney_fantasy-town-kit_2.0", "Models", "GLB format")
SURV = os.path.join(RAW, "kenney_survival-kit", "Models", "GLB format")

PROPS = {
    # trees and planting
    "tree_oak": (NAT, "tree_oak"), "tree_default": (NAT, "tree_default"), "tree_detailed": (NAT, "tree_detailed"),
    "tree_fat": (NAT, "tree_fat"), "tree_tall": (NAT, "tree_tall"), "tree_pine": (NAT, "tree_pineRoundA"),
    "tree_pine2": (NAT, "tree_pineTallA_detailed"), "bush_large": (NAT, "plant_bushLarge"),
    "bush": (NAT, "plant_bushDetailed"), "bush_small": (NAT, "plant_bushSmall"),
    "flower_red": (NAT, "flower_redA"), "flower_yellow": (NAT, "flower_yellowA"), "flower_purple": (NAT, "flower_purpleA"),
    "grass": (NAT, "grass_large"), "rock": (NAT, "rock_smallA"), "rock_flat": (NAT, "rock_smallFlatA"),
    "pot_large": (NAT, "pot_large"), "log_stack": (NAT, "log_stack"),
    # boundary and paddock
    "fence_wood": (NAT, "fence_simple"), "fence_gate": (NAT, "fence_gate"), "fence_planks": (NAT, "fence_planks"),
    "hedge": (TOWN, "hedge"), "hedge_large": (TOWN, "hedge-large"), "wall_stone": (TOWN, "wall-block"),
    "pillar_stone": (TOWN, "pillar-stone"), "lantern": (TOWN, "lantern"),
    # the fountain
    "fountain": (TOWN, "fountain-round"),
    # bench, gazebo bits
    "bench": (FUR, "bench"), "bench_cushion": (FUR, "benchCushion"), "potted_plant": (FUR, "pottedPlant"),
    "plant_small": (FUR, "plantSmall2"), "side_table": (FUR, "sideTable"), "lounge_chair": (FUR, "loungeChairRelax"),
    "barrel": (SURV, "barrel"), "bucket": (SURV, "bucket"),
}


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_one(folder, name):
    for ext in (".glb", ".gltf"):
        p = os.path.join(folder, name + ext)
        if os.path.exists(p):
            before = set(bpy.data.objects)
            bpy.ops.import_scene.gltf(filepath=p)
            return [o for o in bpy.data.objects if o not in before]
    raise FileNotFoundError(name)


def export(path, animations=False):
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6, export_animations=animations, export_apply=True,
        export_yup=True,
    )
    print("wrote", path, os.path.getsize(path), "bytes")


# ── props.glb ──
clear()
for key, (folder, name) in PROPS.items():
    objs = import_one(folder, name)
    meshes = [o for o in objs if o.type == "MESH"]
    others = [o.name for o in objs if o.type != "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    # bake parent transforms in, then join into one object per piece
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    ob.name = key
    ob.data.name = key
    for n in others:
        if n in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)
export(os.path.join(OUT, "props.glb"))

# ── animated animals ──
for key, blend, obj in (("horse", "farm/Farm Animals by @Quaternius/FBX/Horse.fbx", None),
                        ("bird", "animals2/Animal Pack Vol.2 by @Quaternius/FBX/Eagle.fbx", None)):
    clear()
    bpy.ops.import_scene.fbx(filepath=os.path.join(RAW, blend))
    for a in bpy.data.actions:
        print(key, "action", a.name, a.frame_range[:])
    export(os.path.join(OUT, key + ".glb"), animations=True)

# A rebuild writes them big: pack them small (scripts/perf3d/shrink-models.mjs).
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "scripts", "perf3d"))
from shrink_after_build import shrink  # noqa: E402
shrink([os.path.join(OUT, "horse.glb"), os.path.join(OUT, "bird.glb")])
