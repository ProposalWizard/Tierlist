"""TOON MANAGERS WITH REAL VARIETY (review, 20 Nov 2026; Harry: keep the game's style).

Two rows of six managers, made only from what the game already has: the two Style A suit
heads (public/star/people3d/toon-mgr.glb, toon-mgr2.glb), the three builds (a scale), the
eight skin tones, hair colour and grey, and a suit / shirt / tie colour.
  top row    TODAY: every manager is asked for by the same id, so he is the same head and
             build in the same suit; only skin, hair colour and tie change.
  bottom row SEEDED BY HIS NAME: head, build, skin, hair, grey, suit, shirt and tie all from
             the name (what a one-line change plus a seeded suit colour would give).
The pose is the game's own boss-idle clip. The light is Blender's, not the game's cel shader.

  S=/tmp/phone3d   (see realistic_people.py for the unpack tools)
  node tools/ovation3d/unpack.mjs public/star/people3d/toon-mgr.glb  $S/toon_mgr.glb  --tools=$S/gt   (and toon-mgr2)
  node tools/modeltest/addclips.mjs $S/toon_mgr.glb $S/anims.glb $S/toon_mgr_a.glb $S/gt boss-idle,boss-sit,boss-talk
  blender -b -P tools/review-people/toon_managers.py -- <out.png> [width height samples]
"""
import json, math, os, struct, sys
import bpy
from mathutils import Vector

A = sys.argv[sys.argv.index("--") + 1:]
OUT = A[0]
W, H, SAMPLES = (int(A[1]), int(A[2]), int(A[3])) if len(A) > 3 else (1500, 1300, 48)
S = os.environ.get("REVIEW_DIR", "/tmp/phone3d")
FILES = {"m1": f"{S}/toon_mgr_a.glb", "m2": f"{S}/toon_mgr2_a.glb"}
BUILD = {"c1": (0.95, 0.95, 1.0), "c2": (1.07, 1.06, 1.0), "c3": (1.0, 1.0, 1.05)}   # x, depth, height


def srgb(c):
    c = c.lstrip("#")
    c = tuple(int(c[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def extras(path):
    f = open(path, "rb"); f.read(12)
    n, _ = struct.unpack("<I4s", f.read(8))
    return json.loads(f.read(n))["scenes"][0]["extras"]


def lum(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def material(tex, mask, ex, look):
    m = bpy.data.materials.new("Toon")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    lk = nt.links.new
    T = nt.nodes.new("ShaderNodeTexImage"); T.image = tex
    M = nt.nodes.new("ShaderNodeTexImage"); M.image = mask; M.image.colorspace_settings.name = "Non-Color"
    bw = nt.nodes.new("ShaderNodeRGBToBW"); lk(T.outputs["Color"], bw.inputs[0])
    sepm = nt.nodes.new("ShaderNodeSeparateColor"); lk(M.outputs["Color"], sepm.inputs[0])
    hsv = nt.nodes.new("ShaderNodeSeparateColor"); hsv.mode = "HSV"; lk(T.outputs["Color"], hsv.inputs[0])

    def shaded(col, ref, lo, hi, power=1.0):
        d = nt.nodes.new("ShaderNodeMath"); d.operation = "DIVIDE"; d.inputs[1].default_value = max(ref, 1e-3); lk(bw.outputs[0], d.inputs[0])
        p = nt.nodes.new("ShaderNodeMath"); p.operation = "POWER"; p.inputs[1].default_value = power; lk(d.outputs[0], p.inputs[0])
        c = nt.nodes.new("ShaderNodeClamp"); c.inputs["Min"].default_value = lo; c.inputs["Max"].default_value = hi; lk(p.outputs[0], c.inputs["Value"])
        s = nt.nodes.new("ShaderNodeVectorMath"); s.operation = "SCALE"; s.inputs[0].default_value = srgb(col); lk(c.outputs[0], s.inputs["Scale"])
        return s.outputs[0]

    def mix(fac, a, b_):
        x = nt.nodes.new("ShaderNodeMix"); x.data_type = "RGBA"
        lk(fac, x.inputs["Factor"]); lk(a, x.inputs["A"]); lk(b_, x.inputs["B"])
        return x.outputs["Result"]

    def gt(sock, v):
        g = nt.nodes.new("ShaderNodeMath"); g.operation = "GREATER_THAN"; g.inputs[1].default_value = v; lk(sock, g.inputs[0])
        return g.outputs[0]

    coat = shaded(look["suit"], 0.02, 0.5, 1.8)
    shirt = shaded(look["shirt"], 0.75, 0.55, 1.1)
    tie = shaded(look["tie"], 0.12, 0.5, 1.5)
    cloth = mix(gt(bw.outputs[0], 0.35), coat, shirt)
    # the tie: red in the file, on the chest only (shoes and the navy cloth are coloured too)
    hue_far = nt.nodes.new("ShaderNodeMath"); hue_far.operation = "PINGPONG"; hue_far.inputs[1].default_value = 0.5; lk(hsv.outputs[0], hue_far.inputs[0])
    red = nt.nodes.new("ShaderNodeMath"); red.operation = "LESS_THAN"; red.inputs[1].default_value = 0.04; lk(hue_far.outputs[0], red.inputs[0])
    tc = nt.nodes.new("ShaderNodeTexCoord"); sz = nt.nodes.new("ShaderNodeSeparateXYZ"); lk(tc.outputs["Generated"], sz.inputs[0])
    chest = nt.nodes.new("ShaderNodeMath"); chest.operation = "COMPARE"; chest.inputs[1].default_value = 0.68; chest.inputs[2].default_value = 0.14; lk(sz.outputs["Z"], chest.inputs[0])
    is_tie = gt(hsv.outputs[1], 0.5)
    for extra in (red.outputs[0], chest.outputs[0]):
        mu = nt.nodes.new("ShaderNodeMath"); mu.operation = "MULTIPLY"; lk(is_tie, mu.inputs[0]); lk(extra, mu.inputs[1]); is_tie = mu.outputs[0]
    cloth = mix(is_tie, cloth, tie)
    skin = shaded(look["skin"], lum(ex["skinAvg"]), 0.35, 1.3, 0.85)       # the game's TOON_SKIN_PAINT
    hair = shaded(look["hair"], lum(ex["hairAvg"]), 0.4, 2.2)
    col = mix(sepm.outputs[1], cloth, skin)
    col = mix(sepm.outputs[2], col, hair)
    lk(col, b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.85
    b.inputs["Specular IOR Level"].default_value = 0.15
    return m


def hair_col(hexcol, grey):
    h = hexcol.lstrip("#")
    a = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    g = [0.72, 0.71, 0.69]
    return "#" + "".join(f"{round((x + (y - x) * grey) * 255):02x}" for x, y in zip(a, g))


def person(look, x, y):
    before = set(bpy.data.objects); imgs = set(bpy.data.images)
    bpy.ops.import_scene.gltf(filepath=FILES[look["head"]])
    new = [o for o in bpy.data.objects if o not in before]
    arm = [o for o in new if o.type == "ARMATURE"][0]
    keep = []
    for o in new:
        if o.type == "MESH" and not o.name.startswith("Body"):
            bpy.data.objects.remove(o)
        else:
            keep.append(o)
    new = keep
    body = [o for o in new if o.type == "MESH"][0]
    new_imgs = [i for i in bpy.data.images if i not in imgs]
    tex = max(new_imgs, key=lambda i: i.size[0]); mask = min(new_imgs, key=lambda i: i.size[0])
    ex = extras(FILES[look["head"]])
    lk2 = dict(look, hair=hair_col(look["hair"], look["grey"]))
    body.data.materials.clear(); body.data.materials.append(material(tex, mask, ex, lk2))
    for p in body.data.polygons:
        p.use_smooth = True
    act = next(a for a in bpy.data.actions if a.name.split(".0")[0] in ("boss-idle", "boss-idle_Armature"))
    arm.animation_data_create(); arm.animation_data.action = act
    top = [o for o in new if o.parent is None]
    root = bpy.data.objects.new("Root", None); bpy.context.scene.collection.objects.link(root)
    for o in top:
        o.parent = root
    root.location = (x, y, 0)
    root.scale = BUILD[look["build"]]
    return root


SKIN = dict(porcelain="#f7dcc4", fair="#eec095", light="#d4a373", tan="#c68642", olive="#a9714b", brown="#8d5524", deep="#6b3d1f", dark="#4a2b18")
NAVY = dict(suit="#1f2533", shirt="#eef0f2")
# TODAY: who = "signing-manager" for every club -> head m2, build c2, the one suit; skin, hair colour, grey and the tie (club colour) vary
TODAY = [dict(head="m2", build="c2", skin=SKIN[s], hair=h, grey=g, tie=t, **NAVY) for s, h, g, t in (
    ("fair", "#3d2616", 0.2, "#c8102e"), ("olive", "#120c09", 0.0, "#1d4ed8"), ("deep", "#120c09", 0.3, "#f1c40f"),
    ("porcelain", "#8a6440", 0.7, "#0d6b3a"), ("tan", "#2a1a12", 0.5, "#6a1d4a"), ("dark", "#120c09", 0.85, "#c8102e"))]
# SEEDED BY NAME: everything the game already has, picked per manager
SEEDED = [
    dict(head="m1", build="c2", skin=SKIN["fair"], hair="#5a3a22", grey=0.85, suit="#1f2a44", shirt="#f4f4f2", tie="#7a1626"),
    dict(head="m2", build="c1", skin=SKIN["deep"], hair="#120c09", grey=0.0, suit="#3a3f4a", shirt="#dfe8f4", tie="#b08a2a"),
    dict(head="m1", build="c3", skin=SKIN["olive"], hair="#120c09", grey=0.25, suit="#4a3a2c", shirt="#f2ece0", tie="#2d5a3a"),
    dict(head="m2", build="c2", skin=SKIN["porcelain"], hair="#8a6440", grey=0.1, suit="#121316", shirt="#f4f4f2", tie="#1b2f6b"),
    dict(head="m1", build="c1", skin=SKIN["dark"], hair="#120c09", grey=0.6, suit="#2c3a2e", shirt="#e6eef0", tie="#5a2a6b"),
    dict(head="m2", build="c3", skin=SKIN["tan"], hair="#2a1a12", grey=0.5, suit="#25282f", shirt="#f4f4f2", tie="#202020"),
]

bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
scn.render.engine = "CYCLES"; scn.cycles.device = "CPU"; scn.cycles.samples = SAMPLES
scn.cycles.use_denoising = False; scn.cycles.use_adaptive_sampling = True; scn.cycles.adaptive_threshold = 0.02
scn.render.resolution_x, scn.render.resolution_y = W, H
scn.render.threads_mode = "FIXED"; scn.render.threads = 4
scn.view_settings.view_transform = "Standard"
w = bpy.data.worlds.new("W"); scn.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.75, 0.78, 0.85, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
GAP = 0.78
for r, row in enumerate((TODAY, SEEDED)):
    for i, lk_ in enumerate(row):
        person(lk_, (i - 2.5) * GAP, 0, ).location.z = (1 - r) * 2.15
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0.6, (1 - r) * 2.15 + 1.0))
    bg = bpy.context.object; bg.scale = (6, 2.4, 1); bg.rotation_euler.x = math.radians(90)
    mat = bpy.data.materials.new("Bg"); mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = ((0.10, 0.12, 0.17, 1), (0.08, 0.14, 0.11, 1))[r]
    mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 1
    bg.data.materials.append(mat)
scn.frame_set(24)
sun = bpy.data.lights.new("Sun", "SUN"); sun.energy = 2.6; sun.angle = math.radians(25)
so = bpy.data.objects.new("Sun", sun); scn.collection.objects.link(so)
so.rotation_euler = (math.radians(62), 0, math.radians(-28))
cd = bpy.data.cameras.new("Cam"); cd.type = "ORTHO"; cd.ortho_scale = 4.9
cam = bpy.data.objects.new("Cam", cd); scn.collection.objects.link(cam)
cam.location = (0, -9, 2.05); cam.rotation_euler = (math.radians(90), 0, 0); scn.camera = cam
scn.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("RENDERED", OUT)
