"""Shared bits for the homes (towers, grand houses, farms, beach, islands): procedural window walls, ground, water."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
import studio as S
import house as H
from kit import *

box = box  # kit.box (bevel param same signature as house.box)


def mat_walls(lv=3):
    M = H.mats(lv)
    M['water'] = S.principled('Water', '#1b9ccf', rough=0.03, spec=0.8, emission='#2cb4e6', emission_strength=0.25)
    nt = M['water'].node_tree
    nz = S.node(M['water'], 'ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.9; nz.inputs['Detail'].default_value = 3
    tcn = S.node(M['water'], 'ShaderNodeTexCoord'); S.link(M['water'], tcn.outputs['Object'], nz.inputs['Vector'])
    bp = S.node(M['water'], 'ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.12; bp.inputs['Distance'].default_value = 0.5
    S.link(M['water'], nz.outputs['Fac'], bp.inputs['Height']); S.link(M['water'], bp.outputs['Normal'], nt.nodes['Principled BSDF'].inputs['Normal'])
    M['sand'] = S.principled('Sand', '#e6cf9c', rough=0.95)
    S.add_grunge(M['sand'], amount=0.5, dirt='#cdb27a', scale=14, rough_add=0.0, seed=5)
    M['deck'] = S.principled('Deck', '#9a6a3c', rough=0.55)
    M['hay'] = S.principled('Hay', '#d8b24a', rough=0.95)
    M['red'] = S.principled('Red', '#a3262a', rough=0.5, coat=0.3)
    M['asphalt'] = S.principled('Asphalt', '#2c2f36', rough=0.85)
    M['paint_white'] = S.principled('PWhite', '#f4f2ec', rough=0.45)
    M['conc'] = S.principled('Concrete', '#aaa7a0', rough=0.8)
    M['glassb'] = S.principled('GlassBlue', '#5d8fb0', rough=0.02, spec=1.0, metal=0.2)
    M['gold'] = S.gold('GoldTrim', 0.22)
    M['stone2'] = S.principled('StoneWall', '#b7ae9d', rough=0.85)
    S.add_grunge(M['stone2'], amount=0.5, dirt='#8d8575', scale=10, rough_add=0.0, seed=9)
    M['timber'] = S.principled('Timber', '#3a2a1c', rough=0.7)
    M['plaster'] = S.principled('Plaster', '#e9e1cf', rough=0.9)
    M['copper'] = S.principled('Copper', '#4aa58a', rough=0.45, metal=0.6)
    M['horse_b'] = S.principled('HorseBrown', '#7a4a2a', rough=0.55, coat=0.2)
    M['horse_w'] = S.principled('HorseWhite', '#ece8df', rough=0.55, coat=0.2)
    M['horse_k'] = S.principled('HorseBlack', '#1d1a1a', rough=0.45, coat=0.3)
    M['fence'] = S.principled('Fence', '#f1ede4', rough=0.6)
    M['woodfence'] = S.principled('WFence', '#7a5230', rough=0.7)
    M['umb'] = S.principled('Umbrella', '#e8483a', rough=0.5)
    return M


def window_wall(name, base, win='#14202e', cw=1.5, fh=3.0, wa=(0.2, 0.8), wz=(0.22, 0.8), lit=0.22, glow=1.0, hi=None, brick=None, rough=0.8, frame=None, sill=True, zoff=0.0, uoff=0.0):
    """Wall material: grid of windows by object coordinates (works on all four faces).
    base: hex wall colour (or brick=(c1,c2,mortar,scale)). lit: share of warm-lit windows.
    hi=(col,row): one window glowing gold (the one that is yours)."""
    m = S.principled(name, base, rough=rough)
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = S.node(m, 'ShaderNodeTexCoord')
    sep = S.node(m, 'ShaderNodeSeparateXYZ'); S.link(m, tc.outputs['Object'], sep.inputs[0])
    # u runs along whichever horizontal axis the face is on
    ax = S.node(m, 'ShaderNodeMath'); ax.operation = 'ABSOLUTE'; S.link(m, sep.outputs['X'], ax.inputs[0])
    ay = S.node(m, 'ShaderNodeMath'); ay.operation = 'ABSOLUTE'; S.link(m, sep.outputs['Y'], ay.inputs[0])
    nrm = S.node(m, 'ShaderNodeNewGeometry')
    # face-on-x vs face-on-y: |n.x| > |n.y|
    nx = S.node(m, 'ShaderNodeSeparateXYZ'); S.link(m, tc.outputs['Normal'], nx.inputs[0])
    anx = S.node(m, 'ShaderNodeMath'); anx.operation = 'ABSOLUTE'; S.link(m, nx.outputs['X'], anx.inputs[0])
    gt = S.node(m, 'ShaderNodeMath'); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = 0.5; S.link(m, anx.outputs['Value'], gt.inputs[0])
    # u = y when the face looks along x; x when it looks along y
    u = S.node(m, 'ShaderNodeMix'); u.data_type = 'FLOAT'
    S.link(m, gt.outputs['Value'], u.inputs['Factor']); S.link(m, sep.outputs['X'], u.inputs['A']); S.link(m, sep.outputs['Y'], u.inputs['B'])
    ua = S.node(m, 'ShaderNodeMath'); ua.operation = 'ADD'; ua.inputs[1].default_value = uoff; S.link(m, u.outputs['Result'], ua.inputs[0])
    uu = ua.outputs['Value']
    za = S.node(m, 'ShaderNodeMath'); za.operation = 'ADD'; za.inputs[1].default_value = zoff; S.link(m, sep.outputs['Z'], za.inputs[0])
    zz = za.outputs['Value']
    def divmod_(src, size):
        d = S.node(m, 'ShaderNodeMath'); d.operation = 'DIVIDE'; d.inputs[1].default_value = size; S.link(m, src, d.inputs[0])
        fl = S.node(m, 'ShaderNodeMath'); fl.operation = 'FLOOR'; S.link(m, d.outputs['Value'], fl.inputs[0])
        fr = S.node(m, 'ShaderNodeMath'); fr.operation = 'FRACT'; S.link(m, d.outputs['Value'], fr.inputs[0])
        return fl.outputs['Value'], fr.outputs['Value']
    ui, uf = divmod_(uu, cw)
    vi, vf = divmod_(zz, fh)

    def band(src, lo, hi_):
        g1 = S.node(m, 'ShaderNodeMath'); g1.operation = 'GREATER_THAN'; g1.inputs[1].default_value = lo; S.link(m, src, g1.inputs[0])
        g2 = S.node(m, 'ShaderNodeMath'); g2.operation = 'LESS_THAN'; g2.inputs[1].default_value = hi_; S.link(m, src, g2.inputs[0])
        mu = S.node(m, 'ShaderNodeMath'); mu.operation = 'MULTIPLY'; S.link(m, g1.outputs['Value'], mu.inputs[0]); S.link(m, g2.outputs['Value'], mu.inputs[1])
        return mu.outputs['Value']
    mx = band(uf, *wa); mz = band(vf, *wz)
    mk = S.node(m, 'ShaderNodeMath'); mk.operation = 'MULTIPLY'; S.link(m, mx, mk.inputs[0]); S.link(m, mz, mk.inputs[1])
    # sill: a lighter strip just under each window
    # random lit
    comb = S.node(m, 'ShaderNodeCombineXYZ'); S.link(m, ui, comb.inputs['X']); S.link(m, vi, comb.inputs['Y'])
    wn = S.node(m, 'ShaderNodeTexWhiteNoise'); wn.noise_dimensions = '3D'; S.link(m, comb.outputs['Vector'], wn.inputs['Vector'])
    lg = S.node(m, 'ShaderNodeMath'); lg.operation = 'LESS_THAN'; lg.inputs[1].default_value = lit; S.link(m, wn.outputs['Value'], lg.inputs[0])
    lit_m = S.node(m, 'ShaderNodeMath'); lit_m.operation = 'MULTIPLY'; S.link(m, lg.outputs['Value'], lit_m.inputs[0]); S.link(m, mk.outputs['Value'], lit_m.inputs[1])
    # base colour: wall (or brick) -> glass
    mix = S.node(m, 'ShaderNodeMix'); mix.data_type = 'RGBA'
    S.link(m, mk.outputs['Value'], mix.inputs['Factor'])
    if brick:
        sep2 = sep
        add = S.node(m, 'ShaderNodeMath'); add.operation = 'ADD'; S.link(m, sep.outputs['X'], add.inputs[0]); S.link(m, sep.outputs['Y'], add.inputs[1])
        cb = S.node(m, 'ShaderNodeCombineXYZ'); S.link(m, add.outputs['Value'], cb.inputs['X']); S.link(m, zz, cb.inputs['Y'])
        br = S.node(m, 'ShaderNodeTexBrick'); br.inputs['Scale'].default_value = brick[3]
        br.inputs['Color1'].default_value = (*S.srgb(brick[0]), 1); br.inputs['Color2'].default_value = (*S.srgb(brick[1]), 1)
        br.inputs['Mortar'].default_value = (*S.srgb(brick[2]), 1); br.inputs['Mortar Size'].default_value = 0.012
        br.inputs['Brick Width'].default_value = 0.5; br.inputs['Row Height'].default_value = 0.25
        S.link(m, cb.outputs['Vector'], br.inputs['Vector'])
        S.link(m, br.outputs['Color'], mix.inputs['A'])
    else:
        mix.inputs['A'].default_value = (*S.srgb(base), 1)
    mix.inputs['B'].default_value = (*S.srgb(win), 1)
    S.link(m, mix.outputs['Result'], b.inputs['Base Color'])
    # glass is shinier
    rr = S.node(m, 'ShaderNodeMapRange'); rr.inputs['To Min'].default_value = rough; rr.inputs['To Max'].default_value = 0.06
    S.link(m, mk.outputs['Value'], rr.inputs['Value']); S.link(m, rr.outputs['Result'], b.inputs['Roughness'])
    # emission: lit windows warm
    em = lit_m.outputs['Value']
    if hi is not None:
        e1 = S.node(m, 'ShaderNodeMath'); e1.operation = 'COMPARE'; e1.inputs[1].default_value = hi[0]; e1.inputs[2].default_value = 0.1
        S.link(m, ui, e1.inputs[0])
        e2 = S.node(m, 'ShaderNodeMath'); e2.operation = 'COMPARE'; e2.inputs[1].default_value = hi[1]; e2.inputs[2].default_value = 0.1
        S.link(m, vi, e2.inputs[0])
        hm = S.node(m, 'ShaderNodeMath'); hm.operation = 'MULTIPLY'; S.link(m, e1.outputs['Value'], hm.inputs[0]); S.link(m, e2.outputs['Value'], hm.inputs[1])
        hm2 = S.node(m, 'ShaderNodeMath'); hm2.operation = 'MULTIPLY'; S.link(m, hm.outputs['Value'], hm2.inputs[0]); S.link(m, mk.outputs['Value'], hm2.inputs[1])
        hx = S.node(m, 'ShaderNodeMath'); hx.operation = 'MULTIPLY'; hx.inputs[1].default_value = 5.0; S.link(m, hm2.outputs['Value'], hx.inputs[0])
        mxm = S.node(m, 'ShaderNodeMath'); mxm.operation = 'ADD'; S.link(m, em, mxm.inputs[0]); S.link(m, hx.outputs['Value'], mxm.inputs[1])
        em = mxm.outputs['Value']
    b.inputs['Emission Color'].default_value = (*S.srgb('#ffc462'), 1)
    es = S.node(m, 'ShaderNodeMath'); es.operation = 'MULTIPLY'; es.inputs[1].default_value = glow; S.link(m, em, es.inputs[0])
    S.link(m, es.outputs['Value'], b.inputs['Emission Strength'])
    return m


def ground(M, w, d, grass='grass', thick=0.7, z=0.0):
    return [box('Soil', (0, 0, -thick / 2 + z), (w, d, thick), M['soil'], bevel=0.25, seg=4),
            box('Top', (0, 0, -0.04 + z), (w - 0.02, d - 0.02, 0.1), M[grass], bevel=0.24, seg=4)]


def road(M, x, y, w, d, z=0.0):
    parts = [box('Road', (x, y, z + 0.035), (w, d, 0.07), M['asphalt'])]
    # dashes
    if w > d:
        for k in range(int(w / 2.4)):
            parts.append(box('Dash', (x - w / 2 + 1.2 + k * 2.4, y, z + 0.075), (1.0, 0.12, 0.012), M['white']))
    else:
        for k in range(int(d / 2.4)):
            parts.append(box('Dash', (x, y - d / 2 + 1.2 + k * 2.4, z + 0.075), (0.12, 1.0, 0.012), M['white']))
    return parts


def pavement(M, x, y, w, d, z=0.0):
    return [box('Pave', (x, y, z + 0.06), (w, d, 0.12), M['path'], bevel=0.02)]


def small_car(M, x, y, ang, col, z=0.0):
    c = S.principled('Car', col, rough=0.3, metal=0.4, coat=1.0)
    parts = []
    body = box('CarB', (0, 0, 0.45), (3.0, 1.4, 0.55), c, bevel=0.18)
    top = box('CarT', (-0.1, 0, 0.9), (1.6, 1.2, 0.5), M['glass'], bevel=0.18)
    parts += [body, top]
    for dx in (-0.95, 0.95):
        for dy in (-0.68, 0.68):
            parts.append(cyl('CW', (dx, dy, 0.28), 0.28, 0.2, 'Y', mat=M['dark'], bevel=0.03))
    for p in parts:
        p.rotation_euler = (0, 0, ang)
        p.location = Vector((x, y, z)) + Matrix.Rotation(ang, 3, 'Z') @ Vector(p.location)
    return parts


def water_block(M, w, d, depth=1.2, z=-0.04, x=0, y=0):
    return [box('Water', (x, y, z - depth / 2), (w, d, depth), M['water'], bevel=0.2, seg=3)]


def horse(M, x, y, z, ang, col='horse_b', s=1.0, graze=False):
    s = s * 0.9
    """A stylised horse: barrel body, neck, head, four legs, tail. Faces +X before rotation."""
    parts = []
    mat = M[col]
    def P(o):
        o.rotation_euler = (0, 0, ang)
        o.location = Vector((x, y, z)) + Matrix.Rotation(ang, 3, 'Z') @ (Vector(o.location) * s)
        o.scale = tuple(v * s for v in o.scale)
        parts.append(o)
    P(sph('Body', (0, 0, 1.35), 0.5, mat, scale=(1.9, 0.62, 0.78)))
    P(sph('Rump', (-0.6, 0, 1.4), 0.5, mat, scale=(0.85, 0.66, 0.85)))
    P(sph('Chest', (0.62, 0, 1.45), 0.5, mat, scale=(0.8, 0.6, 0.86)))
    neck_top = (1.35, 0, 2.0) if not graze else (1.25, 0, 1.0)
    P(tube('Neck', [(0.7, 0, 1.55), neck_top], 0.2, mat, smooth=False))
    head_c = (1.55, 0, 1.92) if not graze else (1.5, 0, 0.55)
    h = sph('Head', head_c, 0.5, mat, scale=(0.55, 0.17, 0.2))
    h.rotation_euler = (0, math.radians(-55 if not graze else -80), 0)
    P(h)
    mane = tube('Mane', [(0.75, 0, 1.78), (neck_top[0] - 0.1, 0, neck_top[2] + 0.05)], 0.07, M['horse_k'], smooth=False)
    P(mane)
    P(cyl('Ear', (1.4, 0.07, 2.2 if not graze else 1.15), 0.04, 0.16, 'Z', mat=mat))
    for dx, dy in ((0.7, 0.2), (0.7, -0.2), (-0.7, 0.2), (-0.7, -0.2)):
        P(tube(f'Leg{dx}{dy}', [(dx, dy, 1.1), (dx + (0.04 if dx < 0 else 0), dy, 0.08)], 0.07, mat, smooth=False))
        P(cyl(f'Hoof{dx}{dy}', (dx + (0.04 if dx < 0 else 0), dy, 0.05), 0.075, 0.1, 'Z', mat=M['horse_k']))
    P(tube('Tail', [(-1.15, 0, 1.5), (-1.45, 0, 1.2), (-1.5, 0, 0.7)], 0.08, M['horse_k'], smooth=True))
    return parts


def fence_run(M, p0, p1, h=1.1, mat='woodfence', post_every=2.0, rails=2, r=0.05):
    parts = []
    a = Vector(p0); b = Vector(p1)
    L = (b - a).length
    n = max(1, int(round(L / post_every)))
    for k in range(n + 1):
        p = a + (b - a) * (k / n)
        parts.append(box('Post', (p.x, p.y, h / 2), (0.12, 0.12, h), M[mat], bevel=0.02))
    for k in range(rails):
        z = h * (0.45 + 0.4 * k) if rails > 1 else h * 0.7
        parts.append(tube('Rail', [(a.x, a.y, z), (b.x, b.y, z)], r, M[mat], smooth=False, res=4))
    return parts


def fence_loop(M, x0, x1, y0, y1, gap=None, **kw):
    parts = []
    parts += fence_run(M, (x0, y0), (x1, y0), **kw)
    parts += fence_run(M, (x1, y0), (x1, y1), **kw)
    parts += fence_run(M, (x1, y1), (x0, y1), **kw)
    parts += fence_run(M, (x0, y1), (x0, y0), **kw)
    return parts


def city_cfg(sc, expo=None):
    d = dict(scale=sc, aim=(0, 0, 0.12 * sc), cam=(0.9 * sc, -1.2 * sc, 0.92 * sc), target=(0, 0, 0.1 * sc), lens=50, fill=0.9, fill_y=0.82, floor=-0.7, offset=(0, 0.0), floor_size=500)
    if expo is not None: d['expo'] = expo
    return d
