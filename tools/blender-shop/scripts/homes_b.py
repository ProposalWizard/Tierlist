"""Grand houses (house-2) and country estates (estate)."""
from homes_common import *
from homes_a import tower, tree_, pool_block

STONE = ('#b8ad98', '#a89c86', '#8f8574', 5)
BRICKG = ('#a24d36', '#93432e', '#d9d0c0', 6)
CREAM = ('#e8dcc0', '#ddcfae', '#c9bb98', 6)


def wall(brick=None, base='#d9ccb0', cw=3.0, **k):
    d = dict(base=base, cw=cw, lit=0.15, wa=(0.22, 0.78), wz=(0.2, 0.84), win='#1a2a3a')
    if brick: d['brick'] = brick
    d.update(k)
    return d


def block(M, x, y, w, d, floors, fh, wallk, roof='gable', ridge='X', roofh=None, rmat='slate', hi=None, name='B', over=0.3):
    return tower(M, x, y, w, d, floors, fh, wallk, roof='none', hi=hi, name=name) + (
        [H.gable_roof(name + 'R', x - w / 2, x + w / 2, y - d / 2, y + d / 2, floors * fh, roofh or min(w, d) * 0.32, M[rmat], over=over, ridge_axis=ridge)] if roof == 'gable' else [])


def chimney(M, x, y, z, h=2.2, w=0.9):
    return [box('Chim', (x, y, z + h / 2), (w, w, h), M['brick'], bevel=0.02), box('ChimC', (x, y, z + h + 0.1), (w + 0.2, w + 0.2, 0.2), M['stone'])]


def columns(M, x, y, n, span, z0, h, r=0.32, mat='white'):
    P = []
    for k in range(n):
        cx = x - span / 2 + span * k / (n - 1)
        P.append(cyl('Col', (cx, y, z0 + h / 2), r, h, 'Z', mat=M[mat], bevel=0.03))
        P.append(box('Cap', (cx, y, z0 + h + 0.1), (r * 2.6, r * 2.6, 0.2), M[mat]))
        P.append(box('Base', (cx, y, z0 + 0.1), (r * 2.6, r * 2.6, 0.2), M[mat]))
    return P


def pediment(M, x, y, w, d, z, h, mat='white'):
    v = [(x - w / 2, y - d / 2, z), (x + w / 2, y - d / 2, z), (x, y - d / 2, z + h), (x - w / 2, y + d / 2, z), (x + w / 2, y + d / 2, z), (x, y + d / 2, z + h)]
    f = [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (0, 2, 5, 3), (1, 4, 5, 2)]
    return [H.mesh_from('Ped', v, f, M[mat])]


def crenel(M, x0, y0, x1, y1, z, mat='stone2', n=None, s=0.5):
    P = []
    L = math.hypot(x1 - x0, y1 - y0)
    n = n or int(L / 1.0)
    for k in range(n):
        t = (k + 0.5) / n
        P.append(box('Cren', (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z + s / 2), (0.55 if abs(x1 - x0) > abs(y1 - y0) else 0.45, 0.45 if abs(x1 - x0) > abs(y1 - y0) else 0.55, s), M[mat]))
    return P


def round_tower(M, x, y, r, h, M2='stone2', cone=True, roofmat='slate', rh=None, flag=False, windows=True):
    P = [cyl('Tw', (x, y, h / 2), r, h, 'Z', mat=M[M2], bevel=0.03, verts=40)]
    P.append(cyl('Ring', (x, y, h), r * 1.08, 0.3, 'Z', mat=M[M2]))
    if cone:
        P.append(cyl('Cone', (x, y, h + (rh or r * 1.8) / 2 + 0.15), r * 1.18, rh or r * 1.8, 'Z', mat=M[roofmat], r2=0.02, verts=40))
    if windows:
        for k in range(3):
            a = -math.pi / 2 + (k - 1) * 0.5
            P.append(box('Slit', (x + math.cos(a) * r, y + math.sin(a) * r, h * 0.62), (0.18, 0.18, 1.1), M['dark'], rot=(0, 0, a)))
    if flag:
        top = h + (rh or r * 1.8) + 0.15
        P.append(cyl('Pole', (x, y, top + 0.8), 0.04, 1.6, 'Z', mat=M['metal']))
        P.append(box('Flag', (x + 0.45, y, top + 1.3), (0.8, 0.02, 0.5), M['red']))
    return P


def formal_garden(M, x, y, w, d, rows=3, cols=4):
    P = []
    for i in range(cols):
        for j in range(rows):
            cx = x - w / 2 + (i + 0.5) * w / cols
            cy = y - d / 2 + (j + 0.5) * d / rows
            P.append(box('Bed', (cx, cy, 0.25), (w / cols * 0.7, d / rows * 0.7, 0.5), M['hedge'], bevel=0.12))
            P.append(sph('Topiary', (cx, cy, 0.8), 0.4, M['leaf']))
    return P


def fountain(M, x, y, r=1.6, z=0.0):
    return [cyl('FBase', (x, y, z + 0.2), r, 0.4, 'Z', mat=M['stone'], bevel=0.04), cyl('FWater', (x, y, z + 0.42), r * 0.85, 0.06, 'Z', mat=M['water']),
            cyl('FCol', (x, y, z + 0.9), 0.18, 1.0, 'Z', mat=M['stone']), cyl('FTop', (x, y, z + 1.5), 0.6, 0.1, 'Z', mat=M['stone'], r2=0.3)]


def gate(M, x, y, w, h=2.4, pillar='stone2'):
    P = []
    for px in (x - w / 2, x + w / 2):
        P.append(box('Pier', (px, y, h / 2 + 0.1), (0.8, 0.8, h + 0.2), M[pillar], bevel=0.03))
        P.append(box('PCap', (px, y, h + 0.3), (1.0, 1.0, 0.2), M[pillar]))
        P.append(sph('Lamp', (px, y, h + 0.65), 0.22, M['lamp'] if 'lamp' in M else M['gold']))
    n = int(w / 0.34)
    for k in range(n):
        xx = x - w / 2 + 0.6 + k * (w - 1.2) / (n - 1)
        P.append(box('Bar', (xx, y, 1.2), (0.06, 0.06, 2.0), M['metal']))
    for zz in (0.35, 2.0):
        P.append(box('Rail', (x, y, zz), (w - 1.0, 0.08, 0.1), M['metal']))
    return P


def h2(M, lv):
    P = []
    M['lamp'] = S.principled('Lamp', '#fff1c9', rough=0.1, emission='#ffe3a0', emission_strength=3.0)
    M['brick'] = H.brick_mat('Br', '#9b5a3f', '#8a4c34', '#d7cfc2', scale=6)
    if lv == 1:
        P += ground(M, 24, 17)
        P += block(M, 0, 1.0, 13, 6.4, 2, 3.4, wall(STONE, '#b8ad98', cw=2.6, wz=(0.2, 0.8)), roof='gable', ridge='X', roofh=3.6, hi=None, name='Main')
        P += block(M, -4.2, -3.2, 6.2, 6.6, 2, 3.4, wall(STONE, '#b8ad98', cw=3.1), roof='gable', ridge='Y', roofh=3.6, name='Wing', over=0.25)
        # half-timbered upper gable on the wing
        P.append(box('Tim', (-4.2, -6.55, 5.2), (5.6, 0.08, 0.14), M['timber']))
        P += H.door(0.5, -2.25, M, w=1.3, h=2.4)
        P += chimney(M, 3.2, 1.0, 9.8, 3.0, 1.0) + chimney(M, -1.5, 1.0, 10.2, 3.0, 1.0) + chimney(M, 5.4, 1.0, 8.6, 2.6, 0.9)
        P += tree_(M, 8.8, -4.0, 1.1, 2) + tree_(M, -9.0, 4.5, 1.0, 5)
        P += H.hedge((3.0, -6.8, 0.45), (7.0, 0.7, 0.9), M)
        P.append(box('Path', (0.5, -5.2, 0.03), (1.4, 5.0, 0.06), M['path']))
    elif lv in (2, 3):
        gated = lv == 3
        wd = 30 if gated else 26
        P += ground(M, wd, 22 if gated else 17)
        wm = wall(BRICKG, '#a24d36', cw=2.9) if lv == 2 else wall(CREAM, '#e8dcc0', cw=2.9)
        P += block(M, 0, 1.5, 12, 7.2, 3, 3.1, wm, roof='gable', ridge='X', roofh=3.0, hi=None, name='Main', rmat='slate')
        for sx in (-1, 1):
            P += block(M, sx * 9.4, 0.8, 6.4, 6.4, 2, 3.1, wm, roof='gable', ridge='X', roofh=2.4, name='Wing', rmat='slate')
        # portico: four white columns and a pediment
        P.append(box('PorchFl', (0, -2.9, 0.2), (6.0, 2.6, 0.4), M['stone'], bevel=0.03))
        P += columns(M, 0, -3.8, 4, 5.0, 0.4, 5.6)
        P.append(box('Arch', (0, -3.5, 6.1), (6.0, 2.4, 0.4), M['white'], bevel=0.02))
        P += pediment(M, 0, -3.5, 6.0, 2.4, 6.3, 1.5)
        P += H.door(0, -2.1, M, w=1.5, h=2.6)
        P += chimney(M, -4.5, 1.5, 9.3, 2.6) + chimney(M, 4.5, 1.5, 9.3, 2.6)
        P.append(box('Drive', (0, -6.8, 0.04), (3.0, 7.0, 0.08), M['path']))
        P += H.hedge((-5.0, -8.2, 0.45), (8.5, 0.7, 0.9), M) + H.hedge((5.0, -8.2, 0.45), (8.5, 0.7, 0.9), M)
        P += tree_(M, -12, 4, 1.1, 3) + tree_(M, 12, 4, 1.0, 4)
        if gated:
            W2, D2 = 26.0, 19.0
            P += gate(M, 0, -D2 / 2 + 0.2, 6.0)
            P.append(box('WallL', (-8.2, -D2 / 2 + 0.2, 0.9), (10.0, 0.5, 1.8), M['stone2'], bevel=0.03))
            P.append(box('WallR', (8.2, -D2 / 2 + 0.2, 0.9), (10.0, 0.5, 1.8), M['stone2'], bevel=0.03))
            P.append(box('WallW', (-13.2, 0, 0.9), (0.5, D2, 1.8), M['stone2'], bevel=0.03))
            P.append(box('WallE', (13.2, 0, 0.9), (0.5, D2, 1.8), M['stone2'], bevel=0.03))
            P.append(box('WallB', (0, D2 / 2 - 0.2, 0.9), (26.4, 0.5, 1.8), M['stone2'], bevel=0.03))
            P.append(box('Drive2', (0, -7.8, 0.04), (3.0, 3.0, 0.08), M['path']))
            P += small_car(M, 4.5, -7.2, 0, '#0d1018')
    elif lv == 4:
        P += ground(M, 34, 24)
        wm = wall(None, '#f2efe8', cw=3.0, win='#1a2a3a', lit=0.3)
        P += tower(M, 0, 3.0, 18, 8, 3, 3.4, wm, roof='flat', name='Main', trim=M['white'])
        for sx in (-1, 1):
            P += tower(M, sx * 12.5, -1.0, 7.0, 14.0, 2, 3.4, wm, roof='flat', name='Wing', trim=M['white'])
            P.append(box('Terrace', (sx * 12.5, -6.2, 6.9), (7.0, 3.0, 0.2), M['conc']))
        P.append(box('RoofGold', (0, 3.0, 10.6), (18.4, 8.4, 0.16), M['gold'], bevel=0.02))
        P += columns(M, 0, -1.6, 6, 11.0, 0.0, 6.8, r=0.35)
        P.append(box('Portico', (0, -1.6, 7.0), (12.0, 2.2, 0.3), M['white'], bevel=0.02))
        P += fountain(M, 0, -8.5, r=2.4)
        P.append(cyl('Court', (0, -8.5, 0.03), 4.8, 0.06, 'Z', mat=M['path']))
        P.append(box('Drive', (0, -13.6, 0.03), (3.2, 6.0, 0.06), M['path']))
        P += pool_block(M, 0, 9.0, 0.0, 10.0, 3.2) if False else []
        P += small_car(M, 5.0, -9.5, 0.6, '#f5c518')
        for xx in (-14, -9, 9, 14):
            P += H.palm(xx, -12.0, 1.0, M, seed=xx)
        P += H.hedge((-8.0, -11.0, 0.45), (5.0, 0.7, 0.9), M) + H.hedge((8.0, -11.0, 0.45), (5.0, 0.7, 0.9), M)
    else:
        P += ground(M, 44, 26)
        gm = wall(CREAM, '#efe6cf', cw=3.2, lit=0.18)
        P += tower(M, 0, 2.0, 24, 9, 3, 3.6, gm, roof='flat', name='Main', trim=M['gold'])
        for sx in (-1, 1):
            P += tower(M, sx * 15.0, 0.0, 8, 10, 4, 3.6, gm, roof='flat', name='Pav', trim=M['gold'])
            P.append(cyl('PavDomeD', (sx * 15.0, 0, 14.8), 3.3, 1.0, 'Z', mat=M['white']))
            P.append(sph('PavDome', (sx * 15.0, 0, 15.3), 3.3, M['copper'], scale=(1, 1, 0.85)))
            P.append(cyl('Fin', (sx * 15.0, 0, 18.7), 0.1, 1.2, 'Z', mat=M['gold']))
        P.append(cyl('Drum', (0, 2.0, 12.4), 4.6, 3.2, 'Z', mat=M['white'], bevel=0.03, verts=48))
        for k in range(12):
            a = 2 * math.pi * k / 12
            P.append(box('DrW', (math.cos(a) * 4.62, 2.0 + math.sin(a) * 4.62, 12.4), (0.7, 0.7, 1.5), M['glass'], rot=(0, 0, a)))
        P.append(sph('Dome', (0, 2.0, 14.0), 4.8, M['gold'], scale=(1, 1, 0.9), seg=48, rings=24))
        P.append(cyl('Lantern', (0, 2.0, 18.7), 0.7, 1.4, 'Z', mat=M['white']))
        P.append(cyl('Fin', (0, 2.0, 20.3), 0.1, 1.8, 'Z', mat=M['gold']))
        P += columns(M, 0, -2.6, 8, 13.0, 0.0, 9.6, r=0.42)
        P.append(box('Arch', (0, -2.6, 10.0), (14.0, 2.4, 0.5), M['white'], bevel=0.02))
        P += pediment(M, 0, -2.6, 14.0, 2.4, 10.2, 2.0)
        P.append(box('Steps', (0, -4.2, 0.2), (14, 2.4, 0.4), M['stone'], bevel=0.03))
        P += fountain(M, 0, -8.5, r=2.2)
        for sx in (-1, 1):
            P += formal_garden(M, sx * 9.5, -9.2, 11, 7, rows=2, cols=3)
        P.append(box('Drive', (0, -13.0, 0.03), (3.4, 5.0, 0.06), M['path']))
        P += gate(M, 0, -12.2, 7.0)
        P.append(box('WallL', (-12.5, -12.2, 0.9), (17, 0.5, 1.8), M['stone2'], bevel=0.03))
        P.append(box('WallR', (12.5, -12.2, 0.9), (17, 0.5, 1.8), M['stone2'], bevel=0.03))
    cfg = city_cfg({1: 24, 2: 28, 3: 31, 4: 33, 5: 40}[lv])
    cfg['cam'] = (0.8 * cfg['scale'], -1.25 * cfg['scale'], 0.7 * cfg['scale'])
    cfg['floor'] = -0.7
    return P, cfg


def est(M, lv):
    P = []
    M['lamp'] = S.principled('Lamp', '#fff1c9', rough=0.1, emission='#ffe3a0', emission_strength=3.0)
    M['brick'] = H.brick_mat('Br', '#9b5a3f', '#8a4c34', '#d7cfc2', scale=6)
    barn_red = H.brick_mat('BarnR', '#a3262a', '#932024', '#7a1a1e', scale=2.5, rows=0.12)
    if lv == 1:
        P += ground(M, 26, 20)
        for k in range(5):
            P.append(box('Field', (-6 + k * 2.6, 5.6, 0.02), (2.2, 7.0, 0.16), M['grass'] if k % 2 == 0 else M['hay'], bevel=0.03))
        P += block(M, -5, -1.0, 8.5, 5.5, 2, 3.0, wall(None, '#f1ece0', cw=2.8), roof='gable', ridge='X', roofh=2.6, rmat='tile', name='Farm')
        P += H.door(-4.6, -3.8, M, w=1.0)
        P += chimney(M, -2.0, -1.0, 7.9, 2.0)
        # barn
        P.append(box('Barn', (6.2, -0.5, 2.4), (6.5, 7.0, 4.8), barn_red))
        P.append(H.gable_roof('BarnRoof', 6.2 - 3.25, 6.2 + 3.25, -0.5 - 3.5, -0.5 + 3.5, 4.8, 2.6, M['dark'], over=0.3, ridge_axis='Y'))
        P.append(box('BarnDoor', (6.2, -4.05, 1.8), (2.6, 0.1, 3.6), M['white'], bevel=0.02))
        for s in (-1, 1):
            P.append(tube('X', [(6.2 - 1.3, -4.1, 0.3 if s > 0 else 3.5), (6.2 + 1.3, -4.1, 3.5 if s > 0 else 0.3)], 0.07, M['white'], smooth=False))
        P += [cyl('Silo', (11.0, 1.5, 4.0), 1.2, 8.0, 'Z', mat=M['metal'], bevel=0.04), sph('SiloTop', (11.0, 1.5, 8.0), 1.2, M['metal'], scale=(1, 1, 0.7))]
        for k in range(3):
            P.append(cyl('Hay', (2.5 + k * 1.6, -6.0, 0.7), 0.7, 1.2, 'Y', mat=M['hay']))
        P += fence_loop(M, -11, 11, -8.2, 8.8, h=1.0)
        P += tree_(M, -10, 4, 1.0, 3) + tree_(M, 9.5, -6.5, 0.8, 4)
    elif lv == 2:
        P += ground(M, 28, 20)
        wm = wall(STONE, '#b8ad98', cw=2.9)
        P += block(M, 0, 0.5, 11, 7.0, 2, 3.4, wm, roof='gable', ridge='X', roofh=3.2, name='Main')
        P += block(M, -7.4, 0.5, 5.4, 6.0, 2, 3.0, wm, roof='gable', ridge='X', roofh=2.0, name='Wing', rmat='tile')
        P += H.door(0, -3.05, M, w=1.3, h=2.4)
        P.append(box('Porch', (0, -3.7, 3.1), (2.8, 1.6, 0.14), M['white']))
        P += columns(M, 0, -4.2, 2, 2.2, 0.0, 3.0, r=0.14)
        P += chimney(M, 3.5, 0.5, 9.3, 2.4) + chimney(M, -3.5, 0.5, 9.3, 2.4) + chimney(M, -9.0, 0.5, 6.4, 2.0)
        P += H.hedge((-3.0, -6.0, 0.45), (7.5, 0.7, 0.9), M) + H.hedge((6.8, -6.0, 0.45), (5.0, 0.7, 0.9), M)
        P.append(box('Path', (0, -5.2, 0.03), (1.6, 4.6, 0.06), M['path']))
        P += [cyl('Pond', (8.5, -2.0, 0.04), 2.4, 0.06, 'Z', mat=M['water'])]
        P += tree_(M, 10.5, 5.5, 1.3, 2) + tree_(M, -11, -4.5, 1.1, 5) + tree_(M, 12, -6, 0.9, 6)
    elif lv == 3:
        P += ground(M, 36, 24)
        wm = wall(BRICKG, '#a24d36', cw=2.9)
        P += block(M, -2, 3.5, 11, 7.0, 2, 3.4, wm, roof='gable', ridge='X', roofh=3.2, name='Main')
        P += block(M, 5.8, 3.5, 5.4, 6.0, 2, 3.0, wm, roof='gable', ridge='X', roofh=2.0, name='Wing')
        P += H.door(-2.0, 0.05, M, w=1.3, h=2.4)
        P += chimney(M, 1.5, 3.5, 9.3, 2.4) + chimney(M, -5.5, 3.5, 9.3, 2.4)
        # stable block with a clock turret
        P += block(M, -12.0, -1.5, 5.0, 12.0, 1, 3.2, wall(None, '#e8dcc0', cw=3.0, wa=(0.3, 0.7), lit=0.0), roof='gable', ridge='Y', roofh=2.0, name='Stab', rmat='tile')
        P.append(box('Turret', (-12.0, -1.5, 6.4), (1.4, 1.4, 1.4), M['white'], bevel=0.03))
        P.append(cyl('TurRoof', (-12.0, -1.5, 7.6), 1.0, 1.0, 'Z', mat=M['copper'], r2=0.05))
        # long drive lined with trees, and gate pillars
        P.append(box('Drive', (3, -7.0, 0.03), (3.0, 14.0, 0.06), M['path']))
        for k in range(4):
            P += tree_(M, 0.4, -3.5 - k * 3.3, 0.7, k) + tree_(M, 5.6, -3.5 - k * 3.3, 0.7, k + 9)
        P += gate(M, 3, -12.3, 5.0)
        P += fence_run(M, (-15, -12.3), (0.0, -12.3), h=1.2, mat='stone2') if False else []
        P.append(box('WallL', (-8.0, -12.3, 0.9), (13, 0.5, 1.8), M['stone2'], bevel=0.03))
        P.append(box('WallR', (14.0, -12.3, 0.9), (10, 0.5, 1.8), M['stone2'], bevel=0.03))
        P += horse(M, -8, 5.5, 0, 0.6, 'horse_b', s=0.9)
    elif lv == 4:
        P += ground(M, 40, 28)
        wm = wall(CREAM, '#e8dcc0', cw=3.0)
        P += block(M, 0, 5.5, 14, 7.5, 3, 3.2, wm, roof='gable', ridge='X', roofh=3.2, name='Main')
        for sx in (-1, 1):
            P += block(M, sx * 10.0, 1.2, 6.5, 12.0, 2, 3.2, wm, roof='gable', ridge='Y', roofh=3.0, name='Wing')
        P += columns(M, 0, 1.2, 4, 5.2, 0.0, 6.2, r=0.34)
        P.append(box('Arch', (0, 1.2, 6.5), (6.0, 2.2, 0.4), M['white'], bevel=0.02))
        P += pediment(M, 0, 1.2, 6.0, 2.2, 6.7, 1.5)
        P += H.door(0, 1.9, M, w=1.4, h=2.6)
        P += chimney(M, 4.5, 5.5, 9.6, 2.4) + chimney(M, -4.5, 5.5, 9.6, 2.4) + chimney(M, -10, 1.2, 9.0, 2.2) + chimney(M, 10, 1.2, 9.0, 2.2)
        P += fountain(M, 0, -4.5, r=2.0)
        P.append(cyl('Court', (0, -4.5, 0.03), 4.2, 0.06, 'Z', mat=M['path']))
        for sx in (-1, 1):
            P += formal_garden(M, sx * 11.0, -8.8, 10, 6.5, rows=2, cols=3)
        P += [cyl('Pond', (0, -10.5, 0.04), 2.0, 0.06, 'Z', mat=M['water'])] if False else []
        P.append(box('Drive', (0, -11, 0.03), (3.2, 8, 0.06), M['path']))
        for k in range(3):
            P += tree_(M, -17, 2 - k * 5, 0.9, k) + tree_(M, 17, 2 - k * 5, 0.9, k + 4)
    else:
        # castle with a moat and a drawbridge
        P += ground(M, 38, 30)
        W2, D2 = 26.0, 20.0
        # moat ring
        for sx in (-1, 1):
            P.append(box('MoatS', (sx * (W2 / 2 + 1.0), 0, 0.01), (2.4, D2 + 4.8, 0.14), M['water']))
        for sy in (-1, 1):
            P.append(box('MoatN', (0, sy * (D2 / 2 + 1.0), 0.01), (W2 + 4.8, 2.4, 0.14), M['water']))
        # curtain walls
        for sy in (-1, 1):
            P.append(box('Curt', (0, sy * D2 / 2, 3.0), (W2, 1.0, 6.0), M['stone2'], bevel=0.03))
            P += crenel(M, -W2 / 2, sy * D2 / 2, W2 / 2, sy * D2 / 2, 6.0, n=24)
        for sx in (-1, 1):
            P.append(box('Curt', (sx * W2 / 2, 0, 3.0), (1.0, D2, 6.0), M['stone2'], bevel=0.03))
            P += crenel(M, sx * W2 / 2, -D2 / 2, sx * W2 / 2, D2 / 2, 6.0, n=19)
        for sx in (-1, 1):
            for sy in (-1, 1):
                P += round_tower(M, sx * W2 / 2, sy * D2 / 2, 2.4, 9.0, roofmat='slate', rh=4.0, flag=(sx == 1 and sy == 1))
        # keep
        P.append(box('Keep', (0, 3.0, 6.5), (9.0, 8.0, 13.0), M['stone2'], bevel=0.04))
        P += crenel(M, -4.5, 3.0 - 4, 4.5, 3.0 - 4, 13.0, n=9) + crenel(M, -4.5, 3.0 + 4, 4.5, 3.0 + 4, 13.0, n=9)
        P += crenel(M, -4.5, -1.0, -4.5, 7.0, 13.0, n=8) + crenel(M, 4.5, -1.0, 4.5, 7.0, 13.0, n=8)
        P += round_tower(M, 0, 3.0, 2.2, 15.0, roofmat='copper', rh=5.0, flag=True)
        for k in range(3):
            P.append(box('KW', (-3 + k * 3, -1.02, 8.0), (1.0, 0.1, 1.8), M['glass']))
        # gatehouse + drawbridge
        P.append(box('Gate', (0, -D2 / 2, 4.0), (5.2, 3.0, 8.0), M['stone2'], bevel=0.04))
        P.append(box('Arch', (0, -D2 / 2 - 1.52, 2.0), (2.6, 0.2, 4.0), M['dark'], bevel=0.04))
        P += crenel(M, -2.6, -D2 / 2 - 1.5, 2.6, -D2 / 2 - 1.5, 8.0, n=5)
        P.append(box('Bridge', (0, -D2 / 2 - 3.2, 0.2), (3.0, 3.6, 0.3), M['woodfence'], bevel=0.02))
        P += small_car(M, 0, 0, 0, '#ffffff') if False else []
        for k in range(3):
            P += tree_(M, -13 + k * 1.0, -12.5, 0.9, k) + tree_(M, 13 - k * 1.0, -12.5, 0.9, k + 3)
        P += tree_(M, -15.5, 8, 1.0, 5) + tree_(M, 15.5, 8, 1.0, 6)
        P += horse(M, 8, -9.5, 0, 2.2, 'horse_w', s=0.8) if False else []
    cfg = city_cfg({1: 26, 2: 28, 3: 34, 4: 38, 5: 38}[lv])
    cfg['cam'] = (0.8 * cfg['scale'], -1.25 * cfg['scale'], 0.8 * cfg['scale'])
    return P, cfg


FN = {'house-2': h2, 'estate': est}


def make(fam, lv):
    M = mat_walls(lv)
    return FN[fam](M, lv)
