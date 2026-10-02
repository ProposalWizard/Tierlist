"""The 3D signing scene prototype (v0.24, Harry P2-7..P2-13, P2-49/50).

"Sitting across from him, like a FIFA career mode": you and the manager at his
desk, a few lines of talk, the contract turned to face you with the camera over
your shoulder, then a zoom out to the wide desk as you sign.

Everything is built in code here, on top of the Blender footballer
(tools/blender-footballer/scripts/fb.py: the CC0 Quaternius body, the modelled
kit, hair). The view out of the window is a crop of the generated backdrop
public/star/signing3d/room-golden-hour.webp, which also set the light: low
golden-hour sun behind the manager, warm lamps inside.

usage (from this folder, with the bpy venv and LD_LIBRARY_PATH set as in
tools/blender-shop/README.md, and tools/blender-footballer/assets in place):

    python signing.py -- <skin> <beats> <out_dir> [samples] [w h]

skin: light | medium | dark       (the player's; hair follows, see LOOKS)
beats: comma list of talk,reply,contract,signing,signed   (or "all")
Writes <out_dir>/<beat>-<skin>.png
"""
import sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(REPO, 'tools', 'blender-footballer', 'scripts'))
import bpy, bmesh
import numpy as np
from mathutils import Vector, Matrix, Euler
import fb

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SKIN = ARGS[0] if ARGS else 'medium'
BEATS = (ARGS[1] if len(ARGS) > 1 else 'all')
OUT = ARGS[2] if len(ARGS) > 2 else os.path.join(HERE, 'out')
SAMPLES = int(ARGS[3]) if len(ARGS) > 3 else 40
RES = (int(ARGS[4]), int(ARGS[5])) if len(ARGS) > 5 else (720, 900)
ACCESSORY = os.environ.get('ACCESSORY', '')
ALL_BEATS = ['talk', 'reply', 'contract', 'signing', 'signed']
BEATS = ALL_BEATS if BEATS == 'all' else BEATS.split(',')

# The player's look per skin tone. The prototype ties hair to skin so three
# render sets cover it; in the game both come from the player's own choices.
LOOKS = {
    'light': dict(hair='crop', colour='brown'),
    'medium': dict(hair='crop', colour='black'),
    'dark': dict(hair='buzz', colour='black'),
}
# A home kit for the prototype (white shirt, navy trim/shorts) — any club's
# colours drop in here.
KIT = dict(shirt='#f4f5f7', sleeve='#f4f5f7', shorts='#1b2a55', socks='#f4f5f7', trim='#1b2a55', band='#1b2a55')

SEAT_Z = 0.47           # top of a chair seat
DESK_Z = 0.76           # top of the desk
DESK_W, DESK_D = 1.70, 0.86
SIT_Y = 0.74            # each man's pelvis is this far from the desk's middle
PELVIS_REST_Z = 0.949


# ---------------------------------------------------------------- materials
def mat(name, col, rough=0.5, metal=0.0, coat=0.0, emit=None, es=0.0, spec=0.5):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*fb.srgb2lin(col), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Specular IOR Level'].default_value = spec
    if emit:
        b.inputs['Emission Color'].default_value = (*fb.srgb2lin(emit), 1)
        b.inputs['Emission Strength'].default_value = es
    return m


def wood(name, col='#6b3518', scale=(2.0, 30.0, 2.0), rough=0.32, coat=0.6):
    """Polished wood: stretched noise as grain, two tones."""
    m = mat(name, col, rough=rough, coat=coat)
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = scale
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3.0; nz.inputs['Detail'].default_value = 6; nz.inputs['Distortion'].default_value = 2.0
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    c0 = fb.srgb2lin(col); c1 = tuple(v * 0.55 for v in c0)
    ramp.color_ramp.elements[0].color = (*c1, 1); ramp.color_ramp.elements[1].color = (*c0, 1)
    ramp.color_ramp.elements[0].position = 0.35; ramp.color_ramp.elements[1].position = 0.65
    nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    return m


def image_mat(name, path, emit=0.0, rough=0.6):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = bpy.data.images.load(path)
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough
    if emit:
        nt.links.new(t.outputs['Color'], b.inputs['Emission Color'])
        b.inputs['Emission Strength'].default_value = emit
    return m


# ---------------------------------------------------------------- geometry
def box(name, c, size, m, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c)
    o = bpy.context.object; o.name = name; o.scale = size; o.rotation_euler = rot
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        bv = o.modifiers.new('bev', 'BEVEL'); bv.width = bevel; bv.segments = 3
    o.data.materials.append(m)
    return o


def cyl(name, c, r, d, m, axis='Z', verts=32, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d, location=c)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=d, location=c)
    o = bpy.context.object; o.name = name
    if axis == 'X': o.rotation_euler = (0, math.pi / 2, 0)
    if axis == 'Y': o.rotation_euler = (math.pi / 2, 0, 0)
    for p in o.data.polygons: p.use_smooth = True
    o.data.materials.append(m)
    return o


def plane(name, c, w, h, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_plane_add(size=1, location=c)
    o = bpy.context.object; o.name = name; o.scale = (w, h, 1); o.rotation_euler = rot
    o.data.materials.append(m)
    return o


# ---------------------------------------------------------------- textures
def paper_png(path, signed):
    from PIL import Image, ImageDraw, ImageFont
    W, H = 840, 1188
    im = Image.new('RGB', (W, H), (247, 243, 232))
    d = ImageDraw.Draw(im)
    F = '/usr/share/fonts/truetype/dejavu/'
    serif = lambda s: ImageFont.truetype(F + 'DejaVuSerif-Bold.ttf', s)
    sans = lambda s: ImageFont.truetype(F + 'DejaVuSans.ttf', s)
    sansb = lambda s: ImageFont.truetype(F + 'DejaVuSans-Bold.ttf', s)
    d.rectangle((24, 24, W - 24, H - 24), outline=(170, 140, 80), width=4)
    d.text((W / 2, 92), 'PROFESSIONAL CONTRACT', fill=(120, 96, 50), font=sansb(30), anchor='mm')
    d.ellipse((W / 2 - 48, 140, W / 2 + 48, 236), outline=(27, 42, 85), width=6)
    d.text((W / 2, 188), 'ET', fill=(27, 42, 85), font=serif(40), anchor='mm')
    d.text((W / 2, 292), 'Enfield Town', fill=(20, 20, 28), font=serif(62), anchor='mm')
    rows = [('LENGTH', '2 seasons'), ('WAGE', '35 a week'), ('SHIRT', '#39'), ('POSITION', 'Striker'),
            ('GOAL BONUS', '4'), ('ASSIST BONUS', '2')]
    y = 400
    for k, v in rows:
        d.text((90, y), k, fill=(110, 100, 90), font=sansb(26), anchor='lm')
        d.text((W - 90, y), v, fill=(20, 20, 28), font=serif(40), anchor='rm')
        d.line((90, y + 34, W - 90, y + 34), fill=(215, 205, 185), width=2)
        y += 88
    # signature lines
    for x0, label in ((90, 'FOR ENFIELD TOWN'), (470, 'PLAYER')):
        d.line((x0, 1030, x0 + 280, 1030), fill=(60, 60, 70), width=3)
        d.text((x0, 1060), label, fill=(110, 100, 90), font=sansb(22), anchor='lm')
    # the manager has already signed
    sig = lambda pts, col: d.line(pts, fill=col, width=6, joint='curve')
    sig([(100, 1010), (130, 960), (150, 1015), (170, 970), (200, 1005), (240, 975), (270, 1000), (330, 985)], (30, 50, 120))
    if signed:
        sig([(480, 1012), (505, 955), (520, 1020), (548, 965), (575, 1012), (600, 980), (640, 1004), (690, 970), (730, 992)], (30, 50, 120))
    else:
        d.text((x0 + 140, 990), 'x  SIGN HERE', fill=(200, 120, 40), font=sansb(26), anchor='mm')
    im.save(path)


def window_png(path):
    """The stadium at golden hour, cut out of the generated room picture with
    its own window bars removed (ours are modelled)."""
    from PIL import Image
    src = Image.open(os.path.join(REPO, 'public', 'star', 'signing3d', 'room-golden-hour.webp')).convert('RGB')
    w = src.crop((340, 8, 1000, 330))
    a, b, c = w.crop((0, 0, 113, 322)), w.crop((133, 0, 522, 322)), w.crop((544, 0, 660, 322))
    out = Image.new('RGB', (a.width + b.width + c.width, 322))
    out.paste(a, (0, 0)); out.paste(b, (a.width, 0)); out.paste(c, (a.width + b.width, 0))
    out.save(path)


# ---------------------------------------------------------------- the room
def build_room(tmp):
    carpet = mat('Carpet', '#1d2740', rough=0.95)
    border = mat('CarpetEdge', '#b08a3e', rough=0.8)
    wall = mat('Wall', '#c9a77a', rough=0.85)
    panel = wood('Panel', '#4a2412', scale=(1.5, 12, 1.5), rough=0.45, coat=0.3)
    deskwood = wood('Desk', '#7a3c17', rough=0.22, coat=0.8)
    frame = mat('Frame', '#2a1a10', rough=0.4)
    brass = mat('Brass', '#d6a54a', rough=0.25, metal=1.0)
    leather = mat('Leather', '#181818', rough=0.42, coat=0.3)
    # floor + border
    plane('Floor', (0, 0, 0), 6, 6, carpet)
    for x in (-1.9, 1.9):
        plane(f'Border{x}', (x, 0, 0.002), 0.06, 4.6, border)
    # back wall (behind the manager) with the window cut out
    WY = 2.3
    box('WallBL', (-2.0, WY, 1.4), (1.4, 0.12, 2.8), wall)
    box('WallBR', (2.0, WY, 1.4), (1.4, 0.12, 2.8), wall)
    box('WallBB', (0, WY, 0.5), (2.6, 0.12, 1.0), panel)
    box('WallBT', (0, WY, 2.65), (2.6, 0.12, 0.5), wall)
    for x in (-1.3, -0.45, 0.45, 1.3):
        box(f'Mull{x}', (x, WY - 0.02, 1.7), (0.06, 0.1, 1.4), frame)
    box('Sill', (0, WY - 0.1, 1.0), (2.75, 0.24, 0.05), deskwood)
    box('Head', (0, WY - 0.02, 2.4), (2.66, 0.1, 0.06), frame)
    # side + front walls, wood below a rail
    for x in (-2.6, 2.6):
        box(f'Side{x}', (x, 0, 1.4), (0.12, 5.4, 2.8), wall)
        box(f'SidePanel{x}', (x * 0.995, 0, 0.5), (0.13, 5.4, 1.0), panel)
    box('Front', (0, -2.7, 1.4), (5.4, 0.12, 2.8), wall)
    box('FrontPanel', (0, -2.69, 0.5), (5.4, 0.13, 1.0), panel)
    box('Ceiling', (0, 0, 2.86), (5.4, 5.6, 0.1), mat('Ceil', '#e8dcc8', rough=0.9))
    # the view: a lit picture well behind the glass
    window_png(os.path.join(tmp, 'window.png'))
    plane('View', (0, 5.0, 1.75), 6.4, 3.12, image_mat('ViewMat', os.path.join(tmp, 'window.png'), emit=1.6), rot=(math.pi / 2, 0, 0))
    # framed shirts on the back wall, either side of the window
    for x, c in ((-2.0, '#1b3f9c'), (2.0, '#8c1d24')):
        box(f'ShirtFrame{x}', (x, WY - 0.08, 1.85), (0.62, 0.04, 0.78), frame)
        box(f'ShirtBack{x}', (x, WY - 0.105, 1.85), (0.52, 0.01, 0.68), mat(f'Mount{x}', '#141a2a', rough=0.9))
        shirt_shape(f'Shirt{x}', (x, WY - 0.115, 1.86), mat(f'ShirtC{x}', c, rough=0.7))
    # trophy shelf on the right wall, near the window
    box('Shelf', (2.45, 1.4, 1.25), (0.26, 0.9, 0.03), deskwood)
    box('Shelf2', (2.45, 1.4, 1.65), (0.26, 0.9, 0.03), deskwood)
    gold = mat('TrophyGold', '#e8b84a', rough=0.18, metal=1.0)
    for i, y in enumerate((1.1, 1.4, 1.7)):
        cup(f'Cup{i}', (2.45, y, 1.27 + 0.4 * (i == 1)), gold, 0.08 + 0.02 * (i == 1))
    # the wall behind you: a door and a framed stadium photo
    box('Door', (1.45, -2.62, 1.05), (0.95, 0.05, 2.1), deskwood)
    cyl('Handle', (1.1, -2.58, 1.0), 0.02, 0.08, brass, axis='Y')
    box('PhotoFrame', (-0.7, -2.62, 1.75), (1.5, 0.04, 0.82), frame)
    plane('Photo', (-0.7, -2.595, 1.75), 1.36, 0.68, image_mat('PhotoM', os.path.join(tmp, 'window.png'), emit=0.15, rough=0.3), rot=(math.pi / 2, 0, math.pi))
    # a plant in the corner
    pot = cyl('Pot', (-2.25, 1.85, 0.2), 0.18, 0.4, mat('Pot', '#20232b', rough=0.6))
    leaf = mat('Leaf', '#2f6b2a', rough=0.5)
    for k in range(9):
        a = k * 0.7
        o = cyl(f'Leaf{k}', (-2.25 + 0.12 * math.cos(a), 1.85 + 0.12 * math.sin(a), 0.65), 0.07, 0.6, leaf, r2=0.005)
        o.scale = (1.0, 0.25, 1.0); o.rotation_euler = (0.35 * math.sin(a), 0.35 * math.cos(a), a)
    return dict(deskwood=deskwood, brass=brass, leather=leather, frame=frame)


def shirt_shape(name, c, m):
    """A flat shirt silhouette for the wall frames."""
    pts = [(-0.12, 0.26), (-0.05, 0.28), (0, 0.24), (0.05, 0.28), (0.12, 0.26), (0.22, 0.16), (0.17, 0.09),
           (0.13, 0.13), (0.13, -0.27), (-0.13, -0.27), (-0.13, 0.13), (-0.17, 0.09), (-0.22, 0.16)]
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '2D'; cu.fill_mode = 'BOTH'; cu.extrude = 0.006; cu.bevel_depth = 0.004
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for p, (x, z) in zip(sp.points, pts): p.co = (x, z, 0, 1)
    sp.use_cyclic_u = True
    o = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(o)
    o.location = c; o.rotation_euler = (math.pi / 2, 0, 0); cu.materials.append(m)
    return o


def cup(name, c, m, r):
    x, y, z = c
    cyl(name + 'Base', (x, y, z + 0.02), r * 0.7, 0.04, m)
    cyl(name + 'Stem', (x, y, z + 0.09), r * 0.15, 0.1, m)
    cyl(name + 'Bowl', (x, y, z + 0.2), r, 0.16, m, r2=r * 0.55).rotation_euler = (math.pi, 0, 0)


def build_desk(R, tmp, signed):
    w = R['deskwood']
    box('DeskTop', (0, 0, DESK_Z - 0.025), (DESK_W, DESK_D, 0.05), w, bevel=0.01)
    for x in (-0.62, 0.62):
        box(f'Ped{x}', (x, 0, (DESK_Z - 0.05) / 2), (0.44, DESK_D - 0.06, DESK_Z - 0.05), w, bevel=0.005)
    box('Modesty', (0, 0.06, 0.45), (0.80, 0.03, 0.55), w)   # hides his legs from your side; your knees go under
    # desk things
    pad = box('Pad', (0, 0.05, DESK_Z + 0.004), (0.62, 0.42, 0.006), mat('Blotter', '#14161c', rough=0.6), bevel=0.002)
    # contract: turned to face you (your side is -y)
    for s in (False, True):
        paper_png(os.path.join(tmp, f'paper{int(s)}.png'), s)
    paper = plane('Contract', (0.02, -0.16, DESK_Z + 0.009), 0.21, 0.297, image_mat('Paper', os.path.join(tmp, f'paper{int(signed)}.png'), rough=0.85))
    paper.rotation_euler = (0, 0, math.radians(4))
    # lamp, brass, on his left (your right)
    brass = R['brass']
    lx, ly = -0.62, 0.22
    cyl('LampBase', (lx, ly, DESK_Z + 0.015), 0.08, 0.03, brass)
    cyl('LampArm', (lx, ly + 0.02, DESK_Z + 0.2), 0.012, 0.38, brass).rotation_euler = (math.radians(-12), 0, 0)
    shade = cyl('LampShade', (lx + 0.02, ly - 0.08, DESK_Z + 0.38), 0.10, 0.12, brass, r2=0.04)
    shade.rotation_euler = (math.radians(-35), 0, math.radians(20))
    bulb = bpy.data.lights.new('LampLight', 'POINT'); bulb.energy = 18; bulb.color = (1.0, 0.72, 0.42); bulb.shadow_soft_size = 0.04
    lo = bpy.data.objects.new('LampLight', bulb); bpy.context.scene.collection.objects.link(lo); lo.location = (lx + 0.03, ly - 0.1, DESK_Z + 0.32)
    # pen holder and a closed folder
    cyl('Holder', (0.62, 0.25, DESK_Z + 0.06), 0.04, 0.12, mat('HolderM', '#202020', rough=0.3, metal=0.6))
    box('Folder', (0.56, -0.05, DESK_Z + 0.012), (0.28, 0.36, 0.022), mat('FolderM', '#16233f', rough=0.5), bevel=0.003).rotation_euler = (0, 0, math.radians(-8))
    return paper


def build_chair(name, y, facing, leather, frame, executive):
    """facing +1: the sitter faces +y (you); -1: faces -y (the manager)."""
    s = -facing     # the back is on this side
    seat_h = 0.08
    box(name + 'Seat', (0, y, SEAT_Z - seat_h / 2), (0.54, 0.52, seat_h), leather, bevel=0.03)
    back_h = 0.85 if executive else 0.55
    back = box(name + 'Back', (0, y + s * 0.27, SEAT_Z + back_h / 2 + 0.02), (0.54, 0.08, back_h), leather, bevel=0.035)
    back.rotation_euler = (math.radians(-8 * s), 0, 0)
    for x in (-0.29, 0.29):
        box(name + f'Arm{x}', (x, y + s * 0.02, SEAT_Z + 0.2), (0.05, 0.42, 0.04), frame, bevel=0.01)
        box(name + f'ArmP{x}', (x, y - s * 0.12, SEAT_Z + 0.1), (0.04, 0.04, 0.2), frame)
    if executive:
        cyl(name + 'Post', (0, y, 0.22), 0.03, 0.4, frame)
        for k in range(5):
            a = k * 2 * math.pi / 5
            box(name + f'Leg{k}', (0.16 * math.cos(a), y + 0.16 * math.sin(a), 0.04), (0.34, 0.04, 0.03), frame, rot=(0, 0, a))
    else:
        for x in (-0.24, 0.24):
            for dy in (-0.22, 0.22):
                cyl(name + f'L{x}{dy}', (x, y + dy, (SEAT_Z - seat_h) / 2), 0.018, SEAT_Z - seat_h, frame)


# ---------------------------------------------------------------- people
def tag(objs_before, prefix):
    """Rename everything new with a prefix so a second import can't collide."""
    new = [o for o in bpy.data.objects if o not in objs_before]
    for o in new:
        o.name = prefix + o.name
    return new


# The pack's own Light/Dark maps are only a few shades apart, so the tone is
# set here: the dark map, scaled in value and saturation.
TONES = {'light': (1.12, 0.85), 'medium': (0.72, 1.0), 'dark': (0.30, 1.08)}


def set_tone(body, skin):
    m = body.data.materials[0]; nt = m.node_tree
    b = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    src = b.inputs['Base Color'].links[0].from_socket
    hsv = nt.nodes.new('ShaderNodeHueSaturation')
    hsv.inputs['Value'].default_value, hsv.inputs['Saturation'].default_value = TONES[skin]
    nt.links.new(src, hsv.inputs['Color']); nt.links.new(hsv.outputs['Color'], b.inputs['Base Color'])


def build_player(skin, look):
    arm, body = fb.import_character('dark', None)
    set_tone(body, skin)
    fb.add_hair(arm, look['hair'], look['colour'])
    kit = fb.build_kit(body, arm)
    fb.preview_colours(KIT)
    for o in list(bpy.data.objects):
        o.name = 'P_' + o.name
    for m in bpy.data.materials:
        if m.name in ('MI_Superhero_Male', 'MI_Eyes'):
            m.name = 'P_' + m.name
    for im in list(bpy.data.images):
        im.name = 'P_' + im.name
    return arm, body


def relink_images():
    ubc = fb.UBC
    lookup = {}
    for d in (fb.TEX, os.path.join(ubc, 'Hairstyles', 'Textures')):
        for f in os.listdir(d):
            if f.endswith('.png'):
                lookup[f.lower()] = os.path.join(d, f)
    for img in bpy.data.images:
        if img.name.startswith('P_') or not img.filepath:
            continue
        base = os.path.basename(img.filepath).replace('_png.png', '.png').lower()
        if base in lookup:
            img.filepath = lookup[base]; img.reload()


def build_manager():
    """A second body from the same CC0 pack: older, grey hair and beard,
    glasses, a navy suit with a white shirt and a tie. A modelled face, never
    a photo (Harry, P49)."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=fb.BODY_GLTF)
    for o in list(bpy.data.objects):
        if o not in before and o.name.startswith('Icosphere'):
            bpy.data.objects.remove(o)
    arm = [o for o in bpy.data.objects if o.type == 'ARMATURE' and o not in before][0]
    body = [o for o in bpy.data.objects if o.type == 'MESH' and o not in before and o.name.startswith('SuperHero_Male')][0]
    for part in ('Hair_Buzzed', 'Hair_Beard'):
        b2 = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(fb.HAIR_DIR, part + '.gltf'))
        for o in set(bpy.data.objects) - b2:
            if o.type == 'MESH' and not o.name.startswith('Icosphere'):
                o.parent = arm
                for md in o.modifiers:
                    if md.type == 'ARMATURE':
                        md.object = arm
            else:
                bpy.data.objects.remove(o)
    relink_images()
    # his skin: the light map, a little older (less saturated)
    sm = body.data.materials[0]
    for n in sm.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image and ('Superhero_Male_D' in n.image.name or 'Superhero_Male_L' in n.image.name):
            n.image = bpy.data.images.load(os.path.join(fb.TEX, 'T_Superhero_Male_Ligh.png'), check_existing=True)
    grey = fb.hair_mesh_mat('M_Hair', dict(rgb='#8d8b88'))
    for o in bpy.data.objects:
        if o not in before and o.type == 'MESH' and ('Hair' in o.name or 'Eyebrows' in o.name):
            o.data.materials.clear(); o.data.materials.append(grey)
    suit = build_suit(body)
    new = tag(before, 'M_')
    return arm, body


def build_suit(body):
    co = fb.world_co(body)
    dom = fb.dom_groups(body)
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    ax = np.abs(x)
    rad = np.sqrt(x ** 2 + (y - 0.035) ** 2)
    jk = (z > 0.80) & (z < 1.61) & (ax < 0.70)
    jk &= ~((z > 1.53) & (rad < 0.098))
    ALL = lambda c: True
    jacket = fb.shell_from_body(body, 'Jacket', jk, 0.02, 28, 0.6, min_gap=0.012,
                                cuts=[((0, 0, 0.84), (0, 0, -1), lambda c: abs(c.x) < 0.3),
                                      ((0.67, 0, 0), (1, 0, 0), ALL), ((-0.67, 0, 0), (-1, 0, 0), ALL)])
    tk = (z > 0.07) & (z < 1.05) & (ax < 0.27) & ~np.isin(dom, ['foot_l', 'foot_r', 'ball_l', 'ball_r'])
    trousers = fb.shell_from_body(body, 'Trousers', tk, 0.014, 20, 0.6, min_gap=0.008,
                                  cuts=[((0, 0, 0.09), (0, 0, -1), ALL)])
    sk = (z < 0.17) & np.isin(dom, ['foot_l', 'foot_r', 'ball_l', 'ball_r', 'calf_l', 'calf_r'])
    shoes = fb.shell_from_body(body, 'Shoes', sk, 0.008, 8, 0.6, min_gap=0.006)
    for g in (jacket, trousers, shoes):
        fb.store_rest_attrs(g)
    # jacket: navy, with the white shirt and a tie in the V and darker lapels
    m = fb.fabric_mat('SuitJacket', 0.5, {}, knit=0.12, rough=0.55)
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    mb = fb.MaskBuilder(nt)
    front = mb.inv(mb.step(mb.y, -0.04, -0.02))
    vv = lambda z0, k: mb.step(mb.op('SUBTRACT', mb.op('MULTIPLY', mb.op('SUBTRACT', mb.z, z0), k), mb.ax), 0.0005, 0.003)
    shirtv = mb.mul(front, vv(1.20, 0.40))
    lapel = mb.mul(front, mb.mul(vv(1.08, 0.62), mb.inv(shirtv)))
    tie = mb.mul(shirtv, mb.mul(mb.inv(mb.step(mb.ax, 0.020, 0.024)), mb.inv(mb.step(mb.z, 1.505, 1.51))))
    cols = [('#1a2236', None), ('#10151f', lapel), ('#f2f3f5', shirtv), ('#8c1d24', tie)]
    acc = None
    for col, mask in cols:
        rgb = nt.nodes.new('ShaderNodeRGB'); rgb.outputs[0].default_value = (*fb.srgb2lin(col), 1)
        if acc is None:
            acc = rgb.outputs[0]; continue
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'
        nt.links.new(mask, mx.inputs['Factor']); nt.links.new(acc, mx.inputs['A']); nt.links.new(rgb.outputs[0], mx.inputs['B'])
        acc = mx.outputs['Result']
    nt.links.new(acc, b.inputs['Base Color'])
    jacket.data.materials.append(m)
    trousers.data.materials.append(mat('SuitTrousers', '#1a2236', rough=0.6))
    shoes.data.materials.append(mat('Shoes', '#0d0d0f', rough=0.25, coat=0.8))
    for ob, th in ((jacket, 0.004), (trousers, 0.003), (shoes, 0.003)):
        so = ob.modifiers.new('thick', 'SOLIDIFY'); so.thickness = th; so.offset = 1.0
        ss = ob.modifiers.new('subd', 'SUBSURF'); ss.levels = 1; ss.render_levels = 2
    fb.hide_covered_skin(body, [jacket, trousers, shoes])
    return jacket


# ---------------------------------------------------------------- posing
def ik_to(arm, prefix, bone, target, pole, pole_angle=-90):
    t = bpy.data.objects.new(f'{prefix}IKt_{bone}', None); p = bpy.data.objects.new(f'{prefix}IKp_{bone}', None)
    for o in (t, p):
        bpy.context.scene.collection.objects.link(o); o.parent = arm
    t.location = target; p.location = pole
    c = arm.pose.bones[bone].constraints.new('IK')
    c.target = t; c.pole_target = p; c.pole_angle = math.radians(pole_angle); c.chain_count = 2


def clear(arm, prefix):
    for pb in arm.pose.bones:
        for c in list(pb.constraints):
            pb.constraints.remove(c)
    for o in list(bpy.data.objects):
        if o.name.startswith(prefix + 'IK'):
            bpy.data.objects.remove(o)


SIT = {
    'pelvis': [('x', -4)],
    'spine_01': [('x', 6)], 'spine_02': [('x', 5)], 'spine_03': [('x', 3)],
    'clavicle_l': [('y', 6)], 'clavicle_r': [('y', -6)],
    'upperarm_l': [('y', 70)], 'upperarm_r': [('y', -70)],
    'thigh_l': [('x', -84), ('y', -5)], 'thigh_r': [('x', -84), ('y', 5)],
    'calf_l': [('x', 86)], 'calf_r': [('x', 86)],
    'foot_l': [('x', -2)], 'foot_r': [('x', -2)],
}


def pose(arm, prefix, extra, hands, world_y, facing):
    """Seat a man at his side of the desk. Everything below is in his own
    frame: he faces -y, the desk edge nearest him is at y = -(SIT_Y - DESK_D/2)."""
    clear(arm, prefix)
    arm.location = (0, world_y, SEAT_Z + 0.10 - PELVIS_REST_Z)
    arm.rotation_mode = 'XYZ'
    arm.rotation_euler = (0, 0, 0 if facing < 0 else math.pi)
    from poses import merge
    fb.apply_pose(arm, merge(SIT, extra, fb.fingers('l', 30, thumb=20), fb.fingers('r', hands.get('rcurl', 30), thumb=hands.get('rthumb', 20))))
    bpy.context.view_layer.update()
    for bone, tgt, pole in hands['ik']:
        ik_to(arm, prefix, bone, tgt, pole)
    bpy.context.view_layer.update()


EDGE = -(SIT_Y - DESK_D / 2)      # the desk's near edge in a sitter's own frame
TOP = DESK_Z - (SEAT_Z + 0.10 - PELVIS_REST_Z)   # the desk top in his own frame (rig space)

POSES = {
    # forearms resting on the desk, hands loosely together
    'rest': dict(extra={'spine_02': [('x', 4)], 'neck_01': [('x', -4)], 'Head': [('x', -5)]},
                 ik=[('lowerarm_l', (0.11, EDGE - 0.14, TOP + 0.035), (0.7, 0.4, TOP)),
                     ('lowerarm_r', (-0.11, EDGE - 0.14, TOP + 0.035), (-0.7, 0.4, TOP))]),
    # the manager talking: one hand open, a little gesture
    'talking': dict(extra={'Head': [('x', -4), ('z', 4)], 'hand_r': [('x', -20)]},
                    ik=[('lowerarm_l', (0.13, EDGE - 0.14, TOP + 0.035), (0.7, 0.4, TOP)),
                        ('lowerarm_r', (-0.18, EDGE - 0.18, TOP + 0.14), (-0.7, 0.3, TOP - 0.1))]),
    # you, signing: right hand on the paper with the pen, left hand holding it flat, head down
    'signing': dict(extra={'spine_02': [('x', 8)], 'spine_03': [('x', 6)], 'neck_01': [('x', 10)], 'Head': [('x', 16)]},
                    rcurl=60, rthumb=40,
                    ik=[('lowerarm_l', (0.14, EDGE - 0.16, TOP + 0.035), (0.7, 0.3, TOP)),
                        ('lowerarm_r', (-0.04, EDGE - 0.24, TOP + 0.05), (-0.7, 0.3, TOP))]),
}


def place_pen(arm, signing):
    pen = bpy.data.objects.get('Pen')
    if pen is None:
        body = mat('PenBody', '#0d0d10', rough=0.2, coat=1.0)
        pen = cyl('Pen', (0, 0, 0), 0.0055, 0.14, body)
        gold = mat('PenGold', '#d8ac4a', rough=0.2, metal=1.0)
        tip = cyl('PenTip', (0, 0, -0.08), 0.0055, 0.02, gold, r2=0.001); tip.parent = pen
        clip = box('PenClip', (0.006, 0, 0.04), (0.002, 0.004, 0.04), gold); clip.parent = pen
    if signing:
        bpy.context.view_layer.update()
        h = fb.bone_world(arm, 'hand_r'); ht = fb.bone_world(arm, 'hand_r', tail=True)
        mid = (h + ht) / 2
        pen.location = (mid.x - 0.0, mid.y - 0.02, DESK_Z + 0.075)
        pen.rotation_euler = (math.radians(-25), math.radians(15), 0)
    else:
        pen.location = (0.16, -0.10, DESK_Z + 0.008)
        pen.rotation_euler = (math.radians(90), 0, math.radians(70))


def headband(arm, colour='#f4f5f7'):
    """An accessory the player owns (the store's headband), on his own head:
    a soft band placed in the head bone's frame so it follows any pose."""
    for o in [o for o in bpy.data.objects if o.name.startswith('Headband')]:
        bpy.data.objects.remove(o)
    bpy.context.view_layer.update()
    pb = arm.pose.bones['Head']
    M = arm.matrix_world @ pb.matrix
    bpy.ops.mesh.primitive_torus_add(major_radius=0.090, minor_radius=0.008, major_segments=64, minor_segments=12)
    o = bpy.context.object; o.name = 'Headband'
    o.data.materials.append(mat('HeadbandM', colour, rough=0.7))
    local = Matrix.Translation((0, 0.135, 0.010)) @ Matrix.Rotation(math.radians(90), 4, 'X') @ Matrix.Rotation(math.radians(-8), 4, 'X')
    o.matrix_world = M @ local @ Matrix.Diagonal((1.0, 1.10, 2.4, 1.0))
    for p in o.data.polygons: p.use_smooth = True


def glasses(arm, body):
    """Thin round frames on the manager, placed on his eyes after posing."""
    eyes = [o for o in bpy.data.objects if o.name.startswith('M_Eyes')]
    old = [o for o in bpy.data.objects if o.name.startswith('Glasses')]
    for o in old:
        bpy.data.objects.remove(o)
    if not eyes:
        return
    dg = bpy.context.evaluated_depsgraph_get()
    e = eyes[0].evaluated_get(dg); me = e.to_mesh()
    pts = [e.matrix_world @ v.co for v in me.vertices]; e.to_mesh_clear()
    head = fb.bone_world(arm, 'Head'); tail = fb.bone_world(arm, 'Head', tail=True)
    xs = sorted(p.x for p in pts)
    cx = (xs[0] + xs[-1]) / 2
    left = [p for p in pts if p.x > cx]; right = [p for p in pts if p.x <= cx]
    m = mat('GlassFrame', '#151515', rough=0.3, metal=0.4)
    for nm, grp in (('GlassesL', left), ('GlassesR', right)):
        c = sum(grp, Vector()) / len(grp)
        fwd_y = min(p.y for p in grp)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.024, minor_radius=0.0018, location=(c.x, fwd_y - 0.012, c.z))
        o = bpy.context.object; o.name = nm; o.rotation_euler = (math.pi / 2, 0, 0); o.data.materials.append(m)
    cl = sum(left, Vector()) / len(left); cr = sum(right, Vector()) / len(right)
    fy = min(p.y for p in pts) - 0.012
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0016, depth=abs(cl.x - cr.x) - 0.048, location=((cl.x + cr.x) / 2, fy, (cl.z + cr.z) / 2 + 0.006))
    o = bpy.context.object; o.name = 'GlassesBridge'; o.rotation_euler = (0, math.pi / 2, 0); o.data.materials.append(m)


# ---------------------------------------------------------------- light + camera
def lights():
    scn = bpy.context.scene
    w = bpy.data.worlds.new('W'); scn.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.5, 0.35, 0.22, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.15
    sun = bpy.data.lights.new('Sun', 'SUN'); sun.energy = 3.2; sun.color = (1.0, 0.62, 0.34); sun.angle = math.radians(3)
    so = bpy.data.objects.new('Sun', sun); scn.collection.objects.link(so)
    so.rotation_euler = Euler((math.radians(-78), 0, math.radians(200)))   # low, from behind the window
    def area(name, loc, energy, size, color, aim):
        ld = bpy.data.lights.new(name, 'AREA'); ld.energy = energy; ld.size = size; ld.color = color
        o = bpy.data.objects.new(name, ld); scn.collection.objects.link(o); o.location = loc
        o.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    area('WindowGlow', (0, 2.1, 1.7), 220, 2.4, (1.0, 0.75, 0.5), (0, 0, 1.0))
    area('Ceiling', (0, -0.3, 2.75), 160, 1.6, (1.0, 0.86, 0.7), (0, -0.2, 0))
    area('Fill', (-1.6, -2.2, 1.6), 60, 1.5, (0.9, 0.85, 0.8), (0, 0, 1.1))


def cam(loc, target, lens, focus=None, fstop=2.8):
    scn = bpy.context.scene
    c = bpy.data.objects.get('Cam')
    if c is None:
        cd = bpy.data.cameras.new('Cam'); c = bpy.data.objects.new('Cam', cd); scn.collection.objects.link(c)
    c.data.lens = lens; c.data.sensor_fit = 'VERTICAL'; c.data.sensor_height = 24
    c.location = loc
    c.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    c.data.dof.use_dof = focus is not None
    if focus is not None:
        c.data.dof.focus_distance = (Vector(focus) - Vector(loc)).length
        c.data.dof.aperture_fstop = fstop
    scn.camera = c


# Where each beat's camera sits (world: you at y<0 facing +y, he at y>0).
PY, MY = -SIT_Y, SIT_Y
HEAD_Z = 1.24
SHOTS = {
    # over YOUR right shoulder, at him
    'talk': dict(loc=(0.50, PY - 0.95, HEAD_Z + 0.16), target=(-0.08, MY, HEAD_Z - 0.10), lens=38, focus=(0, MY - 0.1, HEAD_Z), fstop=2.4),
    # over HIS shoulder, at you (your replies)
    'reply': dict(loc=(-0.50, MY + 0.95, HEAD_Z + 0.16), target=(0.08, PY, HEAD_Z - 0.10), lens=38, focus=(0, PY + 0.1, HEAD_Z), fstop=2.4),
    # the contract, turned to you, seen over your shoulder
    'contract': dict(loc=(0.22, PY - 0.26, HEAD_Z + 0.24), target=(0.0, -0.15, DESK_Z), lens=44, focus=(0.02, -0.16, DESK_Z), fstop=3.5),
    # the wide desk, from the side, as you sign
    'signing': dict(loc=(1.95, -0.05, 1.70), target=(0.0, -0.12, 0.88), lens=18, focus=(0, -0.3, 0.9), fstop=8),
    'signed': dict(loc=(1.95, -0.05, 1.70), target=(0.0, -0.12, 0.88), lens=18, focus=(0, -0.3, 0.9), fstop=8),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    tmp = os.path.join(OUT, '_tex'); os.makedirs(tmp, exist_ok=True)
    look = LOOKS[SKIN]
    parm, pbody = build_player(SKIN, look)
    marm, mbody = build_manager()
    # the rigs share bone names; drop the second set of IK helpers fb may add
    fb.setup_render(RES, SAMPLES)
    scn = bpy.context.scene
    scn.render.film_transparent = False
    scn.view_settings.view_transform = 'AgX'
    scn.view_settings.look = 'AgX - Punchy'
    scn.view_settings.exposure = float(os.environ.get('EXPO', '0.3'))
    scn.render.threads_mode = 'FIXED'; scn.render.threads = int(os.environ.get('THREADS', '3'))
    scn.cycles.max_bounces = 6; scn.cycles.glossy_bounces = 3
    R = build_room(tmp)
    build_desk(R, tmp, False)
    build_chair('YouChair', PY + 0.04, +1, R['leather'], R['frame'], False)
    build_chair('BossChair', MY - 0.02, -1, R['leather'], R['frame'], True)
    lights()
    paper = bpy.data.objects['Contract']
    for beat in BEATS:
        signing = beat in ('signing', 'signed')
        pose(parm, 'P_', POSES['signing' if signing else 'rest']['extra'], POSES['signing' if signing else 'rest'], PY, +1)
        pose(marm, 'M_', POSES['rest' if signing else 'talking']['extra'], POSES['rest' if signing else 'talking'], MY, -1)
        glasses(marm, mbody)
        place_pen(parm, signing)
        if ACCESSORY == 'headband':
            headband(parm)
        img = bpy.data.images.load(os.path.join(tmp, f'paper{int(beat == "signed")}.png'), check_existing=True)
        for n in paper.data.materials[0].node_tree.nodes:
            if n.type == 'TEX_IMAGE':
                n.image = img
        s = SHOTS[beat]
        cam(s['loc'], s['target'], s['lens'], s.get('focus'), s.get('fstop', 2.8))
        scn.render.filepath = os.path.join(OUT, f'{beat}-{SKIN}.png')
        import time; t = time.time()
        bpy.ops.render.render(write_still=True)
        print('RENDERED', beat, SKIN, round(time.time() - t, 1), flush=True)


if __name__ == '__main__':
    main()
