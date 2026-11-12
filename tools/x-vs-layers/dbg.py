import bpy
s=bpy.context.scene;sh=[o for o in s.objects if 'layer' in o.keys()]
for f in range(615,684,6):
  s.frame_set(f);print('F',f,'max shard z',round(max(o.matrix_world.translation.z for o in sh),2))
