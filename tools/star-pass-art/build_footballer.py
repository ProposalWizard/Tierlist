"""A realistic footballer for the Star Pass, built with MakeHuman (MPFB 2).

  blender.exe -b --factory-startup --python tools/star-pass-art/build_footballer.py -- <out.blend>

Needs the MPFB 2 extension installed in this Blender, plus the MakeHuman asset
packs (all CC0): makehuman_system_assets, shirts01, pants01, hair01,
underwear04, shoes01 — see memory/reference_blender.md for where they live.

Builds a young, athletic man with a game-engine skeleton (pelvis, spine_01..03,
thigh_l, calf_l, foot_l, upperarm_l, lowerarm_l, hand_l, neck_01, head ...),
dresses him in a kit (polo shirt, shorts, high socks, trainers) and recolours
the kit textures: red shirt, white shorts, red socks, black boots. A
placeholder until the player's own avatar is settled.
"""
import bpy, os, sys
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.preferences.addon_enable(module="bl_ext.user_default.mpfb")
from bl_ext.user_default.mpfb.services.humanservice import HumanService  # noqa: E402

info = HumanService._create_default_human_info_dict()
info["phenotype"].update({"gender": 1.0, "age": 0.42, "muscle": 0.72, "weight": 0.42,
                          "proportions": 0.75, "height": 0.62})
info["phenotype"]["race"] = {"caucasian": 0.7, "african": 0.15, "asian": 0.15}
info["rig"] = "game_engine"
info["eyes"] = "high-poly/high-poly.mhclo"
info["eyebrows"] = "eyebrow001/eyebrow001.mhclo"
info["eyelashes"] = "eyelashes01/eyelashes01.mhclo"
info["teeth"] = "teeth_base/teeth_base.mhclo"
info["hair"] = "short02/short02.mhclo"
info["skin_mhmat"] = "young_caucasian_male/young_caucasian_male.mhmat"
info["skin_material_type"] = "MAKESKIN"
info["eyes_material_type"] = "MAKESKIN"
info["clothes_material_type"] = "MAKESKIN"
info["clothes"] = [
    "male_casualsuit06/male_casualsuit06.mhclo",
    "joepal_crude_high_socks/joepal_crude_high_socks.mhclo",
    "shoes05/shoes05.mhclo",
]
info["alternative_materials"] = {}
settings = HumanService.get_default_deserialization_settings()
settings["subdiv_levels"] = 0
basemesh = HumanService.deserialize_from_dict(info, settings)

# The t-shirt and jeans are one mesh: everything above the hem becomes the
# red shirt, everything below the white shorts, and the jeans are cut off
# above the knee.
HEM_Z = float(argv[1]) if len(argv) > 1 else 0.93
CUT_Z = float(argv[2]) if len(argv) > 2 else 0.68
RED, WHITE, BLACK = (0.78, 0.04, 0.07), (0.93, 0.93, 0.95), (0.06, 0.06, 0.07)


def recolour(img, colour, keep):
    """Repaint a garment texture in a kit colour, keeping its folds and seams."""
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    lum = px[..., :3] @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    lum = lum / max(1e-3, float(np.percentile(lum, 90)))
    shade = 1 - keep + keep * np.clip(lum, 0, 1.15)
    px[..., :3] = np.clip(shade[..., None] * np.array(colour, dtype=np.float32), 0, 1)
    new = bpy.data.images.new(img.name + "_kit", w, h, alpha=True)
    new.pixels.foreach_set(px.ravel())
    new.pack()
    return new


def recolour_material(m, colour, keep):
    for n in m.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image and n.image.colorspace_settings.name == "sRGB":
            n.image = recolour(n.image, colour, keep)


import bmesh  # noqa: E402
for o in list(bpy.data.objects):
    if o.type != "MESH":
        continue
    name = o.name.lower()
    if "casualsuit06" in name:
        shirt = o.material_slots[0].material
        shorts = shirt.copy(); shorts.name = "kit_shorts"
        shirt.name = "kit_shirt"
        recolour_material(shirt, RED, 0.85)
        recolour_material(shorts, WHITE, 0.3)
        o.data.materials.append(shorts)
        mw = o.matrix_world
        bm = bmesh.new(); bm.from_mesh(o.data)
        zs = sorted((mw @ v.co).z for v in bm.verts)
        print("SUIT z range", round(zs[0], 3), round(zs[-1], 3), flush=True)
        dead = [f for f in bm.faces if all((mw @ v.co).z < CUT_Z for v in f.verts)]
        bmesh.ops.delete(bm, geom=dead, context="FACES")
        for f in bm.faces:
            f.material_index = 1 if (mw @ f.calc_center_median()).z < HEM_Z else 0
        bm.to_mesh(o.data); bm.free()
    elif "socks" in name:
        recolour_material(o.material_slots[0].material, RED, 0.9)
        # Below the boot tops the socks only poke through the boots.
        mw = o.matrix_world
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if all((mw @ v.co).z < 0.11 for v in f.verts)], context="FACES")
        bm.to_mesh(o.data); bm.free()
    elif "shoes05" in name:
        recolour_material(o.material_slots[0].material, BLACK, 0.8)

# The legs were hidden under the jeans; show them again below the shorts.
for mod in list(basemesh.modifiers):
    print("BODY MOD", mod.type, mod.name, getattr(mod, "vertex_group", ""), flush=True)
    if mod.type == "MASK" and "casualsuit06" in mod.name.lower():
        basemesh.modifiers.remove(mod)

bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("SAVED", OUT, flush=True)
