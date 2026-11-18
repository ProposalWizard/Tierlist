import bpy, bmesh, math, json, sys, time
from mathutils import Vector, Matrix, Quaternion
argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
MODE=argv[0] if argv else 'build'   # build | still <frame> | render <from> <to>
OUT='/tmp/claude-0/-home-user-Tierlist/c1503037-5087-50d1-9ca4-718cbb45521d/scratchpad/blend/'
FPS=30
# three(x,y,z) -> blender(x,-z,y)
def V(x,y,z): return Vector((x,-z,y))
L,RM,EH=3.05,0.86,0.92
def rad(x):
  u=(x+L/2)/L
  if u<=0 or u>=1: return 0.0
  return RM*math.pow(math.sin(math.pi*math.pow(u,0.85)),0.5)*(1-0.36*u)/0.84
def cy(x): return 0.55*rad(x)*EH+0.45*RM*EH*0.92
STONE=dict(x=-0.5,rx=0.62,ry=0.5,rz=0.5); STONE['y']=cy(STONE['x'])
R1=dict(a0=0.03,a1=0.95,b0=1.95,b1=2.85,c0=4.1,c1=5.25,kx=4,ky=3,kz=3,end=5.45)

scn=bpy.context.scene
def reset():
  bpy.ops.wm.read_factory_settings(use_empty=True)
reset(); scn=bpy.context.scene
scn.render.fps=FPS

# ---------- materials ----------
def mat(name):
  m=bpy.data.materials.new(name);m.use_nodes=True;return m,m.node_tree.nodes,m.node_tree.links
def skin_mat():
  m,n,l=mat('skin');b=n['Principled BSDF']
  tc=n.new('ShaderNodeAttribute');tc.attribute_name='orig';vor=n.new('ShaderNodeTexVoronoi');vor.inputs['Scale'].default_value=55
  noi=n.new('ShaderNodeTexNoise');noi.inputs['Scale'].default_value=9;noi.inputs['Detail'].default_value=6
  l.new(tc.outputs['Vector'],vor.inputs['Vector']);l.new(tc.outputs['Vector'],noi.inputs['Vector'])
  bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=0.45;bump.inputs['Distance'].default_value=0.02
  l.new(vor.outputs['Distance'],bump.inputs['Height']);l.new(bump.outputs['Normal'],b.inputs['Normal'])
  ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(0.018,0.075,0.012,1);ramp.color_ramp.elements[1].color=(0.05,0.16,0.035,1)
  l.new(noi.outputs['Fac'],ramp.inputs['Fac']);l.new(ramp.outputs['Color'],b.inputs['Base Color'])
  b.inputs['Roughness'].default_value=0.42;b.inputs['Coat Weight'].default_value=0.25;b.inputs['Coat Roughness'].default_value=0.3
  return m
def flesh_mat():
  m,n,l=mat('flesh');b=n['Principled BSDF']
  tc=n.new('ShaderNodeAttribute');tc.attribute_name='orig';sep=n.new('ShaderNodeSeparateXYZ');l.new(tc.outputs['Vector'],sep.inputs['Vector'])
  def M(op,a=None,b2=None,v1=None,v2=None):
    k=n.new('ShaderNodeMath');k.operation=op
    if a is not None: l.new(a,k.inputs[0])
    else: k.inputs[0].default_value=v1
    if b2 is not None: l.new(b2,k.inputs[1])
    elif v2 is not None: k.inputs[1].default_value=v2
    return k.outputs[0]
  # u=(x+L/2)/L ; r = curve(u)*RM
  u=M('MULTIPLY',M('ADD',sep.outputs['X'],v2=L/2),v2=1/L)
  fc=n.new('ShaderNodeFloatCurve');cm=fc.mapping;c=cm.curves[0]
  pts=[(i/24,rad(-L/2+i/24*L)/RM) for i in range(25)]
  while len(c.points)<len(pts): c.points.new(0,0)
  for p,(x,y) in zip(c.points,pts): p.location=(x,y)
  cm.clip_max_y=2;cm.update();l.new(u,fc.inputs['Value'])
  r=M('MAXIMUM',M('MULTIPLY',fc.outputs[0],v2=RM),v2=0.02)
  cyv=M('ADD',M('MULTIPLY',r,v2=0.55*EH),v2=0.45*RM*EH*0.92)
  a=M('DIVIDE',M('SUBTRACT',sep.outputs['Z'],cyv),M('MULTIPLY',r,v2=EH))
  bb=M('DIVIDE',sep.outputs['Y'],r)
  q=M('ADD',M('MULTIPLY',a,a),M('MULTIPLY',bb,bb))
  depth=M('MULTIPLY',M('SUBTRACT',None,M('SQRT',M('MINIMUM',q,v2=1)),v1=1),r)
  ramp=n.new('ShaderNodeValToRGB');cr=ramp.color_ramp
  cr.elements[0].position=0.0;cr.elements[0].color=(0.03,0.12,0.02,1)
  cr.elements[1].position=0.16;cr.elements[1].color=(0.55,0.68,0.20,1)
  e=cr.elements.new(0.05);e.color=(0.12,0.36,0.05,1)
  l.new(depth,ramp.inputs['Fac']);l.new(ramp.outputs['Color'],b.inputs['Base Color'])
  b.inputs['Roughness'].default_value=0.55;b.inputs['Subsurface Weight'].default_value=0.15
  b.inputs['Subsurface Radius'].default_value=(0.3,0.4,0.1);b.inputs['Subsurface Scale'].default_value=0.05
  return m
def plain(name,col,rough=0.5,metal=0.0):
  m,n,l=mat(name);b=n['Principled BSDF'];b.inputs['Base Color'].default_value=(*col,1);b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal;return m
def wood_mat():
  m,n,l=mat('wood');b=n['Principled BSDF'];tc=n.new('ShaderNodeTexCoord')
  w=n.new('ShaderNodeTexWave');w.inputs['Scale'].default_value=3;w.inputs['Distortion'].default_value=4;w.inputs['Detail'].default_value=6;w.inputs['Detail Scale'].default_value=2;w.bands_direction='X'
  mp=n.new('ShaderNodeMapping');mp.inputs['Scale'].default_value=(0.12,1.5,1);l.new(tc.outputs['Object'],mp.inputs['Vector']);l.new(mp.outputs['Vector'],w.inputs['Vector'])
  r=n.new('ShaderNodeValToRGB');r.color_ramp.elements[0].color=(0.66,0.36,0.13,1);r.color_ramp.elements[1].color=(0.80,0.50,0.22,1)
  l.new(w.outputs['Fac'],r.inputs['Fac']);l.new(r.outputs['Color'],b.inputs['Base Color']);b.inputs['Roughness'].default_value=0.6;return m
def brick_mat():
  m,n,l=mat('brick');b=n['Principled BSDF'];br=n.new('ShaderNodeTexBrick');br.inputs['Scale'].default_value=0.28
  br.inputs['Color1'].default_value=(0.07,0.065,0.055,1);br.inputs['Color2'].default_value=(0.085,0.08,0.068,1);br.inputs['Mortar'].default_value=(0.03,0.028,0.025,1);br.inputs['Mortar Size'].default_value=0.025
  l.new(br.outputs['Color'],b.inputs['Base Color']);b.inputs['Roughness'].default_value=0.9;return m
SKIN,FLESH,STONEM=skin_mat(),flesh_mat(),plain('stone',(0.30,0.14,0.06),0.45)
STEEL=plain('steel',(0.78,0.79,0.80),0.32,0.55);HANDLE=plain('handle',(0.16,0.07,0.03),0.45);RIVET=plain('rivet',(0.8,0.8,0.8),0.25,1.0)

# ---------- avocado ----------
def avocado():
  bpy.ops.mesh.primitive_uv_sphere_add(segments=128,ring_count=96,radius=1)
  o=bpy.context.object;o.name='avocado'
  for v in o.data.vertices:
    sx,sy,sz=v.co; x=sz*L/2; a=math.atan2(sy,sx); r=rad(x)
    v.co=V(x,cy(x)+math.cos(a)*r*EH,math.sin(a)*r)
  o.data.materials.append(SKIN);bpy.ops.object.shade_smooth();return o
def ellipsoid(name,c,rx,ry,rz,m):
  bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=32,radius=1)
  o=bpy.context.object;o.name=name;o.scale=(rx,rz,ry);o.location=c;bpy.ops.object.transform_apply(scale=True,location=True)
  o.data.materials.append(m);bpy.ops.object.shade_smooth();return o
def boolean(target,cutter,op):
  md=target.modifiers.new('b','BOOLEAN');md.operation=op;md.object=cutter;md.solver='EXACT';md.material_mode='TRANSFER'
  bpy.context.view_layer.objects.active=target;bpy.ops.object.modifier_apply(modifier=md.name)
def box(xa,xb,ya,yb,za,zb,m):
  bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object
  lo,hi=V(xa,ya,zb),V(xb,yb,za)  # z flips to -y
  o.scale=(hi.x-lo.x,hi.y-lo.y,hi.z-lo.z);o.location=((lo.x+hi.x)/2,(lo.y+hi.y)/2,(lo.z+hi.z)/2)
  bpy.ops.object.transform_apply(scale=True,location=True);o.data.materials.append(m);return o

def build_pieces(kx,ky,kz):
  avo=avocado();st=ellipsoid('stone',V(STONE['x'],STONE['y'],0),STONE['rx'],STONE['ry'],STONE['rz'],STONEM)
  st2=st.copy();st2.data=st.data.copy();bpy.context.collection.objects.link(st2)
  boolean(avo,st2,'DIFFERENCE');bpy.data.objects.remove(st2)
  x0,x1,y0,y1,z0,z1=-L/2,L/2,0,2*RM*EH,-RM,RM
  xs=[x0+i*(x1-x0)/(kx+1) for i in range(kx+2)];ys=[y0+j*(y1-y0)/(ky+1) for j in range(ky+2)];zs=[z0+k*(z1-z0)/(kz+1) for k in range(kz+2)]
  pieces=[];g=0.009
  for i in range(kx+1):
    for j in range(ky+1):
      for k in range(kz+1):
        parts=[]
        for src,m in ((avo,FLESH),(st,STONEM)):
          o=src.copy();o.data=src.data.copy();bpy.context.collection.objects.link(o)
          bx=box(xs[i]+g,xs[i+1]-g,ys[j]+g,ys[j+1]-g,zs[k]+g,zs[k+1]-g,m)
          boolean(o,bx,'INTERSECT');bpy.data.objects.remove(bx)
          if len(o.data.vertices)<4: bpy.data.objects.remove(o)
          else: parts.append(o)
        if not parts: continue
        bpy.ops.object.select_all(action='DESELECT')
        for p in parts: p.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        if len(parts)>1: bpy.ops.object.join()
        p=bpy.context.object;p.name=f'pc_{i}_{j}_{k}'
        at=p.data.attributes.new('orig','FLOAT_VECTOR','POINT')
        for vi,v in enumerate(p.data.vertices): at.data[vi].vector=v.co
        bpy.ops.object.origin_set(type='ORIGIN_CENTER_OF_VOLUME',center='MEDIAN')
        p['slab']=kz-k  # 0=front (three z high)
        p['front_y']=-zs[k+1]
        pieces.append(p)
  avo.hide_render=True;avo.hide_viewport=True;st.hide_render=True;st.hide_viewport=True
  return pieces,xs,ys,zs

# ---------- set ----------
def set_build():
  bpy.ops.mesh.primitive_cube_add(size=1);bd=bpy.context.object;bd.name='board';bd.scale=(11,4.2,0.17)
  bd.rotation_euler=(0,0,0.62);bd.location=V(-1.2,-0.085,0.35);bd.data.materials.append(wood_mat())
  bpy.ops.object.transform_apply(scale=True)
  bpy.ops.object.modifier_add(type='BEVEL');bd.modifiers[-1].width=0.02;bd.modifiers[-1].segments=3
  bpy.ops.mesh.primitive_plane_add(size=40,location=(0,0,-0.17));bpy.context.object.data.materials.append(plain('counter',(0.035,0.032,0.028),0.85))
  bpy.ops.mesh.primitive_plane_add(size=40,location=(0,2.1,4),rotation=(math.pi/2,0,0));bpy.context.object.data.materials.append(brick_mat())
  # light (three (-4,7.5,1.5) -> blender (-4,-1.5,7.5))
  bpy.ops.object.light_add(type='SUN');sun=bpy.context.object;sun.data.energy=4.2;sun.data.angle=math.radians(4);sun.data.color=(1,0.90,0.78)
  sun.rotation_euler=(Vector((0,0,0))-V(-4,7.5,1.5)).to_track_quat('-Z','Y').to_euler()
  w=bpy.data.worlds.new('w');scn.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs['Color'].default_value=(0.16,0.14,0.12,1);w.node_tree.nodes['Background'].inputs['Strength'].default_value=0.9
  # camera: three pos (0.5,6.6,14.2) look (-0.15,0.2,0) vfov 28
  bpy.ops.object.camera_add();cam=bpy.context.object;scn.camera=cam
  cam.location=V(0.5,6.6,14.2);cam.rotation_euler=(V(-0.15,0.2,0)-cam.location).to_track_quat('-Z','Y').to_euler()
  cam.data.sensor_fit='VERTICAL';cam.data.angle_y=math.radians(28)
  cam.data.dof.use_dof=True;cam.data.dof.focus_distance=(V(-0.15,0.6,0)-cam.location).length;cam.data.dof.aperture_fstop=2.8

# ---------- knife ----------
def knife_build():
  BL,BH=4.6,0.66
  prof=[(0,0),(BL-0.25,0),(BL+0.05,0.12),(BL-0.9,BH),(0,BH)]
  me=bpy.data.meshes.new('blade');bm=bmesh.new()
  top=[bm.verts.new((x,y,0.012)) for x,y in prof];bot=[bm.verts.new((x,y,-0.012)) for x,y in prof]
  bm.faces.new(top);bm.faces.new(list(reversed(bot)))
  for i in range(len(prof)):
    j=(i+1)%len(prof);bm.faces.new((top[i],top[j],bot[j],bot[i]))
  # thin edge: pull bottom edge verts together
  for v in (top[0],top[1],bot[0],bot[1]): v.co.z*=0.08
  bm.to_mesh(me);blade=bpy.data.objects.new('blade',me);bpy.context.collection.objects.link(blade);me.materials.append(STEEL)
  bv=blade.modifiers.new('bv','BEVEL');bv.width=0.006;bv.segments=2
  bpy.ops.mesh.primitive_cube_add(size=1);h=bpy.context.object;h.scale=(1.1,0.22,0.09);h.location=(-0.55,0.32,0);h.data.materials.append(HANDLE)
  hb=h.modifiers.new('bv','BEVEL');hb.width=0.03;hb.segments=3
  k=bpy.data.objects.new('knife',None);bpy.context.collection.objects.link(k)
  for o in (blade,h): o.parent=k
  for x in (-0.25,-0.55,-0.85):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.026,depth=0.1,location=(x,0.32,0),rotation=(math.pi/2,0,0));r=bpy.context.object;r.data.materials.append(RIVET);r.parent=k
  # knife local frame is three-style: x along blade, y spine, z thickness -> we set world matrix per frame
  return k
def basis(x,y):
  x=Vector(x).normalized();y=Vector(y).normalized();z=x.cross(y)
  return Matrix((x,y,z)).transposed().to_quaternion()
C=Matrix(((1,0,0),(0,0,-1),(0,1,0)))  # three->blender
QA=basis((-0.54,-0.59,0.57),(0.75,-0.1,0.6))
QB=basis((1,0,0),(0,0,1))       # flat, edge toward the back, slides in from the front
QC=basis((1,-0.04,0),(0.04,1,0))
def chop(u): return (u/0.5)**1.5 if u<0.5 else 1-(u-0.5)/0.5
def knife_pose(t,R,xs,ys,zs):
  a0,a1,b0,b1,c0,c1,kx,ky,kz=[R[k] for k in ('a0','a1','b0','b1','c0','c1','kx','ky','kz')]
  yT=2*RM*EH+1.25
  if t<a1:
    u=max(0,(t-a0)/(a1-a0));f=u*kx;ci=min(kx,int(f)+1);d=0.35 if t<a0 else chop(f-int(f))
    return QA,Vector((xs[ci],yT-(yT+0.02)*d,0)),3.4
  if t<b0:
    e=(t-a1)/(b0-a1);e=e*e*(3-2*e);return QA.slerp(QB,e),Vector((xs[kx]*(1-e)+(-0.5)*e,(yT*(1-e))+ys[1]*e,RM+0.9*e)),3.4*(1-e)+2.3*e
  if t<b1:
    u=(t-b0)/(b1-b0);f=u*ky;ci=min(ky,int(f)+1);cu=f-int(f);z=RM+0.9-(2*RM+1.3)*min(1,cu/0.7)
    return QB,Vector((-0.5,ys[ci],z)),2.3
  if t<c0:
    e=(t-b1)/(c0-b1);e=e*e*(3-2*e);return QB.slerp(QC,e),Vector((-0.2,ys[ky]*(1-e)+(yT+0.6)*e,(-RM-0.4)*(1-e)+(RM+0.1)*e)),2.3
  if t<c1:
    u=(t-c0)/(c1-c0);f=u*kz;ci=min(kz,int(f)+1);z=zs[kz+1-ci]
    return QC,Vector((-0.2,(yT+0.6)-(yT+0.62)*chop(f-int(f)),z)),2.3
  return QC,Vector((-0.2,yT+0.6,-RM-0.2)),2.3
def set_knife(k,q,edge,anc):
  Rm=C@q.to_matrix()
  loc=C@(edge-q@Vector((anc,0,0)))
  k.matrix_world=Matrix.Translation(loc)@Rm.to_4x4()

# ---------- build + animate ----------
def build():
  t0=time.time();set_build();R=R1
  pieces,xs,ys,zs=build_pieces(R['kx'],R['ky'],R['kz'])
  print('pieces',len(pieces),round(time.time()-t0,1),'s')
  k=knife_build()
  F=int(R['end']*FPS)+1;scn.frame_start=0;scn.frame_end=F
  for f in range(F+1):
    q,e,a=knife_pose(f/FPS,R,xs,ys,zs);set_knife(k,q,e,a);k.keyframe_insert('location',frame=f);k.keyframe_insert('rotation_euler',frame=f)
  # rigid bodies
  bpy.ops.rigidbody.world_add();rw=scn.rigidbody_world;rw.substeps_per_frame=20;rw.solver_iterations=30
  rw.point_cache.frame_start=0;rw.point_cache.frame_end=F
  bd=bpy.data.objects['board'];bpy.context.view_layer.objects.active=bd;bpy.ops.rigidbody.object_add(type='PASSIVE');bd.rigid_body.collision_shape='BOX';bd.rigid_body.friction=0.8
  dz=(2*RM)/(R['kz']+1)
  for p in pieces:
    bpy.context.view_layer.objects.active=p;bpy.ops.rigidbody.object_add(type='ACTIVE');rb=p.rigid_body
    rb.collision_shape='CONVEX_HULL';rb.friction=0.7;rb.restitution=0.0;rb.linear_damping=0.25;rb.angular_damping=0.5;rb.collision_margin=0.001;rb.mass=1
    s=min(R['kz'],p['slab']+1);tr=R['c0']+(s-0.95)/R['kz']*(R['c1']-R['c0'])
    fr=int(round(tr*FPS))
    rb.kinematic=True;rb.keyframe_insert('kinematic',frame=0)
    p.keyframe_insert('location',frame=fr-3);p.keyframe_insert('rotation_euler',frame=fr-3)
    # lean forward and drift as the knife passes, then let go
    th=0.3;P=Vector((p.location.x,p['front_y']-0.01,0.0));d=p.location-P
    d=Matrix.Rotation(th,3,'X')@d;p.location=P+d;p.rotation_euler.x+=th
    p.keyframe_insert('location',frame=fr);p.keyframe_insert('rotation_euler',frame=fr)
    rb.keyframe_insert('kinematic',frame=fr);rb.kinematic=False;rb.keyframe_insert('kinematic',frame=fr+1)
  # render settings
  r=scn.render;r.engine='BLENDER_EEVEE';r.resolution_x=540;r.resolution_y=960;r.fps=FPS
  ee=scn.eevee;ee.taa_render_samples=32;ee.use_gtao=True;ee.gtao_distance=0.4;ee.use_soft_shadows=True;ee.shadow_cube_size='2048';ee.shadow_cascade_size='4096'
  ee.use_ssr=True;ee.use_bloom=False
  scn.view_settings.view_transform='AgX';scn.view_settings.look='AgX - Base Contrast';scn.view_settings.exposure=0.35
  bpy.ops.ptcache.bake_all(bake=True)
  bpy.ops.wm.save_as_mainfile(filepath=OUT+'avo_r1.blend');print('built',round(time.time()-t0,1),'s')

if MODE=='build': build()
else:
  bpy.ops.wm.open_mainfile(filepath=OUT+'avo_r1.blend');scn=bpy.context.scene
  if MODE=='still':
    for f in argv[1:]:
      scn.frame_set(int(f));scn.render.filepath=OUT+f'still_{int(f):04d}.png';t=time.time();bpy.ops.render.render(write_still=True);print('frame',f,round(time.time()-t,1),'s')
  else:
    a,b=int(argv[1]),int(argv[2])
    for f in range(a,b):
      scn.frame_set(f);scn.render.filepath=OUT+f'fr/f{f:05d}.png';bpy.ops.render.render(write_still=True)
    print('DONE',a,b)
