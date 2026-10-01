"""Gadgets: phone, console, headphones, music, tablet, smartwatch, tv, gaming-pc. Product shots, all in code."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
import studio as S
import tex
from kit import *

WORLD = 0.35


def screen_mat(path, strength=1.0, rough=0.08, tint=None):
    m = S.principled('Screen', '#000000', rough=rough, spec=0.8)
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(path)
    S.link(m, t.outputs['Color'], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = strength
    return m


def plane(name, loc, size, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc)
    o = bpy.context.object; o.name = name; o.scale = (size[0], size[1], 1); o.rotation_euler = rot
    o.data.materials.append(mat)
    return o


def M0(col, rough=0.35, metal=0.0, coat=0.0):
    return S.principled('M', col, rough=rough, metal=metal, coat=coat)


def pal(lv):
    return {
        'body': ['#8d8f93', '#3b82f6', '#e8eaed', '#14161a', 'gold'][lv - 1],
    }


def bodymat(lv, base=None, rust=True):
    cols = ['#9a9890', '#2f6fe0', '#f1f2f4', '#101216', 'gold']
    col = base or cols[lv - 1]
    if col == 'gold':
        return S.principled('Body', (*S.srgb((1.0, 0.78, 0.36)), 1), rough=0.22, metal=1.0, coat=0.8, coat_rough=0.04)
    m = S.principled('Body', col, rough=0.4 if lv > 1 else 0.6, metal=0.0 if lv < 4 else 0.3, coat=0.5 if lv > 1 else 0.0, coat_rough=0.06)
    if lv == 1 and rust:
        S.add_grunge(m, amount=0.6, dirt='#5a5348', scale=18, rough_add=0.3, seed=2.0)
    return m


def rbox(name, c, size, mat, r=0.01, rot=(0, 0, 0)):
    return box(name, c, size, mat, bevel=r, seg=4, rot=rot)


def button_grid(parts, mat, x0, y0, z, nx, ny, dx, dy, r, h=0.003):
    for i in range(nx):
        for j in range(ny):
            parts.append(cyl('Btn', (x0 + i * dx, y0 + j * dy, z), r, h, 'Z', mat=mat, bevel=h * 0.3, verts=16))


# =========================================================== phone
def place(parts, loc=(0, 0, 0), rot=None):
    """Move/rotate a built group as one: rot is a 3x3 matrix (or None)."""
    T = Matrix.Translation(Vector(loc))
    R = rot.to_4x4() if rot is not None else Matrix.Identity(4)
    for o in parts:
        o.matrix_basis = T @ R @ o.matrix_basis
    return parts


def RX(a): return Matrix.Rotation(a, 3, 'X')
def RY(a): return Matrix.Rotation(a, 3, 'Y')
def RZ(a): return Matrix.Rotation(a, 3, 'Z')


def phone(lv):
    P = []
    dark = M0('#0c0d10', 0.4, 0.2)
    cfg = dict(scale=0.4, aim=(0, 0, 0.06), cam=(0.5, -0.6, 0.38), target=(0, 0, 0.06))
    if lv == 1:
        # THE phone (one item, Harry P103: "just like an iPhone, don't call it that"): dark frame,
        # edge-to-edge screen, a pill cut-out at the top, a grid of app tiles, a home bar. No logo.
        W, Hh, T = 0.075, 0.158, 0.0085
        frame = S.principled('Frame', '#1b1e24', rough=0.28, metal=0.7, coat=0.4, coat_rough=0.05)
        G = [rbox('Slab', (0, 0, 0), (W, Hh, T), frame, 0.0135),
             plane('Scr', (0, 0, T / 2 + 0.0004), (W - 0.0034, Hh - 0.0034), screen_mat(tex.phone_screen('one', 'phone-one'), 1.0)),
             rbox('Isl', (0, Hh / 2 - 0.012, T / 2 + 0.0008), (0.0215, 0.0062, 0.0006), dark, 0.0028)]
        for yy in (0.022, 0.0, -0.03):
            G.append(rbox('SB', (W / 2 + 0.0008, yy, 0.0), (0.0016, 0.018, 0.0025), frame, 0.0006))
        th = math.radians(62)
        place(G, (0.0, 0.0, Hh / 2 * math.sin(th) + 0.004), RX(th))
        P += G
        cfg = dict(scale=0.4, aim=(0, 0, 0.07), cam=(0.5, -0.6, 0.38), target=(0, 0, 0.07))
    elif lv == 2:
        body = S.principled('Body', '#2f6fe0', rough=0.35, coat=0.6, coat_rough=0.06)
        low = [rbox('Low', (0, 0, 0), (0.1, 0.055, 0.02), body, 0.008),
               plane('KB', (0, 0, 0.0102), (0.088, 0.046), M0('#252b36', 0.4))]
        for r in range(4):
            for c in range(3):
                low.append(rbox('Key', (-0.035 + r * 0.02, -0.016 + c * 0.016, 0.0125), (0.015, 0.012, 0.003), M0('#e5e7eb', 0.4), 0.002))
        place(low, (0, 0, 0.01))
        up = [rbox('Up', (0.05, 0, 0.0), (0.1, 0.055, 0.018), body, 0.008)]
        sc = plane('Scr', (0.05, 0, -0.0092), (0.088, 0.044), screen_mat(tex.phone_screen('flip', 'flip'), 1.0), (math.pi, 0, 0))
        up.append(sc)
        up.append(rbox('Ext', (0.05, 0, 0.0095), (0.05, 0.02, 0.001), dark, 0.0005))
        place(up, (-0.05, 0, 0.0215), RY(math.radians(-112)))
        hing = cyl('Hing', (-0.05, 0, 0.02), 0.009, 0.05, 'Y', mat=body)
        hing.rotation_euler = (math.pi / 2, 0, 0)
        P += low + up + [hing]
        place(P, (0, 0, 0), RZ(math.radians(-25)))
        cfg = dict(scale=0.4, aim=(0, 0, 0.05), cam=(0.45, -0.55, 0.32), target=(0, 0, 0.05))
    else:
        W, Hh, T = (0.072, 0.152, 0.008) if lv == 3 else (0.076, 0.162, 0.0085)
        key = {3: 'sm', 4: 'pro', 5: 'gold'}[lv]
        body = bodymat(lv)
        if lv == 3:
            body = S.principled('Body', '#e8e9ec', rough=0.35, coat=0.8, coat_rough=0.05)
        G = [rbox('Slab', (0, 0, 0), (W, Hh, T), body, 0.012 if lv == 3 else 0.014),
             plane('Scr', (0, 0, T / 2 + 0.0004), (W - 0.0045, Hh - 0.0045), screen_mat(tex.phone_screen(key, 'ph' + key), 1.0)),
             rbox('Isl', (0, Hh / 2 - 0.014, T / 2 + 0.0008), (0.02 if lv == 3 else 0.027, 0.006 if lv == 3 else 0.008, 0.0006), dark, 0.0025)]
        for yy in (0.02, 0.0, -0.03):
            G.append(rbox('SB', (W / 2 + 0.0008, yy, 0.0), (0.0016, 0.018, 0.0025), body, 0.0006))
        th = math.radians(62)
        place(G, (-0.0, 0.0, Hh / 2 * math.sin(th) + 0.004), RX(th))
        P += G
        if lv >= 4:
            B = [rbox('Back', (0, 0, 0), (W, Hh, T), bodymat(lv), 0.014)]
            bump = rbox('Bump', (-0.017, Hh / 2 - 0.035, T / 2 + 0.002), (0.042, 0.042, 0.005), M0('#1d2026' if lv == 4 else '#f4d27a', 0.2, 0.4), 0.009)
            B.append(bump)
            for k, (dx, dy) in enumerate(((-0.0095, 0.0095), (0.0095, 0.0095), (0.0, -0.0095))):
                B.append(cyl(f'Lens{k}', (-0.017 + dx, Hh / 2 - 0.035 + dy, T / 2 + 0.0045), 0.0083, 0.003, 'Z', mat=M0('#05070b', 0.05, 0.3), bevel=0.001))
                B.append(torus(f'LR{k}', (-0.017 + dx, Hh / 2 - 0.035 + dy, T / 2 + 0.0055), 0.0083, 0.0014, 'Z', M0('#cfd2d6', 0.2, 1.0), 24, 8))
            place(B, (0.115, -0.035, T / 2), RZ(math.radians(18)))
            P += B
            cfg = dict(scale=0.45, aim=(0.05, 0, 0.06), cam=(0.55, -0.7, 0.4), target=(0.05, 0, 0.055))
        else:
            cfg = dict(scale=0.4, aim=(0, 0, 0.07), cam=(0.5, -0.6, 0.38), target=(0, 0, 0.07))
    return P, (0, 0, 0), cfg


# =========================================================== console
def gamepad(loc, rot, col, accent):
    P = []
    m = S.principled('Pad', col, rough=0.35, coat=0.4) if col != 'gold' else S.gold('PadG', 0.2)
    dk = M0('#1a1c20', 0.5)
    P.append(sph('Pad', (0, 0, 0.014), 0.5, m, scale=(0.15, 0.095, 0.03)))
    for sgn in (-1, 1):
        g = sph('Grip', (-0.035, sgn * 0.043, 0.012), 0.5, m, scale=(0.085, 0.05, 0.034))
        g.rotation_euler = (0, 0, sgn * 0.35)
        P.append(g)
    P.append(cyl('Stk1', (-0.03, 0.026, 0.03), 0.012, 0.012, 'Z', mat=dk, bevel=0.003))
    P.append(cyl('Stk2', (-0.03, -0.012, 0.03), 0.012, 0.012, 'Z', mat=dk, bevel=0.003))
    P.append(box('DpadH', (0.025, 0.0, 0.0285), (0.022, 0.007, 0.004), dk, bevel=0.001))
    P.append(box('DpadV', (0.025, 0.0, 0.0285), (0.007, 0.022, 0.004), dk, bevel=0.001))
    for dx, dy, c in ((0.045, 0.014, '#e53935'), (0.058, 0.0, '#43a047'), (0.058, 0.028, '#1e88e5'), (0.071, 0.014, '#fdd835')):
        P.append(cyl('B', (dx - 0.0, dy - 0.0, 0.03), 0.007, 0.004, 'Z', mat=M0(c if accent is None else accent, 0.3, 0.0), bevel=0.001, verts=16))
    place(P, loc, RZ(rot))
    return P


def console(lv):
    P = []
    body = bodymat(lv)
    dark = M0('#0c0d10', 0.4, 0.2)
    if lv == 1:
        # retro handheld
        P.append(rbox('Hh', (0, 0, 0.0), (0.09, 0.15, 0.03), body, 0.012))
        P.append(rbox('Face', (0, 0.015, 0.0152), (0.075, 0.075, 0.002), M0('#4b4f63', 0.5), 0.004))
        P.append(rbox('Scr', (0, 0.025, 0.0165), (0.05, 0.045, 0.002), M0('#9bb08a', 0.3), 0.002))
        for r in range(3):
            P.append(rbox('Px', (-0.015 + r * 0.015, 0.025, 0.0176), (0.008, 0.008, 0.001), M0('#2b3a26', 0.4), 0.0005))
        P.append(box('DH', (-0.025, -0.04, 0.017), (0.022, 0.007, 0.004), dark, bevel=0.001))
        P.append(box('DV', (-0.025, -0.04, 0.017), (0.007, 0.022, 0.004), dark, bevel=0.001))
        P.append(cyl('A', (0.03, -0.035, 0.017), 0.008, 0.004, 'Z', mat=M0('#9b2d5c', 0.3), verts=16))
        P.append(cyl('B', (0.018, -0.047, 0.017), 0.008, 0.004, 'Z', mat=M0('#9b2d5c', 0.3), verts=16))
        for k in range(4):
            P.append(box('Spk', (0.035 + k * 0.0, -0.06 - 0 + k * 0.0, 0.0), (0.0, 0.0, 0.0), dark)) if False else None
        place(P, (0, 0, 0.015), RZ(-0.5))
        rot = (0, 0, 0)
        cfg = dict(scale=0.4, aim=(0, 0, 0.02), cam=(0.35, -0.4, 0.3), target=(0, 0, 0.02))
    else:
        if lv == 2:
            P.append(rbox('Con', (0, 0, 0.03), (0.30, 0.24, 0.06), body, 0.01))
            P.append(rbox('Slot', (0.0, -0.121, 0.04), (0.12, 0.003, 0.008), dark, 0.001))
            P.append(cyl('Pwr', (0.1, -0.121, 0.03), 0.009, 0.004, 'Y', mat=M0('#cf2e2e', 0.4)))
            for k in range(3): P.append(box('Vent', (-0.12 + k * 0.012, 0.0, 0.061), (0.004, 0.16, 0.002), dark))
            P += gamepad((0.06, -0.26, 0.0), 0.2, '#8c8e93', None)
            tubes = tube('Cord', [(0.06, -0.20, 0.01), (0.06, -0.15, 0.003), (0.09, -0.125, 0.025)], 0.003, dark)
            P.append(tubes)
            cfg = dict(scale=0.55, aim=(0, -0.05, 0.03), cam=(0.55, -0.75, 0.42), target=(0, -0.05, 0.03))
        elif lv == 3:
            P.append(rbox('Con', (0, 0, 0.12), (0.30, 0.1, 0.24), body, 0.02, (0, 0, 0)))
            P.append(rbox('Slit', (0.0, -0.052, 0.20), (0.22, 0.003, 0.004), dark, 0.001))
            P.append(rbox('Glow', (0.0, -0.052, 0.04), (0.2, 0.003, 0.004), M0('#4a9dff', 0.2), 0.001))
            P.append(rbox('Foot', (0, 0, 0.005), (0.32, 0.14, 0.01), dark, 0.004))
            P += gamepad((0.26, -0.1, 0.0), -0.3, '#f4f5f7', None)
            cfg = dict(scale=0.6, aim=(0.05, -0.05, 0.1), cam=(0.7, -0.85, 0.42), target=(0.05, -0.05, 0.1), expo=-0.95)
        elif lv == 4:
            P.append(rbox('Con', (0, 0, 0.065), (0.40, 0.28, 0.13), body, 0.02))
            P.append(rbox('Strip', (0.0, -0.141, 0.065), (0.34, 0.003, 0.01), S.principled('Led', '#ff3b30', rough=0.2, emission='#ff3b30', emission_strength=4.0), 0.002))
            P.append(rbox('Disc', (0.0, -0.141, 0.1), (0.2, 0.003, 0.012), dark, 0.002))
            for k in range(12): P.append(box('Vent', (-0.15 + k * 0.012, 0.0, 0.131), (0.005, 0.2, 0.002), M0('#2c2f36', 0.3)))
            P += gamepad((-0.1, -0.30, 0.0), 0.15, '#1a1c22', None)
            P += gamepad((0.12, -0.30, 0.0), -0.15, '#1a1c22', None)
            cfg = dict(scale=0.75, aim=(0, -0.08, 0.06), cam=(0.8, -1.0, 0.5), target=(0, -0.08, 0.06))
        else:
            P.append(rbox('Plat', (0, -0.05, 0.015), (0.62, 0.50, 0.03), M0('#2a2430', 0.35, 0.0, 0.4), 0.01))
            P.append(rbox('Con', (0, 0, 0.1), (0.40, 0.28, 0.13), body, 0.02))
            P.append(rbox('Strip', (0.0, -0.141, 0.1), (0.34, 0.003, 0.01), S.principled('Led', '#fff1b0', rough=0.2, emission='#ffd36b', emission_strength=4.0), 0.002))
            P.append(rbox('Disc', (0.0, -0.141, 0.135), (0.2, 0.003, 0.012), dark, 0.002))
            for k in range(12): P.append(box('Vent', (-0.15 + k * 0.012, 0.0, 0.166), (0.005, 0.2, 0.002), M0('#7a5a1a', 0.3, 0.8)))
            P += gamepad((0.0, -0.26, 0.03), 0.0, 'gold', '#fff3c4')
            cfg = dict(scale=0.75, aim=(0, -0.1, 0.08), cam=(0.8, -1.0, 0.5), target=(0, -0.1, 0.08))
        rot = (0, 0, 0)
    return P, rot, cfg


# =========================================================== headphones
def headphones(lv):
    P = []
    dark = M0('#101216', 0.4, 0.2)
    if lv == 1:
        wh = M0('#f2f3f5', 0.35, 0.0, 0.3)
        for s in (-1, 1):
            P.append(sph(f'Bud{s}', (0, s * 0.045, 0.012), 0.012, wh, scale=(1, 0.9, 1.1)))
            P.append(cyl(f'Tip{s}', (0, s * 0.045 + s * -0.011, 0.012), 0.008, 0.006, 'Y', mat=M0('#26282c', 0.7)))
            P.append(tube(f'Cab{s}', [(0.003, s * 0.045, 0.004), (0.05, s * 0.07, 0.002), (0.1, s * 0.03, 0.002), (0.14, 0.0, 0.002)], 0.0016, wh))
        P.append(tube('CabM', [(0.14, 0.0, 0.002), (0.2, -0.04, 0.002), (0.26, -0.01, 0.002), (0.3, 0.05, 0.002)], 0.0016, wh))
        P.append(box('Plug', (0.31, 0.055, 0.004), (0.014, 0.004, 0.004), M0('#26282c', 0.4)))
        P.append(cyl('PlugM', (0.325, 0.06, 0.004), 0.0035, 0.03, 'X', mat=M0('#c0c3c8', 0.2, 1.0)))
        cfg = dict(scale=0.4, aim=(0.14, 0, 0.01), cam=(0.5, -0.45, 0.28), target=(0.15, 0.0, 0.0))
        return P, (0, 0, 0), cfg
    spec = {2: ('#3b3f46', 0.075, 0.016, False, '#d0d3d8', 'wired'), 3: ('#c3cde2', 0.07, 0.014, False, '#2f6fe0', 'wl'), 4: ('#14161a', 0.085, 0.03, True, '#d01f1f', 'studio'), 5: ('gold', 0.085, 0.03, True, '#f4d27a', 'gold')}[lv]
    col, cr_, cd, big, acc, kind = spec
    cm = S.gold('Cup', 0.2) if col == 'gold' else M0(col, 0.35, 0.0, 0.5)
    ac = M0(acc, 0.3, 0.8) if lv != 3 else M0(acc, 0.3)
    pad = M0('#1c1b1d' if lv != 3 else '#e6e8ec', 0.65, 0.0, 0.0)
    if lv == 5: pad = M0('#5a1220', 0.5, 0.0, 0.3)
    wid = 0.19
    # headband arc over the top (in the XZ plane, ears on +-Y)
    pts = []
    for k in range(13):
        a = math.pi * k / 12
        pts.append((0.0, math.cos(a) * wid / 2, 0.075 + math.sin(a) * 0.13))
    band = tube('Band', pts, 0.008 if lv < 4 else 0.011, cm if lv != 3 else cm)
    P.append(band)
    if lv >= 4:
        pts2 = [(0, p[1] * 0.5, p[2] + 0.0) for p in pts[3:10]]
        P.append(tube('BandPad', [(0.0, math.cos(math.pi * k / 12) * 0.07, 0.075 + math.sin(math.pi * k / 12) * 0.13 - 0.012) for k in range(3, 10)], 0.012, pad))
    for s in (-1, 1):
        y = s * wid / 2
        P.append(cyl(f'Cup{s}', (0, y + s * cd / 2, 0.075), cr_, cd, 'Y', mat=cm, bevel=0.006, verts=48))
        P.append(cyl(f'Disc{s}', (0, y + s * (cd + 0.001), 0.075), cr_ * 0.62, 0.003, 'Y', mat=ac, bevel=0.001, verts=48))
        P.append(torus(f'Pad{s}', (0, y - s * 0.004, 0.075), cr_ * 0.86, 0.015 if big else 0.012, 'Y', pad, 48, 14))
        P.append(tube(f'Yoke{s}', [(0, y, 0.075 + cr_ * 0.9), (0, y, 0.075 + 0.04), (0, y, 0.075)], 0.004, ac, smooth=False, res=5))
    if lv in (2, 4):
        P.append(tube('Cord', [(0.0, wid / 2 + 0.03, 0.06), (0.05, wid / 2 + 0.07, 0.01), (0.1, 0.03, 0.003), (0.2, -0.04, 0.003)], 0.002, dark))
    if lv == 5:
        for s in (-1, 1):
            for k in range(8):
                a = 2 * math.pi * k / 8
                g = solid_gem(f'G{s}{k}', (math.cos(a) * cr_ * 0.78, s * (wid / 2 + cd + 0.002), 0.075 + math.sin(a) * cr_ * 0.78), 0.0075, S.principled('Dia', '#f4fbff', rough=0.0, spec=1.0, transmission=1.0, ior=2.4), rot=(s * math.pi / 2, 0, 0))
                P.append(g)
            P.append(solid_gem(f'GC{s}', (0, s * (wid / 2 + cd + 0.003), 0.075), 0.017, S.principled('Dia', '#f4fbff', rough=0.0, spec=1.0, transmission=1.0, ior=2.4), rot=(s * math.pi / 2, 0, 0)))
    cfg = dict(scale=0.4, aim=(0, 0, 0.1), cam=(0.5, -0.55, 0.3), target=(0, 0, 0.1))
    if lv == 3: cfg['expo'] = -1.0
    return P, (0, 0, math.radians(-38)), cfg


# =========================================================== music
def music(lv):
    P = []
    dark = M0('#0c0d10', 0.4, 0.2)
    body = bodymat(lv)
    if lv == 1:
        cream = M0('#c9bfa6', 0.55)
        S.add_grunge(cream, amount=0.3, dirt='#8a7a5a', scale=20, rough_add=0.2, seed=1.0)
        G = [rbox('Radio', (0, 0, 0), (0.14, 0.045, 0.085), cream, 0.01)]
        for k in range(7):
            G.append(box('Grille', (-0.032, -0.0232, -0.012 + k * 0.007 - 0.01 + 0.02), (0.05, 0.002, 0.0035), dark, bevel=0.0008))
        G.append(rbox('Dial', (0.035, -0.0235, 0.022), (0.05, 0.002, 0.018), M0('#e9d79a', 0.4), 0.002))
        G.append(box('Needle', (0.04, -0.0255, 0.022), (0.0012, 0.0015, 0.018), M0('#c0392b', 0.3)))
        G.append(cyl('Knob1', (0.045, -0.0245, -0.02), 0.009, 0.01, 'Y', mat=dark, bevel=0.002)); G[-1].rotation_euler = (math.pi / 2, 0, 0)
        G.append(cyl('Knob2', (0.022, -0.0245, -0.02), 0.007, 0.01, 'Y', mat=dark, bevel=0.002)); G[-1].rotation_euler = (math.pi / 2, 0, 0)
        G.append(tube('Ant', [(-0.05, 0.0, 0.043), (-0.09, 0.0, 0.16)], 0.0016, M0('#c7cad0', 0.2, 1.0), smooth=False, res=6))
        G.append(tube('Hand', [(-0.05, 0, 0.043), (-0.045, 0, 0.065), (0.045, 0, 0.065), (0.05, 0, 0.043)], 0.0035, M0('#6b4a2e', 0.5), smooth=False, res=6))
        place(G, (0, 0, 0.0425), RZ(math.radians(-18)))
        P += G
        cfg = dict(scale=0.4, aim=(0, 0, 0.06), cam=(0.38, -0.5, 0.3), target=(0, 0, 0.075))
    elif lv == 2:
        G = [rbox('Body', (0, 0, 0), (0.062, 0.104, 0.011), body, 0.005),
             plane('Scr', (0, 0.025, 0.0058), (0.046, 0.034), screen_mat(tex.phone_screen('flip', 'mp3'), 0.9), (0, 0, 0)),
             cyl('Wheel', (0, -0.02, 0.006), 0.021, 0.001, 'Z', mat=M0('#e8eaed', 0.3), verts=48),
             cyl('Hub', (0, -0.02, 0.0068), 0.007, 0.001, 'Z', mat=M0('#2f6fe0', 0.3), verts=32)]
        th = math.radians(64)
        place(G, (0, 0, 0.052 * math.sin(th) + 0.004), RX(th))
        P += G
        P.append(tube('Cord', [(0.0, 0.03, 0.0), (0.06, 0.07, 0.003), (0.1, 0.03, 0.002), (0.12, -0.02, 0.003)], 0.0015, M0('#f2f3f5', 0.4)))
        for sy in (-0.01, 0.01):
            P.append(sph('Bud', (0.12, sy - 0.02 + 0.0, 0.004), 0.007, M0('#f2f3f5', 0.35)))
        cfg = dict(scale=0.4, aim=(0.03, 0, 0.04), cam=(0.35, -0.45, 0.28), target=(0.03, 0, 0.04))
    elif lv == 3:
        # bluetooth speaker: a fat cylinder with a mesh grille band, control strip on top
        G = [cyl('Spk', (0, 0, 0.055), 0.045, 0.11, 'Z', mat=body, bevel=0.01, verts=64),
             cyl('Mesh', (0, 0, 0.055), 0.0462, 0.07, 'Z', mat=M0('#1a2a50', 0.7, 0.3), verts=64),
             torus('Led', (0, 0, 0.111), 0.036, 0.0014, 'Z', S.principled('Led', '#6fb7ff', rough=0.2, emission='#4aa3ff', emission_strength=5.0), 48, 8),
             cyl('Top', (0, 0, 0.1125), 0.044, 0.003, 'Z', mat=M0('#0f1115', 0.4), verts=64)]
        for k in range(3):
            a = 2 * math.pi * k / 3 + 0.5
            G.append(cyl(f'Bt{k}', (math.cos(a) * 0.024, math.sin(a) * 0.024, 0.115), 0.006, 0.003, 'Z', mat=M0('#e8eaed', 0.3), verts=24))
        for r in range(7):
            for c in range(24):
                a = 2 * math.pi * c / 24 + (r % 2) * 0.13
                G.append(sph('Dot', (math.cos(a) * 0.0466, math.sin(a) * 0.0466, 0.025 + r * 0.0095), 0.0011, M0('#05070d', 0.5)))
        place(G, (0, 0, 0), RZ(math.radians(-30)))
        P += G
        cfg = dict(scale=0.4, aim=(0, 0, 0.05), cam=(0.3, -0.4, 0.2), target=(0, 0, 0.055))
    elif lv == 4:
        # hi-fi stack: amp, CD player, tuner on a rack with a pair of speakers
        sil = M0('#c9ccd2', 0.28, 1.0)
        for i, (nm, kn) in enumerate((('Amp', 3), ('CD', 0), ('Tuner', 2))):
            z = 0.04 + i * 0.075
            P.append(rbox(nm, (0, 0, z), (0.34, 0.26, 0.06), M0('#15171b', 0.4, 0.3), 0.004))
            P.append(rbox(nm + 'F', (0, -0.1305, z), (0.34, 0.004, 0.058), sil, 0.001))
            P.append(rbox(nm + 'D', (-0.05, -0.1335, z + 0.005), (0.11, 0.002, 0.018), S.principled('Disp', '#0a1a12', rough=0.2, emission='#35ff9a', emission_strength=1.6), 0.0015))
            for k in range(kn):
                P.append(cyl('Kn', (0.07 + k * 0.035, -0.135, z), 0.0095, 0.012, 'Y', mat=M0('#101216', 0.3, 0.6), bevel=0.002)); P[-1].rotation_euler = (math.pi / 2, 0, 0)
            if nm == 'CD':
                P.append(rbox('Tray', (0.04, -0.1335, z - 0.006), (0.12, 0.002, 0.008), dark, 0.001))
        for sx in (-1, 1):
            P.append(rbox('Spk', (sx * 0.3, -0.02, 0.15), (0.16, 0.18, 0.3), M0('#2a1c14', 0.45, 0.0, 0.3), 0.01))
            P.append(cyl('Wf', (sx * 0.3, -0.113, 0.11), 0.05, 0.012, 'Y', mat=M0('#0b0c0f', 0.5), bevel=0.003)); P[-1].rotation_euler = (math.pi / 2, 0, 0)
            P.append(cyl('Tw', (sx * 0.3, -0.113, 0.22), 0.022, 0.01, 'Y', mat=M0('#c9ccd2', 0.3, 1.0), bevel=0.002)); P[-1].rotation_euler = (math.pi / 2, 0, 0)
        place(P, (0, 0, 0), RZ(math.radians(-18)))
        cfg = dict(scale=0.9, aim=(0, 0, 0.14), cam=(0.9, -1.2, 0.55), target=(0, -0.03, 0.14))
    else:
        # home studio: desk, keyboard, mixer, two monitors, a condenser mic with a pop filter
        wood = M0('#3a2a1c', 0.5, 0.0, 0.3)
        P.append(rbox('Desk', (0, 0, 0.36), (1.2, 0.6, 0.04), wood, 0.006))
        for sx in (-1, 1):
            P.append(rbox('Leg', (sx * 0.55, 0, 0.17), (0.04, 0.5, 0.34), M0('#16171b', 0.4, 0.6), 0.004))
        P.append(rbox('Board', (0.0, -0.02, 0.405), (0.5, 0.28, 0.04), M0('#202228', 0.35, 0.5), 0.006))
        for r in range(4):
            for c in range(8):
                P.append(cyl('Kn', (-0.2 + c * 0.057, -0.1 + r * 0.04 - 0.02, 0.427), 0.008, 0.012, 'Z', mat=M0(['#d01f1f', '#2f6fe0', '#f5c518', '#e8eaed'][r % 4], 0.3), bevel=0.002))
        for c in range(8):
            P.append(rbox('Fader', (-0.2 + c * 0.057, -0.095, 0.428), (0.006, 0.05, 0.004), M0('#0b0c0f', 0.4), 0.001))
            P.append(rbox('Cap', (-0.2 + c * 0.057, -0.105 + 0.02 * ((c * 7) % 3), 0.432), (0.014, 0.012, 0.008), M0('#f2f3f5', 0.3), 0.002))
        P.append(rbox('Keys', (0.0, -0.3, 0.395), (0.7, 0.14, 0.03), M0('#111216', 0.4), 0.005))
        for k in range(21):
            P.append(rbox('Key', (-0.33 + k * 0.033, -0.318, 0.415), (0.029, 0.1, 0.012), M0('#f4f2ec', 0.4), 0.0015))
        for k in (0, 1, 3, 4, 5, 7, 8, 10, 11, 12, 14, 15, 17, 18, 19):
            P.append(rbox('BKey', (-0.33 + k * 0.033 + 0.0165, -0.285, 0.428), (0.017, 0.06, 0.012), M0('#0b0c0f', 0.4), 0.001))
        for sx in (-1, 1):
            P.append(rbox('Mon', (sx * 0.5, 0.12, 0.52), (0.18, 0.2, 0.28), M0('#14161a', 0.4, 0.2), 0.01))
            P.append(cyl('Wf', (sx * 0.5, 0.0185, 0.49), 0.062, 0.012, 'Y', mat=M0('#0b0c0f', 0.5), bevel=0.003)); P[-1].rotation_euler = (math.pi / 2, 0, 0)
            P.append(cyl('Tw', (sx * 0.5, 0.0185, 0.6), 0.022, 0.01, 'Y', mat=M0('#c9ccd2', 0.3, 1.0), bevel=0.002)); P[-1].rotation_euler = (math.pi / 2, 0, 0)
        g = metalmat_gold()
        P.append(tube('MicArm', [(0.45, 0.3, 0.38), (0.45, 0.3, 0.62), (0.15, 0.22, 0.78), (0.0, 0.05, 0.66)], 0.008, M0('#16171b', 0.4, 0.6), smooth=True))
        P.append(cyl('Mic', (0.0, 0.0, 0.62), 0.024, 0.14, 'Z', mat=g, bevel=0.005, verts=32))
        P.append(cyl('Pop', (0.0, -0.05, 0.62), 0.07, 0.003, 'Y', mat=S.principled('Pop', '#101216', rough=0.7), verts=48)); P[-1].rotation_euler = (math.pi / 2, 0, 0)
        P.append(torus('PopR', (0.0, -0.05, 0.62), 0.07, 0.003, 'Y', g, 40, 8))
        place(P, (0, 0, 0), RZ(math.radians(-26)))
        cfg = dict(scale=1.4, aim=(0, 0, 0.45), cam=(1.4, -1.9, 1.05), target=(0, 0, 0.45))
    return P, (0, 0, 0), cfg


def metalmat_gold():
    return S.principled('Gold', (*S.srgb((1.0, 0.78, 0.36)), 1), rough=0.2, metal=1.0, coat=0.5, coat_rough=0.05)


# =========================================================== tablet
def tablet(lv):
    P = []
    dark = M0('#0c0d10', 0.4, 0.2)
    body = bodymat(lv)
    spec = {1: (0.16, 0.22, 0.012, 0.022, 'sm'), 2: (0.17, 0.24, 0.0085, 0.016, 'sm'), 3: (0.3, 0.2, 0.0075, 0.012, 'pro'), 4: (0.2, 0.28, 0.006, 0.009, 'pro'), 5: (0.2, 0.28, 0.006, 0.009, 'gold')}[lv]
    W, Hh, T, bz, key = spec
    if lv == 1:
        body = M0('#7b7e84', 0.55)
        S.add_grunge(body, amount=0.5, dirt='#3a3a3f', scale=14, rough_add=0.3, seed=3.0)
    elif lv == 3:
        body = S.principled('Body', '#e8e9ec', rough=0.35, coat=0.8, coat_rough=0.05)
    G = [rbox('Slab', (0, 0, 0), (W, Hh, T), body, 0.008),
         rbox('Bezel', (0, 0, T / 2 + 0.0002), (W - 0.004, Hh - 0.004, 0.0008), dark, 0.003),
         plane('Scr', (0, 0, T / 2 + 0.0008), (W - bz * 2, Hh - bz * 2), screen_mat(tex.phone_screen({1: 'sm', 2: 'sm', 3: 'pro', 4: 'pro', 5: 'gold'}[lv], 'tb' + str(lv)), 1.0 if lv > 1 else 0.55))]
    if lv == 1:
        # scuffs + a cracked corner
        G.append(plane('Crack', (W / 2 - 0.035, Hh / 2 - 0.035, T / 2 + 0.0012), (0.05, 0.002), M0('#d8d8e0', 0.2, 0.5), (0, 0, 0.8)))
        G.append(plane('Crack2', (W / 2 - 0.04, Hh / 2 - 0.028, T / 2 + 0.0012), (0.035, 0.002), M0('#d8d8e0', 0.2, 0.5), (0, 0, 2.2)))
    th = math.radians(66)
    if lv == 3:
        # landscape
        place(G, (0, 0, 0), RZ(math.pi / 2))
        W, Hh = Hh, W
    # kickstand
    place(G, (0, 0, Hh / 2 * math.sin(th) + 0.004), RX(th))
    P += G
    P.append(rbox('Prop', (0, Hh / 2 * 0.9 * math.cos(th) + 0.02, 0.07), (0.05, 0.004, 0.14), body, 0.002, (math.radians(-12), 0, 0)))
    if lv >= 4:
        gold = lv == 5
        pm = metalmat_gold() if gold else M0('#1d2026', 0.3, 0.5)
        pen = [cyl('Pen', (0, 0, 0), 0.0034, 0.16, 'Y', mat=pm, bevel=0.001, verts=24), cyl('Tip', (0, -0.087, 0), 0.0034, 0.014, 'Y', mat=M0('#e8eaed', 0.3), r2=0.0008, verts=24)]
        pen[0].rotation_euler = (math.pi / 2, 0, 0); pen[1].rotation_euler = (math.pi / 2, 0, 0)
        for o in pen:
            o.location = Vector(o.location)
        place(pen, (0.15, -0.12, 0.0034), RZ(math.radians(24)))
        P += pen
    cfg = dict(scale=0.5, aim=(0, 0, 0.1), cam=(0.5, -0.65, 0.4), target=(0.02, 0, 0.1))
    return P, (0, 0, 0), cfg


# =========================================================== smartwatch
def smartwatch(lv):
    P = []
    dark = M0('#0c0d10', 0.4, 0.2)
    strapcol = {1: '#16171b', 2: '#2f6fe0', 3: '#e8eaed', 4: '#ff7a1a', 5: None}[lv]
    cm = {1: M0('#6a6e75', 0.45), 2: M0('#1a1c20', 0.35), 3: metal_s('silver'), 4: M0('#14161a', 0.3, 0.6), 5: metal_s('titan')}[lv]
    tk = {1: 'digital', 2: 'band', 3: 'face', 4: 'rings', 5: 'gold'}[lv]
    W, Hh, T = {1: (0.042, 0.048, 0.013), 2: (0.022, 0.034, 0.010), 3: (0.040, 0.046, 0.011), 4: (0.046, 0.054, 0.012), 5: (0.042, 0.049, 0.010)}[lv]
    G = [rbox('Case', (0, 0, 0), (W, Hh, T), cm, 0.008 if lv != 1 else 0.004),
         rbox('Glass', (0, 0, T / 2 + 0.0002), (W - 0.003, Hh - 0.003, 0.0008), dark, 0.004),
         plane('Scr', (0, 0, T / 2 + 0.0008), (W - 0.007, Hh - 0.007), screen_mat(tex.wearable(tk, 'sw' + str(lv)), 1.2 if lv != 1 else 0.7))]
    if lv in (3, 4, 5):
        G.append(cyl('Crown', (W / 2 + 0.002, 0.008, 0.0), 0.0035, 0.005, 'X', mat=cm if lv != 4 else M0('#ff7a1a', 0.3), bevel=0.0007, verts=16))
    if lv == 1:
        for k in range(2):
            G.append(box('Btn', (W / 2 + 0.001, -0.012 + k * 0.024, 0.0), (0.003, 0.007, 0.005), M0('#33363c', 0.4)))
    # strap loop below, axis along X (so the strap runs along Y)
    Rl = 0.03
    if lv == 5:
        sm = metal_s('titan')
        Lp = 2 * math.pi * Rl / 26
        for k in range(26):
            ang = 2 * math.pi * (k + 0.5) / 26
            if ang < 0.55 or ang > 2 * math.pi - 0.55: continue
            cy = math.sin(ang) * Rl; cz = -Rl + math.cos(ang) * Rl
            lk = box('Lk', (0, 0, 0), (0.0205, Lp * 0.96, 0.0038), sm, bevel=0.0009)
            lk.matrix_basis = Matrix.Translation((0, cy, cz - T / 2)) @ RX(-ang).to_4x4() @ lk.matrix_basis
            G.append(lk)
    else:
        sm2 = M0(strapcol, 0.5, 0.0, 0.2)
        st = torus('Strap', (0, 0, -Rl - T / 2), Rl, 0.0023, 'X', sm2, 64, 10)
        st.scale = (1, 1, 7.5 if lv != 2 else 10.0)
        G.append(st)
    place(G, (0, 0, 0), RZ(math.radians(-62.6)) @ RY(math.radians(65)) @ RZ(math.radians(90)))
    P += G
    cfg = dict(scale=0.3, aim=(0, 0, 0.03), cam=(0.22, -0.36, 0.22), target=(0, 0, 0.03), lens=70)
    return P, (0, 0, 0), cfg


def metal_s(kind):
    return {'silver': S.principled('Ms', (*S.srgb((0.92, 0.93, 0.95)), 1), rough=0.15, metal=1.0, coat=0.3),
            'titan': S.principled('Mt', (*S.srgb((0.55, 0.57, 0.6)), 1), rough=0.3, metal=1.0)}[kind]


# =========================================================== tv
def tv(lv):
    P = []
    dark = M0('#0c0d10', 0.35, 0.2)
    img = tex.tv_screen('tv' + str(lv), mood={1: 'day', 2: 'day', 3: 'smart', 4: 'day', 5: 'night'}[lv])
    scr = lambda w, h, loc, rot=(0, 0, 0): plane('Scr', loc, (w, h), screen_mat(img, 1.1), rot)
    if lv == 1:
        wood = M0('#6b4a2e', 0.5, 0.0, 0.2)
        S.add_grunge(wood, amount=0.4, dirt='#3a2a1c', scale=18, rough_add=0.2, seed=5.0)
        P.append(rbox('Box', (0, 0.0, 0.25), (0.52, 0.44, 0.46), wood, 0.03))
        P.append(rbox('Face', (0, -0.222, 0.27), (0.46, 0.012, 0.38), M0('#2a2a2e', 0.5), 0.01))
        P.append(sph('Tube', (-0.04, -0.226, 0.285), 0.5, S.principled('CRT', '#000000', rough=0.05, spec=0.9, emission='#ffffff', emission_strength=0.0), scale=(0.34, 0.03, 0.27)))
        P.append(scr(0.30, 0.235, (-0.04, -0.248, 0.285), (math.pi / 2, 0, 0)))
        for k in range(3):
            P.append(cyl('Kn', (0.195, -0.226, 0.36 - k * 0.07), 0.016, 0.014, 'Y', mat=M0('#c9c6bd', 0.4, 0.3), bevel=0.003)); P[-1].rotation_euler = (math.pi / 2, 0, 0)
        for k in range(8):
            P.append(box('Slot', (0.195, -0.229, 0.14 + k * 0.006), (0.05, 0.004, 0.0025), dark))
        P.append(tube('Ant1', [(0.0, 0.0, 0.485), (-0.12, 0.0, 0.7)], 0.004, M0('#c7cad0', 0.2, 1.0), smooth=False, res=6))
        P.append(tube('Ant2', [(0.0, 0.0, 0.485), (0.14, 0.02, 0.68)], 0.004, M0('#c7cad0', 0.2, 1.0), smooth=False, res=6))
        P.append(rbox('Base', (0, 0, 0.012), (0.48, 0.4, 0.024), dark, 0.004))
        place(P, (0, 0, 0), RZ(math.radians(-22)))
        cfg = dict(scale=0.9, aim=(0, 0, 0.3), cam=(0.9, -1.2, 0.6), target=(0, 0, 0.32))
    elif lv in (2, 3):
        W, Hh = (0.9, 0.52) if lv == 2 else (1.3, 0.74)
        bz = 0.02 if lv == 2 else 0.009
        z0 = 0.17 + Hh / 2
        P.append(rbox('Panel', (0, 0, z0), (W, 0.035, Hh), dark, 0.008))
        P.append(scr(W - bz * 2, Hh - bz * 2, (0, -0.0182, z0), (math.pi / 2, 0, 0)))
        if lv == 2:
            P.append(rbox('Foot', (0, 0.02, 0.01), (0.46, 0.2, 0.02), M0('#16171b', 0.35, 0.6), 0.005))
            P.append(rbox('Neck', (0, 0.02, 0.1), (0.08, 0.04, 0.16), M0('#16171b', 0.35, 0.6), 0.005))
        else:
            for sx in (-1, 1):
                P.append(rbox('Leg', (sx * 0.5, 0.0, 0.07), (0.12, 0.16, 0.14), M0('#16171b', 0.35, 0.6), 0.01, (0, 0, 0)))
            P.append(rbox('Led', (0, -0.0185, z0 - Hh / 2 + 0.006), (0.04, 0.001, 0.003), S.principled('Led', '#4aa3ff', rough=0.2, emission='#4aa3ff', emission_strength=4.0), 0.0005))
        place(P, (0, 0, 0), RZ(math.radians(-24)))
        cfg = dict(scale=1.4 if lv == 3 else 1.1, aim=(0, 0, 0.45), cam=(1.35, -1.8, 0.9), target=(0, 0, 0.45))
    elif lv == 4:
        # a huge wall-mounted TV on a feature wall, soundbar and a low unit
        wall = M0('#d8d4cc', 0.8)
        P.append(rbox('Wall', (0, 0.1, 0.9), (2.4, 0.08, 1.8), wall, 0.01))
        P.append(rbox('Panel', (0, 0.03, 1.1), (1.9, 0.05, 1.12), dark, 0.008))
        P.append(scr(1.9 - 0.014, 1.12 - 0.014, (0, -0.0262, 1.1), (math.pi / 2, 0, 0)))
        P.append(rbox('Unit', (0, -0.1, 0.22), (1.5, 0.34, 0.2), M0('#7a5230', 0.5, 0.0, 0.3), 0.01))
        P.append(rbox('Bar', (0, -0.1, 0.4), (0.9, 0.08, 0.07), M0('#16171b', 0.35, 0.6), 0.01))
        for k in range(3):
            P.append(rbox('Fk', (-0.82 + k * 0.1, -0.1, 0.12), (0.06, 0.2, 0.1), M0('#16171b', 0.4), 0.004))
        place(P, (0, 0, 0), RZ(math.radians(-20)))
        cfg = dict(scale=1.8, aim=(0, 0, 0.8), cam=(1.8, -2.3, 1.2), target=(0, 0, 0.8))
    else:
        # home cinema: gold-trimmed giant screen, floor speakers, sub and a sofa
        g = metalmat_gold()
        P.append(rbox('Wall', (0, 0.18, 0.9), (3.4, 0.06, 1.8), M0('#1c1624', 0.7), 0.01))
        P.append(rbox('Trim', (0, 0.02, 1.0), (2.1, 0.05, 1.22), g, 0.008))
        P.append(rbox('Panel', (0, 0.0, 1.0), (2.0, 0.05, 1.12), dark, 0.008))
        P.append(scr(2.0 - 0.014, 1.12 - 0.014, (0, -0.0262, 1.0), (math.pi / 2, 0, 0)))
        for sx in (-1, 1):
            P.append(rbox('Spk', (sx * 1.45, 0.0, 0.55), (0.28, 0.28, 1.1), M0('#16171b', 0.4, 0.3), 0.01))
            P.append(cyl('Wf', (sx * 1.45, -0.145, 0.38), 0.085, 0.015, 'Y', mat=M0('#0b0c0f', 0.5), bevel=0.003)); P[-1].rotation_euler = (math.pi / 2, 0, 0)
            P.append(cyl('Wf2', (sx * 1.45, -0.145, 0.7), 0.06, 0.015, 'Y', mat=g, bevel=0.003)); P[-1].rotation_euler = (math.pi / 2, 0, 0)
            P.append(cyl('Tw', (sx * 1.45, -0.145, 0.95), 0.025, 0.012, 'Y', mat=g, bevel=0.002)); P[-1].rotation_euler = (math.pi / 2, 0, 0)
        P.append(rbox('Sub', (0.9, -0.1, 0.18), (0.34, 0.34, 0.36), M0('#16171b', 0.4, 0.3), 0.012))
        sofa = M0('#5a1220', 0.6, 0.0, 0.1)
        P.append(rbox('SeatS', (0, -2.2, 0.22), (1.9, 0.8, 0.28), sofa, 0.07))
        P.append(rbox('BackS', (0, -2.55, 0.5), (1.9, 0.2, 0.55), sofa, 0.07))
        for sx in (-1, 1):
            P.append(rbox('ArmS', (sx * 0.98, -2.25, 0.34), (0.2, 0.85, 0.5), sofa, 0.07))
        place(P, (0, 0, 0), RZ(math.radians(-22)))
        cfg = dict(scale=2.3, aim=(0, -0.8, 0.7), cam=(2.2, -3.6, 1.6), target=(0, -0.9, 0.6))
    return P, (0, 0, 0), cfg


# =========================================================== gaming pc / laptop
def monitor(x, y, w, h, key, rot=0, curved=False, z0=0.0, glow=None):
    P = []
    dark = M0('#0c0d10', 0.35, 0.2)
    zc = z0 + 0.12 + h / 2
    P.append(rbox('Mon', (0, 0, zc), (w, 0.03, h), dark, 0.006))
    P.append(plane('Scr', (0, -0.0158, zc), (w - 0.012, h - 0.012), screen_mat(tex.os_screen(key, 'os' + key + str(int(w * 100))), 1.0), (math.pi / 2, 0, 0)))
    P.append(rbox('Neck', (0, 0.035, z0 + 0.08), (0.05, 0.03, 0.16), M0('#16171b', 0.35, 0.6), 0.005))
    P.append(rbox('Foot', (0, 0.02, z0 + 0.008), (0.26, 0.17, 0.016), M0('#16171b', 0.35, 0.6), 0.005))
    place(P, (x, y, 0), RZ(rot))
    return P


def tower_pc(x, y, h, w, d, glow, rot=0, gold=False, z0=0.0):
    P = []
    fr = metalmat_gold() if gold else M0('#14161a', 0.35, 0.4)
    P.append(rbox('Case', (0, 0, h / 2), (w, d, h), fr, 0.008))
    # glass side facing -X? we look at -Y: use the -Y face as glass
    P.append(rbox('GlassSide', (0, -d / 2 - 0.001, h / 2), (w * 0.9, 0.004, h * 0.9), S.principled('Gl', '#0a0c12', rough=0.03, spec=1.0, alpha=1.0), 0.003))
    gl = S.principled('Glow', glow, rough=0.3, emission=glow, emission_strength=6.0)
    for k in range(3):
        zc = h * (0.2 + 0.3 * k)
        P.append(torus('Fan', (0.0, -d / 2 + 0.01, zc), w * 0.3, 0.007, 'Y', gl, 40, 8))
        P.append(cyl('Hub', (0.0, -d / 2 + 0.01, zc), w * 0.07, 0.006, 'Y', mat=M0('#0f1115', 0.4), verts=24)); P[-1].rotation_euler = (math.pi / 2, 0, 0)
        for b in range(7):
            a = 2 * math.pi * b / 7 + k
            P.append(box('Bl', (math.cos(a) * w * 0.17, -d / 2 + 0.011, zc + math.sin(a) * w * 0.17), (w * 0.2, 0.002, 0.012), M0('#151821', 0.4), rot=(0, -a, 0)))
    P.append(rbox('Strip', (w / 2 - 0.012, -d / 2 + 0.004, h / 2), (0.006, 0.004, h * 0.8), gl, 0.001))
    place(P, (x, y, z0), RZ(rot))
    return P


def keyboard(x, y, rot, glow, z0=0.0):
    P = [rbox('Kb', (0, 0, 0.012), (0.44, 0.15, 0.022), M0('#14161a', 0.4, 0.3), 0.006)]
    gl = S.principled('KG', glow, rough=0.3, emission=glow, emission_strength=3.0)
    for r in range(4):
        for c in range(15):
            P.append(rbox('K', (-0.2 + c * 0.0285, -0.05 + r * 0.032, 0.026), (0.024, 0.026, 0.006), M0('#1c1f26', 0.4), 0.002))
    P.append(rbox('Under', (0, 0, 0.002), (0.45, 0.16, 0.003), gl, 0.001))
    place(P, (x, y, z0), RZ(rot))
    return P


def desk(w, d, h=0.74, col='#2a2e38'):
    P = [rbox('Top', (0, 0, h), (w, d, 0.04), M0(col, 0.35, 0.2, 0.3), 0.008)]
    for sx in (-1, 1):
        P.append(rbox('Leg', (sx * (w / 2 - 0.05), 0, h / 2), (0.05, d - 0.05, h), M0('#16171b', 0.4, 0.6), 0.005))
    return P


def laptop(lv):
    P = []
    body = M0('#b9b4a6', 0.5) if lv == 1 else M0('#14161a', 0.35, 0.5, 0.3)
    if lv == 1:
        S.add_grunge(body, amount=0.45, dirt='#6a6358', scale=16, rough_add=0.3, seed=2.0)
    base = [rbox('Base', (0, 0, 0.011), (0.36, 0.25, 0.022), body, 0.008)]
    gl = S.principled('KG', '#ff2a2a' if lv == 2 else '#222222', rough=0.3, emission='#ff2a2a' if lv == 2 else '#000000', emission_strength=3.0 if lv == 2 else 0.0)
    base.append(rbox('Deck', (0, 0.0, 0.0222), (0.33, 0.18, 0.0014), M0('#1a1c20', 0.5), 0.002))
    for r in range(4):
        for c in range(13):
            base.append(rbox('K', (-0.15 + c * 0.0255, -0.045 + r * 0.03 - 0.0, 0.0245), (0.021, 0.024, 0.004), M0('#2a2d34' if lv == 1 else '#101216', 0.4) if lv == 1 else gl, 0.002))
    base.append(rbox('Pad', (0, -0.1, 0.0235), (0.1, 0.05, 0.0006), M0('#2a2d34', 0.3), 0.002))
    lid = [rbox('Lid', (0, 0.0, 0.0), (0.36, 0.012, 0.24), body, 0.006),
           plane('Scr', (0, -0.0066, 0.0), (0.34, 0.21), screen_mat(tex.os_screen('old' if lv == 1 else 'game', 'lp' + str(lv)), 0.8 if lv == 1 else 1.0), (math.pi / 2, 0, 0))]
    place(lid, (0, 0.125, 0.14), RX(math.radians(-14)))
    P += base + lid
    place(P, (0, 0, 0), RZ(math.radians(-28)))
    cfg = dict(scale=0.5, aim=(0, 0, 0.1), cam=(0.55, -0.7, 0.42), target=(0, 0.0, 0.1))
    return P, (0, 0, 0), cfg


def gaming(lv):
    if lv <= 2:
        return laptop(lv)
    P = []
    if lv == 3:
        P += desk(1.1, 0.6)
        P += monitor(-0.1, 0.12, 0.62, 0.36, 'rgb', rot=0, z0=0.76)
        P += tower_pc(0.38, 0.05, 0.46, 0.2, 0.42, '#b04cff', rot=-0.15, z0=0.76)
        P += keyboard(-0.1, -0.12, 0.05, '#b04cff', z0=0.76)
        cfg = dict(scale=1.2, aim=(0, 0, 0.9), cam=(1.1, -1.5, 1.45), target=(0.05, 0, 0.95))
    elif lv == 4:
        P += desk(1.5, 0.7, col='#16181e')
        P += monitor(-0.35, 0.18, 0.56, 0.33, 'game', rot=0.2, z0=0.76) + monitor(0.25, 0.18, 0.56, 0.33, 'rgb', rot=-0.2, z0=0.76)
        P += tower_pc(0.62, 0.05, 0.5, 0.22, 0.45, '#ff2d7a', rot=-0.2, z0=0.76)
        P += keyboard(-0.05, -0.12, 0.0, '#ff2d7a', z0=0.76)
        P.append(rbox('Strip', (0, 0.34, 0.785), (1.4, 0.01, 0.01), S.principled('LS', '#ff2d7a', rough=0.3, emission='#ff2d7a', emission_strength=6.0), 0.002))
        cfg = dict(scale=1.5, aim=(0, 0, 0.9), cam=(1.4, -1.9, 1.5), target=(0.05, 0, 0.95))
    else:
        g = metalmat_gold()
        P += desk(1.7, 0.75, col='#1a1c22')
        P += monitor(0.0, 0.2, 1.0, 0.42, 'sun', rot=0, z0=0.76)
        P += tower_pc(0.75, 0.05, 0.5, 0.22, 0.45, '#ffd36b', rot=-0.2, gold=True, z0=0.76)
        P += keyboard(-0.1, -0.12, 0.0, '#ffd36b', z0=0.76)
        # mic on an arm and a ring light
        P.append(tube('Arm', [(-0.7, 0.3, 0.76), (-0.7, 0.3, 1.15), (-0.4, 0.15, 1.25), (-0.25, -0.05, 1.12)], 0.01, M0('#16171b', 0.4, 0.6)))
        P.append(cyl('Mic', (-0.25, -0.05, 1.07), 0.025, 0.14, 'Z', mat=g, bevel=0.005, verts=32))
        P.append(tube('RingStand', [(0.8, 0.3, 0.76), (0.8, 0.3, 1.2)], 0.012, M0('#16171b', 0.4, 0.6)))
        P.append(torus('Ring', (0.8, 0.28, 1.35), 0.17, 0.02, 'Y', S.principled('RL', '#fff6e6', rough=0.3, emission='#fff0d0', emission_strength=7.0), 40, 10))
        cfg = dict(scale=1.7, aim=(0, 0, 0.95), cam=(1.6, -2.2, 1.55), target=(0.05, 0, 1.0))
    return P, (0, 0, 0), cfg


def spin(parts, ang):
    if ang: place(parts, (0, 0, 0), RZ(ang))


FN = {'phone': phone, 'console': console, 'headphones': headphones, 'music': music, 'tablet': tablet, 'smartwatch': smartwatch, 'tv': tv, 'gaming-pc': gaming}


def make(fam, lv):
    P, rot, cfg = FN[fam](lv)
    spin(P, rot[2] if isinstance(rot, tuple) else rot)
    P = convert_curves(P)
    bpy.context.view_layer.update()
    if fam == 'smartwatch':
        from drip import drop_to_floor
        drop_to_floor(P)
    cfg = dict(dict(lens=55, fill=0.8, fill_y=0.72, floor=0.0, offset=(0, -0.01), floor_size=20), **cfg)
    return P, cfg
