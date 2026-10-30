"""Star Pass: art for the rewards that showed as a plain box (Mikey, 28 Oct 2026:
"make proper art for them … with Blender").

  blender -b --factory-startup -P tools/star-pass-art/render_pass_rewards_more.py -- <out_dir> [samples] [job,job,...|all]
  GLB=1 blender -b --factory-startup -P tools/star-pass-art/render_pass_rewards_more.py -- <out_dir> 1 [jobs]

The first form renders one still per job (<job>-000.png); make_all.sh turns
them into WebPs. GLB=1 exports the same reward as a .glb instead (no podium:
the page loads podium-<theme>-<tier>.glb under it), for the tap-to-preview
you can spin. GLB=1 also covers the 17 rewards in render_pass_rewards.py.

Every reward stands on the podium of its level in DEFAULT_PASS_LEVELS
(lib/star/rewardCatalogue.ts): 1-20 premier, 21-40 europa, 41-60 champions,
61-80 worldcup, 81-100 ballondor, great every 10th. One camera per tier, so
every medium reward is framed the same and every great one too.

Built from simple shapes, like render_pass_rewards.py: no downloaded models,
no real brands or logos.

Jobs (card id -> level):
  boots       boots-blackout 10 · boots-volt 30 · boots-gold 60 · boots-signature 78
  wearables   tape-white 4 · headband-white 12 · snood-black 22 · sleeves-black 32 ·
              headband-ninja 42 · armband-rainbow 62 · armband-classic 72 · gloves-gold 82
  celebrations celeb-hands-up 2 · celeb-arms-out 16 · celeb-knee-slide 26 ·
              celeb-corner-flag 44 · celeb-backflip 64 · celeb-own-name 76 · celeb-statue 96
  penalty run-ups  stroll 6 · two_step 18 · sprint 34 · arc 52 · golden 84
  free-kick run-ups fk_power_stance 14 · fk_stance_sprint 24 · fk_calm_curl 38 ·
              fk_stutter_curl 46 · fk_angled_whip 58 · fk_long_diagonal 68 · fk_leaf 94
  live cards' stills  star-ball 28 · gold-aviators 48
"""
import bpy, bmesh, math, os, sys
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import render_star_pass as base  # noqa: E402
import render_star_pass_items as items  # noqa: E402
import render_pass_rewards as pr  # noqa: E402
from render_pass_rewards import (M, gold, steel, box, sphere, cylinder, torus, lathe, empty,  # noqa: E402
                                 subsurf, football_panels, _img, ball_material, star_ball_material)

GLB = os.environ.get("GLB") == "1"
OUT, SAMPLES, ONLY = pr.OUT, pr.SAMPLES, pr.ONLY
DECK = pr.DECK
THEMES = ["premier", "europa", "champions", "worldcup", "ballondor"]
# One camera per tier (look height, distance): every reward of a tier framed alike.
CAM = {"medium": (1.9, 15.0), "great": (2.15, 16.5)}


def spot(level):
    """The podium a level stands on: (theme, tier, deck height)."""
    theme = THEMES[min(4, (level - 1) // 20)]
    great = level % 10 == 0
    base.plinth(theme, great)
    tier = "great" if great else "medium"
    return theme, tier, DECK[tier]


def hexc(h):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


def accent(theme):
    return base.THEMES[theme][1]


# ── Shared pieces ───────────────────────────────────────────────────────────


def classic_ball_material():
    w, h = 1536, 768
    pent, seam, _ = football_panels(w, h)
    col = np.where(pent[..., None], np.array([0.02, 0.02, 0.025]), np.array([0.92, 0.92, 0.93])).astype(np.float32)
    col = col * (1 - seam[..., None] * 0.7)
    return ball_material("classic", _img("cb_c", col, w, h), _img("cb_h", 1 - seam, w, h, False), coat=0.4)


def football(r, loc, mat_=None):
    o = sphere(r, loc, mat_ or classic_ball_material(), segs=64, rings=32, name="ball")
    o.rotation_euler = (math.radians(18), math.radians(-12), math.radians(28))
    return o


def stud_boot(upper, sole, trim, parent, loc, rot_z, s=1.0, star=None):
    """A football boot facing +X: a rounded upper, a thin sole with studs,
    a heel panel and laces. No maker's marks."""
    root = empty("boot", parent, loc, (0, 0, math.radians(rot_z)), s)
    up = box((0.66, 0.24, 0.2), (0.0, 0, 0.14), upper, root, bev=0.0, name="upper")
    subsurf(up, 2)
    toe = sphere(0.13, (0.25, 0, 0.1), upper, root, scale=(1.25, 0.95, 0.75), name="toe")
    heel = box((0.2, 0.25, 0.22), (-0.24, 0, 0.15), trim, root, bev=0.05, name="heel")
    collar = cylinder(0.105, 0.12, (-0.2, 0, 0.2), upper, root, bev=0.03, verts=24, name="collar")
    box((0.7, 0.26, 0.035), (0.0, 0, 0.03), sole, root, bev=0.012, name="sole")
    for x in (-0.24, -0.12, 0.08, 0.2, 0.28):
        for y in (-0.07, 0.07):
            cylinder(0.022, 0.05, (x, y, -0.035), sole, root, bev=0.006, verts=12, name="stud")
    lace = M("lace", (0.95, 0.95, 0.95), rough=0.5) if star is None else star
    for k in range(4):
        box((0.03, 0.17, 0.015), (-0.06 + k * 0.075, 0, 0.245), lace, root, bev=0.005, name="lace")
    if star is not None:  # the Signature Boots' gold star on the outside
        from render_pass_rewards import star_pts
        pts = star_pts(0.07, 0.03)
        bm = bmesh.new()
        vs = [bm.verts.new((x, 0, z)) for x, z in pts]
        f = bm.faces.new(vs)
        bmesh.ops.extrude_face_region(bm, geom=[f])
        for v in bm.verts[len(pts):]:
            v.co.y -= 0.02
        o = pr.from_bm(bm, "star", star)
        pr.put(o, root, (-0.05, -0.125, 0.14))
    return root


def boots_pair(level, upper, sole, trim, star=None):
    theme, tier, deck = spot(level)
    s = 1.9 if tier == "great" else 1.6
    stud_boot(upper, sole, trim, None, (-0.45, 0.35, deck + 0.065 * s), 205, s, star)
    stud_boot(upper, sole, trim, None, (0.45, -0.3, deck + 0.065 * s), 225, s, star)
    return tier


def bust(theme, deck, s=1.0, with_shoulders=True, dark=False):
    """A display bust (head, neck, shoulders): pale stone, or charcoal under
    something white."""
    stone = M("bust", (0.13, 0.14, 0.16) if dark else (0.62, 0.6, 0.58), rough=0.55, coat=0.3)
    root = empty("bust", None, (0, 0, deck), scale=s)
    cylinder(0.55, 0.12, (0, 0, 0), stone, root, bev=0.03, name="foot")
    cylinder(0.12, 0.45, (0, 0, 0.12), stone, root, bev=0.02, name="pole")
    if with_shoulders:
        lathe([(0.0, 0.55), (0.62, 0.58), (0.78, 0.7), (0.74, 0.86), (0.5, 0.98), (0.2, 1.05), (0.0, 1.06)],
              stone, root, scale=(1.0, 0.55, 1.0), name="shoulders")
    cylinder(0.15, 0.32, (0, 0, 1.0), stone, root, bev=0.02, name="neck")
    sphere(0.36, (0, 0, 1.55), stone, root, scale=(0.86, 0.95, 1.08), name="head")
    sphere(0.06, (0, -0.33, 1.52), stone, root, scale=(0.7, 1, 1.2), name="nose")
    return root, stone


def arm_form(deck, x=0.0, s=1.0):
    """An upright arm form (upper arm and shoulder cap) for armbands."""
    stone = M("form", (0.62, 0.6, 0.58), rough=0.6, coat=0.2)
    root = empty("arm", None, (x, 0, deck), scale=s)
    cylinder(0.5, 0.1, (0, 0, 0), stone, root, bev=0.03, name="foot")
    cylinder(0.27, 1.7, (0, 0, 0.1), stone, root, bev=0.04, r2=0.32, name="upper")
    sphere(0.33, (0, 0, 1.8), stone, root, scale=(1, 1, 0.7), name="cap")
    return root


def band(r_in, h, z, mat_, parent=None, thick=0.05, name="band"):
    return lathe([(r_in, z), (r_in + thick, z + 0.01), (r_in + thick, z + h - 0.01), (r_in, z + h)],
                 mat_, parent, name=name)


def figure(at, face=-90, kit=None, scale=2.0, material=None):
    """The figurine footballer (render_star_pass_items.footballer), optionally
    in another kit or in one material (a statue)."""
    before = set(bpy.data.objects)
    J = items.footballer()
    if kit or material:
        for o in set(bpy.data.objects) - before:
            if o.type != "MESH":
                continue
            name = o.data.materials[0].name if o.data.materials else ""
            if material is not None:
                o.data.materials.clear(); o.data.materials.append(material)
            elif kit and name in kit:
                o.data.materials.clear(); o.data.materials.append(kit[name])
    J["root"].scale = (scale,) * 3
    return J


def pose(J, at, face=-90, **kw):
    p = dict(at=at, face=face, hipL=(0, 4), hipR=(0, 4), armL=(4, 8, 15), armR=(4, 8, 15), lean=0)
    p.update(kw)
    items.apply_pose(J, p, 0)
    # The pose is keyframed; drop the keys (values stay) so a later tweak sticks.
    for o in bpy.data.objects:
        if o.animation_data:
            o.animation_data_clear()


# Footprints, ribbons and the wall for the run-ups.


def footprint(x, y, z, heading, mat_, left, s=1.0):
    """A shoe print: the ball of the foot and the heel, flat on the deck."""
    root = empty("print", None, (x, y, z + 0.006), (0, 0, heading), s)
    off = 0.05 if left else -0.05
    sphere(0.085, (0.06, off, 0), mat_, root, scale=(1.3, 0.85, 0.06), segs=24, rings=8, name="ball_of_foot")
    sphere(0.06, (-0.12, off, 0), mat_, root, scale=(1.1, 0.85, 0.06), segs=24, rings=8, name="heel")
    return root


def prints_along(pts, mat_, s=1.0):
    """Footprints at the given (x, y) points, alternating feet, each facing
    the next point."""
    for i, (x, y) in enumerate(pts):
        nx, ny = pts[min(i + 1, len(pts) - 1)] if i + 1 < len(pts) else (x + (x - pts[i - 1][0]), y + (y - pts[i - 1][1]))
        h = math.atan2(ny - y, nx - x)
        footprint(x, y, DECK_NOW[0], h, mat_, i % 2 == 0, s)


def ribbon(points, r, mat_, name="trail"):
    cd = bpy.data.curves.new(name, "CURVE")
    cd.dimensions = "3D"
    cd.bevel_depth = r
    cd.bevel_resolution = 4
    sp = cd.splines.new("NURBS")
    sp.points.add(len(points) - 1)
    for p, v in zip(sp.points, points):
        p.co = (*v, 1)
    sp.order_u = 4
    sp.use_endpoint_u = True
    cd.resolution_u = 24
    o = bpy.data.objects.new(name, cd)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat_)
    # taper the tail so it reads as a flight
    tp = bpy.data.curves.new(name + "_taper", "CURVE")
    ts = tp.splines.new("POLY"); ts.points.add(2)
    for p, v in zip(ts.points, ((0, 0.25, 0, 1), (0.5, 1, 0, 1), (1, 0.85, 0, 1))):
        p.co = v
    to = bpy.data.objects.new(name + "_taper", tp)
    bpy.context.scene.collection.objects.link(to)
    cd.taper_object = to
    return o


def glow(theme, name="trail", k=6.0, color=None):
    c = color or accent(theme)
    return M(name, c, emit=c, strength=k, rough=0.3)


def wall(deck, theme, x=-0.2, n=3):
    """A free-kick wall of three faceless mannequins, arms down."""
    dark = M("wall", tuple(v * 0.6 for v in base.THEMES[theme][0]), rough=0.5, coat=0.3)
    for k in range(n):
        y = (k - (n - 1) / 2) * 0.45
        cylinder(0.17, 0.95, (x, y, deck), dark, bev=0.07, r2=0.2, name="body")
        sphere(0.14, (x, y, deck + 1.13), dark, name="head")


DECK_NOW = [0.79]


# ── Boots ───────────────────────────────────────────────────────────────────


def job_boots_blackout():
    blk = M("black", (0.012, 0.012, 0.014), rough=0.35, coat=0.8)
    return boots_pair(10, blk, M("sole", (0.03, 0.03, 0.03), rough=0.5), M("heelb", (0.05, 0.05, 0.06), rough=0.2, coat=1))


def job_boots_volt():
    return boots_pair(30, M("volt", hexc("#d9f99d"), rough=0.3, coat=0.8), M("vsole", hexc("#65a30d"), rough=0.4),
                      M("vheel", hexc("#65a30d"), rough=0.3, coat=0.6))


def job_boots_gold():
    return boots_pair(60, gold(0.12, "chromegold"), M("gsole", hexc("#a16207"), metallic=0.8, rough=0.25),
                      gold(0.2, "gheel"))


def job_boots_signature():
    white = M("white", (0.92, 0.92, 0.94), rough=0.3, coat=0.8)
    g = gold(0.14, "sig")
    return boots_pair(78, white, g, g, star=g)


# ── Wearables ───────────────────────────────────────────────────────────────


def job_tape_white():
    theme, tier, deck = spot(4)
    tape = M("tape", (0.93, 0.93, 0.92), rough=0.55)
    core = M("core", (0.75, 0.62, 0.42), rough=0.7)
    # One roll on its edge, one lying flat, a strip running off the standing one.
    r = empty("roll", None, (-0.25, 0.25, deck + 0.62), (math.radians(90), 0, math.radians(20)))
    lathe([(0.32, -0.2), (0.62, -0.2), (0.62, 0.2), (0.32, 0.2), (0.32, -0.2)], tape, r, name="roll")
    lathe([(0.28, -0.205), (0.32, -0.205), (0.32, 0.205), (0.28, 0.205), (0.28, -0.205)], core, r, name="core")
    f = empty("roll2", None, (0.75, -0.55, deck), (0, 0, 0))
    lathe([(0.24, 0), (0.46, 0), (0.46, 0.3), (0.24, 0.3), (0.24, 0)], tape, f, name="roll2")
    lathe([(0.2, -0.002), (0.24, -0.002), (0.24, 0.302), (0.2, 0.302), (0.2, -0.002)], core, f, name="core2")
    # the loose strip: a thin curved sheet from the standing roll to the deck
    bm = bmesh.new()
    prev = None
    for i in range(14):
        t = i / 13
        x = -0.25 + 0.05 + t * 0.95
        z = deck + 0.02 + 0.6 * (1 - t) ** 2
        a = bm.verts.new((x, 0.25 - 0.19 - t * 0.4, z)); b = bm.verts.new((x, 0.25 + 0.21 - t * 0.4, z))
        if prev:
            bm.faces.new((prev[0], a, b, prev[1]))
        prev = (a, b)
    o = pr.from_bm(bm, "strip", tape)
    o.modifiers.new("solid", "SOLIDIFY").thickness = 0.012
    return tier


def job_headband_white():
    theme, tier, deck = spot(12)
    root, _ = bust(theme, deck, dark=True)
    band(0.3, 0.13, 1.6, M("terry", (0.95, 0.95, 0.95), rough=0.9, sheen=0.6), root, thick=0.07, name="sweatband")
    root.children[-1].scale = (0.9, 0.98, 1)
    return tier


def job_headband_ninja():
    theme, tier, deck = spot(42)
    root, _ = bust(theme, deck)
    blk = M("ninja", hexc("#0b0f19"), rough=0.6, sheen=0.4)
    red = M("ninjared", hexc("#dc2626"), rough=0.5)
    b = band(0.3, 0.1, 1.62, blk, root, thick=0.05, name="band")
    b.scale = (0.9, 0.98, 1)
    band(0.305, 0.02, 1.66, red, root, thick=0.05, name="stripe").scale = (0.9, 0.98, 1)
    # the two tails, hanging at the back and flicking out
    for k, (dx, rz) in enumerate(((-0.06, 18), (0.07, -24))):
        t = box((0.08, 0.02, 0.5), (dx, 0.33, 1.42), blk, root, rot=(math.radians(25), math.radians(rz), 0), bev=0.008, name="tail")
    return tier


def job_snood_black():
    theme, tier, deck = spot(22)
    root, _ = bust(theme, deck)
    s = M("snood", hexc("#111827"), rough=0.75, sheen=0.8)
    lathe([(0.16, 0.92), (0.3, 0.95), (0.27, 1.1), (0.25, 1.26), (0.28, 1.36), (0.18, 1.37), (0.17, 1.3)],
          s, root, name="snood")
    return tier


def job_sleeves_black():
    theme, tier, deck = spot(32)
    s = M("sleeve", hexc("#111827"), rough=0.6, sheen=0.6)
    shirt = M("shirt", (0.75, 0.03, 0.06), rough=0.45, coat=0.3)
    stone = M("form", (0.62, 0.6, 0.58), rough=0.6, coat=0.2)
    root = empty("dummy", None, (0, 0, deck))
    cylinder(0.5, 0.1, (0, 0, 0), stone, root, bev=0.03, name="foot")
    cylinder(0.06, 0.65, (0, 0, 0.1), stone, root, bev=0.02, name="pole")
    # A tailor's torso in a red shirt, the black base-layer sleeves out of it.
    lathe([(0.0, 0.7), (0.36, 0.72), (0.4, 1.1), (0.46, 1.5), (0.5, 1.72), (0.3, 1.86), (0.0, 1.88)],
          shirt, root, scale=(1, 0.62, 1), name="torso")
    cylinder(0.09, 0.15, (0, 0, 1.86), stone, root, bev=0.02, name="neck")
    for side in (1, -1):
        cylinder(0.11, 0.3, (0.5 * side, 0, 1.66), shirt, root, rot=(0, math.radians(-120 * side), 0), bev=0.03, name="cap")
        cylinder(0.085, 1.0, (0.62 * side, 0, 1.55), s, root, rot=(0, math.radians(165 * side), 0), bev=0.03, r2=0.065, name="sleeve")
    return tier


def armband_on_arm(level, bands):
    theme, tier, deck = spot(level)
    root = arm_form(deck)
    z, h = 1.0, 0.34
    step = h / len(bands)
    for i, m in enumerate(bands):
        band(0.29, step + 0.002, z + i * step, m, root, thick=0.05, name=f"band{i}")
    return root, tier, z, h


def job_armband_rainbow():
    cols = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#8b5cf6"]
    _, tier, _, _ = armband_on_arm(62, [M(f"rb{i}", hexc(c), rough=0.45) for i, c in enumerate(cols)])
    return tier


def job_armband_classic():
    root, tier, z, h = armband_on_arm(72, [M("yel", hexc("#facc15"), rough=0.4)])
    # The C, on the front of the band.
    blk = M("cblack", hexc("#111827"), rough=0.4)
    bm = bmesh.new()
    pts = []
    for i in range(25):
        a = math.radians(50 + i * (260 / 24))
        pts.append((0.1 * math.cos(a), 0.1 * math.sin(a)))
    inner = [(x * 0.62, y * 0.62) for x, y in pts]
    vo = [bm.verts.new((x, 0, y)) for x, y in pts]
    vi = [bm.verts.new((x, 0, y)) for x, y in inner]
    for i in range(24):
        bm.faces.new((vo[i], vo[i + 1], vi[i + 1], vi[i]))
    ret = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
    for v in [e for e in ret["geom"] if isinstance(e, bmesh.types.BMVert)]:
        v.co.y -= 0.02
    o = pr.from_bm(bm, "C", blk)
    pr.put(o, root, (0, -0.345, z + h / 2), (0, 0, 0))
    return tier


def glove(mat_, cuff, parent, loc, rot):
    root = empty("glove", parent, loc, rot)
    palm = box((0.36, 0.13, 0.42), (0, 0, 0.3), mat_, root, bev=0.05, name="palm")
    for k, (x, l) in enumerate(((-0.13, 0.26), (-0.045, 0.31), (0.045, 0.3), (0.13, 0.24))):
        cylinder(0.042, l, (x, 0, 0.5), mat_, root, bev=0.035, verts=16, name="finger")
    cylinder(0.05, 0.24, (0.19, 0, 0.22), mat_, root, rot=(0, math.radians(-40), 0), bev=0.04, verts=16, name="thumb")
    box((0.4, 0.16, 0.16), (0, 0, 0.06), cuff, root, bev=0.04, name="cuff")
    return root


def job_gloves_gold():
    theme, tier, deck = spot(82)
    g = gold(0.18, "glove")
    cuff = M("cuff", hexc("#92400e"), rough=0.4, coat=0.5)
    glove(g, cuff, None, (-0.42, 0.1, deck + 0.02), (0, math.radians(-8), math.radians(-12)))
    glove(g, cuff, None, (0.42, -0.1, deck + 0.02), (0, math.radians(8), math.radians(12)))
    for o in bpy.data.objects:
        if o.name.startswith("glove"):
            o.scale = (1.7, 1.7, 1.7)
    return tier


def job_gold_aviators():
    theme, tier, deck = spot(48)
    root, _ = bust(theme, deck, dark=True)
    g = gold(0.12, "frame")
    lens = M("lens", (0.25, 0.14, 0.03), metallic=0.6, rough=0.04, coat=1.0)
    # Big on purpose: they must read at phone size on the road.
    for side in (-1, 1):
        o = sphere(0.165, (0.175 * side, -0.37, 1.6), lens, root, scale=(1.0, 0.25, 0.85), name="lens")
        o.rotation_euler = (0, 0, math.radians(-12 * side))
        torus(0.165, 0.022, (0.175 * side, -0.4, 1.6), g, root, rot=(math.radians(90), 0, 0), scale=(1, 0.85, 1), name="rim")
        box((0.025, 0.42, 0.025), (0.36 * side, -0.2, 1.64), g, root, bev=0.008, name="arm")
    box((0.06, 0.025, 0.025), (0, -0.4, 1.7), g, root, bev=0.008, name="bridge")
    return tier


def job_star_ball():
    theme, tier, deck = spot(28)
    col, hgt = items.star_ball_images(2048, 1024)
    hgt.colorspace_settings.name = "Non-Color"
    pr.ball_on_ring(deck, ball_material("starball", col, hgt, rough=0.32, coat=0.6))
    return tier


# ── Celebrations ────────────────────────────────────────────────────────────

FIG = 2.0


def job_celeb_hands_up():
    theme, tier, deck = spot(2)
    J = figure(None)
    pose(J, (0, 0, deck), lean=-6, hipL=(4, 10), hipR=(-4, 10), armL=(165, 25, 10), armR=(165, 25, 10))
    return tier


def job_celeb_arms_out():
    theme, tier, deck = spot(16)
    J = figure(None)
    pose(J, (0, 0, deck + 0.05), face=-60, lean=18, hipL=(28, 30), hipR=(-24, 50), armL=(0, 88, 5), armR=(0, 88, 5))
    J["root"].rotation_euler.x = math.radians(-12)  # banking like a plane
    return tier


def job_celeb_knee_slide():
    theme, tier, deck = spot(26)
    J = figure(None)
    # On his knees, leaning back, arms out wide; a skid line behind him.
    # knees on the deck: the knee sits 0.48 above the feet's origin, upright
    pose(J, (0.2, 0, deck + 0.02 - 0.44 * FIG), face=-70, lean=-24, hipL=(-8, 92), hipR=(-8, 92),
         armL=(40, 70, 10), armR=(40, 70, 10))
    skid = M("skid", (0.85, 0.85, 0.85), rough=0.9)
    for y in (-0.12, 0.12):
        box((1.1, 0.06, 0.006), (-0.7, y, deck + 0.004), skid, bev=0.002, name="skid")
    return tier


def job_celeb_corner_flag():
    theme, tier, deck = spot(44)
    pole = M("pole", (0.95, 0.95, 0.95), rough=0.3, coat=0.6)
    cylinder(0.05, 3.2, (0.75, 0.2, deck), pole, bev=0.01, verts=16, name="flagpole")
    # A chequered red-and-yellow flag.
    red, yel = M("fred", hexc("#ef4444"), rough=0.5), M("fyel", hexc("#facc15"), rough=0.5)
    for i in range(2):
        for j in range(2):
            box((0.34, 0.012, 0.3), (0.92 + i * 0.34, 0.2, deck + 2.95 - j * 0.3), red if (i + j) % 2 == 0 else yel,
                bev=0.003, name="flag")
    J = figure(None)
    pose(J, (-0.35, 0, deck), face=-30, lean=6, hipL=(0, 6), hipR=(60, 70),
         armL=(150, 40, 20), armR=(20, 30, 40))
    return tier


def job_celeb_backflip():
    theme, tier, deck = spot(64)
    # Upside down mid-flip, held up by a clear rod like a figurine.
    rod = M("rod", (0.9, 0.95, 1.0), rough=0.02, transmission=1.0)
    cylinder(0.05, 1.9, (0, 0.3, deck), rod, bev=0.01, verts=16, name="rod")
    J = figure(None)
    # tucked, upside down: the pelvis on the rod's tip, the head above the deck
    pose(J, (0, 0, deck + 1.95 + 0.95 * FIG), face=-90, lean=30, hipL=(110, 125), hipR=(110, 125),
         armL=(60, 30, 40), armR=(60, 30, 40))
    J["root"].rotation_euler = (0, math.radians(180), math.radians(-90))
    trail = glow(theme, "flip", 2.6, color=(0.1, 0.8, 0.95))
    ribbon([(1.3, 0, deck + 0.4), (1.7, 0, deck + 2.2), (0.6, 0, deck + 3.6), (-1.0, 0, deck + 3.2), (-1.5, 0, deck + 1.6)],
           0.05, trail)
    return tier


def job_celeb_own_name():
    theme, tier, deck = spot(76)
    J = figure(None)
    # Back to you, thumbs over his shoulders at the name on his shirt.
    pose(J, (0, 0, deck), face=90, lean=-4, hipL=(0, 4), hipR=(0, 4), armL=(150, 45, 150), armR=(150, 45, 150))
    g = gold(0.14, "number")
    t = bpy.data.curves.new("num", "FONT")
    t.body = "10"
    t.extrude = 0.01
    t.align_x = "CENTER"
    t.size = 0.42
    o = bpy.data.objects.new("num", t)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(g)
    o.location = (0, -0.27, deck + 1.18 * FIG)
    o.rotation_euler = (math.radians(90), 0, 0)
    return tier


def job_celeb_statue():
    theme, tier, deck = spot(96)
    stone = M("statue", hexc("#cbd5e1"), rough=0.55, coat=0.2)
    cylinder(0.5, 0.25, (0, 0, deck), M("block", hexc("#64748b"), rough=0.4, coat=0.4), bev=0.03, name="block")
    J = figure(None, material=stone)
    # Still as a statue: one arm pointing at the sky.
    pose(J, (0, 0, deck + 0.25), lean=-3, hipL=(0, 2), hipR=(0, 2), armL=(0, 8, 12), armR=(172, 12, 0))
    return tier


# ── Penalty run-ups: the ball on its spot, the run marked in footprints ─────


def runup(level, path, prints_mat=None, trail=None, spot_at=(0.95, -0.55)):
    theme, tier, deck = spot(level)
    DECK_NOW[0] = deck
    white = M("spot", (0.95, 0.95, 0.95), rough=0.6)
    cylinder(0.24, 0.008, (spot_at[0], spot_at[1], deck), white, bev=0.0, name="spot")
    football(0.42, (spot_at[0], spot_at[1], deck + 0.42))
    pm = prints_mat or glow(theme, "prints", 1.8)
    prints_along(path, pm, 1.7)
    if trail:
        trail()
    return tier


def job_stroll():
    pts = [(-1.3 + i * 0.32, 0.75 - i * 0.18) for i in range(7)]
    return runup(6, pts)


def job_two_step():
    return runup(18, [(0.25, -0.2), (0.55, -0.42)])


def job_sprint():
    theme = THEMES[1]
    pts = [(-1.6 + i * 0.62, 1.1 - i * 0.4) for i in range(4)]

    def streaks():
        m = glow(theme, "streak", 2.2)
        for k, dz in enumerate((0.18, 0.36, 0.54)):
            ribbon([(-1.5, 1.05 - k * 0.05, DECK_NOW[0] + dz), (-0.6, 0.5, DECK_NOW[0] + dz + 0.02),
                    (0.4, -0.15, DECK_NOW[0] + dz)], 0.035, m, name="streak")
    return runup(34, pts, trail=streaks)


def job_arc():
    pts = []
    for i in range(6):
        a = math.radians(170 - i * 22)
        pts.append((0.95 + 1.55 * math.cos(a) * 0.9, -0.55 + 1.55 * math.sin(a) * 0.75))
    return runup(52, pts)


def job_golden():
    theme = THEMES[4]
    goldglow = glow(theme, "goldprint", 2.4, color=(1.0, 0.7, 0.18))
    pts = []
    for i in range(6):
        a = math.radians(160 - i * 20)
        pts.append((0.95 + 1.5 * math.cos(a) * 0.85, -0.55 + 1.5 * math.sin(a) * 0.7))

    def trail():
        ribbon([(x, y, DECK_NOW[0] + 0.05 + 0.03 * i) for i, (x, y) in enumerate(pts)] + [(0.75, -0.5, DECK_NOW[0] + 0.15)],
               0.06, goldglow, name="goldtrail")
    return runup(84, pts, prints_mat=gold(0.15, "goldprints"), trail=trail)


# ── Free-kick run-ups: the stance, the wall, and the flight ─────────────────


def freekick(level, prints, flight, wobble=0.0):
    theme, tier, deck = spot(level)
    DECK_NOW[0] = deck
    bx, by = 0.6, -0.75
    football(0.4, (bx, by, deck + 0.4))
    pm = glow(theme, "prints", 1.8)
    prints_along(prints, pm, 1.6)
    wall(deck, theme, x=-0.35, n=3)
    pts = [(bx, by, deck + 0.42)] + [(x, y, deck + z * 1.25) for x, y, z in flight]
    ribbon(pts, 0.07, glow(theme, "flight", 2.6, color=(1.0, 0.62, 0.08)))
    return tier


def job_fk_power_stance():
    # Legs wide, then a few strong steps; a straight, wobbling knuckleball.
    return freekick(14, [(0.95, -1.3), (1.25, -0.95), (0.95, -1.05)],
                    [(0.3, -0.1, 0.9), (-0.05, 0.45, 1.5), (-0.45, 1.0, 1.7), (-0.8, 1.45, 1.5)])


def job_fk_stance_sprint():
    return freekick(24, [(1.55, -1.35), (1.85, -1.05), (1.4, -1.05), (1.1, -0.95)],
                    [(0.2, -0.15, 1.0), (-0.2, 0.4, 1.6), (-0.6, 0.95, 1.6), (-0.95, 1.4, 1.2)])


def job_fk_calm_curl():
    return freekick(38, [(1.25, -1.1), (0.95, -0.95)],
                    [(0.9, 0.0, 1.0), (0.55, 0.6, 1.6), (-0.2, 1.0, 1.7), (-0.9, 1.25, 1.2)])


def job_fk_stutter_curl():
    return freekick(46, [(1.4, -1.25), (1.2, -1.1), (1.15, -1.05), (0.95, -0.95)],
                    [(1.0, -0.05, 1.0), (0.6, 0.55, 1.65), (-0.15, 0.95, 1.75), (-0.85, 1.2, 1.25)])


def job_fk_angled_whip():
    return freekick(58, [(1.4, -0.3), (1.05, -0.55)],
                    [(1.15, -0.2, 0.7), (0.9, 0.5, 1.2), (0.1, 1.05, 1.3), (-0.9, 1.3, 0.9)])


def job_fk_long_diagonal():
    return freekick(68, [(1.9, 0.5), (1.65, 0.15), (1.4, -0.15), (1.15, -0.45)],
                    [(0.2, -0.3, 1.1), (-0.15, 0.3, 1.8), (-0.55, 0.9, 1.7), (-0.85, 1.3, 0.9)])


def job_fk_leaf():
    # Juninho's: up, then it dips and swerves late (an S).
    return freekick(94, [(1.2, -1.2), (0.95, -1.0)],
                    [(0.25, -0.2, 1.3), (0.05, 0.35, 1.9), (-0.55, 0.75, 1.85), (-0.3, 1.1, 1.3), (-0.8, 1.4, 0.8)])


# Make the reward read at phone size against its podium: everything but the
# podium is scaled about the deck's centre.
GROW = {
    "boots-blackout": 1.7, "boots-volt": 1.7, "boots-gold": 1.7, "boots-signature": 1.8,
    "tape-white": 1.5, "headband-white": 1.55, "headband-ninja": 1.55, "snood-black": 1.55,
    "sleeves-black": 1.45, "armband-rainbow": 1.45, "armband-classic": 1.45, "gloves-gold": 1.3,
    "gold-aviators": 1.55,
}

JOBS = {
    "boots-blackout": job_boots_blackout, "boots-volt": job_boots_volt, "boots-gold": job_boots_gold,
    "boots-signature": job_boots_signature,
    "tape-white": job_tape_white, "headband-white": job_headband_white, "headband-ninja": job_headband_ninja,
    "snood-black": job_snood_black, "sleeves-black": job_sleeves_black, "armband-rainbow": job_armband_rainbow,
    "armband-classic": job_armband_classic, "gloves-gold": job_gloves_gold,
    "celeb-hands-up": job_celeb_hands_up, "celeb-arms-out": job_celeb_arms_out, "celeb-knee-slide": job_celeb_knee_slide,
    "celeb-corner-flag": job_celeb_corner_flag, "celeb-backflip": job_celeb_backflip,
    "celeb-own-name": job_celeb_own_name, "celeb-statue": job_celeb_statue,
    "stroll": job_stroll, "two_step": job_two_step, "sprint": job_sprint, "arc": job_arc, "golden": job_golden,
    "fk_power_stance": job_fk_power_stance, "fk_stance_sprint": job_fk_stance_sprint,
    "fk_calm_curl": job_fk_calm_curl, "fk_stutter_curl": job_fk_stutter_curl,
    "fk_angled_whip": job_fk_angled_whip, "fk_long_diagonal": job_fk_long_diagonal, "fk_leaf": job_fk_leaf,
    "star-ball": job_star_ball, "gold-aviators": job_gold_aviators,
}


# ── GLB export (the spin-it preview) ────────────────────────────────────────


def export_glb(name, keep):
    objs = [o for o in bpy.context.scene.objects if o not in keep and o.type in ("MESH", "CURVE", "FONT", "EMPTY")]
    # curves and text become meshes so the file carries them
    for o in objs:
        if o.type in ("CURVE", "FONT"):
            bpy.ops.object.select_all(action="DESELECT")
            o.select_set(True)
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.convert(target="MESH")
    objs = [o for o in bpy.context.scene.objects if o not in keep and o.type in ("MESH", "EMPTY")
            and not o.name.endswith("_taper")]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = next(o for o in objs if o.type == "MESH")
    path = os.path.join(OUT, f"reward-{name}.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
                              export_yup=True, export_image_format="WEBP", export_cameras=False,
                              export_lights=False, export_animations=False)
    print("EXPORTED", path, os.path.getsize(path) // 1024, "KB", flush=True)


def uv_textures():
    """Point every direction-read texture at the object's UVs instead (glTF
    only knows UV textures); bump maps are dropped."""
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        nt = m.node_tree
        b = nt.nodes.get("Principled BSDF")
        for n in list(nt.nodes):
            if n.type == "BUMP":
                nt.nodes.remove(n)
        for n in list(nt.nodes):
            if n.type != "TEX_ENVIRONMENT":
                continue
            links = [(l.to_socket) for l in n.outputs["Color"].links]
            img = n.image
            nt.nodes.remove(n)
            if not links or b is None:
                continue
            t = nt.nodes.new("ShaderNodeTexImage")
            t.image = img
            for s in links:
                if s.node == b and s.name in ("Base Color", "Roughness"):
                    nt.links.new(t.outputs["Color"], s)
            if img is not None:
                img.pack()


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = dict(JOBS)
    if GLB:
        jobs.update({k: v for k, v in pr.JOBS.items()})
    for name, fn in jobs.items():
        if ONLY and name not in ONLY:
            continue
        pr.setup()
        # Mark the podium, so a GLB carries only the reward.
        made = []
        real_plinth = base.plinth

        def plinth(theme, great):
            before = set(bpy.data.objects)
            real_plinth(theme, great)
            made.extend(set(bpy.data.objects) - before)
        base.plinth = plinth
        try:
            tier = fn()
        finally:
            base.plinth = real_plinth
        if isinstance(tier, tuple):  # render_pass_rewards jobs return (tier, look, dist)
            tier = tier[0]
        if name in GROW:
            fixed = set(made) | {o for o in bpy.data.objects if o.type in ("CAMERA", "LIGHT")}
            pr.grow(fixed, (0, 0, DECK[tier]), GROW[name])
        if GLB:
            uv_textures()
            keep = set(made) | {o for o in bpy.context.scene.objects if o.type in ("CAMERA", "LIGHT")}
            export_glb(name, keep)
            continue
        look, dist = CAM[tier]
        items.camera(look, dist)
        path = os.path.join(OUT, f"{name}-000.png")
        bpy.context.scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print("WROTE", path, tier, flush=True)


if __name__ == "__main__":
    main()
