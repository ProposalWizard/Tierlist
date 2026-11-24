"""Dump Quaternius' Universal Animation Library 1 (CC0) out of its FBX, for retarget.py.

    blender -b --python tools/mocap3d/read_ual.py -- <UAL1_Standard.fbx> <out.json> [Clip_Name ...]

Blender (4.0, headless) imports the FBX. For each clip, every frame at the
library's own 30 fps, we write for each bone:
  - its world position (the joint, metres), and
  - its world turn away from its own rest pose (a 3x3 matrix),
in OUR character frame (x = his left, y up, z his front), plus the rest pose
(every joint's position). ual.py turns this into a CMU-shaped skeleton and
motion, so make.py / retarget.py take a UAL clip exactly like a capture.
Blender frame: the armature is turned 180° about z, so in world space he
faces +y with his left at -x; ours = (-x, z, y).
"""
import bpy, sys, json
from mathutils import Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
fbx, out = argv[0], argv[1]
want = set(argv[2:])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=fbx)
arm = [o for o in bpy.data.objects if o.type == "ARMATURE"][0]
C = Matrix(((-1, 0, 0), (0, 0, 1), (0, 1, 0)))
KEEP = ["root", "pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "Head",
        "thigh_l", "calf_l", "foot_l", "ball_l", "ball_leaf_l", "thigh_r", "calf_r", "foot_r", "ball_r", "ball_leaf_r",
        "clavicle_l", "upperarm_l", "lowerarm_l", "hand_l", "middle_01_l",
        "clavicle_r", "upperarm_r", "lowerarm_r", "hand_r", "middle_01_r"]
mw = arm.matrix_world
P = lambda v: [round(x, 5) for x in (C @ v)]
rest = {}
restR = {}
for n in KEEP:
    b = arm.data.bones[n]
    m = mw @ b.matrix_local
    rest[n] = P(m.to_translation())
    restR[n] = m.to_3x3().normalized()
# the head's top: 0.2 m up the Head bone's own axis
hb = arm.data.bones["Head"]
rest["head_end"] = P((mw @ hb.matrix_local) @ hb.tail_local.__class__((0, hb.length, 0)))
data = {"fps": 30, "rest": rest, "clips": {}}
arm.animation_data_create()
for act in bpy.data.actions:
    name = act.name.split("|")[-1]
    if want and name not in want:
        continue
    arm.animation_data.action = act
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    frames = []
    for f in range(f0, f1 + 1):
        bpy.context.scene.frame_set(f)
        bpy.context.view_layer.update()
        row = {}
        for n in KEEP:
            pb = arm.pose.bones[n]
            m = mw @ pb.matrix
            D = m.to_3x3().normalized() @ restR[n].transposed()
            Do = C @ D @ C.transposed()
            row[n] = [P(m.to_translation()), [round(Do[i][j], 6) for i in range(3) for j in range(3)]]
        frames.append(row)
    data["clips"][name] = frames
    print("clip", name, len(frames))
json.dump(data, open(out, "w"))
print("wrote", out)
