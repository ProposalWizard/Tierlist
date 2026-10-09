"""Fit a generated (picture -> 3D) footballer onto the game's MakeHuman skeleton.
Model test (Harry, 9 Oct 2026). Not used by the game.

blender -b --python tools/modeltest/fit.py -- <cand.glb> <human_s.glb> <out.glb> [yaw_deg]

1. Imports the MakeHuman armature (the skeleton every mocap clip is retargeted to).
2. Imports the generated mesh, turns it to face -Y, scales it so its crotch sits at
   the MakeHuman crotch height (same leg length = the clips' hip height fits).
3. Finds his joints from the mesh (slice centroids), builds a temporary armature
   on those joints, weights by bone heat (automatic weights).
4. Poses that temporary armature into the MakeHuman rest directions (arms and legs)
   and bakes it, so the mesh now stands exactly like the MakeHuman rest pose.
5. Moves the MakeHuman bones' heads onto his joints, KEEPING every bone's rest
   direction and roll, so each clip's rotations mean the same thing on him.
6. Exports armature + mesh (skin only; clips are added by addclips.mjs).
"""
import bpy, bmesh, sys, math
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
CAND, HUMAN, OUT = argv[:3]
YAW = float(argv[3]) if len(argv) > 3 else 0.0

for o in list(bpy.data.objects): bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=HUMAN)
arm = [o for o in bpy.data.objects if o.type == "ARMATURE"][0]
mh_body = bpy.data.objects.get("Body.skin")
MW = arm.matrix_world.copy()
MH = {b.name: (MW @ b.head_local, (MW.to_3x3() @ (b.tail_local - b.head_local)).normalized()) for b in arm.data.bones}
dg = bpy.context.evaluated_depsgraph_get()
mhm = mh_body.evaluated_get(dg).to_mesh()
mhv = [mh_body.matrix_world @ v.co for v in mhm.vertices]
mhf = [list(p.vertices) for p in mhm.polygons]
for o in list(bpy.data.objects):
    if o.type == "MESH": bpy.data.objects.remove(o)

existing = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=CAND)
new = [o for o in bpy.data.objects if o not in existing]
meshes = [o for o in new if o.type == "MESH"]
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
for o in meshes:
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
if len(meshes) > 1: bpy.ops.object.join()
C = bpy.context.view_layer.objects.active
for o in new:
    if o != C and o.name in bpy.data.objects: bpy.data.objects.remove(o)
C.name = "Player"
bpy.ops.object.select_all(action="DESELECT"); C.select_set(True); bpy.context.view_layer.objects.active = C
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = C.data
if YAW:
    me.transform(Matrix.Rotation(math.radians(YAW), 4, "Z"))
# clean up: merge doubles, drop loose bits
bm = bmesh.new(); bm.from_mesh(me)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bm.to_mesh(me); bm.free()


def V(): return [v.co.copy() for v in me.vertices]


from mathutils.bvhtree import BVHTree


def crotch(vs, lo=0.25, faces=None):
    """Lowest height where a ray along Y through x = 0 hits the body (between the legs)."""
    top = max(v.z for v in vs)
    tree = BVHTree.FromPolygons(vs, faces)
    z = lo * top
    while z < top:
        hit = tree.ray_cast(Vector((0, -5, z)), Vector((0, 1, 0)))
        if hit[0] is not None: return z
        z += 0.002 * top
    return None


# feet on the floor, centred
vs = V()
zmin = min(v.z for v in vs); cx = (min(v.x for v in vs) + max(v.x for v in vs)) / 2
cy = sum(v.y for v in vs if v.z < zmin + 0.3 * (max(v.z for v in vs) - zmin)) / max(1, len([1 for v in vs if v.z < zmin + 0.3 * (max(v.z for v in vs) - zmin)]))
me.transform(Matrix.Translation((-cx, -cy, -zmin)))
vs = V()
H0 = max(v.z for v in vs)
cf = [list(p.vertices) for p in me.polygons]
c0 = crotch(vs, 0.3, cf)
ch = crotch(mhv, 0.3, mhf)
s = ch / c0
me.transform(Matrix.Scale(s, 4))
vs = V()
HT = max(v.z for v in vs)
print("FIT crotch mh", round(ch, 3), "cand", round(c0 * s, 3), "scale", round(s, 3), "height", round(HT, 3), "tris", sum(len(p.vertices) - 2 for p in me.polygons))


def sl(vs, z, band=0.015, f=lambda v: True):
    return [v for v in vs if abs(v.z - z) < band and f(v)]


def cen(pts):
    n = len(pts)
    return Vector((sum(p.x for p in pts) / n, sum(p.y for p in pts) / n, sum(p.z for p in pts) / n)) if n else None


def width_noarms(vs, z, xmax):
    p = sl(vs, z, 0.01, lambda v: abs(v.x) < xmax)
    return (max(v.x for v in p) - min(v.x for v in p)) if p else 9


def landmarks(vs, faces):
    top = max(v.z for v in vs)
    cr = crotch(vs, 0.3, faces)
    # narrowest neck slice above the shoulders (ignore arms by |x| < 0.16)
    best = None
    for i in range(60):
        z = top - 0.12 - i * 0.006
        w = width_noarms(vs, z, 0.16)
        if best is None or w < best[1]: best = (z, w)
        if z < top - 0.45: break
    return {"top": top, "crotch": cr, "neck": best[0]}


Lm = landmarks(mhv, mhf)
Lc = landmarks(vs, cf)
print("LM mh", {k: round(v, 3) for k, v in Lm.items()}, "cand", {k: round(v, 3) for k, v in Lc.items()})


def map_z(z):
    """MakeHuman height -> candidate height: legs equal; trunk hip..neck and neck..top stretch."""
    if z <= 1.012: return z
    hip = 1.012
    if z <= Lm["neck"]: return hip + (z - hip) * (Lc["neck"] - hip) / (Lm["neck"] - hip)
    return Lc["neck"] + (z - Lm["neck"]) * (Lc["top"] - Lc["neck"]) / (Lm["top"] - Lm["neck"])


J = {}
# trunk: z mapped, x 0, y = torso slice centroid + MakeHuman's own offset from its slice centroid
for b in ("Hips", "Spine02", "Spine01", "Spine", "neck", "Head", "head_end", "headfront"):
    h = MH[b][0]
    zc = map_z(h.z)
    pm = sl(mhv, h.z, 0.01, lambda v: abs(v.x) < 0.1); pc = sl(vs, zc, 0.01, lambda v: abs(v.x) < 0.1)
    dy = h.y - cen(pm).y if pm else 0
    J[b] = Vector((0.0, (cen(pc).y if pc else 0) + dy * (1.0 if b != "headfront" else 1.2), zc))

for side, sg in (("Left", 1), ("Right", -1)):
    # legs: hip/knee/ankle at the MakeHuman heights (same leg length), x/y from his leg slices
    leg = [v for v in vs if v.x * sg > 0.01 and v.z < Lc["crotch"]]
    legm = [v for v in mhv if v.x * sg > 0.01 and v.z < Lm["crotch"]]
    for b in ("UpLeg", "Leg", "Foot"):
        h = MH[side + b][0]
        zz = min(h.z, Lc["crotch"] - 0.04)
        pm = sl(legm, zz, 0.02); pc = sl(leg, zz, 0.02)
        off = h - cen(pm); off.z = 0
        if b == "UpLeg": off.x *= 0.6
        J[side + b] = cen(pc) + off
        J[side + b].z = h.z
    J[side + "ToeBase"] = J[side + "Foot"] + (MH[side + "ToeBase"][0] - MH[side + "Foot"][0])
    # arms: shoulder from the mapped trunk, fingertip = lowest point far out to his side
    xmax = max(v.x * sg for v in vs)
    far = [v for v in vs if v.x * sg > 0.75 * xmax and v.z < Lc["neck"] - 0.25 and v.z > 0.55 * Lc["crotch"]]
    tip = min(far, key=lambda v: v.z)
    farm = [v for v in mhv if v.x * sg > 0.75 * max(u.x * sg for u in mhv) and v.z < Lm["neck"] - 0.25 and v.z > 0.55 * Lm["crotch"]]
    tipm = min(farm, key=lambda v: v.z)
    shm = MH[side + "Arm"][0]
    # his shoulder: deltoid outer edge at the mapped height, minus MakeHuman's own inset
    zs = map_z(shm.z)
    outer_c = max(v.x * sg for v in sl(vs, zs - 0.03, 0.015) if abs(v.y) < 0.2)
    outer_m = max(v.x * sg for v in sl(mhv, shm.z - 0.03, 0.015) if abs(v.y) < 0.2)
    sh = Vector((sg * (outer_c - (outer_m - shm.x * sg)), shm.y, zs))
    J[side + "Arm"] = sh
    J[side + "Shoulder"] = Vector((MH[side + "Shoulder"][0].x, MH[side + "Shoulder"][0].y, zs))
    Lm_arm = (tipm - shm).length; Lc_arm = (tip - sh).length
    for b in ("ForeArm", "Hand"):
        t = (MH[side + b][0] - shm).length / Lm_arm
        p = sh.lerp(tip, t)
        ax = (tip - sh).normalized()
        pts = [v for v in vs if abs((v - p).dot(ax)) < 0.02 and (v - p).length < 0.065]
        J[side + b] = cen(pts) if len(pts) > 5 else p
    J[side + "_tip"] = tip
    print("ARMJ", side, [tuple(round(x, 3) for x in J[side + k]) for k in ("Arm", "ForeArm", "Hand", "_tip")])
    ka = Lc_arm / Lm_arm
    for bn in MH:
        if bn.startswith(side + "Hand") and bn != side + "Hand":
            J[bn] = J[side + "Hand"] + (MH[bn][0] - MH[side + "Hand"][0]) * ka

# ── temporary armature on his joints ──
CHILD = {"Hips": "Spine02", "Spine02": "Spine01", "Spine01": "Spine", "Spine": "neck", "neck": "Head", "Head": "head_end"}
for sd in ("Left", "Right"):
    CHILD.update({sd + "Shoulder": sd + "Arm", sd + "Arm": sd + "ForeArm", sd + "ForeArm": sd + "Hand", sd + "Hand": sd + "_tip",
                  sd + "UpLeg": sd + "Leg", sd + "Leg": sd + "Foot", sd + "Foot": sd + "ToeBase"})
DEFORM = set(CHILD) | {"LeftToeBase", "RightToeBase"}
tad = bpy.data.armatures.new("T"); T = bpy.data.objects.new("T", tad); bpy.context.scene.collection.objects.link(T)
bpy.ops.object.select_all(action="DESELECT"); T.select_set(True); bpy.context.view_layer.objects.active = T
bpy.ops.object.mode_set(mode="EDIT")
eb = {}
for b in arm.data.bones:
    e = tad.edit_bones.new(b.name)
    h = J.get(b.name, MH[b.name][0])
    e.head = h
    c = CHILD.get(b.name)
    if c and c in J and (J[c] - h).length > 0.01: e.tail = J[c]
    else: e.tail = h + MH[b.name][1] * 0.06
    e.use_deform = b.name in DEFORM
    eb[b.name] = e
for b in arm.data.bones:
    if b.parent: eb[b.name].parent = eb[b.parent.name]
bpy.ops.object.mode_set(mode="OBJECT")

# weights: bone heat
bpy.ops.object.select_all(action="DESELECT"); C.select_set(True); T.select_set(True); bpy.context.view_layer.objects.active = T
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
nw = sum(1 for v in me.vertices if not any(g.weight > 1e-4 for g in v.groups))
print("WEIGHTS unweighted verts", nw, "of", len(me.vertices))
if nw > 0.02 * len(me.vertices):
    # fallback: envelope-ish nearest-bone weights for the unweighted ones
    segs = [(b.name, T.matrix_world @ b.head_local, T.matrix_world @ b.tail_local) for b in tad.bones if b.use_deform]
    for v in me.vertices:
        if any(g.weight > 1e-4 for g in v.groups): continue
        ds = []
        for n, a, bb in segs:
            ab = bb - a; t = max(0, min(1, (v.co - a).dot(ab) / max(1e-9, ab.dot(ab))))
            ds.append(((v.co - (a + ab * t)).length, n))
        ds.sort()
        for d, n in ds[:2]:
            C.vertex_groups[n].add([v.index], 1.0 / max(d, 0.01) ** 4, "ADD")
    bpy.ops.object.select_all(action="DESELECT"); C.select_set(True); bpy.context.view_layer.objects.active = C
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    print("WEIGHTS fallback used")

# prune: bone heat sometimes leaks a far bone onto a separate island (a hand on a boot).
# Drop any weight whose bone segment is far from the vertex, renormalise, smooth once.
segs = {b.name: (T.matrix_world @ b.head_local, T.matrix_world @ b.tail_local) for b in tad.bones if b.use_deform}


def segd(p, a, b):
    ab = b - a; t = max(0.0, min(1.0, (p - a).dot(ab) / max(1e-9, ab.dot(ab))))
    return (p - (a + ab * t)).length


pruned = 0
gname = {g.index: g.name for g in C.vertex_groups}
for v in me.vertices:
    ws = [(gname[g.group], g.weight) for g in v.groups if g.weight > 1e-4 and gname[g.group] in segs]
    ds = {n: segd(v.co, *segs[n]) for n in segs}
    near = min(ds, key=ds.get)
    keep = [(n, w) for n, w in ws if ds[n] < max(0.16, 1.8 * ds[near])]
    if len(keep) < len(ws): pruned += 1
    if not keep: keep = [(near, 1.0)]
    for g in list(v.groups): C.vertex_groups[g.group].remove([v.index])
    tot = sum(w for _, w in keep)
    for n, w in keep: C.vertex_groups[n].add([v.index], w / tot, "REPLACE")
print("WEIGHTS pruned verts", pruned)
bpy.ops.object.select_all(action="DESELECT"); C.select_set(True); bpy.context.view_layer.objects.active = C
bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
bpy.ops.object.vertex_group_smooth(group_select_mode="ALL", factor=0.5, repeat=2)
bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
bpy.ops.object.vertex_group_normalize_all(lock_active=False)
bpy.ops.object.mode_set(mode="OBJECT")

# pose T into the MakeHuman rest directions (limbs), then bake
# Done by hand (linear blend skinning in Python), so nothing depends on pose-mode updates.
bones = {b.name: b for b in tad.bones}
old_h = {n: T.matrix_world @ b.head_local for n, b in bones.items()}
old_t = {n: T.matrix_world @ b.tail_local for n, b in bones.items()}
POSED = set()
for sd in ("Left", "Right"):
    POSED |= {sd + n for n in ("Arm", "ForeArm", "Hand", "UpLeg", "Leg", "Foot")}
M = {}; Rw = {}; MAXROT = [0.0]


def walk(b):
    n = b.name
    par = b.parent.name if b.parent else None
    Mp = M[par] if par else Matrix.Identity(4)
    Rp = Rw[par] if par else Matrix.Identity(3)
    R = Rp
    if n in POSED:
        d = (Rp @ (old_t[n] - old_h[n])).normalized()
        q = d.rotation_difference(MH[n][1])
        MAXROT[0] = max(MAXROT[0], math.degrees(q.angle))
        print("TURN", n, tuple(round(x, 2) for x in d), tuple(round(x, 2) for x in MH[n][1]), round(math.degrees(q.angle), 1))
        R = q.to_matrix() @ Rp
    nh = Mp @ old_h[n]
    M[n] = Matrix.Translation(nh) @ R.to_4x4() @ Matrix.Translation(-old_h[n])
    Rw[n] = R
    for c in b.children: walk(c)


for b in tad.bones:
    if not b.parent: walk(b)
print("POSE max limb turn to MakeHuman rest (deg)", round(MAXROT[0], 1))
PJ = {n: M[n] @ old_h[n] for n in bones}
C.parent = None
for m in list(C.modifiers): C.modifiers.remove(m)
gname = {g.index: g.name for g in C.vertex_groups}
print("BBOX before", [round(f(v.co[i] for v in me.vertices), 3) for i in range(3) for f in (min, max)], C.matrix_world.to_translation(), C.matrix_world.to_scale())
for v in me.vertices:
    acc = Vector((0, 0, 0)); tw = 0.0
    for g in v.groups:
        n = gname[g.group]
        if n in M and g.weight > 0:
            acc += (M[n] @ v.co) * g.weight; tw += g.weight
    if tw > 0:
        nv = acc / tw
        if (nv - v.co).length > 0.25: print("BIGMOVE", tuple(round(x, 2) for x in v.co), [(gname[g.group], round(g.weight, 2)) for g in v.groups])
        v.co = nv
print("BBOX after", [round(f(v.co[i] for v in me.vertices), 3) for i in range(3) for f in (min, max)])
bpy.ops.object.select_all(action="DESELECT"); C.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT.replace(".glb", "_baked.glb"), use_selection=True, export_format="GLB", export_skins=False, export_animations=False)

# ── move the MakeHuman bones onto his (now rest-posed) joints, keeping direction + roll ──
bpy.ops.object.select_all(action="DESELECT"); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
inv = arm.matrix_world.inverted()
for e in arm.data.edit_bones:
    for c in e.children: c.use_connect = False
for e in arm.data.edit_bones:
    roll = e.roll
    d = e.tail - e.head
    nh = inv @ PJ[e.name]
    e.head = nh; e.tail = nh + d; e.roll = roll
bpy.ops.object.mode_set(mode="OBJECT")
bpy.data.objects.remove(T)
bpy.ops.object.select_all(action="DESELECT"); C.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type="ARMATURE_NAME")   # keeps the vertex groups (same bone names)
for g in list(C.vertex_groups):
    if g.name not in DEFORM and g.name in arm.data.bones: pass
print("JOINTS", {k: tuple(round(x, 3) for x in v) for k, v in PJ.items() if not ("Hand" in k and k[-1].isdigit())})
for pb in arm.pose.bones: pb.custom_shape = None
for o in list(bpy.data.objects):
    if o not in (C, arm): bpy.data.objects.remove(o)
bpy.ops.object.select_all(action="DESELECT"); C.select_set(True); arm.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, use_selection=True, export_format="GLB", export_animations=False, export_skins=True, export_yup=True)
print("WROTE", OUT, "tris", sum(len(p.vertices) - 2 for p in me.polygons))
