"""Pose library. FK rotations are about REST axes (degrees), applied in
order, carried by the parent bone:
   x: + bends spine/head forward; + bends a knee (shin back); thigh forward = -x;
      a hanging arm swings forward with -x.
   y: left arm down = +y, left arm up = -y (right arm: opposite sign).
   z: yaw; left forearm flexes forward with -z (right: +z).
A pose = dict(fk=..., ik=[(bone, target, pole, pole_angle)], ground=(bones, height),
              ball=(x, y, z) or None, loc=pelvis offset)
"""
from fb import fingers


def merge(*ds):
    out = {}
    for d in ds:
        for k, v in d.items():
            out[k] = out.get(k, []) + list(v)
    return out


RELAXED = merge(fingers('l', 34, thumb=24), fingers('r', 34, thumb=24))
FISTS = merge(fingers('l', 88, thumb=50), fingers('r', 88, thumb=50))
R = 0.11   # ball radius

# ---- idle: weight on left leg, right sole resting on the ball
BALL_IDLE = (-0.20, -0.36, R)
IDLE = dict(
    fk=merge({
        'pelvis': [('z', 5), ('y', -3)],
        'spine_01': [('y', 2)],
        'spine_02': [('z', -3), ('y', 1)],
        'spine_03': [('x', 3), ('z', -3)],
        'neck_01': [('x', -3)],
        'Head': [('z', -10), ('x', 3), ('y', 2)],
        'clavicle_l': [('y', 5)], 'clavicle_r': [('y', -5)],
        'upperarm_l': [('y', 74), ('x', -4)],
        'upperarm_r': [('y', -76), ('x', 6)],
        'lowerarm_l': [('z', -16)],
        'lowerarm_r': [('z', 12)],
        'hand_l': [('z', 8)], 'hand_r': [('z', -4)],
        'thigh_l': [('y', -4), ('x', -2)],
        'calf_l': [('x', 6)],
        'foot_l': [('x', -4), ('z', -10)],
        'foot_r': [('x', -8)],
    }, RELAXED),
    ik=[('calf_r', (BALL_IDLE[0] + 0.01, BALL_IDLE[1] + 0.085, 2 * R + 0.062), (-0.25, -1.2, 0.6), -90)],
    ground=(('foot_l',), 0.086),
    ball=BALL_IDLE,
)

# ---- arms-up celebration: arched back, V arms, fists, shouting at the sky
CELEBRATE = dict(
    fk=merge({
        'pelvis': [('x', -4)],
        'spine_01': [('x', -6)],
        'spine_02': [('x', -8)],
        'spine_03': [('x', -6)],
        'neck_01': [('x', -4)],
        'Head': [('x', -7)],
        'clavicle_l': [('y', -14)], 'clavicle_r': [('y', 14)],
        'upperarm_l': [('y', -48), ('x', -18)],
        'upperarm_r': [('y', 48), ('x', -18)],
        'lowerarm_l': [('z', -32)],
        'lowerarm_r': [('z', 32)],
        'hand_l': [('x', 20)], 'hand_r': [('x', 20)],
        'thigh_l': [('y', -6), ('x', -4)], 'thigh_r': [('y', 6), ('x', 2)],
        'calf_l': [('x', 8)], 'calf_r': [('x', 5)],
        'foot_l': [('z', -12)], 'foot_r': [('z', 12)],
    }, FISTS),
    ground=(('foot_l', 'foot_r'), 0.086),
    ball=(0.55, -0.1, R),
)

# ---- knee slide: on both knees, leaning back, arms spread, fists
KNEESLIDE = dict(
    fk=merge({
        'pelvis': [('x', -10)],
        'spine_01': [('x', -10)],
        'spine_02': [('x', -10)],
        'spine_03': [('x', -6)],
        'neck_01': [('x', -6)],
        'Head': [('x', -14)],
        'clavicle_l': [('y', -8)], 'clavicle_r': [('y', 8)],
        'upperarm_l': [('y', 6), ('x', -30)],
        'upperarm_r': [('y', -6), ('x', -30)],
        'lowerarm_l': [('z', -70)],
        'lowerarm_r': [('z', 70)],
        'thigh_l': [('x', -28), ('y', -10)], 'thigh_r': [('x', -28), ('y', 10)],
        'calf_l': [('x', 118)], 'calf_r': [('x', 118)],
        'foot_l': [('x', 55)], 'foot_r': [('x', 55)],
    }, FISTS),
    ground=(('calf_l', 'calf_r'), 0.085),
    ball=None,
)

# ---- pointing at the badge (right index finger to the crest on the left chest)
POINT = dict(
    fk=merge({
        'pelvis': [('z', 8)],
        'spine_02': [('z', -3)],
        'spine_03': [('x', -2), ('z', -4)],
        'Head': [('z', 4), ('x', -6)],
        'clavicle_l': [('y', 4)],
        'upperarm_l': [('y', 74), ('x', -4)],
        'lowerarm_l': [('z', -18)],
        'hand_l': [('z', 6)],
        'hand_r': [('y', -70)],
        'thigh_l': [('y', -5)], 'thigh_r': [('y', 5), ('x', -4)],
        'calf_r': [('x', 6)],
        'foot_l': [('z', -10)], 'foot_r': [('z', 10)],
    }, fingers('l', 36, thumb=24), fingers('r', 92, thumb=45, index=0)),
    ik=[('lowerarm_r', (-0.03, -0.31, 1.39), (-0.7, -0.3, 0.9), -90)],
    ground=(('foot_l', 'foot_r'), 0.086),
    ball=(-0.35, -0.2, R),
)

# ---- hands on hips
HIPS = dict(
    fk=merge({
        'pelvis': [('z', -4)],
        'spine_03': [('x', -2)],
        'Head': [('z', 5), ('x', -2)],
        'clavicle_l': [('y', 2)], 'clavicle_r': [('y', -2)],
        'hand_l': [('z', -35), ('x', -25)], 'hand_r': [('z', 35), ('x', -25)],
        'thigh_l': [('y', -6)], 'thigh_r': [('y', 6)],
        'foot_l': [('z', -12)], 'foot_r': [('z', 12)],
    }, fingers('l', 18, thumb=10), fingers('r', 18, thumb=10)),
    ik=[('lowerarm_l', (0.215, 0.015, 1.06), (1.3, 0.05, 1.3), -90),
        ('lowerarm_r', (-0.215, 0.015, 1.06), (-1.3, 0.05, 1.3), -90)],
    ground=(('foot_l', 'foot_r'), 0.086),
    ball=(0.4, -0.35, R),
)

STILLS = ['IDLE', 'CELEBRATE', 'KNEESLIDE', 'POINT', 'HIPS']
