import bpy,json,math,sys
RI=int(sys.argv[sys.argv.index('--')+1]);M=json.load(open(f'out/meta_r{RI:02d}.json'))
s=bpy.context.scene;sh=[o for o in s.objects if 'layer' in o.keys()];ball=bpy.data.objects['ball']
ev={e['k']:e['frame'] for e in M['events']};prev={};first={}
for f in range(M['F0'],M['F1']):
  s.frame_set(f);bp=ball.matrix_world.translation.copy()
  for o in sh:
    if o.hide_render: continue
    p=o.matrix_world.translation.copy()
    if o.name in prev:
      v=(p-prev[o.name]).length*30
      if v>12 and o.name not in first: first[o.name]=(f,o['layer'],round(v,1),round((p-bp).length,2),round(p.z,2),round(bp.z-0.085,2))
    prev[o.name]=p
print('launched',len(first),'of',len([o for o in sh if not o.hide_render]))
import collections
print('by frames after its own break:',sorted(collections.Counter(f-ev[l] for f,l,*_ in first.values()).items()))
print('by layer:',sorted(collections.Counter(l for f,l,*_ in first.values()).items()))
print('broken layers',M['n'],'examples (frame,layer,speed,dist to ball,z,ball bottom):',list(first.values())[:8])
ms=sorted(o.rigid_body.mass for o in sh if o['layer']<=20);import statistics
print('mass: median',round(statistics.median(ms),4),'min',round(ms[0],5),'max',round(ms[-1],3))
print('launched masses',sorted(round(bpy.data.objects[n].rigid_body.mass,4) for n in first))
print('launched sizes',sorted(round(max(bpy.data.objects[n].dimensions),3) for n in first))
