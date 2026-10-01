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
    return S.principled('Gem', col, rough=0.02, metal=0.25, coat=1.0, spec=1.0, emission=col, emission_strength=0.45)


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
BW = [(-0.07, 0.078, 0.058), (0.0, 0.074, 0.056), (0.03, 0.058, 0.046), (0.06, 0.040, 0.038), (0.15, 0.031, 0.031)]


def bw(z): return cr([(k[0], k[1]) for k in BW], z)
def bd(z): return cr([(k[0], k[2]) for k in BW], z)


def bust(M):
    P = []
    skin = M0('#262830', 0.55, 0.0, 0.2)
    secs = []
    for k in range(24):
        z = 0.15 - (0.15 + 0.06) * k / 23
        ring = S.superellipse_ring(0, 0, bw(z), bd(z), n=40, p_top=2.2, p_bot=2.2)
        secs.append([(xx, yy, z) for xx, yy in ring])
    torso = S.loft('Bust', secs, subsurf=2); S.apply_mods(torso); torso.data.materials.append(skin)
    for p in torso.data.polygons: p.use_smooth = True
    P.append(torso)
    return P


def chain_path(drop=0.07, z0=0.088, eps=0.004):
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
            g = solid_gem('LGm', p, size * 0.2, gem_m())
            g.location = p + (zv * (size * 0.12))
            P.append(g)
    return P


def chain_cfg(P):
    return P, dict(scale=0.3, aim=(0, 0, 0.05), cam=(0.3, -0.42, 0.26), target=(0, -0.03, 0.05), lens=70, fill=0.8, fill_y=0.74, floor=-0.0605)


def silver_make(lv):
    M = {}
    P = bust(M)
    metal = metalmat('silver', 'Ag')
    if lv == 1:
        P += link_chain(chain_path(0.06), 0.0042, metal, 0.0006)
    elif lv == 2:
        P += link_chain(chain_path(0.065), 0.0065, metal, 0.0011)
    elif lv == 3:
        P += link_chain(chain_path(0.07), 0.009, metal, 0.0019, flat=1.1)
    elif lv == 4:
        P += link_chain(chain_path(0.07, eps=0.006), 0.013, metal, 0.0033, flat=1.25)
    else:
        P += link_chain(chain_path(0.07, eps=0.006), 0.013, metal, 0.0033, flat=1.25, gems=1)
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
    elif lv == 3:
        P += link_chain(chain_path(0.065), 0.0045, plat, 0.0007)
        n = 9
        for k in range(n):
            u = (k / (n - 1)) * 2 - 1
            a = math.pi / 2 + u * 1.15
            z = 0.088 - 0.065 * (1 - u * u) ** 1.0 * 0.0 - 0.0
            zz = 0.088 - 0.065 * max(0.0, (1 - abs(u) ** 1.7))
            x = math.sin(u * 1.0) * (bw(zz) + 0.004) * 0.55
            y = -(bd(zz) + 0.004 + 0.005) * math.cos(u * 0.9)
            rs = 0.009 - 0.0045 * abs(u)
            P.append(solid_gem(f'D{k}', (x, y, zz), rs, gem_m(), rot=(math.pi / 2, 0, 0)))
            P.append(torus(f'S{k}', (x, y + 0.0, zz), rs * 1.15, 0.0011, 'Y', plat, 20, 6))
    elif lv == 4:
        for row, (zz, n) in enumerate(((0.13, 36), (0.108, 40), (0.086, 44))):
            for k in range(n):
                a = 2 * math.pi * k / n
                rx, ry = bw(zz) + 0.004, bd(zz) + 0.004
                P.append(solid_gem(f'C{row}{k}', (math.cos(a) * rx, math.sin(a) * ry, zz), 0.0036, gem_m(), rot=(math.pi / 2, 0, a + math.pi / 2)))
        for zz in (0.14, 0.119, 0.097, 0.075):
            P.append(tube(f'Rim{zz}', [(math.cos(2 * math.pi * k / 48) * (bw(zz) + 0.003), math.sin(2 * math.pi * k / 48) * (bd(zz) + 0.003), zz) for k in range(49)], 0.0011, plat, smooth=False, res=4, cap=False))
        for k in range(7):
            u = k / 6 * 2 - 1
            zz = 0.07 - 0.03 * (1 - abs(u))
            P.append(solid_gem(f'F{k}', (u * 0.04, -(bd(zz) + 0.009), zz), 0.007 - 0.0028 * abs(u), gem_m(), rot=(math.pi / 2, 0, 0)))
    else:
        P += link_chain(chain_path(0.065), 0.0062, gold, 0.0011)
        pink = S.principled('Pink', '#ff6fb5', rough=0.0, metal=0.15, coat=1.0, spec=1.0, transmission=0.2, ior=2.4)
        zc = 0.02
        cen = front_pt(zc, 0.02)
        P.append(solid_gem('Pk', cen, 0.021, pink, scale=(1.0, 1.0, 1.2), rot=(math.pi / 2, 0, 0)))
        for k in range(12):
            a = 2 * math.pi * k / 12
            P.append(solid_gem(f'H{k}', (cen[0] + math.cos(a) * 0.03, cen[1] + 0.002, cen[2] + math.sin(a) * 0.03), 0.0045, gem_m(), rot=(math.pi / 2, 0, 0)))
        P.append(torus('Halo', (cen[0], cen[1] + 0.003, cen[2]), 0.0325, 0.0017, 'Y', gold, 40, 8))
    return chain_cfg(P)


# ---------------------------------------------------------------- suit
def suit_make(lv):
    P = []
    cols = ['#6f5f4a', '#1d2f55', '#2b2f36', '#0c0d11', '#241a08']
    base = cols[lv - 1]
    cloth = S.principled('Cloth', base, rough=0.85 if lv < 4 else 0.45, sheen=0.4, coat=0.0 if lv < 4 else 0.35, coat_rough=0.2)
    nt = cloth.node_tree
    b = nt.nodes['Principled BSDF']
    # patterns
    tcn = S.node(cloth, 'ShaderNodeTexCoord')
    if lv == 1:
        S.add_grunge(cloth, amount=0.6, dirt='#8a7a5e', scale=40, rough_add=0.1, seed=3.0)
        chk = S.node(cloth, 'ShaderNodeTexChecker'); chk.inputs['Scale'].default_value = 60
        chk.inputs['Color1'].default_value = (*S.srgb('#6f5f4a'), 1); chk.inputs['Color2'].default_value = (*S.srgb('#5c4e3c'), 1)
        S.link(cloth, tcn.outputs['Object'], chk.inputs['Vector'])
    if lv in (3, 5):
        sep = S.node(cloth, 'ShaderNodeSeparateXYZ'); S.link(cloth, tcn.outputs['Object'], sep.inputs[0])
        mu = S.node(cloth, 'ShaderNodeMath'); mu.operation = 'MULTIPLY'; mu.inputs[1].default_value = 170 if lv == 3 else 120
        S.link(cloth, sep.outputs['X'], mu.inputs[0])
        fr = S.node(cloth, 'ShaderNodeMath'); fr.operation = 'FRACT'; S.link(cloth, mu.outputs['Value'], fr.inputs[0])
        lt = S.node(cloth, 'ShaderNodeMath'); lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = (0.05 if lv == 3 else 0.2); S.link(cloth, fr.outputs['Value'], lt.inputs[0])
        mix = S.node(cloth, 'ShaderNodeMix'); mix.data_type = 'RGBA'
        mix.inputs['A'].default_value = (*S.srgb(base), 1)
        mix.inputs['B'].default_value = (*S.srgb('#c9c9cf' if lv == 3 else '#f2c14e'), 1)
        S.link(cloth, lt.outputs['Value'], mix.inputs['Factor'])
        S.link(cloth, mix.outputs['Result'], b.inputs['Base Color'])
        if lv == 5:
            em = S.node(cloth, 'ShaderNodeMath'); em.operation = 'MULTIPLY'; em.inputs[1].default_value = 0.0; S.link(cloth, lt.outputs['Value'], em.inputs[0])
            b.inputs['Metallic'].default_value = 0.0
    shirt = M0('#d9d4c4' if lv == 1 else '#f4f4f1', 0.7, 0.0)
    lapel = cloth if lv < 4 else S.principled('Satin', '#16171c', rough=0.18, coat=0.5, sheen=0.8)
    tie = M0({1: '#8a3b2e', 2: '#b8332b', 3: '#7a1b2e', 4: '#0b0c10', 5: '#c9a227'}[lv], 0.35, 0.0, 0.3)
    gold = metalmat('gold', 'Btn')
    # torso: tapered loft (shoulders -> waist -> hem)
    T = 0.21
    prof = [(0.0, 0.16, 0.085, 0.0), (0.12, 0.185, 0.095, 0.0), (0.3, 0.21, 0.115, 0.0), (0.42, 0.205, 0.115, 0.0), (0.5, 0.17, 0.095, 0.0), (0.56, 0.12, 0.06, 0.0)]
    secs = []
    for k in range(30):
        t = k / 29
        z = 0.62 - t * 0.62 * 1.0
        w = cr([(0, 0.05), (0.04, 0.12), (0.1, 0.205), (0.2, 0.215), (0.55, 0.19), (0.8, 0.19), (1, 0.2)], t)
        d = cr([(0, 0.05), (0.04, 0.07), (0.1, 0.09), (0.2, 0.1), (0.55, 0.095), (0.8, 0.098), (1, 0.1)], t)
        ring = S.superellipse_ring(0, 0, w, d, n=40, p_top=2.6, p_bot=2.6)
        secs.append([(a, b_, z) for a, b_ in ring])
    jacket = S.loft('Jacket', secs, subsurf=2); S.apply_mods(jacket); jacket.data.materials.append(cloth)
    for p in jacket.data.polygons: p.use_smooth = True
    P.append(jacket)
    # shirt V and tie on the front (-Y)
    P.append(box('Shirt', (0, -0.098, 0.46), (0.1, 0.012, 0.2), shirt, bevel=0.004, rot=(0.03, 0, 0)))
    if lv >= 2:
        if lv == 4:
            P.append(sph('Bow', (0, -0.112, 0.54), 0.5, tie, scale=(0.06, 0.02, 0.03)))
        else:
            P.append(box('Tie', (0, -0.108, 0.42), (0.034, 0.008, 0.22), tie, bevel=0.003))
            P.append(box('Knot', (0, -0.11, 0.54), (0.04, 0.012, 0.03), tie, bevel=0.004))
    # lapels: two angled flaps
    for s in (-1, 1):
        P.append(box('Lapel', (s * 0.07, -0.108, 0.45), (0.05, 0.012, 0.25), lapel, bevel=0.005, rot=(0.0, 0.0, s * 0.26)))
    # buttons
    for z in (0.32, 0.22):
        P.append(cyl('Btn', (0.025, -0.118, z), 0.012, 0.006, 'Y', mat=gold if lv >= 4 else M0('#222222', 0.4), bevel=0.001))
        P[-1].rotation_euler = (math.pi / 2, 0, 0)
    # pocket square and pocket
    P.append(box('Pocket', (0.11, -0.108, 0.47), (0.05, 0.006, 0.012), lapel, bevel=0.002))
    if lv >= 3:
        P.append(box('Square', (0.11, -0.112, 0.485), (0.04, 0.006, 0.02), M0('#f2f2ee' if lv != 5 else '#c9a227', 0.5), bevel=0.003, rot=(0, 0.2, 0)))
    # sleeves: tapered tubes hanging at the sides
    for s in (-1, 1):
        sl = tube('Sleeve', [(s * 0.2, 0, 0.56), (s * 0.245, 0, 0.44), (s * 0.26, 0.01, 0.22)], 0.05, cloth, smooth=True, res=14)
        sl.data.bevel_depth = 0.052
        P.append(sl)
    # collar
    for s in (-1, 1):
        P.append(box('Collar', (s * 0.04, -0.06, 0.58), (0.06, 0.012, 0.04), lapel, bevel=0.004, rot=(0, 0, s * 0.3)))
    # hanger/mannequin pole
    P.append(cyl('Neck', (0, 0, 0.66), 0.04, 0.08, 'Z', mat=M0('#16171b', 0.4, 0.5)))
    P.append(cyl('Pole', (0, 0, 0.05), 0.014, 0.5, 'Z', mat=M0('#16171b', 0.4, 0.5)))
    P.append(cyl('Base', (0, 0, -0.17), 0.14, 0.025, 'Z', mat=M0('#16171b', 0.4, 0.5), bevel=0.006))
    if lv == 5:
        for k in range(12):
            P.append(sph('Gl', (-0.2 + 0.036 * k, -0.112, 0.1 + 0.02 * (k % 3)), 0.004, gold))
    place(P, (0, 0, 0.17), RZ(math.radians(28)))
    cfg = dict(scale=0.9, aim=(0, 0, 0.35), cam=(1.0, -1.3, 0.7), target=(0, 0, 0.32), lens=60)
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
    if fam in ('gold', 'rolex'):
        drop_to_floor(P)
    cfg = dict(dict(lens=55, fill=0.8, fill_y=0.74, floor=0.0, offset=(0, -0.01), floor_size=20), **cfg)
    return P, cfg
