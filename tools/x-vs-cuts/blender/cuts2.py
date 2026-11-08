# X vs cuts, version 2: every cut is ONE event (frame, kind, plane).
# The knife pose, the line on the skin and the slice drop all read the same event.
import bpy, bmesh, math, sys, time, json
from mathutils import Vector, Matrix, Quaternion
argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
MODE=argv[0] if argv else 'build'
OUT='/tmp/claude-0/-home-user-Tierlist/c1503037-5087-50d1-9ca4-718cbb45521d/scratchpad/blend/'
FPS=30
# ---- object: avocado, local axes X long (narrow end +X), Y depth (front = -Y), Z up
L,RM,EH=3.05,0.86,0.92
def rad(x):
  u=(x+L/2)/L
  if u<=0 or u>=1: return 0.0
  return RM*math.pow(math.sin(math.pi*math.pow(u,0.85)),0.5)*(1-0.36*u)/0.84
def cz(x): return 0.55*rad(x)*EH+0.45*RM*EH*0.92
def q_in(x,y,z):
  r=rad(x)
  if r<=0: return 9
  a=(z-cz(x))/(r*EH); b=y/r; return a*a+b*b
STONE=(-0.5,0.0,cz(-0.5),0.62,0.44,0.5)   # cx,cy,cz,rx,ry,rz
TOPZ=2*RM*EH
# ---- round 1, cut frames measured from the original
R1=dict(kx=4,ky=3,kz=3,down=[4,11,18,26],side=[62,72,82],dice=[124,139,154],end=165)
YAW=-0.36   # narrow end turned toward the camera

def planes(R):
  dx=L/(R['kx']+1); dz=TOPZ/(R['ky']+1); dy=2*RM/(R['kz']+1)
  X=[L/2-i*dx for i in range(1,R['kx']+1)]          # right to left
  Z=[i*dz for i in range(1,R['ky']+1)]              # bottom to top
  Y=[-RM+i*dy for i in range(1,R['kz']+1)]          # front to back
  return X,Z,Y,dx,dz,dy

bpy.ops.wm.read_factory_settings(use_empty=True); scn=bpy.context.scene; scn.render.fps=FPS

# ---------- materials ----------
def newmat(name):
  m=bpy.data.materials.new(name);m.use_nodes=True;return m,m.node_tree.nodes,m.node_tree.links
def M(n,l,op,a,b=None):
  k=n.new('ShaderNodeMath');k.operation=op
  for idx,v in enumerate((a,b)):
    if v is None: continue
    if isinstance(v,(int,float)): k.inputs[idx].default_value=v
    else: l.new(v,k.inputs[idx])
  return k.outputs[0]
def interior_color(n,l,pos):
  """colour of the avocado at a point (local coords): skin outside, rim, flesh, stone"""
  sep=n.new('ShaderNodeSeparateXYZ');l.new(pos,sep.inputs[0]);X,Y,Z=sep.outputs[0],sep.outputs[1],sep.outputs[2]
  u=M(n,l,'MULTIPLY',M(n,l,'ADD',X,L/2),1/L)
  fc=n.new('ShaderNodeFloatCurve');c=fc.mapping.curves[0]
  pts=[(i/32,rad(-L/2+i/32*L)/RM) for i in range(33)]
  while len(c.points)<len(pts): c.points.new(0,0)
  for p,(a,b) in zip(c.points,pts): p.location=(a,b); p.handle_type='AUTO'
  fc.mapping.clip_max_y=2;fc.mapping.update();l.new(u,fc.inputs['Value'])
  r=M(n,l,'MAXIMUM',M(n,l,'MULTIPLY',fc.outputs[0],RM),0.01)
  czv=M(n,l,'ADD',M(n,l,'MULTIPLY',r,0.55*EH),0.45*RM*EH*0.92)
  a=M(n,l,'DIVIDE',M(n,l,'SUBTRACT',Z,czv),M(n,l,'MULTIPLY',r,EH));b=M(n,l,'DIVIDE',Y,r)
  q=M(n,l,'ADD',M(n,l,'MULTIPLY',a,a),M(n,l,'MULTIPLY',b,b))
  depth=M(n,l,'MULTIPLY',M(n,l,'SUBTRACT',1.0,M(n,l,'SQRT',M(n,l,'MINIMUM',q,1.0))),r)
  ramp=n.new('ShaderNodeValToRGB');cr=ramp.color_ramp
  cr.elements[0].position=0.0;cr.elements[0].color=(0.035,0.10,0.02,1)
  cr.elements[1].position=0.17;cr.elements[1].color=(0.60,0.72,0.27,1)
  e=cr.elements.new(0.04);e.color=(0.09,0.30,0.04,1)
  e=cr.elements.new(0.09);e.color=(0.35,0.58,0.12,1)
  l.new(depth,ramp.inputs['Fac'])
  # stone
  cx,cy,czs,rx,ry,rz=STONE
  sa=M(n,l,'DIVIDE',M(n,l,'SUBTRACT',X,cx),rx);sb=M(n,l,'DIVIDE',M(n,l,'SUBTRACT',Y,cy),ry);sc=M(n,l,'DIVIDE',M(n,l,'SUBTRACT',Z,czs),rz)
  sq=M(n,l,'ADD',M(n,l,'ADD',M(n,l,'MULTIPLY',sa,sa),M(n,l,'MULTIPLY',sb,sb)),M(n,l,'MULTIPLY',sc,sc))
  inst=M(n,l,'LESS_THAN',sq,1.0); ring=M(n,l,'MULTIPLY',inst,M(n,l,'GREATER_THAN',sq,0.90))
  mix1=n.new('ShaderNodeMix');mix1.data_type='RGBA';l.new(inst,mix1.inputs[0]);l.new(ramp.outputs[0],mix1.inputs[6]);mix1.inputs[7].default_value=(0.74,0.66,0.46,1)
  mix2=n.new('ShaderNodeMix');mix2.data_type='RGBA';l.new(ring,mix2.inputs[0]);l.new(mix1.outputs[2],mix2.inputs[6]);mix2.inputs[7].default_value=(0.40,0.05,0.03,1)
  out=M(n,l,'GREATER_THAN',q,1.0)  # outside the avocado -> skin
  mix3=n.new('ShaderNodeMix');mix3.data_type='RGBA';l.new(out,mix3.inputs[0]);l.new(mix2.outputs[2],mix3.inputs[6]);mix3.inputs[7].default_value=(0.03,0.09,0.018,1)
  return mix3.outputs[2],out,X,Z
def line_mask(n,l,X,Z,R,obj_attr=True):
  """1 on a cut line that the knife has already made (counts read from the object)"""
  _,_,_,dx,dz,_=planes(R)
  def done(name):
    a=n.new('ShaderNodeAttribute');a.attribute_type='OBJECT';a.attribute_name=name;return a.outputs['Fac']
  # down cuts: i=round((L/2-x)/dx), valid 1..nxd
  fi=M(n,l,'DIVIDE',M(n,l,'SUBTRACT',L/2,X),dx);i=M(n,l,'ROUND',fi);d=M(n,l,'MULTIPLY',M(n,l,'ABSOLUTE',M(n,l,'SUBTRACT',fi,i)),dx)
  okx=M(n,l,'MULTIPLY',M(n,l,'GREATER_THAN',i,0.5),M(n,l,'LESS_THAN',i,M(n,l,'ADD',done('nxd'),0.5)))
  lx=M(n,l,'MULTIPLY',okx,M(n,l,'LESS_THAN',d,0.0045))
  fj=M(n,l,'DIVIDE',Z,dz);j=M(n,l,'ROUND',fj);e=M(n,l,'MULTIPLY',M(n,l,'ABSOLUTE',M(n,l,'SUBTRACT',fj,j)),dz)
  okz=M(n,l,'MULTIPLY',M(n,l,'GREATER_THAN',j,0.5),M(n,l,'LESS_THAN',j,M(n,l,'ADD',done('nyd'),0.5)))
  lz=M(n,l,'MULTIPLY',okz,M(n,l,'LESS_THAN',e,0.0045))
  return M(n,l,'MAXIMUM',lx,lz)
def skin_mat(R):
  m,n,l=newmat('skin');b=n['Principled BSDF'];tc=n.new('ShaderNodeTexCoord')
  vor=n.new('ShaderNodeTexVoronoi');vor.inputs['Scale'].default_value=60;l.new(tc.outputs['Object'],vor.inputs['Vector'])
  noi=n.new('ShaderNodeTexNoise');noi.inputs['Scale'].default_value=7;noi.inputs['Detail'].default_value=6;l.new(tc.outputs['Object'],noi.inputs['Vector'])
  bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=0.35;bump.inputs['Distance'].default_value=0.02;l.new(vor.outputs['Distance'],bump.inputs['Height']);l.new(bump.outputs['Normal'],b.inputs['Normal'])
  ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].color=(0.014,0.05,0.012,1);ramp.color_ramp.elements[1].color=(0.034,0.10,0.026,1);l.new(noi.outputs['Fac'],ramp.inputs['Fac'])
  sep=n.new('ShaderNodeSeparateXYZ');l.new(tc.outputs['Object'],sep.inputs[0])
  lm=line_mask(n,l,sep.outputs[0],sep.outputs[2],R)
  mx=n.new('ShaderNodeMix');mx.data_type='RGBA';l.new(lm,mx.inputs[0]);l.new(ramp.outputs[0],mx.inputs[6]);mx.inputs[7].default_value=(0.42,0.58,0.22,1)
  l.new(mx.outputs[2],b.inputs['Base Color'])
  b.inputs['Roughness'].default_value=0.4;b.inputs['Coat Weight'].default_value=0.3;b.inputs['Coat Roughness'].default_value=0.25
  return m
def face_mat(R):   # the flat cut face of the avocado
  m,n,l=newmat('face');b=n['Principled BSDF'];tc=n.new('ShaderNodeTexCoord')
  col,out,X,Z=interior_color(n,l,tc.outputs['Object'])
  lm=line_mask(n,l,X,Z,R)
  mx=n.new('ShaderNodeMix');mx.data_type='RGBA';l.new(M(n,l,'MULTIPLY',lm,0.35),mx.inputs[0]);l.new(col,mx.inputs[6]);mx.inputs[7].default_value=(0.2,0.3,0.08,1)
  l.new(mx.outputs[2],b.inputs['Base Color']);b.inputs['Roughness'].default_value=0.5;b.inputs['Subsurface Weight'].default_value=0.1;b.inputs['Subsurface Scale'].default_value=0.03
  return m
def cube_mat():
  m,n,l=newmat('cube');b=n['Principled BSDF'];at=n.new('ShaderNodeAttribute');at.attribute_name='orig'
  col,out,X,Z=interior_color(n,l,at.outputs['Vector'])
  l.new(col,b.inputs['Base Color'])
  rough=n.new('ShaderNodeMix');rough.data_type='FLOAT';l.new(out,rough.inputs[0]);rough.inputs[2].default_value=0.5;rough.inputs[3].default_value=0.4;l.new(rough.outputs[0],b.inputs['Roughness'])
  return m
def plain(name,col,rough=0.5,metal=0.0):
  m,n,l=newmat(name);b=n['Principled BSDF'];b.inputs['Base Color'].default_value=(*col,1);b.inputs['Roughness'].default_value=rough;b.inputs['Metallic'].default_value=metal;return m
def wood_mat():
  m,n,l=newmat('wood');b=n['Principled BSDF'];tc=n.new('ShaderNodeTexCoord');mp=n.new('ShaderNodeMapping');mp.inputs['Scale'].default_value=(0.04,1.0,1)
  w=n.new('ShaderNodeTexWave');w.inputs['Scale'].default_value=6;w.inputs['Distortion'].default_value=5;w.inputs['Detail'].default_value=4;w.inputs['Detail Scale'].default_value=1.5;w.bands_direction='Y'
  l.new(tc.outputs['Object'],mp.inputs['Vector']);l.new(mp.outputs['Vector'],w.inputs['Vector'])
  r=n.new('ShaderNodeValToRGB');r.color_ramp.elements[0].color=(0.45,0.21,0.06,1);r.color_ramp.elements[1].color=(0.74,0.44,0.17,1);l.new(w.outputs['Fac'],r.inputs['Fac']);l.new(r.outputs['Color'],b.inputs['Base Color']);b.inputs['Roughness'].default_value=0.55;return m
def brick_mat():
  m,n,l=newmat('brick');b=n['Principled BSDF'];br=n.new('ShaderNodeTexBrick');br.inputs['Scale'].default_value=0.42;tcb=n.new('ShaderNodeTexCoord');l.new(tcb.outputs['Object'],br.inputs['Vector'])
  br.inputs['Color1'].default_value=(0.05,0.047,0.04,1);br.inputs['Color2'].default_value=(0.06,0.056,0.048,1);br.inputs['Mortar'].default_value=(0.035,0.032,0.028,1);br.inputs['Mortar Size'].default_value=0.025
  l.new(br.outputs['Color'],b.inputs['Base Color']);b.inputs['Roughness'].default_value=0.9;return m

# ---------- set ----------
def build_set():
  bpy.ops.mesh.primitive_cube_add(size=1);bd=bpy.context.object;bd.name='board';bd.scale=(11,3.3,0.17);bd.rotation_euler=(0,0,-0.42);bd.location=(-1.0,-0.6,-0.085)
  bd.data.materials.append(wood_mat());bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  bpy.ops.mesh.primitive_plane_add(size=40,location=(0,0,-0.17));bpy.context.object.data.materials.append(plain('counter',(0.035,0.032,0.028),0.85))
  bpy.ops.mesh.primitive_plane_add(size=40,location=(0,3.4,4),rotation=(math.pi/2,0,0));bpy.context.object.data.materials.append(brick_mat())
  bpy.ops.object.light_add(type='SUN');s=bpy.context.object;s.data.energy=4.2;s.data.angle=math.radians(4);s.data.color=(1,0.9,0.78)
  s.rotation_euler=(Vector((0,0,0))-Vector((-4,-1.5,7.5))).to_track_quat('-Z','Y').to_euler()
  w=bpy.data.worlds.new('w');scn.world=w;w.use_nodes=True;bg=w.node_tree.nodes['Background'];bg.inputs['Color'].default_value=(0.16,0.14,0.12,1);bg.inputs['Strength'].default_value=0.9
  bpy.ops.object.camera_add();cam=bpy.context.object;scn.camera=cam;cam.name='cam'
  cam.data.sensor_fit='VERTICAL';cam.data.angle_y=math.radians(28)
  set_cam((1.03, -13.63, 11.24),(-0.12, -0.3, 0.35))
def set_cam(pos,look):
  cam=bpy.data.objects['cam'];cam.location=pos;cam.rotation_euler=(Vector(look)-Vector(pos)).to_track_quat('-Z','Y').to_euler()

# ---------- avocado body ----------
def build_body(R):
  rig=bpy.data.objects.new('rig',None);bpy.context.collection.objects.link(rig);rig.rotation_euler=(0,0,YAW)
  bpy.ops.mesh.primitive_uv_sphere_add(segments=160,ring_count=110,radius=1);o=bpy.context.object;o.name='body'
  for v in o.data.vertices:
    sx,sy,sz=v.co;x=sz*L/2;a=math.atan2(sy,sx);r=rad(x);v.co=Vector((x,math.sin(a)*r,cz(x)+math.cos(a)*r*EH))
  o.data.materials.append(skin_mat(R));o.data.materials.append(face_mat(R));bpy.ops.object.shade_smooth();o.parent=rig
  o['nxd']=0;o['nyd']=0
  # clipper: removes everything in front of the current dice plane
  bpy.ops.mesh.primitive_cube_add(size=1);c=bpy.context.object;c.name='clipper';c.scale=(6,4,4);c.location=(0,-12,1);c.parent=rig
  c.data.materials.append(bpy.data.materials['face']);c.hide_render=True;c.display_type='WIRE'
  md=o.modifiers.new('clip','BOOLEAN');md.operation='DIFFERENCE';md.object=c;md.solver='EXACT';md.material_mode='TRANSFER'
  return rig,o,c

# ---------- cubes ----------
def build_cubes(R,rig):
  X,Z,Y,dx,dz,dy=planes(R)
  xe=[L/2]+X+[-L/2]; ze=[0]+Z+[TOPZ]; ye=[-RM]+Y+[RM]
  cm=cube_mat();cubes=[]
  for i in range(len(xe)-1):
    for j in range(len(ze)-1):
      for k in range(len(ye)-1):
        x0,x1=xe[i+1],xe[i];z0,z1=ze[j],ze[j+1];y0,y1=ye[k],ye[k+1]
        c=Vector(((x0+x1)/2,(y0+y1)/2,(z0+z1)/2))
        if q_in(*c)>=1.0 and not any(q_in(x,y,z)<0.98 for x in (x0,x1) for y in (y0,y1) for z in (z0,z1)): continue
        if q_in(*c)>=1.0: continue
        me=bpy.data.meshes.new('c');bm=bmesh.new();bmesh.ops.create_cube(bm,size=1.0);bm.to_mesh(me);bm.free()
        ob=bpy.data.objects.new(f'cube_{i}_{j}_{k}',me);bpy.context.collection.objects.link(ob);ob.parent=rig
        s=Vector(((x1-x0)*0.985,(y1-y0)*0.985,(z1-z0)*0.985))
        for v in me.vertices: v.co=Vector((v.co.x*s.x,v.co.y*s.y,v.co.z*s.z))
        me.update();at=me.attributes.new('orig','FLOAT_VECTOR','POINT')
        for vi,v in enumerate(me.vertices): at.data[vi].vector=v.co+c
        bev=ob.modifiers.new('bv','BEVEL');bev.width=min(s)*0.06;bev.segments=2
        me.materials.append(cm);ob.location=c;ob['slab']=k;ob['ylo']=y0;ob['c0']=list(c);ob['zlo']=z0;ob['layer']=j
        cubes.append(ob)
  return cubes

# ---------- knife ----------
BL,BH=4.6,0.62;ANC=3.9   # contact point: ANC along the edge from the heel
def build_knife(rig):
  prof=[(0,0),(BL-0.25,0),(BL+0.05,0.12),(BL-0.9,BH),(0,BH)]
  me=bpy.data.meshes.new('blade');bm=bmesh.new()
  a=[bm.verts.new((x,0.012,z)) for x,z in prof];b=[bm.verts.new((x,-0.012,z)) for x,z in prof]
  bm.faces.new(a);bm.faces.new(list(reversed(b)))
  for i in range(len(prof)):
    j=(i+1)%len(prof);bm.faces.new((a[i],a[j],b[j],b[i]))
  for v in (a[0],a[1],b[0],b[1]): v.co.y*=0.08
  bm.to_mesh(me);bl=bpy.data.objects.new('blade',me);bpy.context.collection.objects.link(bl);me.materials.append(plain('steel',(0.80,0.81,0.82),0.28,0.6))
  bpy.ops.mesh.primitive_cube_add(size=1);h=bpy.context.object;h.scale=(1.1,0.09,0.22);h.location=(-0.55,0,0.30);h.data.materials.append(plain('handle',(0.16,0.07,0.03),0.45))
  k=bpy.data.objects.new('knife',None);bpy.context.collection.objects.link(k)
  for o in (bl,h): o.parent=k
  for x in (-0.25,-0.55,-0.85):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.026,depth=0.11,location=(x,0,0.30),rotation=(math.pi/2,0,0));r=bpy.context.object;r.data.materials.append(plain('rivet',(0.8,0.8,0.8),0.25,1.0));r.parent=k
  k.parent=rig;return k
def frame3(d,s):   # blade direction, spine direction -> rotation (knife local X=d, Z=s)
  d=Vector(d).normalized();s=Vector(s);s=(s-d*s.dot(d)).normalized();t=s.cross(d)
  return Matrix((d,t,s)).transposed().to_quaternion()
Q_DOWN=frame3((-0.42,-0.88,-0.22),(-0.1,-0.2,0.97))
Q_SIDE=frame3((1,0,0),(0,-1,0))
Q_DICE=frame3((1,0,0),(0,0,1))
def ss(e): e=max(0,min(1,e));return e*e*(3-2*e)

def knife_track(R):
  """per frame (quat, contact point) in avocado space, driven by the cut events"""
  X,Z,Y,dx,dz,dy=planes(R);D,S,C=R['down'],R['side'],R['dice'];F=R['end']+1
  hover=TOPZ+0.12
  keys=[]  # (frame, quat, point)
  # down cuts: rest on top of the line, drop in 2 frames to the board on the cut frame, lift and move
  keys.append((0,Q_DOWN,Vector((X[0],0,hover))))
  for i,f in enumerate(D):
    keys.append((f-2,Q_DOWN,Vector((X[i],0,hover))))
    keys.append((f,Q_DOWN,Vector((X[i],0,0.0))))
    nxt=X[i+1] if i+1<len(X) else X[i]
    keys.append((f+3,Q_DOWN,Vector(((X[i]+nxt)/2,0,hover+0.35))))
    if i+1<len(D): keys.append((max(f+5,D[i+1]-3),Q_DOWN,Vector((nxt,0,hover))))
  # swing flat, rest in front at the first sideways height
  front=-RM-0.35
  keys.append((D[-1]+8,Q_DOWN.slerp(Q_SIDE,0.5),Vector((0.2,-0.6,1.4))))
  keys.append((D[-1]+16,Q_SIDE,Vector((0.0,front,Z[0]))))
  for i,f in enumerate(S):
    keys.append((f-2,Q_SIDE,Vector((0.0,front,Z[i]))))
    keys.append((f,Q_SIDE,Vector((0.0,RM+0.25,Z[i]))))
    nz=Z[i+1] if i+1<len(Z) else 0.03
    keys.append((f+4,Q_SIDE,Vector((0.0,front-0.2,(Z[i]+nz)/2))))
    if i+1<len(S): keys.append((max(f+6,S[i+1]-3),Q_SIDE,Vector((0.0,front,nz))))
  # lie flat in front, then rise upright over the first dice line and hover
  keys.append((S[-1]+6,Q_SIDE,Vector((0.0,front-0.2,0.03))))
  keys.append((S[-1]+17,Q_SIDE,Vector((0.0,front-0.2,0.03))))
  keys.append((S[-1]+31,Q_DICE,Vector((0.0,Y[0],hover+0.5))))
  for i,f in enumerate(C):
    keys.append((f-2,Q_DICE,Vector((0.0,Y[i],hover+0.5))))
    keys.append((f,Q_DICE,Vector((0.0,Y[i],0.0))))
    ny=Y[i+1] if i+1<len(Y) else Y[i]
    keys.append((f+5,Q_DICE,Vector((0.0,(Y[i]+ny)/2,hover+0.7))))
    if i+1<len(C): keys.append((max(f+8,C[i+1]-3),Q_DICE,Vector((0.0,ny,hover+0.5))))
  keys.append((F,Q_DICE,Vector((0.0,Y[-1],hover+0.7))))
  keys.sort(key=lambda k:k[0])
  track=[]
  for f in range(F+1):
    a=max([k for k in keys if k[0]<=f],key=lambda k:k[0]);b=min([k for k in keys if k[0]>=f],key=lambda k:k[0])
    if a[0]==b[0]: q,p=a[1],a[2]
    else:
      e=(f-a[0])/(b[0]-a[0]);
      # the 2-frame drops are linear (fast, constant speed); everything else eases
      lin = (b[2]-a[2]).length>0.5 and (b[0]-a[0])<=2
      e2=e if lin else ss(e)
      q=a[1].slerp(b[1],e2);p=a[2].lerp(b[2],e2)
    track.append((q,p))
  return track
def place_knife(k,q,p):
  R3=q.to_matrix();heel=p-R3@Vector((ANC,0,0))
  k.matrix_parent_inverse=Matrix.Identity(4);k.location=heel;k.rotation_mode='QUATERNION';k.rotation_quaternion=q

def build(R):
  t0=time.time();build_set();rig,body,clipper=build_body(R);cubes=build_cubes(R,rig);knife=build_knife(rig)
  X,Z,Y,dx,dz,dy=planes(R);F=R['end']+1;scn.frame_start=0;scn.frame_end=F
  # cut counters on the body (constant steps)
  for name,ev in (('nxd',R['down']),('nyd',R['side'])):
    body[name]=0;body.keyframe_insert(f'["{name}"]',frame=0)
    for i,f in enumerate(ev): body[name]=i+1;body.keyframe_insert(f'["{name}"]',frame=f)
  # clipper steps back at each dice frame
  clipper.location=(0,-12,1);clipper.keyframe_insert('location',frame=0)
  for i,f in enumerate(R['dice']):
    yc=Y[i] if i+1<len(R['dice']) else RM+0.5
    clipper.location=(0,yc-2.0,1);clipper.keyframe_insert('location',frame=f)   # box is 4 deep: front face at yc
  for ob in (body,clipper):
    if ob.animation_data:
      for fc in ob.animation_data.action.fcurves:
        for kp in fc.keyframe_points: kp.interpolation='CONSTANT'
  # knife
  tr=knife_track(R)
  for f,(q,p) in enumerate(tr):
    place_knife(knife,q,p);knife.keyframe_insert('location',frame=f);knife.keyframe_insert('rotation_quaternion',frame=f)
  # rigid bodies
  bpy.ops.rigidbody.world_add();rw=scn.rigidbody_world;rw.substeps_per_frame=30;rw.solver_iterations=30;rw.point_cache.frame_start=0;rw.point_cache.frame_end=F
  bd=bpy.data.objects['board'];bpy.context.view_layer.objects.active=bd;bpy.ops.rigidbody.object_add(type='PASSIVE');bd.rigid_body.collision_shape='BOX';bd.rigid_body.friction=0.9;bd.rigid_body.use_margin=True;bd.rigid_body.collision_margin=0.0005
  import random;rnd=random.Random(7)
  for ob in cubes:
    k=ob['slab'];rel=R['dice'][min(k,len(R['dice'])-1)]
    ob['rel']=rel
    ob.hide_render=True;ob.keyframe_insert('hide_render',frame=0);ob.hide_render=False;ob.keyframe_insert('hide_render',frame=rel)
    for fc in ob.animation_data.action.fcurves:
      for kp in fc.keyframe_points: kp.interpolation='CONSTANT'
    bpy.context.view_layer.objects.active=ob;bpy.ops.rigidbody.object_add(type='ACTIVE');rb=ob.rigid_body
    rb.collision_shape='BOX';rb.friction=0.5;rb.restitution=0.1;rb.use_margin=True;rb.collision_margin=0.0005;rb.linear_damping=0.15;rb.angular_damping=0.3
    rb.kinematic=True;rb.keyframe_insert('kinematic',frame=0)
    # on the chop frame the slice tips forward from its front-bottom edge, then falls freely
    # physics must not run on a child object: work out the pose in avocado space, place it in the world
    RW=rig.matrix_world.copy();loc0=Vector(ob['c0'])
    ob.parent=None;ob.matrix_world=RW@Matrix.Translation(loc0);ob.rotation_mode='XYZ'
    ob.keyframe_insert('location',frame=rel);ob.keyframe_insert('rotation_euler',frame=rel)
    lay=ob['layer']
    if lay==0: Ml=Matrix.Translation(loc0+Vector((0,-0.05 if k==0 else 0.0,0)))
    else:
      th=0.12+0.08*lay;P=Vector((loc0.x,ob['ylo'],ob['zlo']+0.004));d=Matrix.Rotation(th,3,'X')@(loc0-P)
      Ml=Matrix.Translation(P+d+Vector((0,-0.02*lay,0)))@Matrix.Rotation(th,4,'X')
    ob.matrix_world=RW@Ml
    ob.keyframe_insert('location',frame=rel+2);ob.keyframe_insert('rotation_euler',frame=rel+2)
    rb.keyframe_insert('kinematic',frame=rel+2);rb.kinematic=False;rb.keyframe_insert('kinematic',frame=rel+3)
  r=scn.render;r.engine='BLENDER_EEVEE';r.resolution_x=540;r.resolution_y=960
  ee=scn.eevee;ee.taa_render_samples=32;ee.use_gtao=True;ee.gtao_distance=0.4;ee.use_soft_shadows=True;ee.shadow_cube_size='2048';ee.shadow_cascade_size='4096';ee.use_ssr=True
  ee.use_motion_blur=True;ee.motion_blur_shutter=0.6;ee.motion_blur_steps=1
  scn.view_settings.view_transform='Filmic';scn.view_settings.look='Medium High Contrast';scn.view_settings.exposure=0.25
  bpy.ops.ptcache.bake_all(bake=True)
  json.dump(dict(R=R,track=[[list(q),list(p)] for q,p in tr]),open(OUT+'events_r1.json','w'))
  bpy.ops.wm.save_as_mainfile(filepath=OUT+'cuts2_r1.blend');print('built',len(cubes),'cubes',round(time.time()-t0,1),'s')

# ---------- step 3: the sync check ----------
def check(R):
  bpy.ops.wm.open_mainfile(filepath=OUT+'cuts2_r1.blend');s=bpy.context.scene
  X,Z,Y,dx,dz,dy=planes(R);body=bpy.data.objects['body'];knife=bpy.data.objects['knife'];rig=bpy.data.objects['rig']
  cubes=[o for o in s.objects if o.name.startswith('cube_')]
  fails=[];rows=[]
  def contact(f):
    s.frame_set(f);mw=rig.matrix_world.inverted()@knife.matrix_world;return mw@Vector((ANC,0,0))
  def prop(name,f): s.frame_set(f);return body[name]
  for kind,ev,pl in (('down',R['down'],X),('side',R['side'],Z),('dice',R['dice'],Y)):
    for i,f in enumerate(ev):
      p=contact(f)
      if kind=='down': ok=abs(p.x-pl[i])<0.002 and p.z<0.01; lineok=prop('nxd',f-1)==i and prop('nxd',f)==i+1
      elif kind=='side': ok=abs(p.z-pl[i])<0.002 and p.y>RM; lineok=prop('nyd',f-1)==i and prop('nyd',f)==i+1
      else:
        ok=abs(p.y-pl[i])<0.002 and p.z<0.01
        s.frame_set(f-1);early=[c.name for c in cubes if not c.hide_render]
        s.frame_set(f);now=[c.name for c in cubes if not c.hide_render and c['slab']<=i]
        lineok=(not early) if i==0 else True
        lineok=lineok and len(now)>0
      rows.append(f'{kind} {i+1} frame {f}: blade at plane {"YES" if ok else "NO"} ({tuple(round(v,3) for v in p)}), line/drop on this frame {"YES" if lineok else "NO"}')
      if not(ok and lineok): fails.append(rows[-1])
  # no cube shows before its own chop
  for c in cubes:
    s.frame_set(c['rel']-1)
    if not c.hide_render: fails.append(f'{c.name} visible before its chop')
  # physics: no cube may rise above the top of the avocado
  hi=0
  for f in range(R['dice'][0],R['end']+1):
    s.frame_set(f);hi=max(hi,max(c.matrix_world.translation.z-c['c0'][2] for c in cubes))
  rows.append(f'most any cube rose above its start: {round(hi,3)} (limit 0.15)')
  if hi>0.15: fails.append(rows[-1])
  print('\n'.join(rows));print('CHECK', 'PASS' if not fails else 'FAIL', len(fails));[print(' FAIL',x) for x in fails]

if MODE=='build': build(R1)
elif MODE=='check': check(R1)
else:
  bpy.ops.wm.open_mainfile(filepath=OUT+'cuts2_r1.blend');s=bpy.context.scene
  if MODE=='still':
    for f in argv[1:]:
      s.frame_set(int(f));s.render.filepath=OUT+f'v2_{int(f):04d}.png';bpy.ops.render.render(write_still=True);print('frame',f)
  else:
    a,b=int(argv[1]),int(argv[2])
    for f in range(a,b):
      s.frame_set(f);s.render.filepath=OUT+f'fr2/f{f:05d}.png';bpy.ops.render.render(write_still=True)
    print('DONE',a,b)
