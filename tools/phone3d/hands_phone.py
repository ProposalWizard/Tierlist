"""THE 3D PHONE, FIRST PERSON: two hands holding a phone (Stage 3, step 1; Harry,
19 Nov 2026, RUL-UI-008: "clicking into Phone causes some sort of fade transition
(maybe an eye blinking open type of thing) that takes you to the 3d phone screen").

A still for the test page /star-phone3d-dev: hands and phone rendered on a
see-through background; the real phone UI (components/star/PhoneHome.tsx) is laid
over the screen, so taps stay normal page taps (docs: the 3D audit, section e).

Style: the game's chunky "toy" 3D (tools/blender-shop/scripts/icons3d.py), lit by
the same studio. Everything is modelled in code, no outside files.

The screen is a flat emissive colour, and the script prints the screen's four
corners in picture pixels (JSON on the line starting "SCREEN"), so the UI can be
fitted exactly.

usage: blender -b -P hands_phone.py -- <out.png> [width height samples] [pose]
pose: "held" (both hands, establishing shot) | "raised" (phone up, nearly filling
the view, thumbs at the bottom edge).
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "blender-shop", "scripts"))
import bpy  # noqa: E402
from bpy_extras.object_utils import world_to_camera_view  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import studio as S  # noqa: E402
from kit import box, sph, tube  # noqa: E402

a = S.args()
OUT = a[0]
W = int(a[1]) if len(a) > 1 else 780
H = int(a[2]) if len(a) > 2 else 1688
SAMPLES = int(a[3]) if len(a) > 3 else 48
POSE = a[4] if len(a) > 4 else "held"

S.reset()
S.setup_render((W, H), SAMPLES)
S.world(0.5, top=(0.78, 0.74, 0.70), bottom=(0.16, 0.14, 0.13))

# ---------------------------------------------------------------- materials
skin = S.principled("Skin", "#c98d6b", rough=0.55, coat=0.15, sheen=0.3)
skin_dark = S.principled("SkinCrease", "#a86e52", rough=0.6)
nail = S.principled("Nail", "#e9c3b1", rough=0.25, coat=0.6)
body = S.principled("PhoneBody", "#1b1f27", rough=0.25, metal=0.6, coat=1.0, coat_rough=0.04)
rim = S.principled("PhoneRim", "#8a93a3", rough=0.18, metal=1.0)
glass = S.principled("Bezel", "#05070b", rough=0.05, coat=1.0)
screen = S.principled("Screen", "#00ff66", rough=1.0, emission="#00ff66", emission_strength=1.0)
sleeve = S.principled("Sleeve", "#1f2a44", rough=0.85, sheen=0.6)

# ------------------------------------------------------------------- phone
# Built facing -Y (towards the camera), centred on the origin, then moved.
PW, PH, PT = 0.074, 0.156, 0.0095  # metres: a modern phone
parts_phone = []
parts_phone.append(box("Body", (0, 0, 0), (PW, PT, PH), body, bevel=0.009, seg=6))
parts_phone.append(box("Rim", (0, 0, 0), (PW + 0.0016, PT * 0.6, PH + 0.0016), rim, bevel=0.0095, seg=6))
parts_phone.append(box("Glass", (0, -PT / 2 - 0.0004, 0), (PW - 0.002, 0.0008, PH - 0.002), glass, bevel=0.008, seg=6))
SW, SH = PW - 0.0075, PH - 0.0075
scr = box("ScreenPlane", (0, -PT / 2 - 0.0010, 0), (SW, 0.0004, SH), screen, bevel=0.006, seg=6)
parts_phone.append(scr)
# the camera island on the back is hidden; a speaker slit on the front top
parts_phone.append(box("Slit", (0, -PT / 2 - 0.0013, PH / 2 - 0.006), (0.012, 0.0004, 0.0012), rim, bevel=0.0005))

phone = bpy.data.objects.new("Phone", None)
bpy.context.scene.collection.objects.link(phone)
for p in parts_phone:
    p.parent = phone


# ------------------------------------------------------------------- hands
def finger(name, pts, r, tip=True):
    """A rounded finger along pts (local to the phone), with a nail on the last joint."""
    o = tube(name, pts, r, skin, res=10, taper=[1.0, 0.95, 0.85])
    o.parent = phone
    if tip:
        e = Vector(pts[-1])
        n = sph(name + "Tip", tuple(e), r * 1.02, skin)
        n.parent = phone
        return [o, n]
    return [o]


def hand(side):
    """side = -1 left, +1 right. Palm and fingers wrap the back; the thumb lies on
    the bezel edge (never over the screen, so taps and the UI stay clear)."""
    s = side
    out = []
    x_edge = s * (PW / 2)
    # palm: a soft block behind the lower half of the phone
    palm = sph(f"Palm{s}", (x_edge + s * 0.012, PT / 2 + 0.018, -0.035), 0.034, skin, scale=(0.8, 0.55, 1.15))
    palm.parent = phone
    out.append(palm)
    # fingers wrap round behind the phone: their tips peek round the far edge
    for k, z in enumerate([0.030, 0.006, -0.018]):
        base = (x_edge + s * 0.010, PT / 2 + 0.020, z - 0.020)
        mid = (x_edge * 0.35, PT / 2 + 0.012, z - 0.010)
        tipp = (-x_edge * 0.55 - s * 0.006 * k, PT / 2 + 0.003, z)
        out += finger(f"Finger{s}{k}", [base, mid, tipp], 0.0072 - 0.0004 * k)
    # thumb: from the palm up along the side, resting on the bezel corner
    out += finger(f"Thumb{s}", [
        (x_edge + s * 0.024, -0.004, -0.058),
        (x_edge + s * 0.010, -PT / 2 - 0.006, -0.030),
        (x_edge - s * 0.0015, -PT / 2 - 0.0045, -0.006),
    ], 0.0088)
    # wrist and forearm out of the bottom of the view, in a sleeve
    fa = tube(f"Forearm{s}", [(x_edge + s * 0.018, PT / 2 + 0.024, -0.080), (x_edge + s * 0.060, 0.060, -0.230)], 0.026, skin, res=12)
    fa.parent = phone
    sl = tube(f"Sleeve{s}", [(x_edge + s * 0.030, 0.034, -0.125), (x_edge + s * 0.080, 0.080, -0.30)], 0.036, sleeve, res=14)
    sl.parent = phone
    out += [fa, sl]
    return out


hand_parts = hand(-1) + hand(+1)

# --------------------------------------------------------------- the pose
# Eye at the origin looking along +Y. "held": phone at chest height, tilted to
# face the eye. "raised": brought up close so it nearly fills the view.
if POSE == "raised":
    loc, tilt, lens = Vector((0, 0.235, -0.02)), 8, 30
else:
    loc, tilt, lens = Vector((0, 0.36, -0.13)), 26, 28
phone.location = loc
phone.rotation_euler = (math.radians(-tilt), 0, 0)
bpy.context.view_layer.update()

cam = S.camera((0, 0, 0), tuple(loc + Vector((0, 0.05, 0.03))), lens=lens)
S.studio_lights(scale=0.6, aim=tuple(loc), key=1.0)
bpy.context.view_layer.update()

# ---------------------------------------------------------- screen corners
scene = bpy.context.scene
mw = phone.matrix_world
y = -PT / 2 - 0.0013
corners = {
    "tl": mw @ Vector((-SW / 2, y, SH / 2)),
    "tr": mw @ Vector((SW / 2, y, SH / 2)),
    "br": mw @ Vector((SW / 2, y, -SH / 2)),
    "bl": mw @ Vector((-SW / 2, y, -SH / 2)),
}
px = {}
for k, v in corners.items():
    c = world_to_camera_view(scene, cam, v)
    px[k] = [round(c.x * W, 1), round((1 - c.y) * H, 1)]
print("SCREEN " + json.dumps({"w": W, "h": H, "pose": POSE, "corners": px}))

S.render(OUT)
