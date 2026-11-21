"""REALISTIC PEOPLE PROOF STILLS (review, 20 Nov 2026).

Harry saw the first-person hand made from the game's realistic body
(public/star/human3d/human.glb, the CC0 MakeHuman body; tools/phone3d/hand_phone_gta.py)
and asked what the cut scenes and the main build would look like at that level.
This script builds WHOLE people from the same file, the way lib/star/human3d/human.ts
does in the game (parts by outfit, build / age / face shapes through the anchors),
and renders proof stills in Blender (Cycles, CPU):

  desk     a manager across a desk from you (first person), in a suit, hands on the desk
  lineup   three different managers side by side (face shape, skin, hair, age, build, suit)
  faces    the same three, head and shoulders

Unpack the game's packed file first (Blender cannot read it), as tools/phone3d does:
  S=/tmp/phone3d && mkdir -p $S
  npm i --prefix $S/gt @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4 meshoptimizer draco3dgltf sharp
  node tools/ovation3d/unpack.mjs public/star/human3d/human.glb $S/human_full.glb --tools=$S/gt
  node tools/styletest/strip.mjs $S/human_full.glb $S/human_s.glb $S/gt
  node tools/ovation3d/unpack.mjs public/star/people3d/anims.glb $S/anims.glb --tools=$S/gt
  node tools/modeltest/addclips.mjs $S/human_s.glb $S/anims.glb $S/human_sa.glb $S/gt boss-sit,boss-idle,idle,boss-talk,sitidle
The poses are the game's own clips (boss-sit, boss-idle), held at one frame; only the fingers are curled here.

usage: blender -b -P realistic_people.py -- <desk|lineup|faces> <out.png> [width height samples] [who]
       REVIEW_HUMAN_FULL / REVIEW_HUMAN_S point at the two unpacked files.
It prints CHECK {...}: the smallest gap between the hands and the desk, and how many
faces of one body part cut another (RUL-3D-005).

Not done here, on purpose: the joints do not move with the build (the game moves them),
and nobody is taller or shorter (the game does that too). These are stills, not game files.
"""
import json
import math
import os
import struct
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

A = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
MODE = A[0] if A else "lineup"
OUT = A[1] if len(A) > 1 else "/tmp/review-people.png"
W = int(A[2]) if len(A) > 2 else 900
H = int(A[3]) if len(A) > 3 else 1200
SAMPLES = int(A[4]) if len(A) > 4 else 96
WHO = A[5] if len(A) > 5 else "a"
FULL = os.environ.get("REVIEW_HUMAN_FULL", "/tmp/phone3d/human_full.glb")
STRIPPED = os.environ.get("REVIEW_HUMAN_S", "/tmp/phone3d/human_sa.glb")


def srgb(c):
    if isinstance(c, str):
        c = c.lstrip("#")
        c = tuple(int(c[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


# ------------------------------------------------------------ the file's own data
CT = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_glb(path):
    f = open(path, "rb")
    f.read(12)
    n, _ = struct.unpack("<I4s", f.read(8))
    j = json.loads(f.read(n))
    bn, _ = struct.unpack("<I4s", f.read(8))
    b = f.read(bn)

    def acc(i):
        a = j["accessors"][i]
        bv = j["bufferViews"][a["bufferView"]]
        k = NC[a["type"]]
        dt = np.dtype("<" + CT[a["componentType"]])
        off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        st = bv.get("byteStride")
        if st and st != dt.itemsize * k:
            raw = np.frombuffer(b, dtype=np.uint8, count=st * a["count"], offset=off).reshape(a["count"], st)
            return np.frombuffer(raw[:, :dt.itemsize * k].tobytes(), dtype=dt).reshape(a["count"], k)
        return np.frombuffer(b, dtype=dt, count=a["count"] * k, offset=off).reshape(a["count"], k)

    meshes, shapes = {}, {}
    for m in j["meshes"]:
        p = m["primitives"][0]
        if m["name"] == "Shapes":
            names = m.get("extras", {}).get("targetNames") or [s["name"] for s in j["scenes"][0]["extras"]["human"]["shapes"]]
            for nm, t in zip(names, p["targets"]):
                shapes[nm] = acc(t["POSITION"]).astype(np.float64)
            continue
        at = p["attributes"]
        meshes[m["name"]] = {k: acc(at[k]) for k in ("_PART", "_ZONE", "_ANCHOR", "_ANCHORW", "_DEL", "POSITION") if k in at}
    return meshes, shapes, j["scenes"][0]["extras"]


MESHES, SHAPES, EXTRAS = read_glb(FULL)
HM = EXTRAS["human"]
PARTS = HM["parts"]


def parts_for(s):
    """As partsFor in lib/star/human3d/human.ts."""
    out = ["skin.head", "skin.neck", "skin.hand", "skin.wrist", "eyes", "teeth"]
    all_skin = ["skin.forearm", "skin.uparmLow", "skin.uparmTop", "skin.torso", "skin.hips", "skin.thighTop", "skin.thighLow", "skin.knee", "skin.shin"]
    o = s.get("outfit", "suit")
    if o in ("suit", "suitOpen"):
        out += ["out.suit", "out.formalShoes"] + all_skin
    elif o == "shirt":
        out += ["out.shirtJeans", "out.formalShoes"] + all_skin
    elif o == "coat":
        out += ["out.jacketJeans", "out.formalShoes"] + all_skin
    elif o == "casual":
        out += ["out.teeJeans", "out.trainerShoes"] + all_skin
    else:
        out += ["kit.tee", "kit.teeShorts", "kit.socks", "kit.trainers", "skin.forearm", "skin.uparmLow", "skin.torso", "skin.thighLow", "skin.knee"]
    hair = {"short": ["hair.mh_short"], "crop": ["hair.mh_crop"], "side": ["hair.mh_side"], "slick": ["hair.mh_swept"], "curly": ["hair.mh_afro"],
            "long": ["hair.mh_long"], "buzz": ["hair.buzz"], "receding": ["hair.receding"], "sides": ["hair.sides"], "none": []}
    out += hair[s.get("hair", "short")]
    if s.get("facialHair", "none") != "none":
        out.append("hair." + s["facialHair"])
    out.append("brows.mh")
    if s.get("glasses"):
        out.append("out.glasses")
    return out


def shape_weights(s):
    """As shapeWeights in human.ts, without the height step."""
    pos = lambda x: max(0.0, x)  # noqa: E731
    neg = lambda x: max(0.0, -x)  # noqa: E731
    g = s.get
    w = {"heavy": pos(g("build", 0)), "lean": neg(g("build", 0)), "muscle": pos(g("muscle", 0)), "soft": neg(g("muscle", 0)),
         "old": max(0.0, min(1.15, (g("age", 25) - 25) / 45)), "belly": max(0.0, g("belly", 0)),
         "shoulders": g("shoulders", 0), "neck": g("neck", 0)}
    f = g("face", {})
    for k in ("jaw", "chin", "cheeks", "lips", "eyes"):
        w[k] = f.get(k, 0)
    w["nose"], w["noseSmall"] = pos(f.get("nose", 0)), neg(f.get("nose", 0))
    w["faceLong"], w["faceRound"], w["faceSquare"] = f.get("long", 0), f.get("round", 0), f.get("square", 0)
    h = g("heritage")
    if h:
        t = sum(h.values()) or 1
        for k in ("african", "asian", "caucasian"):
            w[k] = h.get(k, 0) / t
    return w


# ------------------------------------------------------------------ materials
def mat_skin(tone, tex, age):
    m = bpy.data.materials.new("Skin")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    lk = nt.links.new
    avg = HM.get("skinTexMean") or [0.5, 0.3, 0.22]
    ti = nt.nodes.new("ShaderNodeTexImage")
    ti.image = tex
    div = nt.nodes.new("ShaderNodeVectorMath")
    div.operation = "DIVIDE"
    div.inputs[1].default_value = avg
    lk(ti.outputs["Color"], div.inputs[0])
    mixd = nt.nodes.new("ShaderNodeMix")
    mixd.data_type = "RGBA"
    mixd.inputs["Factor"].default_value = 0.9
    mixd.inputs["A"].default_value = (1, 1, 1, 1)
    lk(div.outputs[0], mixd.inputs["B"])
    mul = nt.nodes.new("ShaderNodeVectorMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = srgb(tone)
    lk(mixd.outputs["Result"], mul.inputs[0])
    # living skin: a little blotch, more with age
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n1 = nt.nodes.new("ShaderNodeTexNoise")
    n1.inputs["Scale"].default_value = 55
    n1.inputs["Detail"].default_value = 3
    lk(tc.outputs["Object"], n1.inputs["Vector"])
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.3
    mr.inputs["From Max"].default_value = 0.7
    amt = 0.02 + 0.03 * min(1, max(0, (age - 30) / 35))
    mr.inputs["To Min"].default_value = 1 - amt
    mr.inputs["To Max"].default_value = 1 + amt
    lk(n1.outputs["Fac"], mr.inputs["Value"])
    hsv = nt.nodes.new("ShaderNodeHueSaturation")
    hsv.inputs["Saturation"].default_value = 0.9
    lk(mr.outputs["Result"], hsv.inputs["Value"])
    lk(mul.outputs[0], hsv.inputs["Color"])
    lk(hsv.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.48
    b.inputs["Specular IOR Level"].default_value = 0.38
    b.inputs["Subsurface Weight"].default_value = 1.0
    b.inputs["Subsurface Radius"].default_value = (1.0, 0.5, 0.34)
    b.inputs["Subsurface Scale"].default_value = 0.004
    try:
        b.subsurface_method = "RANDOM_WALK"
    except Exception:
        pass
    # pores, and lines that deepen with age
    n2 = nt.nodes.new("ShaderNodeTexVoronoi")
    n2.feature = "DISTANCE_TO_EDGE"
    n2.inputs["Scale"].default_value = 480
    lk(tc.outputs["Object"], n2.inputs["Vector"])
    cl = nt.nodes.new("ShaderNodeMath")
    cl.operation = "MINIMUM"
    cl.inputs[1].default_value = 0.12
    lk(n2.outputs["Distance"], cl.inputs[0])
    n3 = nt.nodes.new("ShaderNodeTexNoise")
    n3.inputs["Scale"].default_value = 90
    n3.inputs["Detail"].default_value = 4
    lk(tc.outputs["Object"], n3.inputs["Vector"])
    add = nt.nodes.new("ShaderNodeMath")
    add.operation = "MULTIPLY_ADD"
    lk(cl.outputs[0], add.inputs[0])
    add.inputs[1].default_value = 2.0
    sc3 = nt.nodes.new("ShaderNodeMath")
    sc3.operation = "MULTIPLY"
    sc3.inputs[1].default_value = 0.3 + 0.5 * min(1, max(0, (age - 30) / 35))
    lk(n3.outputs["Fac"], sc3.inputs[0])
    lk(sc3.outputs[0], add.inputs[2])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.00025
    lk(add.outputs[0], bump.inputs["Height"])
    lk(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_flat(name, col, rough=0.6, spec=0.5, coat=0.0, sss=0.0, alpha=1.0, trans=0.0, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*(srgb(col) if isinstance(col, str) else col), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Specular IOR Level"].default_value = spec
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.03
    b.inputs["Metallic"].default_value = metal
    b.inputs["Transmission Weight"].default_value = trans
    if sss:
        b.inputs["Subsurface Weight"].default_value = sss
        b.inputs["Subsurface Scale"].default_value = 0.003
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
    return m


def mat_eye(iris):
    m = bpy.data.materials.new("Eye")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    lk = nt.links.new
    uv = nt.nodes.new("ShaderNodeUVMap")
    uv.uv_map = "eyeuv"
    sub = nt.nodes.new("ShaderNodeVectorMath")
    sub.operation = "DISTANCE"
    sub.inputs[1].default_value = (0.5, 0.5, 0)
    lk(uv.outputs[0], sub.inputs[0])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    R = 40.0
    els = ramp.color_ramp.elements
    els[0].position = 0.0
    els[0].color = (0.004, 0.003, 0.003, 1)
    els[1].position = 0.0023 * R
    els[1].color = (0.004, 0.003, 0.003, 1)
    ic = srgb(iris)
    for pos_, col_ in ((0.0027 * R, tuple(x * 1.5 for x in ic)), (0.0052 * R, ic), (0.0058 * R, tuple(x * 0.3 for x in ic)), (0.0062 * R, (0.62, 0.58, 0.55)), (0.02 * R, (0.52, 0.42, 0.40))):
        e = els.new(pos_)
        e.color = (*col_, 1)
    lk(sub.outputs["Value"], ramp.inputs["Fac"])
    lk(ramp.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.08
    b.inputs["Coat Weight"].default_value = 1.0
    b.inputs["Coat Roughness"].default_value = 0.02
    return m


def mat_cloth(name, col, weave=1500, rough=0.85):
    m = mat_flat(name, col, rough=rough, spec=0.3)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Sheen Weight"].default_value = 0.25
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wv = nt.nodes.new("ShaderNodeTexNoise")
    wv.inputs["Scale"].default_value = weave
    wv.inputs["Detail"].default_value = 2
    nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.4
    bump.inputs["Distance"].default_value = 0.0003
    nt.links.new(wv.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_suit(tex, main, shirt, tie, open_collar):
    """The suit's own picture, recoloured by the game's rule (human.ts patchHuman, out.suit):
    coloured pixels are the tie, light ones the shirt, dark ones the cloth."""
    m = bpy.data.materials.new("Suit")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    lk = nt.links.new
    ti = nt.nodes.new("ShaderNodeTexImage")
    ti.image = tex
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    sep.mode = "HSV"
    lk(ti.outputs["Color"], sep.inputs[0])

    def scaled(col, div, lo, hi):
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value = lo * div
        mr.inputs["From Max"].default_value = hi * div
        mr.inputs["To Min"].default_value = lo
        mr.inputs["To Max"].default_value = hi
        lk(sep.outputs[2], mr.inputs["Value"])
        mu = nt.nodes.new("ShaderNodeVectorMath")
        mu.operation = "SCALE"
        mu.inputs[0].default_value = srgb(col)
        lk(mr.outputs["Result"], mu.inputs["Scale"])
        return mu.outputs[0]

    cloth = scaled(main, 0.13, 0.45, 1.6)
    sh = scaled(shirt, 0.8, 0.5, 1.15)
    ti_c = scaled(shirt if open_collar else tie, 0.3, 0.4, 1.4)
    is_light = nt.nodes.new("ShaderNodeMath")
    is_light.operation = "GREATER_THAN"
    is_light.inputs[1].default_value = 0.45
    lk(sep.outputs[2], is_light.inputs[0])
    is_tie = nt.nodes.new("ShaderNodeMath")
    is_tie.operation = "GREATER_THAN"
    is_tie.inputs[1].default_value = 0.3
    lk(sep.outputs[1], is_tie.inputs[0])
    m1 = nt.nodes.new("ShaderNodeMix")
    m1.data_type = "RGBA"
    lk(is_light.outputs[0], m1.inputs["Factor"])
    lk(cloth, m1.inputs["A"])
    lk(sh, m1.inputs["B"])
    m2 = nt.nodes.new("ShaderNodeMix")
    m2.data_type = "RGBA"
    lk(is_tie.outputs[0], m2.inputs["Factor"])
    lk(m1.outputs["Result"], m2.inputs["A"])
    lk(ti_c, m2.inputs["B"])
    lk(m2.outputs["Result"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.8
    b.inputs["Sheen Weight"].default_value = 0.3
    b.inputs["Specular IOR Level"].default_value = 0.3
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wv = nt.nodes.new("ShaderNodeTexNoise")
    wv.inputs["Scale"].default_value = 1600
    wv.inputs["Detail"].default_value = 2
    lk(tc.outputs["Object"], wv.inputs["Vector"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    bump.inputs["Distance"].default_value = 0.0003
    lk(wv.outputs["Fac"], bump.inputs["Height"])
    lk(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_hair(name, tex, col):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    lk = nt.links.new
    ti = nt.nodes.new("ShaderNodeTexImage")
    ti.image = tex
    bw = nt.nodes.new("ShaderNodeRGBToBW")
    lk(ti.outputs["Color"], bw.inputs[0])
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.0
    mr.inputs["From Max"].default_value = 0.25
    mr.inputs["To Min"].default_value = 0.45
    mr.inputs["To Max"].default_value = 1.7
    lk(bw.outputs[0], mr.inputs["Value"])
    mu = nt.nodes.new("ShaderNodeVectorMath")
    mu.operation = "SCALE"
    mu.inputs[0].default_value = col
    lk(mr.outputs["Result"], mu.inputs["Scale"])
    lk(mu.outputs[0], b.inputs["Base Color"])
    lk(ti.outputs["Alpha"], b.inputs["Alpha"])
    b.inputs["Roughness"].default_value = 0.42
    b.inputs["Specular IOR Level"].default_value = 0.4
    m.blend_method = "HASHED"
    return m


def hair_colour(hexcol, grey):
    h = hexcol.lstrip("#")
    a = np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])
    g = np.array([0.74, 0.73, 0.71])
    return srgb(tuple(a + (g - a) * grey))


# ------------------------------------------------------------- build a person
def make_person(tag, spec):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=STRIPPED)
    new = [o for o in bpy.data.objects if o not in before]
    arm = [o for o in new if o.type == "ARMATURE"][0]
    meshes = []
    for o in new:
        if o.type != "MESH":
            continue
        if o.name.startswith("Body"):
            meshes.append(o)
        else:
            bpy.data.objects.remove(o)

    wsh = shape_weights(spec)
    nb = HM["bodyVerts"]
    D = np.zeros((nb, 3))
    for k, v in wsh.items():
        if v and k in SHAPES:
            D += SHAPES[k] * v
    want_names = parts_for(spec)
    want = {PARTS.index(n) for n in want_names if n in PARTS}
    delbits = 0
    for i, nm in enumerate(HM.get("deleteParts", [])):
        if nm in want_names:
            delbits |= 1 << i

    hcol = hair_colour(spec.get("hairColour", "#2a1a12"), spec.get("grey", 0))
    c = spec.get("colours", {})
    kept = []
    for ob in meshes:
        src = ob.name.split(".0")[0]
        gname = "Body.body" if src == "Body" else src
        d = MESHES[gname]
        me = ob.data
        n = len(me.vertices)
        assert n == len(d["POSITION"]), (gname, n, len(d["POSITION"]))
        part = d["_PART"][:, 0].astype(int)
        zone = d["_ZONE"][:, 0]
        anc = d["_ANCHOR"].astype(int)
        aw = d["_ANCHORW"].astype(np.float64)
        dv = (D[anc] * aw[:, :, None]).sum(axis=1)            # glTF space (x right, y up, z front)
        dw = np.stack([dv[:, 0], -dv[:, 2], dv[:, 1]], axis=1)  # Blender world
        Mi = np.array(ob.matrix_world.to_3x3().inverted())
        co = np.empty(n * 3)
        me.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3) + dw @ Mi.T
        me.vertices.foreach_set("co", co.ravel())
        dl = d["_DEL"][:, 0].astype(int) if "_DEL" in d else np.zeros(n, int)
        # the picture this slot came with
        tex = None
        if me.materials and me.materials[0] and me.materials[0].use_nodes:
            for nd in me.materials[0].node_tree.nodes:
                if nd.type == "TEX_IMAGE":
                    tex = nd.image
        if gname == "Body.body":
            # the iris is painted from where each point of the eyeball sits (as the game's shader does)
            J = EXTRAS["joints"]
            eyes = []
            for nm in ("eyeL", "eyeR"):
                e = np.array(J[nm], dtype=float)
                for sh in HM["shapes"]:
                    k_ = wsh.get(sh["name"], 0)
                    if k_ and nm in sh["joints"]:
                        e += np.array(sh["joints"][nm]) * k_
                eyes.append(e)
            Mw = np.array(ob.matrix_world)
            wco = co @ Mw[:3, :3].T + Mw[:3, 3]
            gl = np.stack([wco[:, 0], wco[:, 2], -wco[:, 1]], axis=1)
            uvl = me.uv_layers.new(name="eyeuv")
            for lp in me.loops:
                g_ = gl[lp.vertex_index]
                e = eyes[0] if g_[0] > 0 else eyes[1]
                front = 1.0 if g_[2] > e[2] - 0.004 else 9.0
                uvl.data[lp.index].uv = ((g_[0] - e[0]) * 40 * front + 0.5, (g_[1] - e[1]) * 40 * front + 0.5)
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.verts.ensure_lookup_table()
        kill = []
        fpart = {}
        for f in bm.faces:
            vi = [v.index for v in f.verts]
            p0 = part[vi[0]]
            if p0 not in want or (delbits and (dl[vi[0]] | dl[vi[1]] | dl[vi[2]]) & delbits):
                kill.append(f)
            else:
                fpart[f] = (PARTS[p0], int(round(float(zone[vi[0]]))))
        mats, slot = [], {}

        def use(key, make):
            if key not in slot:
                slot[key] = len(mats)
                mats.append(make())
            return slot[key]

        for f, (pn, z) in fpart.items():
            if gname == "Body.skin":
                f.material_index = use("skin", lambda: mat_skin(spec.get("skin", "#c58a66"), tex, spec.get("age", 30)))
            elif gname == "Body.suit":
                f.material_index = use("suit", lambda: mat_suit(tex, c.get("main", "#1f2a44"), c.get("second", "#f4f4f2"), c.get("accent", "#7a1626"), spec.get("outfit") == "suitOpen"))
            elif gname.startswith("Body.hair") or gname == "Body.brows":
                f.material_index = use("hair", lambda: mat_hair("Hair", tex, hcol))
            elif gname.startswith("Body.shoes"):
                f.material_index = use("shoe", lambda: mat_flat("Shoe", c.get("shoes", "#16110e"), rough=0.3, coat=0.4))
            elif pn == "eyes":
                f.material_index = use("eye", lambda: mat_eye(spec.get("eyes_col", "#4a3020")))
            elif pn.startswith("teeth"):
                f.material_index = use("teeth", lambda: mat_flat("Teeth", (0.7, 0.66, 0.58), rough=0.3))
            elif pn.startswith("hair.") or pn == "brows":
                f.material_index = use("hairm", lambda: mat_flat("HairMesh", hcol, rough=0.55))
            elif pn == "out.glasses":
                f.material_index = use("glasses", lambda: mat_flat("Frames", c.get("frames", "#1c1c1f"), rough=0.25, coat=0.5))
            else:
                f.material_index = use("cloth", lambda: mat_cloth("Cloth", c.get("main", "#1f2a44")))
        bmesh.ops.delete(bm, geom=kill, context="FACES")
        loose = [v for v in bm.verts if not v.link_faces]
        bmesh.ops.delete(bm, geom=loose, context="VERTS")
        if not bm.faces:
            bm.free()
            bpy.data.objects.remove(ob)
            continue
        bm.to_mesh(me)
        bm.free()
        me.materials.clear()
        for m_ in mats:
            me.materials.append(m_)
        for p in me.polygons:
            p.use_smooth = True
        for md in ob.modifiers:
            if md.type == "ARMATURE":
                md.use_deform_preserve_volume = True
        ob.name = f"{tag}:{gname}"
        kept.append(ob)
    arm.name = f"{tag}:Armature"
    return {"arm": arm, "meshes": kept, "spec": spec, "tag": tag}


# ------------------------------------------------------------------- posing
def upd():
    bpy.context.view_layer.update()


def jpos(P, name):
    arm = P["arm"]
    return (arm.matrix_world @ arm.pose.bones[name].matrix).translation.copy()


def turn(P, name, axis, deg, pivot=None):
    arm = P["arm"]
    pb = arm.pose.bones[name]
    Mw = arm.matrix_world @ pb.matrix
    pv = Mw.translation.copy() if pivot is None else Vector(pivot)
    R = Matrix.Rotation(math.radians(deg), 4, Vector(axis).normalized())
    pb.matrix = arm.matrix_world.inverted() @ (Matrix.Translation(pv) @ R @ Matrix.Translation(-pv) @ Mw)
    upd()


def aim(P, name, child, target, frac=1.0):
    cur = (jpos(P, child) - jpos(P, name)).normalized()
    target = Vector(target).normalized()
    ax = cur.cross(target)
    if ax.length < 1e-8:
        return
    turn(P, name, ax, math.degrees(cur.angle(target)) * frac)


def pose_from_clip(P, clip, t):
    """Hold the game's own clip at second t, then free the bones so they can be adjusted."""
    arm = P["arm"]
    act = next((a for a in bpy.data.actions if a.name.split(".0")[0] in (clip, clip + "_Armature")), None)
    if act is None:
        raise SystemExit(f"no clip {clip}: {[a.name for a in bpy.data.actions][:12]}")
    arm.animation_data_create()
    arm.animation_data.action = act
    scn_ = bpy.context.scene
    scn_.frame_set(int(round(t * scn_.render.fps)))
    upd()
    order = []

    def walk(b):
        order.append(b.name)
        for c_ in b.children:
            walk(c_)
    for b in arm.data.bones:
        if b.parent is None:
            walk(b)
    held = {n: arm.pose.bones[n].matrix.copy() for n in order}
    arm.animation_data_clear()
    for n in order:
        arm.pose.bones[n].matrix = held[n]
        upd()


def palm_normal(P, side):
    f = (jpos(P, f"{side}HandMiddle1") - jpos(P, f"{side}Hand")).normalized()
    a = jpos(P, f"{side}HandIndex1") - jpos(P, f"{side}HandLittle1")
    a = (a - f * a.dot(f)).normalized()
    n = a.cross(f)
    return (n if side == "Right" else -n), f, a


def curl(P, side, degs=(18, 22, 14)):
    """Close each finger joint a little. The way that brings the fingertip nearer the wrist is the closing way."""
    arm = P["arm"]
    wrist = jpos(P, f"{side}Hand")
    for fg in ("Index", "Middle", "Ring", "Little"):
        tipb = arm.pose.bones[f"{side}Hand{fg}3"]
        for j in (1, 2, 3):
            _, f, a = palm_normal(P, side)
            d = degs[j - 1] * (1.15 if fg in ("Ring", "Little") else 1)
            before = ((arm.matrix_world @ tipb.tail) - wrist).length
            turn(P, f"{side}Hand{fg}{j}", a, d)
            if ((arm.matrix_world @ tipb.tail) - wrist).length > before:
                turn(P, f"{side}Hand{fg}{j}", a, -2 * d)


def world_points(obs):
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for ob in obs:
        oe = ob.evaluated_get(dg)
        me = oe.to_mesh()
        co = np.empty(len(me.vertices) * 3)
        me.vertices.foreach_get("co", co)
        oe.to_mesh_clear()
        M = np.array(oe.matrix_world)
        out.append(co.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3])
    return out


def stand_relaxed(P, t=1.0):
    """The game's standing clip, the arms brought down to the sides; then the check: if a hand or
    arm cuts the leg or the trunk on THIS build, the arms are let out a little and it is tried again."""
    tries = []
    for out in (0.13, 0.17, 0.21, 0.25, 0.30):
        pose_from_clip(P, "boss-idle", t)
        for side, sx in (("Left", 1), ("Right", -1)):
            aim(P, f"{side}Arm", f"{side}ForeArm", (sx * out, 0.02, -1), frac=0.7)
            aim(P, f"{side}ForeArm", f"{side}Hand", (sx * (out - 0.08), -0.16, -1), frac=0.6)
            curl(P, side, (14, 18, 10))
        c_ = crossings(P)
        tries.append({"arms_out": out, "crossing_faces": sum(c_.values())})
        if not c_:
            break
    return tries


def face_front(P):
    """Stand or seat the man at the origin, facing the camera side (-Y), whatever way the clip left him."""
    arm = P["arm"]
    l, r = jpos(P, "LeftUpLeg"), jpos(P, "RightUpLeg")
    across = (l - r)
    ang = math.atan2(across.y, across.x)          # his left should be +X
    arm.matrix_world = Matrix.Rotation(-ang, 4, "Z") @ arm.matrix_world
    upd()
    h = jpos(P, "Hips")
    arm.matrix_world = Matrix.Translation((-h.x, -h.y, 0)) @ arm.matrix_world
    upd()


def reach(P, side, target, pole):
    """Two-bone arm: put the wrist on target, the elbow towards pole."""
    S = jpos(P, f"{side}Arm")
    L1 = (jpos(P, f"{side}ForeArm") - S).length
    L2 = (jpos(P, f"{side}Hand") - jpos(P, f"{side}ForeArm")).length
    T = Vector(target)
    d = min((T - S).length, L1 + L2 - 0.004)
    dirn = (T - S).normalized()
    a_ = (L1 * L1 - L2 * L2 + d * d) / (2 * d)
    h = math.sqrt(max(L1 * L1 - a_ * a_, 0))
    pl = Vector(pole)
    pl = (pl - dirn * pl.dot(dirn)).normalized()
    elbow = S + dirn * a_ + pl * h
    aim(P, f"{side}Arm", f"{side}ForeArm", elbow - S)
    aim(P, f"{side}ForeArm", f"{side}Hand", S + dirn * d - jpos(P, f"{side}ForeArm"))


DESK_TOP = 0.745


def wrist_report(P):
    """How far each wrist is bent (forearm against hand), degrees."""
    out = {}
    for side in ("Left", "Right"):
        fa = (jpos(P, f"{side}Hand") - jpos(P, f"{side}ForeArm")).normalized()
        hd = (jpos(P, f"{side}HandMiddle1") - jpos(P, f"{side}Hand")).normalized()
        out[side] = round(math.degrees(fa.angle(hd)), 1)
    return out


def sit_at_desk(P, t=1.0, fwd=0.40, spread=0.17, lift=None):
    """The game's seated clip for the body and legs; the hands are then laid on the desk here.
    REVIEW_FIX=1 is the corrected version (Harry, 20 Nov 2026: "the legs are pushing into the body a bit
    and the hands/wrists/arms are super weird"):
      - hips: he sits a little back and his knees a little lower than his hips, so the hip is not folded
        past what the skin can do (the thigh no longer runs into the belly and the jacket);
      - arms: elbows hang down by his sides, not out like wings;
      - wrists: no forced palm-down twist. The forearm turns only as far as a real forearm rests on a
        desk (half turned, thumb side up and in), spread along the forearm, and the wrist stays straight;
      - fingers: the game's own relaxed curl (cutscene/hands.ts `relaxed`)."""
    fix = os.environ.get("REVIEW_FIX") == "1"
    pose_from_clip(P, os.environ.get("REVIEW_SIT", "boss-sit"), t)
    face_front(P)
    arm_ = P["arm"]
    if fix:
        turn(P, "Hips", (1, 0, 0), -7)                       # sit back
        for side in ("Left", "Right"):
            turn(P, f"{side}UpLeg", (1, 0, 0), 16)           # knees lower than the hips
            turn(P, f"{side}Leg", (1, 0, 0), -9)             # shins back to upright
            kn = jpos(P, f"{side}Leg")
            hp = jpos(P, f"{side}UpLeg")
            sx = 1 if side == "Left" else -1
            if abs(kn.x - hp.x) > 0.07:                      # knees in from the wide splay
                turn(P, f"{side}UpLeg", (0, 0, 1), sx * 9)
    low = min(jpos(P, "LeftFoot").z, jpos(P, "RightFoot").z)
    arm_.matrix_world = Matrix.Translation((0, 0, 0.10 - low)) @ arm_.matrix_world
    upd()
    for b_, d_ in ((("Spine", 9), ("Spine01", 5), ("neck", -6)) if fix else (("Spine", 5), ("Spine01", 4), ("neck", -6))):
        turn(P, b_, (1, 0, 0), d_)
    twist = {}
    for side, sx in (("Left", 1), ("Right", -1)):
        sh = jpos(P, f"{side}Arm")
        if not fix:
            reach(P, side, (sx * spread, sh.y - fwd, DESK_TOP + 0.035), (sx * 0.9, 0.35, -0.5))
            tw = 0.0
            for _ in range(3):   # lay the palm down: half the twist in the forearm, half in the wrist
                n, f, a = palm_normal(P, side)
                fa = (jpos(P, f"{side}Hand") - jpos(P, f"{side}ForeArm")).normalized()
                down = Vector((0, 0, -1))
                dproj = (down - fa * down.dot(fa)).normalized()
                nproj = (n - fa * n.dot(fa)).normalized()
                ang = math.degrees(nproj.angle(dproj)) * (1 if nproj.cross(dproj).dot(fa) > 0 else -1)
                turn(P, f"{side}ForeArm", fa, ang * 0.5)
                turn(P, f"{side}Hand", fa, ang * 0.5)
                tw += ang
            twist[side] = round(tw, 1)
            aim(P, f"{side}Hand", f"{side}HandMiddle1", Vector((-sx * 0.45, -1, -0.03)))
            n, f, a = palm_normal(P, side)
            down = Vector((0, 0, -1))
            dproj = (down - f * down.dot(f)).normalized()
            nproj = (n - f * n.dot(f)).normalized()
            turn(P, f"{side}Hand", f, math.degrees(nproj.angle(dproj)) * (1 if nproj.cross(dproj).dot(f) > 0 else -1))
            curl(P, side, (8, 14, 10))
        else:
            reach(P, side, (sx * 0.15, sh.y - 0.33, DESK_TOP + 0.045 + (lift or {}).get(side, 0.0)), (sx * 0.25, 0.45, -1))
            # the palm wants to face down and in (half turned): turn the forearm at most 40 degrees towards
            # that, none of it at the wrist, so nothing is wrung
            n, f, a = palm_normal(P, side)
            fa = (jpos(P, f"{side}Hand") - jpos(P, f"{side}ForeArm")).normalized()
            want = Vector((-sx * 0.55, 0, -1)).normalized()
            dproj = (want - fa * want.dot(fa)).normalized()
            nproj = (n - fa * n.dot(fa)).normalized()
            ang = math.degrees(nproj.angle(dproj)) * (1 if nproj.cross(dproj).dot(fa) > 0 else -1)
            ang = max(-40, min(40, ang))
            turn(P, f"{side}ForeArm", fa, ang)
            twist[side] = round(ang, 1)
            # the hand in line with the forearm, dropped a touch onto the desk
            fa = (jpos(P, f"{side}Hand") - jpos(P, f"{side}ForeArm")).normalized()
            aim(P, f"{side}Hand", f"{side}HandMiddle1", (fa + Vector((-sx * 0.12, 0, -0.10))).normalized())
            curl(P, side, (12, 19, 11))
    P["twist"] = twist


# ------------------------------------------------------------- the three men
PEOPLE = {
    # the old hand: 58, fair, grey and receding, heavy, navy suit and a club tie, glasses
    "a": dict(age=60, build=0.55, belly=0.6, muscle=-0.4, neck=0.5, shoulders=0.1, skin="#e3b594", hair="none", hairColour="#5a4a3a", grey=0.85,
              facialHair="none", glasses=True, outfit="suit", eyes_col="#5a6a78",
              face=dict(jaw=0.5, chin=0.2, cheeks=0.6, nose=0.6, round=0.6, lips=-0.3, eyes=-0.2), heritage=dict(caucasian=1.0, african=0.0, asian=0.05),
              colours=dict(main="#1b2742", second="#f4f4f2", accent="#8a1626", frames="#2a2a2e")),
    # the young coach: 41, dark skin, cropped hair, lean and fit, charcoal suit, open collar
    "b": dict(age=41, build=-0.35, muscle=0.5, shoulders=0.4, neck=0.2, skin="#6b4226", hair="crop", hairColour="#120c09", grey=0.08,
              facialHair="none", outfit="suitOpen", eyes_col="#2a1a10",
              face=dict(jaw=-0.2, chin=0.3, cheeks=-0.3, nose=0.3, long=0.5, lips=0.5, eyes=0.2), heritage=dict(african=1.0, caucasian=0.1, asian=0.0),
              colours=dict(main="#2e3138", second="#e9edf2", accent="#e9edf2")),
    # the tactician: 50, olive skin, dark hair swept back and greying, average build, brown suit
    "c": dict(age=50, build=0.05, muscle=-0.1, belly=0.15, shoulders=-0.2, skin="#c08a62", hair="side", hairColour="#1a120c", grey=0.35,
              facialHair="none", outfit="suit", eyes_col="#3a2616",
              face=dict(jaw=0.7, chin=-0.4, cheeks=0.1, nose=-0.5, square=0.7, long=-0.2, lips=-0.1, eyes=-0.4), heritage=dict(asian=0.55, caucasian=0.45, african=0.0),
              colours=dict(main="#4a3a2c", second="#f2ece0", accent="#2d5a3a")),
}


# ------------------------------------------------------------------ the sets
def box(name, c, s, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c)
    ob = bpy.context.object
    ob.name = name
    ob.scale = s
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        md = ob.modifiers.new("b", "BEVEL")
        md.width = bevel
        md.segments = 3
    ob.data.materials.append(mat)
    return ob


def area(name, loc, energy, size, color=(1, 1, 1), aim_at=(0, 0, 0), size_y=None):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.shape = "RECTANGLE"
    ld.size = size
    ld.size_y = size_y or size
    ld.color = color
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(aim_at) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    ob.visible_camera = False
    return ob


def camera(loc, target, lens=50, fstop=None):
    scn = bpy.context.scene
    cd = bpy.data.cameras.new("Cam")
    cd.lens = lens
    cd.clip_start = 0.01
    cam = bpy.data.objects.new("Cam", cd)
    scn.collection.objects.link(cam)
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    if fstop:
        cd.dof.use_dof = True
        cd.dof.focus_distance = (Vector(target) - Vector(loc)).length
        cd.dof.aperture_fstop = fstop
    scn.camera = cam
    return cam


def wood(name, base, dark, scale=6):
    m = mat_flat(name, base, rough=0.5, coat=0.12)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale * 0.12, scale * 3, scale * 3)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 3
    nz.inputs["Detail"].default_value = 6
    nz.inputs["Distortion"].default_value = 1.2
    nt.links.new(mp.outputs[0], nz.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (*srgb(dark), 1)
    ramp.color_ramp.elements[1].position = 0.7
    ramp.color_ramp.elements[1].color = (*srgb(base), 1)
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    return m


def setup(samples):
    scn = bpy.context.scene
    scn.render.engine = "CYCLES"
    scn.cycles.device = "CPU"
    scn.cycles.samples = samples
    scn.cycles.use_denoising = False   # this Blender build has no denoiser
    scn.cycles.use_adaptive_sampling = True
    scn.cycles.adaptive_threshold = 0.012
    scn.cycles.max_bounces = 6
    scn.cycles.diffuse_bounces = 3
    scn.cycles.filter_width = 1.5
    scn.cycles.sample_clamp_indirect = 4
    scn.render.resolution_x, scn.render.resolution_y = W, H
    scn.render.threads_mode = "FIXED"
    scn.render.threads = int(os.environ.get("THREADS", "4"))
    scn.view_settings.view_transform = "Filmic"
    scn.view_settings.look = "Medium High Contrast"
    scn.render.image_settings.file_format = "PNG"
    w = bpy.data.worlds.new("W")
    scn.world = w
    w.use_nodes = True
    return scn


def crossings(P):
    """Faces of one body part that cut another part of the same man (hand through thigh, arm through chest)."""
    groups = {}
    for ob in P["meshes"]:
        if not ob.name.endswith("Body.skin") and not ob.name.endswith("Body.suit"):
            continue
        pts = world_points([ob])[0]
        me = ob.data
        vg = {g.index: g.name for g in ob.vertex_groups}
        dom = []
        for v in me.vertices:
            b = max(v.groups, key=lambda g: g.weight) if v.groups else None
            nm = vg[b.group] if b else ""
            dom.append("L.arm" if nm.startswith("Left") and ("Arm" in nm or "Hand" in nm) else "R.arm" if nm.startswith("Right") and ("Arm" in nm or "Hand" in nm)
                       else "L.leg" if nm.startswith("Left") else "R.leg" if nm.startswith("Right") else "trunk")
        for p in me.polygons:
            ds = {dom[i] for i in p.vertices}
            if len(ds) == 1:
                groups.setdefault(ds.pop(), []).append([tuple(pts[i]) for i in p.vertices])
    trees = {}
    for k, polys in groups.items():
        vs, fs = [], []
        for poly in polys:
            fs.append(tuple(range(len(vs), len(vs) + len(poly))))
            vs.extend(poly)
        trees[k] = BVHTree.FromPolygons(vs, fs)
    out = {}
    ks = sorted(trees)
    for i, a in enumerate(ks):
        for b in ks[i + 1:]:
            if {a, b} in ({"L.arm", "trunk"}, {"R.arm", "trunk"}, {"L.leg", "trunk"}, {"R.leg", "trunk"}):
                # neighbours share a seam (shoulder, hip): count only pairs well away from it
                continue
            n = len(trees[a].overlap(trees[b]))
            if n:
                out[f"{a}|{b}"] = n
    return out


def lap_crossing(P, zone=0.13):
    """Seated: faces of a thigh that cut the trunk (belly, jacket hem, seat), away from the hip fold itself.
    Faces within `zone` metres of the hip joint are the fold and are not counted (as the repo's check does)."""
    out = {}
    for side in ("Left", "Right"):
        hip = np.array(jpos(P, f"{side}UpLeg"))
        legs, trunk = [], []
        for ob in P["meshes"]:
            if not (ob.name.endswith("Body.skin") or ob.name.endswith("Body.suit")):
                continue
            pts = world_points([ob])[0]
            vg = {g.index: g.name for g in ob.vertex_groups}
            dom = []
            for v in ob.data.vertices:
                b = max(v.groups, key=lambda g: g.weight) if v.groups else None
                dom.append(vg[b.group] if b else "")
            for p in ob.data.polygons:
                names = {dom[i] for i in p.vertices}
                tri = [tuple(pts[i]) for i in p.vertices]
                c = np.mean(np.array(tri), axis=0)
                if np.linalg.norm(c - hip) < zone:
                    continue
                if names <= {f"{side}UpLeg", f"{side}Leg"}:
                    legs.append(tri)
                elif all(not n.startswith("Left") and not n.startswith("Right") for n in names):
                    trunk.append(tri)

        def tree(polys):
            vs, fs = [], []
            for poly in polys:
                fs.append(tuple(range(len(vs), len(vs) + len(poly))))
                vs.extend(poly)
            return BVHTree.FromPolygons(vs, fs)
        out[side] = len(tree(legs).overlap(tree(trunk))) if legs and trunk else 0
    return out


def hand_low(P, side):
    """The lowest point of one hand (m)."""
    lo = 9.0
    for ob in P["meshes"]:
        if not ob.name.endswith("Body.skin"):
            continue
        pts = world_points([ob])[0]
        vg = {g.index: g.name for g in ob.vertex_groups}
        for v in ob.data.vertices:
            b = max(v.groups, key=lambda g: g.weight) if v.groups else None
            if b and vg[b.group].startswith(f"{side}Hand"):
                lo = min(lo, pts[v.index][2])
    return lo


FIX = os.environ.get("REVIEW_FIX") == "1"
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = setup(SAMPLES)
check = {}

if MODE == "hairs":
    for i, hs in enumerate(WHO.split(",")):
        PEOPLE[f"h{i}"] = dict(PEOPLE["c"], hair=hs, grey=0.3 * (i % 2), glasses=False)
    WHO = ",".join(f"h{i}" for i in range(len(WHO.split(","))))
    MODE = "faces"
if MODE in ("lineup", "faces"):
    order = ["a", "b", "c"] if WHO in ("a", "all") else WHO.split(",")
    gap = 0.74 if MODE == "lineup" else 0.42
    people = []
    for i, k in enumerate(order):
        P = make_person(k, PEOPLE[k])
        P["arm"].location.x = (i - (len(order) - 1) / 2) * gap
        upd()
        tries = stand_relaxed(P)
        if MODE == "lineup" and len(order) == 3:
            turn(P, "Hips", (0, 0, 1), (8, 0, -8)[i])
        people.append(P)
        check[k] = {"tries": tries, "left": crossings(P)}
    floor = box("Floor", (0, 0, -0.01), (12, 12, 0.02), mat_flat("Floor", "#3a3d44", rough=0.6))
    wall = box("Wall", (0, 1.6, 2), (12, 0.05, 6), mat_flat("Wall", "#59606b", rough=0.9))
    bg = scn.world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.5, 0.55, 0.65, 1)
    bg.inputs["Strength"].default_value = 0.35
    tgt = (0, 0, 1.0) if MODE == "lineup" else (0, 0, 1.6)
    area("Key", (-1.6, -2.4, 2.6), 120, 1.6, (1.0, 0.96, 0.9), tgt)
    area("Fill", (2.4, -1.8, 1.4), 45, 1.8, (0.85, 0.9, 1.0), tgt)
    area("Rim", (1.2, 1.2, 2.4), 120, 0.8, (0.9, 0.95, 1.0), tgt)
    if MODE == "lineup":
        camera((0, -4.0, 1.38), (0, 0, 1.2), lens=62)
    else:
        camera((0, -2.3 * max(1, len(order) / 3), 1.68), (0, 0, 1.64), lens=75)
else:
    P = make_person("m", PEOPLE[WHO if WHO in PEOPLE else "a"])
    sit_at_desk(P)
    upd()
    if FIX:
        # both hands down onto the same desk: measure where each hand's lowest point came out, pose again
        lift = {"Left": 0.0, "Right": 0.0}
        for _ in range(4):
            lows = {sd: hand_low(P, sd) for sd in ("Left", "Right")}
            base = min(lows.values())
            if max(lows.values()) - base < 0.0008:
                break
            for sd in lows:
                lift[sd] += base - lows[sd]
            sit_at_desk(P, lift=lift)
            upd()
    arms = np.vstack(world_points([o for o in P["meshes"] if o.name.endswith("Body.skin") or o.name.endswith("Body.suit")]))
    over = arms[(arms[:, 1] < -0.30) & (arms[:, 2] > 0.70)]
    top = float(over[:, 2].min()) - 0.0015
    wl, wr = jpos(P, "LeftHand"), jpos(P, "RightHand")
    check["desk_top_m"] = round(top, 3)
    for nm, w_ in (("left", wl), ("right", wr)):
        hp = over[(np.linalg.norm(over[:, :2] - np.array([w_.x, w_.y]), axis=1) < 0.2)]
        check[f"{nm}_hand_lowest_point_above_desk_mm"] = round((float(hp[:, 2].min()) - top) * 1000, 1) if len(hp) else None
    if FIX:
        # a smoothing pass after the bones that keeps the rest shape's detail: it rounds out the folds a
        # bent joint leaves (in the game this would be baked as a corrective shape per pose, not run live)
        for ob in P["meshes"]:
            if ob.name.endswith("Body.suit"):   # cloth only: the skin's picture seams would open
                md = ob.modifiers.new("fold", "CORRECTIVE_SMOOTH")
                md.factor = 0.5
                md.iterations = 8
                md.rest_source = "ORCO"
    check["crossings"] = crossings(P)
    check["thigh_faces_cutting_trunk"] = lap_crossing(P)
    check["forearm_twist_deg"] = P.get("twist")
    check["wrist_bend_deg"] = wrist_report(P)
    oak = wood("Oak", "#6b4226", "#3d2413")
    box("Desk", (0, -1.10, top - 0.025), (2.4, 1.6, 0.05), oak, bevel=0.006)
    paper = box("Paper", (0.0, -0.86, top + 0.001), (0.21, 0.297, 0.001), mat_flat("Paper", "#f3f1ea", rough=0.7))
    for k in range(9):
        box(f"Line{k}", (0.0, -0.76 - k * 0.022, top + 0.0018), (0.15 if k % 4 else 0.09, 0.004, 0.0004), mat_flat("Ink", "#3a3a40", rough=0.8))
    pen = box("Pen", (0.17, -0.90, top + 0.006), (0.011, 0.14, 0.011), mat_flat("Pen", "#0c0c10", rough=0.2, coat=1), bevel=0.004)
    pen.rotation_euler.z = math.radians(-18)
    box("Plate", (-0.52, -0.5, top + 0.03), (0.26, 0.05, 0.06), mat_flat("Brass", (0.75, 0.55, 0.22), rough=0.3, metal=1), bevel=0.004)
    leather = mat_flat("Leather", "#2a1c14", rough=0.45, coat=0.15)
    box("ChairBack", (0, 0.2, 0.86), (0.62, 0.1, 0.95), leather, bevel=0.05)
    panel = wood("Panel", "#4a3222", "#2c1c12", scale=3)
    box("Wall", (0, 1.5, 1.5), (7, 0.06, 3.2), panel)
    box("Floor", (0, 0, -0.01), (7, 7, 0.02), mat_flat("Carpet", "#2c3038", rough=0.95))
    for k in range(-5, 6):
        box(f"Bat{k}", (k * 0.62 + 0.31, 1.46, 1.5), (0.03, 0.03, 3.2), panel)
    # a window to one side: the daylight the scene is lit by
    wm = bpy.data.materials.new("Window")
    wm.use_nodes = True
    em = wm.node_tree.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (0.75, 0.86, 1.0, 1)
    em.inputs["Strength"].default_value = 2.2
    wm.node_tree.links.new(em.outputs[0], wm.node_tree.nodes["Material Output"].inputs["Surface"])
    box("Window", (-1.25, 1.45, 1.55), (1.1, 0.02, 1.3), wm)
    box("WinBarV", (-1.25, 1.43, 1.55), (0.03, 0.03, 1.3), panel)
    blind = mat_flat("Blind", "#cfc8b8", rough=0.7)
    for k in range(22):
        box(f"Slat{k}", (-1.25, 1.42, 0.93 + k * 0.058), (1.1, 0.012, 0.034), blind)
    # a framed shirt and a shelf with a cup (made-up club, no real badge)
    box("Frame", (1.2, 1.44, 1.62), (0.62, 0.03, 0.78), mat_flat("FrameWood", "#1a1410", rough=0.4))
    box("FrameIn", (1.2, 1.42, 1.62), (0.54, 0.02, 0.70), mat_flat("Mount", "#e8e2d4", rough=0.9))
    box("Shirt", (1.2, 1.405, 1.6), (0.34, 0.02, 0.44), mat_cloth("ShirtRed", "#a8182a"))
    box("ShirtL", (1.0, 1.405, 1.74), (0.12, 0.02, 0.14), mat_cloth("ShirtRed2", "#a8182a"))
    box("ShirtR", (1.4, 1.405, 1.74), (0.12, 0.02, 0.14), mat_cloth("ShirtRed3", "#a8182a"))
    box("Shelf", (0.1, 1.38, 1.95), (0.9, 0.2, 0.03), oak)
    gold = mat_flat("Gold", (1.0, 0.76, 0.33), rough=0.25, metal=1)
    for cx in (-0.12, 0.3):
        bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.035, radius2=0.075, depth=0.16, location=(cx, 1.38, 2.12))
        bpy.context.object.data.materials.append(gold)
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.05, depth=0.03, location=(cx, 1.38, 1.98))
        bpy.context.object.data.materials.append(gold)
    bg = scn.world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.75, 0.7, 0.62, 1)
    bg.inputs["Strength"].default_value = 0.07
    head = jpos(P, "Head")
    face = (head.x, head.y - 0.08, head.z + 0.07)
    area("WindowKey", (-2.0, -0.6, 2.0), 150, 1.4, (0.92, 0.96, 1.0), face)
    area("LampFill", (1.6, -1.6, 1.3), 20, 1.2, (1.0, 0.82, 0.62), face)
    area("Rim", (0.9, 1.0, 2.2), 90, 0.5, (1.0, 0.92, 0.8), face)
    area("DeskBounce", (0, -0.9, 2.6), 16, 1.2, (1.0, 0.95, 0.9), (0, -0.7, top))
    camera((0.10, -1.72, head.z + 0.02), (0.0, -0.25, head.z - 0.22), lens=35, fstop=4.0)
    scn.camera.data.dof.focus_distance = (Vector(face) - scn.camera.location).length

print("CHECK", json.dumps(check), flush=True)
if os.environ.get("REVIEW_NORENDER"):
    for o in bpy.data.objects:
        if o.type == "MESH":
            bb = [o.matrix_world @ Vector(c_) for c_ in o.bound_box]
            print("OBJ", o.name, [round(min(v[i] for v in bb), 2) for i in range(3)], [round(max(v[i] for v in bb), 2) for i in range(3)])
    raise SystemExit(0)
scn.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("RENDERED", OUT, flush=True)
