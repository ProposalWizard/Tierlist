"""THE MAKEHUMAN BODY WEARING THE STYLE A LOOK (B5b, 20 Oct 2026; way "a").

Harry, 20 Oct 2026, on the diagnosis sheet's MakeHuman body: "I'm liking the look of
that proportion model. That already is looking better." This makes a Style A body
file from it, so it gets everything a Style A head already has (toon shader, kit
paint, skin tones, the moving face, the clips, the hands):

    node <bench dump>  →  human.json   (the bench's Body page, ?kind=human: window.__dumpBody())
    blender -b --python tools/bodies/graft.py -- human.json <head fit.glb> <human_s.glb> <out_fit.glb> [headH]
    TOON_REAL=1 TOON_TEX=2048 python3 scripts/people3d/build_toon_bodies.py <dir> <tag>:<out_fit.glb>

  - The MakeHuman player (lib/star/human3d, default shape) in its kit: tee, shorts,
    socks (cut just under the knee), boots; its own skin weights on its own skeleton
    (the game's skeleton). Its head, neck, eyes, teeth, brows and hair are dropped.
  - The Style A head and neck (a fitted Style A body, tools/modeltest/pN/fit.glb) put on:
    the head scaled to `headH` metres crown to chin (default 0.26 = 7.2 heads), the
    neck stretched to the MakeHuman neck's length and thickness, with its own weights.
  - One new picture for all of it (2048): the MakeHuman skin picture, flat kit colours
    (red shirt, white shorts, red socks, dark boots: the build reads them as kit and the
    game repaints them in any club's colours), the Style A head's own picture, the head
    given ~5x the room of the body so the face stays sharp. No brand marks (the
    MakeHuman trainers' picture is not used).
"""
import bpy, bmesh, json, base64, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
DUMP, HEADFIT, HUMAN_S, OUT = argv[:4]
HEAD_H = float(argv[4]) if len(argv) > 4 else 0.26
NECK_CUT = 0.012  # metres (head file units) above his neck joint: his shirt collar stays behind
WORK = os.path.dirname(os.path.abspath(OUT))
for o in list(bpy.data.objects): bpy.data.objects.remove(o)

# ── 1. the Style A head and neck ──────────────────────────────────────────────
bpy.ops.import_scene.gltf(filepath=HEADFIT)
harm = [o for o in bpy.data.objects if o.type == "ARMATURE"][0]
hbody = max((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))
HJ = {b.name: harm.matrix_world @ b.head_local for b in harm.data.bones}
hm = hbody.data
hg = {g.index: g.name for g in hbody.vertex_groups}
HEADB = ("Head", "head_end", "headfront")


def wsum(v, names): return sum(g.weight for g in v.groups if hg.get(g.group) in names)


HMW = hbody.matrix_world.copy()
keep_v = set()
for v in hm.vertices:
    # head and neck, above his own shirt collar (the collar sits at the neck joint): skin only
    if wsum(v, HEADB + ("neck",)) >= 0.5 and (HMW @ v.co).z > HJ["neck"].z + NECK_CUT: keep_v.add(v.index)
bm = bmesh.new(); bm.from_mesh(hm)
bm.faces.ensure_lookup_table()
dead = [f for f in bm.faces if not all(v.index in keep_v for v in f.verts)]
bmesh.ops.delete(bm, geom=dead, context="FACES")
loose = [v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm, geom=loose, context="VERTS")
bm.to_mesh(hm); bm.free()
hbody.parent = None; hbody.matrix_world = HMW
bpy.ops.object.select_all(action="DESELECT"); hbody.select_set(True); bpy.context.view_layer.objects.active = hbody
for m in list(hbody.modifiers): hbody.modifiers.remove(m)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
hg = {g.index: g.name for g in hbody.vertex_groups}
hP = [v.co.copy() for v in hm.vertices]
crown = max(p.z for p in hP)
N1, H1 = HJ["neck"], HJ["Head"]
# the chin, off the face's profile down the middle line (front is -y): below the nose tip the
# profile comes forward again at the chin, then runs back under the jaw; the chin is where it turns
mid = [p for p in hP if abs(p.x) < 0.015]
span = crown - N1.z
prof = []
z = crown
while z > N1.z - 0.1 * span:
    ys = [p.y for p in mid if abs(p.z - z) < 0.004]
    if ys: prof.append((z, min(ys)))
    z -= 0.004
nose = min((q for q in prof if q[0] > N1.z), key=lambda q: q[1])
below = [q for q in prof if nose[0] - 0.4 * span < q[0] < nose[0] - 0.05 * span]
cfront = min(below, key=lambda q: q[1])
chin = cfront[0]
for zq, yq in prof:
    if zq < cfront[0] and yq <= cfront[1] + 0.02: chin = min(chin, zq)
    elif zq < cfront[0]: break

# ── 2. the MakeHuman body ─────────────────────────────────────────────────────
d = json.load(open(DUMP))
B = lambda x, y, z: Vector((x, -z, y))  # three (y up, +z front) → Blender (z up, -y front)
pos = [B(*d["pos"][i * 3:i * 3 + 3]) for i in range(len(d["pos"]) // 3)]
parts = d["parts"]; part = d["part"]; idx = d["index"]
J = {k: B(*v) for k, v in d["joints"].items()}
Nh, Hh = J["neck"], J["Head"]
# GRAFT_KEEPNECK=1 (a fitted body from dump_fit.py): its own neck stays where the new neck does not reach
KEEPNECK = os.environ.get("GRAFT_KEEPNECK") == "1"
DROP = lambda n: n in ("skin.head", "eyes", "teeth") or (n == "skin.neck" and not KEEPNECK) or n.startswith("hair.") or n.startswith("brows.")
# socks: cut just under the knee (MakeHuman's come over it); the knee's own skin is under them
knee_lo = min((pos[i].z for i in range(len(pos)) if parts[int(part[i])] == "skin.knee"), default=-1.0)
SOCK_TOP = knee_lo + 0.012
CLASS = {"kit.tee": "shirt", "kit.teeShorts": "shorts", "kit.socks": "socks", "kit.trainers": "boots"}
faces, fmat, fpart = [], [], []
for t in range(0, len(idx), 3):
    a, b, c = idx[t], idx[t + 1], idx[t + 2]
    n = parts[int(part[a])]
    if DROP(n): continue
    k = CLASS.get(n, "skin" if n.startswith("skin.") else None)
    if k is None: continue

    faces.append((a, b, c)); fmat.append(k); fpart.append(n)
used = sorted({i for f in faces for i in f})
remap = {o: n for n, o in enumerate(used)}
me = bpy.data.meshes.new("Player")
me.from_pydata([pos[i] for i in used], [], [tuple(remap[i] for i in f) for f in faces])
me.update()
human = bpy.data.objects.new("Player", me); bpy.context.scene.collection.objects.link(human)
uv = me.uv_layers.new(name="orig")
col = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
UVs, CO = d["uv"], d["color"]
for li, loop in enumerate(me.loops):
    o = used[loop.vertex_index]
    uv.data[li].uv = (UVs[o * 2], UVs[o * 2 + 1])
for n, o in enumerate(used):
    col.data[n].color = (CO[o * 3], CO[o * 3 + 1], CO[o * 3 + 2], 1) if CO else (1, 1, 1, 1)
SI, SW, BN = d["skinIndex"], d["skinWeight"], d["bones"]
groups = {}
for n, o in enumerate(used):
    for k in range(4):
        w = SW[o * 4 + k]
        if w <= 0: continue
        name = BN[int(SI[o * 4 + k])]
        g = groups.get(name) or human.vertex_groups.new(name=name)
        groups[name] = g
        g.add([n], w, "ADD")

# ── 3. the head on the MakeHuman neck ─────────────────────────────────────────
k = HEAD_H / (crown - chin)
ring = lambda pts, zc, band: max([abs(p.x) for p in pts if abs(p.z - zc) < band] or [0.05])
mid1, midh = (N1.z + H1.z) / 2, (Nh.z + Hh.z) / 2
r1 = ring([p for v, p in zip(hm.vertices, hP) if wsum(v, ("neck",)) > 0.5], mid1, 0.015)
rh = ring([pos[i] for i in range(len(pos)) if parts[int(part[i])] == "skin.neck"], midh, 0.012)
kr = rh / r1
kz = (Hh.z - Nh.z) / (H1.z - N1.z)
for v, p in zip(hm.vertices, hP):
    wh_ = wsum(v, HEADB); wn = wsum(v, ("neck",)) + sum(g.weight for g in v.groups if hg[g.group] not in HEADB + ("neck",))
    wh_ = wh_ / max(1e-6, wh_ + wn)
    head = Hh + k * (p - H1)
    t = (p.z - N1.z) / (H1.z - N1.z)
    c1, ch = N1.lerp(H1, max(0.0, min(1.0, t))), Nh.lerp(Hh, max(0.0, min(1.0, t)))
    neck = Vector((ch.x + kr * (p.x - c1.x), ch.y + kr * (p.y - c1.y), Nh.z + (p.z - N1.z) * kz))
    v.co = neck.lerp(head, wh_)
print("FACE crown", round(crown, 3), "nose", round(nose[0], 3), "chin", round(chin, 3), "neck joint", round(N1.z, 3), "head joint", round(H1.z, 3))
print("GRAFT head", round(crown - chin, 3), "->", HEAD_H, "k", round(k, 3), "neck ring", round(r1, 3), "->", round(rh, 3), "kz", round(kz, 3),
      "socks cut at", round(SOCK_TOP, 3), "faces body", len(faces), "head", len(hm.polygons))

# ── 4. materials for the bake ─────────────────────────────────────────────────
def b64img(s, name):
    path = os.path.join(WORK, name + ".png")
    open(path, "wb").write(base64.b64decode(s.split(",")[1]))
    return bpy.data.images.load(path)


skin_img = b64img(d["maps"][0], "mh_skin")
TINT = {"shirt": (0.80, 0.16, 0.12), "shorts": (0.93, 0.93, 0.94), "socks": (0.80, 0.16, 0.12), "boots": (0.10, 0.10, 0.11)}


def mat(name, build):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); bsdf = nt.nodes.new("ShaderNodeBsdfDiffuse")
    nt.links.new(bsdf.outputs[0], out.inputs[0])
    build(nt, bsdf.inputs["Color"])
    return m


def uvmap(nt, name):
    n = nt.nodes.new("ShaderNodeUVMap"); n.uv_map = name; return n


def skin_build(nt, dst):
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = skin_img
    nt.links.new(uvmap(nt, "orig").outputs[0], tex.inputs[0])
    ca = nt.nodes.new("ShaderNodeVertexColor"); ca.layer_name = "Col"
    mul = nt.nodes.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"; mul.inputs[0].default_value = 1
    nt.links.new(tex.outputs[0], mul.inputs[6]); nt.links.new(ca.outputs[0], mul.inputs[7]); nt.links.new(mul.outputs[2], dst)


def flat_build(rgb):
    def f(nt, dst):
        ca = nt.nodes.new("ShaderNodeVertexColor"); ca.layer_name = "Col"
        mul = nt.nodes.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"; mul.inputs[0].default_value = 1
        mul.inputs[6].default_value = (*rgb, 1)
        nt.links.new(ca.outputs[0], mul.inputs[7]); nt.links.new(mul.outputs[2], dst)
    return f


MATS = {"skin": mat("skin", skin_build), **{k: mat(k, flat_build(v)) for k, v in TINT.items()}}
order = list(MATS)
for m in MATS.values(): me.materials.append(m)
for f, k_ in zip(me.polygons, fmat): f.material_index = order.index(k_)

# Skin hidden under cloth goes (the Style A ink line round it would poke through the cloth's
# edge as spikes), the socks are cut cleanly just under the knee, and the MakeHuman neck stays
# only where the Style A neck does not reach (the collar's gap).
toon_neck_bottom = Nh.z + NECK_CUT * kz
bm = bmesh.new(); bm.from_mesh(me)
bm.faces.ensure_lookup_table()
fp = list(fpart)
import math
hem_at = {}
for side in (1, -1):
    bins = [9.0] * 36
    cx = side * abs(J["LeftUpLeg"].x)
    for f, n in zip(bm.faces, fp):
        if n != "kit.teeShorts": continue
        for v in f.verts:
            if v.co.x * side <= 0: continue
            b = int((math.atan2(v.co.y, v.co.x - cx) + math.pi) / (2 * math.pi) * 36) % 36
            bins[b] = min(bins[b], v.co.z)
    hem_at[side] = bins
dead = []
for f, n in zip(bm.faces, fp):
    zs = [v.co.z for v in f.verts]
    if n == "skin.thighLow":
        side = 1 if f.calc_center_median().x > 0 else -1
        cx = side * abs(J["LeftUpLeg"].x)
        if all(v.co.z > hem_at[side][int((math.atan2(v.co.y, v.co.x - cx) + math.pi) / (2 * math.pi) * 36) % 36] - 0.004 for v in f.verts):
            dead.append(f)
    elif n == "skin.knee" and max(zs) < SOCK_TOP - 0.004:
        dead.append(f)
    elif n == "skin.neck" and min(zs) > toon_neck_bottom + 0.01:
        dead.append(f)
# skin just inside a cloth edge is pulled in towards the leg's own line, so it never shows through
# (the shorts hem, the sock top): MakeHuman's layers sit a few millimetres apart
def smooth_(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)


pulled = set()
for f, n in zip(bm.faces, fp):
    if n not in ("skin.thighLow", "skin.knee"): continue
    for v in f.verts:
        if v.index in pulled: continue
        pulled.add(v.index)
        side = "Left" if v.co.x > 0 else "Right"
        a_, b_ = (J[side + "UpLeg"], J[side + "Leg"]) if n == "skin.thighLow" else (J[side + "Leg"], J[side + "Foot"])
        t = max(0.0, min(1.0, (v.co.z - a_.z) / (b_.z - a_.z)))
        c = a_.lerp(b_, t)
        if n == "skin.thighLow":
            sd = 1 if side == "Left" else -1
            cx = sd * abs(J["LeftUpLeg"].x)
            hz = hem_at[sd][int((math.atan2(v.co.y, v.co.x - cx) + math.pi) / (2 * math.pi) * 36) % 36]
            w = 0.014 * smooth_(hz - 0.03, hz - 0.005, v.co.z)
        else:
            w = 0.012 * (1 - smooth_(SOCK_TOP + 0.003, SOCK_TOP + 0.025, v.co.z))
        r = Vector((v.co.x - c.x, v.co.y - c.y, 0))
        if r.length > 1e-6 and w > 0:
            v.co -= r.normalized() * min(w, 0.4 * r.length)
if os.environ.get("GRAFT_DEBUG"):
    from mathutils.bvhtree import BVHTree
    sh = [f for f, n in zip(bm.faces, fp) if n in ("kit.teeShorts", "kit.socks")]
    tv = [v.co.copy() for v in bm.verts]
    tree = BVHTree.FromPolygons(tv, [[v.index for v in f.verts] for f in sh])
    out_, n_, ex = 0, 0, []
    for f, n in zip(bm.faces, fp):
        if n != "skin.thighLow": continue
        for v in f.verts:
            side = "Left" if v.co.x > 0 else "Right"
            c = J[side + "UpLeg"].lerp(J[side + "Leg"], max(0.0, min(1.0, (v.co.z - J[side + "UpLeg"].z) / (J[side + "Leg"].z - J[side + "UpLeg"].z))))
            r = Vector((v.co.x - c.x, v.co.y - c.y, 0)).normalized()
            hit = tree.ray_cast(v.co + r * 0.0005, r, 0.05)
            n_ += 1
            if hit[0] is None and v.co.z > 0.74:
                out_ += 1; ex.append(round(v.co.z, 3))
    print("DEBUG thigh skin verts", n_, "not under cloth above 0.74 m:", out_, "heights", sorted(ex)[:5], sorted(ex)[-5:])
socks_geom = [f for f, n in zip(bm.faces, fp) if n == "kit.socks" and f not in dead]
bmesh.ops.delete(bm, geom=dead, context="FACES")
sg = list({e for f in socks_geom for e in f.edges}) + list({v for f in socks_geom for v in f.verts}) + socks_geom
if socks_geom: bmesh.ops.bisect_plane(bm, geom=sg, plane_co=(0, 0, SOCK_TOP), plane_no=(0, 0, 1), clear_outer=True)
bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
loose = [v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm, geom=loose, context="VERTS")
bm.to_mesh(me); bm.free(); me.update()
print("TRIM skin faces", len(dead), "socks cut at", round(SOCK_TOP, 3), "neck filler below", round(toon_neck_bottom + 0.01, 3))

# the head's own picture, read through its own UVs (renamed "orig" so the join keeps them)
hm.uv_layers.active.name = "orig"
for i, m in enumerate(hm.materials):
    img = next((n.image for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image), None)
    def head_build(nt, dst, img=img):
        tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img
        nt.links.new(uvmap(nt, "orig").outputs[0], tex.inputs[0]); nt.links.new(tex.outputs[0], dst)
    hm.materials[i] = mat("head%d" % i, head_build)

# ── 5. join, onto the MakeHuman skeleton ──────────────────────────────────────
bpy.ops.object.select_all(action="DESELECT")
for o in list(bpy.data.objects):
    if o not in (human, hbody): bpy.data.objects.remove(o)
hbody.select_set(True); human.select_set(True); bpy.context.view_layer.objects.active = human
bpy.ops.object.join()
P = human
pm = P.data
existing = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=HUMAN_S)
arm = [o for o in bpy.data.objects if o not in existing and o.type == "ARMATURE"][0]
for o in [o for o in bpy.data.objects if o not in existing and o is not arm]: bpy.data.objects.remove(o)
AJ = {b.name: arm.matrix_world @ b.head_local for b in arm.data.bones}
off = max((AJ[n] - J[n]).length for n in ("Hips", "neck", "Head", "LeftHand", "LeftFoot") if n in AJ and n in J)
print("SKELETON human_s vs dump joints: largest gap", round(off, 4), "m")
if off > 0.002:
    # move the bones onto the dump's joints, keeping each bone's direction and roll (as fit.py)
    bpy.ops.object.select_all(action="DESELECT"); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    inv = arm.matrix_world.inverted()
    for e in arm.data.edit_bones:
        for c in e.children: c.use_connect = False
    for e in arm.data.edit_bones:
        if e.name not in J: continue
        roll = e.roll; dd = e.tail - e.head; nh = inv @ J[e.name]
        e.head = nh; e.tail = nh + dd; e.roll = roll
    bpy.ops.object.mode_set(mode="OBJECT")

# ── 6. one picture: a new layout (the head given more room), baked ────────────
bpy.ops.object.select_all(action="DESELECT"); P.select_set(True); bpy.context.view_layer.objects.active = P
atlas = pm.uv_layers.new(name="atlas"); pm.uv_layers.active = atlas
headmats = {i for i, m in enumerate(pm.materials) if m.name.startswith("head")}
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.002, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
bm = bmesh.from_edit_mesh(pm)
ul = bm.loops.layers.uv["atlas"]
for f in bm.faces:
    if f.material_index in headmats:
        for l in f.loops: l[ul].uv = l[ul].uv * 2.3
bmesh.update_edit_mesh(pm)
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.select_all(action="SELECT")
bpy.ops.uv.pack_islands(rotate=True, scale=True, margin=0.002)
bpy.ops.object.mode_set(mode="OBJECT")

# (Cycles' bake writes nothing on this machine's Blender 4.0 package, so the painting is done
# outside Blender: tools/bodies/paint_atlas.py, from what each triangle reads, written here.)
import numpy as np
CLS = {"skin": 0, "shirt": 1, "shorts": 2, "socks": 3, "boots": 4}
mats = [CLS.get(m.name, 5 + int(m.name[4:]) if m.name.startswith("head") else 0) for m in pm.materials]
ua, uo = pm.uv_layers["atlas"].data, pm.uv_layers["orig"].data
colv = pm.color_attributes["Col"].data
tri_atlas, tri_orig, tri_col, tri_cls = [], [], [], []
for f in pm.polygons:
    if len(f.loop_indices) != 3: continue
    c = mats[f.material_index]
    tri_cls.append(c)
    tri_atlas.append([(ua[li].uv[0], 1 - ua[li].uv[1]) for li in f.loop_indices])
    # the MakeHuman UVs came in as three.js has them (row = v); the head's through Blender's importer (flipped)
    tri_orig.append([(uo[li].uv[0], uo[li].uv[1] if c < 5 else 1 - uo[li].uv[1]) for li in f.loop_indices])
    tri_col.append([tuple(colv[pm.loops[li].vertex_index].color[:3]) if c < 5 else (1, 1, 1) for li in f.loop_indices])
heads = {}
for m in pm.materials:
    if not m.name.startswith("head"): continue
    img = next(n.image for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image)
    w, h = img.size
    px = (np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1, :, :3] * 255 + 0.5).astype(np.uint8)
    heads[m.name] = px
np.savez_compressed(os.path.join(WORK, "paint.npz"), atlas=np.array(tri_atlas, np.float32), orig=np.array(tri_orig, np.float32),
                    col=np.array(tri_col, np.float32), cls=np.array(tri_cls, np.int32), **{k: v for k, v in heads.items()})
print("PAINT DATA", len(tri_cls), "triangles", {k: v.shape for k, v in heads.items()})
SIZE = 2048
baked = bpy.data.images.new("atlas", 64, 64, alpha=False)  # a stand-in: build_toon_bodies reads TOON_BASE

# one material, the baked picture, the atlas UVs only
final = bpy.data.materials.new("Body"); final.use_nodes = True
nt = final.node_tree; bsdf = nt.nodes["Principled BSDF"]
tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = baked
nt.links.new(tex.outputs[0], bsdf.inputs["Base Color"])
pm.materials.clear(); pm.materials.append(final)
for f in pm.polygons: f.material_index = 0
pm.uv_layers.remove(pm.uv_layers["orig"])
pm.color_attributes.remove(pm.color_attributes["Col"])

# ── 7. skinned on the skeleton, exported like fit.py ──────────────────────────
for m in list(P.modifiers): P.modifiers.remove(m)
bpy.ops.object.select_all(action="DESELECT"); P.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type="ARMATURE_NAME")
for pb in arm.pose.bones: pb.custom_shape = None
for o in list(bpy.data.objects):
    if o not in (P, arm): bpy.data.objects.remove(o)
bpy.ops.object.select_all(action="DESELECT"); P.select_set(True); arm.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, use_selection=True, export_format="GLB", export_animations=False, export_skins=True, export_yup=True)
top = max((P.matrix_world @ v.co).z for v in pm.vertices)
print("WROTE", OUT, "height", round(top, 3), "tris", sum(len(p.vertices) - 2 for p in pm.polygons))
