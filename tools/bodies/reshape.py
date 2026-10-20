"""RE-SHAPE A STYLE A BODY'S MESH (B5b, 20 Oct 2026; way "c" of the body options).

Harry rejected bone-scaled proportions ("none of those body proportions look
remotely good"). This changes the MESH itself, once, in Blender, and moves the
joints with it, so nothing at run time scales a bone:

    blender -b --python tools/bodies/reshape.py -- <fit.glb> <out_fit.glb> [head legs arms neck chest hips girth armg]
    TOON_REAL=1 python3 scripts/people3d/build_toon_bodies.py <dir> <tag>:<out_fit.glb relative to dir>

<fit.glb> is a body already fitted to the game skeleton (tools/modeltest/fit.py
output): its bone-heat weights say which part each vertex belongs to, and they are
kept. Every vertex AND every joint moves by the same rule, so the skin still fits:
  head   the head shrinks about the head joint (Head-bone weight, so the jaw and the
         nape blend into the neck) by `head`
  neck   the head is lifted `neck` x height, the lift fading in up the neck
  legs   the bare legs (from the boot tops to the shorts hem) stretch by `legs`;
         everything above rises with them (the shorts keep their size), and the
         stretched legs grow `girth` thicker about their own line
  arms   the upper arm, forearm and hand each stretch along their own bone by `arms`
         (the elbow's bend is kept) and grow `armg` thicker about it
  trunk  `chest` wider at the chest and shoulders, `hips` at the hips; the arms move
         out with their shoulder
  defaults 0.72 1.28 1.17 0.02 1.06 0.94 1.08 1.06
Out: the same skinned body (bones moved, each keeping its direction and roll, as
fit.py does), ready for build_toon_bodies.py. Prints the before/after heights.
"""
import bpy, sys, os
# Lean and posture dials (env, all default "no change"): RS_FOREARM forearm girth (else armg), RS_HANDS hand
# size about the wrist, RS_HEADBACK head and neck moved back (x height; fades in up the neck), RS_NECK neck
# thickness, RS_CHESTD the chest's depth in front of the spine.
ENV = lambda k, d: float(os.environ.get(k, d))
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[:2]
HEAD, LEGS, ARMS, NECK, CHEST, HIPS, GIRTH, ARMG = (float(x) for x in (argv[2:10] if len(argv) >= 10 else
                                                                      ("0.72", "1.28", "1.17", "0.02", "1.06", "0.94", "1.08", "1.06")))

for o in list(bpy.data.objects): bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = [o for o in bpy.data.objects if o.type == "ARMATURE"][0]
body = max((o for o in bpy.data.objects if o.type == "MESH"), key=lambda o: len(o.data.vertices))  # not a bone shape
for o in list(bpy.data.objects):
    if o not in (arm, body): bpy.data.objects.remove(o)
me = body.data
MW = body.matrix_world.copy()
AW = arm.matrix_world.copy()
J = {b.name: AW @ b.head_local for b in arm.data.bones}
gname = {g.index: g.name for g in body.vertex_groups}
P = [MW @ v.co for v in me.vertices]
top = max(p.z for p in P); floor = min(p.z for p in P)
H0 = top - floor
SIDES = ("Left", "Right")


def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# the shorts hem: the lowest height a ray along Y through x = 0 hits the body (between the legs)
tree = BVHTree.FromPolygons(P, [list(p.vertices) for p in me.polygons])
z = floor + 0.25 * H0
while z < top and tree.ray_cast(Vector((0, -5, z)), Vector((0, 1, 0)))[0] is None: z += 0.002 * H0
hem = z
ankle = (J["LeftFoot"].z + J["RightFoot"].z) / 2
lo = ankle + 0.03 * H0          # just above the boot top: the boot keeps its shape
lift = (hem - lo) * (LEGS - 1)  # how much everything above the shorts hem rises
E = 0.02 * H0                   # a soft start and end to the stretch (no kink at the sock or the hem)
neck0, head0 = J["neck"].z, J["Head"].z
dn = NECK * H0
zSh, zHip = (J["LeftArm"].z + J["RightArm"].z) / 2, J["Hips"].z


def legband(z):
    """1 on the bare legs being stretched, easing to 0 at the boot top and the shorts hem."""
    return smooth(lo - E, lo + E, z) * (1 - smooth(hem - E, hem + E, z))


# RS_SHIN (B5d): the shin's own stretch (boot top to knee); LEGS is then the thigh's (knee to shorts hem).
# Today's Style A bodies are short in the THIGH (knee 0.51 m, hip joint 0.88 m of 1.86; a real man 0.53 / 0.99),
# so a cartoon athlete's longer legs come mostly from the thigh, not from longer socks.
SHIN = os.environ.get("RS_SHIN")
kneeZ = (J["LeftLeg"].z + J["RightLeg"].z) / 2


def stretch_at(z):
    if SHIN is None: return LEGS
    return float(SHIN) + (LEGS - float(SHIN)) * smooth(kneeZ - E, kneeZ + E, z)


def _leg_int(z):
    n = 200; acc = 0.0; z0 = lo - E; dz = (z - z0) / n
    for i in range(n):
        zz = z0 + (i + 0.5) * dz
        acc += dz * (1 + (stretch_at(zz) - 1) * legband(zz))
    return z0 + acc


if SHIN is not None: lift = _leg_int(hem + E) - (hem + E)


def leg_z(z):
    """Heights: below the boot top stay, the bare legs stretch by LEGS, above rise by `lift`."""
    if z <= lo - E: return z
    if z >= hem + E: return z + lift
    return _leg_int(z)


def taper(z):
    """Across (x) scale of the trunk at a height: narrower hips, a broader chest and shoulders."""
    if z <= hem - 0.06 * H0: return 1.0
    if z <= hem: return 1 + (HIPS - 1) * smooth(hem - 0.06 * H0, hem, z)
    if z <= zHip + 0.03 * H0: return HIPS
    if z <= zSh - 0.12 * H0: return HIPS + (CHEST - HIPS) * smooth(zHip + 0.03 * H0, zSh - 0.12 * H0, z)
    if z <= neck0: return CHEST
    return CHEST + (1 - CHEST) * smooth(neck0, head0, z)


lifted = Vector((0, 0, lift))
ARM = {}
for s in SIDES:
    S, Ej, W = J[s + "Arm"] + lifted, J[s + "ForeArm"] + lifted, J[s + "Hand"] + lifted
    S.x *= taper(zSh); Ej.x += S.x - (J[s + "Arm"].x); W.x += S.x - (J[s + "Arm"].x)
    ARM[s] = dict(S=S, E=Ej, W=W, du=(Ej - S).normalized(), df=(W - Ej).normalized(), Lu=(Ej - S).length, Lf=(W - Ej).length)
pivot = J["Head"] + Vector((0, 0, lift + dn))
FOREG, HANDS, HEADBACK, NECKS, CHESTD = ENV("RS_FOREARM", ARMG), ENV("RS_HANDS", 1), ENV("RS_HEADBACK", 0) * H0, ENV("RS_NECK", 1), ENV("RS_CHESTD", 1)
# RS_RIGIDHEAD=1 (B5d): the head moves as one piece. The neck lift, the head-back shift and the trunk's taper
# fade in by HEIGHT, and the mouth and chin sit below the head joint, so without this the lower face is lifted,
# moved back and narrowed less than the eyes (a squashed face). With it, a point carried by the head bone takes
# the head's whole move, so the face is today's face, only scaled (and its landmarks can be carried exactly).
RIGID = ENV("RS_RIGIDHEAD", 0) == 1
CHESTD_FROM = ENV("RS_CHESTD_FROM", 0)
spineY = J["Spine01"].y


def deform(p, w):
    """Where a point goes. w: its weights {'Left': (upper, fore, hand), 'Right': (…), 'head': h}."""
    warm = sum(sum(w[s]) for s in SIDES)
    p = p.copy()
    # leg girth: thicker about each leg's own line where it is stretched (a longer leg keeps its volume)
    gb = legband(p.z) * (1 - warm)
    if gb > 0 and GIRTH != 1:
        sd = "Left" if p.x > 0 else "Right"
        a, b = J[sd + "Foot"], J[sd + "UpLeg"]
        c = a.lerp(b, max(0.0, min(1.0, (p.z - a.z) / max(1e-6, b.z - a.z))))
        k = 1 + (GIRTH - 1) * gb
        p.x = c.x + (p.x - c.x) * k; p.y = c.y + (p.y - c.y) * k
    # the trunk's taper; an arm rides out with its shoulder
    hw = w["head"] if RIGID else 0.0
    tp = taper(p.z); tp = tp + (1 - tp) * hw
    x = p.x * tp * (1 - warm)
    for s in SIDES:
        x += sum(w[s]) * (p.x + (taper(zSh) - 1) * J[s + "Arm"].x)
    q = Vector((x, p.y, leg_z(p.z) * (1 - warm) + (p.z + lift) * warm))
    # neck: lift the head, fading in from the neck's base to the head joint
    q.z += dn * max(smooth(neck0, head0, p.z), hw) * (1 - warm)
    # chest: less deep in front of the spine (a footballer, not a barrel)
    if CHESTD != 1 and q.y < spineY and warm < 1:
        # RS_CHESTD_FROM (B5d): start the flattening this far (x height) above the hip joint, so the shirt's
        # lower front (which hangs over the shorts' waistband) keeps its depth and the waistband never shows through
        c0 = zHip + CHESTD_FROM * H0
        bump = smooth(c0, c0 + 0.1 * H0, p.z) * (1 - smooth(zSh - 0.05 * H0, zSh + 0.03 * H0, p.z))
        q.y = spineY + (q.y - spineY) * (1 - (1 - CHESTD) * bump * (1 - warm))
    # neck: thinner about its own line (neck-bone weight)
    if NECKS != 1 and w["neck"] > 0:
        c = J["neck"].lerp(J["Head"], max(0.0, min(1.0, (p.z - J["neck"].z) / (J["Head"].z - J["neck"].z))))
        k = 1 - (1 - NECKS) * w["neck"]
        q.x = c.x + (q.x - c.x) * k; q.y = c.y + (q.y - c.y) * k
    # head: shrink about the (lifted) head joint, by the Head-bone weight
    if w["head"] > 0:
        q = q + w["head"] * ((pivot + HEAD * (q - pivot)) - q)
    # posture: head and neck back over the shoulders (+y is his back)
    if HEADBACK:
        q.y += HEADBACK * max(smooth(neck0 - 0.03 * H0, head0, p.z), hw) * (1 - warm)
    # arms: each bone stretches along its own line and grows thicker about it
    for s in SIDES:
        wu, wf, wh = w[s]
        if wu + wf + wh <= 0: continue
        a = ARM[s]
        tu, tf = (q - a["S"]).dot(a["du"]), (q - a["E"]).dot(a["df"])
        gu = (q - (a["S"] + tu * a["du"])) * (ARMG - 1) * smooth(0.0, 0.12 * H0, tu)
        gf = (q - (a["E"] + tf * a["df"])) * (FOREG - 1)
        du = (ARMS - 1) * max(0.0, min(tu, a["Lu"])) * a["du"] + gu
        dfo = (ARMS - 1) * (a["Lu"] * a["du"] + max(0.0, min(tf, a["Lf"])) * a["df"]) + gf
        dh = (ARMS - 1) * (a["Lu"] * a["du"] + a["Lf"] * a["df"] + max(0.0, (q - a["W"]).dot(a["df"])) * a["df"])
        q = q + wu * du + wf * dfo + wh * dh
        if HANDS != 1 and wh > 0:
            Wn = a["W"] + (ARMS - 1) * (a["Lu"] * a["du"] + a["Lf"] * a["df"])
            q = q + wh * ((Wn + HANDS * (q - Wn)) - q)
    return q


def weights_of(names_w):
    w = {"head": 0.0}
    for s in SIDES:
        up = sum(x for n, x in names_w if n == s + "Arm")
        fo = sum(x for n, x in names_w if n == s + "ForeArm")
        ha = sum(x for n, x in names_w if n.startswith(s + "Hand"))
        w[s] = (up, fo, ha)
    w["head"] = sum(x for n, x in names_w if n in ("Head", "head_end", "headfront"))
    w["neck"] = sum(x for n, x in names_w if n == "neck")
    return w


out = [deform(p, weights_of([(gname[g.group], g.weight) for g in v.groups])) for v, p in zip(me.vertices, P)]
# the joints move by the same rule, as if wholly their own bone's
NJ = {n: deform(h, weights_of([(n, 1.0)])) for n, h in J.items()}

inv = MW.inverted()
for v, q in zip(me.vertices, out): v.co = inv @ q
bpy.ops.object.select_all(action="DESELECT"); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
ainv = AW.inverted()
for e in arm.data.edit_bones:
    for c in e.children: c.use_connect = False
for e in arm.data.edit_bones:
    roll = e.roll; d = e.tail - e.head
    nh = ainv @ NJ[e.name]
    e.head = nh; e.tail = nh + d; e.roll = roll
bpy.ops.object.mode_set(mode="OBJECT")
top2 = max(q.z for q in out); floor2 = min(q.z for q in out)
print("RESHAPE height", round(H0, 3), "->", round(top2 - floor2, 3), "hem", round(hem - floor, 3), "->", round(leg_z(hem) - floor, 3),
      "lift", round(lift, 3), "neck", round(dn, 3), "head x", HEAD, "legs x", LEGS, "arms x", ARMS, "chest", CHEST, "hips", HIPS, "girth", GIRTH, "armg", ARMG)
print("JOINTS", {n: tuple(round(x, 3) for x in NJ[n]) for n in ("Hips", "LeftUpLeg", "LeftLeg", "LeftFoot", "neck", "Head", "LeftArm", "LeftForeArm", "LeftHand")})
for pb in arm.pose.bones: pb.custom_shape = None
bpy.ops.object.select_all(action="DESELECT"); body.select_set(True); arm.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, use_selection=True, export_format="GLB", export_animations=False, export_skins=True, export_yup=True)
print("WROTE", OUT)
