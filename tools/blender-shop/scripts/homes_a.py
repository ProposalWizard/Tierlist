"""Flats and penthouses (flat-1, flat-2, penthouse) as little city-block dioramas."""
from homes_common import *


def tower(M, x, y, w, d, floors, fh, wall, roof='flat', bal=None, hi=None, base_z=0.0, name='T', trim=None, tank=False):
    """A block with a procedural window wall. wall: dict for window_wall."""
    Ht = floors * fh
    wm = window_wall(name, hi=hi, zoff=Ht / 2, uoff=w / 2, fh=fh, **wall)
    parts = [box(name, (x, y, base_z + Ht / 2), (w, d, Ht), wm, bevel=0.03)]
    tm = trim or M['conc']
    if roof == 'flat':
        parts.append(box(name + 'Cap', (x, y, base_z + Ht + 0.15), (w + 0.3, d + 0.3, 0.3), tm, bevel=0.03))
        if tank:
            parts.append(cyl(name + 'Tank', (x - w * 0.25, y + d * 0.1, base_z + Ht + 0.3 + 0.9), 0.8, 1.6, 'Z', mat=M['metal'], bevel=0.04))
            parts.append(box(name + 'AC', (x + w * 0.25, y, base_z + Ht + 0.3 + 0.4), (1.6, 1.2, 0.8), M['conc'], bevel=0.04))
    elif roof == 'gable':
        parts.append(H.gable_roof(name + 'Roof', x - w / 2, x + w / 2, y - d / 2, y + d / 2, base_z + Ht, min(w, d) * 0.3, M['slate'], over=0.3, ridge_axis='X' if w >= d else 'Y'))
    if bal:
        for fl in bal['floors']:
            for k in range(bal['n']):
                bx = x - w / 2 + (k + 0.5) * w / bal['n']
                z = base_z + fl * fh + 0.05
                parts.append(box('Bal', (bx, y - d / 2 - 0.55, z), (w / bal['n'] * 0.62, 1.1, 0.14), M['conc'], bevel=0.02))
                parts.append(box('BalGl', (bx, y - d / 2 - 1.08, z + 0.5), (w / bal['n'] * 0.62, 0.05, 1.0), M['glassb']))
    return parts


def pool_block(M, x, y, z, w, d):
    return [box('PoolEdge', (x, y, z + 0.06), (w + 0.5, d + 0.5, 0.12), M['stone'], bevel=0.03),
            box('Pool', (x, y, z + 0.14), (w, d, 0.1), M['water'])]


def tree_(M, x, y, s=0.8, seed=1):
    return H.tree(x, y, s, M, seed=seed)


def street_scene(M, W=22, D=16):
    parts = ground(M, W, D, grass='path')
    parts += road(M, 0, -D / 2 + 2.0, W - 1, 3.0, z=0.0)
    return parts


BR = ('#9b5a3f', '#8a4c34', '#d7cfc2', 6)
BR_OLD = ('#7d5a4a', '#6c4d40', '#a9a196', 6)
BR_RED = ('#a8553a', '#98462f', '#d7cfc2', 7)
LOFT_BR = ('#8d4f38', '#7b4230', '#c9c0b2', 6)


def f1(M, lv):
    P = []
    if lv == 1:
        P += ground(M, 17, 13, grass='path')
        P += road(M, 0, -4.8, 16.4, 3.0)
        # ours is the narrow middle one of three
        P += tower(M, 0, 0, 5.0, 5.6, 2, 3.0, dict(base='#9b5a3f', brick=BR_OLD, cw=2.5, wa=(0.2, 0.8), wz=(0.22, 0.8), lit=0.2), roof='gable', hi=(1, 1), name='Mid')
        P += tower(M, -5.3, 0.3, 5.0, 5.4, 2, 3.0, dict(base='#9b5a3f', brick=BR, cw=2.5, lit=0.25), roof='gable', name='L')
        P += tower(M, 5.3, 0.3, 5.0, 5.4, 2, 3.0, dict(base='#9b5a3f', brick=BR, cw=2.5, lit=0.25), roof='gable', name='R')
        P += H.door(-1.0, -2.85, M, w=0.9)
        P.append(box('Dorm', (0.8, -2.2, 6.9), (1.2, 1.2, 1.4), M['white'], bevel=0.03))
        P.append(box('DormGl', (0.8, -2.82, 6.9), (0.8, 0.05, 0.8), M['glass']))
        P += small_car(M, 3, -4.8, 0, '#9a8a6a')
    elif lv == 2:
        P += ground(M, 19, 14, grass='path')
        P += road(M, 0, -5.4, 18.4, 3.0)
        P += tower(M, 0, 0, 9, 7, 4, 3.0, dict(base='#9b5a3f', brick=BR, cw=3.0, lit=0.3), hi=(1, 1), name='Blk', tank=True)
        P += tower(M, -8.2, 0.8, 6, 5, 2, 3.0, dict(base='#d9ccb0', cw=3.0, lit=0.2), name='Shop')
        P += H.door(0, -3.5, M, w=1.1, h=2.2)
        P += tree_(M, 7, -3.0, 0.7, 3)
        P += small_car(M, -3, -5.4, 0, '#3b82f6')
    elif lv == 3:
        P += ground(M, 20, 14, grass='path')
        P += road(M, 0, -5.4, 19.4, 3.0)
        P += tower(M, 0, 0, 10, 7, 5, 3.0, dict(base='#ece6d6', cw=2.5, wa=(0.2, 0.8), lit=0.3, rough=0.85), bal=dict(floors=[1, 2, 3], n=3), hi=(2, 2), name='Blk', tank=True)
        P += tree_(M, -8, -3.2, 0.8, 4)
        P += tree_(M, 8, -3.0, 0.7, 5)
        P += small_car(M, 4, -5.4, 0, '#d01f1f')
    elif lv == 4:
        P += ground(M, 22, 15, grass='path')
        P += road(M, 0, -5.8, 21.4, 3.0)
        # warehouse loft: big factory windows, sawtooth glazed roof, chimney stack
        P += tower(M, 0, 0, 13, 8, 4, 3.6, dict(base='#8d4f38', brick=LOFT_BR, cw=3.25, wa=(0.12, 0.88), wz=(0.16, 0.84), lit=0.35, win='#10243a'), hi=(1, 2), name='Wh')
        P.append(box('Cap', (0, 0, 14.5), (13.3, 8.3, 0.3), M['dark'], bevel=0.03))
        for k in range(3):
            P.append(box('Sky', (-4 + k * 4, 0.0, 14.9), (2.8, 5.0, 0.5), M['glassb'], bevel=0.05, rot=(0, 0, 0)))
        P.append(cyl('Stack', (5.2, 2.2, 10), 0.8, 12.0, 'Z', mat=H.brick_mat('StackB', '#8d4f38', '#7b4230', '#c9c0b2', scale=6), bevel=0.03))
        P.append(cyl('StackCap', (5.2, 2.2, 16.1), 0.95, 0.3, 'Z', mat=M['dark']))
        P += H.door(-3.0, -4.0, M, w=1.4, h=2.6)
        P += tree_(M, -9, -3.5, 0.8, 6)
        P += small_car(M, 4, -5.8, 0, '#0d1018')
    else:
        # riverside: the loft with a river and a quay in front
        P += ground(M, 24, 17, grass='path')
        P += [box('River', (0, -6.2, -0.1), (23.4, 5.4, 0.3), M['water'])]
        P += [box('Quay', (0, -3.1, 0.12), (23.4, 0.9, 0.7), M['stone2'], bevel=0.03)]
        P += tower(M, 0, 1.0, 13, 8, 4, 3.6, dict(base='#8d4f38', brick=LOFT_BR, cw=3.25, wa=(0.12, 0.88), wz=(0.16, 0.84), lit=0.4, win='#10243a'), hi=(1, 2), name='Wh', base_z=0.2)
        P.append(box('Cap', (0, 1.0, 14.7), (13.3, 8.3, 0.3), M['gold'], bevel=0.03))
        for k in range(3):
            P.append(box('Sky', (-4 + k * 4, 1.0, 15.1), (2.8, 5.0, 0.5), M['glassb'], bevel=0.05, rot=(0, 0, 0)))
        # footbridge over the river + a boat
        P.append(box('Bridge', (7.0, -6.2, 0.9), (1.6, 6.0, 0.18), M['stone'], bevel=0.04))
        for sx in (-1, 1):
            P.append(box('BrR', (7.0 + sx * 0.78, -6.2, 1.5), (0.08, 6.0, 0.9), M['metal']))
        boat = box('Boat', (-4.5, -6.4, 0.05), (3.6, 1.3, 0.5), M['red'], bevel=0.2)
        P += [boat, box('BoatC', (-4.2, -6.4, 0.55), (1.2, 0.9, 0.5), M['white'], bevel=0.06)]
        P += tree_(M, -9.5, -1.8, 0.85, 7)
        P += tree_(M, 9.5, -1.8, 0.8, 8)
    return P, city_cfg(26 if lv < 5 else 28)


def f2(M, lv):
    P = []
    if lv == 1:
        # shared flat: a tall Victorian house cut into flats, between two painted neighbours
        P += ground(M, 20, 14, grass='path')
        P += road(M, 0, -5.4, 19.4, 3.0)
        P += tower(M, 0, 0, 6.4, 7, 3, 3.0, dict(base='#9b5a3f', brick=BR_RED, cw=3.2, lit=0.4), roof='gable', hi=(0, 1), name='Mid')
        P += tower(M, -6.6, 0.2, 6.4, 6.6, 3, 3.0, dict(base='#e5d6a8', cw=3.2, lit=0.3), roof='gable', name='L')
        P += tower(M, 6.6, 0.2, 6.4, 6.6, 3, 3.0, dict(base='#a9c6c9', cw=3.2, lit=0.3), roof='gable', name='R')
        P += H.door(1.2, -3.5, M, w=1.0)
        for fl in range(2):
            P.append(box('Bay', (-1.0, -3.9, 1.5 + fl * 3.0), (2.0, 1.0, 2.0), M['white'], bevel=0.05))
        P += tree_(M, -3.2, -4.0, 0.5, 2)
        P += small_car(M, 4.5, -5.4, 0, '#6b7280')
    elif lv == 2:
        P += ground(M, 20, 14, grass='path')
        P += road(M, 0, -5.4, 19.4, 3.0)
        P += tower(M, 0, 0, 11, 7, 6, 3.0, dict(base='#b9b4aa', cw=2.2, wa=(0.12, 0.88), lit=0.3), hi=(2, 3), name='Blk', tank=True)
        P += tower(M, -9, 1.0, 5, 5, 3, 3.0, dict(base='#d9ccb0', cw=2.5, lit=0.2), name='N')
        P += tree_(M, 8, -3.2, 0.7, 2)
        P += small_car(M, 4, -5.4, 0, '#3b82f6')
    elif lv == 3:
        P += ground(M, 20, 14, grass='path')
        P += road(M, 0, -5.4, 19.4, 3.0)
        P += tower(M, 0, 0, 11, 7, 7, 3.0, dict(base='#e9e5da', cw=2.75, wa=(0.18, 0.82), lit=0.3), bal=dict(floors=[1, 2, 3, 4, 5], n=4), hi=(1, 3), name='Blk', tank=True)
        P += tower(M, 9, 1.5, 4.5, 5, 4, 3.0, dict(base='#c9d5de', cw=2.25, lit=0.2), name='N')
        P += tree_(M, -8.5, -3.2, 0.9, 2); P += tree_(M, -6.5, -3.5, 0.7, 3)
        P += small_car(M, 4, -5.4, 0, '#d01f1f')
    elif lv == 4:
        P += ground(M, 22, 15, grass='path')
        P += road(M, 0, -5.8, 21.4, 3.0)
        P += tower(M, 0, 0.5, 12, 7.5, 7, 3.0, dict(base='#2a2f3a', cw=3.0, wa=(0.1, 0.9), wz=(0.12, 0.88), lit=0.3), hi=None, name='Blk')
        # duplex: two storeys of floor-to-ceiling glass stepping out, with a terrace slab and rail
        P.append(box('DupGl', (1.0, -3.55, 14.5), (6.2, 0.2, 5.6), M['glassb']))
        P.append(box('DupLit', (1.0, -3.5, 14.5), (5.8, 0.06, 5.2), S.principled('DupL', '#ffcf80', rough=0.3, emission='#ffbd5a', emission_strength=0.9)))
        P.append(box('Terr', (1.0, -4.6, 11.55), (7.0, 2.4, 0.2), M['conc'], bevel=0.03))
        P.append(box('TerrR', (1.0, -5.7, 12.25), (7.0, 0.05, 1.1), M['glassb']))
        P.append(box('Roof', (0.5, 0.5, 21.2), (12.4, 7.9, 0.4), M['metal'], bevel=0.03))
        P.append(box('GoldEdge', (0.5, 0.5, 21.45), (12.6, 8.1, 0.1), M['gold']))
        P += tree_(M, -9, -3.5, 0.8, 4)
        P += small_car(M, 5, -5.8, 0, '#0d1018')
    else:
        # sky apartment: glass tower rising out of a podium, neighbours lower
        P += ground(M, 26, 19, grass='path')
        P += road(M, 0, -7.4, 25.4, 3.0)
        P += tower(M, 0, 0, 12, 12, 10, 3.0, dict(base='#6fa6c9', win='#0e2a45', cw=1.5, wa=(0.05, 0.95), wz=(0.08, 0.9), lit=0.25, rough=0.2), hi=(2, 8), name='Tw', base_z=0.0)
        P.append(cyl('Spire', (0, 0, 33.2), 0.2, 6.0, 'Z', mat=M['gold']))
        P.append(box('Crown', (0, 0, 30.2), (12.4, 12.4, 0.4), M['gold'], bevel=0.05))
        P += tower(M, -10.6, 1.5, 5.0, 6, 5, 3.0, dict(base='#8a97a8', win='#0e2a45', cw=1.8, lit=0.2, rough=0.3), name='N1')
        P += tower(M, 10.6, 1.5, 5.0, 6, 6, 3.0, dict(base='#b7bfc9', win='#0e2a45', cw=1.8, lit=0.2, rough=0.3), name='N2')
        P += small_car(M, 6, -7.4, 0, '#f5c518')
    return P, city_cfg(28)


def pent(M, lv):
    P = []
    W = 11
    if lv == 1:
        P += ground(M, 20, 14, grass='path'); P += road(M, 0, -5.4, 19.4, 3.0)
        P += tower(M, 0, 0, 10, 7, 5, 3.0, dict(base='#9b5a3f', brick=BR, cw=2.5, lit=0.3), hi=(1, 4), name='Blk', tank=True)
        P += tower(M, -9, 1, 5, 5, 3, 3.0, dict(base='#d9ccb0', cw=2.5, lit=0.2), name='N')
        P += H.door(-3, -3.5, M, w=1.1, h=2.2)
        P += tree_(M, 8, -3.2, 0.7, 2)
        P += small_car(M, 4, -5.4, 0, '#6b7280')
    elif lv == 2:
        P += ground(M, 20, 14, grass='path'); P += road(M, 0, -5.4, 19.4, 3.0)
        P += tower(M, 0, 0, 10, 7, 5, 3.0, dict(base='#d6d1c5', cw=2.5, lit=0.3), name='Blk')
        P.append(box('PHGl', (0.5, -0.0, 16.3), (7.6, 5.0, 2.6), S.principled('PH', '#9fc6dc', rough=0.03, spec=1.0, emission='#ffd08a', emission_strength=0.4), bevel=0.05))
        P.append(box('PHRoof', (0.5, 0, 17.75), (8.4, 5.8, 0.3), M['gold'], bevel=0.03))
        P += tree_(M, -8, -3.2, 0.8, 4)
        P += small_car(M, 4, -5.4, 0, '#3b82f6')
    elif lv == 3:
        P += ground(M, 20, 14, grass='path'); P += road(M, 0, -5.4, 19.4, 3.0)
        P += tower(M, 0, 0, 10, 7, 5, 3.0, dict(base='#d6d1c5', cw=2.5, lit=0.3), name='Blk')
        z0 = 15.15
        P.append(box('PHBox', (-1.4, 0.6, z0 + 1.3), (5.4, 4.4, 2.6), S.principled('PH', '#9fc6dc', rough=0.03, spec=1.0, emission='#ffd08a', emission_strength=0.45), bevel=0.05))
        P.append(box('PHRoof', (-1.4, 0.6, z0 + 2.75), (6.2, 5.2, 0.3), M['gold'], bevel=0.03))
        # roof terrace: deck, glass rail, planters, parasol
        P.append(box('Deck', (2.0, -0.4, z0 + 0.1), (4.6, 6.4, 0.18), M['deck'], bevel=0.02))
        for k, c in enumerate((-2.6, 0.2, 2.9)):
            P.append(box('Rail', (4.3, c, z0 + 0.8), (0.05, 2.4, 1.1), M['glassb']))
        P.append(box('RailF', (2.0, -3.6, z0 + 0.8), (4.6, 0.05, 1.1), M['glassb']))
        for k in range(3):
            P += [cyl('Pot', (0.4 + k * 1.5, -3.0, z0 + 0.35), 0.38, 0.5, 'Z', mat=M['stone']), sph('Plant', (0.4 + k * 1.5, -3.0, z0 + 0.9), 0.4, M['leaf'])]
        P += [cyl('Pole', (3.0, 0.2, z0 + 1.2), 0.04, 2.2, 'Z', mat=M['metal']), cyl('Para', (3.0, 0.2, z0 + 2.4), 1.3, 0.1, 'Z', mat=M['umb'], r2=0.1)]
        P += tree_(M, -8, -3.2, 0.8, 4)
        P += small_car(M, 4, -5.4, 0, '#d01f1f')
    elif lv == 4:
        P += ground(M, 24, 18, grass='path'); P += road(M, 0, -7.0, 23.4, 3.0)
        P += tower(M, 0, 0, 12, 10, 8, 3.0, dict(base='#5f7d9c', win='#0e2a45', cw=1.8, wa=(0.05, 0.95), wz=(0.1, 0.9), lit=0.28, rough=0.25), name='Tw')
        z0 = 24.0
        P.append(box('PHBox', (-1.5, 0.0, z0 + 2.3), (7.0, 7.4, 4.6), S.principled('PH', '#9fc6dc', rough=0.03, spec=1.0, emission='#ffd08a', emission_strength=0.55), bevel=0.05))
        P.append(box('PHRoof', (-1.5, 0, z0 + 4.75), (7.8, 8.2, 0.3), M['gold'], bevel=0.03))
        P.append(box('Deck', (3.9, 0, z0 + 0.1), (3.8, 9.0, 0.2), M['deck']))
        P += pool_block(M, 3.9, 0, z0 + 0.1, 2.2, 6.0)
        P += tower(M, -9.5, 1.0, 5.4, 6, 6, 3.0, dict(base='#8a97a8', win='#0e2a45', cw=1.8, lit=0.2, rough=0.3), name='N1')
        P += tree_(M, 8, -4.2, 0.8, 4)
        P += small_car(M, 4, -7.0, 0, '#0d1018')
    else:
        P += ground(M, 26, 19, grass='path'); P += road(M, 0, -7.4, 25.4, 3.0)
        P += tower(M, 0, 0, 12, 12, 10, 3.0, dict(base='#d7b45a', win='#1c1408', cw=1.5, wa=(0.05, 0.95), wz=(0.1, 0.9), lit=0.3, rough=0.2), hi=None, name='Tw')
        z0 = 30.0
        P.append(box('Ring', (0, 0, z0 + 0.2), (12.6, 12.6, 0.4), M['gold'], bevel=0.03))
        P.append(box('PHBox', (-1.4, 0, z0 + 2.6), (7.6, 8.4, 4.4), S.principled('PH', '#ffe7b0', rough=0.03, spec=1.0, emission='#ffd08a', emission_strength=0.7), bevel=0.05))
        P.append(box('PHRoof', (-1.4, 0, z0 + 5.0), (8.6, 9.4, 0.35), M['gold'], bevel=0.03))
        P.append(cyl('Spire', (-1.4, 0, z0 + 8.0), 0.15, 5.6, 'Z', mat=M['gold']))
        P += pool_block(M, 3.9, 0, z0 + 0.3, 1.8, 6.0)
        P += tower(M, -11, 1.0, 5.0, 6, 5, 3.0, dict(base='#8a97a8', win='#0e2a45', cw=1.8, lit=0.2, rough=0.3), name='N1')
        P += tower(M, 11, 1.0, 5.0, 6, 6, 3.0, dict(base='#b7bfc9', win='#0e2a45', cw=1.8, lit=0.2, rough=0.3), name='N2')
        P += small_car(M, 6, -7.4, 0, '#f5c518')
    return P, city_cfg(28 if lv < 4 else 30)


FN = {'flat-1': f1, 'flat-2': f2, 'penthouse': pent}


def make(fam, lv):
    M = mat_walls(lv)
    parts, cfg = FN[fam](M, lv)
    return parts, cfg
