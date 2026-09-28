"""Render the neutral-kit layer sets that the recolourer needs.

  python render_layers.py -- stills  <W> <samples>          # 5 poses, 1 frame each
  python render_layers.py -- anim <NAME> <W> <samples>      # IDLE_LOOP / CELEBRATE_JUMP / KNEESLIDE_ANIM

Output: layers/<SET>/{beauty,shade,kitA,kitB,crest,num}_####.png
"""
import sys, os, time, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
import fb, poses

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
args = sys.argv[sys.argv.index('--') + 1:]
mode = args[0]

# per-pose cameras: (location, look-at, lens). Same distance family so the
# figure is the same size in every still.
CAMS = {
    'IDLE': ((-1.75, -3.55, 1.02), (0.0, 0.0, 0.90), 50),
    'CELEBRATE': ((-1.2, -3.9, 1.0), (0.0, 0.0, 1.00), 50),
    'KNEESLIDE': ((-1.4, -3.8, 0.85), (0.0, -0.1, 0.70), 50),
    'POINT': ((0.9, -3.9, 1.05), (0.0, 0.0, 0.92), 50),
    'HIPS': ((-1.3, -3.8, 1.02), (0.0, 0.0, 0.92), 50),
}


def add_beauty_output(nt, out_dir):
    rl = [n for n in nt.nodes if n.type == 'R_LAYERS'][0]
    fo = nt.nodes.new('CompositorNodeOutputFile')
    fo.base_path = out_dir
    fo.format.file_format = 'PNG'
    fo.format.color_mode = 'RGBA'
    fo.format.color_depth = '8'
    fo.file_slots[0].path = 'beauty_'
    nt.links.new(rl.outputs['Image'], fo.inputs[0])


def prepare(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    nt = fb.setup_layers(out_dir, '')
    add_beauty_output(nt, out_dir)
    scn = bpy.context.scene
    scn.render.filepath = os.path.join(out_dir, '_main_')


def render_frame(frame):
    scn = bpy.context.scene
    scn.frame_set(frame)
    t = time.time()
    bpy.ops.render.render(write_still=False)
    return time.time() - t


if mode == 'stills':
    W, S = int(args[1]), int(args[2])
    names = args[3].split(',') if len(args) > 3 else poses.STILLS
    arm, body, kit, ball = fb.build_scene(res=(W, W * 3 // 2), samples=S, style=os.environ.get('HAIRSTYLE'),
                                          colour=os.environ.get('HAIRCOLOUR', 'brown'))
    times = {}
    for n in names:
        fb.set_pose(arm, getattr(poses, n), ball)
        fb.camera(*CAMS[n])
        prepare(os.path.join(ROOT, 'layers', os.environ.get('SETPREFIX', 'still_') + n.lower()))
        times[n] = round(render_frame(1), 1)
        print('RENDER_S', n, times[n], flush=True)
    json.dump(times, open(os.path.join(ROOT, 'layers', f'times_stills_{W}.json'), 'w'))

elif mode == 'anim':
    import anims
    name, W, S = args[1], int(args[2]), int(args[3])
    first = int(args[4]) if len(args) > 4 else None
    last = int(args[5]) if len(args) > 5 else None
    arm, body, kit, ball = fb.build_scene(res=(W, W * 3 // 2), samples=S)
    spec = getattr(anims, name)
    f0, f1 = anims.bake(arm, ball, spec)
    fb.camera(*spec['cam'])
    out = os.path.join(ROOT, 'layers', 'anim_' + name.lower())
    prepare(out)
    ts = []
    for f in range(first or f0, (last or f1) + 1):
        ts.append(render_frame(f))
        print('FRAME', f, round(ts[-1], 1), flush=True)
    json.dump({'frames': len(ts), 'avg_s': round(sum(ts) / len(ts), 2), 'total_s': round(sum(ts), 1)},
              open(os.path.join(out, 'times.json'), 'w'))
