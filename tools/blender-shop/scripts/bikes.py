"""Bike ladder (family `bike`): Rusty Moped, Scooter, Road Bike, Superbike, Custom Chopper.
Built in code. Bike points along +X (front), z up, wheels turn about Y."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
import studio as S
from kit import *

WORLD = 0.35


def mats(lv, col, rust=False):
    return dict(
        paint=paint('Paint', col, lv, rust),
        tyre=S.principled('Tyre', '#141517', rough=0.8, spec=0.3),
        metal=S.principled('Metal', '#9ea3aa', rough=0.3, metal=1.0),
        chrome=S.chrome('Chrome', 0.06),
        dark=S.principled('Dark', '#15171b', rough=0.45, metal=0.5),
        seat=S.principled('Seat', '#1a1a1d', rough=0.55, coat=0.25),
        lamp=S.principled('Lamp', '#fff6dd', rough=0.05, emission='#fff1c9', emission_strength=3.0),
        tail=S.principled('Tail', '#ff2a2a', rough=0.2, emission='#ff1f1f', emission_strength=2.0),
        glass=S.principled('Glass', '#9fc2d8', rough=0.03, spec=1.0, alpha=1.0),
        gold=S.gold('Gold', 0.2),
    )


def wheel(name, x, r, tw, M, spokes=0, fat=False, rim='metal', disc=True):
    parts = []
    parts.append(torus(name + 'T', (x, 0, r), r - tw, tw, 'Y', M['tyre'], 56, 18))
    parts.append(torus(name + 'R', (x, 0, r), r - 2 * tw - 0.004, 0.012, 'Y', M[rim], 56, 8))
    if spokes:
        for k in range(spokes):
            a = 2 * math.pi * k / spokes
            for s in (-1, 1):
                parts.append(tube(f'{name}S{k}{s}', [(x, s * 0.03, r), (x + math.cos(a) * (r - 2 * tw), s * 0.012, r + math.sin(a) * (r - 2 * tw))], 0.004, M[rim], smooth=False, res=4))
    else:
        parts.append(cyl(name + 'Disk', (x, 0, r), r - 2 * tw, 0.025, 'Y', mat=M[rim], bevel=0.004))
    parts.append(cyl(name + 'Hub', (x, 0, r), 0.04, 0.12, 'Y', mat=M['chrome']))
    if disc:
        parts.append(cyl(name + 'Brake', (x, 0.045, r), r * 0.55, 0.008, 'Y', mat=M['metal']))
    return parts


def fork(top, hub, M, gap=0.09, r=0.016, boot=True):
    parts = []
    for s in (-1, 1):
        parts.append(tube(f'Fork{s}', [(top[0], s * gap, top[2]), (hub[0], s * gap, hub[2])], r, M['chrome'], smooth=False))
        if boot:
            parts.append(tube(f'Sleeve{s}', [(top[0], s * gap, top[2]), ((top[0] + hub[0]) / 2 - 0.02, s * gap, (top[2] + hub[2]) / 2 + 0.03)], r * 1.5, M['dark'], smooth=False))
    parts.append(box('Crown', ((top[0] + hub[0]) / 2 * 0 + top[0] - 0.01, 0, top[2] - 0.02), (0.05, gap * 2 + 0.04, 0.04), M['dark'], bevel=0.01))
    return parts


def bars(pos, M, width=0.28, rise=0.0, back=0.0, grip=True, ape=0.0):
    parts = []
    x, z = pos
    for s in (-1, 1):
        pts = [(x, 0, z), (x - back * 0.3, s * width * 0.45, z + rise * 0.5 + ape * 0.3), (x - back, s * width * 0.5, z + rise + ape)]
        parts.append(tube(f'Bar{s}', pts, 0.012, M['chrome']))
        if grip:
            parts.append(cyl(f'Grip{s}', (x - back, s * (width * 0.5 + 0.04), z + rise + ape), 0.018, 0.1, 'Y', mat=M['dark']))
    return parts


def exhaust(p0, p1, r, M, mat='chrome', y=0.12, upturn=0.0):
    pts = [(p0[0], y, p0[1]), ((p0[0] + p1[0]) / 2, y + 0.01, p0[1] - 0.08), (p1[0], y, p1[1] + upturn)]
    t = tube('Exh', pts, r, M[mat])
    cap = cyl('ExhCap', (p1[0], y, p1[1] + upturn), r * 1.02, 0.012, 'X', mat=M['dark'])
    return [t, cap]


def swingarm(piv, hub, M, w=0.1, r=0.02):
    return [tube(f'Swing{s}', [(piv[0], s * w, piv[1]), (hub[0], s * w, hub[1])], r, M['metal'], smooth=False) for s in (-1, 1)]


def engine(x, z, M, w=0.3, h=0.3, d=0.4, fins=True):
    parts = [box('Case', (x, 0, z), (d, w, h * 0.55), M['metal'], bevel=0.03)]
    parts.append(cyl('Cyl1', (x + 0.08, 0, z + h * 0.45), 0.075, 0.2, 'Z', mat=M['dark'], bevel=0.01))
    if fins:
        for k in range(5):
            parts.append(cyl(f'Fin{k}', (x + 0.08, 0, z + h * 0.34 + k * 0.03), 0.095, 0.01, 'Z', mat=M['metal']))
    return parts


def tank(c, size, M, rot=(0, 0, 0), mat='paint'):
    o = sph('Tank', c, 0.5, M[mat], scale=size)
    o.rotation_euler = rot
    return o


# ------------------------------------------------------------------ levels
def moped(M):
    r = 0.25
    parts = wheel('Rw', -0.52, r, 0.045, M, spokes=14, disc=False) + wheel('Fw', 0.52, r, 0.04, M, spokes=14, disc=False)
    # rusty step-through frame: a low "U" from head to seat post
    parts.append(tube('Down', [(0.42, 0, 0.62), (0.32, 0, 0.42), (0.1, 0, 0.3), (-0.2, 0, 0.34), (-0.34, 0, 0.5)], 0.028, M['paint']))
    parts.append(tube('Tube2', [(0.42, 0, 0.64), (0.05, 0, 0.66), (-0.3, 0, 0.62)], 0.022, M['paint']))
    parts += swingarm((-0.3, 0.32), (-0.52, r), M, 0.09, 0.016)
    parts += fork((0.44, 0, 0.7), (0.52, 0, r), M)
    parts += bars((0.42, 0.78), M, width=0.4, back=0.1, rise=0.02)
    parts.append(sph('Head', (0.5, 0, 0.78), 0.085, M['lamp'], scale=(0.8, 1, 1)))
    parts.append(box('Seat', (-0.12, 0, 0.7), (0.55, 0.22, 0.09), M['seat'], bevel=0.04))
    parts.append(box('Eng', (-0.3, 0, 0.3), (0.3, 0.22, 0.22), M['metal'], bevel=0.04))
    parts.append(cyl('Tank', (0.0, 0, 0.5), 0.1, 0.34, 'X', mat=M['paint'], bevel=0.02))
    parts += exhaust((-0.2, 0.3), (-0.72, 0.22), 0.035, M, mat='metal', y=0.16)
    parts.append(box('Rack', (-0.62, 0, 0.55), (0.3, 0.25, 0.03), M['metal']))
    parts.append(box('Fend', (0.52, 0, 0.5), (0.4, 0.14, 0.03), M['paint'], bevel=0.01))
    parts.append(box('Basket', (0.58, 0, 0.9), (0.2, 0.3, 0.16), M['metal'], bevel=0.01))
    return parts


def scooter(M):
    r = 0.22
    parts = wheel('Rw', -0.5, r, 0.05, M, spokes=0, disc=False) + wheel('Fw', 0.5, r, 0.045, M, spokes=0, disc=False)
    # smooth body panels
    parts.append(sph('Rear', (-0.28, 0, 0.48), 0.5, M['paint'], scale=(0.78, 0.36, 0.36)))
    parts.append(box('Floor', (0.08, 0, 0.22), (0.55, 0.38, 0.06), M['paint'], bevel=0.03))
    parts.append(sph('Shield', (0.42, 0, 0.52), 0.5, M['paint'], scale=(0.24, 0.36, 0.5)))
    parts.append(sph('Nose', (0.5, 0, 0.78), 0.5, M['paint'], scale=(0.3, 0.3, 0.2)))
    parts.append(box('Seat', (-0.22, 0, 0.72), (0.5, 0.26, 0.1), M['seat'], bevel=0.05))
    parts += fork((0.46, 0, 0.7), (0.5, 0, r), M, boot=False)
    parts.append(sph('Fend', (0.5, 0, 0.36), 0.5, M['paint'], scale=(0.34, 0.2, 0.17)))
    parts += bars((0.44, 0.92), M, width=0.4, back=0.04)
    parts.append(sph('Head', (0.58, 0, 0.84), 0.08, M['lamp'], scale=(0.5, 1, 1)))
    parts.append(box('Screen', (0.46, 0, 1.0), (0.02, 0.28, 0.2), M['glass'], bevel=0.008, rot=(0, math.radians(-14), 0)))
    parts.append(box('Top', (-0.62, 0, 0.82), (0.26, 0.28, 0.26), M['paint'], bevel=0.04))
    parts.append(box('Tail', (-0.72, 0, 0.55), (0.04, 0.12, 0.05), M['tail']))
    parts += exhaust((-0.35, 0.28), (-0.7, 0.3), 0.04, M, mat='metal', y=0.2)
    return parts


def road(M):
    r = 0.32
    parts = wheel('Rw', -0.62, r, 0.07, M, spokes=16, disc=True) + wheel('Fw', 0.66, r, 0.06, M, spokes=16, disc=True)
    hx, hz = 0.42, 0.98
    parts += fork((hx, 0, hz), (0.66, 0, r), M)
    parts.append(tube('Frame', [(hx, 0, hz - 0.08), (0.1, 0, 0.82), (-0.25, 0, 0.84), (-0.42, 0, 0.78)], 0.03, M['metal']))
    parts.append(tube('Cradle', [(hx - 0.02, 0, hz - 0.15), (0.25, 0, 0.5), (0.0, 0, 0.35), (-0.3, 0, 0.4), (-0.4, 0, 0.7)], 0.025, M['metal']))
    parts += swingarm((-0.28, 0.4), (-0.62, r), M, 0.1, 0.022)
    parts += engine(0.0, 0.5, M)
    parts.append(tank((0.18, 0, 0.9), (0.38, 0.17, 0.15), M, rot=(0, math.radians(-8), 0)))
    parts.append(box('Seat', (-0.28, 0, 0.86), (0.52, 0.22, 0.07), M['seat'], bevel=0.035))
    parts.append(box('Tail', (-0.62, 0, 0.88), (0.3, 0.16, 0.07), M['paint'], bevel=0.03, rot=(0, math.radians(8), 0)))
    parts += bars((hx - 0.02, hz + 0.02), M, width=0.4, rise=0.08, back=0.1)
    parts.append(sph('Head', (hx + 0.1, 0, hz - 0.03), 0.1, M['lamp'], scale=(0.7, 1, 1)))
    parts += exhaust((0.1, 0.34), (-0.72, 0.46), 0.045, M, y=0.17, upturn=0.12)
    parts.append(box('Fend', (0.66, 0, 0.66), (0.44, 0.13, 0.025), M['paint'], bevel=0.01))
    parts.append(box('Lt', (-0.8, 0, 0.84), (0.04, 0.1, 0.04), M['tail']))
    return parts


def super_(M):
    r = 0.31
    parts = wheel('Rw', -0.6, r, 0.1, M, spokes=0, disc=True, rim='chrome') + wheel('Fw', 0.68, r, 0.055, M, spokes=0, disc=True, rim='chrome')
    parts += fork((0.44, 0, 0.82), (0.68, 0, r), M, boot=False)
    parts += swingarm((-0.26, 0.38), (-0.6, r), M, 0.1, 0.03)
    # one smooth fairing shell, lofted nose -> tail
    from boot import cr
    top = [(-0.95, 0.84), (-0.8, 0.95), (-0.5, 0.95), (-0.25, 0.93), (0.0, 0.98), (0.25, 0.98), (0.45, 0.88), (0.62, 0.78)]
    bot = [(-0.95, 0.78), (-0.7, 0.72), (-0.3, 0.64), (0.05, 0.62), (0.35, 0.64), (0.52, 0.7), (0.62, 0.74)]
    wid = [(-0.95, 0.04), (-0.8, 0.07), (-0.5, 0.1), (-0.2, 0.14), (0.1, 0.17), (0.35, 0.15), (0.52, 0.1), (0.62, 0.05)]
    secs = []
    n = 40
    for i in range(n):
        t = 0.5 - 0.5 * math.cos(math.pi * i / (n - 1))
        x = -0.95 + 1.57 * t
        zt = cr(top, x); zb = cr(bot, x); w = cr(wid, x)
        ring = S.superellipse_ring(0, (zt + zb) / 2, w, (zt - zb) / 2, n=32, p_top=2.4, p_bot=3.0, taper=0.1)
        secs.append([(x, y, z) for y, z in ring])
    # lower belly pan, darker, narrower — a visible colour break so it does not read as one pod
    pan = []
    for i in range(24):
        t = i / 23
        x = -0.3 + 0.95 * t
        zt = 0.66; zb = cr([(-0.3, 0.46), (0.0, 0.34), (0.3, 0.36), (0.65, 0.5)], x)
        w = cr([(-0.3, 0.07), (0.0, 0.13), (0.3, 0.12), (0.65, 0.05)], x)
        ring = S.superellipse_ring(0, (zt + zb) / 2, w, (zt - zb) / 2, n=24, p_top=2.2, p_bot=2.6)
        pan.append([(x, y, z) for y, z in ring])
    pn = S.loft('Pan', pan, subsurf=2); S.apply_mods(pn); pn.data.materials.append(M['dark']); parts.append(pn)
    parts += engine(0.0, 0.44, M, w=0.16, h=0.3, d=0.3)
    fair = S.loft('Fairing', secs, subsurf=2)
    S.apply_mods(fair)
    fair.data.materials.append(M['paint'])
    parts.append(fair)
    parts.append(box('Wind', (0.36, 0, 1.03), (0.2, 0.2, 0.02), M['glass'], bevel=0.008, rot=(0, math.radians(30), 0)))
    parts.append(box('Seat', (-0.38, 0, 0.96), (0.34, 0.2, 0.04), M['seat'], bevel=0.02))
    parts.append(sph('Head', (0.6, 0, 0.78), 0.06, M['lamp'], scale=(0.5, 1.6, 0.8)))
    parts += bars((0.42, 0.88), M, width=0.42, rise=-0.04, back=0.1)
    parts.append(box('Tail', (-0.94, 0, 0.82), (0.04, 0.14, 0.04), M['tail']))
    for s in (-1, 1):
        parts += exhaust((-0.1 + s * 0.0, 0.3), (-0.82, 0.62), 0.04, M, y=s * 0.12 if False else 0.11 * s + 0.0, upturn=0.12)
    for k in range(3):
        parts.append(box(f'Vent{k}', (0.16 - k * 0.07, 0.15, 0.62), (0.05, 0.02, 0.14), M['dark'], rot=(0, 0, 0.3)))
        parts.append(box(f'VentB{k}', (0.16 - k * 0.07, -0.15, 0.62), (0.05, 0.02, 0.14), M['dark'], rot=(0, 0, -0.3)))
    return parts


def chopper(M):
    parts = wheel('Rw', -0.62, 0.3, 0.13, M, spokes=36, disc=False, rim='chrome') + wheel('Fw', 1.0, 0.3, 0.035, M, spokes=36, disc=False, rim='chrome')
    # long raked front end
    parts += fork((0.34, 0, 0.98), (1.0, 0, 0.3), M, gap=0.06, r=0.014, boot=False)
    parts.append(tube('Neck', [(0.3, 0, 0.7), (0.34, 0, 1.0)], 0.032, M['chrome'], smooth=False))
    parts.append(tube('Spine', [(0.3, 0, 0.72), (-0.1, 0, 0.62), (-0.5, 0, 0.5)], 0.03, M['gold']))
    parts.append(tube('Down', [(0.28, 0, 0.66), (0.14, 0, 0.36), (-0.1, 0, 0.3), (-0.36, 0, 0.36)], 0.03, M['gold']))
    parts += swingarm((-0.3, 0.34), (-0.62, 0.3), M, 0.13, 0.025)
    parts += engine(0.0, 0.42, M, w=0.34, h=0.36, d=0.42)
    parts.append(sph('Tank', (0.14, 0, 0.78), 0.5, M['paint'], scale=(0.3, 0.19, 0.14)))
    parts.append(box('Seat', (-0.22, 0, 0.66), (0.28, 0.24, 0.06), M['seat'], bevel=0.03, rot=(0, math.radians(-4), 0)))
    parts.append(sph('RFend', (-0.62, 0, 0.5), 0.5, M['paint'], scale=(0.42, 0.18, 0.1)))
    parts += bars((0.34, 1.0), M, width=0.5, rise=0.0, back=0.1, ape=0.34)
    parts.append(sph('Head', (0.5, 0, 0.98), 0.08, M['lamp']))
    parts += exhaust((0.1, 0.3), (-0.95, 0.32), 0.04, M, y=0.19)
    parts += exhaust((0.1, 0.3), (-0.95, 0.32), 0.04, M, y=-0.19)
    return parts


LV = {
    1: (moped, '#7d8870', True),
    2: (scooter, '#2f6fe0', False),
    3: (road, '#d01f1f', False),
    4: (super_, '#0d1018', False),
    5: (chopper, 'gold', False),
}


def make(fam, lv):
    fn, col, rust = LV[lv]
    M = mats(lv, col, rust)
    if lv == 1:
        S.add_grunge(M['metal'], amount=0.6, dirt='#7a3f1c', scale=25, seed=3)
    parts = fn(M)
    parts = convert_curves(parts)
    cfg = dict(scale=2.2, aim=(0, 0, 0.45), cam=(2.3, -2.9, 0.85), target=(0.05, 0, 0.45), lens=55, fill=0.8, fill_y=0.72, floor=0.0, offset=(0, -0.01))
    return parts, cfg
