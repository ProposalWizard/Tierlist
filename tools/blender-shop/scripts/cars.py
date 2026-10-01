"""The Sports Car ladder (car-3), built in code, one level per render.

usage: python car.py -- <level 1-5> <out.png> [samples]
Level names from lib/star/lifestyleLevels.ts: Rusty Kit Car, Used Coupé,
Sports Car, Twin-Turbo GT, Track Racer. Paint follows StylePicture.tsx's PAINT
ladder: 1 faded + rust, 2 blue, 3 red, 4 black + chrome, 5 gold. Generic
shapes only: no real maker's car is copied and there are no badges.
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector
import studio as S
from boot import cr

SPECS = {}
# t runs 0 (rear) -> 1 (front)
SPEC = {
    1: dict(L=3.75, W=1.62, r=0.30, gap=0.07, nose=0.70, tail=0.80, belt=0.86, roof=1.36,
            cab=(0.24, 0.30, 0.56, 0.68), box=True, paint='#8c785c', rims='steel', rust=True),
    2: dict(L=4.20, W=1.76, r=0.32, gap=0.06, nose=0.58, tail=0.82, belt=0.86, roof=1.30,
            cab=(0.16, 0.30, 0.55, 0.70), paint='#2f6fe0', rims='silver'),
    3: dict(L=4.40, W=1.86, r=0.34, gap=0.05, nose=0.50, tail=0.80, belt=0.82, roof=1.20,
            cab=(0.24, 0.36, 0.55, 0.70), paint='#d01f1f', rims='silver5'),
    4: dict(L=4.60, W=1.96, r=0.36, gap=0.04, nose=0.48, tail=0.84, belt=0.84, roof=1.20,
            cab=(0.22, 0.36, 0.54, 0.69), paint='#0d1018', rims='chrome', spoiler='duck', vent=True),
    5: dict(L=4.85, W=2.02, r=0.36, gap=0.03, nose=0.42, tail=0.82, belt=0.80, roof=1.08,
            cab=(0.30, 0.42, 0.56, 0.70), paint='gold', rims='race', spoiler='wing', number=True, splitter=True),
}


def body(sp):
    Lc, W, r = sp['L'], sp['W'], sp['r']
    box = sp.get('box', False)
    belt, nose, tail = sp['belt'], sp['nose'], sp['tail']
    bw = sp.get('bonnet', 0.84)
    top = [(0, tail - 0.05), (0.03, tail), (0.12, belt - 0.01), (0.4, belt), (0.68, belt - 0.03),
           (bw, (belt + nose) / 2 + (0.05 if box else 0)), (0.95, nose + 0.01), (0.99, nose - 0.06), (1, nose - 0.12)]
    lf = sp.get('lift', 0.0)
    bot = [(0, 0.40 + lf), (0.03, 0.26 + lf), (0.1, 0.22 + lf), (0.9, 0.22 + lf), (0.97, 0.25 + lf), (1, 0.30 + lf)]
    if sp.get('splitter'):
        bot = [(0, 0.34), (0.03, 0.18), (0.1, 0.14), (0.9, 0.14), (0.98, 0.12), (1, 0.16)]
    wid = [(0, 0.78), (0.04, 0.95), (0.12, 1.0), (0.82, 1.0), (0.93, 0.92), (0.985, 0.78), (1, 0.55)]
    secs = []
    n = 46
    for i in range(n):
        t = 0.5 - 0.5 * math.cos(math.pi * i / (n - 1))
        x = (t - 0.5) * Lc
        zt = cr(top, t); zb = cr(bot, t); w = cr(wid, t) * W
        ring = S.superellipse_ring(0, (zt + zb) / 2, w / 2, (zt - zb) / 2, n=40,
                                   p_top=4.5 if box else 3.2, p_bot=5, taper=0.08 if box else 0.12)
        secs.append([(x, y, z) for y, z in ring])
    return S.loft('Body', secs, subsurf=2)


def greenhouse(sp):
    Lc, W = sp['L'], sp['W']
    rb, rr, rf, wb = sp['cab']   # rear-glass base, roof rear, roof front, windscreen base (t units)
    belt, roof = sp['belt'], sp['roof']
    prof = [(rb - 0.02, belt - 0.12), (rb, belt - 0.02), (rr, roof), ((rr + rf) / 2, roof + 0.015), (rf, roof), (wb, belt - 0.03), (wb + 0.02, belt - 0.12)]
    secs = []
    n = 30
    for i in range(n):
        t = rb - 0.02 + (wb + 0.02 - rb + 0.02) * (0.5 - 0.5 * math.cos(math.pi * i / (n - 1)))
        x = (t - 0.5) * Lc
        zt = cr(prof, t)
        zb = belt - 0.14
        if zt - zb < 0.02:
            zt = zb + 0.02
        w = W * (0.80 if not sp.get('box') else 0.86)
        ring = S.superellipse_ring(0, (zt + zb) / 2, w / 2, (zt - zb) / 2, n=40, p_top=3.0, p_bot=6, taper=0.30)
        secs.append([(x, y, z) for y, z in ring])
    return S.loft('Glass', secs, subsurf=2)


def paint_mat(sp, lv):
    if sp['paint'] == 'gold':
        m = S.principled('Paint', (*S.srgb((1.0, 0.78, 0.36)), 1), rough=0.22, metal=1.0, coat=1.0, coat_rough=0.03)
    elif lv == 1:
        m = S.principled('Paint', sp['paint'], rough=0.72, spec=0.3)
        S.add_grunge(m, amount=0.8, dirt='#6e2f12', scale=2.4, rough_add=0.2, seed=2.0, zmask=(0.25, 0.95), strength=1.0)
        S.add_grunge(m, amount=0.5, dirt='#8a4a20', scale=7.0, rough_add=0.1, seed=12.0, strength=0.8)
        S.add_grunge(m, amount=0.45, dirt='#6b5d4c', scale=11.0, rough_add=0.1, seed=6.0, strength=0.5)
    elif lv == 4:
        m = S.principled('Paint', sp['paint'], rough=0.28, metal=0.5, coat=1.0, coat_rough=0.02)
    else:
        m = S.principled('Paint', sp['paint'], rough=0.32, metal=0.45, coat=1.0, coat_rough=0.03)
    return m


def add_side_lines(m, xs, width=0.006, colour='#05070a', zrange=(0.25, 0.86)):
    """Door seams: thin dark lines at given x, on the sides only."""
    nt = m.node_tree
    out = nt.nodes['Material Output']
    surf = out.inputs['Surface'].links[0].from_socket
    tc = S.node(m, 'ShaderNodeTexCoord')
    sep = S.node(m, 'ShaderNodeSeparateXYZ'); S.link(m, tc.outputs['Object'], sep.inputs[0])
    acc = None
    for x0 in xs:
        sub = S.node(m, 'ShaderNodeMath'); sub.operation = 'SUBTRACT'; sub.inputs[1].default_value = x0
        S.link(m, sep.outputs['X'], sub.inputs[0])
        ab = S.node(m, 'ShaderNodeMath'); ab.operation = 'ABSOLUTE'; S.link(m, sub.outputs['Value'], ab.inputs[0])
        lt = S.node(m, 'ShaderNodeMath'); lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = width
        S.link(m, ab.outputs['Value'], lt.inputs[0])
        if acc is None:
            acc = lt.outputs['Value']
        else:
            mx = S.node(m, 'ShaderNodeMath'); mx.operation = 'MAXIMUM'
            S.link(m, acc, mx.inputs[0]); S.link(m, lt.outputs['Value'], mx.inputs[1]); acc = mx.outputs['Value']
    zr1 = S.node(m, 'ShaderNodeMath'); zr1.operation = 'GREATER_THAN'; zr1.inputs[1].default_value = zrange[0]
    zr2 = S.node(m, 'ShaderNodeMath'); zr2.operation = 'LESS_THAN'; zr2.inputs[1].default_value = zrange[1]
    S.link(m, sep.outputs['Z'], zr1.inputs[0]); S.link(m, sep.outputs['Z'], zr2.inputs[0])
    m1 = S.node(m, 'ShaderNodeMath'); m1.operation = 'MULTIPLY'
    S.link(m, zr1.outputs['Value'], m1.inputs[0]); S.link(m, zr2.outputs['Value'], m1.inputs[1])
    m2 = S.node(m, 'ShaderNodeMath'); m2.operation = 'MULTIPLY'
    S.link(m, acc, m2.inputs[0]); S.link(m, m1.outputs['Value'], m2.inputs[1])
    dark = nt.nodes.new('ShaderNodeBsdfPrincipled')
    dark.inputs['Base Color'].default_value = (*S.srgb(colour), 1)
    dark.inputs['Roughness'].default_value = 0.6
    mix = S.node(m, 'ShaderNodeMixShader')
    S.link(m, m2.outputs['Value'], mix.inputs['Fac'])
    S.link(m, surf, mix.inputs[1]); S.link(m, dark.outputs['BSDF'], mix.inputs[2])
    S.link(m, mix.outputs['Shader'], out.inputs['Surface'])


def add_lights(m, sp, lv):
    """Head and tail lights painted onto the body as emissive patches (flush,
    so nothing sticks out)."""
    Lc, W = sp['L'], sp['W']
    nt = m.node_tree
    out = nt.nodes['Material Output']
    tc = S.node(m, 'ShaderNodeTexCoord')
    sep = S.node(m, 'ShaderNodeSeparateXYZ'); S.link(m, tc.outputs['Object'], sep.inputs[0])
    ab = S.node(m, 'ShaderNodeMath'); ab.operation = 'ABSOLUTE'; S.link(m, sep.outputs['Y'], ab.inputs[0])

    def band(sock, lo, hi, soft=0.01):
        a = S.node(m, 'ShaderNodeMapRange'); a.inputs['From Min'].default_value = lo - soft; a.inputs['From Max'].default_value = lo
        bb = S.node(m, 'ShaderNodeMapRange'); bb.inputs['From Min'].default_value = hi + soft; bb.inputs['From Max'].default_value = hi
        S.link(m, sock, a.inputs['Value']); S.link(m, sock, bb.inputs['Value'])
        mu = S.node(m, 'ShaderNodeMath'); mu.operation = 'MULTIPLY'
        S.link(m, a.outputs['Result'], mu.inputs[0]); S.link(m, bb.outputs['Result'], mu.inputs[1])
        return mu.outputs['Value']

    def mask(xr, yr, zr):
        mx = band(sep.outputs['X'], *xr); my = band(ab.outputs['Value'], *yr); mz = band(sep.outputs['Z'], *zr)
        m1 = S.node(m, 'ShaderNodeMath'); m1.operation = 'MULTIPLY'; S.link(m, mx, m1.inputs[0]); S.link(m, my, m1.inputs[1])
        m2 = S.node(m, 'ShaderNodeMath'); m2.operation = 'MULTIPLY'; S.link(m, m1.outputs['Value'], m2.inputs[0]); S.link(m, mz, m2.inputs[1])
        return m2.outputs['Value']

    nose, tail = sp['nose'], sp['tail']
    if sp.get('box'):
        head = mask((0.5 * Lc - 0.3, 0.5 * Lc + 0.2), (W * 0.24, W * 0.40), (nose - 0.20, nose - 0.06))
    else:
        head = mask((0.5 * Lc - 0.42, 0.5 * Lc + 0.2), (W * 0.24, W * 0.42), (nose - 0.10, nose - 0.01))
    tailm = mask((-0.5 * Lc - 0.2, -0.5 * Lc + 0.12), (W * 0.18, W * 0.46), (tail - 0.16, tail - 0.06))
    surf = out.inputs['Surface'].links[0].from_socket
    hl = nt.nodes.new('ShaderNodeBsdfPrincipled')
    hl.inputs['Base Color'].default_value = (0.9, 0.92, 0.95, 1); hl.inputs['Roughness'].default_value = 0.05
    hl.inputs['Emission Color'].default_value = (1.0, 0.95, 0.85, 1); hl.inputs['Emission Strength'].default_value = 1.6 if lv > 1 else 0.4
    tl = nt.nodes.new('ShaderNodeBsdfPrincipled')
    tl.inputs['Base Color'].default_value = (0.6, 0.02, 0.02, 1); tl.inputs['Roughness'].default_value = 0.1
    tl.inputs['Emission Color'].default_value = (1.0, 0.05, 0.03, 1); tl.inputs['Emission Strength'].default_value = 2.0 if lv > 1 else 0.4
    m1 = S.node(m, 'ShaderNodeMixShader'); S.link(m, head, m1.inputs['Fac']); S.link(m, surf, m1.inputs[1]); S.link(m, hl.outputs['BSDF'], m1.inputs[2])
    m2 = S.node(m, 'ShaderNodeMixShader'); S.link(m, tailm, m2.inputs['Fac']); S.link(m, m1.outputs['Shader'], m2.inputs[1]); S.link(m, tl.outputs['BSDF'], m2.inputs[2])
    S.link(m, m2.outputs['Shader'], out.inputs['Surface'])


def glass_mat(sp):
    """Tinted glass, with the roof (above the side windows) painted."""
    m = S.principled('GlassMat', '#0a1220', rough=0.03, spec=0.9)
    return m


def roof_mix(gm, paint_m, roof_z, bpillar_x, Lc):
    """Greenhouse: tinted glass below the roof line, body paint above it and
    on a B-pillar band. One shader, so the edge is clean."""
    # copy the paint's surface into the glass material by grouping isn't
    # simple; rebuild a paint BSDF from the paint material's principled.
    pb = paint_m.node_tree.nodes['Principled BSDF']
    nt = gm.node_tree
    out = nt.nodes['Material Output']
    gb = nt.nodes['Principled BSDF']
    p2 = nt.nodes.new('ShaderNodeBsdfPrincipled')
    for k in ('Base Color', 'Roughness', 'Metallic', 'Coat Weight', 'Coat Roughness'):
        p2.inputs[k].default_value = pb.inputs[k].default_value
    if pb.inputs['Base Color'].links:  # rusty car: flat colour is fine on the roof
        pass
    tc = S.node(gm, 'ShaderNodeTexCoord')
    sep = S.node(gm, 'ShaderNodeSeparateXYZ'); S.link(gm, tc.outputs['Object'], sep.inputs[0])
    rz = S.node(gm, 'ShaderNodeMapRange'); rz.inputs['From Min'].default_value = roof_z - 0.012; rz.inputs['From Max'].default_value = roof_z
    S.link(gm, sep.outputs['Z'], rz.inputs['Value'])
    sub = S.node(gm, 'ShaderNodeMath'); sub.operation = 'SUBTRACT'; sub.inputs[1].default_value = bpillar_x
    S.link(gm, sep.outputs['X'], sub.inputs[0])
    ab = S.node(gm, 'ShaderNodeMath'); ab.operation = 'ABSOLUTE'; S.link(gm, sub.outputs['Value'], ab.inputs[0])
    bp = S.node(gm, 'ShaderNodeMapRange'); bp.inputs['From Min'].default_value = 0.07; bp.inputs['From Max'].default_value = 0.06
    S.link(gm, ab.outputs['Value'], bp.inputs['Value'])
    mx = S.node(gm, 'ShaderNodeMath'); mx.operation = 'MAXIMUM'
    S.link(gm, rz.outputs['Result'], mx.inputs[0]); S.link(gm, bp.outputs['Result'], mx.inputs[1])
    ms = S.node(gm, 'ShaderNodeMixShader')
    S.link(gm, mx.outputs['Value'], ms.inputs['Fac']); S.link(gm, gb.outputs['BSDF'], ms.inputs[1]); S.link(gm, p2.outputs['BSDF'], ms.inputs[2])
    S.link(gm, ms.outputs['Shader'], out.inputs['Surface'])


def cyl(name, loc, r, depth, axis='Y', verts=48, mat=None, bevel=0.0, seg=3):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc)
    ob = bpy.context.object; ob.name = name
    if axis == 'Y':
        ob.rotation_euler = (math.pi / 2, 0, 0)
    elif axis == 'X':
        ob.rotation_euler = (0, math.pi / 2, 0)
    if bevel:
        b = ob.modifiers.new('bev', 'BEVEL'); b.width = bevel; b.segments = seg; b.limit_method = 'ANGLE'
    for p in ob.data.polygons: p.use_smooth = True
    if mat: ob.data.materials.append(mat)
    return ob


def box(name, loc, size, mat=None, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object; ob.name = name; ob.scale = size; ob.rotation_euler = rot
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = ob.modifiers.new('bev', 'BEVEL'); b.width = bevel; b.segments = 3
    if mat: ob.data.materials.append(mat)
    return ob


def wheel(name, x, y, sp, lv, mats, side):
    r = sp['r']; wdt = sp.get('tw', 0.24 if lv < 4 else 0.28)
    if lv == 5 and 'tw' not in sp: wdt = 0.32
    parts = []
    tyre = cyl(name + 'Tyre', (x, y, r), r, wdt, mat=mats['tyre'], bevel=0.07 if lv < 5 else 0.05, seg=5)
    parts.append(tyre)
    face = y + side * (wdt / 2 - 0.01)
    rim_r = r * sp.get('rimf', (0.62 if lv == 1 else 0.68 if lv < 4 else 0.74))
    if sp.get('whitewall'):
        parts.append(cyl(name + 'WW', (x, face + side * 0.002, r), rim_r * 1.28, 0.03, mat=mats['ww']))
    rim = cyl(name + 'Rim', (x, face, r), rim_r, 0.05, mat=mats['rim'], bevel=0.012)
    parts.append(rim)
    inner = cyl(name + 'Dish', (x, face + side * 0.012, r), rim_r * 0.86, 0.04, mat=mats['rimdark'])
    parts.append(inner)
    nsp = sp.get('spokes', {1: 0, 2: 6, 3: 5, 4: 10, 5: 6}[lv])
    for k in range(nsp):
        a = 2 * math.pi * k / nsp + 0.3
        ln = rim_r * 0.82
        cx = x + math.cos(a) * ln / 2; cz = r + math.sin(a) * ln / 2
        sw = 0.05 if lv != 4 else 0.026
        if sp.get('wire'): sw = 0.012
        parts.append(box(name + f'Sp{k}', (cx, face + side * 0.02, cz), (ln, 0.03, sw), mats['rim'], bevel=0.008, rot=(0, -a, 0)))
    if sp.get('wire'):
        for k in range(18):
            a = 2 * math.pi * k / 18 + 0.1
            ln = rim_r * 0.82
            cx = x + math.cos(a) * ln / 2; cz = r + math.sin(a) * ln / 2
            parts.append(box(name + f'Wr{k}', (cx, face + side * 0.02, cz), (ln, 0.02, 0.008), mats['rim'], rot=(0, -a, 0)))
    if nsp == 0 and not sp.get('wire') and lv == 1:
        for k in range(6):
            a = 2 * math.pi * k / 6
            parts.append(cyl(name + f'H{k}', (x + math.cos(a) * rim_r * 0.55, face + side * 0.03, r + math.sin(a) * rim_r * 0.55), rim_r * 0.12, 0.02, mat=mats['rimdark'], verts=16))
    hub = cyl(name + 'Hub', (x, face + side * 0.03, r), rim_r * 0.2, 0.03, mat=mats['rim'], bevel=0.01)
    parts.append(hub)
    if lv >= 3 and not sp.get('wire'):
        parts.append(cyl(name + 'Disc', (x, face - side * 0.02, r), rim_r * 0.78, 0.02, mat=mats['disc']))
        parts.append(box(name + 'Cal', (x + rim_r * 0.45, face - side * 0.0, r + rim_r * 0.3), (0.09, 0.05, 0.16), mats['caliper'], bevel=0.015, rot=(0, 0.6, 0)))
    return parts


def ray_side(ob, x, z, side):
    ok, loc, nrm, idx = ob.ray_cast(Vector((x, side * 3.0, z)), Vector((0, -side, 0)))
    return (loc, nrm) if ok else (None, None)


def sph(name, loc, r, mat, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=r, location=loc)
    o = bpy.context.object; o.name = name; o.scale = scale
    for p in o.data.polygons: p.use_smooth = True
    o.data.materials.append(mat)
    return o


def build(lv, sp):
    Lc, W, r = sp['L'], sp['W'], sp['r']
    mats = {
        'tyre': S.principled('Tyre', '#151618', rough=0.85 if lv < 5 else 0.6, spec=0.3),
        'ww': S.principled('WW', '#f3efe4', rough=0.6),
        'rim': {'steel': S.principled('Rim', '#7d8187', rough=0.5, metal=0.6),
                'silver': S.principled('Rim', '#c9ccd1', rough=0.25, metal=1.0),
                'silver5': S.principled('Rim', '#d5d8dc', rough=0.18, metal=1.0),
                'chrome': S.chrome('Rim', 0.05),
                'race': S.gold('Rim', 0.25)}[sp['rims']],
        'rimdark': S.principled('RimDark', '#1b1d22' if lv != 1 else '#55585e', rough=0.5, metal=0.4),
        'disc': S.principled('Disc', '#6b6e74', rough=0.35, metal=1.0),
        'caliper': S.principled('Caliper', {3: '#f5c518', 4: '#d01f1f', 5: '#111318'}.get(lv, '#444444'), rough=0.3, coat=0.5),
        'well': S.principled('Well', '#07080a', rough=0.9, spec=0.1),
        'trim': S.principled('Trim', '#111216', rough=0.5),
        'chrome': S.chrome('ChromeTrim', 0.06),
        'seat': S.principled('Seat', sp.get('seat', '#2a2018'), rough=0.5, coat=0.2),
        'headlamp': S.principled('Lamp', '#fff6dd', rough=0.05, emission='#fff1c9', emission_strength=3.0),
    }
    if lv == 1:
        S.add_grunge(mats['rim'], amount=0.7, dirt='#7a3f1c', scale=30, seed=4)
    b = body(sp)
    S.apply_mods(b)
    paint = paint_mat(sp, lv)
    S.set_mat(b, paint)
    ts = sp.get('wheels_t', [0.17, 0.83] if lv != 5 else [0.16, 0.82])
    wx = [(t - 0.5) * Lc for t in ts]
    for i, x in enumerate(wx):
        for side in (-1, 1):
            c = cyl(f'Arch{i}{side}', (x, side * (W / 2 + 0.05), r), r + sp['gap'] + 0.04, 0.9, verts=64, mat=mats['well'])
            S.boolean(b, c)
    rb, rr, rf, wb = sp['cab']
    if sp.get('open'):
        # cockpit cut out of the body behind the windscreen
        x0 = (rb + 0.03 - 0.5) * Lc; x1 = (wb - 0.03 - 0.5) * Lc
        cut = box('Cock', ((x0 + x1) / 2, 0, sp['belt'] + 0.1), (x1 - x0, W * 0.66, 0.5), mats['well'])
        S.boolean(b, cut)
    for p in b.data.polygons: p.use_smooth = True
    xs = [((rf + wb) / 2 - 0.5) * Lc + 0.15, ((rb + rr) / 2 - 0.5) * Lc + 0.25] + [((a) - 0.5) * Lc for a in sp.get('seams', [])]
    if not sp.get('open'):
        add_side_lines(paint, xs, zrange=(0.3 + sp.get('lift', 0), sp['belt'] - 0.03))
    parts = [b]
    if not sp.get('open'):
        g = greenhouse(sp)
        S.apply_mods(g)
        gm = glass_mat(sp)
        S.set_mat(g, gm)
        roof_z = sp['roof'] - (0.10 if lv < 5 else 0.07)
        roof_mix(gm, paint, roof_z, (((rr + rf) / 2) - 0.5) * Lc - 0.05, Lc)
        for p in g.data.polygons:
            p.use_smooth = True
        parts.append(g)
    else:
        # low windscreen + two seats
        wsx = (wb - 0.5) * Lc
        gl = S.principled('Wind', '#9fc2d8', rough=0.03, spec=1.0)
        parts.append(box('Screen', (wsx - 0.02, 0, sp['belt'] + 0.2), (0.05, W * 0.7, 0.34), gl, bevel=0.01, rot=(0, math.radians(-28), 0)))
        for side in (-1, 1):
            sx = ((rb + wb) / 2 - 0.5) * Lc
            parts.append(box(f'Seat{side}', (sx, side * W * 0.18, sp['belt'] - 0.05), (0.5, 0.42, 0.14), mats['seat'], bevel=0.05))
            parts.append(box(f'SeatB{side}', (sx - 0.22, side * W * 0.18, sp['belt'] + 0.2), (0.12, 0.42, 0.46), mats['seat'], bevel=0.05, rot=(0, math.radians(-12), 0)))
    bpy.context.view_layer.update()
    add_lights(paint, sp, lv)
    if sp.get('round_lights'):
        for side in (-1, 1):
            parts.append(sph(f'Hl{side}', (0.5 * Lc - 0.12, side * W * 0.3, sp['nose'] - 0.02), 0.13, mats['headlamp'], (0.7, 1, 1)))
    parts.append(box('Grille', (0.5 * Lc - 0.02, 0, (0.3 if not sp.get('splitter') else 0.22) + 0.04 + sp.get('lift', 0)), (0.08, W * 0.5, 0.12 if not sp.get('box') else 0.16), mats['trim'], bevel=0.02))
    if sp.get('chromegrille'):
        parts.append(box('CGrille', (0.5 * Lc + 0.0, 0, sp['nose'] - 0.18), (0.06, W * 0.22, 0.3), mats['chrome'], bevel=0.02))
    if sp.get('box') or sp.get('bumper'):
        bm = S.principled('Bumper', '#a7a9ad', rough=0.4, metal=0.9)
        if lv == 1:
            S.add_grunge(bm, amount=0.65, dirt='#7a3f1c', scale=20, seed=8)
        else:
            bm = S.chrome('Bump', 0.08)
        parts.append(box('BumpF', (0.5 * Lc + 0.02, 0, 0.36 + sp.get('lift', 0)), (0.1, W * 0.92, 0.09), bm, bevel=0.03))
        parts.append(box('BumpR', (-0.5 * Lc - 0.02, 0, 0.42 + sp.get('lift', 0)), (0.1, W * 0.92, 0.09), bm, bevel=0.03))
    if sp.get('splitter'):
        parts.append(box('Splitter', (0.5 * Lc - 0.2, 0, 0.13), (0.34, W * 0.9, 0.03), mats['trim'], bevel=0.01))
    if sp.get('vent'):
        for side in (-1, 1):
            loc, nrm = ray_side(b, wx[0] + 0.62, 0.62, side)
            if loc:
                parts.append(box(f'Vent{side}', (loc.x, loc.y - side * 0.01, loc.z), (0.36, 0.05, 0.1), mats['trim'], bevel=0.02, rot=(0, math.radians(8), 0)))
    if sp.get('spoiler') == 'duck':
        parts.append(box('Duck', (-0.5 * Lc + 0.28, 0, sp['tail'] + 0.02), (0.36, W * 0.84, 0.05), paint, bevel=0.02, rot=(0, math.radians(-10), 0)))
    if sp.get('spoiler') == 'wing':
        wz = sp['roof'] + 0.06 if not sp.get('wingz') else sp['wingz']
        parts.append(box('Wing', (-0.5 * Lc + 0.22, 0, wz), (0.42, W * 1.0, 0.035), mats['trim'], bevel=0.012, rot=(0, math.radians(-8), 0)))
        for side in (-1, 1):
            parts.append(box(f'WingEnd{side}', (-0.5 * Lc + 0.22, side * W * 0.5, wz - 0.05), (0.5, 0.025, 0.22), paint, bevel=0.01))
            parts.append(box(f'WingPost{side}', (-0.5 * Lc + 0.3, side * W * 0.25, (wz + sp['tail']) / 2), (0.12, 0.03, wz - sp['tail']), mats['trim'], bevel=0.01))
    if sp.get('number'):
        for side in (-1, 1):
            loc, nrm = ray_side(b, 0.0, 0.55, side)
            if loc:
                disc = cyl(f'Num{side}', (loc.x, loc.y, loc.z), 0.31, 0.012, mat=S.principled('Roundel', '#f8fafc', rough=0.35, coat=0.6), verts=64)
                disc.rotation_euler = Vector((0, 0, 1)).rotation_difference(nrm).to_euler()
                parts.append(disc)
                cu = bpy.data.curves.new(f'Nine{side}', 'FONT'); cu.body = sp['number']; cu.size = 0.46; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'
                cu.extrude = 0.004
                try:
                    cu.font = bpy.data.fonts.load('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
                except Exception:
                    pass
                t = bpy.data.objects.new(f'Nine{side}', cu)
                bpy.context.scene.collection.objects.link(t)
                t.data.materials.append(S.principled('Ink', '#0b0d12', rough=0.4))
                bpy.context.view_layer.update()
                t.parent = disc
                t.matrix_parent_inverse.identity()
                t.location = (0, 0, 0.009)
                t.rotation_euler = (0, 0, 0)
                t.scale = (1 / disc.scale.x, 1 / disc.scale.y, 1 / disc.scale.z)
                parts.append(t)
    if sp.get('roofrack'):
        rx = ((rr + rf) / 2 - 0.5) * Lc
        rl = (rf - rr) * Lc * 0.85
        for side in (-1, 1):
            parts.append(box(f'RackR{side}', (rx, side * W * 0.3, sp['roof'] + 0.04), (rl, 0.04, 0.05), mats['chrome'], bevel=0.01))
        for k in range(4):
            parts.append(box(f'RackB{k}', (rx - rl / 2 + k * rl / 3, 0, sp['roof'] + 0.04), (0.04, W * 0.6, 0.04), mats['chrome']))
    if sp.get('lightbar'):
        parts.append(box('LBar', (((rr + rf) / 2 + 0.06 - 0.5) * Lc, 0, sp['roof'] + 0.08), (0.12, W * 0.55, 0.08), mats['trim'], bevel=0.02))
        for k in range(4):
            parts.append(sph(f'LB{k}', (((rr + rf) / 2 + 0.12 - 0.5) * Lc, (k - 1.5) * W * 0.12, sp['roof'] + 0.08), 0.045, mats['headlamp']))
    if sp.get('scoop'):
        parts.append(box('Scoop', (((rf + wb) / 2 + 0.07 - 0.5) * Lc, 0, sp['belt'] + 0.01), (0.5, 0.3, 0.07), mats['trim'], bevel=0.03))
    if False and sp.get('stripes'):
        sc = S.principled('Stripe', sp['stripes'], rough=0.3, coat=0.8)
        for yy in (-0.14, 0.14):
            parts.append(box(f'Str{yy}', (0.5 * Lc - 0.6, yy, sp['belt'] - 0.005), (1.15, 0.2, 0.012), sc))
    if sp.get('plinth'):
        pm = S.principled('Plinth', '#3b4766', rough=0.45, coat=0.4)
        parts.append(box('Plinth', (0, 0, -0.1), (Lc + 0.7, W + 0.7, 0.2), pm, bevel=0.05))
        rp = S.principled('Rope', '#b8142a', rough=0.7)
        for sx in (-1, 1):
            for sy in (-1, 1):
                parts.append(cyl(f'Post{sx}{sy}', (sx * (Lc / 2 + 0.3), sy * (W / 2 + 0.25), 0.4), 0.04, 0.8, axis='Z', mat=mats['chrome']))
        for sy in (-1, 1):
            parts.append(box(f'RopeY{sy}', (0, sy * (W / 2 + 0.25), 0.7), (Lc + 0.6, 0.03, 0.03), rp))
        for sx in (-1, 1):
            parts.append(box(f'RopeX{sx}', (sx * (Lc / 2 + 0.3), 0, 0.7), (0.03, W + 0.5, 0.03), rp))
    for i, x in enumerate(wx):
        for side in (-1, 1):
            y = side * (W / 2 - 0.16 + (0.03 if lv >= 4 else 0))
            parts += wheel(f'W{i}{side}', x, y, sp, lv, mats, side)
    return parts


def cfg_for(sp):
    return dict(scale=6.0 * sp.get('zoom', 1.0), aim=(0, 0, 0.6), cam=(6.4, -7.6, 2.2), target=(0, 0, 0.55), lens=55, fill=0.8, fill_y=0.7, floor=(-0.22 if sp.get('plinth') else 0.0), offset=(0, -0.01))


def make(fam, lv):
    sp = SPECS[fam][lv]
    parts = build(lv, sp)
    return parts, cfg_for(sp)


SPECS['car-3'] = SPEC


def _s(**k):
    return k


SPECS['car-1'] = {
    1: _s(L=4.35, W=1.72, r=0.31, gap=0.07, nose=0.74, tail=0.84, belt=0.90, roof=1.42, cab=(0.20, 0.28, 0.60, 0.72), box=True, paint='#7f8a6c', rims='steel', rust=True, seams=[0.5]),
    2: _s(L=4.75, W=1.80, r=0.32, gap=0.06, nose=0.62, tail=0.88, belt=0.88, roof=1.40, cab=(0.07, 0.11, 0.62, 0.76), paint='#2f6fe0', rims='silver', roofrack=True, seams=[0.5]),
    3: _s(L=4.75, W=1.88, r=0.34, gap=0.05, nose=0.55, tail=0.84, belt=0.84, roof=1.30, cab=(0.18, 0.30, 0.60, 0.74), paint='#d01f1f', rims='silver5', seams=[0.5]),
    4: _s(L=5.05, W=1.94, r=0.36, gap=0.04, nose=0.62, tail=0.92, belt=0.92, roof=1.36, cab=(0.16, 0.28, 0.62, 0.76), paint='#0d1018', rims='chrome', bumper=True, chromegrille=True, seams=[0.5]),
    5: _s(L=6.9, W=1.98, r=0.36, gap=0.04, nose=0.62, tail=0.90, belt=0.92, roof=1.36, cab=(0.10, 0.16, 0.76, 0.86), paint='gold', rims='race', bumper=True, chromegrille=True, wheels_t=[0.11, 0.87], seams=[0.38, 0.5, 0.62], zoom=1.15),
}
SPECS['car-2'] = {
    1: _s(L=3.75, W=1.64, r=0.29, gap=0.07, nose=0.68, tail=0.82, belt=0.84, roof=1.40, cab=(0.07, 0.14, 0.58, 0.72), box=True, paint='#8c785c', rims='steel', rust=True),
    2: _s(L=3.8, W=1.7, r=0.30, gap=0.06, nose=0.64, tail=0.84, belt=0.86, roof=1.42, cab=(0.06, 0.13, 0.60, 0.74), paint='#2f6fe0', rims='silver'),
    3: _s(L=4.0, W=1.78, r=0.32, gap=0.05, nose=0.58, tail=0.86, belt=0.88, roof=1.42, cab=(0.06, 0.15, 0.62, 0.76), paint='#d01f1f', rims='silver5'),
    4: _s(L=4.0, W=1.84, r=0.34, gap=0.04, nose=0.60, tail=0.84, belt=0.86, roof=1.36, cab=(0.07, 0.17, 0.60, 0.74), paint='#0d1018', rims='chrome', spoiler='duck', vent=True, stripes='#d01f1f'),
    5: _s(L=4.1, W=1.92, r=0.35, gap=0.04, nose=0.62, tail=0.88, belt=0.90, roof=1.40, cab=(0.07, 0.18, 0.60, 0.74), paint='gold', rims='race', spoiler='wing', wingz=1.58, scoop=True, lightbar=True, number='7', stripes='#0b0d12', lift=0.08, tw=0.30),
}
SPECS['suv'] = {
    1: _s(L=4.1, W=1.82, r=0.43, gap=0.08, nose=1.10, tail=1.20, belt=1.28, roof=1.82, cab=(0.06, 0.10, 0.62, 0.74), box=True, paint='#6f7a4a', rims='steel', rust=True, lift=0.32, roofrack=True, tw=0.30, bonnet=0.80),
    2: _s(L=4.7, W=1.92, r=0.40, gap=0.07, nose=1.00, tail=1.15, belt=1.20, roof=1.74, cab=(0.06, 0.12, 0.62, 0.76), paint='#2f6fe0', rims='silver', lift=0.28, roofrack=True, tw=0.28),
    3: _s(L=4.8, W=1.96, r=0.42, gap=0.06, nose=0.96, tail=1.14, belt=1.16, roof=1.68, cab=(0.06, 0.15, 0.62, 0.78), paint='#d01f1f', rims='silver5', lift=0.28, tw=0.28),
    4: _s(L=5.05, W=2.02, r=0.45, gap=0.06, nose=1.04, tail=1.22, belt=1.22, roof=1.76, cab=(0.08, 0.16, 0.62, 0.78), paint='#0d1018', rims='chrome', lift=0.30, bumper=True, chromegrille=True, tw=0.30),
    5: _s(L=6.0, W=2.12, r=0.46, gap=0.06, nose=1.06, tail=1.24, belt=1.26, roof=1.82, cab=(0.06, 0.12, 0.70, 0.82), paint='gold', rims='race', lift=0.30, bumper=True, lightbar=True, roofrack=True, wheels_t=[0.86, 0.14, 0.30], tw=0.32, seams=[0.5], zoom=1.15),
}
SPECS['classic'] = {
    1: _s(L=4.4, W=1.72, r=0.34, gap=0.07, nose=0.82, tail=0.84, belt=0.86, roof=1.42, cab=(0.18, 0.28, 0.52, 0.62), box=True, paint='#6c7a68', rims='steel', rust=True, round_lights=True, chromegrille=True, whitewall=True, wire=True, bonnet=0.78),
    2: _s(L=4.5, W=1.74, r=0.34, gap=0.06, nose=0.82, tail=0.84, belt=0.86, roof=1.42, cab=(0.18, 0.28, 0.54, 0.64), box=True, paint='#2f6fe0', rims='silver', round_lights=True, chromegrille=True, bumper=True, whitewall=True, wire=True, bonnet=0.78),
    3: _s(L=4.3, W=1.74, r=0.34, gap=0.06, nose=0.76, tail=0.80, belt=0.82, roof=1.02, cab=(0.30, 0.36, 0.52, 0.60), paint='#d01f1f', rims='silver', round_lights=True, chromegrille=True, bumper=True, whitewall=True, wire=True, open=True, seat='#5a3a22', bonnet=0.80),
    4: _s(L=4.5, W=1.62, r=0.40, gap=0.05, nose=0.78, tail=0.72, belt=0.74, roof=1.0, cab=(0.30, 0.34, 0.50, 0.56), paint='#0d1018', rims='chrome', round_lights=True, chromegrille=True, wire=True, open=True, number='4', seat='#7a1a1a', bonnet=0.80),
    5: _s(L=4.8, W=1.8, r=0.35, gap=0.05, nose=0.84, tail=0.86, belt=0.88, roof=1.38, cab=(0.16, 0.26, 0.52, 0.64), paint='gold', rims='race', round_lights=True, chromegrille=True, bumper=True, whitewall=True, wire=True, plinth=True, bonnet=0.78, zoom=1.2),
}
SPECS['car-4'] = {
    1: _s(L=4.5, W=1.96, r=0.34, gap=0.05, nose=0.46, tail=0.74, belt=0.72, roof=1.06, cab=(0.30, 0.42, 0.56, 0.70), paint='#7d6f5a', rims='steel', rust=True, splitter=True),
    2: _s(L=4.55, W=1.98, r=0.35, gap=0.04, nose=0.42, tail=0.74, belt=0.72, roof=1.04, cab=(0.30, 0.42, 0.56, 0.70), paint='#2f6fe0', rims='silver5', vent=True, splitter=True),
    3: _s(L=4.5, W=2.0, r=0.35, gap=0.04, nose=0.42, tail=0.74, belt=0.72, roof=1.0, cab=(0.34, 0.40, 0.56, 0.64), paint='#d01f1f', rims='silver5', vent=True, splitter=True, open=True, seat='#14100c'),
    4: _s(L=4.7, W=2.06, r=0.36, gap=0.03, nose=0.40, tail=0.74, belt=0.70, roof=1.0, cab=(0.30, 0.42, 0.57, 0.70), paint='#0d1018', rims='chrome', vent=True, splitter=True, spoiler='wing', wingz=1.12),
    5: _s(L=4.9, W=2.1, r=0.37, gap=0.03, nose=0.38, tail=0.74, belt=0.70, roof=0.98, cab=(0.32, 0.44, 0.58, 0.70), paint='gold', rims='race', vent=True, splitter=True, spoiler='wing', wingz=1.14, stripes='#0b0d12'),
}
