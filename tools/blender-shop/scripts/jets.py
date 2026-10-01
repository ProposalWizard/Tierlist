"""Jet ladder (family `jet`): Light Aircraft, Helicopter, Small Jet, Business Jet, Private Airliner."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
import studio as S
from boot import cr
from kit import *

WORLD = 0.35


def mats(lv, col, rust=False, accent='#f8fafc'):
    return dict(
        paint=paint('Paint', col, lv, rust),
        white=S.principled('White', '#eef0f3', rough=0.35, coat=0.6),
        accent=S.principled('Accent', accent, rough=0.35, coat=0.6),
        tyre=S.principled('Tyre', '#141517', rough=0.8),
        metal=S.principled('Metal', '#9ea3aa', rough=0.3, metal=1.0),
        chrome=S.chrome('Chrome', 0.06),
        dark=S.principled('Dark', '#15171b', rough=0.45, metal=0.4),
        glass=S.principled('Glass', '#0b1522', rough=0.03, spec=1.0),
        gold=S.gold('Gold', 0.2),
        tail=S.principled('Tail', '#ff2a2a', rough=0.2, emission='#ff1f1f', emission_strength=1.5),
    )


def fuselage(L, prof, M, mat='paint', x0=0.0, n=44, subs=2, name='Fus'):
    """prof: [(t, half-width, half-height, centre-z)] t in 0..1 nose->tail?? here t 0 = TAIL, 1 = NOSE."""
    ky = [(p[0], p[1]) for p in prof]; kz = [(p[0], p[2]) for p in prof]; kc = [(p[0], p[3]) for p in prof]
    secs = []
    for i in range(n):
        t = 0.5 - 0.5 * math.cos(math.pi * i / (n - 1))
        x = x0 + (t - 0.5) * L
        ring = S.superellipse_ring(0, cr(kc, t), max(cr(ky, t), 0.012), max(cr(kz, t), 0.012), n=36, p_top=2.2, p_bot=2.2)
        secs.append([(x, y, z) for y, z in ring])
    o = S.loft(name, secs, subsurf=subs)
    S.apply_mods(o)
    o.data.materials.append(M[mat])
    for p in o.data.polygons: p.use_smooth = True
    return o


def surface(prof, L, x0, x):
    """half-width and centre z of the fuselage at world x."""
    t = (x - x0) / L + 0.5
    return cr([(p[0], p[1]) for p in prof], t), cr([(p[0], p[3]) for p in prof], t), cr([(p[0], p[2]) for p in prof], t)


def wing(root, chord, tip, tchord, span, thick, M, mat='paint', side=1, dih=0.0, z=0.0, name='Wing'):
    """A tapered slab. root = (x of leading edge at root); tip = x of leading edge at the tip."""
    t0 = thick / 2; t1 = thick * 0.35
    zt = z + span * dih
    v = [(root, 0, z - t0), (root - chord, 0, z - t0), (tip - tchord, side * span, zt - t1), (tip, side * span, zt - t1),
         (root, 0, z + t0), (root - chord, 0, z + t0), (tip - tchord, side * span, zt + t1), (tip, side * span, zt + t1)]
    f = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    if side < 0:
        f = [tuple(reversed(q)) for q in f]
    o = mesh_from(name, v, f, M[mat])
    b = o.modifiers.new('b', 'BEVEL'); b.width = thick * 0.3; b.segments = 2
    return o


def fin(x_root, chord, x_tip, tchord, h, thick, z0, M, mat='paint'):
    v = [(x_root, -thick / 2, z0), (x_root - chord, -thick / 2, z0), (x_tip - tchord, -thick * 0.3, z0 + h), (x_tip, -thick * 0.3, z0 + h),
         (x_root, thick / 2, z0), (x_root - chord, thick / 2, z0), (x_tip - tchord, thick * 0.3, z0 + h), (x_tip, thick * 0.3, z0 + h)]
    f = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    o = mesh_from('Fin', v, f, M[mat])
    b = o.modifiers.new('b', 'BEVEL'); b.width = thick * 0.3; b.segments = 2
    return o


def windows(prof, L, x0, xs, M, h=0.16, w=0.22, zoff=0.1, rr=0.04):
    parts = []
    for x in xs:
        hw, zc, hh = surface(prof, L, x0, x)
        for s in (-1, 1):
            parts.append(box(f'Win{x:.2f}{s}', (x, s * (hw - 0.004), zc + zoff), (w, 0.03, h), M['glass'], bevel=rr * min(w, h)))
    return parts


def gear(x, y, zr, M, rw=0.22, tw=0.1, strut_top=0.5):
    parts = []
    parts.append(cyl('GW', (x, y, rw), rw, tw, 'Y', mat=M['tyre'], bevel=0.02))
    parts.append(cyl('GH', (x, y + (0.04 if y > 0 else -0.04), rw), rw * 0.5, tw, 'Y', mat=M['metal']))
    parts.append(tube('GS', [(x, y * 0.5 if abs(y) > 0.01 else 0, rw + strut_top), (x, y, rw)], 0.025, M['metal'], smooth=False))
    return parts


def nacelle(x, y, z, L, r, M, mat='metal', cone=True):
    parts = [cyl('Nac', (x, y, z), r, L, 'X', mat=M[mat], bevel=r * 0.08)]
    parts.append(cyl('Inlet', (x + L / 2 + 0.01, y, z), r * 0.82, 0.06, 'X', mat=M['dark']))
    parts.append(cyl('Fan', (x + L / 2 + 0.03, y, z), r * 0.6, 0.02, 'X', mat=M['chrome']))
    parts.append(cyl('Cone', (x - L / 2 - r * 0.7, y, z), r * 0.5, r * 1.4, 'X', mat=M[mat], r2=r * 0.12))
    return parts


# ------------------------------------------------------------------ light aircraft
def light(M, lv):
    L = 8.0
    prof = [(0, 0.08, 0.1, 1.62), (0.2, 0.2, 0.28, 1.55), (0.5, 0.46, 0.55, 1.45), (0.78, 0.44, 0.5, 1.4), (0.94, 0.3, 0.32, 1.35), (1.0, 0.1, 0.1, 1.33)]
    fus = fuselage(L, prof, M)
    parts = [fus]
    parts.append(cyl('Cowl', (L / 2 + 0.1, 0, 1.35), 0.34, 0.5, 'X', mat=M['accent'], bevel=0.05, r2=0.22))
    parts.append(cyl('Spin', (L / 2 + 0.45, 0, 1.35), 0.18, 0.3, 'X', mat=M['metal'], r2=0.03))
    parts.append(box('Blade', (L / 2 + 0.4, 0, 1.35), (0.05, 0.2, 1.9), M['dark'], bevel=0.015, rot=(0.45, 0, 0)))
    # straight, low-set wings
    for s in (-1, 1):
        parts.append(wing(0.9, 1.45, 0.65, 1.0, 4.0, 0.2, M, side=s, z=1.05, dih=0.03))
        parts.append(wing(-2.8, 0.9, -3.15, 0.55, 1.5, 0.08, M, side=s, z=1.55))
    parts.append(fin(-L / 2 + 1.3, 1.2, -L / 2 + 0.7, 0.7, 1.35, 0.1, 1.5, M))
    parts += windows(prof, L, 0, [0.7, 1.4], M, h=0.4, w=0.7, zoff=0.25)
    parts.append(box('Wind', (1.2, 0, 1.88), (0.8, 0.7, 0.28), M['glass'], bevel=0.1, rot=(0, math.radians(-14), 0)))
    parts += gear(0.7, 0.0, 0, M, rw=0.25, tw=0.14, strut_top=0.5)
    for s in (-1, 1):
        parts += gear(-0.4, s * 1.7, 0, M, rw=0.22, tw=0.12, strut_top=0.55)
    parts.append(box('Stripe', (0, 0, 1.38), (L * 0.6, 0.0 + 0.9, 0.06), M['accent']))
    return parts, 1.0


def heli(M, lv):
    parts = []
    body = [(0, 0.2, 0.2, 1.9), (0.15, 0.4, 0.4, 1.85), (0.5, 0.7, 0.72, 1.6), (0.82, 0.7, 0.62, 1.55), (1.0, 0.2, 0.2, 1.55)]
    L = 4.6
    parts.append(fuselage(L, body, M, x0=0.0))
    # tail boom
    boom = [(0, 0.1, 0.1, 2.15), (0.3, 0.16, 0.16, 2.1), (0.7, 0.28, 0.28, 1.95), (1.0, 0.4, 0.4, 1.9)]
    parts.append(fuselage(4.0, boom, M, x0=-4.2, n=24, name='Boom'))
    parts.append(fin(-6.0, 0.9, -6.35, 0.45, 1.2, 0.1, 2.0, M))
    parts.append(box('TailPlane', (-5.5, 0, 2.18), (0.7, 1.5, 0.06), M['paint'], bevel=0.02))
    parts.append(cyl('TRot', (-6.1, 0.14, 2.9), 0.04, 0.1, 'Y', mat=M['dark']))
    for a in (0, math.pi / 2):
        parts.append(box('TBlade', (-6.1, 0.18, 2.9), (0.06, 0.05, 0.9), M['dark'], rot=(0, a, 0)))
    # canopy
    parts.append(sph('Canopy', (0.9, 0, 1.92), 0.5, M['glass'], scale=(1.7, 1.38, 1.0), seg=40, rings=20))
    parts.append(cyl('Mast', (0.2, 0, 2.85), 0.1, 0.55, 'Z', mat=M['metal']))
    parts.append(cyl('Hub', (0.2, 0, 3.15), 0.22, 0.12, 'Z', mat=M['dark']))
    nb = 4 if lv >= 5 else 2
    for k in range(nb):
        a = math.pi * k / nb * (2 if nb == 2 else 1) + 0.35
        parts.append(box(f'Blade{k}', (0.2 + math.cos(a) * 2.9, math.sin(a) * 2.9, 3.17), (5.8, 0.4, 0.06), M['dark'], bevel=0.01, rot=(0, 0, a)))
    for s in (-1, 1):
        parts.append(tube(f'Skid{s}', [(1.7, s * 0.8, 0.12), (0.0, s * 0.8, 0.1), (-1.5, s * 0.8, 0.1)], 0.045, M['metal'], smooth=False))
        parts.append(tube(f'Skid{s}b', [(1.7, s * 0.8, 0.12), (2.0, s * 0.8, 0.28)], 0.045, M['metal'], smooth=False))
        for xx in (0.7, -0.6):
            parts.append(tube(f'Leg{s}{xx}', [(xx, s * 0.8, 0.12), (xx, s * 0.5, 1.0)], 0.04, M['metal'], smooth=False))
    parts.append(box('Stripe', (-0.1, 0, 1.78), (3.8, 1.4, 0.06), M['accent'], bevel=0.01))
    return parts, 1.4


def small_jet(M, lv):
    L = 12.0
    prof = [(0, 0.05, 0.05, 1.7), (0.2, 0.3, 0.3, 1.7), (0.5, 0.6, 0.64, 1.55), (0.8, 0.58, 0.6, 1.5), (0.9, 0.5, 0.5, 1.45), (0.96, 0.34, 0.34, 1.4), (0.99, 0.16, 0.16, 1.37), (1.0, 0.05, 0.05, 1.35)]
    parts = [fuselage(L, prof, M)]
    for s in (-1, 1):
        parts.append(wing(1.2, 2.3, -1.0, 1.0, 4.8, 0.2, M, side=s, z=1.1, dih=0.05))
        parts.append(wing(-4.7, 1.5, -5.6, 0.8, 2.0, 0.1, M, side=s, z=2.5))
        parts += nacelle(-3.5, s * 0.9, 1.65, 1.8, 0.34, M)
        parts.append(box(f'Tip{s}', (-1.4, s * 4.85, 1.34), (0.9, 0.06, 0.1), M['tail'] if False else M['accent']))
    parts.append(fin(-3.8, 2.6, -5.0, 1.4, 2.4, 0.14, 1.9, M))
    parts += windows(prof, L, 0, [1.0, 1.7, 2.4, 3.1], M, h=0.28, w=0.42, zoff=0.12)
    parts.append(box('Wind', (4.4, 0, 1.95), (1.4, 0.8, 0.4), M['glass'], bevel=0.05, rot=(0, math.radians(-14), 0)))
    parts += gear(3.3, 0, 0, M, rw=0.3, tw=0.16, strut_top=0.5)
    for s in (-1, 1):
        parts += gear(-0.3, s * 1.5, 0, M, rw=0.3, tw=0.16, strut_top=0.6)
    parts.append(box('Stripe', (0, 0, 1.38), (L * 0.62, 1.3, 0.12), M['accent']))
    return parts, 3.0


def biz_jet(M, lv):
    L = 17.0
    prof = [(0, 0.05, 0.05, 2.0), (0.14, 0.34, 0.34, 2.0), (0.4, 0.82, 0.86, 1.75), (0.8, 0.8, 0.84, 1.72), (0.9, 0.7, 0.72, 1.68), (0.96, 0.46, 0.46, 1.62), (0.99, 0.22, 0.22, 1.56), (1.0, 0.06, 0.06, 1.52)]
    parts = [fuselage(L, prof, M)]
    for s in (-1, 1):
        parts.append(wing(1.5, 3.2, -2.5, 1.3, 7.0, 0.22, M, side=s, z=1.1, dih=0.07))
        parts.append(tube(f'Wl{s}', [(-2.2, s * 7.0, 1.6), (-2.5, s * 7.3, 2.45)], 0.07, M['accent'], smooth=False))
        parts.append(wing(-6.8, 2.0, -8.2, 1.0, 2.8, 0.12, M, side=s, z=3.9))
        parts += nacelle(-5.4, s * 1.35, 2.2, 2.6, 0.5, M)
        parts.append(box(f'Pylon{s}', (-5.2, s * 1.1, 2.15), (1.8, 0.4, 0.12), M['paint'], rot=(0.3 * s, 0, 0)))
    parts.append(fin(-6.6, 3.3, -8.0, 1.8, 3.0, 0.18, 2.1, M))
    parts += windows(prof, L, 0, [x * 0.9 for x in (-2.0, -1.0, 0.0, 1.0, 2.0, 3.0, 4.0)], M, h=0.34, w=0.5, zoff=0.18)
    parts.append(box('Wind', (6.4, 0, 2.25), (1.8, 1.1, 0.5), M['glass'], bevel=0.05, rot=(0, math.radians(-14), 0)))
    parts += gear(4.5, 0, 0, M, rw=0.34, tw=0.18, strut_top=0.8)
    for s in (-1, 1):
        parts += gear(-0.5, s * 1.8, 0, M, rw=0.38, tw=0.2, strut_top=0.9)
    parts.append(box('Stripe', (0, 0, 1.72), (L * 0.66, 1.72, 0.14), M['gold']))
    return parts, 4.0


def airliner(M, lv):
    L = 28.0
    prof = [(0, 0.08, 0.08, 3.2), (0.1, 0.5, 0.5, 3.1), (0.3, 1.35, 1.4, 2.7), (0.8, 1.35, 1.4, 2.7), (0.9, 1.2, 1.25, 2.7), (0.96, 0.85, 0.9, 2.65), (0.99, 0.45, 0.5, 2.6), (1.0, 0.15, 0.15, 2.55)]
    parts = [fuselage(L, prof, M, name='Fus')]
    for s in (-1, 1):
        parts.append(wing(2.6, 5.5, -4.0, 2.2, 13.0, 0.4, M, side=s, z=1.6, dih=0.1))
        parts += nacelle(-0.8, s * 5.0, 0.95, 4.0, 0.85, M)
        parts.append(box(f'Pylon{s}', (-0.2, s * 5.0, 1.55), (3.0, 0.2, 0.8), M['paint']))
        parts.append(wing(-11.0, 3.2, -13.2, 1.5, 5.0, 0.22, M, side=s, z=3.2, dih=0.04))
        parts.append(tube(f'Wl{s}', [(-4.0, s * 13.1, 3.0), (-4.5, s * 13.2, 4.3)], 0.09, M['gold'], smooth=False))
    parts.append(fin(-9.5, 5.5, -13.5, 3.0, 5.0, 0.3, 4.0, M))
    xs = [-8 + 0.9 * k for k in range(22)]
    parts += windows(prof, L, 0, xs, M, h=0.34, w=0.4, zoff=0.55)
    parts.append(box('Wind', (11.2, 0, 3.35), (1.6, 1.5, 0.4), M['glass'], bevel=0.05, rot=(0, math.radians(-30), 0)))
    parts += gear(8.5, 0, 0, M, rw=0.5, tw=0.3, strut_top=0.8)
    for s in (-1, 1):
        parts += gear(-1.0, s * 2.2, 0, M, rw=0.52, tw=0.3, strut_top=0.8)
    parts.append(box('Stripe', (0, 0, 2.5), (L * 0.72, 2.7, 0.2), M['gold']))
    return parts, 6.0


LV = {
    1: (light, '#8a8f78', True, '#c9c2b0'),
    2: (heli, '#2f6fe0', False, '#f3f4f6'),
    3: (small_jet, '#d01f1f', False, '#f8fafc'),
    4: (biz_jet, '#0d1018', False, '#d9dde3'),
    5: (airliner, 'gold', False, '#fde68a'),
}


def make(fam, lv):
    fn, col, rust, acc = LV[lv]
    M = mats(lv, col, rust, acc)
    if lv in (3,):
        M['paint'] = paint('Paint', col, lv)
    if lv == 4:
        M['paint'] = paint('Paint', col, lv)
    if lv == 1:
        S.add_grunge(M['metal'], amount=0.6, dirt='#7a3f1c', scale=25, seed=3)
    # white fuselage bodies read better as jets: level 2-4 jets get a white belly via accent
    parts, k = fn(M, lv)
    parts = convert_curves(parts)
    s = k
    cfg = dict(scale=3.8 * s, aim=(0, 0, 1.3 * s), cam=(8.0 * s, -7.8 * s, 2.5 * s), target=(0, 0, 1.4 * s), lens=55, fill=0.82, fill_y=0.74, floor=0.0, offset=(0, 0.0), floor_size=400)
    return parts, cfg
