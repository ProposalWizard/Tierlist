"""Proper horses for the stable ladder (v0.23.1). Lofted body-neck-head, jointed legs, mane, tail, ears, eyes.

horse2(M, x, y, z, ang, coat='bay', s=1.0, pose='stand', cloth=None) -> parts.  Faces +X before `ang`.
withers ~1.45 tall, nose ~2.0, body ~2.3 long at s=1.
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector, Matrix
import studio as S
from kit import box, cyl, sph, tube, link

COATS = {
    'bay': dict(body='#7b4526', points='#1c1512', mane='#1c1512'),
    'chestnut': dict(body='#a2521f', points='#a2521f', mane='#c27a3a'),
    'grey': dict(body='#8f8e91', points='#6c6b6e', mane='#8c8b8d'),
    'black': dict(body='#1d1a1a', points='#141212', mane='#100e0e'),
    'palomino': dict(body='#c49a50', points='#d8ac5c', mane='#f3e6bd'),
}


def coat_mats(coat):
    c = COATS[coat]
    out = {}
    for k in ('body', 'points', 'mane'):
        m = S.principled('H' + k, c[k], rough=0.5, spec=0.5, coat=0.15, coat_rough=0.3, sheen=0.3)
        out[k] = m
    out['hoof'] = S.principled('Hoof', '#2a2320', rough=0.4, coat=0.3)
    out['eye'] = S.principled('Eye', '#0b0a0a', rough=0.05, spec=1.0, coat=1.0)
    out['nose'] = S.principled('Nose', '#3a2a28', rough=0.6)
    return out


def ring_loft(name, pts, rad, mat, n=14, subsurf=1, up=(0, 0, 1)):
    """A loft along 3D points; rad = [(ry, rz)] where ry is the half width across the body, rz the half height."""
    rings = []
    P = [Vector(p) for p in pts]
    for i, p in enumerate(P):
        a = P[max(i - 1, 0)]; b = P[min(i + 1, len(P) - 1)]
        T = (b - a).normalized()
        U = Vector(up)
        if abs(T.dot(U)) > 0.97:
            U = Vector((1, 0, 0))
        Sd = T.cross(U).normalized()
        Un = Sd.cross(T).normalized()
        ry, rz = rad[i]
        ring = []
        for k in range(n):
            t = 2 * math.pi * k / n
            ring.append(tuple(p + Sd * (ry * math.cos(t)) + Un * (rz * math.sin(t))))
        rings.append(ring)
    ob = S.loft(name, rings, cap=True, subsurf=subsurf)
    ob.data.materials.append(mat)
    return ob


def _body_sections(down):
    """spine key points (x, z, ry, rz): rump -> barrel -> withers -> neck -> head. `down` 0..1 lowers the head to graze."""
    body = [(-1.14, 1.22, 0.19, 0.26), (-0.96, 1.40, 0.30, 0.37), (-0.55, 1.42, 0.325, 0.41), (-0.05, 1.37, 0.33, 0.43),
            (0.4, 1.35, 0.30, 0.42), (0.8, 1.44, 0.25, 0.35)]
    up_neck = [(1.0, 1.62, 0.20, 0.28), (1.2, 1.88, 0.15, 0.23), (1.40, 2.08, 0.125, 0.18)]
    dn_neck = [(1.04, 1.40, 0.20, 0.27), (1.32, 1.08, 0.15, 0.22), (1.52, 0.80, 0.125, 0.18)]
    neck = [tuple(a * (1 - down) + b * down for a, b in zip(u, d)) for u, d in zip(up_neck, dn_neck)]
    px, pz = neck[-1][0], neck[-1][1]
    ang = math.radians(48 + 40 * down)
    L = [(0.12, 0.112, 0.15), (0.30, 0.092, 0.125), (0.46, 0.074, 0.092), (0.56, 0.066, 0.076), (0.60, 0.052, 0.056)]
    head = []
    for d, ry, rz in L:
        head.append((px + math.cos(ang) * d, pz - math.sin(ang) * d, ry, rz))
    return body + neck + head


def leg(name, hip, knee, fet, mats, upper_r, trot=False, hind=False, mid=None):
    """Upper part in coat, lower in `points`, hoof. One continuous loft per part, radii matched at the knee."""
    P = []
    m = mid or tuple((a + b) / 2 for a, b in zip(hip, knee))
    kr = upper_r * 0.50
    P.append(ring_loft(name + 'U', [hip, m, knee], [(upper_r, upper_r * 1.1), (upper_r * 0.72, upper_r * 0.8), (kr, kr)], mats['body'], n=10, up=(0, 1, 0)))
    P.append(sph(name + 'K', knee, kr * 0.98, mats['body'], seg=10, rings=6))
    c = tuple((a * 0.5 + b * 0.5) for a, b in zip(knee, fet))
    P.append(ring_loft(name + 'L', [knee, c, fet], [(kr * 0.95, kr * 0.95), (kr * 0.8, kr * 0.8), (kr * 0.95, kr * 0.95)], mats['points'], n=10, up=(0, 1, 0)))
    P.append(sph(name + 'F', fet, kr * 1.05, mats['points'], seg=10, rings=6))
    P.append(cyl(name + 'H', (fet[0] + 0.015, fet[1], fet[2] - 0.075), kr * 1.35, 0.15, 'Z', verts=14, mat=mats['hoof'], r2=kr * 1.1))
    return P


def horse2(M, x, y, z, ang, coat='bay', s=1.0, pose='stand', cloth=None, blaze=False):
    mats = coat_mats(coat)
    parts = []
    down = 1.0 if pose == 'graze' else 0.0
    secs = _body_sections(down)
    pts = [(a[0], 0.0, a[1]) for a in secs]
    rad = [(a[2], a[3]) for a in secs]
    parts.append(ring_loft('Spine', pts, rad, mats['body'], n=18, subsurf=1))
    # head tip (muzzle) darker
    hx, hz = pts[-1][0], pts[-1][2]
    parts.append(sph('Nose', (hx - 0.01, 0, hz), 0.052, mats['nose'], scale=(1.0, 0.9, 0.9), seg=16, rings=8))
    # eyes + ears
    head_start = pts[-6]
    hc = Vector(pts[-5]); 
    for sy in (-1, 1):
        parts.append(sph('Eye', (hc.x + 0.05, sy * 0.082, hc.z + 0.05), 0.022, mats['eye'], seg=12, rings=8))
        e = cyl('Ear', (pts[-6][0] - 0.02, sy * 0.055, pts[-6][2] + 0.14), 0.032, 0.17, 'Z', verts=10, mat=mats['body'], r2=0.01)
        e.rotation_euler = (sy * 0.18, 0.15, 0)
        parts.append(e)
    if blaze:
        parts.append(sph('Blaze', (hc.x + 0.07, 0, hc.z + 0.085), 0.045, S.principled('Bl', '#f4efe6', rough=0.6), scale=(1.5, 0.45, 0.4), seg=14, rings=8))
    # mane along the crest
    crest = [(p[0] - 0.02, 0.0, p[2] + r[1] * 0.92) for p, r in list(zip(pts, rad))[5:-5]]
    mane = ring_loft('Mane', crest, [(0.03, 0.07)] * len(crest), mats['mane'], n=8, subsurf=1)
    parts.append(mane)
    fore = (hc.x - 0.12, 0.0, hc.z + 0.12)
    parts.append(sph('Forelock', fore, 0.06, mats['mane'], scale=(0.9, 0.7, 1.3), seg=10, rings=6))
    # tail
    tl = tube('Tail', [(-1.08, 0, 1.30), (-1.28, 0, 1.12), (-1.36, 0, 0.8), (-1.34, 0, 0.45)], 0.075, mats['mane'], smooth=True, res=6)
    tl.data.bevel_depth = 0.075
    # taper tail
    for i, pnt in enumerate(tl.data.splines[0].bezier_points):
        pnt.radius = [1.0, 1.1, 0.9, 0.35][i]
    parts.append(tl)
    # legs
    fy, hy = 0.15, 0.16
    for sy in (-1, 1):
        trot_leg = (pose == 'trot' and sy == 1)
        if trot_leg:
            parts += leg('FL', (0.62, sy * fy, 1.10), (0.88, sy * fy, 0.78), (0.82, sy * fy, 0.52), mats, 0.135)
        else:
            parts += leg('FL', (0.62, sy * fy, 1.10), (0.68, sy * fy, 0.52), (0.66, sy * fy, 0.17), mats, 0.135)
        parts += leg('HL', (-0.80, sy * hy, 1.15), (-0.98, sy * hy, 0.55), (-0.90, sy * hy, 0.17), mats, 0.17, hind=True, mid=(-0.62, sy * hy, 0.86))
    if cloth:
        cm = S.principled('Cloth', cloth, rough=0.7)
        parts.append(box('Cloth', (0.0, 0, 1.60), (0.7, 0.62, 0.05), cm, bevel=0.02))
        parts.append(box('Saddle', (0.05, 0, 1.66), (0.45, 0.30, 0.08), S.principled('Sad', '#2b1a10', rough=0.45, coat=0.3), bevel=0.03))
    # place
    R = Matrix.Rotation(ang, 3, 'Z')
    for o in parts:
        o.matrix_basis = Matrix.Translation((x, y, z)) @ R.to_4x4() @ Matrix.Scale(s, 4) @ o.matrix_basis
    return parts


def test():
    a = S.args(); out = a[0]; coat = a[1] if len(a) > 1 else 'bay'; pose = a[2] if len(a) > 2 else 'stand'
    S.reset(); S.setup_render((600, 450), int(a[3]) if len(a) > 3 else 24); S.world(0.35); bpy.context.scene.view_settings.exposure = -1.0
    P = horse2({}, 0, 0, 0, 0, coat, 1.0, pose, cloth='#c0392b' if pose == 'trot' else None, blaze=True)
    P = [p for p in P]
    import kit
    P = kit.convert_curves(P)
    bpy.context.view_layer.update()
    S.studio_lights(scale=3.5, aim=(0, 0, 1), key=1.0)
    S.shadow_catcher(0, 40)
    cam = S.camera((3.2, -4.6, 2.2), (0.2, 0, 1.0), lens=55)
    S.frame_objects(cam, [p for p in P if p.type == 'MESH'], fill=0.8)
    S.render(out)


if __name__ == '__main__':
    test()
