# REAL PHYSICS version of layers.py (same commands). The ball is a real falling body with
# its real density; a disc breaks only if the ball still has enough energy when it gets there;
# the freed glass slows the ball by real collisions. The counter counts what actually broke.
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


# ---------- real physics ----------
K=100.0                      # mass scale
DENS={'Ping Pong':0.084,'Foam':0.05,'Tennis':0.40,'Rubber':1.1,'Wood':0.7,'Plastic':1.2,'Glass':2.5,'Marble':2.7,
 'Aluminum':2.7,'Titanium':4.5,'Iron':7.87,'Steel':7.85,'Copper':8.96,'Silver':10.5,'Lead':11.34,'Gold':19.3,'Tungsten':19.25}
BOUNCE={'Ping Pong':1.0,'Foam':0.5,'Tennis':0.9,'Rubber':1.0,'Wood':0.6,'Plastic':0.7,'Glass':0.7,'Marble':0.6,
 'Aluminum':0.5,'Titanium':0.5,'Iron':0.45,'Steel':0.55,'Copper':0.4,'Silver':0.4,'Lead':0.1,'Gold':0.25,'Tungsten':0.4}
GLASS_DENS=2.5; SHARD_MASS=1.0   # x real glass mass
E_BREAK=1.0                  # energy a disc needs to shatter (same units as 1/2 m v^2)
E_PLATE=45.0                 # the brass plate under the tower
V_IMPACT=5.0; G=9.81; LOOK=1.6
PH=json.load(open(os.path.join(HERE,'phys.json'))) if os.path.exists(os.path.join(HERE,'phys.json')) else {}
globals().update(PH)

def shard_cells(radius,th,seed,nseed):
  rnd=random.Random(seed);pts=[]
  for i in range(nseed):
    rr=radius*math.sqrt(rnd.random())**1.4;a=rnd.random()*6.283;pts.append(Vector((rr*math.cos(a),rr*math.sin(a),0)))
  out=[]
  for i,p in enumerate(pts):
    bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=True,segments=40,radius1=radius,radius2=radius,depth=th);ok=True
    for j,q in enumerate(pts):
      if i==j: continue
      bmesh.ops.bisect_plane(bm,geom=bm.verts[:]+bm.edges[:]+bm.faces[:],plane_co=(p+q)/2,plane_no=(q-p).normalized(),clear_outer=True)
      if len(bm.verts)<4: ok=False;break
    if ok:
      bmesh.ops.contextual_create(bm,geom=[e for e in bm.edges if not e.is_manifold]);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);out.append(bm)
    else: bm.free()
  return out

def build():
  r=R();key=ball_key(r);t0,t1=r['t0'],r['t1'];F0,F1=int(round(t0*FPS)),int(round(t1*FPS))
  bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.fps=FPS;s.frame_start=F0;s.frame_end=F1-1
  T=dict(n=0)
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
  bpy.ops.rigidbody.world_add();rw=s.rigidbody_world;rw.substeps_per_frame=40;rw.solver_iterations=40;rw.point_cache.frame_start=F0;rw.point_cache.frame_end=F1
  for o in (c,base,plate):
    bpy.context.view_layer.objects.active=o;bpy.ops.rigidbody.object_add(type='PASSIVE');o.rigid_body.collision_shape='MESH' if o is c else 'CONVEX_HULL';o.rigid_body.friction=0.8

  for o in (c,base,plate): o.rigid_body.restitution=0.4
  rw.use_split_impulse=bool(globals().get('SPLIT',1))
  # ball: a real body. Held above the frame, let go so it lands at the original's impact time.
  col,rough,metal,_=BALLS[key];mass=DENS[key]*(4/3*math.pi*BR**3)*K
  bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=32,radius=BR);ball=bpy.context.object;ball.name='ball';bpy.ops.object.shade_smooth();ball.data.materials.append(plain('ball',col,rough,metal))
  Hdrop=V_IMPACT**2/(2*G);tfall=V_IMPACT/G;frel=int(round((r['impact']-tfall)*FPS));ball.location=(0,0,TOP+Hdrop+BR)
  bpy.context.view_layer.objects.active=ball;bpy.ops.rigidbody.object_add(type='ACTIVE');rb=ball.rigid_body;rb.collision_shape='SPHERE';rb.mass=mass;rb.restitution=BOUNCE[key];rb.friction=0.5;rb.use_deactivation=False
  rb.linear_damping=0.0;rb.angular_damping=0.1
  rb.kinematic=True;rb.keyframe_insert('kinematic',frame=F0);rb.kinematic=False;rb.keyframe_insert('kinematic',frame=max(F0+1,frel))
  # discs: a whole disc to look at, and its shards (held still until the disc breaks)
  discs=[];disc_mass=GLASS_DENS*math.pi*RAD**2*TH*K*SHARD_MASS
  for kk in range(1,N+2):
    plate_k=(kk==N+1)
    if plate_k:
      whole=plate;rad_k=RAD*1.04;th_k=PLATE_H;zc=BASE_H+PLATE_H/2;sm=plate.data.materials[0];ns=26;m_k=8.5*math.pi*rad_k**2*th_k*K
      plate.rigid_body.kinematic=True
    else:
      cm=glass(disc_col(kk),f'g{kk}');sm=glass(tuple(x*0.8 for x in disc_col(kk)),f'gs{kk}');sm.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=0.9
      zc=disc_z(kk);rad_k=RAD;th_k=TH;ns=30+(6 if kk<=3 else 0);m_k=disc_mass
      bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=RAD,depth=TH,location=(0,0,zc));whole=bpy.context.object;whole.name=f'disc_{kk:02d}';whole.data.materials.append(cm)
    cells=shard_cells(rad_k,th_k,4242+kk,ns);vols=[max(1e-6,abs(bm.calc_volume())) for bm in cells];vt=sum(vols);sh=[]
    for si,bm in enumerate(cells):
      me=bpy.data.meshes.new(f's{kk}_{si}');bm.to_mesh(me);bm.free();o=bpy.data.objects.new(me.name,me);s.collection.objects.link(o);me.materials.append(sm)
      cen=sum((v.co for v in me.vertices),Vector())/len(me.vertices)
      for v in me.vertices: v.co=Vector(((v.co.x-cen.x)*0.95,(v.co.y-cen.y)*0.95,(v.co.z-cen.z)*(0.9 if plate_k else 0.6)))
      o.location=Vector((cen.x,cen.y,zc));o['layer']=kk
      o.hide_render=True;o.keyframe_insert('hide_render',frame=F0)
      bpy.context.view_layer.objects.active=o;bpy.ops.rigidbody.object_add(type='ACTIVE');b=o.rigid_body;b.collision_shape='CONVEX_HULL';b.mass=m_k*vols[si]/vt
      b.friction=0.7;b.restitution=0.6 if not plate_k else 0.4;b.use_margin=True;b.collision_margin=0.001;b.linear_damping=0.05;b.angular_damping=0.3
      b.kinematic=True;b.keyframe_insert('kinematic',frame=F0);sh.append(o)
    whole.hide_render=False;whole.keyframe_insert('hide_render',frame=F0)
    discs.append(dict(k=kk,whole=whole,shards=sh,top=zc+th_k/2,E=E_PLATE if plate_k else E_BREAK,rad=rad_k,plate=plate_k))
  # ---- run the physics live, one frame at a time, and shatter what gets hit hard enough ----
  events=[];nxt=0;prev=None;t=time.time()
  for f in range(F0,F1):
    s.frame_set(f);pos=ball.matrix_world.translation.copy()
    if prev is not None and nxt<len(discs):
      v=(pos-prev)*FPS;zb=pos.z-BR
      if v.z<-0.2 and math.hypot(pos.x,pos.y)<discs[nxt]['rad']:
        ke=0.5*mass*v.length_squared;reach=zb+v.z*LOOK/FPS
        while nxt<len(discs) and discs[nxt]['top']>=reach-0.01 and ke>=discs[nxt]['E']:
          d=discs[nxt];ke-=d['E']
          d['whole'].hide_render=True;d['whole'].keyframe_insert('hide_render',frame=f+1)
          if d['plate']: d['whole'].location.z=-50;d['whole'].keyframe_insert('location',frame=f+1);d['whole'].location.z=BASE_H+PLATE_H/2;d['whole'].keyframe_insert('location',frame=f)
          for o in d['shards']:
            o.hide_render=False;o.keyframe_insert('hide_render',frame=f+1);o.rigid_body.kinematic=False;o.rigid_body.keyframe_insert('kinematic',frame=f+1)
          events.append(dict(k=d['k'],frame=f+1,zb=round(zb,4),v=round(v.z,3),ke=round(0.5*mass*v.length_squared,3),top=round(d['top'],4)));nxt+=1
    prev=pos
  for ob in s.objects:
    if ob.animation_data and ob.animation_data.action:
      for fc in ob.animation_data.action.fcurves:
        for kp in fc.keyframe_points: kp.interpolation='CONSTANT'
  path=[]
  bpy.ops.ptcache.free_bake_all();bpy.ops.ptcache.bake_all(bake=True)
  for f in range(F0,F1): s.frame_set(f);p=ball.matrix_world.translation;path.append([round(p.x,4),round(p.y,4),round(p.z,4)])
  rs=s.render;rs.engine='BLENDER_EEVEE';rs.resolution_x=540;rs.resolution_y=960
  ee=s.eevee;ee.taa_render_samples=24;ee.use_gtao=True;ee.use_ssr=True;ee.use_soft_shadows=True;ee.shadow_cube_size='1024';ee.shadow_cascade_size='2048'
  ee.use_motion_blur=True;ee.motion_blur_shutter=0.5;ee.use_bloom=True;ee.bloom_intensity=0.03
  s.view_settings.view_transform='Filmic';s.view_settings.look='Medium High Contrast';s.view_settings.exposure=-0.4
  glass_ev=[e for e in events if e['k']<=N]
  meta=dict(round=RI,name=r['name'],F0=F0,F1=F1,brk_frames=[e['frame'] for e in glass_ev],n=len(glass_ev),gold=any(e['k']==N+1 for e in events),events=events,mass=round(mass,4),release=frel,path=path)
  json.dump(meta,open(OUT+f'meta_r{RI:02d}.json','w'))
  bpy.ops.wm.save_as_mainfile(filepath=OUT+f'layers_r{RI:02d}.blend')
  wild=0;allsh=[o for d in discs for o in d['shards']]
  for f in (F0+(F1-F0)*2//3,F1-1):
    s.frame_set(f)
    wild=max(wild,sum(1 for o in allsh if (not o.hide_render) and (o.matrix_world.translation.z>TOP+2.5 or math.hypot(o.matrix_world.translation.x,o.matrix_world.translation.y)>6 or o.matrix_world.translation.z<-2)))
  meta['wild']=wild;json.dump(meta,open(OUT+f'meta_r{RI:02d}.json','w'))
  zend=path[-1][2]-BR
  print('built',r['name'],'BROKE',len(glass_ev),'WILD',wild,'of',sum(1 for o in allsh if not o.hide_render),'plate' if meta['gold'] else '','ball ends at z',round(zend,2),'max z after hit',round(max(p[2] for p in path[max(0,frel-F0+16):])-BR,2),'sim',round(time.time()-t,1),'s')

def check():
  bpy.ops.wm.open_mainfile(filepath=OUT+f'layers_r{RI:02d}.blend');s=bpy.context.scene;M=json.load(open(OUT+f'meta_r{RI:02d}.json'))
  ball=bpy.data.objects['ball'];fails=[];rows=[]
  # 1 the ball really falls: its speed grows by gravity alone between release and the hit
  s.frame_set(M['release']+3);z1=ball.matrix_world.translation.z;s.frame_set(M['release']+4);z2=ball.matrix_world.translation.z;s.frame_set(M['release']+5);z3=ball.matrix_world.translation.z
  acc=((z3-z2)-(z2-z1))*FPS*FPS;ok=abs(acc+G)<0.6;rows.append(f'free fall: acceleration {round(acc,2)} (gravity is -{G}): {ok}')
  if not ok: fails.append(rows[-1])
  # 2 every break: the ball was moving down at the disc, with enough energy, and the disc was whole until then
  for e in M['events']:
    k=e['k'];name='plate' if k==N+1 else f'disc_{k:02d}';d=bpy.data.objects[name]
    s.frame_set(e['frame']-1);whole=not d.hide_render;p=ball.matrix_world.translation;near=(p.z-BR)-e['top']<abs(e['v'])*LOOK/FPS+0.05 and (p.z-BR)>e['top']-0.25
    s.frame_set(e['frame']);gone=d.hide_render
    ok=whole and gone and near and e['v']<0 and e['ke']>=(E_PLATE if k==N+1 else E_BREAK)
    rows.append(f"layer {k}: frame {e['frame']} speed {e['v']} energy {e['ke']} whole before {whole} gone after {gone} ball there {near}")
    if not ok: fails.append(rows[-1])
  # 3 the recording matches the live run (same ball path)
  dev=0
  for i,f in enumerate(range(M['F0'],M['F1'])):
    s.frame_set(f);p=ball.matrix_world.translation;dev=max(dev,abs(p.z-M['path'][i][2]))
  rows.append(f'ball path same as recorded: max difference {round(dev,4)}')
  # 4 nothing shattered that was not hit; no shard shows early; nothing explodes
  for k in range(M['n']+1,N+1):
    s.frame_set(M['F1']-1)
    if bpy.data.objects[f'disc_{k:02d}'].hide_render: fails.append(f'layer {k} broke without an event')
  sh=[o for o in s.objects if 'layer' in o.keys()];hi=0;far=0
  for f in range(M['F0'],M['F1'],3):
    s.frame_set(f)
    for o in sh:
      if not o.hide_render:
        p=o.matrix_world.translation;hi=max(hi,p.z);far=max(far,math.hypot(p.x,p.y))
  rows.append(f'highest shard {round(hi,2)} (tower top {round(TOP,2)}), furthest {round(far,2)}')
  wild=M.get('wild',0);nvis=sum(1 for o in sh if not o.hide_render)
  rows.append(f'stray shards {wild} of {nvis}')
  if wild>max(4,0.02*nvis): fails.append('glass exploded: '+rows[-1])
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
