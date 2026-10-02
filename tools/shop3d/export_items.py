"""Turn the shop's Blender-made boots and cars into small .glb models the 3D
shop can walk round (Harry, 2 Oct 2026: "Can we not just take the model that
we built and make it bigger?").

    python tools/shop3d/export_items.py -- <out dir> [boots|cars|all]

The models are the SAME code-built models the shop pictures are rendered from
(tools/blender-shop/scripts/boot.py and cars.py) — nothing is re-modelled.
What changes for the browser:
  - the curved surfaces are smoothed one step less, then cut down to a
    phone-sized number of triangles (Decimate);
  - Blender's node materials (side marks, door seams, lights, dirt) can't go
    into a .glb, so their colour is BAKED into one small picture per model;
    shine (roughness), metal and clear-coat stay per material;
  - meshes are Draco-compressed (the page loads three's own decoder from
    public/star/shop3d/draco/);
  - one .glb per boot (7, at level 3) and per car family (6, each at the level
    listed in CARS below), WebP textures inside.

Needs bpy 4.5.14 as a Python module (see tools/blender-shop/README.md).
Nothing here runs at build time; the outputs are committed under
public/star/shop3d/items/.
"""
import sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = os.path.join(HERE, '..', 'blender-shop', 'scripts')
sys.path.insert(0, SCRIPTS)
import bpy
import studio as S

# Less smoothing before the cut-down: a level-2 Subsurf on every loft is
# 16x the faces of the cage, far past what a phone needs.
_loft = S.loft
S.loft = lambda name, sections, cap=True, smooth=True, subsurf=2: _loft(name, sections, cap, smooth, min(subsurf, 1))

BOOTS = ['starter', 'speed', 'power', 'control', 'elite', 'curl', 'maestro']
BOOT_LEVEL = 3
# family -> the level shown in the showroom (a mix of paints: the real ladder
# paints every family the same colour at the same level).
CARS = {'car-1': 2, 'car-2': 4, 'suv': 3, 'car-3': 5, 'classic': 3, 'car-4': 4}

BOOT_TRIS = 9000
CAR_TRIS = 30000


def mesh_parts(parts):
    """Curves (laces, numbers) to meshes; return every mesh object."""
    out = []
    for p in parts:
        if p.type in ('CURVE', 'FONT'):
            bpy.ops.object.select_all(action='DESELECT')
            bpy.context.view_layer.objects.active = p
            p.select_set(True)
            bpy.ops.object.convert(target='MESH')
            p = bpy.context.view_layer.objects.active
        if p.type == 'MESH':
            out.append(p)
    return out


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    # bake every modifier and parent transform into the vertices first
    for o in objs:
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=m.name)
            except Exception:
                o.modifiers.remove(m)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    return ob


def tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def cut_down(ob, target):
    n = tris(ob)
    if n > target:
        d = ob.modifiers.new('dec', 'DECIMATE')
        d.ratio = target / n
        d.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier='dec')
    return tris(ob)


def unwrap(ob):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    while ob.data.uv_layers:
        ob.data.uv_layers.remove(ob.data.uv_layers[0])
    ob.data.uv_layers.new(name='UVMap')
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004, area_weight=0.0)
    bpy.ops.object.mode_set(mode='OBJECT')


def scalars(m):
    """The material's own shine / metal / coat — kept on the exported copy."""
    b = m.node_tree.nodes.get('Principled BSDF') if m.use_nodes else None
    if b is None:
        return dict(rough=0.5, metal=0.0, coat=0.0, coat_rough=0.05, emit=None)
    g = lambda k: b.inputs[k].default_value
    emit = None
    if g('Emission Strength') > 0.2:
        emit = tuple(g('Emission Color'))[:3]
    return dict(rough=float(g('Roughness')), metal=float(g('Metallic')), coat=float(g('Coat Weight')),
                coat_rough=float(g('Coat Roughness')), emit=emit)


def bake_colour(ob, size, samples=4):
    """Bake the albedo every node material shows into one picture. Metal and
    glass are switched off for the bake (a diffuse bake of metal is black)."""
    img = bpy.data.images.new(ob.name + '_col', size, size, alpha=False)
    img.colorspace_settings.name = 'sRGB'
    keep = []
    for slot in ob.material_slots:
        m = slot.material
        if not m or not m.use_nodes:
            continue
        nt = m.node_tree
        for n in nt.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                for k in ('Metallic', 'Transmission Weight'):
                    if not n.inputs[k].is_linked:
                        n.inputs[k].default_value = 0.0
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = img
        nt.nodes.active = t
        keep.append((m, t))
    scn = bpy.context.scene
    scn.render.engine = 'CYCLES'
    scn.cycles.device = 'CPU'
    scn.cycles.samples = samples
    bk = scn.render.bake
    bk.use_pass_direct = False
    bk.use_pass_indirect = False
    bk.use_pass_color = True
    bk.margin = 6
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_clear=True, margin=6)
    return img


def export_materials(ob, img, sc):
    """Every slot becomes a plain Principled the glTF exporter understands:
    the baked colour picture + that slot's own shine, metal and coat."""
    for i, slot in enumerate(ob.material_slots):
        old = slot.material
        s = sc.get(old.name if old else '', dict(rough=0.5, metal=0.0, coat=0.0, coat_rough=0.05, emit=None))
        m = bpy.data.materials.new(f'{ob.name}_{i}')
        m.use_nodes = True
        nt = m.node_tree
        b = nt.nodes['Principled BSDF']
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = img
        nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
        b.inputs['Roughness'].default_value = max(0.06, s['rough'])
        b.inputs['Metallic'].default_value = s['metal']
        b.inputs['Coat Weight'].default_value = s['coat']
        b.inputs['Coat Roughness'].default_value = s['coat_rough']
        if s['emit']:
            b.inputs['Emission Color'].default_value = (*s['emit'], 1)
            b.inputs['Emission Strength'].default_value = 1.0
        slot.material = m


def export(ob, path, quality):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_apply=True,
        export_image_format='WEBP', export_image_quality=quality,
        export_texcoords=True, export_normals=True, export_tangents=False,
        export_materials='EXPORT', export_yup=True, export_animations=False,
        export_skins=False, export_morph=False, export_lights=False, export_cameras=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )


def finish(parts, name, target, size, out, quality):
    sc = {}
    for p in parts:
        for s in getattr(p.data, 'materials', []) or []:
            if s and s.name not in sc:
                sc[s.name] = scalars(s)
    objs = mesh_parts(parts)
    ob = join(objs, name)
    n0 = tris(ob)
    n = cut_down(ob, target)
    for p in ob.data.polygons:
        p.use_smooth = True
    unwrap(ob)
    img = bake_colour(ob, size)
    export_materials(ob, img, sc)
    path = os.path.join(out, name + '.glb')
    export(ob, path, quality)
    print(f'EXPORTED {path} tris {n0} -> {n}  {os.path.getsize(path) // 1024} KB', flush=True)


def do_boot(base, out):
    import boot as B
    S.reset()
    work = os.path.join(out, '_work')
    os.makedirs(work, exist_ok=True)
    root, parts, tip = B.build(base, BOOT_LEVEL, work)
    # stand it at the origin, heel to toe along +x, studs on the floor
    root.rotation_euler = (0, 0, 0)
    root.location = (-B.L / 2, 0, -tip)
    bpy.context.view_layer.update()
    finish(parts, f'boot-{base}', BOOT_TRIS, 512, out, 82)


def do_car(fam, out):
    import cars as C
    S.reset()
    if fam == 'car-3':
        # the Sports Car ladder keeps its own script (as its pictures do)
        import car as C3
        parts = C3.build(CARS[fam])
    else:
        parts, _ = C.make(fam, CARS[fam])
    bpy.context.view_layer.update()
    finish(parts, f'car-{fam}' if not fam.startswith('car') else fam, CAR_TRIS, 1024, out, 80)


def main():
    a = S.args()
    out = os.path.abspath(a[0])
    what = a[1] if len(a) > 1 else 'all'
    only = a[2:] if len(a) > 2 else None
    os.makedirs(out, exist_ok=True)
    if what in ('boots', 'all'):
        for b in BOOTS:
            if not only or b in only:
                do_boot(b, out)
    if what in ('cars', 'all'):
        for f in CARS:
            if not only or f in only:
                do_car(f, out)


if __name__ == '__main__':
    main()
