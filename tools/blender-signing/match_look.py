"""Proposal (v0.24, Harry P2-74: "I think the 2D kind of sucks … we just make
that like blenderized"): the Blender footballer rendered from the 2D match's
own high camera, as small sprites, in two kits.

usage: python match_look.py -- <out_dir> [samples] [w]
Writes <out_dir>/<kit>-<pose>.png (transparent, the floor shadow in alpha).
"""
import sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(REPO, 'tools', 'blender-footballer', 'scripts'))
import bpy
from mathutils import Vector
import fb, poses

A = sys.argv[sys.argv.index('--') + 1:]
OUT = A[0]
SAMPLES = int(A[1]) if len(A) > 1 else 24
W = int(A[2]) if len(A) > 2 else 256

KITS = {
    # the two sides in the 2D still (blue home, cream away with red shorts)
    'home': dict(shirt='#123a9c', sleeve='#123a9c', shorts='#f4f5f7', socks='#123a9c', trim='#f4f5f7', band='#f4f5f7'),
    'away': dict(shirt='#efe1c4', sleeve='#efe1c4', shorts='#c8202c', socks='#efe1c4', trim='#c8202c', band='#c8202c'),
}
# A light run pose for the proposal: the idle with the ball taken away.
RUN = dict(poses.IDLE); RUN['ball'] = None; RUN['ik'] = []
HIPS = dict(poses.HIPS); HIPS['ball'] = None


def main():
    os.makedirs(OUT, exist_ok=True)
    arm, body, kit, ball = fb.build_scene(res=(W, W * 3 // 2), samples=SAMPLES, style='crop', colour='brown')
    scn = bpy.context.scene
    scn.render.threads_mode = 'FIXED'; scn.render.threads = int(os.environ.get('THREADS', '3'))
    # the 2D match looks down at about 55 degrees, from in front
    d = 6.0; el = math.radians(55)
    fb.camera((0, -d * math.cos(el), 0.9 + d * math.sin(el)), (0, 0, 0.9), 85)
    for name, cols in KITS.items():
        fb.preview_colours(cols)
        for pname, spec in (('idle', RUN), ('hips', HIPS)):
            fb.set_pose(arm, spec, ball)
            scn.render.filepath = os.path.join(OUT, f'{name}-{pname}.png')
            bpy.ops.render.render(write_still=True)
            print('RENDERED', name, pname, flush=True)


if __name__ == '__main__':
    main()
