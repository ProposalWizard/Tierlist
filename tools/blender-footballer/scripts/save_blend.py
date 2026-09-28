"""Save an editable .blend: rigged character + kit + ball + lights + camera,
with the three clips stored as actions (IDLE_LOOP active)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy, fb, anims
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
arm, body, kit, ball = fb.build_scene(res=(1024, 1536), samples=64)
acts = {}
for n in ('CELEBRATE_JUMP', 'KNEESLIDE_ANIM', 'IDLE_LOOP'):
    clip = getattr(anims, n)
    anims.bake(arm, ball, clip)
    act = arm.animation_data.action
    act.name = n
    act.use_fake_user = True
    fb.camera(*clip['cam'])
fb.setup_layers(os.path.join(ROOT, 'layers', 'from_blend'), '')
bpy.ops.file.make_paths_relative()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'footballer.blend'), compress=True)
print('SAVED')
