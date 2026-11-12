# "Which ball breaks all 20 layers?" - one Blender file per round.
#   blender -b --factory-startup --python layers.py -- build <round>
#   blender -b --factory-startup --python layers.py -- check <round>
#   blender -b out/layers_rNN.blend --python layers.py -- still <round> <frames...>
#   blender -b out/layers_rNN.blend --python layers.py -- render <round> <from> <to>
# Every layer break is ONE event: the ball reaching that disc, the disc turning into
# shards, and the counter going up all read the same time.
import bpy, bmesh, math, sys, json, os, random, time
from mathutils import Vector, Matrix
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,'out')+os.sep; os.makedirs(OUT,exist_ok=True)
A=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
MODE=A[0] if A else 'build'; RI=int(A[1]) if len(A)>1 else 0
PLAN=json.load(open(os.path.join(HERE,'plan_layers.json')));FPS=30

# ---------- tower geometry ----------
N=20; RAD=0.5; TH=0.04; PITCH=0.1; BASE_H=0.16; PLATE_H=0.03
def disc_z(k):   # k=1 top .. 20 bottom: z of the disc's middle
  return BASE_H+PLATE_H+(N-k)*PITCH+TH/2
TOP=disc_z(1)+TH/2; BR=0.085
GRAD=[(0.03,0.32,0.80),(0.02,0.10,0.80),(0.10,0.04,0.72),(0.35,0.03,0.62),(0.75,0.03,0.30),(0.88,0.05,0.06),(0.92,0.28,0.02)]
def disc_col(k):
  u=(k-1)/(N-1)*(len(GRAD)-1);i=min(int(u),len(GRAD)-2);e=u-i
  return tuple(GRAD[i][c]+(GRAD[i+1][c]-GRAD[i][c])*e for c in range(3))
BALLS={'Ping Pong':((0.92,0.92,0.9),0.35,0,0.0),'Foam':((0.95,0.88,0.6),0.9,0,0.1),'Tennis':((0.82,0.9,0.15),0.85,0,0.1),
 'Rubber':((0.85,0.2,0.15),0.5,0,0.2),'Wood':((0.55,0.33,0.15),0.6,0,0.25),'Plastic':((0.12,0.35,0.85),0.25,0,0.3),
 'Glass':((0.12,0.16,0.2),0.04,0.6,0.4),'Marble':((0.92,0.92,0.94),0.2,0,0.5),'Aluminum':((0.85,0.86,0.88),0.3,1,0.65),
 'Titanium':((0.62,0.62,0.66),0.3,1,0.7),'Iron':((0.38,0.38,0.4),0.45,1,0.8),'Steel':((0.78,0.79,0.82),0.15,1,0.85),
 'Copper':((0.95,0.55,0.35),0.25,1,0.9),'Silver':((0.95,0.95,0.95),0.12,1,0.95),'Lead':((0.42,0.43,0.47),0.55,1,1.0),
 'Gold':((1.0,0.72,0.25),0.18,1,1.15),'Tungsten':((0.22,0.22,0.24),0.3,1,1.4)}

def R(): r=PLAN['rounds'][RI];return r
def ball_key(r): return r['name'].replace(' Ball','')

# ---------- timeline of one round (all from the plan) ----------
def timeline(r):
  t0,imp,full,n=r['t0'],r['impact'],r['full'] or r['impact'],r['layers']
  if n==0: full=imp
  fall=0.85;H=2.4
  # time each layer breaks
  brk=[]
  if r['name'].startswith('Rubber'): brk=[imp,full]
  elif n>0:
    for k in range(1,n+1):
      e=(k-1)/max(1,n-1);brk.append(imp+(full-imp)*(e**1.35) if n>1 else imp)
  return dict(t0=t0,t1=r['t1'],imp=imp,fall=fall,H=H,brk=brk,n=n)
def ball_z(t,T):
  """bottom of the ball over time"""
  imp,fall,H,brk,n=T['imp'],T['fall'],T['H'],T['brk'],T['n']
  g=2*H/fall**2
  if t<imp: return TOP+0.5*g*(imp-t)**2, (imp-t)>fall
  if n==0:   # bouncing ping pong ball
    v=g*fall*0.55;tt=t-imp;z=TOP
    while v>0.15:
      d=2*v/g
      if tt<d: return TOP+v*tt-0.5*g*tt*tt,False
      tt-=d;v*=0.55
    return TOP,False
  top_at=lambda k:disc_z(k)+TH/2
  if len(brk)==2 and T.get('rubber'):
    pass
  # through the broken layers: bottom of ball goes from top of layer 1 to top of layer n+1
  stop=top_at(n+1) if n<N else BASE_H+PLATE_H+(0.0 if not R().get('gold') else -PLATE_H)
  zs=[top_at(k) for k in range(1,n+1)]+[stop];ts=brk+[brk[-1]+max(0.08,(brk[-1]-brk[0])/max(1,n-1)) if n>1 else brk[-1]+0.1]
  if t>=ts[-1]: return stop,False
  for i in range(len(ts)-1):
    if ts[i]<=t<ts[i+1]:
      e=(t-ts[i])/(ts[i+1]-ts[i]);return zs[i]+(zs[i+1]-zs[i])*e,False
  return zs[0],False

# ---------- materials ----------
def mat(name):
  m=bpy.data.materials.new(name);m.use_nodes=True;return m,m.node_tree.nodes,m.node_tree.links
def glass(col,name):
  m,n,l=mat(name);b=n['Principled BSDF'];b.inputs['Base Color'].default_value=(*col,1);b.inputs['Roughness'].default_value=0.04
  b.inputs['Alpha'].default_value=0.66;b.inputs['Specular IOR Level'].default_value=0.6
  b.inputs['Emission Color'].default_value=(*col,1);b.inputs['Emission Strength'].default_value=0.12
  m.blend_method='BLEND';m.shadow_method='HASHED';m.show_transparent_back=False;return m
def plain(name,col,rough,metal=0.0):
  m,n,l=mat(name);b=n['Principled BSDF'];b.inputs['Base Color'].default_value=(*col,1);b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal;return m
def marble():
  m,n,l=mat('marble');b=n['Principled BSDF'];tc=n.new('ShaderNodeTexCoord');w=n.new('ShaderNodeTexWave');w.inputs['Scale'].default_value=0.6;w.inputs['Distortion'].default_value=14;w.inputs['Detail'].default_value=8;w.inputs['Detail Scale'].default_value=2.5
  l.new(tc.outputs['Object'],w.inputs['Vector']);r=n.new('ShaderNodeValToRGB');r.color_ramp.elements[0].position=0.0;r.color_ramp.elements[0].color=(0.55,0.56,0.58,1);r.color_ramp.elements[1].position=0.05;r.color_ramp.elements[1].color=(0.93,0.94,0.95,1)
  l.new(w.outputs['Fac'],r.inputs['Fac']);l.new(r.outputs['Color'],b.inputs['Base Color']);b.inputs['Roughness'].default_value=0.05;b.inputs['Coat Weight'].default_value=0.6;return m
def wood():
  m,n,l=mat('wood');b=n['Principled BSDF'];tc=n.new('ShaderNodeTexCoord');w=n.new('ShaderNodeTexWave');w.wave_type='RINGS';w.inputs['Scale'].default_value=6;w.inputs['Distortion'].default_value=3
  l.new(tc.outputs['Object'],w.inputs['Vector']);r=n.new('ShaderNodeValToRGB');r.color_ramp.elements[0].color=(0.42,0.22,0.09,1);r.color_ramp.elements[1].color=(0.66,0.40,0.18,1)
  l.new(w.outputs['Fac'],r.inputs['Fac']);l.new(r.outputs['Color'],b.inputs['Base Color']);b.inputs['Roughness'].default_value=0.45;return m

# ---------- shards: voronoi cells of a disc, denser near the middle ----------
def shard_disc(k,seed,nseed):
  rnd=random.Random(seed);pts=[]
  for i in range(nseed):
    rr=RAD*math.sqrt(rnd.random())**1.4;a=rnd.random()*6.283;pts.append(Vector((rr*math.cos(a),rr*math.sin(a),0)))
  out=[]
  for i,p in enumerate(pts):
    bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=True,segments=40,radius1=RAD,radius2=RAD,depth=TH)
    ok=True
    for j,q in enumerate(pts):
      if i==j: continue
      nrm=(q-p).normalized();co=(p+q)/2
      geom=bm.verts[:]+bm.edges[:]+bm.faces[:]
      res=bmesh.ops.bisect_plane(bm,geom=geom,plane_co=co,plane_no=nrm,clear_outer=True)
      if len(bm.verts)<4: ok=False;break
    if ok:
      bmesh.ops.contextual_create(bm,geom=[e for e in bm.edges if not e.is_manifold])
      bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
      out.append(bm)
    else: bm.free()
  return out

def build():
  r=R();T=timeline(r);t0,t1=T['t0'],T['t1'];F0,F1=int(round(t0*FPS)),int(round(t1*FPS))
  bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.fps=FPS;s.frame_start=F0;s.frame_end=F1-1
  # set
  bpy.ops.mesh.primitive_cube_add(size=1);c=bpy.context.object;c.name='counter';c.scale=(12.0,5.0,1.6);c.location=(2.6,0.25,-0.8);c.rotation_euler=(0,0,0.30)
  bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);c.data.materials.append(marble())
  bv=c.modifiers.new('b','BEVEL');bv.width=0.015;bv.segments=3
  bpy.ops.mesh.primitive_plane_add(size=30,location=(0,3.2,4),rotation=(math.pi/2,0,0));wall=bpy.context.object;wall.data.materials.append(plain('wall',(0.10,0.15,0.20),0.85))
  bpy.ops.mesh.primitive_plane_add(size=60,location=(0,0,-1.0));bpy.context.object.data.materials.append(plain('floor',(0.05,0.06,0.07),0.9))
  bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=RAD*1.22,depth=BASE_H,location=(0,0,BASE_H/2));base=bpy.context.object;base.name='base';base.data.materials.append(wood())
  bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=RAD*1.04,depth=PLATE_H,location=(0,0,BASE_H+PLATE_H/2));plate=bpy.context.object;plate.name='plate';plate.data.materials.append(plain('brass',(0.95,0.68,0.32),0.25,1.0))
  # lights: soft spot on the wall from above, key from upper left, fill
  bpy.ops.object.light_add(type='SPOT',location=(0,1.6,6.5));sp=bpy.context.object;sp.data.energy=4200;sp.data.spot_size=math.radians(55);sp.data.spot_blend=1.0;sp.data.shadow_soft_size=1.5
  sp.rotation_euler=(Vector((0,2.8,1.8))-sp.location).to_track_quat('-Z','Y').to_euler()
  bpy.ops.object.light_add(type='AREA',location=(-3,-2,5));k=bpy.context.object;k.data.energy=650;k.data.size=3;k.rotation_euler=(Vector((0,0,0.8))-k.location).to_track_quat('-Z','Y').to_euler()
  bpy.ops.object.light_add(type='AREA',location=(3.5,-1.5,3.0));f=bpy.context.object;f.data.energy=260;f.data.size=2;f.rotation_euler=(Vector((0,0,0.8))-f.location).to_track_quat('-Z','Y').to_euler()
  bpy.ops.object.light_add(type='AREA',location=(2.6,-2.0,4.2));wn=bpy.context.object;wn.data.shape='RECTANGLE';wn.data.size=1.4;wn.data.size_y=0.5;wn.data.energy=500
  wn.rotation_euler=(Vector((1.2,-1.0,0))-wn.location).to_track_quat('-Z','Y').to_euler()
  w=bpy.data.worlds.new('w');s.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs['Color'].default_value=(0.12,0.15,0.18,1);w.node_tree.nodes['Background'].inputs['Strength'].default_value=0.35
  bpy.ops.object.camera_add();cam=bpy.context.object;s.camera=cam;cam.location=(0.0,-12.2,5.0);cam.data.sensor_fit='VERTICAL';cam.data.angle_y=math.radians(26)
  cam.rotation_euler=(Vector((0,0,1.2))-cam.location).to_track_quat('-Z','Y').to_euler()
  # rigid world
  bpy.ops.rigidbody.world_add();rw=s.rigidbody_world;rw.substeps_per_frame=20;rw.solver_iterations=20;rw.point_cache.frame_start=F0;rw.point_cache.frame_end=F1
  for o in (c,base,plate):
    bpy.context.view_layer.objects.active=o;bpy.ops.rigidbody.object_add(type='PASSIVE');o.rigid_body.collision_shape='MESH' if o is c else 'CONVEX_HULL';o.rigid_body.friction=0.8
  # ball
  key=ball_key(r);col,rough,metal,power=BALLS[key]
  bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=32,radius=BR);ball=bpy.context.object;ball.name='ball';bpy.ops.object.shade_smooth()
  ball.data.materials.append(plain('ball',col,rough,metal))
  bpy.context.view_layer.objects.active=ball;bpy.ops.rigidbody.object_add(type='PASSIVE');ball.rigid_body.kinematic=True;ball.rigid_body.collision_shape='SPHERE'
  ball.rigid_body.collision_collections=[i==1 for i in range(20)]
  for f in range(F0,F1+1):
    z,hide=ball_z(f/FPS,T);ball.location=(0,0,z+BR);ball.keyframe_insert('location',frame=f)
  # discs + shards
  rnd=random.Random(RI*7+1);brk=T['brk'];n=T['n'];shards_all=[]
  for kk in range(1,N+1):
    cm=glass(disc_col(kk),f'g{kk}')
    sm=glass(tuple(c*0.8 for c in disc_col(kk)),f'gs{kk}');sm.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=0.9
    bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=RAD,depth=TH,location=(0,0,disc_z(kk)));d=bpy.context.object;d.name=f'disc_{kk:02d}';d.data.materials.append(cm)
    bpy.context.view_layer.objects.active=d;bpy.ops.rigidbody.object_add(type='PASSIVE');d.rigid_body.collision_shape='CONVEX_HULL';d.rigid_body.kinematic=True
    if kk>n: continue
    # the disc breaks on the first frame the ball's bottom reaches its top
    fb=next(f for f in range(F0,F1+1) if ball_z(f/FPS,T)[0]<=disc_z(kk)+TH/2+1e-4)-1
    # whole disc vanishes on the break frame
    for fr,(hz,hr) in ((F0,(disc_z(kk),False)),(fb,(disc_z(kk),False)),(fb+1,(-50,True))):
      d.location.z=hz;d.keyframe_insert('location',frame=fr);d.hide_render=hr;d.keyframe_insert('hide_render',frame=fr)
    for fc in d.animation_data.action.fcurves:
      for kp in fc.keyframe_points: kp.interpolation='CONSTANT'
    ns=24+int(14*power)+(6 if kk<=3 else 0)
    for si,bm in enumerate(shard_disc(kk,RI*1000+kk,ns)):
      me=bpy.data.meshes.new(f's{kk}_{si}');bm.to_mesh(me);bm.free();o=bpy.data.objects.new(me.name,me);s.collection.objects.link(o);me.materials.append(sm)
      cen=sum((v.co for v in me.vertices),Vector())/len(me.vertices);[setattr(v,'co',Vector(((v.co.x-cen.x)*0.93,(v.co.y-cen.y)*0.93,(v.co.z-cen.z)*0.45))) for v in me.vertices]
      o.location=Vector((cen.x,cen.y,disc_z(kk)))
      o.hide_render=True;o.keyframe_insert('hide_render',frame=F0);o.hide_render=False;o.keyframe_insert('hide_render',frame=fb+1)
      bpy.context.view_layer.objects.active=o;bpy.ops.rigidbody.object_add(type='ACTIVE');rb=o.rigid_body;rb.collision_shape='CONVEX_HULL';rb.mass=0.05;rb.friction=1.0;rb.restitution=0.05;rb.linear_damping=(0.45 if power<1 else 0.12);rb.angular_damping=0.9;rb.use_margin=True;rb.collision_margin=0.001
      rb.kinematic=True;rb.keyframe_insert('kinematic',frame=F0)
      # burst: radial + up, stronger for heavier balls and for the top layers
      rad_dir=Vector((cen.x,cen.y,0));rad_dir=rad_dir.normalized() if rad_dir.length>1e-4 else Vector((1,0,0))
      depth_fall=1.0-0.6*(kk-1)/max(1,N-1)
      vr=(0.03+0.22*power)*rnd.uniform(0.3,1.2)*depth_fall;vz=(0.1+1.5*power**3+(5.0*(power-0.95) if power>0.95 else 0))*rnd.uniform(0.3,1.2)*depth_fall
      o.keyframe_insert('location',frame=fb);o.rotation_mode='XYZ';o.keyframe_insert('rotation_euler',frame=fb)
      o.location=o.location+(rad_dir*vr+Vector((0,0,vz)))/FPS;o.rotation_euler=(rnd.uniform(-.35,.35),rnd.uniform(-.35,.35),rnd.uniform(-.5,.5))
      o.keyframe_insert('location',frame=fb+1);o.keyframe_insert('rotation_euler',frame=fb+1)
      rb.keyframe_insert('kinematic',frame=fb+1);rb.kinematic=False;rb.keyframe_insert('kinematic',frame=fb+2)
      o['layer']=kk;o['brk']=fb+1;shards_all.append(o)
  # an invisible ring keeps the rubble heaped on the tower, like the original
  rb_=RAD*(1.30 if T['n']<16 else 1.55);rt_=RAD*(1.02 if T['n']<16 else 1.0)
  # the heavy rounds throw glass high: the ring reaches above the cloud
  ring_h=TOP+(0.6 if T['n']<16 else 3.5)
  bpy.ops.mesh.primitive_cone_add(vertices=48,radius1=rb_,radius2=rt_,depth=ring_h,location=(0,0,ring_h/2),end_fill_type='NOTHING');ring=bpy.context.object;ring.name='ring'
  ring.hide_render=True;ring.display_type='WIRE'
  bpy.context.view_layer.objects.active=ring;bpy.ops.rigidbody.object_add(type='PASSIVE');ring.rigid_body.collision_shape='MESH';ring.rigid_body.friction=0.6
  # tungsten: the brass plate breaks too
  if r.get('gold'):
    tb=brk[-1]+0.08;fb=int(tb*FPS)
    for fr,(hz,hr) in ((F0,(BASE_H+PLATE_H/2,False)),(fb,(BASE_H+PLATE_H/2,False)),(fb+1,(-50,True))):
      plate.location.z=hz;plate.keyframe_insert('location',frame=fr);plate.hide_render=hr;plate.keyframe_insert('hide_render',frame=fr)
    plate.rigid_body.kinematic=True
  r['_gold_frame']=int((brk[-1]+0.08)*FPS) if r.get('gold') else None
  # render settings
  rs=s.render;rs.engine='BLENDER_EEVEE';rs.resolution_x=540;rs.resolution_y=960
  ee=s.eevee;ee.taa_render_samples=24;ee.use_gtao=True;ee.use_ssr=True;ee.use_soft_shadows=True;ee.shadow_cube_size='1024';ee.shadow_cascade_size='2048'
  ee.use_motion_blur=True;ee.motion_blur_shutter=0.5;ee.use_bloom=True;ee.bloom_intensity=0.03
  s.view_settings.view_transform='Filmic';s.view_settings.look='Medium High Contrast';s.view_settings.exposure=-0.4
  t=time.time();bpy.ops.ptcache.bake_all(bake=True)
  meta=dict(round=RI,name=r['name'],F0=F0,F1=F1,brk_frames=[next(f for f in range(F0,F1+1) if ball_z(f/FPS,T)[0]<=disc_z(k)+TH/2+1e-4) for k in range(1,n+1)],n=n,gold=bool(r.get('gold')),shards=len(shards_all))
  json.dump(meta,open(OUT+f'meta_r{RI:02d}.json','w'))
  bpy.ops.wm.save_as_mainfile(filepath=OUT+f'layers_r{RI:02d}.blend');print('built',r['name'],'layers',n,'shards',len(shards_all),'frames',F0,F1,'bake',round(time.time()-t,1),'s')

def check():
  bpy.ops.wm.open_mainfile(filepath=OUT+f'layers_r{RI:02d}.blend');s=bpy.context.scene;M=json.load(open(OUT+f'meta_r{RI:02d}.json'))
  ball=bpy.data.objects['ball'];fails=[];rows=[]
  for k,fb in enumerate(M['brk_frames'],start=1):
    d=bpy.data.objects[f'disc_{k:02d}']
    top=disc_z(k)+TH/2
    s.frame_set(fb-1);pre=(not d.hide_render) and ball.matrix_world.translation.z-BR>top+1e-4
    s.frame_set(fb);post=d.hide_render;bz=ball.matrix_world.translation.z-BR
    near=bz<=top+1e-4
    ok=pre and post and near;rows.append(f'layer {k}: breaks on frame {fb}: whole until then {pre}, gone {post}, ball reached it that frame {near}')
    if not ok: fails.append(rows[-1])
  # unbroken discs stay
  s.frame_set(M['F1']-1)
  for k in range(M['n']+1,N+1):
    if bpy.data.objects[f'disc_{k:02d}'].hide_render: fails.append(f'layer {k} should not break')
  # no shard shows before its own break; shards stay on the set (not flung off screen forever)
  sh=[o for o in s.objects if o.name.startswith('s') and 'layer' in o.keys()]
  early=0
  for o in sh[:400]:
    s.frame_set(o['brk']-2)
    if not o.hide_render: early+=1
  rows.append(f'shards showing before their break: {early}');
  if early: fails.append(rows[-1])
  s.frame_set(M['F1']-1);lost=sum(1 for o in sh if o.matrix_world.translation.z<-0.9);rows.append(f'shards fallen to the floor: {lost} of {len(sh)}')
  print('\n'.join(rows));print('CHECK','PASS' if not fails else 'FAIL',len(fails));[print(' FAIL',x) for x in fails]

if MODE=='build': build()
elif MODE=='check': check()
else:
  s=bpy.context.scene;os.makedirs(OUT+'fr',exist_ok=True)
  fr=[int(x) for x in A[2:]] if MODE=='still' else range(int(A[2]),int(A[3]))
  for f in fr:
    s.frame_set(f);s.render.filepath=OUT+(f'st_{f:05d}.png' if MODE=='still' else f'fr/f{f:05d}.png');bpy.ops.render.render(write_still=True)
    if MODE=='still': print('frame',f)
  print('DONE')
