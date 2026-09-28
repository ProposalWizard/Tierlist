"""Keyframed clips on the rig. Each key: (frame, pose_spec, extra) where
extra may hold 'air' (metres added to the grounded height) and 'y' / 'x'
(root travel). bake() keys every bone + the rig object's location."""
import copy
import bpy
import fb, poses
from poses import merge, FISTS, RELAXED


def tweak(spec, **fk_add):
    """copy a pose spec and append rotations: tweak(P, spine_03=[('x',-2)])"""
    s = copy.deepcopy(spec)
    for b, rots in fk_add.items():
        s['fk'][b] = s['fk'].get(b, []) + rots
    return s


def replace(spec, **fk):
    s = copy.deepcopy(spec)
    for b, rots in fk.items():
        s['fk'][b] = rots
    return s


def bake(arm, ball, clip):
    scn = bpy.context.scene
    scn.render.fps = clip.get('fps', 24)
    fb.clear_ik(arm)
    arm.animation_data_clear()
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    # IK (static targets) set once for the whole clip
    for bone, tgt, pole, pa in clip.get('ik', []):
        fb.ik(arm, bone, tgt, pole, pole_angle=pa)
    for frame, spec, extra in clip['keys']:
        arm.location = (0, 0, 0)
        fb.apply_pose(arm, spec['fk'])
        bpy.context.view_layer.update()
        if spec.get('ground'):
            fb.ground(arm, *spec['ground'])
        arm.location.z += extra.get('air', 0.0)
        arm.location.x += extra.get('x', 0.0)
        arm.location.y += extra.get('y', 0.0)
        fb.key_pose(arm, frame)
        arm.keyframe_insert('location', frame=frame)
    for fc in arm.animation_data.action.fcurves if hasattr(arm.animation_data.action, 'fcurves') else []:
        for kp in fc.keyframe_points:
            kp.interpolation = clip.get('interp', 'BEZIER')
    if ball is not None:
        if clip.get('ball'):
            ball.hide_render = False
            ball.location = clip['ball']
        else:
            ball.hide_render = True
    scn.frame_start, scn.frame_end = clip['range']
    return clip['range']


# ------------------------------------------------------------------ idle breathing loop
_I = copy.deepcopy(poses.IDLE)
_I.pop('ik', None)
IDLE_B = tweak(_I, spine_03=[('x', -2.2)], spine_02=[('x', -0.8)], clavicle_l=[('y', -2.5)],
               clavicle_r=[('y', 2.5)], neck_01=[('x', 1.2)], Head=[('z', 3), ('x', 1.0)],
               upperarm_l=[('y', -2.5)], upperarm_r=[('y', 2.0)], lowerarm_l=[('z', -4)],
               lowerarm_r=[('z', 3)], pelvis=[('z', 1.5)])
IDLE_LOOP = dict(
    keys=[(1, _I, {}), (25, IDLE_B, {}), (49, _I, {})],
    ik=poses.IDLE['ik'],
    ball=poses.BALL_IDLE,
    range=(1, 48),
    cam=((-1.75, -3.55, 1.02), (0.0, 0.0, 0.90), 50),
)

# ------------------------------------------------------------------ celebration jump
STAND = dict(fk=merge({
    'upperarm_l': [('y', 72), ('x', -6)], 'upperarm_r': [('y', -72), ('x', -6)],
    'lowerarm_l': [('z', -30)], 'lowerarm_r': [('z', 30)],
    'thigh_l': [('y', -4)], 'thigh_r': [('y', 4)],
    'foot_l': [('z', -10)], 'foot_r': [('z', 10)],
    'Head': [('x', 4)],
}, merge(poses.fingers('l', 60, thumb=35), poses.fingers('r', 60, thumb=35))), ground=(('foot_l', 'foot_r'), 0.086))
CROUCH = dict(fk=merge({
    'pelvis': [('x', 14)], 'spine_01': [('x', 8)], 'spine_02': [('x', 8)], 'spine_03': [('x', 4)],
    'neck_01': [('x', -10)], 'Head': [('x', -12)],
    'upperarm_l': [('y', 70), ('x', 38)], 'upperarm_r': [('y', -70), ('x', 38)],
    'lowerarm_l': [('z', -25)], 'lowerarm_r': [('z', 25)],
    'thigh_l': [('x', -62), ('y', -6)], 'thigh_r': [('x', -62), ('y', 6)],
    'calf_l': [('x', 84)], 'calf_r': [('x', 84)],
    'foot_l': [('x', -22), ('z', -10)], 'foot_r': [('x', -22), ('z', 10)],
}, FISTS), ground=(('foot_l', 'foot_r'), 0.086))
TAKEOFF = dict(fk=merge({
    'pelvis': [('x', -2)], 'spine_02': [('x', -4)], 'spine_03': [('x', -4)], 'Head': [('x', -10)],
    'clavicle_l': [('y', -10)], 'clavicle_r': [('y', 10)],
    'upperarm_l': [('y', -20), ('x', -40)], 'upperarm_r': [('y', 20), ('x', -40)],
    'lowerarm_l': [('z', -30)], 'lowerarm_r': [('z', 30)],
    'thigh_l': [('x', 4)], 'thigh_r': [('x', 4)],
    'foot_l': [('x', 40)], 'foot_r': [('x', 40)],
}, FISTS), ground=(('ball_l', 'ball_r'), 0.02))
APEX = dict(fk=merge(copy.deepcopy(poses.CELEBRATE['fk']), {
    'thigh_l': [('x', 10)], 'thigh_r': [('x', 16)],
    'calf_l': [('x', 50)], 'calf_r': [('x', 70)],
    'foot_l': [('x', 30)], 'foot_r': [('x', 30)],
}), ground=(('ball_l', 'ball_r'), 0.02))
LAND = dict(fk=merge(copy.deepcopy(poses.CELEBRATE['fk']), {
    'pelvis': [('x', 10)], 'spine_02': [('x', 10)], 'Head': [('x', 12)],
    'thigh_l': [('x', -40)], 'thigh_r': [('x', -40)],
    'calf_l': [('x', 60)], 'calf_r': [('x', 60)],
    'foot_l': [('x', -20)], 'foot_r': [('x', -20)],
}), ground=(('foot_l', 'foot_r'), 0.086))
CELEB = copy.deepcopy(poses.CELEBRATE)
CELEB_B = tweak(CELEB, upperarm_l=[('y', -6)], upperarm_r=[('y', 6)], Head=[('x', -4)], spine_03=[('x', -2)])
CELEBRATE_JUMP = dict(
    keys=[(1, STAND, {}), (8, CROUCH, {}), (13, TAKEOFF, {}), (19, APEX, {'air': 0.34}),
          (25, APEX, {'air': 0.10}), (28, LAND, {}), (35, CELEB, {}), (42, CELEB_B, {}), (48, CELEB, {})],
    ball=None,
    range=(1, 48),
    cam=((-1.45, -4.3, 1.2), (0.0, 0.0, 1.12), 52),
)

# ------------------------------------------------------------------ knee slide
KS = copy.deepcopy(poses.KNEESLIDE)
KS_IN = replace(KS, **{
    'pelvis': [('x', 6)], 'spine_01': [('x', 4)], 'spine_02': [('x', 2)], 'spine_03': [],
    'neck_01': [], 'Head': [('x', -4)],
    'clavicle_l': [], 'clavicle_r': [],
    'upperarm_l': [('y', 45), ('x', -10)], 'upperarm_r': [('y', -45), ('x', -10)],
    'lowerarm_l': [('z', -20)], 'lowerarm_r': [('z', 20)],
})
KS_MID = replace(KS, **{
    'pelvis': [('x', -4)], 'spine_01': [('x', -5)], 'spine_02': [('x', -6)], 'spine_03': [('x', -3)],
    'Head': [('x', -8)],
    'upperarm_l': [('y', 20), ('x', -20)], 'upperarm_r': [('y', -20), ('x', -20)],
    'lowerarm_l': [('z', -50)], 'lowerarm_r': [('z', 50)],
})
KS_PUMP = tweak(KS, lowerarm_l=[('z', -18)], lowerarm_r=[('z', 18)], upperarm_l=[('x', -8)],
                upperarm_r=[('x', -8)], Head=[('x', -4)])
KNEESLIDE_ANIM = dict(
    keys=[(-10, KS_IN, {'y': 3.4}), (1, KS_IN, {'y': 2.2}), (14, KS_IN, {'y': 1.05}), (26, KS_MID, {'y': 0.32}),
          (38, KS, {'y': 0.04}), (46, KS, {'y': 0.0}), (52, KS_PUMP, {'y': 0.0}), (60, KS, {'y': 0.0})],
    ball=None,
    range=(1, 60),
    cam=((-2.1, -4.2, 1.05), (0.0, 0.8, 0.62), 46),
)
