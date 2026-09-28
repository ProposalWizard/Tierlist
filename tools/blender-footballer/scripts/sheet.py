"""quick preview contact sheet of poses (PREVIEW colours, low res)"""
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import fb, poses
args = sys.argv[sys.argv.index('--') + 1:]
names = args[0].split(',')
w = int(args[1]) if len(args) > 1 else 300
cam = args[2] if len(args) > 2 else '34'
arm, body, kit, ball = fb.build_scene(res=(w, w * 3 // 2), samples=int(os.environ.get('SAMPLES', 10)))
fb.preview_colours(dict(shirt='#034694', sleeve='#034694', trim='#f2f2f2', shorts='#034694', socks='#f2f2f2', band='#034694'))
CAMS = {'34': ((-1.9, -3.4, 1.05), (0, 0, 0.9), 50), 'front': ((0.0, -4.0, 1.0), (0, 0, 0.9), 50),
        'r34': ((1.9, -3.4, 1.05), (0, 0, 0.9), 50), 'side': ((-3.9, -0.3, 1.0), (0, 0, 0.9), 50)}
c = CAMS[cam]
fb.camera(*c)
for n in names:
    fb.set_pose(arm, getattr(poses, n), ball)
    bpy.context.scene.render.filepath = f'work/s_{n}_{cam}.png'
    t = time.time(); bpy.ops.render.render(write_still=True); print('RENDER_S', n, round(time.time() - t, 1))
