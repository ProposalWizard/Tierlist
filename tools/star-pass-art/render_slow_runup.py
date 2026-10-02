"""Level 20: the slow, stuttering "Pogba" penalty run-up, on the great podium.

  blender.exe -b --factory-startup --python tools/star-pass-art/render_slow_runup.py -- <out_dir> <samples> [frames]

The realistic MakeHuman footballer (build_footballer.py -> footballer.blend)
waits behind the ball, takes seven tiny bouncing steps almost on the spot,
a last longer stride, plants, strikes, and clenches a fist. 20 fps, 120
frames = 6 s, made into an animated WebP by make_webp.py.
"""
import bpy, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import render_star_pass as base  # noqa: E402
from footballer_rig import Rig  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0]
FRAMES = argv[2] if len(argv) > 2 else "all"
BLEND = os.environ.get("FOOTBALLER_BLEND", r"C:/Users/mikey/mpfb/footballer.blend")
os.makedirs(OUT, exist_ok=True)

DECK = 1.55          # the great podium's deck height
FIG = 2.0            # statuette scale against the podium
THIGH, SHIN = 0.46, 0.44


def load_footballer():
    with bpy.data.libraries.load(BLEND, link=False) as (src, dst):
        dst.objects = [n for n in src.objects]
    for o in dst.objects:
        if o is not None and o.type in {"MESH", "ARMATURE"}:
            bpy.context.scene.collection.objects.link(o)
    return bpy.data.objects["Human.rig"]


def leg_height(flex, bend):
    """How far below the hip the ankle sits, for a thigh swung `flex` forward
    and a knee bent `bend` (degrees)."""
    f, k = math.radians(flex), math.radians(bend)
    return THIGH * math.cos(f) + SHIN * math.cos(f - k)


def main():
    base.reset()
    sc = bpy.context.scene
    sc.render.resolution_y = 620
    sc.render.fps = 20
    base.plinth("premier", True)
    rig_obj = load_footballer()
    rig = Rig(rig_obj)
    rig_obj.scale = (FIG, FIG, FIG)
    rig_obj.rotation_mode = "XYZ"

    from render_star_pass_items import ball_object  # noqa: E402  (needs a scene first)
    BR = 0.11 * FIG
    BX = 1.05
    white = base.mat("spot", (0.95, 0.95, 0.95), rough=0.6)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.12, depth=0.006, location=(BX, -0.05, DECK + 0.003))
    bpy.context.active_object.data.materials.append(white)
    ball = ball_object(BR, (BX, -0.05, DECK + BR))

    full = THIGH + SHIN
    def key(f, x, p, up=0.0, face=90.0, y=0.0):
        rig.pose(p)
        rig.key(f)
        legs = [leg_height(*p.get(k, (0, 0))[:2]) for k in ("hipL", "hipR")]
        drop = max(legs) - full
        rig_obj.location = (x, y, DECK + (drop + up) * FIG)
        rig_obj.rotation_euler = (0, 0, math.radians(face))
        rig_obj.keyframe_insert("location", frame=f)
        rig_obj.keyframe_insert("rotation_euler", frame=f)

    Y = 0.18  # his line: right foot passes just inside the ball
    stand = dict(hipL=(2, 4), hipR=(-2, 4), armL=(4, 6, 12), armR=(4, 6, 12), lean=3)
    START = -1.6
    key(0, START, dict(stand, nod=-6), y=Y)
    key(8, START, dict(stand, nod=4, lean=6, armL=(6, 8, 20), armR=(6, 8, 20)), y=Y)
    # Seven tiny bouncing steps, barely moving forward: down on one foot, the
    # other knee lifting a little, a small hop, down on the other.
    x = START
    f = 12
    step = 0.11
    for i in range(7):
        right = i % 2 == 0
        lead, trail = ("R", "L") if right else ("L", "R")
        x += step
        down = {"lean": 9, f"hip{lead}": (8, 12), f"hip{trail}": (-6, 28),
                f"arm{lead}": (-14, 8, 35), f"arm{trail}": (14, 8, 35), "nod": 10}
        key(f, x, down, y=Y)
        rise = {"lean": 8, f"hip{lead}": (-4, 10), f"hip{trail}": (18, 45),
                f"arm{lead}": (-6, 8, 35), f"arm{trail}": (6, 8, 35), "nod": 10}
        key(f + 4, x + step * 0.45, rise, up=0.035, y=Y)
        f += 8
    # f == 68: one longer stride, the pause, then the plant beside the ball.
    key(f + 2, x + 0.18, {"lean": 6, "hipR": (28, 15), "hipL": (-15, 40), "armL": (-20, 15, 30), "armR": (25, 10, 30), "nod": 12}, y=Y)
    key(f + 6, x + 0.36, {"lean": 2, "hipL": (24, 20), "hipR": (-18, 45), "armL": (10, 35, 25), "armR": (-15, 20, 30), "nod": 14}, up=0.02, y=Y)
    plant = f + 10  # 78
    key(plant, BX - 0.42, {"lean": -6, "twist": -10, "hipL": (12, 14), "hipR": (-45, 100), "toeR": 25,
                           "armL": (10, 70, 20), "armR": (25, 25, 35), "nod": 16}, y=Y)
    strike = plant + 4  # 82
    key(strike, BX - 0.34, {"lean": 2, "twist": 10, "hipL": (8, 12), "hipR": (14, 22), "toeR": 15,
                            "armL": (-5, 68, 20), "armR": (10, 30, 35), "nod": 14}, y=Y)
    key(strike + 3, BX - 0.28, {"lean": 8, "twist": 14, "hipL": (2, 8), "hipR": (62, 8),
                                "armL": (-15, 60, 25), "armR": (5, 35, 35), "nod": 6}, up=0.02, y=Y)
    key(strike + 7, BX - 0.2, {"lean": 5, "twist": 8, "hipL": (-4, 10), "hipR": (40, 20),
                               "armL": (-10, 40, 30), "armR": (10, 30, 35)}, y=Y)
    key(strike + 13, BX - 0.1, dict(stand), y=Y)
    # Turn to the camera and clench a fist.
    key(strike + 20, BX - 0.1, dict(stand, look=10), face=20, y=Y)
    key(strike + 25, BX - 0.1, dict(stand, lean=-4, armR=(35, 25, 115), fistR=1.0, nod=-8), face=20, y=Y)
    key(strike + 31, BX - 0.1, dict(stand, lean=-5, armR=(25, 25, 130), fistR=1.0, nod=-10), face=20, y=Y)
    key(119, BX - 0.1, dict(stand, lean=-4, armR=(30, 25, 125), fistR=1.0, nod=-8), face=20, y=Y)

    # The ball: pops onto the spot, waits, then flies off up and away.
    bl = ball.location.copy()
    def bkey(fr, loc, s):
        ball.location = loc; ball.scale = (s, s, s)
        ball.keyframe_insert("location", frame=fr); ball.keyframe_insert("scale", frame=fr)
    bkey(0, bl, 0.01); bkey(3, bl, 1.25); bkey(5, bl, 1.0); bkey(strike, bl, 1.0)
    far = (bl.x + 4.5, bl.y + 4.5, bl.z + 2.2)
    bkey(strike + 6, (bl.x + 2.4, bl.y + 2.4, bl.z + 1.4), 1.0)
    bkey(strike + 10, far, 1.0); bkey(strike + 11, far, 0.0); bkey(119, far, 0.0)
    for fc in ball.animation_data.action.fcurves:
        for k in fc.keyframe_points:
            k.interpolation = "LINEAR"
    ball.rotation_mode = "XYZ"
    ball.rotation_euler = (0, 0, 0); ball.keyframe_insert("rotation_euler", frame=strike)
    ball.rotation_euler = (math.radians(-600), 0, math.radians(200)); ball.keyframe_insert("rotation_euler", frame=strike + 10)

    sc.frame_start, sc.frame_end = 0, 119
    cam = sc.camera
    cam.data.lens = 70
    tilt, dist, zc = 74, 17.5, 2.9
    cam.rotation_euler = (math.radians(tilt), 0, 0)
    cam.location = (0, -dist, zc + dist / math.tan(math.radians(tilt)))
    frames = list(range(120)) if FRAMES == "all" else [int(v) for v in FRAMES.split(",")]
    for fr in frames:
        sc.frame_set(fr)
        sc.render.filepath = os.path.join(OUT, f"slow-{fr:03d}.png")
        bpy.ops.render.render(write_still=True)
        print("WROTE", sc.render.filepath, flush=True)


main()
