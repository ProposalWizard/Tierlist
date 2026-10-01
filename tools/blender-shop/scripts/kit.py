"""Small shared builders for the shop product shots (all code, no assets)."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, bmesh
from mathutils import Vector, Matrix
import studio as S


def link(ob):
    if ob.name not in bpy.context.scene.collection.objects:
        bpy.context.scene.collection.objects.link(ob)
    return ob


def box(name, c, size, mat=None, bevel=0.0, seg=3, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c)
    ob = bpy.context.object; ob.name = name; ob.scale = size; ob.rotation_euler = rot
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = ob.modifiers.new('bev', 'BEVEL'); b.width = bevel; b.segments = seg
    if mat: ob.data.materials.append(mat)
    return ob


def cyl(name, loc, r, depth, axis='Z', verts=40, mat=None, bevel=0.0, seg=3, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=loc)
    ob = bpy.context.object; ob.name = name
    if axis == 'Y':
        ob.rotation_euler = (math.pi / 2, 0, 0)
    elif axis == 'X':
        ob.rotation_euler = (0, math.pi / 2, 0)
    if bevel:
        b = ob.modifiers.new('bev', 'BEVEL'); b.width = bevel; b.segments = seg; b.limit_method = 'ANGLE'
    for p in ob.data.polygons: p.use_smooth = True
    if mat: ob.data.materials.append(mat)
    return ob


def sph(name, loc, r, mat=None, scale=(1, 1, 1), seg=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=loc)
    o = bpy.context.object; o.name = name; o.scale = scale
    for p in o.data.polygons: p.use_smooth = True
    if mat: o.data.materials.append(mat)
    return o


def torus(name, loc, R, r, axis='Y', mat=None, major=48, minor=16):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=major, minor_segments=minor, location=loc)
    o = bpy.context.object; o.name = name
    if axis == 'Y':
        o.rotation_euler = (math.pi / 2, 0, 0)
    elif axis == 'X':
        o.rotation_euler = (0, math.pi / 2, 0)
    for p in o.data.polygons: p.use_smooth = True
    if mat: o.data.materials.append(mat)
    return o


def tube(name, pts, r, mat=None, smooth=True, res=8, taper=None, cap=True):
    """A round tube through points (Bezier AUTO handles when smooth, else polyline)."""
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    cu.bevel_depth = r; cu.bevel_resolution = res; cu.resolution_u = 12
    cu.use_fill_caps = cap
    if smooth and len(pts) > 2:
        sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
        for bp, p in zip(sp.bezier_points, pts):
            bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'
    else:
        sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
        for pt, p in zip(sp.points, pts):
            pt.co = (*p, 1)
    o = bpy.data.objects.new(name, cu); link(o)
    if mat: cu.materials.append(mat)
    return o


def mesh_from(name, verts, faces, mat=None, smooth=False):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    ob = bpy.data.objects.new(name, me); link(ob)
    if mat: ob.data.materials.append(mat)
    if smooth:
        for p in me.polygons: p.use_smooth = True
    return ob


def convert_curves(parts):
    """Frame fitting / rendering both want mesh objects: turn curve tubes into meshes."""
    out = []
    for o in parts:
        if o.type in ('CURVE', 'FONT'):
            bpy.context.view_layer.update()
            dg = bpy.context.evaluated_depsgraph_get()
            me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
            n = bpy.data.objects.new(o.name + 'M', me); link(n)
            n.matrix_world = o.matrix_world
            for m in o.data.materials: me.materials.append(m)
            bpy.data.objects.remove(o, do_unlink=True)
            out.append(n)
        else:
            out.append(o)
    return out


def paint(name, col, lv=3, rust=False):
    if col == 'gold':
        return S.principled(name, (*S.srgb((1.0, 0.78, 0.36)), 1), rough=0.22, metal=1.0, coat=1.0, coat_rough=0.03)
    m = S.principled(name, col, rough=0.32, metal=0.45, coat=1.0, coat_rough=0.03)
    if rust:
        m = S.principled(name, col, rough=0.72, spec=0.3)
        S.add_grunge(m, amount=0.8, dirt='#6e2f12', scale=3.0, rough_add=0.2, seed=2.0, strength=1.0)
        S.add_grunge(m, amount=0.5, dirt='#8a4a20', scale=9.0, rough_add=0.1, seed=12.0, strength=0.8)
    return m


def solid_gem(name, loc, r, mat, scale=(1, 1, 1), kind='brilliant', rot=(0, 0, 0)):
    """A faceted cut stone: crown + pavilion, flat shaded."""
    n = 8
    v = []; f = []
    # table ring, girdle ring, culet
    table = [(math.cos(2 * math.pi * k / n) * r * 0.55, math.sin(2 * math.pi * k / n) * r * 0.55, r * 0.38) for k in range(n)]
    gird = [(math.cos(2 * math.pi * (k + 0.5) / n) * r, math.sin(2 * math.pi * (k + 0.5) / n) * r, 0.0) for k in range(n)]
    cul = [(0, 0, -r * 0.8)]
    v = table + gird + cul + [(0, 0, r * 0.38)]
    ti = list(range(n)); gi = list(range(n, 2 * n)); c = 2 * n; top = 2 * n + 1
    for k in range(n):
        f.append((top, ti[k], ti[(k + 1) % n]))
        f.append((ti[k], gi[(k - 1) % n], gi[k]))  # kite-ish
        f.append((ti[k], gi[k], ti[(k + 1) % n]))
        f.append((gi[k], gi[(k - 1) % n], c))
    ob = mesh_from(name, v, f, mat)
    ob.location = loc; ob.scale = scale; ob.rotation_euler = rot
    bpy.context.view_layer.update()
    return ob


def gem_mat(name, col='#e8f4ff', ior=2.4, rough=0.0, strength=0.0):
    m = S.principled(name, col, rough=rough, spec=1.0, transmission=1.0, ior=ior)
    return m


def text(name, body, loc, size, mat, font='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', extrude=0.004, rot=(0, 0, 0)):
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = body; cu.size = size; cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.extrude = extrude
    try:
        cu.font = bpy.data.fonts.load(font)
    except Exception:
        pass
    o = bpy.data.objects.new(name, cu); link(o); o.location = loc; o.rotation_euler = rot
    cu.materials.append(mat)
    return o


def screen_mat(path, strength=1.0, rough=0.08):
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
