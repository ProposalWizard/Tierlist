"""Knowitball 3D footballer — scene builder.

Base body: Quaternius "Universal Base Characters" (Standard, CC0 1.0).
Everything else (kit, boots, ball, lights, poses, render layers) is built here.

Conventions (rest pose, Blender world after glTF import):
  +X = the player's LEFT,  -Y = FORWARD (toes point -Y),  +Z = up.  Height 1.82 m.
"""
import bpy, bmesh, math, os
import numpy as np
from mathutils import Vector, Matrix, Quaternion, kdtree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
UBC = os.path.join(ROOT, 'assets', 'ubc')
BODY_GLTF = os.path.join(UBC, 'Base Characters', 'Godot - UE', 'Superhero_Male_FullBody.gltf')
TEX = os.path.join(UBC, 'Base Characters', 'Textures')
HAIR_DIR = os.path.join(UBC, 'Hairstyles', 'Rigged to Head Bone', 'glTF (Godot -Unreal)')

# neutral albedo the kit is rendered in; the compositor swaps it for club colours
KIT_BASE = 0.5

AOV_LIST = [('kitA', 'COLOR'), ('kitB', 'COLOR'), ('crest', 'COLOR'), ('num', 'COLOR')]


def srgb2lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


# ---------------------------------------------------------------- materials
def aov_out(nt, name, value):
    """write a colour into a named shader AOV (antialiased mask / uv pass)"""
    n = nt.nodes.new('ShaderNodeOutputAOV')
    n.aov_name = name
    if isinstance(value, tuple):
        n.inputs['Color'].default_value = (*value, 1)
    else:
        nt.links.new(value, n.inputs['Color'])
    return n


def fabric_mat(name, albedo, aovs, rough=0.62, knit=0.25):
    """kit fabric: neutral grey albedo, fine knit bump, writes its mask AOVs"""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (albedo, albedo, albedo, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Specular IOR Level'].default_value = 0.35
    if knit:
        tca = nt.nodes.new('ShaderNodeAttribute'); tca.attribute_name = 'rest'
        tc = type('T', (), {'outputs': {'Object': tca.outputs['Vector']}})
        # fine knit: stretched wave + noise
        w = nt.nodes.new('ShaderNodeTexWave')
        w.inputs['Scale'].default_value = 420
        w.inputs['Distortion'].default_value = 1.5
        w.wave_profile = 'SIN'
        nz = nt.nodes.new('ShaderNodeTexNoise')
        nz.inputs['Scale'].default_value = 900
        mx = nt.nodes.new('ShaderNodeMath'); mx.operation = 'ADD'
        nt.links.new(tc.outputs['Object'], w.inputs['Vector'])
        nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
        nt.links.new(w.outputs['Fac'], mx.inputs[0])
        nt.links.new(nz.outputs['Fac'], mx.inputs[1])
        bp = nt.nodes.new('ShaderNodeBump')
        bp.inputs['Strength'].default_value = knit
        bp.inputs['Distance'].default_value = 0.0004
        nt.links.new(mx.outputs[0], bp.inputs['Height'])
        # soft large-scale undulation so the cloth isn't perfectly smooth
        big = nt.nodes.new('ShaderNodeTexNoise')
        big.inputs['Scale'].default_value = 7.0
        big.inputs['Detail'].default_value = 2.0
        nt.links.new(tca.outputs['Vector'], big.inputs['Vector'])
        bp2 = nt.nodes.new('ShaderNodeBump')
        bp2.inputs['Strength'].default_value = 0.2
        bp2.inputs['Distance'].default_value = 0.01
        nt.links.new(big.outputs['Fac'], bp2.inputs['Height'])
        nt.links.new(bp2.outputs['Normal'], bp.inputs['Normal'])
        nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    for aname, val in aovs.items():
        aov_out(nt, aname, val)
    return m


def plain_mat(name, rgb, rough=0.5, coat=0.0, spec=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Specular IOR Level'].default_value = spec
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = 0.15
    return m


def decal_mat(name, aov_name, uv_name):
    """decal patch: looks exactly like the shirt/shorts in the beauty render,
    but writes (u, v, 1) into its own AOV so any crest/number can be
    projected onto it afterwards, perspective-correct and following the rig."""
    m = fabric_mat(name, KIT_BASE, {}, knit=0.25)
    nt = m.node_tree
    uv = nt.nodes.new('ShaderNodeUVMap'); uv.uv_map = uv_name
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    comb = nt.nodes.new('ShaderNodeCombineColor')
    nt.links.new(uv.outputs['UV'], sep.inputs['Vector'])
    nt.links.new(sep.outputs['X'], comb.inputs['Red'])
    nt.links.new(sep.outputs['Y'], comb.inputs['Green'])
    comb.inputs['Blue'].default_value = 1.0
    aov_out(nt, aov_name, comb.outputs['Color'])
    return m


# ---------------------------------------------------------------- import
def import_character(skin='dark', hair='Hair_SimpleParted', beard=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=BODY_GLTF)
    arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    arm.name = 'Rig'
    for o in list(bpy.data.objects):
        if o.name.startswith('Icosphere'):
            bpy.data.objects.remove(o)
    parts = [hair, 'Eyebrows_Regular'] + (['Hair_Beard'] if beard else [])
    for p in parts:
        if not p:
            continue
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(HAIR_DIR, p + '.gltf'))
        for o in set(bpy.data.objects) - before:
            if o.type == 'MESH' and not o.name.startswith('Icosphere'):
                o.parent = arm
                for md in o.modifiers:
                    if md.type == 'ARMATURE':
                        md.object = arm
        for o in set(bpy.data.objects) - before:
            if o.type == 'ARMATURE' or o.name.startswith('Icosphere'):
                bpy.data.objects.remove(o)
    # the pack ships its own eyebrows on the body; drop the duplicate import
    brows = [o for o in bpy.data.objects if o.name.startswith('Eyebrows')]
    for o in brows[1:]:
        bpy.data.objects.remove(o)
    fix_textures(skin)
    body = bpy.data.objects['SuperHero_Male']
    return arm, body


def fix_textures(skin):
    """relink the pack's textures (the glTF points at *_png.png names that
    don't exist) and pick a skin tone."""
    lookup = {f.lower(): os.path.join(TEX, f) for f in os.listdir(TEX) if f.endswith('.png')}
    hair_tex = os.path.join(UBC, 'Hairstyles', 'Textures')
    for f in os.listdir(hair_tex):
        if f.endswith('.png'):
            lookup[f.lower()] = os.path.join(hair_tex, f)
    for img in bpy.data.images:
        base = os.path.basename(img.filepath).replace('_png.png', '.png').lower()
        if base in lookup:
            img.filepath = lookup[base]
            img.reload()
    skin_file = {'dark': 'T_Superhero_Male_Dark.png', 'light': 'T_Superhero_Male_Ligh.png',
                 'medium': 'T_Superhero_Male_Dark.png'}[skin]
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image and 'Superhero_Male_D' in n.image.name or (
                    n.type == 'TEX_IMAGE' and n.image and 'Superhero_Male_L' in n.image.name):
                n.image = bpy.data.images.load(os.path.join(TEX, skin_file), check_existing=True)
    # skin: add a touch of subsurface; 'medium' brightens the dark map
    m = bpy.data.materials['MI_Superhero_Male']
    nt = m.node_tree
    b = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    b.inputs['Subsurface Weight'].default_value = 0.12
    b.inputs['Subsurface Radius'].default_value = (0.8, 0.35, 0.2)
    b.inputs['Subsurface Scale'].default_value = 0.01
    if skin == 'medium':
        link = b.inputs['Base Color'].links[0]
        hsv = nt.nodes.new('ShaderNodeHueSaturation')
        hsv.inputs['Value'].default_value = 1.45
        hsv.inputs['Saturation'].default_value = 0.92
        nt.links.new(link.from_socket, hsv.inputs['Color'])
        nt.links.new(hsv.outputs['Color'], b.inputs['Base Color'])


def set_hair_colour(rgb_mult):
    for m in bpy.data.materials:
        if m.name.startswith('MI_Hair'):
            nt = m.node_tree
            b = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
            if not b.inputs['Base Color'].links:
                continue
            src = b.inputs['Base Color'].links[0].from_socket
            mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'
            mul.inputs['Factor'].default_value = 1.0
            nt.links.new(src, mul.inputs['A'])
            mul.inputs['B'].default_value = (*rgb_mult, 1)
            nt.links.new(mul.outputs['Result'], b.inputs['Base Color'])


# ---------------------------------------------------------------- kit geometry
def world_co(ob):
    mw = np.array(ob.matrix_world)
    co = np.array([v.co for v in ob.data.vertices])
    return co @ mw[:3, :3].T + mw[:3, 3]


def dom_groups(ob):
    names = [g.name for g in ob.vertex_groups]
    out = []
    for v in ob.data.vertices:
        out.append(names[max(v.groups, key=lambda g: g.weight).group] if v.groups else '-')
    return np.array(out)


def shell_from_body(body, name, keep_vert, offset, smooth_iter, smooth_fac, flare=None,
                    min_gap=0.006, mat_fn=None, cuts=()):
    """duplicate the skinned body, keep a region, and turn it into a smooth
    loose garment shell (offset, laplacian-smoothed, kept outside the skin).
    Vertex groups are kept, so the garment deforms with the same rig."""
    ob = body.copy()
    ob.data = body.data.copy()
    ob.name = name
    ob.data.name = name
    bpy.context.scene.collection.objects.link(ob)
    ob.shape_key_clear() if ob.data.shape_keys else None
    co = world_co(body)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table()
    drop = [f for f in bm.faces if not all(keep_vert[v.index] for v in f.verts)]
    bmesh.ops.delete(bm, geom=drop, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    # glTF splits vertices along UV seams; weld them so seams aren't openings
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-4)
    # straight openings: slice with planes, drop the side the normal points to
    for pco, pno, region in cuts:
        pco, pno = Vector(pco), Vector(pno)
        geom = [e for e in bm.edges] + [f for f in bm.faces] + [v for v in bm.verts]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=pco, plane_no=pno)
        drop = [f for f in bm.faces if (f.calc_center_median() - pco).dot(pno) > 0 and region(f.calc_center_median())]
        bmesh.ops.delete(bm, geom=drop, context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.normal_update()
    # offset along normal (+ optional per-vertex flare)
    for v in bm.verts:
        d = offset + (flare(Vector(v.co)) if flare else 0.0)
        v.co += v.normal * d
    # laplacian smoothing keeps the boundary in place-ish
    for _ in range(smooth_iter):
        bmesh.ops.smooth_vert(bm, verts=[v for v in bm.verts if not v.is_boundary],
                              factor=smooth_fac, use_axis_x=True, use_axis_y=True, use_axis_z=True)
        # boundary: smooth only ALONG the opening (no retraction into the cloth)
        bverts = [v for v in bm.verts if v.is_boundary]
        newco = {}
        for v in bverts:
            nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(nb) == 2:
                avg = (nb[0].co + nb[1].co) * 0.5
                newco[v] = v.co.lerp(avg, 0.3)
        for v, c in newco.items():
            v.co = c
    bm.to_mesh(ob.data)
    bm.free()
    # push anything that ended up inside the skin back out
    tree_body_push(ob, body, min_gap)
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.data.materials.clear()
    return ob


def tree_body_push(ob, body, gap):
    """shrinkwrap 'outside surface' applied in rest pose"""
    arm_mods = [m for m in ob.modifiers if m.type == 'ARMATURE']
    for m in arm_mods:
        m.show_viewport = False
        m.show_render = False
    sw = ob.modifiers.new('push', 'SHRINKWRAP')
    sw.target = body
    sw.wrap_method = 'NEAREST_SURFACEPOINT'
    sw.wrap_mode = 'OUTSIDE_SURFACE'
    sw.offset = gap
    # move to top of stack and apply
    bpy.context.view_layer.objects.active = ob
    while ob.modifiers[0].name != 'push':
        bpy.ops.object.modifier_move_up(modifier='push')
    body_arm = [m for m in body.modifiers if m.type == 'ARMATURE']
    for m in body_arm:
        m.show_viewport = False
    bpy.ops.object.modifier_apply(modifier='push')
    for m in body_arm:
        m.show_viewport = True
    for m in arm_mods:
        m.show_viewport = True
        m.show_render = True


def boundary_distance(ob):
    """per-vertex euclidean distance to the nearest open (boundary) edge"""
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bverts = [v.co.copy() for v in bm.verts if v.is_boundary]
    bm.free()
    kd = kdtree.KDTree(len(bverts))
    for i, c in enumerate(bverts):
        kd.insert(c, i)
    kd.balance()
    return np.array([kd.find(v.co)[2] for v in ob.data.vertices]), kd


def assign_faces(ob, fn):
    """fn(face_center Vector) -> material index"""
    for p in ob.data.polygons:
        p.material_index = fn(p.center)


def store_rest_attrs(ob):
    """rest position + distance-to-opening as point attributes; they ride
    through armature/solidify/subsurf so shader masks stay glued to the cloth"""
    me = ob.data
    co = world_co(ob)
    bd, _ = boundary_distance(ob)
    at = me.attributes.new('rest', 'FLOAT_VECTOR', 'POINT')
    at.data.foreach_set('vector', co.astype(np.float32).ravel())
    at2 = me.attributes.new('bdist', 'FLOAT', 'POINT')
    at2.data.foreach_set('value', bd.astype(np.float32))


class MaskBuilder:
    """small helper to write smooth mask maths as shader nodes"""
    def __init__(self, nt):
        self.nt = nt
        r = nt.nodes.new('ShaderNodeAttribute'); r.attribute_name = 'rest'
        d = nt.nodes.new('ShaderNodeAttribute'); d.attribute_name = 'bdist'
        sp = nt.nodes.new('ShaderNodeSeparateXYZ')
        nt.links.new(r.outputs['Vector'], sp.inputs['Vector'])
        ab = nt.nodes.new('ShaderNodeMath'); ab.operation = 'ABSOLUTE'
        nt.links.new(sp.outputs['X'], ab.inputs[0])
        self.x, self.ax, self.y, self.z = sp.outputs['X'], ab.outputs[0], sp.outputs['Y'], sp.outputs['Z']
        self.bd = d.outputs['Fac']

    def step(self, sock, lo, hi):
        """0 below lo, 1 above hi (smoothstep)"""
        m = self.nt.nodes.new('ShaderNodeMapRange')
        m.interpolation_type = 'SMOOTHSTEP'
        m.inputs['From Min'].default_value = lo
        m.inputs['From Max'].default_value = hi
        self.nt.links.new(sock, m.inputs['Value'])
        return m.outputs['Result']

    def op(self, kind, a, b=None, const=None):
        m = self.nt.nodes.new('ShaderNodeMath'); m.operation = kind
        for i, v in enumerate((a, b)):
            if v is None:
                if const is not None and i == 1:
                    m.inputs[1].default_value = const
                continue
            if isinstance(v, (int, float)):
                m.inputs[i].default_value = v
            else:
                self.nt.links.new(v, m.inputs[i])
        m.use_clamp = True
        return m.outputs[0]

    def inv(self, a):
        return self.op('SUBTRACT', 1.0, a)

    def mul(self, a, b):
        return self.op('MULTIPLY', a, b)

    def rgb(self, r, g, b):
        c = self.nt.nodes.new('ShaderNodeCombineColor')
        for i, v in enumerate((r, g, b)):
            if isinstance(v, (int, float)):
                c.inputs[i].default_value = v
            else:
                self.nt.links.new(v, c.inputs[i])
        return c.outputs[0]


KIT_REGIONS = ['shirt', 'sleeve', 'shorts', 'socks', 'trim', 'band']


def garment_mat(name, regions_fn, knit=0.25, rough=0.62):
    """one material per garment. regions_fn(MaskBuilder) -> {region: mask socket}.
    Writes kitA=(shirt,sleeve,shorts) kitB=(socks,trim,band) AOVs and, in
    PREVIEW mode, mixes preview club colours by the same masks."""
    m = fabric_mat(name, KIT_BASE, {}, knit=knit, rough=rough)
    nt = m.node_tree
    mb = MaskBuilder(nt)
    reg = regions_fn(mb)
    g = lambda k: reg.get(k, 0.0)
    aov_out(nt, 'kitA', mb.rgb(g('shirt'), g('sleeve'), g('shorts')))
    aov_out(nt, 'kitB', mb.rgb(g('socks'), g('trim'), g('band')))
    m['regions'] = list(reg.keys())
    m['_mb'] = 0
    GARMENT_MASKS[name] = reg
    return m


GARMENT_MASKS = {}


def build_kit(body, arm, v_neck=True):
    co = world_co(body)
    dom = dom_groups(body)
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    ax = np.abs(x)
    head_neck = np.isin(dom, ['Head', 'neck_01'])

    # ---------- shirt: torso + short sleeves, V-neck, loose hem
    sleeve_end = 0.43
    shirt_keep = (z > 0.84) & (z < 1.60) & (ax < sleeve_end)
    rad = np.sqrt(x ** 2 + (y - 0.035) ** 2)
    shirt_keep &= ~((z > 1.505) & (rad < 0.104))           # crew opening round the neck
    shirt_keep &= ~((z > 1.555) & (ax < 0.14))
    if v_neck:
        shirt_keep &= ~((y < 0.02) & (z > 1.43 + 2.2 * ax) & (ax < 0.07))
    def shirt_flare(c):
        f = 0.0
        a = abs(c.x)
        if a > 0.26:
            f += 0.03 * (a - 0.26)
        # tighter over the deltoid so a lowered arm doesn't bunch into a hump
        if 0.15 < a < 0.33 and c.z > 1.36:
            f -= 0.010 * min(1.0, (c.z - 1.36) / 0.08)
        if True:
            f += 0.032 * (1.08 - c.z) / 0.21 if c.z < 1.08 else 0.0
        return f
    ALL = lambda c: True
    shirt = shell_from_body(body, 'Shirt', shirt_keep, 0.022, 32, 0.6, flare=shirt_flare, min_gap=0.013,
                            cuts=[((0, 0, 0.872), (0, 0, -1), lambda c: abs(c.x) < 0.3),
                                  ((0.395, 0, 0), (1, 0, 0), ALL), ((-0.395, 0, 0), (-1, 0, 0), ALL)])

    # ---------- shorts: waist to mid-thigh, loose legs
    shorts_keep = (z > 0.57) & (z < 1.07) & ~(np.isin(dom, ['calf_l', 'calf_r'])) & (ax < 0.26)
    def shorts_flare(c):
        return 0.03 * max(0.0, (0.90 - c.z) / 0.28)
    shorts = shell_from_body(body, 'Shorts', shorts_keep, 0.022, 30, 0.6, flare=shorts_flare, min_gap=0.009,
                             cuts=[((0, 0, 0.605), (0, 0, -1), ALL)])

    # ---------- socks
    socks_keep = (z > 0.06) & (z < 0.50) & np.isin(dom, ['calf_l', 'calf_r', 'foot_l', 'foot_r'])
    socks = shell_from_body(body, 'Socks', socks_keep, 0.005, 5, 0.4, min_gap=0.004,
                            cuts=[((0, 0, 0.472), (0, 0, 1), ALL)])

    # ---------- boots
    boots_keep = (z < 0.16) & np.isin(dom, ['foot_l', 'foot_r', 'ball_l', 'ball_r', 'calf_l', 'calf_r'])
    boots = shell_from_body(body, 'Boots', boots_keep, 0.010, 10, 0.6, min_gap=0.007,
                            cuts=[((0, 0.1, 0.125), (0, 0.35, 1), ALL)])

    for g in (shirt, shorts, socks, boots):
        store_rest_attrs(g)

    def shirt_regions(mb):
        neck = mb.mul(mb.inv(mb.step(mb.bd, 0.017, 0.020)), mb.step(mb.z, 1.36, 1.37))
        cuff = mb.mul(mb.inv(mb.step(mb.bd, 0.019, 0.022)), mb.step(mb.ax, 0.33, 0.34))
        trim = mb.op('MAXIMUM', neck, cuff)
        sleeve = mb.mul(mb.mul(mb.step(mb.ax, 0.226, 0.232), mb.step(mb.z, 1.30, 1.31)), mb.inv(trim))
        body_ = mb.mul(mb.inv(sleeve), mb.inv(trim))
        return dict(shirt=body_, sleeve=sleeve, trim=trim)

    def shorts_regions(mb):
        trim = mb.mul(mb.inv(mb.step(mb.bd, 0.016, 0.019)), mb.inv(mb.step(mb.z, 0.80, 0.81)))
        return dict(shorts=mb.inv(trim), trim=trim)

    def socks_regions(mb):
        band = mb.step(mb.z, 0.424, 0.428)
        return dict(socks=mb.inv(band), band=band)

    shirt.data.materials.append(garment_mat('K_Shirt', shirt_regions))
    shorts.data.materials.append(garment_mat('K_Shorts', shorts_regions))
    socks.data.materials.append(garment_mat('K_Socks', socks_regions, knit=0.45))

    # boots: glossy black upper, white sole, white side flash (not recoloured)
    bm_ = bpy.data.materials.new('K_Boot'); bm_.use_nodes = True
    nt = bm_.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.3
    bsdf.inputs['Coat Weight'].default_value = 0.6
    bsdf.inputs['Coat Roughness'].default_value = 0.15
    mb = MaskBuilder(nt)
    sole = mb.inv(mb.step(mb.z, 0.018, 0.021))
    flash = mb.mul(mb.mul(mb.step(mb.z, 0.036, 0.039), mb.inv(mb.step(mb.z, 0.058, 0.061))),
                   mb.mul(mb.step(mb.ax, 0.125, 0.128), mb.mul(mb.step(mb.y, -0.11, -0.10), mb.inv(mb.step(mb.y, 0.05, 0.06)))))
    white = mb.op('MAXIMUM', sole, flash)
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    nt.links.new(white, mix.inputs['Factor'])
    mix.inputs['A'].default_value = (*srgb2lin('#141519'), 1)
    mix.inputs['B'].default_value = (*srgb2lin('#e8eaee'), 1)
    nt.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])
    boots.data.materials.append(bm_)

    for ob, th in ((shirt, 0.004), (shorts, 0.004), (socks, 0.002), (boots, 0.003)):
        so = ob.modifiers.new('thick', 'SOLIDIFY')
        so.thickness = th
        so.offset = 1.0
        so.use_rim = True
        ss = ob.modifiers.new('subd', 'SUBSURF')
        ss.levels = 1
        ss.render_levels = 2

    crest = make_decal(shirt, 'Crest', center=Vector((0.085, -0.13, 1.37)), size=0.085,
                       mat=decal_mat('K_CrestDecal', 'crest', 'DecalUV'))
    number = make_decal(shorts, 'Number', center=Vector((-0.115, -0.11, 0.76)), size=0.10,
                        mat=decal_mat('K_NumberDecal', 'num', 'DecalUV'))
    hide_covered_skin(body, [shirt, shorts, socks, boots])
    return dict(shirt=shirt, shorts=shorts, socks=socks, boots=boots, crest=crest, number=number)


def make_decal(garment, name, center, size, mat):
    """cut a square patch out of a garment's front, lift it 1.5 mm, give it a
    planar 0..1 UV. It keeps the garment's weights so it follows the rig."""
    ob = garment.copy()
    ob.data = garment.data.copy()
    ob.name = name
    bpy.context.scene.collection.objects.link(ob)
    for m in list(ob.modifiers):
        if m.type != 'ARMATURE':
            ob.modifiers.remove(m)
    bm = bmesh.new(); bm.from_mesh(ob.data)
    # subdivide so the patch has enough resolution
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
    half = size * 0.75
    drop = [f for f in bm.faces if not (abs(f.calc_center_median().x - center.x) < half and
                                         abs(f.calc_center_median().z - center.z) < half and
                                         f.calc_center_median().y < center.y + 0.06 and
                                         f.normal.y < -0.3)]
    bmesh.ops.delete(bm, geom=drop, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * 0.0046      # garment solidify is 4 mm outward
    uv = bm.loops.layers.uv.new('DecalUV')
    for f in bm.faces:
        for l in f.loops:
            u = (l.vert.co.x - center.x) / size + 0.5
            vv = (l.vert.co.z - center.z) / size + 0.5
            l[uv].uv = (u, vv)
    bm.to_mesh(ob.data); bm.free()
    ob.data.materials.clear()
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    ss = ob.modifiers.new('subd', 'SUBSURF'); ss.levels = 1; ss.render_levels = 2
    ob.visible_shadow = False          # no shadow line round the patch edge
    return ob


def hide_covered_skin(body, garments, margin=0.045):
    """delete body faces that sit well inside a garment (> margin from any
    garment opening), so skin can't poke through the cloth when posed."""
    co = world_co(body)
    kd = kdtree.KDTree(sum(len(g.data.vertices) for g in garments))
    bdist = []
    i = 0
    for g in garments:
        bd, _ = boundary_distance(g)
        gco = world_co(g)
        for c, d in zip(gco, bd):
            kd.insert(Vector(c), i); bdist.append(d); i += 1
    kd.balance()
    hide = np.zeros(len(co), bool)
    for vi, c in enumerate(co):
        _, j, dist = kd.find(Vector(c))
        if dist < 0.06 and bdist[j] > margin:
            hide[vi] = True
    vg = body.vertex_groups.new(name='visible_skin')
    vg.add([int(i) for i in np.where(~hide)[0]], 1.0, 'REPLACE')
    mk = body.modifiers.new('hide_under_kit', 'MASK')
    mk.vertex_group = 'visible_skin'
    bpy.context.view_layer.objects.active = body
    while body.modifiers[0].name != 'hide_under_kit':
        bpy.ops.object.modifier_move_up(modifier='hide_under_kit')


PREVIEW = None   # e.g. {'shirt': '#034694', ...}: render straight in club colours


def preview_colours(c):
    """debug/preview only: bake club colours straight into the kit materials
    (mixing by the same masks the compositor uses)"""
    for mn, reg in GARMENT_MASKS.items():
        m = bpy.data.materials[mn]
        nt = m.node_tree
        b = nt.nodes['Principled BSDF']
        acc = None
        for k, sock in reg.items():
            mul = nt.nodes.new('ShaderNodeVectorMath'); mul.operation = 'SCALE'
            mul.inputs[0].default_value = srgb2lin(c[k])
            nt.links.new(sock, mul.inputs['Scale'])
            if acc is None:
                acc = mul.outputs[0]
            else:
                ad = nt.nodes.new('ShaderNodeVectorMath'); ad.operation = 'ADD'
                nt.links.new(acc, ad.inputs[0]); nt.links.new(mul.outputs[0], ad.inputs[1])
                acc = ad.outputs[0]
        nt.links.new(acc, b.inputs['Base Color'])
    for mn, key in (('K_CrestDecal', 'shirt'), ('K_NumberDecal', 'shorts')):
        m = bpy.data.materials.get(mn)
        if m:
            m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*srgb2lin(c[key]), 1)


# ---------------------------------------------------------------- ball
def make_ball(radius=0.11):
    """classic truncated-icosahedron ball: faces coloured by the 32-face
    Voronoi (12 pentagons, 20 hexagons) on a fine icosphere."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=5, radius=radius)
    phi = (1 + 5 ** 0.5) / 2
    ico = [Vector(v).normalized() for v in
           [(-1, phi, 0), (1, phi, 0), (-1, -phi, 0), (1, -phi, 0), (0, -1, phi), (0, 1, phi),
            (0, -1, -phi), (0, 1, -phi), (phi, 0, -1), (phi, 0, 1), (-phi, 0, -1), (-phi, 0, 1)]]
    # hexagon centres = icosahedron face centres
    tris = []
    for i in range(12):
        for j in range(i + 1, 12):
            for k in range(j + 1, 12):
                if all((ico[a] - ico[b]).length < 1.2 for a, b in ((i, j), (j, k), (i, k))):
                    tris.append((ico[i] + ico[j] + ico[k]).normalized())
    dp, dh = 2.32744, 2.26728
    me = bpy.data.meshes.new('Ball')
    for f in bm.faces:
        n = f.calc_center_median().normalized()
        bp = max(n.dot(p) for p in ico) / dp
        bh = max(n.dot(h) for h in tris) / dh
        f.material_index = 1 if bp > bh else 0
        f.smooth = True
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('Ball', me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(plain_mat('Ball_White', (0.82, 0.82, 0.82), rough=0.35, coat=0.4))
    me.materials.append(plain_mat('Ball_Black', (0.012, 0.012, 0.014), rough=0.35, coat=0.4))
    return ob


# ---------------------------------------------------------------- posing
def rest_axis_local(pb, axis):
    """a rest-pose armature-space axis expressed in the bone's local frame"""
    return (pb.bone.matrix_local.to_3x3().inverted() @ Vector(axis)).normalized()


AX = {'x': (1, 0, 0), 'y': (0, 1, 0), 'z': (0, 0, 1)}


def apply_pose(arm, pose, loc=None):
    """pose: {bone: [(axis, degrees), ...]} — rotations about REST axes
    (x = player's left, y = backward, z = up), carried by the parent (FK)."""
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
    for bone, rots in pose.items():
        pb = arm.pose.bones.get(bone)
        if pb is None:
            continue
        q = Quaternion()
        for ax, deg in rots:
            a = AX[ax] if isinstance(ax, str) else ax
            q = Quaternion(rest_axis_local(pb, a), math.radians(deg)) @ q
        pb.rotation_quaternion = q
    if loc is not None:
        pb = arm.pose.bones['pelvis']
        pb.location = pb.bone.matrix_local.to_3x3().inverted() @ Vector(loc)


def mirror_pose(pose):
    """left<->right mirror of a pose dict"""
    out = {}
    for bone, rots in pose.items():
        nb = bone.replace('_l', '#').replace('_r', '_l').replace('#', '_r') if bone.endswith(('_l', '_r')) or '_l' in bone or '_r' in bone else bone
        nr = []
        for ax, deg in rots:
            if ax == 'x':
                nr.append(('x', deg))
            else:
                nr.append((ax, -deg))
        out[nb] = nr
    return out


def key_pose(arm, frame):
    for pb in arm.pose.bones:
        pb.keyframe_insert('rotation_quaternion', frame=frame)
        pb.keyframe_insert('location', frame=frame)


def fingers(side, curl, thumb=20, index=None):
    """curl every finger of one hand. left fingers point +x (palm down in
    rest), curl = rotate about rest +y (left) / -y (right)."""
    s = 1 if side == 'l' else -1
    out = {}
    for f in ('index', 'middle', 'ring', 'pinky'):
        c = curl if (f != 'index' or index is None) else index
        spread = {'index': 0, 'middle': 0, 'ring': 0, 'pinky': 0}[f]
        out[f'{f}_01_{side}'] = [('y', s * c * 0.8)]
        out[f'{f}_02_{side}'] = [('y', s * c * 1.0)]
        out[f'{f}_03_{side}'] = [('y', s * c * 0.8)]
    # fitted numerically (scripts/thumbfit.py): at thumb=50 the tip rests on
    # the index/middle middle knuckles, i.e. a closed fist
    out[f'thumb_01_{side}'] = [('z', s * thumb * 0.6), ('y', s * thumb * 0.2), ('x', thumb * 0.4)]
    out[f'thumb_02_{side}'] = [('y', -s * thumb * 0.8)]
    out[f'thumb_03_{side}'] = [('y', -s * thumb * 0.64)]
    return out


# ---------------------------------------------------------------- scene
def setup_render(res=(512, 768), samples=24):
    scn = bpy.context.scene
    scn.render.engine = 'CYCLES'
    scn.cycles.device = 'CPU'
    scn.cycles.samples = samples
    scn.cycles.use_denoising = True
    scn.cycles.denoiser = 'OPENIMAGEDENOISE'
    scn.cycles.use_adaptive_sampling = True
    scn.cycles.adaptive_threshold = 0.02
    scn.cycles.max_bounces = 6
    scn.cycles.diffuse_bounces = 3
    scn.cycles.glossy_bounces = 2
    scn.cycles.transparent_max_bounces = 4
    scn.render.film_transparent = True
    scn.render.resolution_x, scn.render.resolution_y = res
    scn.render.resolution_percentage = 100
    scn.render.use_persistent_data = True
    scn.view_settings.view_transform = 'Standard'
    scn.view_settings.look = 'None'
    scn.view_settings.exposure = 0.0
    scn.render.image_settings.file_format = 'PNG'
    scn.render.image_settings.color_mode = 'RGBA'
    scn.render.threads_mode = 'AUTO'


def setup_world_and_lights(target=Vector((0, 0, 1.0))):
    scn = bpy.context.scene
    w = bpy.data.worlds.new('W'); scn.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.03, 0.045, 0.09, 1)
    bg.inputs['Strength'].default_value = 1.0

    def area(name, loc, energy, size, color, aim=target):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy; ld.size = size; ld.color = color
        ob = bpy.data.objects.new(name, ld)
        scn.collection.objects.link(ob)
        ob.location = loc
        d = (aim - Vector(loc))
        ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        return ob
    # floodlit stadium: warm key front-left-high, soft fill, two cool rims
    area('Key', (-2.2, -3.4, 4.2), 260, 2.2, (1.0, 0.95, 0.88))
    area('Fill', (3.2, -2.8, 1.6), 45, 3.0, (0.8, 0.86, 1.0))
    area('RimL', (-2.6, 2.6, 3.0), 220, 1.2, (0.55, 0.7, 1.0))
    area('RimR', (2.6, 2.4, 2.6), 200, 1.2, (0.6, 0.75, 1.0))
    area('Top', (0, 0.3, 5.5), 70, 2.5, (0.9, 0.95, 1.0))


def shadow_catcher(size=12):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0))
    p = bpy.context.object
    p.name = 'Ground'
    p.is_shadow_catcher = True
    return p


def camera(loc, target, lens=50):
    scn = bpy.context.scene
    cd = bpy.data.cameras.new('Cam'); cd.lens = lens
    cam = bpy.data.objects.new('Cam', cd)
    scn.collection.objects.link(cam)
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    scn.camera = cam
    return cam


def setup_layers(out_dir, prefix):
    """compositor: write beauty + layers the recolourer needs, as PNGs.
    beauty.png  RGBA 8-bit sRGB (Standard view)
    shade.png   RGB 16-bit, sRGB-encoded (DiffDir+DiffInd)/4 : the light the kit receives
    kitA.png    RGB 16-bit masks  R shirt body, G sleeves, B shorts
    kitB.png    RGB 16-bit masks  R socks, G trim, B sock band
    crest.png / num.png  RGB 16-bit  (u*cov, v*cov, cov)
    """
    scn = bpy.context.scene
    vl = scn.view_layers[0]
    vl.use_pass_diffuse_direct = True
    vl.use_pass_diffuse_indirect = True
    for name, t in AOV_LIST:
        if name not in [a.name for a in vl.aovs]:
            a = vl.aovs.add(); a.name = name; a.type = t
    scn.use_nodes = True
    nt = scn.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    rl = nt.nodes.new('CompositorNodeRLayers')
    comp = nt.nodes.new('CompositorNodeComposite')
    nt.links.new(rl.outputs['Image'], comp.inputs['Image'])
    add = nt.nodes.new('CompositorNodeMixRGB'); add.blend_type = 'ADD'
    add.inputs[0].default_value = 1.0
    nt.links.new(rl.outputs['DiffDir'], add.inputs[1])
    nt.links.new(rl.outputs['DiffInd'], add.inputs[2])
    # the light pass isn't denoised by the render denoiser: do it here (OIDN)
    vl.cycles.denoising_store_passes = True
    dn = nt.nodes.new('CompositorNodeDenoise')
    dn.prefilter = 'ACCURATE'
    nt.links.new(add.outputs[0], dn.inputs['Image'])
    nt.links.new(rl.outputs['Denoising Normal'], dn.inputs['Normal'])
    sc = nt.nodes.new('CompositorNodeMixRGB'); sc.blend_type = 'MULTIPLY'
    sc.inputs[0].default_value = 1.0
    nt.links.new(dn.outputs[0], sc.inputs[1])
    sc.inputs[2].default_value = (0.25, 0.25, 0.25, 1)

    def fout(name, sock, depth='16', mode='RGB'):
        fo = nt.nodes.new('CompositorNodeOutputFile')
        fo.base_path = out_dir
        fo.format.file_format = 'PNG'
        fo.format.color_mode = mode
        fo.format.color_depth = depth
        fo.format.color_management = 'OVERRIDE'
        fo.format.view_settings.view_transform = 'Standard'
        fo.format.view_settings.look = 'None'
        fo.file_slots[0].path = f'{prefix}{name}_'
        nt.links.new(sock, fo.inputs[0])
        return fo
    fout('shade', sc.outputs[0])
    for name, _ in AOV_LIST:
        fout(name, rl.outputs[name])
    return nt


# ---------------------------------------------------------------- IK + grounding
def clear_ik(arm):
    for pb in arm.pose.bones:
        for c in list(pb.constraints):
            pb.constraints.remove(c)
    for o in list(bpy.data.objects):
        if o.name.startswith('IK_'):
            bpy.data.objects.remove(o)


def ik(arm, bone, target, pole, chain=2, pole_angle=-90):
    """pin the tail of `bone` (e.g. lowerarm -> wrist) to a world point"""
    t = bpy.data.objects.get('IK_' + bone) or bpy.data.objects.new('IK_' + bone, None)
    if t.name not in bpy.context.scene.collection.objects:
        bpy.context.scene.collection.objects.link(t)
    p = bpy.data.objects.get('IK_p' + bone) or bpy.data.objects.new('IK_p' + bone, None)
    if p.name not in bpy.context.scene.collection.objects:
        bpy.context.scene.collection.objects.link(p)
    t.parent = arm; p.parent = arm
    t.location = target
    p.location = pole
    pb = arm.pose.bones[bone]
    c = pb.constraints.new('IK')
    c.target = t
    c.pole_target = p
    c.pole_angle = math.radians(pole_angle)
    c.chain_count = chain
    return t, p


def bone_world(arm, name, tail=False):
    bpy.context.view_layer.update()
    pb = arm.pose.bones[name]
    return arm.matrix_world @ (pb.tail if tail else pb.head)


def ground(arm, bones=('foot_l', 'foot_r'), height=0.086):
    """shift the whole rig so the lowest of `bones` heads sits at `height`"""
    zmin = min(bone_world(arm, b).z for b in bones)
    arm.location.z += height - zmin
    bpy.context.view_layer.update()


def set_pose(arm, spec, ball=None):
    """apply a pose spec from poses.py: FK, IK, grounding, ball placement"""
    clear_ik(arm)
    arm.location = (0, 0, 0)
    apply_pose(arm, spec['fk'], loc=spec.get('loc'))
    for bone, tgt, pole, pa in spec.get('ik', []):
        ik(arm, bone, tgt, pole, pole_angle=pa)
    bpy.context.view_layer.update()
    if spec.get('ground'):
        bones, h = spec['ground']
        ground(arm, bones, h)
    if ball is not None:
        if spec.get('ball'):
            ball.hide_render = False
            ball.location = spec['ball']
        else:
            ball.hide_render = True


def build_scene(skin='dark', hair='Hair_SimpleParted', hair_rgb=(0.16, 0.11, 0.08), beard=False,
                res=(512, 768), samples=24, style=None, colour='brown'):
    """style=None keeps the original look (pack crop, dark-brown multiply)
    used for the first stills/animations; style='buzz'|'crop'|'afro'|'long'
    uses the hair system below."""
    arm, body = import_character(skin, None if style else hair, beard)
    if style:
        add_hair(arm, style, colour)
    else:
        set_hair_colour(hair_rgb)
    kit = build_kit(body, arm)
    ball = make_ball()
    setup_render(res, samples)
    setup_world_and_lights()
    shadow_catcher()
    return arm, body, kit, ball


# ---------------------------------------------------------------- hair
# Two techniques, both renderable in Cycles at sprite size:
#  * sculpted hair-card meshes from the CC0 pack (buzz, crop, long) — rigged to
#    the Head bone, recoloured with a luminance-keeping tint;
#  * real curve hair (particle strands, Principled Hair BSDF) for the afro/curls,
#    grown from the buzz-cut cap so it follows the head bone.
HAIR_STYLES = {
    'buzz': dict(mesh=['Hair_Buzzed'], label='BUZZ CUT'),
    'crop': dict(mesh=['Hair_SimpleParted'], label='SHORT CROP'),
    'afro': dict(mesh=['Hair_Buzzed'], strands=dict(length=0.05, count=2600), label='CURLY / AFRO'),
    'long': dict(mesh=['Hair_Buzzed', 'Hair_Long'], label='LONG'),
}
# sRGB tint for the card meshes, melanin/redness for the strands
HAIR_COLOURS = {
    'black': dict(rgb='#1a1411', melanin=0.92, red=0.25),
    'brown': dict(rgb='#5a3a22', melanin=0.62, red=0.45),
    'blonde': dict(rgb='#c9a063', melanin=0.22, red=0.35),
}


def _import_hair_mesh(arm, name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(HAIR_DIR, name + '.gltf'))
    mesh = None
    for o in set(bpy.data.objects) - before:
        if o.type == 'MESH' and not o.name.startswith('Icosphere'):
            o.parent = arm
            for md in o.modifiers:
                if md.type == 'ARMATURE':
                    md.object = arm
            mesh = o
        else:
            bpy.data.objects.remove(o)
    mesh.name = name
    return mesh


def hair_mesh_mat(name, colour):
    """card-mesh hair: the pack's strand texture as detail, tinted to colour"""
    tex_path = os.path.join(UBC, 'Hairstyles', 'Textures', 'T_Hair_1_BaseColor.png')
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage')
    t.image = bpy.data.images.load(tex_path, check_existing=True)
    bw = nt.nodes.new('ShaderNodeRGBToBW')
    nt.links.new(t.outputs['Color'], bw.inputs['Color'])
    # normalise the texture's luminance around 1 so it only adds strand detail
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = 0.0
    mr.inputs['From Max'].default_value = 0.6
    mr.inputs['To Min'].default_value = 0.55
    mr.inputs['To Max'].default_value = 1.25
    nt.links.new(bw.outputs['Val'], mr.inputs['Value'])
    mul = nt.nodes.new('ShaderNodeVectorMath'); mul.operation = 'SCALE'
    mul.inputs[0].default_value = srgb2lin(colour['rgb'])
    nt.links.new(mr.outputs['Result'], mul.inputs['Scale'])
    nt.links.new(mul.outputs[0], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.42
    b.inputs['Specular IOR Level'].default_value = 0.55
    b.inputs['Coat Weight'].default_value = 0.15
    return m


def hair_strand_mat(colour):
    m = bpy.data.materials.new('HairStrands')
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type == 'BSDF_PRINCIPLED':
            nt.nodes.remove(n)
    h = nt.nodes.new('ShaderNodeBsdfHairPrincipled')
    h.parametrization = 'MELANIN'
    h.inputs['Melanin'].default_value = colour['melanin']
    h.inputs['Melanin Redness'].default_value = colour['red']
    h.inputs['Roughness'].default_value = 0.55
    h.inputs['Radial Roughness'].default_value = 0.6
    h.inputs['Random Roughness'].default_value = 0.2
    h.inputs['Random Color'].default_value = 0.15
    out = nt.nodes['Material Output']
    nt.links.new(h.outputs[0], out.inputs['Surface'])
    return m


def add_curls(cap, colour, length=0.055, count=2600, sweep=None, curl=True):
    """afro / tight curls: particle hair grown along the cap's normals with a
    curl kink, clumped, as round Cycles curves"""
    cap.modifiers.new('curls', 'PARTICLE_SYSTEM')
    ps = cap.particle_systems[-1].settings
    ps.type = 'HAIR'
    ps.count = count
    ps.use_advanced_hair = True          # length comes from the emission velocity
    ps.emit_from = 'FACE'
    ps.use_emit_random = True
    ps.normal_factor = length if sweep is None else length * 0.12
    if sweep is not None:                # comb back (+y) and a little down
        ps.object_align_factor = sweep
    ps.hair_length = length
    ps.child_type = 'INTERPOLATED'
    ps.rendered_child_count = 14
    ps.child_percent = 3
    ps.child_length = 1.0
    ps.child_radius = 0.012
    ps.clump_factor = 0.35
    ps.kink = 'CURL' if curl else 'WAVE'
    ps.kink_amplitude = 0.0055 if curl else 0.004
    ps.kink_frequency = 7.0 if curl else 2.0
    ps.kink_shape = 0.2
    ps.roughness_1 = 0.004
    ps.roughness_2 = 0.006
    ps.roughness_endpoint = 0.003
    ps.root_radius = 1.0
    ps.tip_radius = 0.6
    ps.radius_scale = 0.0011
    ps.use_close_tip = True
    ps.display_step = 3
    ps.render_step = 4
    ps.material_slot = cap.data.materials[-1].name if cap.data.materials else ''
    return ps


def add_hair(arm, style='crop', colour='brown'):
    spec = HAIR_STYLES[style]
    col = HAIR_COLOURS[colour]
    objs = []
    for name in spec['mesh']:
        o = _import_hair_mesh(arm, name)
        o.data.materials.clear()
        o.data.materials.append(hair_mesh_mat('HairMesh_' + name, col))
        objs.append(o)
    if spec.get('strands'):
        cap = objs[0]
        # density/length maps on the cap: no strands growing down over the
        # brows, longer on the crown
        co = world_co(cap)
        dens = cap.vertex_groups.new(name='hair_density')
        leng = cap.vertex_groups.new(name='hair_length')
        for i, (x, y, z) in enumerate(co):
            front = max(0.0, min(1.0, (z - 1.745) / 0.03)) if y < -0.05 else 1.0
            side = max(0.0, min(1.0, (z - 1.70) / 0.03))
            dens.add([i], front * side, 'REPLACE')
            leng.add([i], 0.5 + 0.5 * max(0.0, min(1.0, (z - 1.68) / 0.14)), 'REPLACE')
        # scalp under the curls reads as dense dark hair, strands on top
        cap.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.8
        cap.data.materials.append(hair_strand_mat(col))
        ps = add_curls(cap, col, **spec['strands'])
        ps.material = 2
        psys = cap.particle_systems[-1]
        psys.vertex_group_density = 'hair_density'
        psys.vertex_group_length = 'hair_length'
        scn = bpy.context.scene
        scn.cycles_curves.shape = 'THICK'
        scn.cycles_curves.subdivisions = 2
    # eyebrows follow the hair colour
    for o in bpy.data.objects:
        if o.name.startswith('Eyebrows'):
            o.data.materials.clear()
            o.data.materials.append(hair_mesh_mat('Brows', col))
    return objs
