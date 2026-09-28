"""hair.jpg: head-and-shoulders, 4 styles x brown, plus crop x 3 colours"""
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, fb, poses
args = sys.argv[sys.argv.index('--') + 1:]
combos = [c.split(':') for c in args[0].split(',')]
W = int(args[1]); S = int(args[2]); out = args[3]
for style, colour in combos:
    arm, body, kit, ball = fb.build_scene(res=(W, int(W * 1.15)), samples=S, style=style, colour=colour)
    ball.hide_render = True
    fb.set_pose(arm, poses.IDLE, ball)
    head = fb.bone_world(arm, 'Head')
    from mathutils import Vector
    fb.camera(head + Vector((-0.35, -1.05, 0.02)), head + Vector((0, 0, -0.03)), 62)
    bpy.context.scene.render.filepath = f'{out}/hair_{style}_{colour}.png'
    t = time.time(); bpy.ops.render.render(write_still=True); print('RENDER_S', style, colour, round(time.time() - t, 1), flush=True)
