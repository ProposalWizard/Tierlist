"""Star Pass rewards you can spin: exported as .glb for the live 3D podium.

  blender.exe -b --factory-startup --python tools/star-pass-art/export_live3d.py -- <out_dir> <job>

job:  podium-<theme>-<tier>   a podium on its own (same build as the pictures)
      ball                    level 15: the star ball in its chrome cup
      glasses                 level 25: the footballer in gold aviator
                              sunglasses, with idle moves as separate clips:
                              Idle (loop), StepIn, Knuckles, Glasses, Look

Everything keeps Blender's coordinates, so the podium and the reward line up
when the page loads both. Textures are shrunk to 1024 px and saved as WebP.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT, JOB = argv[0], argv[1]
sys.argv = sys.argv[: sys.argv.index("--") + 1] + [OUT, "16"]  # what render_star_pass reads
import render_star_pass as base  # noqa: E402
from footballer_rig import Rig  # noqa: E402

BLEND = os.environ.get("FOOTBALLER_BLEND", r"C:/Users/mikey/mpfb/footballer.blend")
DECK_MEDIUM = 0.79
FIG = 1.5
os.makedirs(OUT, exist_ok=True)


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def export(name, objs, anim=False):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = os.path.join(OUT, name + ".glb")
    kw = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
              export_yup=True, export_image_format="WEBP", export_cameras=False, export_lights=False)
    if anim:
        kw.update(export_animations=True, export_animation_mode="ACTIONS", export_skins=True,
                  export_optimize_animation_size=True, export_force_sampling=True)
    else:
        kw.update(export_animations=False)
    bpy.ops.export_scene.gltf(**kw)
    print("EXPORTED", path, os.path.getsize(path) // 1024, "KB", flush=True)


def shrink_images(px=1024):
    for img in bpy.data.images:
        if img.size[0] > px or img.size[1] > px:
            s = px / max(img.size)
            img.scale(max(1, int(img.size[0] * s)), max(1, int(img.size[1] * s)))


def podium(theme, tier):
    clear()
    base.plinth(theme, tier == "great")
    export(f"podium-{theme}-{tier}", [o for o in bpy.context.scene.objects if o.type == "MESH"])


def ball():
    clear()
    from render_star_pass_items import star_ball_images
    col, hgt = star_ball_images(1024, 512)
    m = bpy.data.materials.new("starball"); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.32
    b.inputs["Coat Weight"].default_value = 0.6
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = col
    nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
    col.pack()
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.95, location=(0, 0, DECK_MEDIUM + 0.95 + 0.04), segments=64, ring_count=32)
    o = bpy.context.active_object; bpy.ops.object.shade_smooth(); o.data.materials.append(m)
    o.rotation_euler = (math.radians(18), math.radians(-12), math.radians(28))
    o.name = "ball"
    chrome = base.mat("chrome", (0.9, 0.9, 0.92), metallic=1.0, rough=0.12)
    cup = base.torus(0.55, 0.07, DECK_MEDIUM + 0.07, chrome); cup.name = "cup"
    export("reward-ball", [o, cup])


# ── The sunglasses ──────────────────────────────────────────────────────────

def lens_outline(cx, n=48):
    """An aviator lens round (cx, 1.672) on the face: wide and flat on top,
    drooping to a point at the bottom outside corner."""
    out = 1 if cx > 0 else -1
    w, h = 0.029, 0.023
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x, z = math.cos(t), math.sin(t)
        if z > 0:
            z *= 0.72
        else:
            x += 0.28 * (-z) * (1 if x * out > 0 else 0.4) * out
            z *= 1.12
        X = cx + w * x
        Z = 1.674 + h * z
        # wrap round the face: further back the further out it goes
        Y = -0.173 + 3.2 * (X - cx * 0.6) ** 2 * (1 if X * out > 0 else 0.3)
        pts.append(Vector((X, Y, Z)))
    return pts


def tube(points, r, name, closed=False, mat=None):
    cd = bpy.data.curves.new(name, "CURVE"); cd.dimensions = "3D"
    sp = cd.splines.new("POLY"); sp.points.add(len(points) - 1)
    for p, v in zip(sp.points, points):
        p.co = (v.x, v.y, v.z, 1)
    sp.use_cyclic_u = closed
    cd.bevel_depth = r; cd.bevel_resolution = 3
    o = bpy.data.objects.new(name, cd); bpy.context.scene.collection.objects.link(o)
    if mat:
        o.data.materials.append(mat)
    return o


def glasses():
    gold = base.mat("gold_frame", (1.0, 0.72, 0.28), metallic=1.0, rough=0.14)
    lensm = bpy.data.materials.new("lens"); lensm.use_nodes = True
    lb = lensm.node_tree.nodes["Principled BSDF"]
    lb.inputs["Base Color"].default_value = (0.06, 0.035, 0.02, 1)
    lb.inputs["Roughness"].default_value = 0.03
    lb.inputs["Alpha"].default_value = 0.86
    lb.inputs["Coat Weight"].default_value = 1.0
    lensm.blend_method = "BLEND" if hasattr(lensm, "blend_method") else lensm.blend_method
    parts = []
    for cx in (0.032, -0.032):
        pts = lens_outline(cx)
        me = bpy.data.meshes.new("lens"); bm = bmesh.new()
        vs = [bm.verts.new(p) for p in pts]
        bm.faces.new(vs)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
        bm.to_mesh(me); bm.free()
        lo = bpy.data.objects.new("lens", me); bpy.context.scene.collection.objects.link(lo)
        lo.data.materials.append(lensm)
        sol = lo.modifiers.new("s", "SOLIDIFY"); sol.thickness = 0.0012
        parts.append(lo)
        parts.append(tube(pts, 0.0011, "rim", closed=True, mat=gold))
    # Double bridge and the brow bar.
    parts.append(tube([Vector((-0.006, -0.176, 1.683)), Vector((0, -0.178, 1.685)), Vector((0.006, -0.176, 1.683))], 0.0009, "bridge", mat=gold))
    parts.append(tube([Vector((-0.052, -0.168, 1.6905)), Vector((-0.02, -0.177, 1.693)), Vector((0.02, -0.177, 1.693)), Vector((0.052, -0.168, 1.6905))], 0.0009, "brow", mat=gold))
    # Arms back to the ears.
    for s in (1, -1):
        parts.append(tube([Vector((0.06 * s, -0.163, 1.684)), Vector((0.084 * s, -0.135, 1.685)),
                           Vector((0.094 * s, -0.08, 1.683)), Vector((0.095 * s, -0.02, 1.678)),
                           Vector((0.09 * s, 0.01, 1.655))], 0.0012, "arm", mat=gold))
        # nose pads
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0035, location=(0.011 * s, -0.163, 1.662), segments=12, ring_count=6)
        pad = bpy.context.active_object; pad.scale = (0.5, 0.3, 1); pad.data.materials.append(lensm); parts.append(pad)
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.join()
    g = bpy.context.active_object; g.name = "Sunglasses"
    bpy.ops.object.shade_smooth()
    return g


def load_footballer():
    with bpy.data.libraries.load(BLEND, link=False) as (src, dst):
        dst.objects = list(src.objects)
    for o in dst.objects:
        if o is not None and o.type in {"MESH", "ARMATURE"}:
            bpy.context.scene.collection.objects.link(o)
    return bpy.data.objects["Human.rig"]


def glasses_job():
    clear()
    rig_obj = load_footballer()
    g = glasses()
    # Hang the glasses off the head bone so they move with him.
    bpy.ops.object.select_all(action="DESELECT")
    g.select_set(True); rig_obj.select_set(True)
    bpy.context.view_layer.objects.active = rig_obj
    rig_obj.data.bones.active = rig_obj.data.bones["head"]
    bpy.ops.object.parent_set(type="BONE", keep_transform=True)
    shrink_images()

    rig = Rig(rig_obj)
    root = rig_obj.pose.bones["Root"]
    if rig_obj.animation_data is None:
        rig_obj.animation_data_create()

    def clip(name, keys, length):
        act = bpy.data.actions.new(name)
        rig_obj.animation_data.action = act
        for f, p, at in keys:
            rig.pose(p)
            root.location = at
            rig.key(f)
        act.frame_range = (0, length)
        act.use_frame_range = True
        tr = rig_obj.animation_data.nla_tracks.new(); tr.name = name
        tr.strips.new(name, 0, act); tr.mute = True
        rig_obj.animation_data.action = None

    Z = (0, 0, 0)
    stand = dict(armL=(2, 4, 10), armR=(2, 4, 10), hipL=(1, 2), hipR=(-1, 2))
    clip("Idle", [
        (0, dict(stand), Z),
        (48, dict(stand, lean=-1.5, side=1.5, nod=-2, armL=(3, 5, 12), armR=(1, 4, 9)), (0.004, 0, 0.003)),
        (96, dict(stand), Z),
    ], 96)
    # Forward is -Y in his own axes, which is towards the camera.
    clip("StepIn", [
        (0, dict(stand), Z),
        (10, dict(stand, hipL=(28, 40), hipR=(-4, 6), armR=(14, 6, 20), armL=(-10, 6, 20), lean=3), (0, -0.05, 0.01)),
        (20, dict(stand, hipL=(14, 6), hipR=(-14, 10), armR=(10, 6, 18), armL=(-8, 6, 18), lean=2), (0, -0.16, -0.01)),
        (30, dict(stand, hipL=(-2, 4), hipR=(22, 42), lean=2), (0, -0.24, 0.01)),
        (40, dict(stand, nod=4), (0, -0.3, 0)),
        (70, dict(stand, nod=2, look=8), (0, -0.3, 0)),
        (82, dict(stand, hipR=(-26, 40), hipL=(4, 6), lean=-2), (0, -0.24, 0.01)),
        (94, dict(stand, hipR=(-12, 6), hipL=(14, 10), lean=-1), (0, -0.12, -0.01)),
        (104, dict(stand, hipL=(-22, 42), hipR=(2, 4)), (0, -0.04, 0.01)),
        (116, dict(stand), Z),
    ], 116)
    # Hands meet in front of the chest, fingers lace, push out, shake loose.
    clasp = dict(stand, armL=(55, -22, 105), armR=(55, -22, 105), palmL=80, palmR=80, fistL=0.7, fistR=0.7, nod=6)
    clip("Knuckles", [
        (0, dict(stand), Z),
        (16, clasp, Z),
        (30, dict(clasp, armL=(72, -18, 40), armR=(72, -18, 40), wristL=-40, wristR=-40, fistL=0.5, fistR=0.5, lean=-3), Z),
        (38, dict(clasp, armL=(70, -18, 48), armR=(70, -18, 48), wristL=-45, wristR=-45), Z),
        (50, clasp, Z),
        (62, dict(stand, armL=(20, 18, 40), armR=(20, 18, 40), fistL=0.0, fistR=0.0, wristL=25, wristR=25), Z),
        (68, dict(stand, armL=(16, 14, 30), armR=(16, 14, 30), fistL=0.1, fistR=0.1, wristL=-20, wristR=-20), Z),
        (82, dict(stand), Z),
    ], 82)
    # A finger to the bridge to push the glasses up, a little nod.
    reach = dict(stand, armR=(62, -8, 150), palmR=10, fistR=0.6, wristR=10, nod=-4)
    clip("Glasses", [
        (0, dict(stand), Z),
        (18, reach, Z),
        (26, dict(reach, nod=-8), Z),
        (36, dict(reach, nod=2), Z),
        (54, dict(stand, nod=3), Z),
        (66, dict(stand), Z),
    ], 66)
    clip("Look", [
        (0, dict(stand), Z),
        (20, dict(stand, look=38, twist=6), Z),
        (40, dict(stand, look=38, twist=6, nod=-4), Z),
        (58, dict(stand, look=-36, twist=-6), Z),
        (78, dict(stand, look=-36, twist=-6, nod=-3), Z),
        (96, dict(stand), Z),
    ], 96)
    rig.pose(dict(stand)); root.location = Z

    objs = [rig_obj] + [o for o in bpy.context.scene.objects if o.type == "MESH"]
    export("reward-glasses", objs, anim=True)


if JOB.startswith("podium-"):
    _, theme, tier = JOB.split("-")
    podium(theme, tier)
elif JOB == "ball":
    ball()
elif JOB == "glasses":
    glasses_job()
