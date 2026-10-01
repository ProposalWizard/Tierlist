"""Store pictures (v0.23.1): coin packs, the two boosts and the accessories, in the same studio as the shop.

usage: python store.py -- <name> <out.png> [samples] [w h]
names: coins-handful coins-pouch coins-bag coins-chest coins-vault coins-stadium
       boost-training boost-stat
       acc-headband-white acc-headband-ninja acc-snood-black acc-sleeves-black acc-sleeves-white acc-tape-white
       acc-gloves-black acc-gloves-gold acc-armband-classic acc-armband-rainbow
       acc-boots-blackout acc-boots-volt acc-boots-gold   (these use boot.py's boot)
Everything is modelled in code. No brands, no real marks.
"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector, Matrix
import studio as S
from kit import *
from drip import place, RX, RY, RZ, M0, metalmat, drop_to_floor
from horses import ring_loft


def G(rough=0.22):
    return S.gold('Gold', rough)


# ---------------------------------------------------------------- coins
def coin(loc, tilt=(0, 0, 0), r=0.04, k=True, mat=None):
    """A gold coin lying flat (axis Z) with a raised rim and a K on its top face."""
    gm = mat or G()
    P = [cyl('Coin', (0, 0, 0), r, 0.0065, 'Z', verts=48, mat=gm, bevel=0.0008)]
    P.append(torus('Rim', (0, 0, 0.0032), r * 0.93, r * 0.07, 'Z', gm, 48, 8))
    if k:
        P.append(text('K', 'K', (0, 0, 0.0036), r * 0.95, S.gold('GoldDark', 0.5), extrude=0.0014, rot=(0, 0, 0)))
    R = Matrix.Rotation(tilt[2], 4, 'Z') @ Matrix.Rotation(tilt[1], 4, 'Y') @ Matrix.Rotation(tilt[0], 4, 'X')
    for o in P:
        o.matrix_basis = Matrix.Translation(loc) @ R @ o.matrix_basis
    return P


def stack(x, y, n, r=0.04, jitter=0.0016, seed=1, z0=0.0, k_top=True):
    rnd = random.Random(seed); P = []
    for i in range(n):
        P += coin((x + rnd.uniform(-jitter, jitter), y + rnd.uniform(-jitter, jitter), z0 + 0.00325 + i * 0.0068), (0, 0, rnd.uniform(0, 6.28)), r, k=(i == n - 1 and k_top))
    return P


def scatter(pts, r=0.04, seed=3):
    rnd = random.Random(seed); P = []
    for i, (x, y) in enumerate(pts):
        P += coin((x, y, 0.00325 + i * 0.0011), (rnd.uniform(-0.05, 0.05), rnd.uniform(-0.05, 0.05), rnd.uniform(0, 6.28)), r, k=True)
    return P


def leaning(x, y, base_z, ang=0.9, rz=0.0, r=0.04):
    """a coin leaning on a stack, standing up on its edge"""
    return coin((x, y, base_z + r * math.sin(ang) + 0.003), (ang, 0, rz), r, k=True)


def gold_bar(loc, rz=0.0, s=1.0):
    gm = S.gold('Bar', 0.18)
    P = [box('Bar', (0, 0, 0), (0.095 * s, 0.045 * s, 0.028 * s), gm, bevel=0.004, seg=3)]
    # sloped top: a slightly smaller block on top
    P.append(box('BarTop', (0, 0, 0.0155 * s), (0.078 * s, 0.032 * s, 0.006 * s), gm, bevel=0.003))
    for o in P:
        o.matrix_basis = Matrix.Translation(loc) @ Matrix.Rotation(rz, 4, 'Z') @ o.matrix_basis
    return P


def burlap(name='Burlap', col='#a98a57'):
    m = S.principled(name, col, rough=0.98, sheen=0.3)
    nz = S.node(m, 'ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 220; nz.inputs['Detail'].default_value = 2
    tc = S.node(m, 'ShaderNodeTexCoord'); S.link(m, tc.outputs['Object'], nz.inputs['Vector'])
    bp = S.node(m, 'ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.5
    S.link(m, nz.outputs['Fac'], bp.inputs['Height']); S.link(m, bp.outputs['Normal'], m.node_tree.nodes['Principled BSDF'].inputs['Normal'])
    return m


def leather(col='#5a3a22'):
    m = S.principled('Leather', col, rough=0.55, coat=0.2, coat_rough=0.3)
    nz = S.node(m, 'ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 90; nz.inputs['Detail'].default_value = 4
    tc = S.node(m, 'ShaderNodeTexCoord'); S.link(m, tc.outputs['Object'], nz.inputs['Vector'])
    bp = S.node(m, 'ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.25
    S.link(m, nz.outputs['Fac'], bp.inputs['Height']); S.link(m, bp.outputs['Normal'], m.node_tree.nodes['Principled BSDF'].inputs['Normal'])
    return m


def open_sack(x, y, r, mat, cord, heap=True, flare=1.0, lean=0.0):
    """A sack with its mouth rolled down and gold heaped out of the top. r = body radius."""
    H = r * 1.5
    P = [sph('SackB', (x, y, r * 0.78), r, mat, scale=(1.0, 1.0, 0.95), seg=40, rings=24)]
    P.append(cyl('SackN', (x, y, r * 1.45), r * 0.72, r * 0.7, 'Z', verts=40, mat=mat, r2=r * 0.78 * flare))
    P.append(torus('Roll', (x, y, r * 1.8), r * 0.74 * flare, r * 0.12, 'Z', mat, 40, 12))
    if cord is not None:
        P.append(torus('Cord', (x, y, r * 1.2), r * 0.82, 0.0045, 'Z', cord, 40, 8))
    if heap:
        P.append(sph('HeapG', (x, y, r * 1.78), r * 0.72, G(0.28), scale=(1, 1, 0.5), seg=32, rings=14))
        rnd = random.Random(int(r * 1000))
        for i in range(16):
            a_ = rnd.uniform(0, 6.28); rr = math.sqrt(rnd.uniform(0, 1)) * 0.6
            cx = x + math.cos(a_) * rr * r; cy = y + math.sin(a_) * rr * r
            cz = r * 1.78 + r * 0.72 * 0.5 * math.sqrt(max(0.0, 1 - (rr / 0.72) ** 2)) + 0.004
            P += coin((cx, cy, cz), (rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6), rnd.uniform(0, 6.28)), 0.026, k=(i % 3 == 0))
    return P


def coins_make(name):
    P = []
    if name == 'handful':
        P += stack(-0.03, 0.01, 4, seed=1)
        P += leaning(-0.03, 0.045, 0.0068 * 3, 1.0, 0.1)
        P += scatter([(0.05, -0.02), (0.02, -0.07), (-0.08, -0.03), (0.09, 0.05)], seed=5)
        cfg = dict(scale=0.22, aim=(0, 0, 0.02), cam=(0.2, -0.28, 0.22), target=(0, 0, 0.012), lens=60)
    elif name == 'pouch':
        lm = leather('#7a4a28')
        P += open_sack(0.0, 0.03, 0.062, lm, S.principled('Cord', '#e8c875', rough=0.4, metal=0.6), heap=True, flare=1.0)
        P += stack(-0.085, -0.055, 3, seed=2)
        P += scatter([(0.03, -0.095), (0.105, -0.05)], seed=4)
        P += leaning(-0.085, -0.055, 0.0068 * 2, 0.9, 0.5)
        cfg = dict(scale=0.3, aim=(0, 0, 0.07), cam=(0.28, -0.4, 0.26), target=(0, 0, 0.07), lens=65)
    elif name == 'bag':
        bm = burlap()
        P += open_sack(0.0, 0.05, 0.1, bm, S.principled('Cord', '#5a3a22', rough=0.8), heap=True, flare=1.05)
        P.append(text('K', 'K', (0.0, 0.05 - 0.1 * 1.0 - 0.001, 0.1), 0.075, S.principled('Ink', '#4a3412', rough=0.8), extrude=0.003, rot=(math.pi / 2, 0, 0)))
        P += stack(-0.15, -0.09, 6, seed=2)
        P += stack(0.145, -0.1, 4, seed=6)
        P += scatter([(-0.02, -0.14), (0.07, -0.17), (-0.09, -0.2), (0.2, 0.02), (-0.2, 0.03)], seed=8)
        P += leaning(-0.15, -0.09, 0.0068 * 5, 1.0, 0.3)
        cfg = dict(scale=0.4, aim=(0, 0, 0.08), cam=(0.38, -0.55, 0.34), target=(0, 0, 0.09), lens=65)
    elif name == 'chest':
        wood = S.principled('Wood', '#5c3a1e', rough=0.6, coat=0.15)
        S.add_grunge(wood, amount=0.5, dirt='#2e1a0b', scale=14, rough_add=0.1, seed=4)
        band = S.gold('Band', 0.3)
        W, D, H = 0.30, 0.17, 0.10
        P.append(box('Base', (0, 0, H / 2), (W, D, H), wood, bevel=0.006))
        for sx in (-W / 2 + 0.03, W / 2 - 0.03):
            P.append(box('Strap', (sx, 0, H / 2), (0.018, D + 0.004, H + 0.004), band, bevel=0.002))
        P.append(box('RimF', (0, -D / 2 - 0.002, H - 0.01), (W + 0.004, 0.006, 0.018), band, bevel=0.002))
        # the open lid, hinged at the back, tipped back about 105 degrees
        lid = [box('Lid', (0, 0, 0.0), (W, D, 0.03), wood, bevel=0.006)]
        for sx in (-W / 2 + 0.03, W / 2 - 0.03):
            lid.append(box('LStrap', (sx, 0, 0.0), (0.018, D + 0.004, 0.034), band, bevel=0.002))
        lid.append(sph('Lid2', (0, 0, 0.012), 1.0, wood, scale=(W / 2 * 0.98, D / 2 * 0.98, 0.028), seg=32, rings=10))
        hinge = Vector((0, D / 2, H))
        for o in lid:
            o.matrix_basis = Matrix.Translation(hinge) @ Matrix.Rotation(math.radians(-105), 4, 'X') @ Matrix.Translation((0, -D / 2, 0.015)) @ o.matrix_basis
        P += lid
        # gold heaped up inside: a low mound, then a field of coins
        P.append(sph('Heap', (0, 0, H - 0.012), 1.0, G(0.3), scale=(W / 2 - 0.014, D / 2 - 0.014, 0.05), seg=40, rings=16))
        rnd = random.Random(11)
        for i in range(70):
            a_ = rnd.uniform(0, 6.28); rr = math.sqrt(rnd.uniform(0, 1)) * 0.92
            x = math.cos(a_) * rr * (W / 2 - 0.026); y = math.sin(a_) * rr * (D / 2 - 0.026)
            zz = H - 0.012 + 0.05 * math.sqrt(max(0.0, 1 - rr * rr)) + 0.002
            P += coin((x, y, zz), (rnd.uniform(-0.45, 0.45), rnd.uniform(-0.45, 0.45), rnd.uniform(0, 6.28)), 0.028, k=(i % 3 == 0))
        # lock plate
        P.append(box('Lock', (0, -D / 2 - 0.005, H - 0.04), (0.03, 0.01, 0.04), band, bevel=0.003))
        P += scatter([(0.13, -0.15), (0.19, -0.1), (-0.17, -0.14)], r=0.035, seed=9)
        P += stack(-0.2, -0.04, 4, r=0.035, seed=3)
        cfg = dict(scale=0.5, aim=(0, 0, 0.1), cam=(0.5, -0.65, 0.5), target=(0, 0, 0.09), lens=65)
    elif name == 'vault':
        for r_, (x, y) in enumerate([(-0.07, 0.0), (0.0, 0.0), (0.07, 0.0)]):
            P += gold_bar((x * 1.4, y, 0.014), 0.0)
        for (x, y) in [(-0.035 * 1.4, 0.0), (0.035 * 1.4, 0.0)]:
            P += gold_bar((x * 1.4 * 0.7, y, 0.014 + 0.028), 0.0)
        P += gold_bar((0, 0, 0.014 + 0.056), 0.0)
        for (x, y) in [(-0.04, 0.06), (0.04, 0.06), (0.0, 0.065)]:
            P += gold_bar((x * 1.3, y, 0.014), 0.0)
        P += stack(-0.14, -0.08, 8, seed=2)
        P += stack(-0.09, -0.115, 5, seed=3)
        P += stack(0.12, -0.09, 10, seed=4)
        P += stack(0.07, -0.13, 4, seed=5)
        P += scatter([(0.0, -0.1), (0.02, -0.16), (-0.03, -0.14), (0.17, -0.03)], seed=7)
        P += leaning(-0.14, -0.08, 0.0068 * 7, 1.0, 0.6)
        cfg = dict(scale=0.45, aim=(0, 0, 0.05), cam=(0.38, -0.55, 0.32), target=(0, -0.01, 0.045), lens=65)
    else:  # stadium: a coin mound with bars either side and a trophy on top
        P.append(sph('Mound', (0, 0, 0.0), 1.0, G(0.3), scale=(0.17, 0.13, 0.05), seg=48, rings=20))
        rnd = random.Random(21)
        for i in range(70):
            a_ = rnd.uniform(0, 6.28); rr = math.sqrt(rnd.uniform(0.04, 1)) * 0.95
            x = math.cos(a_) * rr * 0.165; y = math.sin(a_) * rr * 0.125
            zz = 0.05 * math.sqrt(max(0.0, 1 - rr * rr)) + 0.002
            if zz < 0.012: continue
            P += coin((x, y, zz), (rnd.uniform(-0.5, 0.5), rnd.uniform(-0.5, 0.5), rnd.uniform(0, 6.28)), 0.028, k=(i % 4 == 0))
        for (x, y, z, rz) in [(-0.21, -0.03, 0.014, 0.3), (-0.19, -0.095, 0.014, -0.2), (-0.215, -0.035, 0.042, 0.3)]:
            P += gold_bar((x, y, z), rz)
        for (x, y, z, rz) in [(0.21, -0.03, 0.014, -0.35), (0.19, -0.095, 0.014, 0.1), (0.215, -0.035, 0.042, -0.35)]:
            P += gold_bar((x, y, z), rz)
        gm = S.gold('Cup', 0.14)
        cz = 0.056
        k = 1.6
        P.append(cyl('TBase', (0, 0, cz + 0.006 * k), 0.034 * k, 0.012 * k, 'Z', mat=gm, bevel=0.002))
        P.append(cyl('TStem', (0, 0, cz + 0.03 * k), 0.007 * k, 0.04 * k, 'Z', mat=gm))
        P.append(cyl('TCup', (0, 0, cz + 0.078 * k), 0.040 * k, 0.062 * k, 'Z', mat=gm, r2=0.022 * k))
        for sg in (-1, 1):
            P.append(torus('TH', (sg * 0.04 * k, 0, cz + 0.082 * k), 0.017 * k, 0.004 * k, 'Y', gm, 24, 8))
        P += stack(-0.11, -0.2, 6, seed=2) + stack(0.11, -0.2, 9, seed=4)
        P += scatter([(0.0, -0.21), (-0.04, -0.26)], seed=2)
        cfg = dict(scale=0.55, aim=(0, 0, 0.1), cam=(0.5, -0.7, 0.4), target=(0, -0.02, 0.1), lens=65)
    return P, cfg


# ---------------------------------------------------------------- boosts: two cans
def can_body(P, body, band, r=0.029, h=0.125):
    """A slim aluminium can: straight body, tapered shoulder, rolled rim, lid and pull tab."""
    chrome = S.chrome('Alu', 0.2)
    hb = h * 0.80
    P.append(cyl('Can', (0, 0, hb / 2 + 0.004), r, hb, 'Z', verts=48, mat=body, bevel=0.0015))
    P.append(cyl('Shoulder', (0, 0, hb + 0.004 + 0.011), r, 0.022, 'Z', verts=48, mat=body, r2=r * 0.8))
    zt = hb + 0.004 + 0.022
    P.append(torus('LidRim', (0, 0, zt), r * 0.8, 0.0024, 'Z', chrome, 48, 8))
    P.append(cyl('Lid', (0, 0, zt - 0.001), r * 0.79, 0.004, 'Z', verts=48, mat=chrome))
    P.append(box('Tab', (0.002, 0, zt + 0.0025), (0.014, 0.008, 0.0016), chrome, bevel=0.0006))
    P.append(cyl('Foot', (0, 0, 0.0035), r * 0.9, 0.007, 'Z', verts=48, mat=chrome, r2=r * 0.98))
    if band is not None:
        P.append(cyl('Band', (0, 0, hb * 0.52 + 0.004), r * 1.004, hb * 0.40, 'Z', verts=48, mat=band))


def bolt_mesh(mat, w=0.030, h=0.056):
    pts = [(0.3, 1.0), (-0.55, 0.0), (-0.05, 0.0), (-0.3, -1.0), (0.55, 0.12), (0.06, 0.12)]
    v = [(x * w, 0.0, y * h / 2) for x, y in pts]
    ob = mesh_from('Bolt', v, [tuple(range(len(v)))], mat)
    so = ob.modifiers.new('sol', 'SOLIDIFY'); so.thickness = 0.003; so.offset = 0
    bv = ob.modifiers.new('bev', 'BEVEL'); bv.width = 0.0008
    return ob


def boost_make(name):
    P = []
    if name == 'training':
        body = S.principled('CanG', '#059669', rough=0.3, metal=0.4, coat=0.8, coat_rough=0.08)
        band = S.principled('BandG', '#065f46', rough=0.3, metal=0.3, coat=0.8, coat_rough=0.08)
        can_body(P, body, band)
        b = bolt_mesh(S.principled('BoltW', '#ecfdf5', rough=0.35, emission='#ecfdf5', emission_strength=0.25))
        b.matrix_basis = Matrix.Translation((0, -0.0295, 0.054)) @ b.matrix_basis
        P.append(b)
        P.append(text('T', 'BOOST', (0, -0.0285, 0.094), 0.0095, S.principled('TxW', '#ecfdf5', rough=0.4), extrude=0.0012, rot=(math.pi / 2, 0, 0)))
    else:
        body = S.principled('CanR', '#e11d48', rough=0.3, metal=0.4, coat=0.8, coat_rough=0.08)
        band = S.principled('BandR', '#fecdd3', rough=0.4, metal=0.0, coat=0.6, coat_rough=0.1)
        can_body(P, body, band)
        P.append(text('P3', '+3', (0, -0.0285, 0.054), 0.031, S.principled('Tx', '#9f1239', rough=0.4), extrude=0.0014, rot=(math.pi / 2, 0, 0)))
        P.append(text('T', 'STAT', (0, -0.0285, 0.093), 0.0095, S.principled('TxW', '#fff1f2', rough=0.4), extrude=0.0012, rot=(math.pi / 2, 0, 0)))
    place(P, (0, 0, 0), RZ(math.radians(32)))
    return P, dict(scale=0.22, aim=(0, 0, 0.055), cam=(0.2, -0.3, 0.17), target=(0, 0, 0.055), lens=70)


# ---------------------------------------------------------------- accessories
def head_form(P, neck=True, z=0.0):
    sk = S.principled('Form', '#6e7482', rough=0.55, coat=0.15)
    P.append(sph('Head', (0, 0, 0.125 + z), 0.085, sk, scale=(0.9, 1.0, 1.15), seg=40, rings=24))
    P.append(sph('Jaw', (0, -0.012, 0.075 + z), 0.058, sk, scale=(0.85, 0.9, 1.0), seg=32, rings=16))
    # a small nose so it reads as a face turned a little
    P.append(sph('Nose', (0, -0.084, 0.115 + z), 0.014, sk, scale=(0.7, 1.0, 1.4), seg=16, rings=8))
    P.append(cyl('Neck', (0, 0.01, 0.015 + z), 0.036, 0.13, 'Z', mat=sk, verts=32))
    P.append(cyl('Stand', (0, 0.01, -0.06 + z), 0.07, 0.014, 'Z', mat=M0('#16171b', 0.35, 0.5), bevel=0.003, verts=40))
    return P


def head_band(col, col2=None, ninja=False):
    P = head_form([])
    cloth = S.principled('Band', col, rough=0.9, sheen=0.4)
    nz = S.node(cloth, 'ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 260
    tc = S.node(cloth, 'ShaderNodeTexCoord'); S.link(cloth, tc.outputs['Object'], nz.inputs['Vector'])
    bp = S.node(cloth, 'ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.6
    S.link(cloth, nz.outputs['Fac'], bp.inputs['Height']); S.link(cloth, bp.outputs['Normal'], cloth.node_tree.nodes['Principled BSDF'].inputs['Normal'])
    hb = torus('HB', (0, 0.004, 0.155), 0.082, 0.014, 'Z', cloth, 56, 16)
    hb.scale = (0.97, 1.08, 1.55)
    P.append(hb)
    if ninja:
        red = S.principled('Red', col2 or '#dc2626', rough=0.5, coat=0.3)
        P.append(cyl('Plate', (0, -0.092, 0.156), 0.026, 0.006, 'Y', mat=M0('#9aa0aa', 0.25, 0.9), bevel=0.001))
        P[-1].rotation_euler = (math.pi / 2, 0, 0)
        P.append(cyl('Dot', (0, -0.096, 0.156), 0.017, 0.004, 'Y', mat=red))
        P[-1].rotation_euler = (math.pi / 2, 0, 0)
        # knot and tails at the back
        P.append(sph('Knot', (0.0, 0.09, 0.155), 0.022, cloth, scale=(1, 0.8, 1)))
        for sg, a in ((-1, 0.5), (1, -0.35)):
            tl = box('Tail', (0, 0, 0), (0.026, 0.004, 0.11), cloth, bevel=0.0015)
            tl.matrix_basis = Matrix.Translation((sg * 0.02, 0.1, 0.115)) @ Matrix.Rotation(sg * 0.22, 4, 'Y') @ Matrix.Rotation(a * 0.4, 4, 'X') @ tl.matrix_basis
            P.append(tl)
    place(P, (0, 0, 0), RZ(math.radians(26)))
    return P, dict(scale=0.3, aim=(0, 0, 0.12), cam=(0.3, -0.42, 0.26), target=(0, 0, 0.13), lens=70)


def snood():
    P = head_form([])
    cloth = S.principled('Snood', '#111827', rough=0.95, sheen=0.2)
    nz = S.node(cloth, 'ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 300
    tc = S.node(cloth, 'ShaderNodeTexCoord'); S.link(cloth, tc.outputs['Object'], nz.inputs['Vector'])
    bp = S.node(cloth, 'ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.7
    S.link(cloth, nz.outputs['Fac'], bp.inputs['Height']); S.link(cloth, bp.outputs['Normal'], cloth.node_tree.nodes['Principled BSDF'].inputs['Normal'])
    for k, (zz, R_, r_) in enumerate(((-0.005, 0.056, 0.021), (0.025, 0.052, 0.02), (0.05, 0.05, 0.02))):
        t = torus(f'Sn{k}', (0, 0.01, zz), R_, r_, 'Z', cloth, 48, 14)
        t.rotation_euler = (0.04 * (k - 1), 0.05 * (1 - k), 0)
        P.append(t)
    place(P, (0, 0, 0), RZ(math.radians(26)))
    return P, dict(scale=0.3, aim=(0, 0, 0.06), cam=(0.3, -0.42, 0.2), target=(0, 0, 0.07), lens=70)


def tube_open(name, z0, z1, r0, r1, mat, thick=0.0035, n=40):
    rings = []
    for k in range(9):
        t = k / 8
        z = z0 + (z1 - z0) * t
        r = r0 + (r1 - r0) * t
        rings.append([(math.cos(2 * math.pi * j / n) * r, math.sin(2 * math.pi * j / n) * r, z) for j in range(n)])
    ob = S.loft(name, rings, cap=False, subsurf=0)
    so = ob.modifiers.new('sol', 'SOLIDIFY'); so.thickness = thick; so.offset = 0
    ob.data.materials.append(mat)
    return ob


def sleeves(col):
    cloth = S.principled('Sleeve', col, rough=0.85, sheen=0.5)
    nz = S.node(cloth, 'ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 400
    tc = S.node(cloth, 'ShaderNodeTexCoord'); S.link(cloth, tc.outputs['Object'], nz.inputs['Vector'])
    bp = S.node(cloth, 'ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.5
    S.link(cloth, nz.outputs['Fac'], bp.inputs['Height']); S.link(cloth, bp.outputs['Normal'], cloth.node_tree.nodes['Principled BSDF'].inputs['Normal'])
    P = []
    for i, (x, y, rz, tilt) in enumerate(((-0.04, 0.0, 0.0, 0.1), (0.055, -0.03, 0.0, -0.14))):
        t = tube_open('Sl', 0.0, 0.2, 0.034, 0.024, cloth)
        # a cuff ring at the wrist end (the small end), at the top here
        cuff = torus('Cuff', (0, 0, 0.2), 0.0245, 0.0045, 'Z', cloth, 36, 10)
        stitch = torus('Seam', (0, 0, 0.003), 0.0345, 0.0025, 'Z', cloth, 36, 8)
        for o in (t, cuff, stitch):
            o.matrix_basis = Matrix.Translation((x, y, 0.0)) @ Matrix.Rotation(tilt, 4, 'Y') @ Matrix.Rotation(rz, 4, 'Z') @ o.matrix_basis
            P.append(o)
    place(P, (0, 0, 0), RZ(math.radians(-25)))
    return P, dict(scale=0.35, aim=(0, 0, 0.1), cam=(0.38, -0.5, 0.42), target=(0, 0, 0.1), lens=70)


def tape():
    P = []
    tp = S.principled('Tape', '#cfcdc3', rough=0.8, sheen=0.1)
    nz = S.node(tp, 'ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 500
    tc = S.node(tp, 'ShaderNodeTexCoord'); S.link(tp, tc.outputs['Object'], nz.inputs['Vector'])
    bp = S.node(tp, 'ShaderNodeBump'); bp.inputs['Strength'].default_value = 0.3
    S.link(tp, nz.outputs['Fac'], bp.inputs['Height']); S.link(tp, bp.outputs['Normal'], tp.node_tree.nodes['Principled BSDF'].inputs['Normal'])
    core = S.principled('Core', '#cfcabd', rough=0.7)
    for (x, y, z, ang) in ((-0.03, 0.0, 0.0, 0.0), (0.075, -0.02, 0.0, 0.0), (0.02, 0.012, 0.0255, 0.0)):
        P.append(torus('Roll', (x, y, z + 0.0125), 0.0285, 0.0128, 'Z', tp, 40, 14))
        P[-1].scale = (1, 1, 0.96)
        P.append(torus('Core', (x, y, z + 0.0125), 0.0158, 0.0058, 'Z', core, 32, 10))
    # a loose strip curling off the top roll
    pts = [(0.02 + 0.028, 0.012, 0.0385), (0.075, 0.03, 0.0345), (0.11, 0.07, 0.03), (0.12, 0.11, 0.027)]
    st = tube('Strip', pts, 0.012, tp, smooth=True, res=6)
    st.scale = (1, 1, 0.12)
    P.append(st)
    place(P, (0, 0, 0), RZ(math.radians(-20)))
    return P, dict(scale=0.25, aim=(0.03, 0, 0.03), cam=(0.25, -0.34, 0.24), target=(0.04, 0.02, 0.02), lens=70)


def glove(col, trim, palm, gold=False):
    """One goalkeeper-style glove lying back-of-hand up, fingers toward +Y."""
    P = []
    fab = S.principled('GloveFab', col, rough=0.5 if gold else 0.75, sheen=0.05, coat=0.2 if gold else 0.0, metal=0.3 if gold else 0.0)
    tr = S.principled('Trim', trim, rough=0.7)
    P.append(box('Palm', (0, 0, 0.015), (0.092, 0.098, 0.03), fab, bevel=0.012, seg=4))
    flen = [0.052, 0.066, 0.062, 0.05]
    xs = [-0.03, -0.01, 0.01, 0.03]
    for i, (x, L) in enumerate(zip(xs, flen)):
        pts = [(x, 0.040, 0.014), (x * 1.04, 0.040 + L * 0.5, 0.0145), (x * 1.08, 0.040 + L, 0.013)]
        P.append(ring_loft('Fi', pts, [(0.0125, 0.0125), (0.0118, 0.0118), (0.0105, 0.0105)], fab, n=14, subsurf=1, up=(0, 0, 1)))
        # finger-top ridge in the trim colour
        P.append(box('Knu', (x, 0.04 + L * 0.5, 0.0255), (0.0072, L * 0.78, 0.0025), tr, bevel=0.0008))
    th = [(0.044, -0.01, 0.014), (0.06, 0.012, 0.0145), (0.07, 0.034, 0.0135)]
    P.append(ring_loft('Th', th, [(0.0118, 0.0118), (0.0108, 0.0108), (0.0094, 0.0094)], fab, n=14, subsurf=1, up=(0, 0, 1)))
    # back-of-hand panel + wrist cuff and strap
    P.append(box('Back', (0, 0.012, 0.0315), (0.07, 0.07, 0.004), tr, bevel=0.0015))
    P.append(box('BackS', (0, 0.012, 0.0345), (0.052, 0.05, 0.003), fab if gold else tr, bevel=0.0015))
    P.append(box('Cuff', (0, -0.062, 0.0165), (0.084, 0.045, 0.032), fab, bevel=0.012, seg=4))
    P.append(box('Strap', (0, -0.062, 0.034), (0.086, 0.03, 0.004), tr, bevel=0.0012))
    P.append(box('StrapH', (0.0, -0.062, 0.0365), (0.036, 0.018, 0.002), S.principled('Velcro', '#e5e7eb', rough=0.9), bevel=0.0008))
    return P


def gloves(col, trim, palm, gold=False):
    A = glove(col, trim, palm, gold); B = glove(col, trim, palm, gold)
    place(A, (-0.07, 0.0, 0.0), RZ(math.radians(12)))
    # the second glove is mirrored and a bit forward
    for o in B:
        o.scale = (-1, 1, 1)
    place(B, (0.075, -0.045, 0.0), RZ(math.radians(-14)))
    P = A + B
    place(P, (0, 0, 0), RZ(math.radians(-18)))
    return P, dict(scale=0.3, aim=(0, 0, 0.02), cam=(0.2, -0.46, 0.36), target=(0, 0, 0.01), lens=70)


def armband(kind):
    P = []
    sk = S.principled('Form', '#6e7482', rough=0.55, coat=0.15)
    # a mannequin upper arm, leaning
    arm = [cyl('Arm', (0, 0, 0.0), 0.038, 0.2, 'Z', mat=sk, verts=40), sph('ArmTop', (0, 0, 0.1), 0.038, sk), sph('ArmBot', (0, 0, -0.1), 0.038, sk)]
    P += arm
    if kind == 'classic':
        bm = S.principled('Band', '#facc15', rough=0.55, coat=0.2, sheen=0.3)
        P.append(cyl('Band', (0, 0, 0.0), 0.0415, 0.055, 'Z', mat=bm, verts=48, bevel=0.002))
        P.append(cyl('BandB', (0, 0, 0.0), 0.0418, 0.008, 'Z', mat=S.principled('Edge', '#111827', rough=0.5), verts=48))
        P[-1].location = (0, 0, 0.0305)
        P.append(cyl('BandB2', (0, 0, -0.0305), 0.0418, 0.008, 'Z', mat=S.principled('Edge2', '#111827', rough=0.5), verts=48))
        P.append(text('C', 'C', (0, -0.0425, 0.0), 0.04, S.principled('Cm', '#111827', rough=0.5), extrude=0.002, rot=(math.pi / 2, 0, 0)))
    else:
        cols = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#8b5cf6']
        for i, c in enumerate(cols):
            P.append(cyl(f'RB{i}', (0, 0, -0.0275 + i * 0.011), 0.0415, 0.0112, 'Z', mat=S.principled(f'Rb{i}', c, rough=0.5, coat=0.2), verts=48))
        P.append(text('C', 'C', (0, -0.0425, 0.0), 0.036, S.principled('Cw', '#111827', rough=0.4), extrude=0.002, rot=(math.pi / 2, 0, 0)))
    # lean the arm over so the band is seen at an angle
    place(P, (0, 0, 0.1), RZ(math.radians(30)) @ RX(math.radians(-10)))
    return P, dict(scale=0.3, aim=(0, 0, 0.1), cam=(0.3, -0.42, 0.3), target=(0, 0, 0.1), lens=70)


def make(name):
    kind, _, rest = name.partition('-')
    if kind == 'coins':
        P, cfg = coins_make(rest)
    elif kind == 'boost':
        P, cfg = boost_make(rest)
    else:
        a = rest
        if a == 'headband-white': P, cfg = head_band('#f8fafc')
        elif a == 'headband-ninja': P, cfg = head_band('#0b0f19', '#dc2626', ninja=True)
        elif a == 'snood-black': P, cfg = snood()
        elif a == 'sleeves-black': P, cfg = sleeves('#161a24')
        elif a == 'sleeves-white': P, cfg = sleeves('#c3c9d4')
        elif a == 'tape-white': P, cfg = tape()
        elif a == 'gloves-black': P, cfg = gloves('#14171f', '#3b4252', '#0f172a')
        elif a == 'gloves-gold': P, cfg = gloves('#f5b324', '#5a3410', '#78350f', gold=True)
        elif a == 'armband-classic': P, cfg = armband('classic')
        elif a == 'armband-rainbow': P, cfg = armband('rainbow')
        else: raise SystemExit('unknown ' + name)
    P = convert_curves(P)
    cfg = dict(dict(lens=55, fill=0.82, fill_y=0.76, floor=0.0, offset=(0, -0.01), floor_size=20), **cfg)
    return P, cfg


def boot_acc(name, out, samples, res):
    """The three accessory boots: the shop's own boot model in the Store's colours (boot.py's build)."""
    import boot as B
    base, lv = {'acc-boots-blackout': ('blackout', 3), 'acc-boots-volt': ('volt', 3), 'acc-boots-gold': ('chrome', 5)}[name]
    S.reset(); S.setup_render(res, samples); S.world(0.3)
    bpy.context.scene.view_settings.exposure = -0.8
    root, parts, tip = B.build(base, lv, '/dev/shm/blender-shop/tex')
    bpy.context.view_layer.update()
    S.studio_lights(scale=0.45, aim=(0, 0, 0.05))
    S.shadow_catcher(0.0)
    cam = S.camera((0.04, -0.58, 0.36), (0.0, 0.0, 0.045), lens=85)
    S.frame_objects(cam, [p for p in parts if p.type in ('MESH', 'CURVE')], fill=0.84, offset=(0, -0.01))
    S.render(out)


def main():
    a = S.args()
    name, out = a[0], a[1]
    samples = int(a[2]) if len(a) > 2 else 32
    res = (int(a[3]), int(a[4])) if len(a) > 4 else (600, 450)
    if name.startswith('acc-boots-'):
        return boot_acc(name, out, samples, res)
    S.reset(); S.setup_render(res, samples); S.world(0.35)
    P, c = make(name)
    if name.startswith(('acc-headband', 'acc-snood', 'acc-armband')) is False:
        pass
    bpy.context.view_layer.update()
    S.studio_lights(scale=c['scale'], aim=c['aim'], key=c.get('key', 1.0))
    S.shadow_catcher(c.get('floor', 0.0), size=c.get('floor_size', 20))
    cam = S.camera(c['cam'], c['target'], lens=c.get('lens', 50))
    S.frame_objects(cam, [p for p in P if p.type == 'MESH'], fill=c.get('fill', 0.8), offset=c.get('offset', (0, 0)), fill_y=c.get('fill_y'))
    S.render(out)


if __name__ == '__main__':
    main()
