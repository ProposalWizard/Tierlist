"""Star Pass rewards on their podiums: the 16 new collectibles + the red car
(piece 2, 25 Oct 2026).

  blender -b --factory-startup -P tools/star-pass-art/render_pass_rewards.py -- <out_dir> [samples] [job,job,...]
  PODIUM_W=430 python3 tools/star-pass-art/make_webp.py <out_dir> <job> public/star/star-pass/reward-<job>.webp 1

Every reward is built here from simple shapes (no downloaded models, no real
brands, logos or badges) and rendered as ONE still, standing on the podium of
its level on the road: levels 1-20 premier, 21-40 europa, 41-60 champions,
61-80 worldcup, 81-100 ballondor; every 10th level the great podium, the rest
the medium one; level 100 the crown stand. Same camera, lights and podiums as
render_star_pass.py, so they sit with the older pictures.

Jobs (card -> level):
  scuffed-ball 8 · hatchback 20 · steel-watch 36 · sports-car 40 (replaces the
  borrowed Ferrari) · penthouse 50 · iced-chain 54 · european-ball 56 ·
  gold-watch 66 · supercar 70 · trophy-wall 74 · mansion 80 · night-suit 86 ·
  golden-ball 88 · private-jet 90 · hof-plaque 92 · diamond-watch 98 ·
  golden-set 100

Cycles on CPU, denoiser off (this container has no OpenImageDenoise); the
frames are rendered big and shrunk by make_webp.py, which cleans the noise.
"""
import bpy, bmesh, math, os, sys
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import render_star_pass as base  # noqa: E402
import render_star_pass_items as items  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else os.path.join(HERE, "out")
SAMPLES = int(argv[1]) if len(argv) > 1 else 128
ONLY = argv[2].split(",") if len(argv) > 2 and argv[2] != "all" else None

DECK = {"medium": 0.79, "great": 1.55, "top": 1.35}

# ── Materials ───────────────────────────────────────────────────────────────


def M(name, color, metallic=0.0, rough=0.35, coat=0.0, emit=None, strength=0.0,
      transmission=0.0, ior=1.45, sheen=0.0, coat_rough=0.03):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = coat_rough
    b.inputs["Transmission Weight"].default_value = transmission
    b.inputs["IOR"].default_value = ior
    b.inputs["Sheen Weight"].default_value = sheen
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    return m


def gold(rough=0.16, name="gold"):
    return M(name, (1.0, 0.74, 0.3), metallic=1.0, rough=rough)


def steel(rough=0.2, name="steel"):
    return M(name, (0.8, 0.81, 0.84), metallic=1.0, rough=rough)


def diamond():
    return bpy.data.materials.get("diamond") or M("diamond", (1, 1, 1), rough=0.0, transmission=1.0, ior=2.42)


def iced(name="iced"):
    """White metal that sparkles: a fine cell bump reads as tiny set stones."""
    m = M(name, (0.93, 0.94, 0.98), metallic=1.0, rough=0.06)
    nt = m.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 90
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.9
    bump.inputs["Distance"].default_value = 0.01
    nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
    nt.links.new(vor.outputs["Distance"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], nt.nodes["Principled BSDF"].inputs["Normal"])
    return m


# ── Shapes ──────────────────────────────────────────────────────────────────


def link(o):
    bpy.context.scene.collection.objects.link(o)
    return o


def smooth(o, angle=35):
    for p in o.data.polygons:
        p.use_smooth = True
    o.data.use_auto_smooth = True
    o.data.auto_smooth_angle = math.radians(angle)
    return o


def bevel(o, w=0.03, segs=3, angle=None):
    mod = o.modifiers.new("bev", "BEVEL")
    mod.width = w
    mod.segments = segs
    mod.limit_method = "ANGLE"
    if angle:
        mod.angle_limit = math.radians(angle)
    return o


def subsurf(o, lv=2):
    s = o.modifiers.new("sub", "SUBSURF")
    s.levels = s.render_levels = lv
    return o


def from_bm(bm, name, material):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = link(bpy.data.objects.new(name, me))
    if material:
        me.materials.append(material)
    return o


def put(o, parent=None, loc=None, rot=None, scale=None):
    if parent is not None:
        o.parent = parent
    if loc is not None:
        o.location = loc
    if rot is not None:
        o.rotation_euler = rot
    if scale is not None:
        o.scale = scale if hasattr(scale, "__len__") else (scale,) * 3
    return o


def empty(name="e", parent=None, loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0):
    e = link(bpy.data.objects.new(name, None))
    return put(e, parent, loc, rot, scale)


def box(size, loc, material, parent=None, rot=(0, 0, 0), bev=0.02, segs=3, name="box"):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    o = from_bm(bm, name, material)
    if bev:
        bevel(o, bev, segs)
    smooth(o)
    return put(o, parent, loc, rot)


def sphere(r, loc, material, parent=None, scale=None, segs=48, rings=24, name="sph", flat=False):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)
    o = from_bm(bm, name, material)
    if not flat:
        smooth(o, 180)
    return put(o, parent, loc, None, scale)


def cylinder(r, h, loc, material, parent=None, rot=(0, 0, 0), verts=48, bev=0.02, r2=None, name="cyl"):
    """Base at loc (local z from 0 to h), unless rotated."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts,
                          radius1=r, radius2=r if r2 is None else r2, depth=h)
    bmesh.ops.translate(bm, vec=(0, 0, h / 2), verts=bm.verts)
    o = from_bm(bm, name, material)
    if bev:
        bevel(o, bev, 3)
    smooth(o)
    return put(o, parent, loc, rot)


def torus(R, r, loc, material, parent=None, rot=(0, 0, 0), name="tor", seg=64, mseg=16, scale=None):
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        ring = []
        for j in range(mseg):
            b = 2 * math.pi * j / mseg
            rr = R + r * math.cos(b)
            ring.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), r * math.sin(b))))
        rings.append(ring)
    for i in range(seg):
        for j in range(mseg):
            a, b = rings[i], rings[(i + 1) % seg]
            bm.faces.new((a[j], b[j], b[(j + 1) % mseg], a[(j + 1) % mseg]))
    o = from_bm(bm, name, material)
    smooth(o, 180)
    return put(o, parent, loc, rot, scale)


def lathe(profile, material, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), segs=64, name="lathe", scale=None):
    """Spin (r, z) points round the z axis. r == 0 makes a pole."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        if r < 1e-6:
            rings.append([bm.verts.new((0, 0, z))])
        else:
            rings.append([bm.verts.new((r * math.cos(2 * math.pi * k / segs), r * math.sin(2 * math.pi * k / segs), z))
                          for k in range(segs)])
    for a, b in zip(rings, rings[1:]):
        for k in range(segs):
            k2 = (k + 1) % segs
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                bm.faces.new((a[0], b[k], b[k2]))
            elif len(b) == 1:
                bm.faces.new((a[k], b[0], a[k2]))
            else:
                bm.faces.new((a[k], b[k], b[k2], a[k2]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = from_bm(bm, name, material)
    smooth(o, 50)
    return put(o, parent, loc, rot, scale)


def prism(pts, width, material, parent=None, y0=0.0, squeeze=None, bev=0.05, segs=4, name="prism", plane="xz"):
    """A side profile (x, z) pushed out across y (width, centred on y0).
    squeeze(z) narrows it with height (a car's tumblehome). plane="xy" lays
    the profile flat (x, y) and pushes it up z instead."""
    bm = bmesh.new()
    n = len(pts)
    A, B = [], []
    for (u, v) in pts:
        if plane == "xz":
            s = squeeze(v) if squeeze else 1.0
            A.append(bm.verts.new((u, y0 - width / 2 * s, v)))
            B.append(bm.verts.new((u, y0 + width / 2 * s, v)))
        else:
            A.append(bm.verts.new((u, v, y0 - width / 2)))
            B.append(bm.verts.new((u, v, y0 + width / 2)))
    bm.faces.new(A)
    bm.faces.new(B[::-1])
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((A[i], A[j], B[j], B[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = from_bm(bm, name, material)
    if bev:
        bevel(o, bev, segs, 40)
    smooth(o, 40)
    return put(o, parent)


def grow(before, pivot, s):
    """Scale everything made since `before` about `pivot` (a reward that
    reads too small on its podium)."""
    bpy.context.view_layer.update()
    root = empty("grow", None, pivot)
    bpy.context.view_layer.update()
    inv = root.matrix_world.inverted()
    for o in set(bpy.data.objects) - before:
        if o.parent is None and o is not root:
            mw = o.matrix_world.copy()
            o.parent = root
            o.matrix_parent_inverse = inv
            o.matrix_world = mw
    root.scale = (s, s, s)
    return root


def star_pts(R, r, n=5, rot=math.pi / 2):
    return [((R if i % 2 == 0 else r) * math.cos(rot + i * math.pi / n),
             (R if i % 2 == 0 else r) * math.sin(rot + i * math.pi / n)) for i in range(2 * n)]


def inset(poly, d):
    """Shrink a convex polygon by d."""
    cx = sum(p[0] for p in poly) / len(poly)
    cz = sum(p[1] for p in poly) / len(poly)
    lines = []
    n = len(poly)
    for i in range(n):
        p, q = np.array(poly[i]), np.array(poly[(i + 1) % n])
        t = (q - p) / np.linalg.norm(q - p)
        nrm = np.array([-t[1], t[0]])
        if np.dot(np.array([cx, cz]) - p, nrm) < 0:
            nrm = -nrm
        lines.append((p + nrm * d, t))
    out = []
    for i in range(n):
        (p1, t1), (p2, t2) = lines[i - 1], lines[i]
        A = np.array([t1, -t2]).T
        s = np.linalg.solve(A, p2 - p1)
        out.append(tuple(p1 + t1 * s[0]))
    return out


def clip_x(poly, lo, hi):
    def clip(poly, keep, xedge):
        out = []
        for i in range(len(poly)):
            a, b = poly[i - 1], poly[i]
            ia, ib = keep(a[0]), keep(b[0])
            if ib:
                if not ia:
                    t = (xedge - a[0]) / (b[0] - a[0])
                    out.append((xedge, a[1] + t * (b[1] - a[1])))
                out.append(b)
            elif ia:
                t = (xedge - a[0]) / (b[0] - a[0])
                out.append((xedge, a[1] + t * (b[1] - a[1])))
        return out
    return clip(clip(poly, lambda x: x >= lo, lo), lambda x: x <= hi, hi)


def strip(a, b, out_d, in_d, centroid):
    """A thin quad along the edge a-b of a polygon, standing proud by out_d."""
    a, b = np.array(a), np.array(b)
    t = (b - a) / np.linalg.norm(b - a)
    nrm = np.array([-t[1], t[0]])
    if np.dot(np.array(centroid) - a, nrm) > 0:
        nrm = -nrm
    a2, b2 = a + t * 0.05, b - t * 0.05
    return [tuple(a2 + nrm * out_d), tuple(b2 + nrm * out_d), tuple(b2 - nrm * in_d), tuple(a2 - nrm * in_d)]


# ── Ball textures (drawn straight onto the sphere by direction) ─────────────


def _dirs(w, h):
    lat = (0.5 - (np.arange(h) + 0.5) / h) * math.pi
    lon = ((np.arange(w) + 0.5) / w) * 2 * math.pi - math.pi
    LON, LAT = np.meshgrid(lon, lat)
    return np.stack([np.cos(LAT) * np.cos(LON), np.cos(LAT) * np.sin(LON), np.sin(LAT)], -1).astype(np.float32)


def football_panels(w=1536, h=768):
    """Classic 32-panel ball: returns (is_pentagon, seam 0..1) per pixel."""
    phi = (1 + 5 ** 0.5) / 2
    ico = []
    for a in (-1, 1):
        for b in (-phi, phi):
            ico += [(0, a, b), (a, b, 0), (b, 0, a)]
    dod = [(x, y, z) for x in (-1, 1) for y in (-1, 1) for z in (-1, 1)]
    for a in (-1 / phi, 1 / phi):
        for b in (-phi, phi):
            dod += [(0, b, a), (b, a, 0), (a, 0, b)]
    C = np.array(ico + dod, dtype=np.float32)
    C /= np.linalg.norm(C, axis=1, keepdims=True)
    hgt = np.array([2.3279] * 12 + [2.2672] * 20, dtype=np.float32)  # face distances
    d = _dirs(w, h).reshape(-1, 3)
    s = (d @ C.T) / hgt
    order = np.argsort(-s, axis=1)[:, :2]
    s1 = np.take_along_axis(s, order[:, :1], 1)[:, 0]
    s2 = np.take_along_axis(s, order[:, 1:2], 1)[:, 0]
    pent = (order[:, 0] < 12).reshape(h, w)
    gap = ((s1 - s2) / s1).reshape(h, w)
    seam = np.clip(1 - gap / 0.012, 0, 1)
    return pent, seam, d.reshape(h, w, 3)


def _img(name, arr, w, h, color=True):
    img = bpy.data.images.new(name, w, h, alpha=False, float_buffer=True)
    rgba = np.ones((h, w, 4), dtype=np.float32)
    if arr.ndim == 2:
        arr = np.repeat(arr[..., None], 3, -1)
    rgba[..., :3] = arr[::-1]
    img.pixels.foreach_set(rgba.ravel())
    if not color:
        img.colorspace_settings.name = "Non-Color"
    return img


def ball_material(name, col_img, h_img, rough=0.35, metallic=0.0, coat=0.5, rough_img=None, bump=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Coat Weight"].default_value = coat
    tc = nt.nodes.new("ShaderNodeTexCoord")
    tex = nt.nodes.new("ShaderNodeTexEnvironment")
    tex.image = col_img
    nt.links.new(tc.outputs["Object"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
    texh = nt.nodes.new("ShaderNodeTexEnvironment")
    texh.image = h_img
    nt.links.new(tc.outputs["Object"], texh.inputs["Vector"])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = bump
    bp.inputs["Distance"].default_value = 0.02
    nt.links.new(texh.outputs["Color"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    if rough_img is not None:
        tr = nt.nodes.new("ShaderNodeTexEnvironment")
        tr.image = rough_img
        nt.links.new(tc.outputs["Object"], tr.inputs["Vector"])
        nt.links.new(tr.outputs["Color"], b.inputs["Roughness"])
    return m


def _noise(d, n=24, f=3.0, seed=1):
    rng = np.random.default_rng(seed)
    acc = np.zeros(d.shape[:2], np.float32)
    for _ in range(n):
        k = rng.normal(size=3)
        k = k / np.linalg.norm(k) * f * rng.uniform(0.6, 1.8)
        acc += np.sin(d @ k.astype(np.float32) + rng.uniform(0, 6.3))
    return acc / math.sqrt(n / 2)


def scuffed_ball_material():
    w, h = 1536, 768
    pent, seam, d = football_panels(w, h)
    white = np.array([0.78, 0.72, 0.6])
    black = np.array([0.03, 0.03, 0.035])
    col = np.where(pent[..., None], black, white).astype(np.float32)
    # Grime: low, wide patches of brown-grey, scuffs where the panels wore.
    g = _noise(d, 30, 3.0, 7)
    grime = np.clip((g + 0.1) / 1.4, 0, 1)[..., None] * 0.7
    col = col * (1 - grime) + np.array([0.33, 0.27, 0.19]) * grime
    scuff = np.clip((_noise(d, 40, 9.0, 3) - 0.8) / 0.6, 0, 1)
    rng = np.random.default_rng(11)
    for _ in range(120):  # scratches: short bits of great circles
        p = rng.normal(size=3); p /= np.linalg.norm(p)
        c = rng.normal(size=3); c -= p * (c @ p); c /= np.linalg.norm(c)
        line = (np.abs(d @ p.astype(np.float32)) < rng.uniform(0.002, 0.005)) & (d @ c.astype(np.float32) > rng.uniform(0.93, 0.985))
        scuff = np.maximum(scuff, line * rng.uniform(0.5, 1.0))
    scuff_col = np.where(pent[..., None], np.array([0.42, 0.4, 0.38]), np.array([0.5, 0.44, 0.36]))
    col = col * (1 - scuff[..., None]) + scuff_col * scuff[..., None]
    col = col * (1 - seam[..., None] * 0.75)
    height = 1 - seam * 0.9 - scuff * 0.25
    rough = 0.45 + scuff * 0.35 + grime[..., 0] * 0.3
    return ball_material("scuffed", _img("sc_c", col, w, h), _img("sc_h", height, w, h, False), coat=0.15,
                         rough_img=_img("sc_r", rough, w, h, False), bump=0.6)


def gold_ball_material():
    w, h = 1536, 768
    pent, seam, _ = football_panels(w, h)
    col = np.where(pent[..., None], np.array([0.95, 0.62, 0.22]), np.array([1.0, 0.77, 0.34])).astype(np.float32)
    col = col * (1 - seam[..., None] * 0.6)
    rough = np.where(pent, 0.28, 0.12) + seam * 0.2
    return ball_material("goldball", _img("gb_c", col, w, h), _img("gb_h", 1 - seam, w, h, False),
                         metallic=1.0, coat=0.0, rough_img=_img("gb_r", rough, w, h, False), bump=0.8)


def star_ball_material(bg, star, ring):
    """The Star Ball's eight stars (render_star_pass_items.star_ball_images),
    in any colours: here a navy ball with white stars for nights in Europe."""
    w, h = 2048, 1024
    d = _dirs(w, h).astype(np.float64)
    col = np.ones((h, w, 3)) * np.array(bg)
    height = np.ones((h, w))
    R, r_in = 0.60, 0.25
    po = np.array([R, 0.0])
    pi_ = np.array([r_in * math.cos(math.pi / 5), r_in * math.sin(math.pi / 5)])
    e = pi_ - po
    elen = np.linalg.norm(e)
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                c = np.array([sx, sy, sz]) / math.sqrt(3)
                t1 = np.cross([0, 0, 1.0], c); t1 /= np.linalg.norm(t1)
                t2 = np.cross(c, t1)
                z = d @ c
                m = z > 0.3
                x = (d @ t1) / np.maximum(z, 1e-3)
                y = (d @ t2) / np.maximum(z, 1e-3)
                th = np.arctan2(y, x) + 0.3 * sx + 0.7 * sy * sz
                rr = np.hypot(x, y)
                seg = 2 * math.pi / 5
                a = seg / 2 - np.abs(np.mod(th, seg) - seg / 2)
                px, py = rr * np.cos(a), rr * np.sin(a)
                dist = (e[0] * (py - po[1]) - e[1] * (px - po[0])) / elen
                col[m & (dist > 0)] = star
                col[m & (dist < 0) & (dist > -0.026)] = ring
                height[m & (np.abs(dist) < 0.008)] = 0.0
    return ball_material("euroball", _img("eb_c", col.astype(np.float32), w, h),
                         _img("eb_h", height.astype(np.float32), w, h, False), rough=0.28, coat=0.8)


# ── Cars ────────────────────────────────────────────────────────────────────


CARS = {
    # body: side profile (x forward, z up); glass: the cabin; wheels at axles.
    "hatchback": dict(
        W=1.72, wr=0.32, axles=(1.2, -1.12),
        body=[(-1.82, 0.2), (1.78, 0.2), (1.9, 0.36), (1.86, 0.62), (1.25, 0.76), (0.8, 0.86), (-1.62, 0.92), (-1.86, 0.86), (-1.9, 0.36)],
        glass=[(0.95, 0.82), (0.05, 1.44), (-1.42, 1.44), (-1.8, 0.86)], gw=1.52, tumble=0.84, pillar=-0.35,
        head=(1.84, 0.55), tail=(-1.88, 0.72), grille=(1.9, 0.38), bev=0.17),
    "sports": dict(
        W=1.96, wr=0.34, axles=(1.42, -1.36),
        body=[(-2.12, 0.18), (2.12, 0.18), (2.3, 0.33), (2.2, 0.46), (1.85, 0.66), (1.45, 0.82), (1.0, 0.78), (0.55, 0.76),
              (-0.9, 0.84), (-1.35, 0.9), (-1.95, 0.86), (-2.22, 0.74), (-2.26, 0.36)],
        glass=[(0.7, 0.72), (-0.15, 1.18), (-0.9, 1.18), (-1.95, 0.82)], gw=1.38, tumble=0.74, pillar=None,
        head=(2.08, 0.55), tail=(-2.2, 0.66), grille=(2.27, 0.3), bev=0.14),
    "super": dict(
        W=2.12, wr=0.35, axles=(1.5, -1.42),
        body=[(-2.2, 0.17), (2.2, 0.17), (2.42, 0.27), (2.3, 0.42), (1.95, 0.6), (1.5, 0.82), (1.1, 0.74), (0.75, 0.7),
              (-1.0, 0.84), (-1.45, 0.92), (-2.05, 0.9), (-2.36, 0.82), (-2.38, 0.34)],
        glass=[(0.85, 0.64), (-0.15, 1.08), (-0.95, 1.08), (-2.0, 0.86)], gw=1.3, tumble=0.66, pillar=None,
        head=(2.12, 0.47), tail=(-2.34, 0.7), grille=(2.36, 0.27), wing=True, intake=True, bev=0.09),
}


def car(kind, paint, parent=None, at=(0, 0, 0), rot_z=0.0, scale=1.0, metal=None, all_gold=False):
    S = CARS[kind]
    root = empty("car", parent, at, (0, 0, math.radians(rot_z)), scale)
    W, wr = S["W"], S["wr"]
    glass = M("glass", (0.02, 0.025, 0.035), rough=0.04, coat=1.0) if not all_gold else gold(0.08, "gglass")
    trim = M("trim", (0.02, 0.02, 0.022), rough=0.4) if not all_gold else gold(0.3, "gtrim")
    rubber = M("tyre", (0.025, 0.025, 0.028), rough=0.65) if not all_gold else gold(0.35, "gtyre")
    alloy = metal or (steel(0.18, "alloy") if not all_gold else gold(0.12, "galloy"))
    head = M("head", (1, 1, 1), emit=(1, 0.97, 0.9), strength=6) if not all_gold else gold(0.05, "ghead")
    tail = M("tail", (0.6, 0.0, 0.0), emit=(1, 0.05, 0.02), strength=5) if not all_gold else gold(0.3, "gtail")

    body = prism(S["body"], W, paint, root, bev=0, name="body")
    body.data.auto_smooth_angle = math.radians(50)
    # Wheel arches: cut out of the body, the wheels sit inside.
    for ax in S["axles"]:
        cut = cylinder(wr + 0.06, W + 1, (ax, -(W + 1) / 2, wr), paint, root, rot=(-math.pi / 2, 0, 0), bev=0, name="cut")
        cut.hide_render = True
        cut.hide_viewport = True
        bo = body.modifiers.new("arch", "BOOLEAN")
        bo.operation = "DIFFERENCE"
        bo.object = cut
        bo.solver = "EXACT"
    bevel(body, S["bev"], 6, 25)

    g = S["glass"]
    zb = min(p[1] for p in g)
    zt = max(p[1] for p in g)
    tum = lambda z: 1 - (1 - S["tumble"]) * max(0.0, (z - zb) / (zt - zb))
    # The cabin in paint, its windows dark glass standing just proud of it.
    prism(g, S["gw"], paint, root, squeeze=tum, bev=0.14, segs=5, name="cabin")
    side = inset(g, 0.075)
    if S["pillar"] is not None:
        xb = S["pillar"]
        parts = [clip_x(side, xb + 0.05, 9), clip_x(side, -9, xb - 0.05)]
    else:
        parts = [side]
    for p in parts:
        prism(p, S["gw"] + 0.035, glass, root, squeeze=tum, bev=0.02, segs=2, name="sidewin")
    cen = (sum(p[0] for p in g) / 4, sum(p[1] for p in g) / 4)
    prism(strip(g[0], g[1], 0.014, 0.03, cen), S["gw"] * 0.86, glass, root, squeeze=tum, bev=0.015, segs=2, name="screen")
    prism(strip(g[2], g[3], 0.014, 0.03, cen), S["gw"] * 0.82, glass, root, squeeze=tum, bev=0.015, segs=2, name="rear")

    # Wheels.
    for ax in S["axles"]:
        for sgn in (-1, 1):
            y = sgn * (W / 2 - 0.17)
            wheel = empty("wheel", root, (ax, y, wr), (sgn * math.pi / 2, 0, 0))
            cylinder(wr, 0.26, (0, 0, -0.13), rubber, wheel, bev=0.07, name="tyre")
            # (the wheel's local -z points out of the car on both sides)
            cylinder(wr * 0.7, 0.03, (0, 0, -0.15), alloy, wheel, bev=0.01, name="rim")
            cylinder(wr * 0.58, 0.012, (0, 0, -0.157), trim, wheel, bev=0, name="hubdark")
            for k in range(5):
                a = k * 2 * math.pi / 5
                box((wr * 0.58, 0.07, 0.035), (math.cos(a) * wr * 0.29, math.sin(a) * wr * 0.29, -0.165),
                    alloy, wheel, rot=(0, 0, a), bev=0.01, name="spoke")
            cylinder(0.07, 0.04, (0, 0, -0.2), alloy, wheel, bev=0.01, name="cap")
    # Lights, grille, mirrors.
    hx, hz = S["head"]
    tx, tz = S["tail"]
    for sgn in (-1, 1):
        box((0.14, 0.34, 0.08), (hx, sgn * W * 0.32, hz), head, root, bev=0.03, name="headl")
        box((0.1, 0.36, 0.07), (tx, sgn * W * 0.33, tz), tail, root, bev=0.025, name="taill")
        mx = g[0][0] - 0.12
        box((0.16, 0.12, 0.09), (mx, sgn * (S["gw"] / 2 + 0.12), g[0][1] + 0.08), paint, root, bev=0.035, name="mirror")
    gx, gz = S["grille"]
    box((0.08, W * 0.42, 0.11), (gx, 0, gz), trim, root, bev=0.03, name="grille")
    if S.get("wing"):
        box((0.36, W * 0.96, 0.05), (-2.08, 0, 1.2), paint, root, bev=0.02, name="wing")
        for sgn in (-1, 1):
            box((0.12, 0.05, 0.36), (-2.04, sgn * W * 0.32, 1.02), trim, root, bev=0.01, name="strut")
            box((0.07, W * 0.12, 0.14), (-2.4, sgn * W * 0.38, 0.32), trim, root, bev=0.02, name="exhaust")
    if S.get("intake"):
        for sgn in (-1, 1):
            box((0.55, 0.06, 0.2), (-0.72, sgn * W / 2, 0.52), trim, root, rot=(0, math.radians(-8), 0), bev=0.03, name="intake")
    return root


# ── Watches ─────────────────────────────────────────────────────────────────


def watch(case, strap, dial_col, marker, deck, gems=False, parent=None, s=1.4):
    root = empty("watch", parent, (0, 0.2, deck), (0, 0, math.radians(-28)), s)
    R = 0.92
    rz, ry = 1.0, 0.82            # the bracelet loop round its cushion
    zc = rz + 0.07
    yc = ry                         # the case at the loop's front (y = 0)
    # Cushion inside the loop.
    velvet = M("velvet", (0.05, 0.05, 0.06), rough=0.75, sheen=0.6)
    cush = cylinder(1.0, 0.62, (-0.31, yc, zc), velvet, root, rot=(0, math.pi / 2, 0), bev=0.1, name="cushion")
    cush.scale = (rz - 0.1, ry - 0.08, 1)
    # Bracelet: links round the loop, leaving the case's place free.
    n = 46
    for i in range(n):
        t = 0.42 + (2 * math.pi - 0.84) * i / (n - 1)
        y = yc - ry * math.cos(t)
        z = zc + rz * math.sin(t)
        ang = math.atan2(rz * math.cos(t), ry * math.sin(t))
        lk = empty("lk", root, (0, y, z), (ang, 0, 0))
        box((0.2, 0.085, 0.075), (0, 0, 0), strap, lk, bev=0.025, name="mid")
        for sx in (-1, 1):
            box((0.17, 0.09, 0.07), (sx * 0.2, 0, 0), strap, lk, bev=0.025, name="side")
        if gems:
            sphere(0.035, (0, 0, 0.042), diamond(), lk, scale=(1, 1, 0.7), segs=8, rings=4, name="gem", flat=True)
    # The case faces the camera, leaning back a little.
    # (face local z points out of the dial: toward the camera, tipped up 18 deg)
    face = empty("face", root, (0, 0, zc), (math.radians(90 - 18), 0, 0))
    cylinder(R, 0.3, (0, 0, -0.2), case, face, bev=0.05, verts=64, name="case")
    torus(R - 0.05, 0.075, (0, 0, 0.1), case, face, name="bezel")
    cylinder(R - 0.1, 0.03, (0, 0, 0.09), dial_col, face, bev=0.005, verts=64, name="dial")
    for k in range(4):  # lugs
        sx, sy = (-1 if k % 2 else 1), (-1 if k // 2 else 1)
        box((0.14, 0.32, 0.16), (sx * 0.34, sy * (R - 0.02), -0.06), case, face, bev=0.04, name="lug")
    cylinder(0.09, 0.14, (R - 0.02, 0, -0.06), case, face, rot=(0, math.pi / 2, 0), bev=0.02, name="crown")
    for k in range(12):
        a = k * math.pi / 6
        rr = R - 0.27
        if gems:
            sphere(0.055 if k % 3 == 0 else 0.04, (rr * math.cos(a), rr * math.sin(a), 0.13), diamond(), face,
                   scale=(1, 1, 0.6), segs=8, rings=4, name="mark", flat=True)
        else:
            big = k % 3 == 0
            box((0.17 if big else 0.11, 0.045 if big else 0.03, 0.03), (rr * math.cos(a), rr * math.sin(a), 0.125),
                marker, face, rot=(0, 0, a), bev=0.008, name="mark")
    if gems:
        for k in range(32):
            a = k * 2 * math.pi / 32
            sphere(0.06, ((R - 0.05) * math.cos(a), (R - 0.05) * math.sin(a), 0.18), diamond(), face,
                   scale=(1, 1, 0.65), segs=8, rings=4, name="bgem", flat=True)
    hand = marker
    box((0.06, 0.5, 0.02), (0.11, 0.2, 0.14), hand, face, rot=(0, 0, math.radians(-28)), bev=0.008, name="hour")
    box((0.045, 0.68, 0.02), (-0.24, 0.24, 0.155), hand, face, rot=(0, 0, math.radians(45)), bev=0.008, name="minute")
    cylinder(0.05, 0.05, (0, 0, 0.12), hand, face, bev=0.01, name="pin")
    return root


# ── Jobs ────────────────────────────────────────────────────────────────────


def ball_on_ring(deck, mat_, r=0.95, ring=None):
    ring = ring or M("chrome", (0.9, 0.9, 0.92), metallic=1.0, rough=0.12)
    torus(0.55, 0.07, (0, 0, deck + 0.07), ring)
    o = sphere(r, (0, 0, deck + r + 0.04), mat_, segs=96, rings=48)
    o.rotation_euler = (math.radians(18), math.radians(-12), math.radians(28))
    return o


def job_scuffed_ball():
    base.plinth("premier", False)
    ball_on_ring(DECK["medium"], scuffed_ball_material())
    return "medium", 1.55, 13.5


def job_european_ball():
    base.plinth("champions", False)
    ball_on_ring(DECK["medium"], star_ball_material((0.012, 0.03, 0.16), (0.95, 0.96, 1.0), (0.7, 0.74, 0.82)))
    return "medium", 1.55, 13.5


def job_golden_ball():
    base.plinth("ballondor", False)
    ring = M("darkring", (0.12, 0.02, 0.03), metallic=0.6, rough=0.25)
    ball_on_ring(DECK["medium"], gold_ball_material(), ring=ring)
    return "medium", 1.55, 13.5


def job_hatchback():
    base.plinth("premier", True)
    paint = M("paint", (0.2, 0.32, 0.42), metallic=0.25, rough=0.42, coat=0.35, coat_rough=0.12)
    car("hatchback", paint, at=(0, 0, DECK["great"]), rot_z=215, scale=1.1)
    return "great", 1.95, 16.5


def job_sports_car():
    base.plinth("europa", True)
    paint = M("paint", (0.62, 0.0, 0.01), metallic=0.35, rough=0.32, coat=1.0)
    car("sports", paint, at=(0, 0, DECK["great"]), rot_z=215, scale=1.12)
    return "great", 1.85, 16.5


def job_supercar():
    base.plinth("worldcup", True)
    paint = M("paint", (0.95, 0.22, 0.0), metallic=0.5, rough=0.28, coat=1.0)
    car("super", paint, at=(0, 0, DECK["great"]), rot_z=215, scale=1.1)
    return "great", 1.85, 16.5


def job_steel_watch():
    base.plinth("europa", False)
    watch(steel(0.16), steel(0.22, "link"), M("dial", (0.01, 0.05, 0.2), metallic=0.5, rough=0.25, coat=1.0),
          steel(0.1, "hand"), DECK["medium"])
    return "medium", 2.1, 15.0


def job_gold_watch():
    base.plinth("worldcup", False)
    watch(gold(0.15), gold(0.2, "glink"), M("dial", (0.015, 0.015, 0.018), rough=0.2, coat=1.0),
          gold(0.1, "ghand"), DECK["medium"])
    return "medium", 2.1, 15.0


def job_diamond_watch():
    base.plinth("ballondor", False)
    wg = M("whitegold", (0.9, 0.9, 0.93), metallic=1.0, rough=0.1)
    watch(wg, wg, M("dial", (0.01, 0.012, 0.03), rough=0.15, coat=1.0), wg, DECK["medium"], gems=True)
    return "medium", 2.1, 15.0


def job_iced_chain():
    base.plinth("champions", False)
    d = DECK["medium"]
    velvet = M("velvet", (0.018, 0.018, 0.022), rough=0.6, sheen=0.7)
    chrome = M("chrome", (0.9, 0.9, 0.92), metallic=1.0, rough=0.12)
    before = set(bpy.data.objects)
    cylinder(0.75, 0.12, (0, 0, d), chrome, bev=0.04)
    cylinder(0.08, 0.7, (0, 0, d + 0.12), chrome, bev=0.0)
    a, b, c = 1.05, 0.5, 0.82          # the bust: an oval chest
    cz = d + 0.7 + c
    sphere(1.0, (0, 0, cz), velvet, scale=(a, b, c))
    cylinder(0.3, 0.7, (0, 0, cz + c * 0.55), velvet, bev=0.04, name="neck")
    # The chain: round the neck at the back, dipping low on the chest at the front.
    ice = iced()
    zn = cz + c * 0.86
    pts = []
    N = 400
    for i in range(N):
        t = 2 * math.pi * i / N
        f = ((1 + math.cos(t)) / 2) ** 1.6       # 1 at the front, 0 at the back
        x, y = math.sin(t), -math.cos(t)
        z = zn - 0.95 * f
        h = max(0.0, 1 - ((z - cz) / c) ** 2)
        rad = 1 / math.sqrt((x / a) ** 2 + (y / b) ** 2) * math.sqrt(h) + 0.055
        rad = max(rad, 0.36)
        pts.append(Vector((x * rad, y * rad, z)))
    # Walk the loop, a link every 0.11.
    step, acc, links = 0.11, 0.0, []
    for i in range(N):
        p, q = pts[i], pts[(i + 1) % N]
        seg = (q - p).length
        while acc <= seg:
            links.append((p + (q - p) * (acc / seg), (q - p).normalized()))
            acc += step
        acc -= seg
    for k, (p, t) in enumerate(links):
        out = Vector((p.x, p.y, 0)).normalized()
        out = (out - t * out.dot(t)).normalized()
        n2 = t.cross(out)
        ax = out if k % 2 else n2
        side = ax.cross(t)
        rot = Matrix((t, side, ax)).transposed()
        o = torus(0.075, 0.03, (0, 0, 0), ice, seg=24, mseg=10, name="link")
        o.matrix_world = Matrix.Translation(p) @ rot.to_4x4() @ Matrix.Diagonal((1.35, 1, 1, 1))
    # A star pendant at the front, set with one big stone.
    front = pts[0]
    zp = front.z - 0.3
    ys = b * math.sqrt(max(0.0, 1 - ((zp - cz) / c) ** 2))
    pend = empty("pend", None, (0, -(ys + 0.07), zp), (math.radians(95), 0, 0))
    prism(star_pts(0.32, 0.14), 0.08, ice, pend, plane="xy", bev=0.02, segs=3, name="star")
    sphere(0.09, (0, 0, 0.06), diamond(), pend, scale=(1, 1, 0.6), segs=10, rings=5, name="stone", flat=True)
    torus(0.06, 0.022, (0, 0.33, 0), ice, pend, rot=(0, math.pi / 2, 0), seg=24, mseg=8, name="bail")
    grow(before, (0, 0, d), 1.3)
    return "medium", 2.8, 16.5


def job_penthouse():
    base.plinth("champions", True)
    d = DECK["great"]
    tw, td = 2.3, 1.7
    # The tower: glass floors with lit windows (brick pattern = window grid).
    fac = M("facade", (0.1, 0.1, 0.1), rough=0.12, coat=1.0)
    nt = fac.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    add = nt.nodes.new("ShaderNodeMath"); add.operation = "ADD"
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    brick = nt.nodes.new("ShaderNodeTexBrick")
    brick.offset = 0.0
    brick.inputs["Color1"].default_value = (1.0, 0.6, 0.25, 1)
    brick.inputs["Color2"].default_value = (0.01, 0.015, 0.03, 1)
    brick.inputs["Mortar"].default_value = (0.08, 0.09, 0.1, 1)
    brick.inputs["Scale"].default_value = 1.0
    brick.inputs["Mortar Size"].default_value = 0.025
    brick.inputs["Brick Width"].default_value = 0.28
    brick.inputs["Row Height"].default_value = 0.42
    brick.inputs["Bias"].default_value = 0.3
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    nt.links.new(sep.outputs["X"], add.inputs[0])
    nt.links.new(sep.outputs["Y"], add.inputs[1])
    nt.links.new(add.outputs[0], comb.inputs["X"])
    nt.links.new(sep.outputs["Z"], comb.inputs["Y"])
    nt.links.new(comb.outputs[0], brick.inputs["Vector"])
    nt.links.new(brick.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(brick.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 1.1
    floors = 5
    fh = 0.42
    tower = box((tw, td, floors * fh), (0, 0.1, d + floors * fh / 2), fac, bev=0.0, name="tower")
    tower.location.z = d + floors * fh / 2
    concrete = M("slab", (0.85, 0.86, 0.88), rough=0.4)
    for k in range(floors + 1):
        box((tw + 0.06, td + 0.06, 0.05), (0, 0.1, d + k * fh), concrete, bev=0.01, name="slab")
    top = d + floors * fh
    # The penthouse: set back, glass walls, warm inside, a roof that overhangs.
    warm = M("warm", (1.0, 0.75, 0.5), emit=(1.0, 0.66, 0.36), strength=1.4)
    box((1.6, 1.0, 0.55), (0.25, 0.42, top + 0.3), warm, bev=0.0, name="inside")
    glassw = M("glassw", (0.6, 0.7, 0.8), rough=0.02, transmission=1.0, ior=1.2)
    box((1.66, 1.06, 0.57), (0.25, 0.42, top + 0.3), glassw, bev=0.0, name="glasswall")
    for x in (-0.55, -0.05, 0.45, 1.05):
        box((0.04, 1.08, 0.57), (x, 0.42, top + 0.3), concrete, bev=0.005, name="mullion")
    box((2.0, 1.45, 0.08), (0.25, 0.35, top + 0.62), concrete, bev=0.015, name="roof")
    # The terrace: a lit pool, glass rail, two loungers, plants.
    pool = M("pool", (0.0, 0.5, 0.8), emit=(0.1, 0.65, 1.0), strength=2.5, rough=0.05)
    box((0.62, 0.95, 0.04), (-0.78, -0.1, top + 0.045), pool, bev=0.01, name="pool")
    box((0.7, 1.03, 0.03), (-0.78, -0.1, top + 0.03), concrete, bev=0.01, name="poolrim")
    rail = M("rail", (0.75, 0.88, 1.0), rough=0.05, transmission=1.0, ior=1.2)
    box((tw + 0.04, 0.03, 0.22), (0, 0.1 - td / 2 - 0.0, top + 0.13), rail, bev=0.0, name="railf")
    for sx in (-1, 1):
        box((0.03, td, 0.22), (sx * (tw / 2), 0.1, top + 0.13), rail, bev=0.0, name="rails")
    white = M("cush", (0.92, 0.9, 0.86), rough=0.6)
    for x in (-0.05, 0.3):
        box((0.18, 0.42, 0.06), (x, -0.42, top + 0.06), white, rot=(math.radians(8), 0, 0), bev=0.02, name="lounger")
    leaf = M("leaf", (0.05, 0.3, 0.08), rough=0.6)
    potm = M("pot", (0.2, 0.2, 0.22), rough=0.5)
    for (x, y) in ((1.0, -0.55), (-1.05, 0.7), (0.95, 0.85)):
        cylinder(0.09, 0.14, (x, y, top), potm, bev=0.01, name="pot")
        sphere(0.15, (x, y, top + 0.26), leaf, scale=(1, 1, 1.3), segs=16, rings=10, name="bush")
    # A thin spire on the roof.
    cylinder(0.03, 0.55, (0.8, 0.6, top + 0.66), steel(), bev=0.0, name="spire")
    sphere(0.045, (0.8, 0.6, top + 1.22), M("beacon", (1, 0.1, 0.1), emit=(1, 0.1, 0.05), strength=10), name="beacon")
    return "great", 3.2, 19.5


def trophy(kind, mat_, parent, loc, s=1.0):
    root = empty("trophy", parent, loc, (0, 0, 0), s)
    plinth_m = M("tbase", (0.05, 0.04, 0.035), rough=0.3, coat=0.8)
    cylinder(0.16, 0.12, (0, 0, 0), plinth_m, root, bev=0.015, name="tb")
    if kind == "cup":
        lathe([(0.11, 0.12), (0.12, 0.15), (0.04, 0.2), (0.035, 0.36), (0.08, 0.4), (0.2, 0.52), (0.24, 0.66), (0.25, 0.8),
               (0.23, 0.8), (0.0, 0.62)], mat_, root, name="cup")
        for sx in (-1, 1):
            torus(0.1, 0.022, (sx * 0.25, 0, 0.62), mat_, root, rot=(math.pi / 2, 0, 0), seg=32, mseg=10, name="handle")
    elif kind == "big":
        lathe([(0.12, 0.12), (0.13, 0.16), (0.05, 0.24), (0.05, 0.42), (0.12, 0.5), (0.2, 0.62), (0.26, 0.86), (0.25, 1.0),
               (0.14, 1.02), (0.0, 1.06)], mat_, root, name="big")
        for sx in (-1, 1):
            torus(0.2, 0.03, (sx * 0.26, 0, 0.78), mat_, root, rot=(math.pi / 2, 0, 0), scale=(0.8, 1.4, 1), seg=32, mseg=10, name="ear")
    elif kind == "star":
        lathe([(0.1, 0.12), (0.03, 0.18), (0.025, 0.48), (0.0, 0.5)], mat_, root, name="stem")
        st = empty("st", root, (0, 0, 0.62), (math.pi / 2, 0, 0))
        prism(star_pts(0.17, 0.075), 0.05, mat_, st, plane="xy", bev=0.01, segs=2, name="star")
    elif kind == "ballcup":
        lathe([(0.11, 0.12), (0.06, 0.18), (0.035, 0.3), (0.09, 0.34), (0.0, 0.35)], mat_, root, name="stand")
        sphere(0.14, (0, 0, 0.47), mat_, segs=32, rings=16)
    elif kind == "salver":
        cylinder(0.26, 0.025, (0, 0.02, 0.36), mat_, root, rot=(math.radians(-80), 0, 0), bev=0.008, name="plate")
        torus(0.2, 0.012, (0, 0.0, 0.36), mat_, root, rot=(math.radians(-80), 0, 0), seg=40, mseg=8)
        box((0.04, 0.12, 0.25), (0, 0.08, 0.2), mat_, root, rot=(math.radians(20), 0, 0), bev=0.01)
    return root


def job_trophy_wall():
    base.plinth("worldcup", False)
    d = DECK["medium"]
    W, H, D = 2.9, 3.1, 0.8
    wood = M("wood", (0.09, 0.045, 0.022), rough=0.3, coat=0.7)
    brass = gold(0.25, "brass")
    back = M("back", (0.04, 0.05, 0.08), rough=0.5)
    y0 = 0.35
    box((W, 0.08, H), (0, y0 + D / 2, d + H / 2), back, bev=0.01, name="back")
    for sx in (-1, 1):
        box((0.1, D, H), (sx * (W / 2), y0, d + H / 2), wood, bev=0.02, name="side")
    box((W + 0.1, D + 0.06, 0.16), (0, y0, d + 0.08), wood, bev=0.02, name="bottom")
    box((W + 0.1, D + 0.06, 0.14), (0, y0, d + H), wood, bev=0.02, name="top")
    shelf = M("shelfglass", (0.85, 0.95, 1.0), rough=0.05, coat=1.0, transmission=0.85, ior=1.3)
    led = M("led", (1, 0.95, 0.85), emit=(1.0, 0.88, 0.65), strength=8)
    levels = [d + 0.16, d + 1.15, d + 2.12]
    for i, z in enumerate(levels):
        if i:
            box((W - 0.1, D - 0.06, 0.035), (0, y0, z), shelf, bev=0.005, name="shelf")
        # A strip of light under the shelf above, and down the back.
        zt = levels[i + 1] if i + 1 < len(levels) else d + H - 0.07
        box((W - 0.2, 0.03, 0.02), (0, y0 - D / 2 + 0.06, zt - 0.03), led, bev=0.0, name="led")
    for sx in (-1, 1):
        box((0.025, 0.02, H - 0.3), (sx * (W / 2 - 0.08), y0 + D / 2 - 0.06, d + H / 2), led, bev=0.0, name="ledv")
    silver = steel(0.12, "silver")
    g = gold(0.14, "tgold")
    z1, z2, z3 = levels[0] + 0.0, levels[1] + 0.018, levels[2] + 0.018
    trophy("big", g, None, (0, y0, z1 + 0.0), 0.95)
    trophy("cup", silver, None, (-0.85, y0, z1), 0.95)
    trophy("star", g, None, (0.85, y0, z1), 0.95)
    trophy("ballcup", g, None, (-0.8, y0, z2), 1.0)
    trophy("salver", silver, None, (0.0, y0 + 0.05, z2), 1.0)
    trophy("cup", g, None, (0.82, y0, z2), 0.9)
    trophy("big", silver, None, (-0.55, y0, z3), 0.72)
    trophy("star", silver, None, (0.15, y0, z3), 0.85)
    trophy("cup", g, None, (0.8, y0, z3), 0.8)
    # Brass name plate on the plinth bar.
    box((0.7, 0.02, 0.07), (0, y0 - D / 2 - 0.03, d + 0.08), brass, bev=0.005, name="plate")
    return "medium", 2.3, 16.0


def hip_roof(w, dpt, h, loc, material, parent=None, ridge=0.35):
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in ((-w / 2, -dpt / 2, 0), (w / 2, -dpt / 2, 0), (w / 2, dpt / 2, 0), (-w / 2, dpt / 2, 0))]
    rl = max(0.01, w / 2 - dpt / 2 * (1 - ridge))
    t = [bm.verts.new((-rl, 0, h)), bm.verts.new((rl, 0, h))]
    bm.faces.new((v[0], v[1], t[1], t[0]))
    bm.faces.new((v[1], v[2], t[1]))
    bm.faces.new((v[2], v[3], t[0], t[1]))
    bm.faces.new((v[3], v[0], t[0]))
    bm.faces.new((v[3], v[2], v[1], v[0]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = from_bm(bm, "roof", material)
    return put(o, parent, loc)


def job_mansion():
    base.plinth("worldcup", True)
    d = DECK["great"]
    lawn = M("lawn", (0.09, 0.32, 0.07), rough=0.85)
    cylinder(1.93, 0.08, (0, 0, d), lawn, bev=0.03, verts=96, name="lawn")
    g0 = d + 0.08
    wall = M("wall", (0.93, 0.89, 0.8), rough=0.55)
    slate = M("slate", (0.13, 0.15, 0.19), rough=0.45, coat=0.3)
    win = M("win", (1.0, 0.82, 0.55), emit=(1.0, 0.72, 0.4), strength=3.0)
    dark = M("door", (0.12, 0.06, 0.03), rough=0.4, coat=0.6)
    stone = M("stone", (0.82, 0.8, 0.76), rough=0.5)
    hy = 0.55                     # the house stands back on the lawn
    # Main block and two wings.
    blocks = [(0, hy, 1.7, 0.85, 0.95), (-1.25, hy - 0.08, 0.85, 0.7, 0.68), (1.25, hy - 0.08, 0.85, 0.7, 0.68)]
    for (x, y, w, dp, h) in blocks:
        box((w, dp, h), (x, y, g0 + h / 2), wall, bev=0.012, name="block")
        box((w + 0.06, dp + 0.06, 0.05), (x, y, g0 + h), stone, bev=0.01, name="cornice")
        hip_roof(w + 0.08, dp + 0.08, 0.36 if w > 1 else 0.3, (x, y, g0 + h + 0.025), slate)
        rows = [0.25, 0.65] if h > 0.8 else [0.22, 0.5]
        cols = 5 if w > 1 else 2
        for zr in rows:
            for c in range(cols):
                xx = x - w / 2 + w * (c + 0.5) / cols
                if w > 1 and c == 2 and zr < 0.4:
                    continue  # the front door goes here
                box((0.13, 0.03, 0.2), (xx, y - dp / 2 - 0.005, g0 + zr), win, bev=0.0, name="window")
                box((0.17, 0.035, 0.03), (xx, y - dp / 2 - 0.01, g0 + zr - 0.115), stone, bev=0.0, name="sill")
    # Portico: columns, a pediment, steps, the door.
    py = hy - 0.85 / 2
    box((0.2, 0.04, 0.34), (0, py - 0.01, g0 + 0.17), dark, bev=0.01, name="frontdoor")
    for k in range(4):
        x = -0.42 + k * 0.28
        cylinder(0.035, 0.6, (x, py - 0.32, g0 + 0.05), stone, bev=0.005, verts=20, name="column")
    box((1.0, 0.42, 0.05), (0, py - 0.18, g0 + 0.66), stone, bev=0.01, name="entab")
    ped = prism([(-0.52, 0), (0.52, 0), (0, 0.24)], 0.4, stone, bev=0.01, name="pediment")
    put(ped, None, (0, py - 0.18, g0 + 0.685))
    for k in range(3):
        box((1.05 - k * 0.08, 0.5 - k * 0.12, 0.025), (0, py - 0.24 + k * 0.05, g0 + 0.0125 + k * 0.025), stone, bev=0.0, name="step")
    for x in (-0.55, 0.55):
        box((0.1, 0.1, 0.45), (x, hy + 0.15, g0 + 0.95 + 0.3), M("brick", (0.45, 0.2, 0.12), rough=0.7), bev=0.01, name="chimney")
    # Grounds: a gravel drive round a fountain, hedges, trees, cone topiary.
    gravel = M("gravel", (0.72, 0.66, 0.55), rough=0.9)
    bm_r = torus(0.62, 0.13, (0, -0.85, g0), gravel, scale=(1.5, 1, 0.12), name="drive")
    box((0.32, 0.6, 0.012), (0, -1.55, g0 + 0.006), gravel, bev=0.0, name="drive2")
    water = M("water", (0.1, 0.45, 0.75), emit=(0.15, 0.55, 0.9), strength=1.2, rough=0.05)
    cylinder(0.36, 0.08, (0, -0.85, g0), stone, bev=0.015, name="basin")
    cylinder(0.3, 0.02, (0, -0.85, g0 + 0.07), water, bev=0.0, name="water")
    lathe([(0.06, 0), (0.035, 0.14), (0.14, 0.22), (0.0, 0.25)], stone, loc=(0, -0.85, g0 + 0.07), segs=24, name="spout")
    hedge = M("hedge", (0.04, 0.22, 0.05), rough=0.7)
    for k in range(13):
        a = math.radians(205 + k * 10.8)
        box((0.26, 0.15, 0.14), (1.72 * math.cos(a), 1.72 * math.sin(a) * 0.98, g0 + 0.07), hedge,
            rot=(0, 0, a + math.pi / 2), bev=0.05, name="hedge")
    leaf = M("tree", (0.06, 0.28, 0.06), rough=0.7)
    bark = M("bark", (0.2, 0.12, 0.06), rough=0.8)
    for (x, y, s) in ((-1.5, 0.9, 1.0), (1.5, 0.95, 1.1), (-1.05, 1.3, 0.85), (1.0, 1.35, 0.8)):
        cylinder(0.04 * s, 0.35 * s, (x, y, g0), bark, bev=0.0, verts=12, name="trunk")
        sphere(0.3 * s, (x, y, g0 + 0.5 * s), leaf, scale=(1, 1, 1.1), segs=20, rings=12, name="crown")
    for x in (-0.65, 0.65):
        cylinder(0.08, 0.32, (x, py - 0.4, g0), hedge, bev=0.0, verts=16, r2=0.0, name="topiary")
    return "great", 2.15, 17.5


def mask_math(nt, op, a, b=None):
    n = nt.nodes.new("ShaderNodeMath")
    n.operation = op
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def job_night_suit():
    base.plinth("ballondor", False)
    d = DECK["medium"]
    chrome = M("chrome", (0.9, 0.9, 0.92), metallic=1.0, rough=0.12)
    before = set(bpy.data.objects)
    cylinder(0.62, 0.1, (0, 0, d), chrome, bev=0.04, name="foot")
    cylinder(0.05, 0.75, (0, 0, d + 0.1), chrome, bev=0.0, name="pole")
    z0 = d + 0.8
    # The jacket: black wool, a white shirt in a V, satin lapels beside it.
    suit = bpy.data.materials.new("suit")
    suit.use_nodes = True
    nt = suit.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Sheen Weight"].default_value = 0.4
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    X, Y, Z = sep.outputs["X"], sep.outputs["Y"], sep.outputs["Z"]
    zv = 0.62
    hw = mask_math(nt, "ADD", mask_math(nt, "MULTIPLY", mask_math(nt, "SUBTRACT", Z, zv), 0.3), 0.02)
    ax = mask_math(nt, "ABSOLUTE", X)
    front = mask_math(nt, "LESS_THAN", Y, 0.0)
    above = mask_math(nt, "GREATER_THAN", Z, zv)
    shirt = mask_math(nt, "MULTIPLY", mask_math(nt, "MULTIPLY", front, above), mask_math(nt, "LESS_THAN", ax, hw))
    lap_w = mask_math(nt, "LESS_THAN", ax, mask_math(nt, "ADD", hw, 0.11))
    lapel = mask_math(nt, "MULTIPLY", mask_math(nt, "MULTIPLY", front, mask_math(nt, "GREATER_THAN", Z, zv - 0.08)), lap_w)
    lapel = mask_math(nt, "SUBTRACT", lapel, shirt)
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[6].default_value = (0.012, 0.012, 0.014, 1)
    mix.inputs[7].default_value = (0.9, 0.9, 0.88, 1)
    nt.links.new(shirt, mix.inputs[0])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    rough = mask_math(nt, "SUBTRACT", 0.55, mask_math(nt, "MULTIPLY", lapel, 0.42))
    nt.links.new(rough, bsdf.inputs["Roughness"])
    coat = mask_math(nt, "MULTIPLY", lapel, 0.8)
    nt.links.new(coat, bsdf.inputs["Coat Weight"])
    prof = [(0.0, 0.0), (0.5, 0.0), (0.52, 0.04), (0.47, 0.35), (0.45, 0.48), (0.5, 0.75), (0.57, 1.0), (0.62, 1.15),
            (0.58, 1.26), (0.42, 1.33), (0.2, 1.38), (0.0, 1.39)]
    jacket = lathe(prof, suit, loc=(0, 0, z0), segs=72, scale=(1, 0.56, 1), name="jacket")
    skin = M("form", (0.8, 0.78, 0.74), rough=0.35, coat=0.4)
    white = M("shirtw", (0.9, 0.9, 0.88), rough=0.5)
    black = M("black", (0.012, 0.012, 0.014), rough=0.5, sheen=0.4)
    satin = M("satin", (0.01, 0.01, 0.012), rough=0.15, coat=0.8)
    cylinder(0.15, 0.3, (0, 0, z0 + 1.3), skin, bev=0.03, name="neck")
    sphere(0.16, (0, 0, z0 + 1.62), skin, scale=(1, 1, 0.35), name="cap")
    torus(0.15, 0.04, (0, 0, z0 + 1.38), white, scale=(1, 0.9, 1), name="collar")
    # Bow tie.
    bt = empty("bow", None, (0, -0.22, z0 + 1.35))
    for sx in (-1, 1):
        o = cylinder(0.075, 0.13, (0, 0, 0), satin, bt, rot=(0, sx * math.pi / 2, 0), r2=0.025, bev=0.0, name="wing")
        o.scale = (1, 0.7, 1)
    sphere(0.035, (0, -0.005, 0), satin, bt, scale=(1, 0.8, 1), segs=16, rings=8, name="knot")
    # Sleeves hanging at the sides, white cuffs showing.
    for sx in (-1, 1):
        sl = empty("sleeve", None, (sx * 0.6, 0.0, z0 + 1.12), (0, sx * math.radians(-7), 0))
        lathe([(0.0, 0.05), (0.15, 0.03), (0.15, -0.3), (0.125, -0.95), (0.12, -1.0), (0.0, -1.0)], black, sl, segs=32,
              scale=(1, 0.9, 1), name="arm")
        cylinder(0.105, 0.06, (0, 0, -1.04), white, sl, bev=0.01, verts=24, name="cuff")
    # Buttons below the V, a white square in the breast pocket.
    for k in range(2):
        sphere(0.025, (0, -0.265, z0 + 0.5 - k * 0.15), satin, scale=(1, 0.5, 1), segs=12, rings=6, name="button")
    box((0.13, 0.03, 0.05), (0.3, -0.27, z0 + 0.98), white, rot=(0, 0, math.radians(-18)), bev=0.01, name="pocketsq")
    grow(before, (0, 0, d), 1.6)
    return "medium", 2.6, 17.0


def job_private_jet():
    base.plinth("ballondor", True)
    d = DECK["great"]
    chrome = M("chrome", (0.9, 0.9, 0.92), metallic=1.0, rough=0.12)
    before = set(bpy.data.objects)
    cylinder(0.5, 0.08, (0, 0.2, d), chrome, bev=0.03, name="foot")
    cylinder(0.04, 1.05, (0, 0.2, d + 0.08), chrome, bev=0.0, name="pole")
    root = empty("jet", None, (0, 0.2, d + 1.25), (0, math.radians(-7), math.radians(208)))
    # White body with a gold line along it (by height, in the shader).
    livery = bpy.data.materials.new("livery")
    livery.use_nodes = True
    nt = livery.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.25
    bsdf.inputs["Coat Weight"].default_value = 0.8
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    # The fuselage is spun round its own z then laid along x, so object x = height.
    band = mask_math(nt, "MULTIPLY", mask_math(nt, "GREATER_THAN", sep.outputs["X"], -0.11),
                     mask_math(nt, "LESS_THAN", sep.outputs["X"], -0.055))
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[6].default_value = (0.92, 0.92, 0.93, 1)
    mix.inputs[7].default_value = (1.0, 0.72, 0.28, 1)
    nt.links.new(band, mix.inputs[0])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    nt.links.new(band, bsdf.inputs["Metallic"])
    white = M("white", (0.92, 0.92, 0.93), rough=0.25, coat=0.8)
    g = gold(0.18, "jgold")
    glass = M("jglass", (0.02, 0.025, 0.035), rough=0.04, coat=1.0)
    L = 4.0
    prof = [(0.0, 0.0), (0.12, 0.05), (0.2, 0.16), (0.27, 0.38), (0.3, 0.7), (0.31, 1.0), (0.31, 2.7), (0.27, 3.25),
            (0.18, 3.7), (0.08, 3.95), (0.0, 4.0)]
    fus = lathe(prof, livery, root, loc=(L / 2, 0, 0), rot=(0, -math.pi / 2, 0), segs=48, name="fuselage")
    # Cockpit and cabin windows.
    for sy in (-1, 1):
        for k in range(7):
            x = 1.05 - k * 0.3
            box((0.13, 0.04, 0.1), (x, sy * 0.3, 0.06), glass, root, bev=0.03, name="window")
        box((0.28, 0.06, 0.1), (1.55, sy * 0.2, 0.17), glass, root, rot=(0, 0, sy * math.radians(35)), bev=0.03, name="screen")
    # Wings: swept, low on the body, with winglets.
    wing = [(0.55, 0.0), (-0.15, 0.0), (-0.75, 1.75), (-0.55, 1.75)]
    for sy in (-1, 1):
        pts = [(x, sy * y) for x, y in wing]
        o = prism(pts, 0.06, white, root, plane="xy", bev=0.02, segs=2, name="wing")
        o.location = (0.0, 0.0, -0.18)
        o.rotation_euler = (sy * math.radians(5), 0, 0)
        wl = prism([(-0.55, 0.0), (-0.75, 0.0), (-0.95, 0.38), (-0.82, 0.38)], 0.04, g, root, bev=0.01, segs=2, name="winglet")
        wl.location = (0, sy * 1.76, -0.03)
    # T-tail.
    fin = prism([(-1.2, 0.2), (-1.97, 0.02), (-2.15, 1.0), (-1.85, 1.0)], 0.06, g, root, bev=0.02, segs=2, name="fin")
    tp = [(-1.8, 0.0), (-2.1, 0.0), (-2.25, 0.72), (-2.08, 0.72)]
    for sy in (-1, 1):
        o = prism([(x, sy * y) for x, y in tp], 0.04, white, root, plane="xy", bev=0.01, segs=2, name="tailplane")
        o.location = (0, 0, 1.0)
    # Engines on the back of the body.
    for sy in (-1, 1):
        lathe([(0.0, 0.0), (0.13, 0.02), (0.15, 0.2), (0.14, 0.6), (0.1, 0.72), (0.0, 0.72)], white, root,
              loc=(-0.95, sy * 0.52, 0.22), rot=(0, -math.pi / 2, 0), segs=32, name="engine")
        cylinder(0.11, 0.02, (-0.95, sy * 0.52, 0.22), M("intake", (0.03, 0.03, 0.035), rough=0.5), root,
                 rot=(0, math.pi / 2, 0), bev=0.0, verts=32, name="inlet")
        box((0.4, 0.3, 0.06), (-1.25, sy * 0.36, 0.2), white, root, bev=0.02, name="pylon")
    grow(before, (0, 0.2, d), 1.2)
    return "great", 2.6, 18.0


def job_hof_plaque():
    base.plinth("ballondor", False)
    d = DECK["medium"]
    wood = M("wood", (0.11, 0.05, 0.025), rough=0.3, coat=0.8)
    g = gold(0.2, "pgold")
    bronze = M("bronze", (0.7, 0.42, 0.2), metallic=1.0, rough=0.3)
    ink = M("ink", (0.08, 0.05, 0.02), metallic=0.6, rough=0.5)
    root = empty("plaque", None, (0, 0.15, d + 0.18), (math.radians(-10), 0, 0))
    box((1.0, 0.45, 0.18), (0, 0.1, -0.09), wood, None, bev=0.03, name="foot").location = (0, 0.25, d + 0.09)
    # The board: a shield shape, wood with a gold edge.
    W, H = 2.0, 2.55
    shield = [(-W / 2, H), (W / 2, H), (W / 2, 0.75), (0.0, 0.0), (-W / 2, 0.75)]
    b = prism(shield, 0.16, wood, root, plane="xz", bev=0.05, segs=4, name="board")
    rim = prism(inset(shield, -0.02), 0.1, bronze, root, plane="xz", bev=0.03, segs=3, name="rim")
    rim.location.y = 0.03
    # Plate with the words, a star in a laurel above.
    plate = [(-0.75, 1.05), (0.75, 1.05), (0.75, 1.6), (-0.75, 1.6)]
    prism(plate, 0.04, g, root, plane="xz", y0=-0.09, bev=0.02, segs=2, name="plate")
    t = bpy.data.curves.new("txt", "FONT")
    t.body = "HALL OF FAME"
    t.align_x = "CENTER"
    t.align_y = "CENTER"
    t.size = 0.19
    t.extrude = 0.012
    t.space_character = 1.05
    to = link(bpy.data.objects.new("txt", t))
    to.data.materials.append(ink)
    put(to, root, (0, -0.115, 1.43), (math.pi / 2, 0, 0))
    for z, w in ((1.22, 1.0), (1.14, 0.7)):
        box((w, 0.02, 0.025), (0, -0.113, z), ink, root, bev=0.0, name="line")
    st = empty("star", root, (0, -0.1, 2.1), (math.pi / 2, 0, 0))
    prism(star_pts(0.3, 0.13), 0.08, g, st, plane="xy", bev=0.02, segs=3, name="star")
    for sx in (-1, 1):  # laurel: leaves along two arcs
        for k in range(8):
            a = math.radians(-78 + k * 17)
            x = sx * 0.48 * math.cos(a)
            z = 2.1 + 0.48 * math.sin(a)
            leaf = sphere(0.075, (x, -0.1, z), g, root, scale=(0.45, 0.4, 1.0), segs=16, rings=8, name="leaf")
            leaf.rotation_euler = (0, -sx * a, 0)
    return "medium", 1.85, 15.0


def boot(mat_, parent, loc, rot_z):
    root = empty("boot", parent, loc, (0, 0, math.radians(rot_z)))
    up = box((0.62, 0.22, 0.2), (0, 0, 0.13), mat_, root, bev=0.0, name="upper")
    subsurf(up, 2)
    box((0.66, 0.24, 0.035), (0, 0, 0.03), mat_, root, bev=0.012, name="sole")
    cylinder(0.11, 0.17, (-0.2, 0, 0.13), mat_, root, bev=0.03, verts=24, name="collar")
    for k in range(3):
        box((0.035, 0.18, 0.012), (0.03 + k * 0.08, 0, 0.24), mat_, root, bev=0.004, name="lace")
    return root


def job_golden_set():
    # The level-100 stand (crown-100) without its ball, the whole set on top.
    goldm = gold(0.16)
    velvet = M("velvet", (0.35, 0.02, 0.06), rough=0.7)
    marble = M("marble", (0.92, 0.9, 0.86), rough=0.2, coat=0.6)
    glow = M("glow", (1.0, 0.84, 0.35), emit=(1.0, 0.84, 0.35), strength=8)
    base.cyl(3.2, 0.5, 0, material=marble, name="b1")
    base.torus(3.22, 0.06, 0.5, glow)
    base.cyl(2.8, 0.35, 0.5, material=goldm, name="b2")
    base.cyl(2.5, 0.5, 0.85, material=velvet, name="b3", bevel=0.08)
    top = DECK["top"]
    # The statue: a footballer in gold, arms up, on a gold block.
    cylinder(0.62, 0.32, (0, 0.9, top), goldm, bev=0.04, name="pedestal")
    before = set(bpy.data.objects)
    J = items.footballer()
    statue = gold(0.22, "statue")
    for o in set(bpy.data.objects) - before:
        if o.type == "MESH":
            o.data.materials.clear()
            o.data.materials.append(statue)
    pose = dict(at=(0, 0.9, top + 0.32), face=-90, lean=-6, hipL=(4, 10), hipR=(-4, 10),
                armL=(165, 25, 10), armR=(165, 25, 10))
    items.apply_pose(J, pose, 0)
    J["root"].scale = (1.75, 1.75, 1.75)
    # The car, the ball and the boots in front.
    car("sports", gold(0.12, "carpaint"), at=(-1.05, -0.55, top), rot_z=205, scale=0.58, all_gold=True)
    gb = sphere(0.5, (1.3, -0.35, top + 0.5), gold_ball_material(), segs=64, rings=32)
    gb.rotation_euler = (0.3, -0.2, 0.5)
    for k, (x, y, rz) in enumerate(((0.35, -1.55, -25), (0.95, -1.4, -10))):
        b = boot(gold(0.14, f"bootg{k}"), None, (x, y, top), rz)
        b.scale = (1.6, 1.6, 1.6)
    return "top", 2.7, 20.0


JOBS = {
    "scuffed-ball": job_scuffed_ball, "hatchback": job_hatchback, "steel-watch": job_steel_watch,
    "sports-car": job_sports_car, "penthouse": job_penthouse, "iced-chain": job_iced_chain,
    "european-ball": job_european_ball, "gold-watch": job_gold_watch, "supercar": job_supercar,
    "trophy-wall": job_trophy_wall, "mansion": job_mansion, "night-suit": job_night_suit,
    "golden-ball": job_golden_ball, "private-jet": job_private_jet, "hof-plaque": job_hof_plaque,
    "diamond-watch": job_diamond_watch, "golden-set": job_golden_set,
}


def setup():
    base.reset()
    sc = bpy.context.scene
    sc.cycles.samples = SAMPLES
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.use_denoising = False
    bpy.context.view_layer.cycles.use_denoising = False
    sc.cycles.device = "CPU"
    sc.render.resolution_x = 1200 if SAMPLES > 32 else 600
    sc.render.resolution_y = 1100 if SAMPLES > 32 else 550
    sc.cycles.max_bounces = 10
    sc.cycles.transmission_bounces = 8
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 1.0


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, fn in JOBS.items():
        if ONLY and name not in ONLY:
            continue
        setup()
        tier, zc, dist = fn()
        items.camera(zc, dist)
        path = os.path.join(OUT, f"{name}-000.png")
        bpy.context.scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print("WROTE", path, tier, flush=True)
