"""One football boot, built in code, rendered at a level 1-5.

usage: python boot.py -- <base> <level> <out.png> [samples]
base = starter | speed | power | control | elite | curl | maestro
(colours from components/star/BootPicture.tsx BOOT_LOOK; the side marks are
our own shapes, the same ones that file draws — no real makers' marks.)
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
from PIL import Image, ImageDraw
import studio as S

BOOT_LOOK = {
    'starter': ('#e5e7eb', '#64748b', '#94a3b8'),
    'speed': ('#facc15', '#111827', '#1f2937'),
    'power': ('#dc2626', '#111827', '#111827'),
    'control': ('#2563eb', '#f8fafc', '#1e3a8a'),
    'elite': ('#111827', '#fbbf24', '#374151'),
    'curl': ('#06b6d4', '#7c3aed', '#4c1d95'),
    'maestro': ('#c026d3', '#fde68a', '#701a75'),
    # store accessory boots (v0.23.1)
    'blackout': ('#0a0a0a', '#52525b', '#18181b'),
    'volt': ('#d9f99d', '#65a30d', '#3f6212'),
    'chrome': ('#facc15', '#a16207', '#a16207'),
}

L = 0.29          # boot length (m), heel x=0 -> toe x=L
ZS = 0.010        # top of the sole plate


def cr(keys, x):
    """Catmull-Rom through (x, value) keys."""
    xs = [k[0] for k in keys]; vs = [k[1] for k in keys]
    if x <= xs[0]: return vs[0]
    if x >= xs[-1]: return vs[-1]
    i = max(j for j in range(len(xs) - 1) if xs[j] <= x)
    t = (x - xs[i]) / (xs[i + 1] - xs[i])
    p0 = vs[max(i - 1, 0)]; p1 = vs[i]; p2 = vs[i + 1]; p3 = vs[min(i + 2, len(vs) - 1)]
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)


# plan width, top line and toe spring
W = [(0, 0.026), (0.006, 0.044), (0.02, 0.056), (0.05, 0.060), (0.10, 0.062), (0.14, 0.068),
     (0.19, 0.080), (0.22, 0.080), (0.25, 0.068), (0.272, 0.046), (0.285, 0.026), (L, 0.010)]
H = [(0, 0.050), (0.008, 0.068), (0.02, 0.078), (0.035, 0.082), (0.07, 0.080), (0.10, 0.077), (0.13, 0.071),
     (0.17, 0.058), (0.21, 0.045), (0.24, 0.036), (0.265, 0.029), (0.282, 0.023), (L, 0.018)]
SPRING = [(0, 0.0), (0.2, 0.0), (0.25, 0.002), (L, 0.007)]
CENTRE = [(0, 0.0), (0.1, 0.0), (0.2, 0.004), (L, 0.006)]


def xs_samples(n):
    return [L * (0.5 - 0.5 * math.cos(math.pi * i / (n - 1))) for i in range(n)]


def upper_mesh():
    secs = []
    for x in xs_samples(44):
        w = cr(W, x); h = cr(H, x); zb = ZS - 0.004 + cr(SPRING, x); c = cr(CENTRE, x)
        ring = S.superellipse_ring(c, (zb + h) / 2, w / 2, (h - zb) / 2, n=36, p_top=2.3, p_bot=5.0, taper=0.18)
        secs.append([(x, y, z) for y, z in ring])
    return S.loft('Upper', secs, subsurf=2)


def sole_mesh():
    secs = []
    for x in xs_samples(40):
        x2 = min(L, max(0, x))
        w = cr(W, x2) + 0.003; sp = cr(SPRING, x2); c = cr(CENTRE, x2)
        cup = max(0.0, 1 - x2 / 0.07) ** 1.5 * 0.016
        top = ZS + cup
        ring = S.superellipse_ring(c, top / 2 + sp, w / 2, top / 2, n=32, p_top=5, p_bot=5)
        # stretch the sole a hair past the upper at heel and toe
        xx = -0.004 + x * (L + 0.008) / L
        secs.append([(xx, y, z) for y, z in ring])
    return S.loft('Sole', secs, subsurf=2)


def mark_image(base, path, lv):
    """The side mark in BootPicture's own 100x64 drawing space, x10."""
    im = Image.new('L', (1000, 640), 0)
    d = ImageDraw.Draw(im)
    P = lambda pts: [(x * 10, y * 10) for x, y in pts]

    def quad(p0, p1, p2, n=24):
        return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
                 (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in [i / n for i in range(n + 1)]]

    if base == 'speed':
        d.polygon(P([(44, 32), (58, 32), (52, 37), (66, 37), (46, 46), (52, 40), (40, 40)]), fill=255)
    elif base == 'power':
        d.polygon(P([(20, 40), (30, 33), (36, 39), (46, 31), (54, 38), (64, 31), (72, 37), (84, 33), (84, 37), (72, 41), (64, 35), (54, 42), (46, 35), (36, 43), (30, 37), (20, 44)]), fill=255)
    elif base == 'control':
        for i in range(24):
            cx = (66 + (i % 6) * 4) * 10; cy = (34 + (i // 6) * 3.6) * 10
            d.ellipse([cx - 11, cy - 11, cx + 11, cy + 11], fill=255)
    elif base == 'elite':
        d.polygon(P([(24, 36), (40, 42), (24, 48), (30, 42)]), fill=255)
        d.polygon(P([(40, 36), (56, 42), (40, 48), (46, 42)]), fill=255)
    elif base == 'curl':
        pts = quad((30, 42), (40, 30), (56, 34)) + quad((56, 34), (68, 38), (62, 44))[1:] + quad((62, 44), (56, 48), (52, 42))[1:]
        d.line(P(pts), fill=255, width=34, joint='curve')
        for p in (pts[0], pts[-1]):
            d.ellipse([p[0] * 10 - 17, p[1] * 10 - 17, p[0] * 10 + 17, p[1] * 10 + 17], fill=255)
    elif base == 'maestro':
        d.polygon(P([(50, 30), (52.6, 36), (59, 36.4), (54, 40.4), (55.8, 46.6), (50, 43), (44.2, 46.6), (46, 40.4), (41, 36.4), (47.4, 36)]), fill=255)
    else:
        pts = quad((22, 41), (50, 34), (86, 40)) + [(86, 43)] + quad((86, 43), (50, 37), (22, 44))[1:]
        d.polygon(P(pts), fill=255)
    im = im.transpose(Image.FLIP_TOP_BOTTOM)  # blender images start bottom-left
    im.save(path)


def upper_material(base, lv, tex):
    up, acc, sole = BOOT_LOOK[base]
    if lv == 1:
        # BootPicture's dull(): 35% toward mid grey
        c = tuple(int(up[i:i + 2], 16) for i in (1, 3, 5))
        up = '#%02x%02x%02x' % tuple(round((v * 0.55 + 128 * 0.45) * 0.82) for v in c)
    acc_col = acc
    m = S.principled(f'Upper{lv}', up,
                     rough={1: 0.72, 2: 0.55, 3: 0.32, 4: 0.26, 5: 0.24}[lv],
                     metal={4: 0.18, 5: 0.15}.get(lv, 0.0),
                     coat={3: 0.35, 4: 0.55, 5: 0.6}.get(lv, 0.0), coat_rough=0.12)
    nt = m.node_tree
    b_up = nt.nodes['Principled BSDF']
    if lv >= 4 and 'Thin Film Thickness' in b_up.inputs:
        b_up.inputs['Thin Film Thickness'].default_value = 420.0
        b_up.inputs['Thin Film IOR'].default_value = 1.45
    out = nt.nodes['Material Output']
    tc = S.node(m, 'ShaderNodeTexCoord')
    sep = S.node(m, 'ShaderNodeSeparateXYZ')
    S.link(m, tc.outputs['Object'], sep.inputs[0])
    # level 3+: the sole colour washes up the lower part of the upper
    if lv >= 3:
        mr = S.node(m, 'ShaderNodeMapRange')
        mr.inputs['From Min'].default_value = ZS + 0.022
        mr.inputs['From Max'].default_value = ZS + 0.002
        S.link(m, sep.outputs['Z'], mr.inputs['Value'])
        mul = S.node(m, 'ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 0.6
        S.link(m, mr.outputs['Result'], mul.inputs[0])
        mix = S.node(m, 'ShaderNodeMix'); mix.data_type = 'RGBA'
        mix.inputs['A'].default_value = tuple(b_up.inputs['Base Color'].default_value)
        mix.inputs['B'].default_value = (*S.srgb(sole), 1)
        S.link(m, mul.outputs['Value'], mix.inputs['Factor'])
        S.link(m, mix.outputs['Result'], b_up.inputs['Base Color'])
    # subtle stitched panel texture (a faint voronoi bump) on every level
    vor = S.node(m, 'ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 420
    S.link(m, tc.outputs['Object'], vor.inputs['Vector'])
    bump = S.node(m, 'ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.04 if lv > 1 else 0.08
    S.link(m, vor.outputs['Distance'], bump.inputs['Height'])
    S.link(m, bump.outputs['Normal'], b_up.inputs['Normal'])
    if lv == 1:
        S.add_grunge(m, amount=0.85, dirt='#4a3b2b', scale=22, rough_add=0.25, seed=3.0, zmask=(ZS, ZS + 0.03), strength=0.9)
        S.add_grunge(m, amount=0.3, dirt='#7d776c', scale=30, rough_add=0.15, seed=9.0, strength=0.45)
    if lv >= 2:
        # side mark, projected from the side, only where the surface faces sideways
        img = S.node(m, 'ShaderNodeTexImage')
        img.image = bpy.data.images.load(tex)
        img.image.colorspace_settings.name = 'Non-Color'
        img.extension = 'CLIP'
        img.interpolation = 'Cubic'
        comb = S.node(m, 'ShaderNodeCombineXYZ')
        mx = S.node(m, 'ShaderNodeMath'); mx.operation = 'MULTIPLY_ADD'
        mx.inputs[1].default_value = 0.78 / L; mx.inputs[2].default_value = 0.12
        mz = S.node(m, 'ShaderNodeMath'); mz.operation = 'MULTIPLY_ADD'
        mz.inputs[1].default_value = (31 / 0.052) / 64; mz.inputs[2].default_value = 0.25 - (ZS - 0.004) * (31 / 0.052) / 64
        S.link(m, sep.outputs['X'], mx.inputs[0]); S.link(m, sep.outputs['Z'], mz.inputs[0])
        S.link(m, mx.outputs['Value'], comb.inputs['X']); S.link(m, mz.outputs['Value'], comb.inputs['Y'])
        S.link(m, comb.outputs['Vector'], img.inputs['Vector'])
        geo = S.node(m, 'ShaderNodeNewGeometry')
        # object-space normal: transform world normal to object
        vt = S.node(m, 'ShaderNodeVectorTransform'); vt.vector_type = 'NORMAL'; vt.convert_from = 'WORLD'; vt.convert_to = 'OBJECT'
        S.link(m, geo.outputs['Normal'], vt.inputs['Vector'])
        sn = S.node(m, 'ShaderNodeSeparateXYZ'); S.link(m, vt.outputs['Vector'], sn.inputs[0])
        ab = S.node(m, 'ShaderNodeMath'); ab.operation = 'ABSOLUTE'
        S.link(m, sn.outputs['Y'], ab.inputs[0])
        side = S.node(m, 'ShaderNodeMapRange'); side.inputs['From Min'].default_value = 0.12; side.inputs['From Max'].default_value = 0.3
        S.link(m, ab.outputs['Value'], side.inputs['Value'])
        mk = S.node(m, 'ShaderNodeMath'); mk.operation = 'MULTIPLY'
        S.link(m, img.outputs['Color'], mk.inputs[0]); S.link(m, side.outputs['Result'], mk.inputs[1])
        if lv == 5 and base not in ('speed', 'elite'):
            b2 = nt.nodes.new('ShaderNodeBsdfPrincipled')
            b2.inputs['Base Color'].default_value = (*S.srgb((1.0, 0.80, 0.42)), 1)
            b2.inputs['Metallic'].default_value = 1.0
            b2.inputs['Roughness'].default_value = 0.3
        else:
            b2 = nt.nodes.new('ShaderNodeBsdfPrincipled')
            b2.inputs['Base Color'].default_value = (*S.srgb(acc_col), 1)
            b2.inputs['Roughness'].default_value = b_up.inputs['Roughness'].default_value
            b2.inputs['Coat Weight'].default_value = b_up.inputs['Coat Weight'].default_value
        S.link(m, bump.outputs['Normal'], b2.inputs['Normal'])
        ms = S.node(m, 'ShaderNodeMixShader')
        S.link(m, mk.outputs['Value'], ms.inputs['Fac'])
        S.link(m, b_up.outputs['BSDF'], ms.inputs[1])
        S.link(m, b2.outputs['BSDF'], ms.inputs[2])
        S.link(m, ms.outputs['Shader'], out.inputs['Surface'])
    return m


def surface_z(ob, x, y):
    """Top of the evaluated upper at (x, y), by ray cast from above."""
    ok, loc, nrm, idx = ob.ray_cast(Vector((x, y, 0.3)), Vector((0, 0, -1)))
    return loc.z if ok else None


def opening_rim(ob):
    """The edge loop where the carved opening meets the outside of the upper
    (edges between a lining face and an upper face), ordered into a loop."""
    import bmesh
    bm = bmesh.new(); bm.from_mesh(ob.data)
    edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.link_faces[0].material_index != e.link_faces[1].material_index]
    if not edges:
        return []
    adj = {}
    for e in edges:
        a, b = e.verts
        adj.setdefault(a.index, []).append(b.index); adj.setdefault(b.index, []).append(a.index)
    co = {v.index: v.co.copy() for v in bm.verts}
    start = edges[0].verts[0].index
    loop = [start]; prev = None; cur = start
    while True:
        nxt = [n for n in adj[cur] if n != prev]
        if not nxt or nxt[0] == start or len(loop) > 5000:
            break
        prev, cur = cur, nxt[0]; loop.append(cur)
    bm.free()
    pts = [co[i] for i in loop]
    # thin it out and smooth a little
    step = max(1, len(pts) // 60)
    pts = pts[::step]
    sm = []
    for i in range(len(pts)):
        sm.append((pts[i - 1] + pts[i] * 2 + pts[(i + 1) % len(pts)]) / 4)
    return sm


def lace(name, pts, radius, mat, cyclic=False):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    cu.bevel_depth = radius; cu.bevel_resolution = 4; cu.use_fill_caps = True
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1); sp.use_cyclic_u = cyclic
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    ob = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(ob)
    cu.materials.append(mat)
    return ob


def stud(name, x, y, top_z, tip_z, r_top, r_tip, mat):
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=r_tip, radius2=r_top, depth=top_z - tip_z,
                                    location=(x, y, (top_z + tip_z) / 2))
    ob = bpy.context.object; ob.name = name
    bev = ob.modifiers.new('bev', 'BEVEL'); bev.width = 0.0012; bev.segments = 3
    for p in ob.data.polygons: p.use_smooth = True
    ob.data.materials.append(mat)
    return ob


def build(base, lv, workdir):
    up, acc, sole_c = BOOT_LOOK[base]
    tex = os.path.join(workdir, f'mark_{base}.png')
    mark_image(base, tex, lv)

    upper = upper_mesh()
    S.apply_mods(upper)
    lining = S.principled('Lining', '#0b0c10', rough=0.95, spec=0.1)
    # carve the foot opening; the cut faces take the lining material
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1, location=(0.066, 0.0005, 0.098))
    cut = bpy.context.object
    cut.scale = (0.058, 0.0235, 0.044)
    cut.rotation_euler = (0, math.radians(-12), 0)
    cut.data.materials.append(lining)
    S.set_mat(upper, upper_material(base, lv, tex))
    S.boolean(upper, cut)
    for p in upper.data.polygons: p.use_smooth = True
    rim_pts = opening_rim(upper)

    sole = sole_mesh()
    sole_col = sole_c if lv >= 3 else '#4b5563'
    sole_mat = (S.gold('SoleGold', 0.34) if lv == 5 else
                S.principled('SoleMat', sole_col, rough={1: 0.8, 2: 0.6}.get(lv, 0.35), coat=0.3 if lv >= 3 else 0))
    if lv == 1:
        S.add_grunge(sole_mat, amount=0.6, dirt='#5a4a38', scale=70, rough_add=0.15, seed=7)
    S.set_mat(sole, sole_mat)

    parts = [upper, sole]
    if rim_pts and lv < 4:
        rim_col = {1: '#2a2a30'}.get(lv, '#14171e' if base != 'elite' else '#fbbf24')
        rim_mat = S.principled('Rim', rim_col, rough=0.7, sheen=0.4)
        parts.append(lace('RimTube', rim_pts, 0.0034, rim_mat, cyclic=True))
    # studs: tips all on the floor plane (z = TIP) except where the toe springs up
    TIP = -0.012 if lv > 1 else -0.009
    stud_mat = (S.gold('StudGold', 0.2) if lv == 5 else
                S.principled('Stud', '#e5e7eb' if lv >= 3 else '#9ca3af', rough=0.35 if lv >= 3 else 0.6))
    if lv == 1:
        S.add_grunge(stud_mat, amount=0.7, dirt='#5d4a35', scale=120, seed=11)
    studs = [(0.022, -0.019), (0.022, 0.019), (0.058, -0.021), (0.058, 0.021),
             (0.168, -0.032), (0.168, 0.034), (0.208, -0.036), (0.208, 0.039), (0.248, -0.03), (0.25, 0.032), (0.275, 0.004)]
    for i, (x, y) in enumerate(studs):
        sp = cr(SPRING, x)
        parts.append(stud(f'Stud{i}', x, y + cr(CENTRE, x), sp + 0.001, TIP + sp * 0.5, 0.0078, 0.0050, stud_mat))

    # laces across the throat, sat on the real surface (ray cast, no floating)
    bpy.context.view_layer.update()
    lace_col = {5: '#fde68a'}.get(lv, '#f1f5f9' if lv > 1 else '#cfd3d6')
    lace_mat = S.principled('Lace', lace_col, rough=0.6, sheen=0.5, metal=0.0)
    if lv == 1:
        S.add_grunge(lace_mat, amount=0.5, dirt='#8a7a63', scale=200, seed=5)
    for i in range(5):
        x = 0.128 + i * 0.019
        half = cr(W, x) * 0.2
        pts = []
        for f in (-1, -0.5, 0, 0.5, 1):
            y = f * half + cr(CENTRE, x) * 0.5
            xx = x + f * 0.004
            z = surface_z(upper, xx, y)
            if z is None: continue
            pts.append(Vector((xx, y, z + 0.0012)))
        if len(pts) >= 3:
            parts.append(lace(f'Lace{i}', pts, 0.0021, lace_mat))

    # tongue peeking out of the opening (levels 1-3) / knit collar (4-5)
    if lv >= 4:
        knit_col = '#1e3a8a' if acc == '#f8fafc' else acc
        if base == 'elite' and lv == 5:
            knit_col = '#fbbf24'
        knit = S.principled('Knit', knit_col, rough=0.9, sheen=0.0, spec=0.25)
        # rib texture
        tc = S.node(knit, 'ShaderNodeTexCoord')
        wave = S.node(knit, 'ShaderNodeTexWave'); wave.wave_type = 'BANDS'; wave.bands_direction = 'X'
        wave.inputs['Scale'].default_value = 3.0
        sepk = S.node(knit, 'ShaderNodeSeparateXYZ'); S.link(knit, tc.outputs['UV'], wave.inputs['Vector'])
        bump = S.node(knit, 'ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.6
        S.link(knit, wave.outputs['Fac'], bump.inputs['Height'])
        S.link(knit, bump.outputs['Normal'], knit.node_tree.nodes['Principled BSDF'].inputs['Normal'])
        rings = []
        for k in range(7):
            t = k / 6
            z0 = 0.062 + t * 0.026
            rx = 0.05 - 0.012 * t; ry = 0.0258 - 0.0045 * t
            ring = []
            for j in range(40):
                a = 2 * math.pi * j / 40
                x = 0.068 - 0.01 * t + rx * math.cos(a)
                y = ry * math.sin(a)
                z = z0 + 0.012 * (0.07 - x) / 0.05 + (0.004 if t > 0 else 0)
                ring.append((x, y, z))
            rings.append(ring)
        col = S.loft('Collar', rings, cap=False, subsurf=0)
        # UVs for the ribs: u around, v up
        me = col.data
        uv = me.uv_layers.new(name='UV')
        for poly in me.polygons:
            for li in poly.loop_indices:
                vi = me.loops[li].vertex_index
                ri, j = divmod(vi, 40)
                uv.data[li].uv = (j / 40 * 40, ri / 6)
        sol = col.modifiers.new('sol', 'SOLIDIFY'); sol.thickness = 0.0028; sol.offset = 0
        sub = col.modifiers.new('sub', 'SUBSURF'); sub.levels = sub.render_levels = 2
        S.set_mat(col, knit)
        parts.append(col)

    root = bpy.data.objects.new('Boot', None)
    bpy.context.scene.collection.objects.link(root)
    for p in parts:
        p.parent = root
    root.rotation_euler = (0, 0, math.radians(-24))
    root.location = (-L / 2, 0.06, -TIP)
    return root, parts, TIP


def main():
    a = S.args()
    base, lv, out = a[0], int(a[1]), a[2]
    samples = int(a[3]) if len(a) > 3 else 64
    S.reset()
    S.setup_render((600, 450), samples, view=os.environ.get('VIEW', 'Standard'))
    S.world(0.3)
    bpy.context.scene.view_settings.exposure = -0.8
    workdir = os.path.dirname(os.path.abspath(out))
    root, parts, tip = build(base, lv, '/dev/shm/blender-shop/tex')
    bpy.context.view_layer.update()
    S.studio_lights(scale=0.45, aim=(0, 0, 0.05))
    S.shadow_catcher(0.0)
    cam = S.camera((0.04, -0.58, 0.36), (0.0, 0.0, 0.045), lens=85)
    S.frame_objects(cam, [p for p in parts if p.type in ('MESH', 'CURVE')], fill=0.84, offset=(0, -0.01))
    S.render(out)


if __name__ == '__main__':
    main()
