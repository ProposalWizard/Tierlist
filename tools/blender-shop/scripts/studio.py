"""Shared studio set-up for the shop product shots.

Everything here is built in code (no downloaded assets): a soft-box product
studio, a shadow-catcher floor (so the PNG is transparent with the shadow in
its alpha), a camera helper, a loft-mesh builder and a few materials.
"""
import bpy, bmesh, math, sys, time
from mathutils import Vector, Matrix


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_render(res=(600, 450), samples=48, look='AgX - Punchy', view='Standard'):
    scn = bpy.context.scene
    scn.render.engine = 'CYCLES'
    scn.cycles.device = 'CPU'
    scn.cycles.samples = samples
    scn.cycles.use_denoising = True
    scn.cycles.denoiser = 'OPENIMAGEDENOISE'
    scn.cycles.use_adaptive_sampling = True
    scn.cycles.adaptive_threshold = 0.015
    scn.cycles.max_bounces = 8
    scn.cycles.diffuse_bounces = 3
    scn.cycles.glossy_bounces = 4
    scn.cycles.transmission_bounces = 6
    scn.cycles.transparent_max_bounces = 6
    scn.render.film_transparent = True
    scn.render.resolution_x, scn.render.resolution_y = res
    scn.render.resolution_percentage = 100
    scn.view_settings.view_transform = view
    scn.view_settings.exposure = float(__import__('os').environ.get('EXPO', '-0.45'))
    if view == 'AgX':
        scn.view_settings.look = look
    scn.render.image_settings.file_format = 'PNG'
    scn.render.image_settings.color_mode = 'RGBA'
    scn.render.image_settings.color_depth = '8'
    scn.render.threads_mode = 'AUTO'


def world(strength=0.35, top=(0.55, 0.62, 0.8), bottom=(0.06, 0.07, 0.1)):
    """A soft gradient sky: brighter above, dark below. It is what chrome and
    gold reflect, so it needs some structure, not one flat colour."""
    scn = bpy.context.scene
    w = bpy.data.worlds.new('W'); scn.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes['Background']
    bg.inputs['Strength'].default_value = strength
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.42
    ramp.color_ramp.elements[0].color = (*bottom, 1)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (*top, 1)
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = -1
    mr.inputs['From Max'].default_value = 1
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    # Generated on the world = view direction; z = up
    nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])


def area(name, loc, energy, size, color=(1, 1, 1), aim=(0, 0, 0), shape='RECTANGLE', size_y=None, spread=None):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.energy = energy
    ld.shape = shape
    ld.size = size
    if size_y is not None:
        ld.size_y = size_y
    if spread is not None:
        ld.spread = spread
    ld.color = color
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    d = (Vector(aim) - Vector(loc))
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return ob


def studio_lights(scale=1.0, aim=(0, 0, 0), key=1.0):
    """Classic product lighting, sized relative to the object (scale = metres
    across the subject): a big soft key above-front-left, a strip fill on the
    right, a cool rim from behind and a top soft box for the long highlight."""
    s = scale
    a = Vector(aim)
    area('Key', a + Vector((-1.4 * s, -1.6 * s, 2.4 * s)), 300 * s * s * key, 0.9 * s, (1.0, 0.97, 0.92), aim=a, size_y=0.7 * s)
    area('Fill', a + Vector((2.2 * s, -1.6 * s, 0.9 * s)), 70 * s * s, 0.5 * s, (0.85, 0.9, 1.0), aim=a, size_y=2.0 * s)
    area('Rim', a + Vector((0.6 * s, 2.2 * s, 1.4 * s)), 260 * s * s, 1.2 * s, (0.7, 0.8, 1.0), aim=a, size_y=0.3 * s)
    area('Top', a + Vector((0.2 * s, 0.4 * s, 2.6 * s)), 60 * s * s, 2.2 * s, (1.0, 1.0, 1.0), aim=a, size_y=0.5 * s)


def shadow_catcher(z=0.0, size=40):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, z))
    p = bpy.context.object
    p.name = 'Ground'
    p.is_shadow_catcher = True
    return p


def camera(loc, target, lens=50):
    scn = bpy.context.scene
    cd = bpy.data.cameras.new('Cam'); cd.lens = lens
    cd.clip_start = 0.005
    cam = bpy.data.objects.new('Cam', cd)
    scn.collection.objects.link(cam)
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    scn.camera = cam
    return cam


def frame_objects(cam, objs, fill=0.82, offset=(0.0, 0.0), fill_y=None):
    """Fit every object's (evaluated) mesh into the frame: move the camera along
    its own view line until the subject spans `fill` of the tighter frame axis,
    then lens-shift so it sits centred (+ offset, in frame fractions)."""
    scn = bpy.context.scene
    from bpy_extras.object_utils import world_to_camera_view
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in objs:
        oe = o.evaluated_get(dg)
        if oe.type == 'MESH':
            me = oe.to_mesh()
            step = max(1, len(me.vertices) // 6000)
            pts += [oe.matrix_world @ me.vertices[i].co for i in range(0, len(me.vertices), step)]
            oe.to_mesh_clear()
    centre = sum(pts, Vector()) / len(pts)
    fwd = (cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))).normalized()
    rx, ry = scn.render.resolution_x, scn.render.resolution_y
    aspect = ry / rx
    for _ in range(40):
        bpy.context.view_layer.update()
        cs = [world_to_camera_view(scn, cam, p) for p in pts]
        xs = [c.x for c in cs]; ys = [c.y for c in cs]
        w = max(xs) - min(xs); h = max(ys) - min(ys)
        cx = (max(xs) + min(xs)) / 2; cy = (max(ys) + min(ys)) / 2
        k = max(w / fill, h / (fill_y or fill))
        dist = (cam.location - centre).dot(-fwd)
        cam.location = cam.location + fwd * dist * (1 - k) * 0.7
        cam.data.shift_x += (cx - 0.5 - offset[0]) * 0.7
        cam.data.shift_y += (cy - 0.5 - offset[1]) * aspect * 0.7
        if abs(k - 1) < 0.004 and abs(cx - 0.5 - offset[0]) < 0.003 and abs(cy - 0.5 - offset[1]) < 0.003:
            break
    return cam


# ---------------------------------------------------------------- geometry
def loft(name, sections, cap=True, smooth=True, subsurf=2):
    """sections: list of rings, each a list of (x,y,z) with the same count."""
    bm = bmesh.new()
    rings = [[bm.verts.new(p) for p in ring] for ring in sections]
    n = len(sections[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if cap:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    if subsurf:
        m = ob.modifiers.new('sub', 'SUBSURF')
        m.levels = subsurf; m.render_levels = subsurf
    return ob


def superellipse_ring(cy, cz, ry, rz, n=32, p_top=2.0, p_bot=3.5, taper=0.0, z0=None):
    """A rounded cross-section in the y-z plane. Bottom half squarer (p_bot),
    top half rounder (p_top). taper narrows the top."""
    pts = []
    for k in range(n):
        t = 2 * math.pi * k / n
        c, s = math.cos(t), math.sin(t)
        p = p_top if s >= 0 else p_bot
        y = ry * math.copysign(abs(c) ** (2 / p), c)
        z = rz * math.copysign(abs(s) ** (2 / p), s)
        if s > 0:
            y *= 1 - taper * s
        pts.append((cy + y, cz + z))
    return pts


def apply_mods(ob):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects:
        o.select_set(False)
    ob.select_set(True)
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def boolean(ob, cutter, op='DIFFERENCE', hide=True):
    m = ob.modifiers.new('bool', 'BOOLEAN')
    m.operation = op
    m.object = cutter
    m.solver = 'EXACT'
    try:
        m.material_mode = 'TRANSFER'
    except Exception:
        pass
    apply_mods(ob)
    if hide:
        bpy.data.objects.remove(cutter, do_unlink=True)


def set_mat(ob, mat):
    ob.data.materials.clear()
    ob.data.materials.append(mat)


# ---------------------------------------------------------------- materials
def srgb(c):
    """hex or 0-1 sRGB tuple -> linear tuple"""
    if isinstance(c, str):
        c = c.lstrip('#')
        c = tuple(int(c[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def principled(name, color, rough=0.5, metal=0.0, coat=0.0, coat_rough=0.05, spec=0.5, sheen=0.0, emission=None, emission_strength=0.0, alpha=1.0, transmission=0.0, ior=1.45):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    col = srgb(color) if not (isinstance(color, tuple) and len(color) == 4) else color[:3]
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Coat Roughness'].default_value = coat_rough
    b.inputs['Specular IOR Level'].default_value = spec
    b.inputs['Sheen Weight'].default_value = sheen
    b.inputs['Transmission Weight'].default_value = transmission
    b.inputs['IOR'].default_value = ior
    if emission is not None:
        b.inputs['Emission Color'].default_value = (*srgb(emission), 1)
        b.inputs['Emission Strength'].default_value = emission_strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    return m


def node(m, kind, **kw):
    n = m.node_tree.nodes.new(kind)
    for k, v in kw.items():
        setattr(n, k, v)
    return n


def link(m, a, b):
    m.node_tree.links.new(a, b)


GOLD = (1.0, 0.76, 0.33)


def gold(name='Gold', rough=0.3):
    return principled(name, (*srgb((1.0, 0.80, 0.42)), 1), rough=rough, metal=1.0)


def chrome(name='Chrome', rough=0.08):
    return principled(name, (*srgb((0.92, 0.93, 0.95)), 1), rough=rough, metal=1.0)


def add_grunge(m, amount=0.6, dirt='#5b4632', scale=18.0, rough_add=0.35, seed=0.0, zmask=None, strength=1.0):
    """Mix scuffs/dirt into a principled material's base colour + roughness."""
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    base = tuple(b.inputs['Base Color'].default_value)
    r0 = b.inputs['Roughness'].default_value
    tc = node(m, 'ShaderNodeTexCoord')
    noise = node(m, 'ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale
    noise.inputs['Detail'].default_value = 8
    noise.inputs['Roughness'].default_value = 0.65
    noise.noise_dimensions = '4D'
    noise.inputs['W'].default_value = seed
    link(m, tc.outputs['Object'], noise.inputs['Vector'])
    ramp = node(m, 'ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.5
    ramp.color_ramp.elements[1].position = 0.5 + 0.2 * (1 - amount) + 0.08
    ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    link(m, noise.outputs['Fac'], ramp.inputs['Fac'])
    fac = ramp.outputs['Color']
    if zmask is not None:
        sep = node(m, 'ShaderNodeSeparateXYZ'); link(m, tc.outputs['Object'], sep.inputs[0])
        zr = node(m, 'ShaderNodeMapRange')
        zr.inputs['From Min'].default_value = zmask[1]; zr.inputs['From Max'].default_value = zmask[0]
        link(m, sep.outputs['Z'], zr.inputs['Value'])
        mm = node(m, 'ShaderNodeMath'); mm.operation = 'MULTIPLY'
        link(m, fac, mm.inputs[0]); link(m, zr.outputs['Result'], mm.inputs[1])
        fac = mm.outputs['Value']
    if strength != 1.0:
        ms = node(m, 'ShaderNodeMath'); ms.operation = 'MULTIPLY'; ms.inputs[1].default_value = strength
        link(m, fac, ms.inputs[0]); fac = ms.outputs['Value']
    mix = node(m, 'ShaderNodeMix')
    mix.data_type = 'RGBA'
    bl = b.inputs['Base Color'].links
    if bl:
        link(m, bl[0].from_socket, mix.inputs['A'])
    else:
        mix.inputs['A'].default_value = base
    mix.inputs['B'].default_value = (*srgb(dirt), 1)
    link(m, fac, mix.inputs['Factor'])
    link(m, mix.outputs['Result'], b.inputs['Base Color'])
    rmix = node(m, 'ShaderNodeMapRange')
    rmix.inputs['To Min'].default_value = r0
    rmix.inputs['To Max'].default_value = min(1.0, r0 + rough_add)
    link(m, fac, rmix.inputs['Value'])
    link(m, rmix.outputs['Result'], b.inputs['Roughness'])
    # a little bump so the dirt isn't just paint
    bump = node(m, 'ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.15
    link(m, noise.outputs['Fac'], bump.inputs['Height'])
    link(m, bump.outputs['Normal'], b.inputs['Normal'])
    return m


def render(path, t0=None):
    scn = bpy.context.scene
    scn.render.filepath = path
    t = time.time()
    bpy.ops.render.render(write_still=True)
    dt = time.time() - t
    print(f'RENDERED {path} {dt:.1f}s', flush=True)
    return dt


def args():
    a = sys.argv
    return a[a.index('--') + 1:] if '--' in a else []
