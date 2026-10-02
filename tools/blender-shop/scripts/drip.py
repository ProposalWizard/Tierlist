"""Drip: suit, silver (chains), gold + rolex (watches), diamond (necklaces), art. All built in code."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector, Matrix
import studio as S
import tex
from boot import cr
from kit import *

WORLD = 0.35


def place(parts, loc=(0, 0, 0), rot=None):
    T = Matrix.Translation(Vector(loc)); R = rot.to_4x4() if rot is not None else Matrix.Identity(4)
    for o in parts:
        o.matrix_basis = T @ R @ o.matrix_basis
    return parts


def RX(a): return Matrix.Rotation(a, 3, 'X')
def RY(a): return Matrix.Rotation(a, 3, 'Y')
def RZ(a): return Matrix.Rotation(a, 3, 'Z')


def M0(col, rough=0.35, metal=0.0, coat=0.0):
    return S.principled('M', col, rough=rough, metal=metal, coat=coat)


def metalmat(kind, name='Mt'):
    if kind == 'gold': return S.principled(name, (*S.srgb((1.0, 0.78, 0.36)), 1), rough=0.2, metal=1.0, coat=0.5, coat_rough=0.05)
    if kind == 'gold2': return S.principled(name, (*S.srgb((0.93, 0.74, 0.40)), 1), rough=0.4, metal=1.0)
    if kind == 'steel': return S.principled(name, (*S.srgb((0.78, 0.8, 0.83)), 1), rough=0.3, metal=1.0)
    if kind == 'silver': return S.principled(name, (*S.srgb((0.92, 0.93, 0.95)), 1), rough=0.12, metal=1.0, coat=0.3)
    if kind == 'rose': return S.principled(name, (*S.srgb((0.95, 0.65, 0.55)), 1), rough=0.25, metal=1.0)
    if kind == 'titan': return S.principled(name, (*S.srgb((0.55, 0.57, 0.6)), 1), rough=0.35, metal=1.0)
    return S.chrome(name)


def gem_m(col='#f4fbff'):
    """v0.23.1: a cut stone that keeps its facets. The old one had emission 0.45 of near-white on a mirror finish, so every
    stone clipped to a white blob at 400px. Now: a mid cool-grey body, medium gloss (so the facets catch the light one by one
    instead of the whole stone mirroring the softbox) and a small emission floor."""
    c = S.srgb(col)
    base = tuple(min(0.3, c[i] * 0.2 + (0.06, 0.10, 0.15)[i]) for i in range(3))
    return S.principled('Gem', (*base, 1), rough=0.06, metal=0.0, coat=0.0, spec=0.6, emission=tuple(b * 0.9 for b in base), emission_strength=0.05)


# ---------------------------------------------------------------- watches
def watch(spec):
    """Returns group built face-up (+Z), 12 o'clock at +X, strap loop below. spec dict."""
    P = []
    cm = metalmat(spec['case'], 'Case')
    sm = metalmat(spec.get('strapm', spec['case']), 'Strap')
    R = spec.get('r', 0.021)
    cdepth = 0.012
    P.append(cyl('Case', (0, 0, 0), R, cdepth, 'Z', mat=cm, bevel=0.0025, verts=64))
    # lugs
    for sy in (-1, 1):
        for sx in (-1, 1):
            P.append(box('Lug', (sx * (R + 0.002), sy * 0.0105, -0.001), (0.01, 0.005, 0.006), cm, bevel=0.0015))
    # bezel
    bz = spec.get('bezel')
    bzm = {'gem': None}
    if bz == 'black':
        P.append(torus('Bezel', (0, 0, cdepth / 2 + 0.0004), R - 0.0022, 0.0022, 'Z', M0('#0c0d10', 0.25, 0.3, 0.5), 64, 12))
    elif bz == 'tacho':
        P.append(torus('Bezel', (0, 0, cdepth / 2 + 0.0004), R - 0.0022, 0.0024, 'Z', M0('#0c0d10', 0.25, 0.3, 0.5), 64, 12))
        for k in range(24):
            a = 2 * math.pi * k / 24
            P.append(box('Tk', (math.cos(a) * (R - 0.0022), -math.sin(a) * (R - 0.0022), cdepth / 2 + 0.0027), (0.0012, 0.003, 0.0004), M0('#f5f5f5', 0.4), rot=(0, 0, -a + math.pi / 2)))
    else:
        P.append(torus('Bezel', (0, 0, cdepth / 2 + 0.0004), R - 0.0018, 0.0019, 'Z', cm, 64, 12))
    if bz in ('gem', 'rainbow'):
        n = 36 if bz == 'gem' else 30
        cols = ['#f4fbff'] * n if bz == 'gem' else [c for _ in range(5) for c in ('#e0115f', '#ff8c00', '#f5e642', '#1faa59', '#1e6fff', '#8a2be2')][:n]
        for k in range(n):
            a = 2 * math.pi * k / n
            g = solid_gem('BG', (math.cos(a) * (R - 0.0022), -math.sin(a) * (R - 0.0022), cdepth / 2 + 0.0025), 0.0021, gem_m(cols[k]))
            P.append(g)
    # dial
    dm = S.principled('Dial', spec.get('dial', '#101216'), rough=0.3, metal=spec.get('dialmetal', 0.3), coat=0.8, coat_rough=0.05)
    P.append(cyl('Dial', (0, 0, cdepth / 2 - 0.0008), R - 0.0036, 0.0016, 'Z', mat=dm, verts=64))
    ind = metalmat(spec.get('ind', 'silver'), 'Ind')
    ig = spec.get('indgem')
    for k in range(12):
        a = 2 * math.pi * k / 12
        r_ = R - 0.0068
        pos = (math.cos(a) * r_, -math.sin(a) * r_, cdepth / 2 + 0.0002)
        if ig and k % (1 if ig == 'all' else 3) == 0:
            P.append(solid_gem('IG', (pos[0], pos[1], pos[2] + 0.0006), 0.0013 if k % 3 else 0.0017, gem_m()))
        else:
            P.append(box('Ix', pos, (0.0019 if k % 3 == 0 else 0.0012, 0.0005, 0.0006), ind, rot=(0, 0, -a + math.pi / 2)))
    if spec.get('crystaldial'):
        rs = random.Random(3)
        for k in range(26):
            a = rs.uniform(0, 2 * math.pi); rr_ = rs.uniform(0.003, R - 0.008)
            P.append(solid_gem('CD', (math.cos(a) * rr_, math.sin(a) * rr_, cdepth / 2 + 0.0006), 0.0012, gem_m(rs.choice(['#e8f4ff', '#b9d8ff', '#ffffff', '#cfe6ff']))))
    if spec.get('ice_dial'):
        rs = random.Random(7)
        for ring_r, n in ((R - 0.0105, 18), (R - 0.0145, 12)):
            for k in range(n):
                a = 2 * math.pi * (k + 0.5) / n
                P.append(solid_gem('ID', (math.cos(a) * ring_r, math.sin(a) * ring_r, cdepth / 2 + 0.0006), 0.0011, gem_m()))
    if spec.get('subdials'):
        for (dx, dy) in ((0.0075, 0.0), (-0.0042, 0.0072), (-0.0042, -0.0072)):
            P.append(cyl('Sub', (dx * 0.9, dy, cdepth / 2 + 0.0002), 0.0045, 0.0004, 'Z', mat=M0('#2a2d33', 0.3, 0.4), verts=32))
            P.append(box('SubH', (dx * 0.9, dy, cdepth / 2 + 0.0008), (0.0035, 0.0004, 0.0003), ind, rot=(0, 0, 0.8 * dx * 90)))
    # hands
    P.append(box('HH', (0.0035, -0.0009, cdepth / 2 + 0.0012), (0.0085, 0.0013, 0.0006), ind, rot=(0, 0, -0.45)))
    P.append(box('MH', (0.0062, 0.0035, cdepth / 2 + 0.0017), (0.0125, 0.0010, 0.0006), ind, rot=(0, 0, 0.5)))
    P.append(box('SH', (-0.003, 0.0, cdepth / 2 + 0.0022), (0.015, 0.0004, 0.0004), M0('#d01f1f', 0.3), rot=(0, 0, 2.3)))
    P.append(cyl('Cap', (0, 0, cdepth / 2 + 0.0022), 0.0015, 0.0012, 'Z', mat=ind, verts=16))
    # crystal
    P.append(cyl('Glass', (0, 0, cdepth / 2 + 0.0012), R - 0.0036, 0.0003, 'Z', mat=S.principled('Gl', '#cfe8ff', rough=0.0, spec=1.0, alpha=0.18) if False else M0('#ffffff', 0.0, 0.0), verts=64)) if False else None
    # crown + pushers
    P.append(cyl('Crown', (0, -R - 0.0025, 0.0), 0.0035, 0.006, 'Y', mat=cm, bevel=0.0007, verts=16))
    P[-1].location = (0, -R - 0.0025, 0)
    if spec.get('push'):
        for sx in (-0.007, 0.007):
            P.append(cyl('Push', (sx, -R - 0.002, 0.0), 0.0016, 0.005, 'Y', mat=cm, verts=12))
    # strap loop below, in the XZ plane
    Rl = spec.get('loop', 0.03)
    kind = spec.get('strap', 'bracelet')
    if kind == 'bracelet':
        N = 28
        sk = spec.get('gemlinks')
        Lp = 2 * math.pi * Rl / N
        for k in range(N):
            ang = 2 * math.pi * (k + 0.5) / N
            if ang < 0.5 or ang > 2 * math.pi - 0.5:
                continue
            for col, (wy, yy, off) in enumerate(((0.0105, 0.0, 0.0), (0.0052, 0.0079, 0.5), (0.0052, -0.0079, 0.5))):
                a2 = ang + off * 2 * math.pi / N * (1 if col else 0)
                if col and (a2 < 0.5 or a2 > 2 * math.pi - 0.5): continue
                cx = math.sin(a2) * Rl; cz = -Rl + math.cos(a2) * Rl
                lk = box('Lk', (0, 0, 0), (Lp * 0.96, wy * 0.94, 0.0038), sm, bevel=0.0009)
                lk.matrix_basis = Matrix.Translation((cx, yy, cz)) @ RY(a2).to_4x4() @ lk.matrix_basis
                P.append(lk)
                if sk and col == 0:
                    gg = solid_gem('LG', (0, 0, 0), 0.0028, gem_m())
                    gg.matrix_basis = Matrix.Translation((cx + math.sin(a2) * 0.002, yy, cz + math.cos(a2) * 0.002)) @ RY(a2).to_4x4() @ gg.matrix_basis
                    P.append(gg)
    else:
        col = spec.get('strapcol', '#5a3a22')
        sm2 = M0(col, 0.6, 0.0, 0.1)
        st = torus('Strap', (0, 0, -Rl), Rl, 0.0022, 'Y', sm2, 64, 10)
        st.scale = (1, 1, 9.0)
        P.append(st)
    return P


WATCH_SPECS = {
    'gold': {
        1: dict(case='steel', dial='#101216', strap='bracelet', ind='silver', bezel=None),
        2: dict(case='gold2', dial='#f1ece0', strap='leather', strapcol='#5a3a22', ind='gold2'),
        3: dict(case='gold', dial='#e6c875', dialmetal=0.8, strap='bracelet', ind='gold'),
        4: dict(case='gold', dial='#14161a', strap='bracelet', ind='gold', subdials=True, push=True, bezel='tacho'),
        5: dict(case='gold', dial='#14161a', strap='bracelet', ind='gold', bezel='gem', indgem=True),
    },
    'rolex': {
        1: dict(case='silver', dial='#0e2a5a', strap='bracelet', ind='silver', crystaldial=True),
        2: dict(case='silver', dial='#0b1b3a', strap='bracelet', ind='silver', indgem='all'),
        3: dict(case='gold', dial='#0c0d10', strap='bracelet', ind='gold', bezel='gem'),
        4: dict(case='gold', dial='#12151c', strap='bracelet', ind='gold', bezel='gem', ice_dial=True, indgem='all', gemlinks=True),
        5: dict(case='gold', dial='#14305e', strap='bracelet', ind='gold', bezel='rainbow', ice_dial=True, indgem='all', gemlinks=True),
    },
}


def make_watch(fam, lv):
    P = watch(WATCH_SPECS[fam][lv])
    place(P, (0, 0, 0), RZ(math.radians(-62.6)) @ RY(math.radians(65)) @ RZ(math.radians(180)))
    cfg = dict(scale=0.3, aim=(0, 0, 0.03), cam=(0.22, -0.36, 0.22), target=(0, 0, 0.03), lens=70)
    return P, cfg


# ---------------------------------------------------------------- chains & necklaces on a bust
# neck and shoulders: (z, half-width, half-depth), ascending z. A real display bust: slim neck, sloped shoulders.
BW = [(-0.045, 0.118, 0.062), (-0.02, 0.128, 0.066), (0.005, 0.118, 0.062), (0.03, 0.092, 0.054), (0.052, 0.058, 0.044),
      (0.072, 0.040, 0.036), (0.1, 0.033, 0.032), (0.16, 0.031, 0.031)]


def bw(z): return cr([(k[0], k[1]) for k in BW], z)
def bd(z): return cr([(k[0], k[2]) for k in BW], z)


def bust(M):
    P = []
    skin = S.principled('Velvet', '#07080d', rough=0.95, spec=0.15, sheen=0.0)
    secs = []
    for k in range(26):
        z = 0.16 - (0.16 + 0.045) * k / 25
        ring = S.superellipse_ring(0, 0, bw(z), bd(z), n=44, p_top=2.2, p_bot=2.2)
        secs.append([(xx, yy, z) for xx, yy in ring])
    torso = S.loft('Bust', secs, subsurf=2); S.apply_mods(torso); torso.data.materials.append(skin)
    for p in torso.data.polygons: p.use_smooth = True
    P.append(torso)
    P.append(cyl('Plinth', (0, 0, -0.056), 0.1, 0.022, 'Z', mat=S.principled('Plin', '#14161c', rough=0.3, metal=0.6), bevel=0.003, verts=48))
    return P


def chain_path(drop=0.07, z0=0.082, eps=0.004):
    """Round the neck, dipping down the chest at the front (-Y), following the bust surface."""
    pts = []
    n = 120
    for k in range(n):
        a = 2 * math.pi * k / n
        front = max(0.0, -math.sin(a))
        z = z0 - drop * front ** 1.5
        pts.append((math.cos(a) * (bw(z) + eps), math.sin(a) * (bd(z) + eps), z))
    return pts


def front_pt(z, eps=0.004):
    return (0.0, -(bd(z) + eps), z)


def link_chain(pts, size, mat, thick, flat=1.0, gems=None, n=None, sparse=False):
    """Interlocked oval links along a closed polyline."""
    P = []
    total = 0.0
    segs = []
    for i in range(len(pts)):
        a = Vector(pts[i]); b = Vector(pts[(i + 1) % len(pts)])
        segs.append((a, b, (b - a).length)); total += (b - a).length
    pitch = size * 0.78
    N = n or int(total / pitch)
    target = [total * k / N for k in range(N)]
    acc = 0.0; si = 0
    for k, tgt in enumerate(target):
        while si < len(segs) - 1 and acc + segs[si][2] < tgt:
            acc += segs[si][2]; si += 1
        a, b, L = segs[si]
        u = (tgt - acc) / L if L else 0
        p = a + (b - a) * u
        d = (b - a).normalized()
        o = torus('Lk', (0, 0, 0), size * 0.5, thick, 'Z', mat, 20, 8)
        o.scale = (1.0, 0.62 * flat + 0.2, 1.0)
        z = Vector((0, 0, 1))
        x = d
        yv = z.cross(x).normalized() if abs(z.dot(x)) < 0.98 else Vector((0, 1, 0))
        zv = x.cross(yv).normalized()
        Rm = Matrix((x, yv, zv)).transposed()
        roll = Matrix.Rotation(math.pi / 2 * (k % 2) + (0.25 if k % 2 == 0 else 0), 3, 'X')
        o.matrix_basis = Matrix.Translation(p) @ (Rm @ roll).to_4x4() @ o.matrix_basis
        P.append(o)
        if gems and k % gems == 0:
            g = solid_gem('LGm', p, size * 0.30, gem_m())
            out = Vector((p[0], p[1] * 1.5, 0.0)); out = out.normalized() if out.length else Vector((0, -1, 0)); g.location = p + out * (size * 0.46) + Vector((0, 0, size * 0.1))
            P.append(g)
    return P


def chain_cfg(P):
    return P, dict(scale=0.3, aim=(0, 0, 0.05), cam=(0.3, -0.42, 0.26), target=(0, -0.03, 0.05), lens=70, fill=0.66, fill_y=0.62, floor=-0.0675)


def silver_make(lv):
    M = {}
    P = bust(M)
    metal = metalmat('silver', 'Ag')
    if lv == 1:      # Thin Chain: a fine cable chain
        P += link_chain(chain_path(0.055), 0.0046, metal, 0.0007)
    elif lv == 2:    # Silver Chain: a curb chain
        P += link_chain(chain_path(0.062), 0.0072, metal, 0.0013, flat=1.1)
    elif lv == 3:    # Thick Silver Chain
        P += link_chain(chain_path(0.068), 0.0105, metal, 0.0024, flat=1.15)
    elif lv == 4:    # Heavy Link Chain: chunky Cuban links with a clasp bar
        P += link_chain(chain_path(0.07, eps=0.006), 0.0155, metal, 0.0042, flat=1.3)
    else:            # Iced-Out Chain: the heavy chain with a stone on every link
        P += link_chain(chain_path(0.07, eps=0.006), 0.0155, metal, 0.0042, flat=1.3, gems=1)
    return chain_cfg(P)


def pend(z, kind, r, mat, rot=(math.pi / 2, 0, 0), scale=(1, 1, 1)):
    x, y, zz = front_pt(z, 0.006 + r * 0.5)
    return solid_gem('Pd', (x, y, zz), r, mat, scale=scale, rot=rot)


def diamond_make(lv):
    M = {}
    P = bust(M)
    gold = metalmat('gold', 'Au')
    plat = metalmat('silver', 'Pt')
    if lv == 1:
        P += link_chain(chain_path(0.065), 0.004, plat, 0.0006)
        cr_m = S.principled('Qz', '#cfe3ff', rough=0.08, spec=1.0, transmission=0.6, ior=1.55)
        P.append(pend(0.02, 'q', 0.011, cr_m, scale=(0.6, 0.6, 1.9)))
    elif lv == 2:
        P += link_chain(chain_path(0.065), 0.0048, plat, 0.0007)
        P.append(pend(0.02, 'd', 0.0115, gem_m()))
        P.append(torus('Bz', front_pt(0.02, 0.012 * 0.7), 0.0128, 0.0012, 'Y', plat, 28, 6))
    elif lv == 3:    # Diamond Necklace: a riviera of graduated stones, each in a thin setting, on a fine chain
        path = chain_path(0.062, eps=0.005)
        P += link_chain(path, 0.0040, plat, 0.0006)
        fronts = [(i, p) for i, p in enumerate(path) if i > 0 and p[1] < -0.012]
        pick = fronts[::3]
        mid = len(pick) / 2
        for j, (i, p) in enumerate(pick):
            u = abs(j - (len(pick) - 1) / 2) / max(1.0, (len(pick) - 1) / 2)
            rs = 0.0072 - 0.0030 * u
            P.append(solid_gem(f'D{j}', (p[0], p[1] - 0.004, p[2]), rs, gem_m(), rot=(math.pi / 2, 0, 0)))
            P.append(torus(f'S{j}', (p[0], p[1] - 0.0015, p[2]), rs * 1.12, 0.0010, 'Y', plat, 20, 6))
    elif lv == 4:    # Diamond Collar: a choker band of stones round the neck and a drop
        for row, (zz, n) in enumerate(((0.118, 30), (0.100, 32), (0.082, 34))):
            for k in range(n):
                a = 2 * math.pi * k / n
                rx, ry = bw(zz) + 0.0032, bd(zz) + 0.0032
                P.append(solid_gem(f'C{row}_{k}', (math.cos(a) * rx, math.sin(a) * ry, zz), 0.0043, gem_m(), rot=(math.pi / 2, 0, a + math.pi / 2)))
        for zz in (0.128, 0.109, 0.091, 0.073):
            P.append(tube(f'Rim{zz}', [(math.cos(2 * math.pi * k / 48) * (bw(zz) + 0.0025), math.sin(2 * math.pi * k / 48) * (bd(zz) + 0.0025), zz) for k in range(49)], 0.0009, plat, smooth=False, res=4, cap=False))
        for j, (zz, rr) in enumerate(((0.066, 0.0052), (0.050, 0.0068), (0.031, 0.0090))):
            P.append(solid_gem(f'F{j}', (0.0, -(bd(zz) + rr * 0.9), zz), rr, gem_m(), rot=(math.pi / 2, 0, 0)))
    else:
        P += link_chain(chain_path(0.065), 0.0062, gold, 0.0011)
        pink = S.principled('Pink', '#ff6fb5', rough=0.0, metal=0.15, coat=1.0, spec=1.0, transmission=0.2, ior=2.4)
        zc = 0.02
        cen = front_pt(zc, 0.02)
        P.append(solid_gem('Pk', cen, 0.019, pink, scale=(1.0, 1.0, 1.15), rot=(math.pi / 2, 0, 0)))
        for k in range(12):
            a = 2 * math.pi * k / 12
            P.append(solid_gem(f'H{k}', (cen[0] + math.cos(a) * 0.029, cen[1] + 0.0, cen[2] + math.sin(a) * 0.029), 0.0042, gem_m(), rot=(math.pi / 2, 0, 0)))
        P.append(torus('Halo', (cen[0], cen[1] + 0.0035, cen[2]), 0.0305, 0.0021, 'Y', metalmat('gold2', 'Au2'), 40, 8))
    return chain_cfg(P)


# ---------------------------------------------------------------- suit (v0.23.1: rebuilt)
def _stripes(m, base_hex, line_hex, freq, width, metal_line=False, rough_line=None):
    """Vertical pinstripes: a line every 1/freq metres across the cloth (object X)."""
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = S.node(m, 'ShaderNodeTexCoord')
    sep = S.node(m, 'ShaderNodeSeparateXYZ'); S.link(m, tc.outputs['Object'], sep.inputs[0])
    mu = S.node(m, 'ShaderNodeMath'); mu.operation = 'MULTIPLY'; mu.inputs[1].default_value = freq
    S.link(m, sep.outputs['X'], mu.inputs[0])
    fr = S.node(m, 'ShaderNodeMath'); fr.operation = 'FRACT'; S.link(m, mu.outputs['Value'], fr.inputs[0])
    lt = S.node(m, 'ShaderNodeMath'); lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = width
    S.link(m, fr.outputs['Value'], lt.inputs[0])
    mix = S.node(m, 'ShaderNodeMix'); mix.data_type = 'RGBA'
    mix.inputs['A'].default_value = (*S.srgb(base_hex), 1)
    mix.inputs['B'].default_value = (*S.srgb(line_hex), 1)
    S.link(m, lt.outputs['Value'], mix.inputs['Factor'])
    S.link(m, mix.outputs['Result'], b.inputs['Base Color'])
    if metal_line:
        S.link(m, lt.outputs['Value'], b.inputs['Metallic'])
        rl = S.node(m, 'ShaderNodeMath'); rl.operation = 'MULTIPLY_ADD'
        rl.inputs[1].default_value = -0.35; rl.inputs[2].default_value = 0.7
        S.link(m, lt.outputs['Value'], rl.inputs[0]); S.link(m, rl.outputs['Value'], b.inputs['Roughness'])


def _weave(m, c1, c2, scale):
    """Tweed: a fine two-colour checker with a little bump."""
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = S.node(m, 'ShaderNodeTexCoord')
    chk = S.node(m, 'ShaderNodeTexChecker'); chk.inputs['Scale'].default_value = scale
    chk.inputs['Color1'].default_value = (*S.srgb(c1), 1); chk.inputs['Color2'].default_value = (*S.srgb(c2), 1)
    S.link(m, tc.outputs['Object'], chk.inputs['Vector'])
    nz = S.node(m, 'ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale * 0.6; nz.inputs['Detail'].default_value = 6
    S.link(m, tc.outputs['Object'], nz.inputs['Vector'])
    mix = S.node(m, 'ShaderNodeMix'); mix.data_type = 'RGBA'; mix.inputs['Factor'].default_value = 0.35
    S.link(m, chk.outputs['Color'], mix.inputs['A'])
    mix.inputs['B'].default_value = (*S.srgb('#8f7650'), 1)
    S.link(m, nz.outputs['Fac'], mix.inputs['Factor'])
    S.link(m, mix.outputs['Result'], b.inputs['Base Color'])
    bump = S.node(m, 'ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.35
    S.link(m, nz.outputs['Fac'], bump.inputs['Height']); S.link(m, bump.outputs['Normal'], b.inputs['Normal'])


SUIT = {
    1: dict(name='Blazer', base='#7a6340', rough=0.92),
    2: dict(name='HighSt', base='#22345f', rough=0.8),
    3: dict(name='Tailored', base='#2d3036', rough=0.7),
    4: dict(name='Designer', base='#0a0b0f', rough=0.5),
    5: dict(name='GoldThread', base='#0f0b05', rough=0.45),
}


def suit_make(lv):
    from horses import ring_loft
    P = []
    sp = SUIT[lv]
    cloth = S.principled('Cloth', sp['base'], rough=sp['rough'], sheen=0.5 if lv < 4 else 0.1, coat=0.0 if lv < 4 else 0.2, coat_rough=0.25)
    if lv == 1: _weave(cloth, '#7a6340', '#5e4a2c', 90)
    if lv == 3: _stripes(cloth, '#2d3036', '#aeb2bb', 90, 0.07)
    if lv == 5: _stripes(cloth, '#0f0b05', '#f2c14e', 70, 0.09, metal_line=True)
    gold = metalmat('gold', 'Btn'); brass = metalmat('gold2', 'Brass')
    shirt = M0('#e9e4d4' if lv == 1 else '#f6f6f3', 0.7)
    if lv == 4: lapel = S.principled('Satin', '#0b0c10', rough=0.16, coat=0.7, sheen=0.9)
    elif lv == 5: lapel = S.principled('GoldSatin', '#c79a2b', rough=0.22, metal=0.85, coat=0.4)
    else: lapel = cloth
    tie_col = {1: None, 2: '#b8332b', 3: '#6e1a2c', 4: None, 5: '#d8a924'}[lv]

    # ---- jacket body: shoulders -> chest -> waist -> hem
    def prof(t):
        w = cr([(0, 0.07), (0.05, 0.15), (0.11, 0.208), (0.25, 0.208), (0.55, 0.19), (0.8, 0.197), (1, 0.205)], t)
        d = cr([(0, 0.06), (0.05, 0.075), (0.11, 0.092), (0.3, 0.105), (0.6, 0.099), (1, 0.102)], t)
        return w, d
    secs = []
    for k in range(34):
        t = k / 33
        z = 0.64 - t * 0.64
        w, d = prof(t)
        ring = S.superellipse_ring(0, 0, w, d, n=44, p_top=2.5, p_bot=2.5)
        secs.append([(a_, b_, z) for a_, b_ in ring])
    jacket = S.loft('Jacket', secs, subsurf=2); S.apply_mods(jacket); jacket.data.materials.append(cloth)
    for p in jacket.data.polygons: p.use_smooth = True
    P.append(jacket)
    dz = lambda z: prof(1 - z / 0.64)[1]
    # ---- sleeves hanging from the shoulders (a lofted tube each)
    for sg in (-1, 1):
        pts = [(sg * 0.172, 0.0, 0.606), (sg * 0.215, 0.006, 0.52), (sg * 0.243, 0.025, 0.33), (sg * 0.262, 0.045, 0.13)]
        rad = [(0.052, 0.060), (0.056, 0.062), (0.046, 0.050), (0.040, 0.043)]
        sl = ring_loft('Sleeve', pts, rad, cloth, n=18, subsurf=1, up=(0, 1, 0))
        P.append(sl)
        # shirt cuff peeking out + a button
        P.append(cyl('Cuff', (sg * 0.2645, 0.0455, 0.098), 0.040, 0.03, 'Z', mat=shirt, bevel=0.004))
        P.append(cyl('Cuff2', (sg * 0.2645, 0.0455, 0.118), 0.0415, 0.012, 'Z', mat=lapel if lv > 2 else cloth))
        if lv >= 2:
            P.append(sph('Cb', (sg * 0.2645 + sg * 0.036, 0.0455, 0.12), 0.0045, gold if lv >= 4 else brass))
    # ---- shirt V and neckline
    y_front = lambda z: -(dz(z) + 0.0015)
    vz = 0.30
    P.append(mesh_from('ShirtV', [(-0.058, y_front(0.60), 0.605), (0.058, y_front(0.60), 0.605), (0.0, y_front(vz), vz)], [(0, 2, 1)], shirt))
    P.append(box('Collar1', (-0.032, y_front(0.60) - 0.004, 0.612), (0.07, 0.014, 0.036), shirt, bevel=0.005, rot=(0.0, 0, 0.5)))
    P.append(box('Collar2', (0.032, y_front(0.60) - 0.004, 0.612), (0.07, 0.014, 0.036), shirt, bevel=0.005, rot=(0.0, 0, -0.5)))
    # ---- tie or bow tie
    if lv == 4:
        bt = S.principled('Bow', '#0a0a0e', rough=0.2, coat=0.5, sheen=0.8)
        P.append(sph('BowL', (-0.027, y_front(0.585) - 0.006, 0.585), 0.03, bt, scale=(1.0, 0.45, 0.7)))
        P.append(sph('BowR', (0.027, y_front(0.585) - 0.006, 0.585), 0.03, bt, scale=(1.0, 0.45, 0.7)))
        P.append(sph('BowK', (0.0, y_front(0.585) - 0.01, 0.585), 0.014, bt, scale=(1.0, 0.7, 1.0)))
    elif tie_col:
        tm = S.principled('Tie', tie_col, rough=0.3, coat=0.4, metal=0.6 if lv == 5 else 0.0, sheen=0.5)
        P.append(mesh_from('Tie', [(-0.017, y_front(0.58) - 0.005, 0.58), (0.017, y_front(0.58) - 0.005, 0.58), (0.027, y_front(0.30) - 0.006, 0.30), (0.0, y_front(0.27) - 0.006, 0.265), (-0.027, y_front(0.30) - 0.006, 0.30)], [(0, 4, 3, 2, 1)], tm))
        P[-1].modifiers.new('sol', 'SOLIDIFY').thickness = 0.006
        P.append(box('Knot', (0, y_front(0.58) - 0.007, 0.585), (0.04, 0.016, 0.03), tm, bevel=0.005))
    # ---- lapels: notch (peak on the tux) strips from the neck down to the button point
    for sg in (-1, 1):
        if lv == 4:   # peak lapel
            vs = [(sg * 0.050, y_front(0.60) - 0.003, 0.61), (sg * 0.145, y_front(0.5) - 0.003, 0.50), (sg * 0.085, y_front(0.46) - 0.003, 0.455), (sg * 0.012, y_front(vz) - 0.003, vz)]
        else:         # notch lapel
            vs = [(sg * 0.050, y_front(0.60) - 0.003, 0.61), (sg * 0.125, y_front(0.5) - 0.003, 0.485), (sg * 0.103, y_front(0.455) - 0.003, 0.455), (sg * 0.082, y_front(0.44) - 0.003, 0.44), (sg * 0.012, y_front(vz) - 0.003, vz)]
        n = len(vs)
        fc = [tuple(range(n))] if sg == 1 else [tuple(reversed(range(n)))]
        lp = mesh_from('Lapel', vs, fc, lapel)
        so = lp.modifiers.new('sol', 'SOLIDIFY'); so.thickness = 0.011; so.offset = 1
        bv = lp.modifiers.new('bev', 'BEVEL'); bv.width = 0.003; bv.segments = 2
        P.append(lp)
    # ---- buttons, flap pockets, breast pocket + square
    for z in ((0.30, 0.20) if lv != 1 else (0.30,)):
        P.append(cyl('Btn', (0.0, y_front(z) - 0.004, z), 0.0125, 0.007, 'Y', mat=gold if lv >= 4 else (brass if lv == 1 else M0('#161616', 0.35, 0.0, 0.5)), bevel=0.0012))
        P[-1].rotation_euler = (math.pi / 2, 0, 0)
    for sg in (-1, 1):
        P.append(box('Flap', (sg * 0.115, y_front(0.17) - 0.004, 0.17), (0.085, 0.008, 0.026), lapel if lv >= 3 else cloth, bevel=0.003, rot=(0, 0, sg * -0.05)))
    P.append(box('Pocket', (0.115, y_front(0.46) - 0.003, 0.455), (0.058, 0.005, 0.011), lapel if lv >= 3 else cloth, bevel=0.002))
    if lv >= 2:
        sq = M0({2: '#f1f1ee', 3: '#f6f2e8', 4: '#f6f6f3', 5: '#e2b53a'}[lv], 0.55, 0.9 if lv == 5 else 0.0)
        P.append(box('Square', (0.115, y_front(0.47) - 0.005, 0.478), (0.046, 0.008, 0.026), sq, bevel=0.003, rot=(0, 0.15, 0)))
        P.append(box('Square2', (0.108, y_front(0.47) - 0.006, 0.485), (0.026, 0.006, 0.022), sq, bevel=0.003, rot=(0, -0.2, 0)))
    if lv == 1:      # elbow patches + a charity-shop price tag on a string
        pa = S.principled('Patch', '#4a3a22', rough=0.9)
        for sg in (-1, 1):
            P.append(sph('Patch', (sg * 0.238, 0.06, 0.345), 0.04, pa, scale=(0.8, 0.5, 1.2)))
        tag = S.principled('Tag', '#efe7d2', rough=0.7)
        P.append(box('Tag', (-0.172, y_front(0.40) - 0.01, 0.37), (0.05, 0.004, 0.034), tag, bevel=0.002, rot=(0, 0.0, 0.3)))
        P.append(tube('Str', [(-0.19, y_front(0.46) - 0.006, 0.455), (-0.185, y_front(0.42) - 0.012, 0.40), (-0.172, y_front(0.40) - 0.01, 0.385)], 0.0012, M0('#222222', 0.5), smooth=False, res=4))
    if lv == 5:      # gold lapel pin and cufflinks sparkle
        P.append(sph('Pin', (-0.105, y_front(0.5) - 0.008, 0.5), 0.011, gold))
    # ---- display form: neck stub, pole and base
    P.append(cyl('Neck', (0, 0, 0.68), 0.04, 0.08, 'Z', mat=M0('#16171b', 0.4, 0.5)))
    P.append(cyl('Pole', (0, 0, -0.065), 0.014, 0.15, 'Z', mat=M0('#16171b', 0.4, 0.5)))
    P.append(cyl('Base', (0, 0, -0.145), 0.14, 0.025, 'Z', mat=M0('#16171b', 0.4, 0.5), bevel=0.006))
    place(P, (0, 0, 0.1325), RZ(math.radians(24)))
    cfg = dict(scale=0.9, aim=(0, 0, 0.45), cam=(1.0, -1.3, 0.75), target=(0, 0, 0.45), lens=60, fill=0.8, fill_y=0.8)
    return P, cfg


# ---------------------------------------------------------------- art on an easel
def art_make(lv):
    P = []
    key = ['poster', 'print', 'orig', 'gallery', 'master'][lv - 1]
    img = tex.painting(key, 'art' + key)
    cw, ch = (0.5, 0.64) if lv != 4 else (0.58, 0.72)
    wood = M0('#7a5230', 0.55, 0.0, 0.2)
    goldm = metalmat('gold', 'Frame')
    paper = screen_mat_rough(img)
    # easel: the legs stand BEHIND the picture; a ledge in front holds it up
    top_z = 0.93
    for dx in (-0.2, 0.2):
        P.append(tube('EL', [(dx, 0.07, top_z + 0.1), (dx * 1.35, 0.2, 0.0)], 0.012, wood, smooth=False, res=8))
    P.append(tube('EB', [(0, 0.1, top_z + 0.08), (0, 0.55, 0.0)], 0.012, wood, smooth=False, res=8))
    P.append(box('Ledge', (0, -0.035, 0.2), (0.62, 0.06, 0.03), wood, bevel=0.004))
    P.append(box('Bar', (0, 0.05, top_z + 0.11), (0.5, 0.03, 0.035), wood, bevel=0.004))
    G = []
    if lv == 1:
        G.append(plane('Poster', (0, 0, 0), (cw, ch), paper))
        G[-1].rotation_euler = (math.pi / 2, 0, 0)
        for sx in (-1, 1):
            G.append(sph('Pin', (sx * (cw / 2 - 0.02), -0.002, ch / 2 - 0.02), 0.01, M0('#d01f1f', 0.3), scale=(1, 0.5, 1)))
        # curled bottom corner
        G.append(cyl('Curl', (0, 0, -ch / 2), 0.012, cw * 0.9, 'X', mat=M0('#f2eee4', 0.6)))
        G[-1].location = (cw * 0.0, 0.0, -ch / 2 - 0.002)
        G[-1].scale = (1, 1, 1)
    elif lv == 2:
        G.append(rbox('Frame', (0, 0.012, 0), (cw + 0.04, 0.02, ch + 0.04), M0('#111216', 0.35, 0.2), 0.005))
        G.append(rbox('Mat', (0, 0.0015, 0), (cw, 0.004, ch), M0('#f4f2ec', 0.8), 0.001))
        pic = plane('Print', (0, -0.0015, 0), (cw * 0.78, ch * 0.78), paper); pic.rotation_euler = (math.pi / 2, 0, 0)
        G.append(pic)
    elif lv == 3:
        G.append(rbox('Frame', (0, 0.015, 0), (cw + 0.06, 0.03, ch + 0.06), wood, 0.006))
        G.append(rbox('Fi', (0, 0.0, 0), (cw + 0.012, 0.004, ch + 0.012), M0('#e8dcc0', 0.6), 0.002))
        pic = plane('Paint', (0, -0.003, 0), (cw, ch), paper); pic.rotation_euler = (math.pi / 2, 0, 0)
        G.append(pic)
    elif lv == 4:
        G.append(rbox('Canvas', (0, 0.012, 0), (cw, 0.024, ch), M0('#f2f2ee', 0.8), 0.002))
        pic = plane('Art', (0, -0.001, 0), (cw, ch), paper); pic.rotation_euler = (math.pi / 2, 0, 0)
        G.append(pic)
        G.append(rbox('Float', (0, 0.026, 0), (cw + 0.03, 0.01, ch + 0.03), M0('#16171b', 0.5), 0.002))
    else:
        G.append(rbox('Frame', (0, 0.025, 0), (cw + 0.13, 0.05, ch + 0.13), goldm, 0.01))
        for i, (ww, hh, off) in enumerate(((cw + 0.07, ch + 0.07, 0.0), (cw + 0.02, ch + 0.02, -0.004))):
            G.append(rbox(f'Step{i}', (0, 0.012 + off * 0, -0.0), (ww, 0.01, hh), M0('#2a1d10', 0.5, 0.0, 0.3) if i == 0 else goldm, 0.003))
        G[-2].location = (0, 0.002, 0); G[-1].location = (0, -0.004, 0)
        pic = plane('Master', (0, -0.012, 0), (cw, ch), paper); pic.rotation_euler = (math.pi / 2, 0, 0)
        G.append(pic)
        for sx in (-1, 1):
            for sz in (-1, 1):
                G.append(sph('Orn', (sx * (cw / 2 + 0.058), -0.003, sz * (ch / 2 + 0.058)), 0.022, goldm, scale=(1, 0.6, 1)))
        G.append(rbox('Plate', (0, -0.002, -ch / 2 - 0.095), (0.12, 0.004, 0.025), goldm, 0.002))
    place(G, (0, -0.0, 0.23 + ch / 2 + (0.06 if lv == 5 else 0.0)))
    # lean the picture a little back (easel is steeper)
    for o in G:
        pass
    P += G
    place(P, (0, 0, 0), RZ(math.radians(-22)))
    cfg = dict(scale=0.8, aim=(0, 0, 0.55), cam=(0.85, -1.15, 0.8), target=(0, 0, 0.55), lens=60)
    return P, cfg


def screen_mat_rough(path):
    m = S.principled('Art', '#ffffff', rough=0.55)
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(path)
    S.link(m, t.outputs['Color'], b.inputs['Base Color'])
    return m


def rbox(name, c, size, mat, r=0.01, rot=(0, 0, 0)):
    return box(name, c, size, mat, bevel=r, seg=4, rot=rot)


def drop_to_floor(parts):
    """Shift the group so its lowest point rests on z=0."""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    mn = 1e9
    for o in parts:
        if o.type != 'MESH': continue
        oe = o.evaluated_get(dg); me = oe.to_mesh()
        st = max(1, len(me.vertices) // 400)
        for i in range(0, len(me.vertices), st):
            mn = min(mn, (oe.matrix_world @ me.vertices[i].co).z)
        oe.to_mesh_clear()
    for o in parts:
        o.matrix_basis = Matrix.Translation((0, 0, -mn)) @ o.matrix_basis


def make(fam, lv):
    if fam in ('gold', 'rolex'):
        P, cfg = make_watch(fam, lv)
    elif fam == 'silver':
        P, cfg = silver_make(lv)
    elif fam == 'diamond':
        P, cfg = diamond_make(lv)
    elif fam == 'suit':
        P, cfg = suit_make(lv)
    else:
        P, cfg = art_make(lv)
    P = convert_curves(P)
    if fam in ('silver', 'diamond'):
        cfg['frame_parts'] = [o for o in P if not o.name.startswith(('Bust', 'Plinth'))]
    if fam in ('gold', 'rolex'):
        drop_to_floor(P)
    cfg = dict(dict(lens=55, fill=0.8, fill_y=0.74, floor=0.0, offset=(0, -0.01), floor_size=20), **cfg)
    return P, cfg
