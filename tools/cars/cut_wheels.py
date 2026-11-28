"""THE WHEEL TOOL, step 2 of 3 (driving phase 1, 28 Nov 2026).

The six generated shop cars (Higgsfield picture -> Tripo, 9 Oct) come as ONE fused mesh, wheels
baked in, so they cannot drive. This cuts the four wheels out so they can spin and the front pair
can steer, and writes a drive-ready car:

  - the car faces +Z in three.js (glTF), stands on y = 0, centred, at its real length
  - node "body": the body, plus dark wheel-arch liners (an arc over each wheel and a wall on its
    inner side) so the hole the cut leaves never shows the inside of the car
  - nodes "wheel_FL", "wheel_FR", "wheel_RL", "wheel_RR": EMPTY pivots at each hub (spin = rotation.x,
    steer = rotation.y), each with one mesh child. The mesh sits under its own child node so the
    packer's quantize (scripts/perf3d/shrink-models.mjs) never moves the pivot. Left = +X.

How a wheel is found: the four ground-contact patches give each wheel's place along the car; its
radius comes from the tyre-coloured vertices round that place (texture sampled per vertex); every
vertex inside radius x 1.08 on the outer side band goes to the wheel, EXCEPT body-paint-coloured
ones (so a tight arch lip stays on the body) when the paint differs from the tyre (a black car
falls back to the plain geometric cut).

  blender -b -P tools/cars/cut_wheels.py -- in.glb out.glb --length 4.1 [--front +x] [--stills prefix]

Input must be a plain GLB (tools/cars/unpack.mjs). All six cars face +X as generated.
Stills: <prefix>_front.png (front 3/4, fronts steered 18 deg) and <prefix>_side.png.
"""
import bpy, bmesh, sys, math, json
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
def opt(k, d=None):
    return argv[argv.index(k) + 1] if k in argv else d
LENGTH = float(opt("--length", "4.2"))
FRONT = opt("--front", "+x")
STILLS = opt("--stills")
CUT_R = float(opt("--cut", "1.08"))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
for o in list(bpy.context.scene.objects):
    if o != ob and o.type != "MESH": bpy.data.objects.remove(o)
ob.parent = None
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# ── a clean, glossy body (coordinator, 28 Nov: "dented door panels, wrinkled window"): the generated
# mesh comes split at every UV seam with its own baked normals, so the paint's reflection breaks up
# on every little bump. Weld the seams, drop the baked normals, let the surface relax a little
# (--relax N passes, 0 = off; mirrors and grilles survive 2-3), then smooth shading with a 45° crease.
RELAX = int(opt("--relax", "0"))  # 3 passes left creases on the hatch (28 Nov stills): off by default
import bmesh as _bm
_b = _bm.new(); _b.from_mesh(ob.data)
_bm.ops.remove_doubles(_b, verts=_b.verts, dist=0.0004 * max(ob.dimensions))
if RELAX > 0:
    # Laplacian-style relax of the body only where it is nearly flat (no edge sharper than ~25°),
    # so crease lines, the grille and the lamps keep their shape
    _b.normal_update()
    flat = [v for v in _b.verts if v.link_faces and all(f.normal.angle(v.normal, 0) < math.radians(25) for f in v.link_faces) and not v.is_boundary]
    for _ in range(RELAX):
        _bm.ops.smooth_vert(_b, verts=flat, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
        _b.normal_update()
_b.to_mesh(ob.data); _b.free()
if ob.data.has_custom_normals:
    bpy.context.view_layer.objects.active = ob
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
for p in ob.data.polygons: p.use_smooth = True
try:
    ob.data.use_auto_smooth = True; ob.data.auto_smooth_angle = math.radians(45)
except AttributeError:
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(45))

# ── face the car down Blender -Y (= glTF/three.js +Z), real length, on the ground ──
turn = {"+x": -90, "-x": 90, "+y": 180, "-y": 0}[FRONT]
ob.data.transform(Matrix.Rotation(math.radians(turn), 4, "Z"))
co = np.array([v.co[:] for v in ob.data.vertices])
mn, mx = co.min(0), co.max(0)
k = LENGTH / (mx[1] - mn[1])
ob.data.transform(Matrix.Translation(Vector((-(mn[0] + mx[0]) / 2 * k, -(mn[1] + mx[1]) / 2 * k, -mn[2] * k))) @ Matrix.Scale(k, 4))
ob.data.update()
co = np.array([v.co[:] for v in ob.data.vertices])
mn, mx = co.min(0), co.max(0)
W, H, Lh = mx[0] - mn[0], mx[2], (mx[1] - mn[1]) / 2
lowband = co[:, 2] < 0.4 * H
Wb = float(co[lowband, 0].max() - co[lowband, 0].min())   # the body's width below the mirrors

# ── colour per vertex, sampled from the body picture ──
col = np.full((len(co), 3), 0.5)
img = None
for m in ob.data.materials:
    if m and m.use_nodes:
        for n in m.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image: img = n.image; break
    if img: break
if img and ob.data.uv_layers:
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, img.channels)[:, :, :3]
    uv = np.zeros(len(ob.data.loops) * 2); ob.data.uv_layers.active.data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
    vi = np.zeros(len(ob.data.loops), dtype=np.int64); ob.data.loops.foreach_get("vertex_index", vi)
    xs = np.clip((uv[:, 0] % 1) * (w - 1), 0, w - 1).astype(int); ys = np.clip((uv[:, 1] % 1) * (h - 1), 0, h - 1).astype(int)
    lc = px[ys, xs]
    acc = np.zeros((len(co), 3)); cnt = np.zeros(len(co))
    np.add.at(acc, vi, lc); np.add.at(cnt, vi, 1)
    col = np.where(cnt[:, None] > 0, acc / np.maximum(cnt, 1)[:, None], 0.5)
lum = col @ np.array([0.2126, 0.7152, 0.0722])
# the paint: the doors' colour (mid height, outer sides, middle of the car)
doors = (co[:, 2] > 0.3 * H) & (co[:, 2] < 0.58 * H) & (np.abs(co[:, 0]) > 0.34 * W) & (np.abs(co[:, 1]) < 0.4 * Lh)
paint = np.median(col[doors], 0) if doors.sum() > 8 else np.array([0.5, 0.5, 0.5])
paint_l = float(paint @ np.array([0.2126, 0.7152, 0.0722]))
paint_d = np.linalg.norm(col - paint, axis=1)
distinct = paint_l > 0.12 or np.ptp(paint) > 0.1   # a black/dark-grey car: paint looks like tyre
is_paint = (paint_d < 0.16) if distinct else np.zeros(len(co), bool)
print("PAINT", [round(float(x), 3) for x in paint], "distinct", bool(distinct))

# ── the number plates: where the generated plate was blanked dark grey (tools/models3d/deplate.mjs) ──
# faces at either end, near the middle, bumper height, facing out, plain grey. A clean UK plate goes
# over each (tools/cars/plate.png: white front, yellow rear), a few millimetres proud of the body.
plates = []
fc = np.array([p.center[:] for p in ob.data.polygons]); fn = np.array([p.normal[:] for p in ob.data.polygons])
fcol = np.array([col[list(p.vertices)].mean(0) for p in ob.data.polygons])
fsat = fcol.max(1) - fcol.min(1); flum = fcol @ np.array([0.2126, 0.7152, 0.0722])
for front in (True, False):
    endd = (fc[:, 1] - mn[1]) if front else (mx[1] - fc[:, 1])
    sel = (endd < 0.09 * 2 * Lh) & (np.abs(fc[:, 0]) < 0.22 * W) & (fc[:, 2] > 0.26 * H) & (fc[:, 2] < 0.62 * H) \
        & ((fn[:, 1] < -0.45) if front else (fn[:, 1] > 0.45))
    # deplate.mjs's fill is exactly (28, 28, 30)/255: look for that first, then any plain grey
    blank = sel & (np.abs(fcol - np.array([28, 28, 30]) / 255).max(1) < 0.035)
    sel = blank if blank.sum() >= 6 else sel & (fsat < 0.12) & (flum > 0.02) & (flum < 0.55)
    if sel.sum() < 6:
        # no blank found (the generated car had no plate there): a plate at a usual height on the centre line
        z0 = 0.4 * H
        pts = np.array([[-0.25, 0, z0 - 0.05], [0.25, 0, z0 + 0.05]])
        foot = (np.abs(fc[:, 0]) < 0.3) & (np.abs(fc[:, 2] - z0) < 0.08) & (endd < 0.12 * 2 * Lh)
        if foot.sum() == 0:
            print("PLATE none", "front" if front else "rear"); continue
        y = float(fc[foot, 1].min() if front else fc[foot, 1].max())
        nrm = fn[foot].mean(0); nrm /= np.linalg.norm(nrm)
        plates.append(dict(front=front, c=(0.0, y, z0), n=tuple(nrm), w=0.52, bw=0.5, bh=0.1))
        print("PLATE default", "front" if front else "rear", round(y, 3), round(z0, 3)); continue
    pts = fc[sel]
    # the biggest cluster round the middle (drop strays): within 0.35 m of the median
    med = np.median(pts, 0); keep = np.linalg.norm((pts - med)[:, [0, 2]], axis=1) < 0.35
    pts = pts[keep]; nrm = fn[sel][keep].mean(0); nrm /= np.linalg.norm(nrm)
    # plates are on the car's centre line; only their height comes from the blank
    cx, cz = 0.0, float((pts[:, 2].min() + pts[:, 2].max()) / 2)
    w = float(np.clip(pts[:, 0].max() - pts[:, 0].min(), 0.42, 0.66))
    # the plate sits on the most outward body surface across its whole footprint (a curved bumper)
    foot = (np.abs(fc[:, 0] - cx) < w / 2) & (np.abs(fc[:, 2] - cz) < w / 4.7 / 2 + 0.02) & (endd < 0.12 * 2 * Lh)
    ys = fc[foot, 1] if foot.sum() else pts[:, 1]
    y = float(ys.min() if front else ys.max())
    plates.append(dict(front=front, c=(cx, y, cz), n=tuple(nrm), w=w,
                       bw=float(min(0.8, pts[:, 0].max() - pts[:, 0].min())), bh=float(min(0.3, pts[:, 2].max() - pts[:, 2].min()))))
    print("PLATE", "front" if front else "rear", round(cx, 3), round(y, 3), round(cz, 3), "w", round(w, 3))

# a light copy takes the full car's plates (its few big triangles hide the blank): --plates-in / --plates-out
if opt("--plates-in"):
    try:
        plates = json.load(open(opt("--plates-in")))
        print("PLATES from", opt("--plates-in"), len(plates))
    except OSError:
        print("PLATES none to read")
if opt("--plates-out"):
    json.dump(plates, open(opt("--plates-out"), "w"))

# ── find the four wheels ──
low = co[:, 2] < 0.03 * H
wheels = []
for front in (True, False):
    for left in (True, False):
        q = low & ((co[:, 1] < 0) == front) & ((co[:, 0] > 0) == left)
        if q.sum() == 0: raise SystemExit("no contact patch")
        cy = float(co[q, 1].mean())
        side = (co[:, 0] > 0) == left
        band = (np.abs(co[:, 0]) > W / 2 - 0.26 * W) & side
        # first guess: the outermost points' height round the patch (the old proof's heuristic)
        near = band & (np.abs(co[:, 1] - cy) < 0.02 * 2 * Lh) & (co[:, 2] < 0.5 * H)
        zs = np.sort(co[near, 2]); r = (zs[int(0.85 * (len(zs) - 1))] / 2) if len(zs) else 0.33
        r = min(max(r, 0.22), 0.5)
        # refine on the tyre: not-paint, darkish vertices round the hub
        for _ in range(4):
            d = np.hypot(co[:, 1] - cy, co[:, 2] - r)
            tyre = band & (d < 1.3 * r) & ~is_paint & (lum < max(0.5, paint_l * 0.8 if distinct else 0.5))
            if tyre.sum() < 30: break
            ys_ = co[tyre, 1]
            cy = float((np.percentile(ys_, 1) + np.percentile(ys_, 99)) / 2)
            rr = float(np.percentile(np.hypot(co[tyre, 1] - cy, co[tyre, 2] - r), 98))
            r = 0.5 * r + 0.5 * min(max(rr, 0.22), 0.5)
        wheels.append(dict(front=front, left=left, y=cy, r=r))
print("WHEELS", json.dumps([{k: (round(v, 3) if isinstance(v, float) else v) for k, v in w.items()} for w in wheels]))

# ── cut each wheel out ──
parts = []
for w in wheels:
    co = np.array([v.co[:] for v in ob.data.vertices])
    if len(col) != len(co): raise SystemExit("vertex count moved")
    side = (co[:, 0] > 0) == w["left"]
    band = (np.abs(co[:, 0]) > W / 2 - 0.26 * W) & side
    d = np.hypot(co[:, 1] - w["y"], co[:, 2] - w["r"])
    sel = band & (d < w["r"] * CUT_R) & ~is_paint
    bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_mode(type="VERT"); bpy.ops.mesh.select_all(action="DESELECT")
    bm = bmesh.from_edit_mesh(ob.data); bm.verts.ensure_lookup_table()
    # only what is joined to the tyre itself: grow from the wheel's core (inside 0.75 r) through the
    # allowed vertices, so loose chips of bumper or arch inside the circle stay on the body (a chip
    # cut with the wheel would spin round the hub: seen in the 28 Nov film)
    allowed = set(int(i) for i in np.nonzero(sel)[0])
    seed = [i for i in allowed if d[i] < w["r"] * 0.75]
    keep = set(seed); stack = list(seed)
    while stack:
        v = bm.verts[stack.pop()]
        for e in v.link_edges:
            o = e.other_vert(v).index
            if o in allowed and o not in keep: keep.add(o); stack.append(o)
    sel = np.zeros(len(sel), bool); sel[list(keep)] = True
    for i in keep: bm.verts[i].select = True
    bm.select_flush(True); bmesh.update_edit_mesh(ob.data)
    bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    new = [o for o in bpy.context.scene.objects if o.type == "MESH" and o != ob and o not in parts][0]
    parts.append(new)
    # the separated vertices leave: keep the colour table in step
    keep = ~sel
    # bmesh separate drops vertices that lost all faces too; match by count
    if len(ob.data.vertices) != keep.sum():
        # loose vertices may remain; recompute colours by nearest old vertex (rare path)
        old = co[keep]; new_co = np.array([v.co[:] for v in ob.data.vertices])
        idx = [int(np.argmin(np.sum((old - p) ** 2, 1))) for p in new_co]
        col = col[keep][idx]; is_paint = is_paint[keep][idx]; lum = lum[keep][idx]
    else:
        col = col[keep]; is_paint = is_paint[keep]; lum = lum[keep]

# ── pivots: an empty at each hub, the wheel mesh its child ──
names = []
for o, w in zip(parts, wheels):
    vco = np.array([(o.matrix_world @ v.co)[:] for v in o.data.vertices])
    hub = Vector((float((vco[:, 0].min() + vco[:, 0].max()) / 2), w["y"], w["r"]))
    w["x"] = hub.x; w["width"] = float(vco[:, 0].max() - vco[:, 0].min())
    nm = "wheel_" + ("F" if w["front"] else "R") + ("L" if w["left"] else "R")
    o.data.transform(Matrix.Translation(-hub)); o.location = (0, 0, 0)
    o.name = nm + "_mesh"
    piv = bpy.data.objects.new(nm, None); bpy.context.scene.collection.objects.link(piv)
    piv.location = hub
    o.parent = piv
    names.append(nm)

# ── the arch liners: an arc over each wheel + a wall on its inner side, dark, both faces ──
liner_mat = bpy.data.materials.new("arch_liner"); liner_mat.use_nodes = True
bsdf = liner_mat.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (0.018, 0.018, 0.02, 1); bsdf.inputs["Roughness"].default_value = 0.95
liner_mat.use_backface_culling = False
lm = bpy.data.meshes.new("liners"); bm = bmesh.new()
SEG = 14
for w in wheels:
    sgn = 1 if w["left"] else -1
    # the liner's outer edge sits just inside the tyre's outer face (never out past the body: W
    # counts the mirrors), its wall about a quarter of the body's width further in
    x_out = w["x"] + sgn * w["width"] * 0.42
    x_in = x_out - sgn * (0.30 if w["front"] else 0.26) * Wb
    R = w["r"] * (CUT_R + 0.04)
    ring_o, ring_i = [], []
    # the body as it is after the cuts: its outer skin on this side, to tuck the liner's edge under
    bco = np.array([v.co[:] for v in ob.data.vertices])
    bside = bco[(bco[:, 0] * sgn) > abs(x_in) + 0.02]
    for s in range(SEG + 1):
        a = math.radians(-4 + (188 * s / SEG))   # from the hub's height at the back, over the top, to the front
        y = w["y"] + R * math.cos(a); z = w["r"] + R * math.sin(a)
        # never out past the body here: 3.5 cm under its skin at this point of the arch (a low,
        # tucked-in fender on a sports car otherwise shows the liner through the paint)
        near = bside[np.hypot(bside[:, 1] - y, bside[:, 2] - z) < 0.09]
        xo = x_out
        if len(near): xo = sgn * max(abs(x_in) + 0.04, min(abs(x_out), float(np.abs(near[:, 0]).max()) - 0.07))
        # and never up through the bonnet or wing: under the lowest body surface above this point
        def under(x, z0):
            col = bco[(np.abs(bco[:, 0] - x) < 0.1) & (np.abs(bco[:, 1] - y) < 0.1) & (bco[:, 2] > w["r"] * 1.5)]
            return min(z0, float(col[:, 2].min()) - 0.09) if len(col) else z0
        ring_o.append(bm.verts.new((xo, y, under(xo, z)))); ring_i.append(bm.verts.new((x_in, y, under(x_in, z))))
    for s in range(SEG):
        bm.faces.new((ring_o[s], ring_o[s + 1], ring_i[s + 1], ring_i[s]))
    # the inner wall: a fan from the hub out to the arc, closed along the bottom
    c = bm.verts.new((x_in, w["y"], w["r"] * 0.55))
    for s in range(SEG):
        bm.faces.new((c, ring_i[s], ring_i[s + 1]))
    bm.faces.new((c, ring_i[SEG], ring_i[0]))
bm.to_mesh(lm); bm.free()
lo = bpy.data.objects.new("liners", lm); bpy.context.scene.collection.objects.link(lo)
lm.materials.append(liner_mat)
# the plates (their own small material: one picture, both plates)
if plates:
    PLATE_PNG = opt("--plate", __file__.replace("cut_wheels.py", "plate.png"))
    pm = bpy.data.materials.new("plate"); pm.use_nodes = True
    pb = pm.node_tree.nodes.get("Principled BSDF"); pb.inputs["Roughness"].default_value = 0.45
    tn = pm.node_tree.nodes.new("ShaderNodeTexImage"); tn.image = bpy.data.images.load(PLATE_PNG)
    pm.node_tree.links.new(tn.outputs["Color"], pb.inputs["Base Color"])
    plm = bpy.data.meshes.new("plates"); pbm = bmesh.new()
    uvl = pbm.loops.layers.uv.new("UVMap")
    for pl in plates:
        # the plate's plane: facing out along the end's normal, upright, 4.7 : 1
        n = Vector(pl["n"]); n.x = 0; n.normalize()
        up = Vector((0, 0, 1)); up = (up - n * up.dot(n)).normalized()
        side = up.cross(n).normalized()
        c = Vector(pl["c"]) + n * 0.012
        hw, hh = pl["w"] / 2, pl["w"] / 4.7 / 2
        corners = [c - side * hw - up * hh, c + side * hw - up * hh, c + side * hw + up * hh, c - side * hw + up * hh]
        vs = [pbm.verts.new(q) for q in corners]
        f = pbm.faces.new(vs)
        if f.normal.dot(n) < 0: f.normal_flip()
        v0, v1 = (0.5, 1.0) if pl["front"] else (0.0, 0.5)   # white front: top half; yellow rear: bottom half
        # read the plate left-to-right from outside: u along `side` as seen facing the plate
        uvs = [(0, v0), (1, v0), (1, v1), (0, v1)]
        for lp in f.loops:
            k = vs.index(lp.vert); u, v = uvs[k]
            lp[uvl].uv = (u, v)   # checked by eye on the hatch: both read left to right
        # behind the plate, a black surround the size of the old smudge (the generated lettering never shows)
        bw, bh = pl["bw"] / 2 + 0.025, pl["bh"] / 2 + 0.025
        bw, bh = max(bw, hw + 0.02), max(bh, hh + 0.02)
        cb = Vector(pl["c"]) + n * 0.006
        bvs = [pbm.verts.new(q) for q in [cb - side * bw - up * bh, cb + side * bw - up * bh, cb + side * bw + up * bh, cb - side * bw + up * bh]]
        bf = pbm.faces.new(bvs)
        if bf.normal.dot(n) < 0: bf.normal_flip()
        for lp in bf.loops: lp[uvl].uv = (0.0078, 0.75)   # the plate picture's black border
    pbm.to_mesh(plm); pbm.free()
    plo = bpy.data.objects.new("plates", plm); bpy.context.scene.collection.objects.link(plo)
    plm.materials.append(pm)
    bpy.ops.object.select_all(action="DESELECT"); plo.select_set(True); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.join()

# join the liners into the body (one node, its own material)
bpy.ops.object.select_all(action="DESELECT"); lo.select_set(True); ob.select_set(True); bpy.context.view_layer.objects.active = ob
bpy.ops.object.join()
ob.name = "body"; ob.data.name = "body"

def tri_count(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)
info = dict(length=LENGTH, width=round(float(W), 3), height=round(float(H), 3), body_tris=tri_count(ob),
            wheels=[dict(name=n, x=round(w["x"], 3), y=round(w["y"], 3), r=round(w["r"], 3), tris=tri_count(o)) for n, w, o in zip(names, wheels, parts)])
print("INFO", json.dumps(info))

# ── export ──
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_yup=True, export_apply=False, export_image_format="AUTO")

# ── stills (the eye check: no holes, no floating wheels, wheels round and centred) ──
if STILLS:
    scn = bpy.context.scene
    scn.render.engine = "CYCLES"; scn.cycles.device = "CPU"; scn.cycles.samples = 16; scn.cycles.use_denoising = False
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 3.2
    sun.rotation_euler = (math.radians(35), math.radians(15), math.radians(200)); scn.collection.objects.link(sun)
    scn.world = bpy.data.worlds.new("w"); scn.world.use_nodes = True
    scn.world.node_tree.nodes["Background"].inputs[0].default_value = (0.74, 0.77, 0.82, 1)
    bpy.ops.mesh.primitive_plane_add(size=30); gp = bpy.context.active_object
    gm = bpy.data.materials.new("g"); gm.use_nodes = True; gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.35, 0.36, 0.38, 1); gp.data.materials.append(gm)
    scn.render.resolution_x, scn.render.resolution_y = 780, 520
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); scn.collection.objects.link(cam); scn.camera = cam
    cam.data.lens = 50
    tgt = Vector((0, 0, H * 0.45))
    for n in names:
        if n.startswith("wheel_F"): bpy.data.objects[n].rotation_euler.z = math.radians(18)
    def shoot(name, d, dist):
        cam.location = tgt + d.normalized() * dist
        cam.rotation_euler = (tgt - cam.location).to_track_quat("-Z", "Y").to_euler()
        scn.render.filepath = STILLS + name + ".png"; bpy.ops.render.render(write_still=True)
    shoot("_front", Vector((1.1, -1.25, 0.45)), LENGTH * 1.55)     # front 3/4 (front is -Y), left side
    shoot("_side", Vector((1, 0, 0.06)), LENGTH * 1.45)            # straight side, wheels in profile
    shoot("_rear", Vector((-1.1, 1.2, 0.4)), LENGTH * 1.55)        # rear 3/4, the other side
    # the close pass (the camera the car rolls past at the gate): the door, a metre and a half off
    tgt = Vector((0, 0.2, H * 0.5))
    shoot("_close", Vector((1, 0.35, 0.1)), 2.2)
