"""Stables, beach villas and islands."""
from homes_common import *
from homes_a import tree_, pool_block
from homes_b import block, wall, columns, chimney
import homes_b as B


def mound(M, x, y, rx, ry, h, mat='sand', z=0.0, name='Mound'):
    return sph(name, (x, y, z), 1.0, M[mat], scale=(rx, ry, h), seg=48, rings=24)


def ripple_scale():
    return 1


def stable_block(M, x, y, w, d, h, roofmat, wallmat, doors=3, ridge='X', cupola=False, name='Stb', door_mat=None):
    P = [box(name, (x, y, h / 2), (w, d, h), wallmat, bevel=0.04)]
    P.append(H.gable_roof(name + 'R', x - w / 2, x + w / 2, y - d / 2, y + d / 2, h, min(w, d) * 0.3, roofmat, over=0.35, ridge_axis=ridge))
    dm = door_mat or M['white']
    for k in range(doors):
        dx = x - w / 2 + (k + 0.5) * w / doors
        P.append(box('SD', (dx, y - d / 2 - 0.04, 1.35), (1.3, 0.08, 2.4), dm, bevel=0.02))
        P.append(box('SDt', (dx, y - d / 2 - 0.09, 2.3), (1.3, 0.06, 0.5), M['dark']))
    if cupola:
        P.append(box('Cup', (x, y, h + min(w, d) * 0.3 + 0.7), (1.2, 1.2, 1.4), M['white'], bevel=0.03))
        P.append(cyl('CupR', (x, y, h + min(w, d) * 0.3 + 2.0), 0.95, 1.1, 'Z', mat=M['copper'], r2=0.05))
    return P


def horse_head(M, x, y, z, ang=0):
    return horse(M, x, y, z, ang, 'horse_b', s=0.0001)  # unused helper


def jump(M, x, y, ang=0, col='red'):
    P = []
    for s in (-1, 1):
        P.append(box('JP', (x + math.cos(ang) * s * 1.2, y + math.sin(ang) * s * 1.2, 0.6), (0.12, 0.12, 1.2), M['white']))
    for k in range(3):
        P.append(tube('Pole', [(x - math.cos(ang) * 1.2, y - math.sin(ang) * 1.2, 0.35 + k * 0.3), (x + math.cos(ang) * 1.2, y + math.sin(ang) * 1.2, 0.35 + k * 0.3)], 0.06, M['red'] if k % 2 == 0 else M['white'], smooth=False, res=6))
    return P


def hz(M, x, y, ang, coat, s=1.4, pose='stand', cloth=None, blaze=False):
    from horses import horse2
    return horse2(M, x, y, 0.0, ang, coat, s * 1.18, pose, cloth, blaze)


def st(M, lv):
    """The stable ladder (v0.23.1): proper lofted horses, tighter paddocks so the horses read at 400px."""
    P = []
    M['woodbarn'] = S.principled('Barn', '#6b4a2e', rough=0.65)
    M['redbarn'] = S.principled('RedBarn', '#a3262a', rough=0.55)
    M['trough'] = S.principled('Trough', '#6b7280', rough=0.5, metal=0.6)
    FH = 1.7
    if lv == 1:
        P += ground(M, 17, 12)
        P.append(box('Mud', (0, 0, 0.0), (8.4, 5.2, 0.14), S.principled('Mud', '#6b4a30', rough=0.95), bevel=0.05))
        P += fence_loop(M, -7.6, 7.6, -5.0, 5.0, h=FH, rails=2)
        for dx in (-1.4, 1.4):
            for dy in (-0.9, 0.9):
                P.append(box('SP', (5.0 + dx, 2.6 + dy, 1.3), (0.16, 0.16, 2.6), M['woodfence']))
        P.append(box('SRoof', (5.0, 2.6, 2.75), (3.4, 2.6, 0.14), M['dark'], bevel=0.02, rot=(0.12, 0, 0)))
        P += [box('Trough', (-4.8, -3.4, 0.4), (2.0, 0.7, 0.5), M['trough'], bevel=0.05), box('TW', (-4.8, -3.4, 0.62), (1.8, 0.5, 0.05), M['water'])]
        P += hz(M, -0.6, 0.2, 0.55, 'bay', 1.5, 'graze')
        P += tree_(M, -8.0, 4.2, 0.9, 1)
    elif lv == 2:
        P += ground(M, 18, 13)
        P += stable_block(M, -3.6, 4.2, 6.2, 3.6, 3.2, M['dark'], M['woodbarn'], doors=2, name='Stb')
        for k in range(3):
            P.append(box('Bale', (3.4 + k * 1.3, 5.2, 0.4), (1.1, 0.9, 0.8), M['hay'], bevel=0.05))
        P += fence_loop(M, -6.0, 7.5, -5.0, 1.8, h=FH)
        P += hz(M, 1.6, -1.6, 0.5, 'grey', 1.45, 'stand', blaze=False)
        P += tree_(M, 8.0, 5.0, 0.9, 2)
    elif lv == 3:
        P += ground(M, 21, 14)
        P += stable_block(M, -1.0, 5.0, 12.0, 4.0, 3.4, M['dark'], M['redbarn'], doors=4, cupola=True, name='Stb')
        P += fence_loop(M, -9.0, 9.0, -6.0, 2.2, h=FH)
        P += hz(M, -3.5, -2.0, 0.35, 'chestnut', 1.5, 'stand', blaze=True)
        P += hz(M, 3.8, -3.0, 2.5, 'black', 1.45, 'graze')
        for k in range(3):
            P.append(box('Bale', (8.2, 5.2 - k * 1.1, 0.4), (1.1, 0.9, 0.8), M['hay'], bevel=0.05))
        P += [box('Trough', (-6.5, -4.6, 0.4), (2.0, 0.7, 0.5), M['trough'], bevel=0.05)]
        P += tree_(M, 9.0, 6.4, 1.0, 2)
    elif lv == 4:
        P += ground(M, 27, 19)
        P.append(box('School', (-7.5, 5.5, 3.4), (12, 7.5, 6.8), S.principled('Clad', '#3b82f6', rough=0.5), bevel=0.05))
        P.append(H.gable_roof('SchoolR', -13.5, -1.5, 1.75, 9.25, 6.8, 2.4, M['dark'], over=0.4, ridge_axis='X'))
        P.append(box('Big', (-7.5, 1.7, 2.2), (5.5, 0.1, 4.4), M['white'], bevel=0.03))
        P += stable_block(M, 6.5, 7.0, 7.0, 3.8, 3.2, M['dark'], M['redbarn'], doors=3, name='Stb')
        P.append(box('Sand', (2.5, -3.6, 0.03), (17, 9, 0.12), S.principled('Arena', '#d9bf8a', rough=0.95)))
        P += fence_loop(M, -6.0, 11.0, -8.1, 0.9, h=FH, mat='fence', rails=2)
        P += jump(M, 8.0, -2.2, 0.0) + jump(M, -1.0, -6.0, 1.3)
        P += hz(M, 3.2, -3.8, 0.3, 'bay', 1.5, 'trot')
        P += hz(M, 9.5, -6.2, 2.7, 'grey', 1.3, 'graze')
        P += tree_(M, 12.0, 8.0, 1.0, 3) + tree_(M, -13.0, -4.0, 1.0, 4)
    else:
        P += ground(M, 33, 23)
        for sx in (-1, 1):
            P += stable_block(M, sx * 7.0, 8.0, 3.8, 9.0, 3.4, M['dark'], M['plaster'], doors=0, ridge='Y', name='Side')
        P += stable_block(M, 0, 11.5, 14.0, 4.0, 3.6, M['dark'], M['plaster'], doors=0, name='Back')
        for k in range(5):
            P.append(box('SD', (-5 + k * 2.5, 9.5, 1.35), (1.4, 0.08, 2.4), M['red']))
        P.append(box('Tower', (0, 11.5, 6.3), (3.4, 3.4, 5.4), M['plaster'], bevel=0.04))
        P.append(box('Clk', (0, 9.78, 6.5), (1.5, 0.06, 1.5), M['white']))
        P.append(cyl('TRoof', (0, 11.5, 9.9), 2.5, 2.6, 'Z', mat=M['gold'], r2=0.08, verts=4))
        P.append(cyl('Fin', (0, 11.5, 11.6), 0.08, 1.4, 'Z', mat=M['gold']))
        P.append(cyl('Cobble', (0, 7.4, 0.03), 4.6, 0.06, 'Z', mat=M['path']))
        ell = lambda rx, ry, z: [(math.cos(2 * math.pi * k / 48) * rx, -5.0 + math.sin(2 * math.pi * k / 48) * ry, z) for k in range(49)]
        tr = tube('Track', ell(12.0, 5.0, 0.08), 1.7, S.principled('Track', '#c8a46a', rough=0.95), smooth=False, res=3, cap=False)
        tr.scale[2] = 0.05
        P.append(tr)
        for (rx, ry) in ((10.5, 3.6), (13.5, 6.4)):
            P.append(tube('Rail', ell(rx, ry, 1.2), 0.07, M['fence'], smooth=False, res=4, cap=False))
            P.append(tube('Rail2', ell(rx, ry, 0.65), 0.07, M['fence'], smooth=False, res=4, cap=False))
            for k in range(0, 48, 3):
                x, y, _ = ell(rx, ry, 0)[k]
                P.append(box('Pst', (x, y, 0.65), (0.12, 0.12, 1.3), M['fence']))
        P += hz(M, 11.9, -5.0, math.pi / 2, 'black', 2.5, 'trot', cloth='#d4202a')
        P += hz(M, -1.0, -9.8, math.pi, 'chestnut', 2.5, 'trot', cloth='#2563eb')
        P += hz(M, -11.9, -5.0, -math.pi / 2, 'grey', 2.5, 'trot', cloth='#facc15')
        P += [cyl('TrB', (14.5, -9.5, 0.4), 0.8, 0.8, 'Z', mat=M['stone']), cyl('TrS', (14.5, -9.5, 1.1), 0.12, 0.8, 'Z', mat=M['gold']), cyl('TrC', (14.5, -9.5, 1.9), 0.55, 0.9, 'Z', mat=M['gold'], r2=0.3)]
        P += tree_(M, -15.0, 8.0, 1.1, 2) + tree_(M, 15.0, 8.0, 1.1, 3)
    cfg = city_cfg({1: 17, 2: 19, 3: 22, 4: 27, 5: 33}[lv])
    cfg['cam'] = (0.8 * cfg['scale'], -1.25 * cfg['scale'], 0.8 * cfg['scale'])
    return P, cfg


def sea_scene(M, w, d, land_frac=0.55, depth=1.4):
    """A diorama slab: sand on the back part, sea in front."""
    P = []
    ld = d * land_frac
    P.append(box('SandSide', (0, d / 2 - ld / 2, -0.5), (w, ld, 1.0), M['sand'], bevel=0.2, seg=3))
    P.append(box('SandTop', (0, d / 2 - ld / 2, 0.0), (w - 0.1, ld - 0.1, 0.12), M['sand'], bevel=0.12, seg=3))
    P.append(box('Sea', (0, -d / 2 + (d - ld) / 2, -0.55), (w, d - ld, 1.1), M['water'], bevel=0.12, seg=3))
    return P


def hut_deckchair(M, x, y, ang, col='#e8483a'):
    c = S.principled('Chair', col, rough=0.6)
    P = [box('Seat', (x, y, 0.5), (1.0, 0.8, 0.1), c, bevel=0.02, rot=(0, 0, ang)), box('Back', (x, y, 0.8), (0.1, 0.8, 0.9), c, bevel=0.02, rot=(0, 0, ang))]
    return P


def vl(M, lv):
    P = []
    if lv == 1:
        P += sea_scene(M, 22, 18, 0.6)
        # beach hut on a little deck, striped awning, palm, board
        P.append(box('Deck', (0, 4.0, 0.3), (7.5, 5.0, 0.3), M['deck'], bevel=0.02))
        P.append(box('Hut', (0, 4.6, 1.9), (5.0, 3.6, 3.0), S.principled('HutW', '#c9a36a', rough=0.7), bevel=0.04))
        P.append(H.gable_roof('HutR', -2.5, 2.5, 2.8, 6.4, 3.4, 1.3, M['dark'], over=0.4, ridge_axis='X'))
        P.append(box('HutD', (-1.0, 2.76, 1.4), (1.1, 0.08, 2.0), M['door']))
        P.append(box('HutW1', (1.4, 2.76, 2.1), (1.2, 0.08, 1.0), M['glass']))
        for k in range(8):
            cc = '#e8483a' if k % 2 == 0 else '#ffffff'
            P.append(box('Aw', (-2.45 + k * 0.7, 1.5, 3.05), (0.7, 2.2, 0.06), S.principled('Aw', cc, rough=0.6), rot=(0.35, 0, 0)))
        P += H.palm(5.2, 5.0, 1.1, M, seed=1)
        P += hut_deckchair(M, -4.0, 0.2, 0.3) + hut_deckchair(M, 3.8, 0.5, -0.2, '#2f6fe0')
        P.append(box('Board', (6.5, 0.6, 1.2), (0.4, 0.1, 2.4), S.principled('Surf', '#facc15', rough=0.3, coat=0.8), bevel=0.05, rot=(0, 0.2, 0.3)))
        P.append(box('Pier', (0, -4.5, 0.15), (2.0, 7.5, 0.25), M['deck']))
    elif lv == 2:
        P += sea_scene(M, 24, 20, 0.6)
        P += block(M, 0, 5.2, 7.5, 5.5, 2, 3.0, wall(None, '#f6f3ec', cw=3.2, wa=(0.28, 0.72), lit=0.1), roof='gable', ridge='X', roofh=2.4, rmat='tile', name='Cot')
        P += H.door(-1.5, 2.4, M, w=1.0, h=2.1) if False else [box('Door', (-1.5, 2.43, 1.1), (1.0, 0.06, 2.0), S.principled('BDoor', '#1d63d9', rough=0.4, coat=0.4))]
        P += chimney(M, 2.2, 5.2, 7.4, 1.8, 0.8)
        P += fence_loop(M, -6, 6, 1.0, 9.0, h=0.9, mat='fence', rails=2)
        P.append(box('Boat', (6.5, 1.2, 0.2), (3.0, 1.2, 0.5), S.principled('Boat', '#2f6fe0', rough=0.4), bevel=0.2, rot=(0, 0, 0.3)))
        P += H.palm(-7.5, 3.0, 0.9, M, seed=2)
        P += hut_deckchair(M, 3.5, -1.0, 0.2, '#2f6fe0')
        P.append(box('Pier', (-5, -4.5, 0.15), (1.8, 7.5, 0.25), M['deck']))
        P.append(cyl('Buoy', (3, -6, 0.1), 0.35, 0.5, 'Z', mat=M['red']))
    elif lv == 3:
        P += sea_scene(M, 28, 22, 0.62)
        wm = dict(base='#f2efe8', cw=3.4, lit=0.3, wa=(0.12, 0.88), wz=(0.12, 0.88), win='#1a2a3a')
        P += B.tower(M, 0, 6.5, 11, 6.5, 2, 3.2, wm, roof='flat', name='Villa', trim=M['white'])
        P.append(box('Upper', (2.0, 6.5, 9.0), (7, 5, 2.6), S.principled('Up', '#f2efe8', rough=0.5), bevel=0.04))
        P.append(box('Terr', (0, 2.2, 0.2), (11, 3.0, 0.3), M['deck'], bevel=0.02))
        P.append(box('Rail', (0, 0.8, 1.0), (11, 0.05, 1.1), M['glassb']))
        P += pool_block(M, 0, 2.2, 0.35, 8.0, 2.0)
        P += H.palm(-7.0, 2.5, 1.2, M, seed=1) + H.palm(7.5, 5.0, 1.1, M, seed=3) + H.palm(-8.5, 7.5, 1.0, M, seed=5)
        for k in range(3):
            P.append(box('Lounger', (-3.5 + k * 3.2, -1.2, 0.3), (0.9, 2.0, 0.2), M['white'], bevel=0.06))
        P.append(box('Stairs', (7.0, -1.5, 0.1), (2.5, 3.0, 0.2), M['sand']))
    elif lv == 4:
        P += sea_scene(M, 28, 22, 0.55)
        # the cliff: a tall rock block on the land side, the villa on top, stairs down
        rock = S.principled('Rock', '#8a7a68', rough=0.95)
        S.add_grunge(rock, amount=0.7, dirt='#5e5043', scale=3.5, rough_add=0.0, seed=3)
        P.append(box('Cliff', (-1.0, 7.0, 4.0), (24, 8.5, 8.0), rock, bevel=0.5, seg=3))
        P.append(box('CliffTop', (-1.0, 7.0, 8.05), (24.0, 8.5, 0.2), M['grass'], bevel=0.3, seg=3))
        wm = dict(base='#f2efe8', cw=3.2, lit=0.3, wa=(0.1, 0.9), wz=(0.12, 0.88), win='#1a2a3a')
        P += B.tower(M, -2.0, 7.5, 12, 6.0, 2, 3.0, wm, roof='flat', name='Villa', base_z=8.1, trim=M['white'])
        P.append(box('TerrC', (-2.0, 4.0, 8.3), (12, 2.2, 0.2), M['deck']))
        P.append(box('RailC', (-2.0, 2.95, 9.0), (12, 0.05, 1.0), M['glassb']))
        P += pool_block(M, 3.5, 4.0, 8.4, 3.0, 1.6)
        P += H.palm(-10, 6.5, 1.1, M, seed=2) + H.palm(8.5, 8.5, 1.0, M, seed=4)
        # stairs down the cliff face to the beach
        for k in range(12):
            P.append(box('Step', (8.0 + 0.0, 2.6 - k * 0.0, 7.7 - k * 0.65), (1.8, 0.6, 0.18), M['deck']) if False else box('Step', (9.0, 2.9 - k * 0.3, 7.8 - k * 0.66), (1.8, 0.7, 0.2), M['deck']))
        P.append(box('Boat', (6.5, -4.5, 0.15), (3.0, 1.2, 0.5), S.principled('Boat', '#e8483a', rough=0.4), bevel=0.2, rot=(0, 0, 0.3)))
        P.append(box('Pier', (2.0, -2.0, 0.15), (1.6, 6.5, 0.25), M['deck']))
    else:
        P += sea_scene(M, 32, 24, 0.6)
        wm = dict(base='#f6f1e4', cw=3.4, lit=0.35, wa=(0.12, 0.88), wz=(0.12, 0.88), win='#1a2a3a')
        P += B.tower(M, -2.0, 8.5, 12, 6.0, 2, 3.0, wm, roof='flat', name='Villa', base_z=0.0, trim=M['gold'])
        P.append(box('Upper', (-4.0, 8.5, 7.9), (7.5, 4.5, 2.6), S.principled('Up', '#f6f1e4', rough=0.5), bevel=0.04))
        P.append(box('UpperR', (-4.0, 8.5, 9.35), (8.2, 5.2, 0.3), M['gold'], bevel=0.02))
        P.append(box('Terrace', (0.0, 2.0, 0.2), (28, 6.4, 0.4), M['stone'], bevel=0.03))
        # infinity pool: long, flush with the edge, glowing
        P.append(box('IPool', (0.0, 1.0, 0.45), (22, 3.2, 0.12), S.principled('IW', '#27c3f0', rough=0.02, spec=1.0, emission='#4fd8ff', emission_strength=0.7)))
        P.append(box('Edge', (0.0, -0.9, 0.3), (22, 0.3, 0.4), M['stone']))
        for k in range(4):
            P.append(box('Lounger', (-8 + k * 3.2, 4.2, 0.55), (0.9, 2.0, 0.2), M['white'], bevel=0.06))
            P.append(cyl('Umb', (-8 + k * 3.2, 5.6, 1.6), 0.9, 0.1, 'Z', mat=M['umb'], r2=0.1)) if k % 2 == 0 else None
        P += H.palm(-12.5, 5.0, 1.2, M, seed=1) + H.palm(12.5, 4.0, 1.2, M, seed=3) + H.palm(10.0, 9.5, 1.0, M, seed=5)
    cfg = city_cfg({1: 22, 2: 24, 3: 28, 4: 30, 5: 32}[lv])
    cfg['cam'] = (0.8 * cfg['scale'], -1.25 * cfg['scale'], 0.75 * cfg['scale'])
    cfg['floor'] = -1.1
    return [p for p in P if p is not None], cfg


def isl(M, lv):
    P = []
    sea = lambda w, d, cx=0, cy=0: [box('Sea', (cx, cy, -0.7), (w, d, 1.4), M['water'], bevel=0.25, seg=4)]
    pal = lambda x, y, s=1.0, k=1: H.palm(x, y, s, M, seed=k)
    if lv == 1:
        P += sea(15, 12)
        P.append(mound(M, 0, 0, 5.2, 3.2, 0.35, z=0.0, name='Bank'))
        P.append(mound(M, 1.5, 0.6, 2.4, 1.4, 0.45, z=0.0, name='Bank2'))
        P += [cyl('Pole', (0.2, 0.2, 1.6), 0.05, 2.2, 'Z', mat=M['metal']), cyl('Umb', (0.2, 0.2, 2.6), 1.3, 0.12, 'Z', mat=M['umb'], r2=0.1)]
        P += hut_deckchair(M, -1.8, -0.4, 0.5)
        P.append(box('Towel', (1.6, -0.9, 0.34), (1.6, 0.8, 0.04), S.principled('T', '#2f6fe0', rough=0.8), rot=(0, 0, 0.5)))
    elif lv == 2:
        P += sea(18, 14)
        P.append(mound(M, 0, 0, 7.5, 5.5, 0.6, name='Isl'))
        P.append(mound(M, 0.5, 0.3, 5.0, 3.6, 0.7, mat='grass', z=0.28, name='Grass'))
        P += pal(-1.5, 0.8, 1.2, 1) + pal(1.8, -0.8, 1.3, 2) + pal(3.0, 1.2, 1.0, 3)
        P += hut_deckchair(M, -4.4, -1.8, 0.4)
        P += [cyl('Rock', (5.5, -2.5, 0.3), 0.7, 0.9, 'Z', mat=M['stone2'], bevel=0.2)]
    elif lv == 3:
        P += sea(23, 19, 0, -1)
        P.append(mound(M, 0, 0, 9.5, 7.0, 0.7, name='Isl'))
        P.append(mound(M, 0.0, 0.8, 7.0, 5.0, 0.9, mat='grass', z=0.3, name='Grass'))
        wm = dict(base='#f6f1e4', cw=3.2, lit=0.3, wa=(0.12, 0.88), wz=(0.12, 0.88), win='#1a2a3a')
        P += B.tower(M, -1.0, 1.2, 8, 5, 1, 3.0, wm, roof='flat', name='Villa', base_z=0.9, trim=M['gold'])
        P += pool_block(M, 4.2, -0.2, 0.95, 2.2, 3.4)
        P += pal(-6.0, 1.0, 1.2, 1) + pal(6.2, 3.0, 1.2, 2) + pal(-3.0, -2.8, 1.0, 3)
        P.append(box('Jetty', (0, -8.5, 0.1), (1.8, 6.5, 0.25), M['deck']))
        P.append(box('Boat', (3.0, -9.5, 0.1), (3.4, 1.3, 0.55), S.principled('Boat', '#ffffff', rough=0.3, coat=0.8), bevel=0.25, rot=(0, 0, 0.1)))
        P.append(box('BoatC', (3.0, -9.5, 0.7), (1.4, 0.9, 0.5), M['glass'], bevel=0.1))
    elif lv == 4:
        P += sea(30, 30, 0, -3)
        P.append(mound(M, 0, 2, 11.5, 7.5, 0.7, name='Isl'))
        P.append(mound(M, 0, 2.8, 9.0, 5.6, 0.9, mat='grass', z=0.3, name='Grass'))
        wm = dict(base='#f6f1e4', cw=3.4, lit=0.35, wa=(0.12, 0.88), wz=(0.12, 0.88), win='#1a2a3a')
        P += B.tower(M, -2.0, 4.0, 11, 5.5, 2, 3.0, wm, roof='flat', name='Main', base_z=0.9, trim=M['gold'])
        P += pool_block(M, 4.5, 0.2, 0.95, 2.4, 3.6)
        for k in range(3):
            P += H.palm(-8 + k * 4.0, 0.0, 1.1, M, seed=k)
        # stilt bungalows over the water on a boardwalk
        P.append(box('Walk', (0, -8.0, 0.45), (1.6, 6.0, 0.2), M['deck']))
        for sx, yy in ((-5.5, -9.5), (5.5, -9.5), (-5.5, -13.0), (5.5, -13.0)):
            P.append(box('Walk2', (sx / 2, yy, 0.45), (abs(sx), 1.0, 0.2), M['deck']))
            P.append(box('Bung', (sx, yy, 1.9), (3.4, 3.0, 2.2), S.principled('Bg', '#c9a36a', rough=0.7), bevel=0.04))
            P.append(cyl('BR', (sx, yy, 3.4), 2.7, 1.6, 'Z', mat=S.principled('Thatch', '#a07a3c', rough=0.95), r2=0.2, verts=4))
            for dx in (-1.4, 1.4):
                for dy in (-1.2, 1.2):
                    P.append(cyl('Stilt', (sx + dx, yy + dy, -0.3), 0.1, 1.6, 'Z', mat=M['woodfence']))
    else:
        P += sea(40, 24, 2, -1)
        isls = [(-10, 2, 7.0, 5.0), (3, -2, 8.0, 6.0), (15, 4, 6.0, 4.5)]
        wm = dict(base='#f6f1e4', cw=3.2, lit=0.3, wa=(0.12, 0.88), wz=(0.12, 0.88), win='#1a2a3a')
        for k, (x, y, rx, ry) in enumerate(isls):
            P.append(mound(M, x, y, rx, ry, 0.65, name=f'Isl{k}'))
            P.append(mound(M, x, y + 0.5, rx * 0.72, ry * 0.7, 0.85, mat='grass', z=0.28, name=f'Gr{k}'))
        P += B.tower(M, 3.0, -1.5, 7, 4.5, 1, 3.0, wm, roof='flat', name='Villa', base_z=0.8, trim=M['gold'])
        P += pool_block(M, 6.5, -1.5, 0.85, 1.5, 3.0) if False else []
        P += B.tower(M, -10, 2.5, 5.5, 3.6, 1, 2.8, wm, roof='flat', name='Villa2', base_z=0.8, trim=M['gold'])
        P += pal(-12.5, 0.5, 1.2, 1) + pal(-7, 0.5, 1.1, 2) + pal(0.0, 1.5, 1.2, 3) + pal(6.5, -3.5, 1.2, 4) + pal(14, 3.5, 1.3, 5) + pal(17, 5.5, 1.0, 6)
        # bridges between the islands, a resort dome on the far one and a yacht
        P.append(box('Br1', (-3.8, 0.5, 0.5), (6.5, 1.3, 0.2), M['deck'], rot=(0, 0, 0.04)))
        P.append(box('Br2', (9.0, 1.0, 0.5), (5.0, 1.3, 0.2), M['deck'], rot=(0, 0, 0.1)))
        P += [cyl('Dome', (15.0, 3.2, 0.9), 2.2, 1.6, 'Z', mat=M['white'], bevel=0.05), sph('DomeT', (15.0, 3.2, 1.9), 2.2, M['gold'], scale=(1, 1, 0.8))]
        P.append(box('Yacht', (-1.0, -9.0, 0.25), (7.0, 2.0, 0.9), S.principled('Y', '#f8fafc', rough=0.25, coat=1.0), bevel=0.4))
        P.append(box('YachtC', (-1.8, -9.0, 1.1), (3.0, 1.5, 0.8), M['glass'], bevel=0.15))
        P.append(box('YachtF', (-2.4, -9.0, 1.7), (1.4, 1.2, 0.2), M['gold'], bevel=0.05))
    cfg = city_cfg({1: 20, 2: 24, 3: 28, 4: 34, 5: 40}[lv])
    cfg['cam'] = (0.8 * cfg['scale'], -1.25 * cfg['scale'], 0.7 * cfg['scale'])
    cfg['floor'] = -1.4
    return P, cfg


FN = {'stable': st, 'villa': vl, 'island': isl}


def make(fam, lv):
    M = mat_walls(lv)
    return FN[fam](M, lv)
