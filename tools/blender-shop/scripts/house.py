"""The House ladder (house-1) as little dioramas, built in code.

usage: python house.py -- <level 1-5> <out.png> [samples]
Names from lib/star/lifestyleLevels.ts: Terraced House, Semi-Detached House,
Detached House, Gated House, Executive Home. Generic buildings, nothing real.
"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector
import studio as S


def box(name, c, size, mat, bevel=0.0, seg=2, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c)
    ob = bpy.context.object; ob.name = name; ob.scale = size; ob.rotation_euler = rot
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = ob.modifiers.new('bev', 'BEVEL'); b.width = bevel; b.segments = seg
    ob.data.materials.append(mat)
    return ob


def mesh_from(name, verts, faces, mat):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    ob.data.materials.append(mat)
    return ob


def gable_roof(name, x0, x1, y0, y1, z, h, mat, over=0.25, ridge_axis='X'):
    """A pitched roof over the rectangle, ridge along X (or Y)."""
    x0 -= over; x1 += over; y0 -= over; y1 += over
    if ridge_axis == 'X':
        ym = (y0 + y1) / 2
        v = [(x0, y0, z), (x1, y0, z), (x1, ym, z + h), (x0, ym, z + h), (x0, y1, z), (x1, y1, z)]
        f = [(0, 1, 2, 3), (3, 2, 5, 4), (0, 3, 4), (1, 5, 2), (0, 4, 5, 1)]
    else:
        xm = (x0 + x1) / 2
        v = [(x0, y0, z), (x0, y1, z), (xm, y1, z + h), (xm, y0, z + h), (x1, y1, z), (x1, y0, z)]
        f = [(0, 3, 2, 1), (3, 5, 4, 2), (0, 5, 3), (1, 2, 4), (0, 1, 4, 5)]
    ob = mesh_from(name, v, f, mat)
    sol = ob.modifiers.new('sol', 'SOLIDIFY'); sol.thickness = 0.12; sol.offset = 1
    bev = ob.modifiers.new('bev', 'BEVEL'); bev.width = 0.03; bev.segments = 2
    return ob


# ---------------------------------------------------------------- materials
def mats(lv):
    M = {}
    M['grass'] = S.principled('Grass', '#3f7a2e', rough=0.9)
    S.add_grunge(M['grass'], amount=0.5, dirt='#2f6524', scale=4, rough_add=0.0, seed=1)
    M['soil'] = S.principled('Soil', '#5a3d27', rough=0.95)
    S.add_grunge(M['soil'], amount=0.6, dirt='#3f2a1b', scale=6, seed=2)
    M['path'] = S.principled('Path', '#b9b4a8', rough=0.8)
    M['glass'] = S.principled('Win', '#14202e', rough=0.04, spec=1.0, emission='#ffc86b', emission_strength=0.16 if lv > 1 else 0.14)
    M['frame'] = S.principled('Frame', '#f4f1ea', rough=0.5)
    M['door'] = S.principled('Door', {1: '#5b4b3a', 2: '#1d4ed8', 3: '#b91c1c', 4: '#111318', 5: '#2b1d0e'}[lv], rough=0.4, coat=0.4)
    M['slate'] = brick_mat('Slate', '#3c4250', '#2f3440', '#22262e', scale=9, rows=0.06)
    M['tile'] = brick_mat('Tile', '#9a4a2c', '#8a3f25', '#5f2a18', scale=9, rows=0.06)
    M['brick'] = brick_mat('Brick', '#9b5a3f', '#8a4c34', '#d7cfc2', scale=6)
    M['brick_old'] = brick_mat('BrickOld', '#7d5a4a', '#6c4d40', '#a9a196', scale=6)
    M['render'] = S.principled('Render', '#e6dcc8', rough=0.85)
    M['dark'] = S.principled('Charcoal', '#22252b', rough=0.6)
    M['white'] = S.principled('White', '#e9e7e1', rough=0.55)
    M['wood'] = S.principled('Wood', '#8a5a34', rough=0.6)
    M['hedge'] = S.principled('Hedge', '#2f6b2a', rough=0.95)
    S.add_grunge(M['hedge'], amount=0.6, dirt='#21511e', scale=14, seed=3)
    M['leaf'] = S.principled('Leaf', '#3f8a33', rough=0.9)
    S.add_grunge(M['leaf'], amount=0.6, dirt='#2b6a24', scale=8, seed=4)
    M['trunk'] = S.principled('Trunk', '#5a3e28', rough=0.9)
    M['metal'] = S.principled('Metal', '#16181c', rough=0.35, metal=0.8)
    M['gold'] = S.gold('GoldTrim', 0.25)
    M['water'] = S.principled('Water', '#1aa3d9', rough=0.02, spec=0.8, emission='#36c4f0', emission_strength=0.35)
    M['bin'] = S.principled('Bin', '#2a4a2a', rough=0.6)
    M['stone'] = S.principled('Stone', '#d6d0c4', rough=0.7)
    return M


def brick_mat(name, c1, c2, mortar, scale=6, rows=None):
    m = S.principled(name, c1, rough=0.85)
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = S.node(m, 'ShaderNodeTexCoord')
    # box-mapped object coords: use generated-like coordinates via mapping of x+y and z
    sep = S.node(m, 'ShaderNodeSeparateXYZ'); S.link(m, tc.outputs['Object'], sep.inputs[0])
    add = S.node(m, 'ShaderNodeMath'); add.operation = 'ADD'
    S.link(m, sep.outputs['X'], add.inputs[0]); S.link(m, sep.outputs['Y'], add.inputs[1])
    comb = S.node(m, 'ShaderNodeCombineXYZ')
    S.link(m, add.outputs['Value'], comb.inputs['X']); S.link(m, sep.outputs['Z'], comb.inputs['Y'])
    br = S.node(m, 'ShaderNodeTexBrick')
    br.inputs['Scale'].default_value = scale
    br.inputs['Color1'].default_value = (*S.srgb(c1), 1)
    br.inputs['Color2'].default_value = (*S.srgb(c2), 1)
    br.inputs['Mortar'].default_value = (*S.srgb(mortar), 1)
    br.inputs['Mortar Size'].default_value = 0.012
    br.inputs['Brick Width'].default_value = 0.5
    br.inputs['Row Height'].default_value = rows or 0.25
    S.link(m, comb.outputs['Vector'], br.inputs['Vector'])
    S.link(m, br.outputs['Color'], b.inputs['Base Color'])
    bump = S.node(m, 'ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.25
    S.link(m, br.outputs['Fac'], bump.inputs['Height'])
    S.link(m, bump.outputs['Normal'], b.inputs['Normal'])
    return m


# ---------------------------------------------------------------- pieces
def windows_on(face, x0, x1, z0, cols, rows, floor_h, M, wsize=(0.62, 0.9), y=None, x=None, big=False):
    """Windows on a front face (y = const, facing -Y) or side face (x = const, facing +X)."""
    parts = []
    for r in range(rows):
        zc = z0 + floor_h * (r + 0.55)
        for c in range(cols):
            t = (c + 0.5) / cols
            u = x0 + (x1 - x0) * t
            ww, wh = wsize
            if face == 'front':
                parts.append(box('Fr', (u, y - 0.02, zc), (ww + 0.14, 0.06, wh + 0.14), M['frame'], bevel=0.015))
                parts.append(box('Gl', (u, y - 0.05, zc), (ww, 0.04, wh), M['glass']))
                if not big:
                    parts.append(box('Mu', (u, y - 0.075, zc), (0.04, 0.02, wh), M['frame']))
                parts.append(box('Sill', (u, y - 0.09, zc - wh / 2 - 0.08), (ww + 0.24, 0.16, 0.06), M['frame'], bevel=0.01))
            else:
                parts.append(box('Fr', (x + 0.02, u, zc), (0.06, ww + 0.14, wh + 0.14), M['frame'], bevel=0.015))
                parts.append(box('Gl', (x + 0.05, u, zc), (0.04, ww, wh), M['glass']))
                if not big:
                    parts.append(box('Mu', (x + 0.075, u, zc), (0.02, 0.04, wh), M['frame']))
                parts.append(box('Sill', (x + 0.09, u, zc - wh / 2 - 0.08), (0.16, ww + 0.24, 0.06), M['frame'], bevel=0.01))
    return parts


def door(xc, y, M, w=0.95, h=2.05):
    return [box('DoorFr', (xc, y - 0.02, h / 2 + 0.05), (w + 0.16, 0.06, h + 0.1), M['frame'], bevel=0.015),
            box('Door', (xc, y - 0.05, h / 2), (w, 0.05, h), M['door'], bevel=0.01),
            box('Step', (xc, y - 0.25, 0.06), (w + 0.4, 0.5, 0.12), M['stone'], bevel=0.02)]


def tree(x, y, s, M, seed=0):
    parts = [S_cyl('Trunk', (x, y, 0.9 * s), 0.13 * s, 1.8 * s, M['trunk'])]
    rnd = random.Random(seed)
    for k in range(4):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=(0.9 - 0.12 * k) * s,
                                              location=(x + rnd.uniform(-0.35, 0.35) * s, y + rnd.uniform(-0.35, 0.35) * s, (2.2 + 0.45 * k) * s))
        o = bpy.context.object
        d = o.modifiers.new('d', 'DISPLACE'); tex = bpy.data.textures.new('n', 'CLOUDS'); tex.noise_scale = 0.4 * s; d.texture = tex; d.strength = 0.25 * s
        sm = o.modifiers.new('s', 'SUBSURF'); sm.levels = sm.render_levels = 1
        for p in o.data.polygons: p.use_smooth = True
        o.data.materials.append(M['leaf'])
        parts.append(o)
    return parts


def palm(x, y, s, M, seed=0):
    parts = []
    rnd = random.Random(seed)
    lean = rnd.uniform(-0.25, 0.25)
    cu = bpy.data.curves.new('PalmT', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.12 * s; cu.bevel_resolution = 3
    spl = cu.splines.new('BEZIER'); spl.bezier_points.add(2)
    pts = [(x, y, 0), (x + lean * 1.2 * s, y, 2.0 * s), (x + lean * 2.4 * s, y + 0.2 * s, 3.8 * s)]
    for bp, p in zip(spl.bezier_points, pts):
        bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    t = bpy.data.objects.new('PalmT', cu); bpy.context.scene.collection.objects.link(t); cu.materials.append(M['trunk'])
    parts.append(t)
    top = Vector(pts[-1])
    for k in range(7):
        a = 2 * math.pi * k / 7 + rnd.uniform(-0.2, 0.2)
        cu2 = bpy.data.curves.new('Frond', 'CURVE'); cu2.dimensions = '3D'; cu2.bevel_depth = 0.0; cu2.extrude = 0.0
        cu2.bevel_mode = 'ROUND'
        sp = cu2.splines.new('BEZIER'); sp.bezier_points.add(2)
        d = Vector((math.cos(a), math.sin(a), 0))
        ps = [top, top + d * 1.0 * s + Vector((0, 0, 0.35 * s)), top + d * 1.9 * s - Vector((0, 0, 0.5 * s))]
        for bp, p in zip(sp.bezier_points, ps):
            bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
        sp.bezier_points[0].radius = 1.0; sp.bezier_points[1].radius = 1.0; sp.bezier_points[2].radius = 0.1
        cu2.bevel_depth = 0.22 * s; cu2.bevel_resolution = 0
        o = bpy.data.objects.new('Frond', cu2); bpy.context.scene.collection.objects.link(o)
        o.scale = (1, 1, 1)
        cu2.materials.append(M['leaf'])
        parts.append(o)
    return parts


def S_cyl(name, loc, r, depth, mat, verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc)
    o = bpy.context.object; o.name = name
    for p in o.data.polygons: p.use_smooth = True
    o.data.materials.append(mat)
    return o


def plinth(w, d, M, extra=0.0):
    """The diorama base: a rounded slab, grass on top, soil on the sides."""
    parts = [box('Soil', (0, 0, -0.35), (w, d, 0.7), M['soil'], bevel=0.25, seg=4),
             box('GrassTop', (0, 0, -0.04), (w - 0.02, d - 0.02, 0.1), M['grass'], bevel=0.24, seg=4)]
    return parts


def hedge(c, size, M):
    return [box('Hedge', c, size, M['hedge'], bevel=0.12, seg=3)]


# ---------------------------------------------------------------- houses
def terrace(M):
    """Level 1 (v0.23.1): the starter. One small, narrow, tired two-up-two-down with a yard,
    smaller and humbler than before (it used to be a row of three big houses)."""
    parts = plinth(7.6, 7.2, M)
    W, D, H = 3.6, 4.4, 4.0
    y0 = -0.4
    x = 0.0
    parts.append(box('Wall', (x, y0 + D / 2, H / 2), (W, D, H), M['brick_old']))
    parts += windows_on('front', x - 0.65, x + 0.95, 0.0, 1, 2, 2.15, M, y=y0, wsize=(0.78, 0.9))
    parts += door(x - 0.95, y0, M, w=0.8, h=1.95)
    parts.append(gable_roof('Roof', x - W / 2, x + W / 2, y0, y0 + D, H, 1.1, M['slate'], over=0.18, ridge_axis='X'))
    parts.append(box('Chim', (x + 1.1, y0 + D / 2, H + 1.0), (0.45, 0.6, 0.9), M['brick'], bevel=0.02))
    parts += windows_on('side', y0 + 1.1, y0 + D - 1.1, 0.0, 1, 2, 2.15, M, x=x + W / 2, wsize=(0.7, 0.9))
    parts.append(box('Path', (x - 0.95, -2.0, 0.03), (0.9, 1.7, 0.06), M['path']))
    parts.append(box('Bin', (x + 1.2, -1.9, 0.5), (0.5, 0.55, 1.0), M['bin'], bevel=0.05))
    parts.append(box('WallF', (x, -2.85, 0.25), (6.4, 0.2, 0.5), M['brick_old'], bevel=0.02))
    parts.append(box('WallL', (-3.2, 0.0, 0.25), (0.2, 5.8, 0.5), M['brick_old'], bevel=0.02))
    parts += hedge((2.3, -2.4, 0.3), (1.4, 0.5, 0.6), M)
    return parts


def semi(M):
    parts = plinth(12.5, 10, M)
    W, D, H = 4.4, 6.5, 5.4
    y0 = -0.8
    for k, x in enumerate((-2.2, 2.2)):
        ours = k == 1
        wall = M['render'] if ours else M['brick']
        parts.append(box('Wall', (x, y0 + D / 2, H / 2), (W, D, H), wall))
        parts += windows_on('front', (x - 0.2) if ours else (x - 1.4), (x + 1.4) if ours else (x + 0.2), 0.0, 1, 2, 2.6, M, y=y0, wsize=(1.3, 1.1))
        parts += door(x + (-1.4 if ours else 1.4), y0, M, w=0.95)
    parts.append(gable_roof('Roof', -4.4, 4.4, y0, y0 + D, H, 2.2, M['tile'], over=0.3, ridge_axis='X'))
    parts += windows_on('side', y0 + 1.5, y0 + D - 1.5, 0.0, 2, 2, 2.6, M, x=4.4, wsize=(1.0, 1.1))
    parts.append(box('Chim', (0, y0 + D / 2, H + 2.0), (0.7, 0.9, 1.6), M['brick'], bevel=0.02))
    parts.append(box('Path', (0.8, -3.1, 0.03), (1.2, 4.4, 0.06), M['path']))
    parts += hedge((-2.8, -4.4, 0.45), (5.8, 0.7, 0.9), M)
    parts += hedge((4.6, -4.4, 0.45), (3.6, 0.7, 0.9), M)
    parts += tree(-4.6, 2.8, 0.8, M, seed=2)
    return parts


def detached(M):
    parts = plinth(14.5, 12, M)
    W, D, H = 7.0, 6.5, 5.6
    y0 = -1.0
    parts.append(box('Wall', (0.6, y0 + D / 2, H / 2), (W, D, H), M['brick']))
    parts += windows_on('front', -1.8, 3.2, 0.0, 3, 2, 2.7, M, y=y0, wsize=(1.2, 1.15))
    parts += door(0.65, y0, M)
    parts.append(gable_roof('Roof', 0.6 - W / 2, 0.6 + W / 2, y0, y0 + D, H, 2.4, M['tile'], over=0.35))
    parts += windows_on('side', y0 + 1.4, y0 + D - 1.4, 0.0, 2, 2, 2.7, M, x=0.6 + W / 2, wsize=(1.1, 1.15))
    # garage
    parts.append(box('Garage', (-4.3, y0 + 3.0, 1.5), (2.8, 6.0, 3.0), M['brick']))
    parts.append(box('GDoor', (-4.3, y0 - 0.03, 1.15), (2.2, 0.08, 2.2), M['white'], bevel=0.02))
    parts.append(gable_roof('GRoof', -5.7, -2.9, y0, y0 + 6.0, 3.0, 0.9, M['tile'], over=0.2, ridge_axis='Y'))
    parts.append(box('Chim', (2.6, y0 + D / 2, H + 2.1), (0.8, 0.9, 1.8), M['brick'], bevel=0.02))
    parts.append(box('Drive', (-4.3, -3.8, 0.03), (2.8, 4.4, 0.06), M['path']))
    parts.append(box('Path', (0.65, -3.8, 0.03), (1.2, 4.4, 0.06), M['path']))
    parts += hedge((3.9, -5.4, 0.45), (5.8, 0.7, 0.9), M)
    parts += tree(5.8, 2.6, 1.0, M, seed=3)
    parts += tree(-6.2, 4.4, 0.75, M, seed=5)
    return parts


def gated(M):
    """Modern dark house behind a wall and gates."""
    parts = plinth(16, 13.5, M)
    y0 = 0.0
    parts.append(box('Low', (0, y0 + 3.5, 1.6), (10.0, 7.0, 3.2), M['dark'], bevel=0.03))
    parts.append(box('Up', (1.5, y0 + 3.8, 4.6), (6.6, 6.4, 2.8), M['white'], bevel=0.03))
    parts.append(box('RoofL', (0, y0 + 3.5, 3.25), (10.4, 7.4, 0.14), M['metal'], bevel=0.02))
    parts.append(box('RoofU', (1.5, y0 + 3.8, 6.05), (7.0, 6.8, 0.14), M['metal'], bevel=0.02))
    # big glass
    parts.append(box('GlassL', (-2.3, y0 - 0.02, 1.45), (4.6, 0.06, 2.4), M['glass']))
    parts.append(box('GlassU', (1.5, y0 + 0.58, 4.6), (5.0, 0.06, 2.0), M['glass']))
    for xx in (-4.6, -2.3, 0.0):
        parts.append(box('Mull', (xx, y0 - 0.06, 1.45), (0.08, 0.06, 2.4), M['metal']))
    parts.append(box('SideGl', (5.03, y0 + 3.5, 1.45), (0.06, 4.0, 2.2), M['glass']))
    parts += door(2.6, y0, M, w=1.2, h=2.4)
    # boundary wall + gates
    wall = M['stone']
    parts.append(box('WallF1', (-4.6, -4.6, 0.9), (6.4, 0.4, 1.8), wall, bevel=0.03))
    parts.append(box('WallF2', (5.4, -4.6, 0.9), (4.4, 0.4, 1.8), wall, bevel=0.03))
    parts.append(box('WallS', (7.4, 1.0, 0.9), (0.4, 11.0, 1.8), wall, bevel=0.03))
    parts.append(box('WallW', (-7.6, 1.0, 0.9), (0.4, 11.0, 1.8), wall, bevel=0.03))
    for px in (-1.25, 3.05):
        parts.append(box('Pier', (px, -4.6, 1.2), (0.7, 0.7, 2.4), wall, bevel=0.03))
        parts.append(box('Cap', (px, -4.6, 2.48), (0.85, 0.85, 0.16), M['metal'], bevel=0.02))
    for k in range(14):
        xx = -0.85 + k * 0.3
        parts.append(box('Bar', (xx, -4.6, 1.15), (0.06, 0.06, 2.1), M['metal']))
    for zz in (0.25, 2.1):
        parts.append(box('Rail', (0.9, -4.6, zz), (3.6, 0.08, 0.1), M['metal']))
    parts.append(box('Drive', (0.9, -2.3, 0.03), (3.6, 4.6, 0.06), M['stone']))
    parts += tree(-5.8, 4.8, 0.9, M, seed=7)
    parts += hedge((-4.6, -3.9, 0.5), (6.0, 0.6, 1.0), M)
    return parts


def executive(M):
    """A big white villa with a pool and gold trim."""
    parts = plinth(19, 15, M)
    y0 = 0.5
    parts.append(box('Low', (-1.0, y0 + 3.6, 1.7), (13.0, 7.2, 3.4), M['white'], bevel=0.03))
    parts.append(box('Up', (2.0, y0 + 4.2, 5.0), (8.0, 6.4, 3.2), M['white'], bevel=0.03))
    parts.append(box('Tower', (-5.4, y0 + 5.2, 4.4), (3.4, 4.0, 2.0), M['dark'], bevel=0.03))
    for nm, c, s in (('RoofL', (-1.0, y0 + 3.6, 3.48), (13.6, 7.8, 0.16)), ('RoofU', (2.0, y0 + 4.2, 6.68), (8.8, 7.2, 0.16)),
                     ('RoofT', (-5.4, y0 + 5.2, 5.48), (3.8, 4.4, 0.16))):
        parts.append(box(nm, c, s, M['gold'], bevel=0.02))
        parts.append(box(nm + 'Top', (c[0], c[1], c[2] + 0.04), (s[0] - 0.2, s[1] - 0.2, s[2]), M['white'], bevel=0.02))
    parts.append(box('GlassL', (-1.5, y0 - 0.02, 1.55), (9.0, 0.06, 2.6), M['glass']))
    for xx in (-5.5, -3.5, -1.5, 0.5, 2.5):
        parts.append(box('Mull', (xx, y0 - 0.06, 1.55), (0.08, 0.06, 2.6), M['gold']))
    parts.append(box('GlassU', (2.0, y0 + 0.98, 5.0), (6.4, 0.06, 2.3), M['glass']))
    parts.append(box('Balc', (2.0, y0 + 0.6, 3.75), (8.0, 1.6, 0.12), M['white'], bevel=0.02))
    parts.append(box('BalcGl', (2.0, y0 - 0.15, 4.2), (8.0, 0.05, 0.9), S.principled('BGl', '#a9c7da', rough=0.02, transmission=0.9, alpha=1.0)))
    parts.append(box('SideGl', (5.53, y0 + 3.6, 1.55), (0.06, 5.0, 2.4), M['glass']))
    parts += door(4.0, y0, M, w=1.6, h=2.6)
    # pool and deck
    parts.append(box('Deck', (-2.0, -4.2, 0.04), (11.0, 4.6, 0.1), M['wood'], bevel=0.02))
    parts.append(box('PoolEdge', (-2.6, -4.3, 0.12), (8.0, 3.2, 0.12), M['stone'], bevel=0.03))
    parts.append(box('Pool', (-2.6, -4.3, 0.16), (7.4, 2.6, 0.1), M['water']))
    for k in range(3):
        parts.append(box('Lounger', (-5.4 + k * 2.3, -6.15, 0.28), (0.8, 1.9, 0.18), M['white'], bevel=0.05))
    parts += palm(6.6, -4.6, 1.15, M, seed=1)
    parts += palm(-8.0, 3.0, 1.0, M, seed=4)
    parts += hedge((6.8, 4.5, 0.5), (2.6, 4.0, 1.0), M)
    parts.append(box('Drive', (5.8, -1.8, 0.03), (3.0, 3.6, 0.06), M['stone']))
    return parts


BUILD = {1: terrace, 2: semi, 3: detached, 4: gated, 5: executive}


def main():
    a = S.args()
    lv, out = int(a[0]), a[1]
    samples = int(a[2]) if len(a) > 2 else 64
    S.reset()
    S.setup_render((600, 450), samples)
    S.world(0.4)
    bpy.context.scene.view_settings.exposure = -1.0
    M = mats(lv)
    parts = BUILD[lv](M)
    bpy.context.view_layer.update()
    S.studio_lights(scale=18, aim=(0, 0, 1.5), key=1.0)
    # warm sun-ish key for the diorama
    S.shadow_catcher(-0.7, size=300)
    cam = S.camera((16.5, -22.0, 12.5), (0, 0, 1.2), lens=50)
    S.frame_objects(cam, [p for p in parts if p.type == 'MESH'], fill=0.84, offset=(0, 0.0), fill_y=0.76)
    S.render(out)


if __name__ == '__main__':
    main()
