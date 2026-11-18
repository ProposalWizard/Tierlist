# Rounds 2-6: same event idea as cuts2.py, any number of cuts.
import bpy, bmesh, math, sys, json, time, random
import numpy as np
from mathutils import Vector, Matrix, Quaternion
_args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
import os as _os
HERE=_os.path.dirname(_os.path.abspath(__file__))
src=open(_os.path.join(HERE,'cuts2.py')).read().replace("if '__file__' in globals() else _os.getcwd()","")
src=src.replace('HERE=_os.path.dirname(_os.path.abspath(__file__)) ','HERE=HERE ').split("def build(R):")[0].replace("MODE=argv[0] if argv else 'build'","MODE='lib'")
exec(src)
MODE=_args[0] if _args else 'build'; RI=int(_args[1]) if len(_args)>1 else 1
PLAN=json.load(open(_os.path.join(HERE,'plan_avocado.json')))
def round_def(i):
  r=PLAN['rounds'][i];nxt=PLAN['rounds'][i+1]['t0'] if i+1<len(PLAN['rounds']) else PLAN['end']
  ev=lambda s,e,n:[s+(k+1)/n*(e-s) for k in range(n)]
  return dict(i=i,n=r['n'],kx=r['kx'],ky=r['ky'],kz=r['kz'],t0=r['t0'],t1=nxt,
    D=ev(r['a0'],r['a1'],r['kx']),S=ev(r['b0'],r['b1'],r['ky']),C=ev(r['c0'],r['c1'],r['kz']),
    F0=166 if i==1 else int(round(r['t0']*30)),F1=int(round(nxt*30)))

# lines: thinner and fainter as they crowd together, like the original
def line_mask(n,l,X,Z,R,obj_attr=True):
  _,_,_,dx,dz,_=planes(R)
  def done(name):
    a=n.new('ShaderNodeAttribute');a.attribute_type='OBJECT';a.attribute_name=name;return a.outputs['Fac']
  def one(coord,origin_minus,spacing,name):
    fi=M(n,l,'DIVIDE',origin_minus,spacing);i=M(n,l,'ROUND',fi);d=M(n,l,'MULTIPLY',M(n,l,'ABSOLUTE',M(n,l,'SUBTRACT',fi,i)),spacing)
    ok=M(n,l,'MULTIPLY',M(n,l,'GREATER_THAN',i,0.5),M(n,l,'LESS_THAN',i,M(n,l,'ADD',done(name),0.5)))
    w=min(0.0045,0.22*spacing) if R['kx']<=34 else 0.35*spacing   # dense rounds: wide stripes, read as a light cut band
    return M(n,l,'MULTIPLY',ok,M(n,l,'LESS_THAN',d,w))
  lx=one(X,M(n,l,'SUBTRACT',L/2,X),dx,'nxd');lz=one(Z,Z,dz,'nyd')
  k=0.6 if R['kx']<=17 else (0.35 if R['kx']<=34 else 0.5)
  if R['kx']>34:   # dense rounds: down cuts lighten the skin, side cuts lighten it further, so each stage shows its own progress
    return M(n,l,'MULTIPLY',M(n,l,'ADD',M(n,l,'MULTIPLY',lx,0.55),M(n,l,'MULTIPLY',lz,0.45)),0.9)
  return M(n,l,'MULTIPLY',M(n,l,'MAXIMUM',lx,lz),k)

def ss(e): e=max(0.0,min(1.0,e));return e*e*(3-2*e)
def lerp(a,b,e): return a+(b-a)*e
def knife_pose(t,R):
  X,Z,Y,dx,dz,dy=planes(R);D,S,C=R['D'],R['S'],R['C'];hover=TOPZ+0.12;front=-RM-0.35
  dd=lambda p:min(2/30,0.45*p)
  def cycle(t,T,P,axis_pt,hov,q,first_rest):
    k=next(i for i,v in enumerate(T) if v>=t)
    tp=T[k-1] if k>0 else first_rest; d=dd(T[k]-tp) if k>0 else 2/30
    pk=axis_pt(k,0.0)
    if t>=T[k]-d:
      e=(t-(T[k]-d))/d;return q,axis_pt(k,hov*(1-e))
    if k==0: return q,axis_pt(0,hov)
    e=(t-tp)/max(1e-6,(T[k]-d)-tp)
    a=axis_pt(k-1,0.0);b=axis_pt(k,hov)
    lift=hov*ss(min(1,e*2.2));mv=ss(min(1,e*1.6))
    p=a.lerp(b,mv);return q,axis_pt_mix(p,lift,axis_pt,k)
  # down cuts
  if t<=D[-1]:
    k=next(i for i,v in enumerate(D) if v>=t)
    tp=D[k-1] if k>0 else None
    if k==0 or t>=D[k]-dd(D[k]-tp):
      d=2/30 if k==0 else dd(D[k]-tp)
      e=max(0.0,(t-(D[k]-d))/d);return Q_DOWN,Vector((X[k],0,hover*(1-e)))
    e=(t-tp)/max(1e-6,(D[k]-dd(D[k]-tp))-tp)
    return Q_DOWN,Vector((lerp(X[k-1],X[k],ss(min(1,e*1.6))),0,hover*ss(min(1,e*2.2))))
  Td=D[-1];Ts=S[0]
  if t<Ts-2/30:
    if t<Td+0.25:e=ss((t-Td)/0.25);return Q_DOWN,Vector((X[-1],0,(hover+0.35)*e))
    e=ss((t-Td-0.25)/0.35);return Q_DOWN.slerp(Q_SIDE,e),Vector((lerp(X[-1],0.0,e),lerp(0,front,e),lerp(hover+0.35,Z[0],e)))
  if t<=S[-1]:
    k=next(i for i,v in enumerate(S) if v>=t);tp=S[k-1] if k>0 else None
    d=2/30 if k==0 else dd(S[k]-tp)
    if t>=S[k]-d:
      e=max(0.0,(t-(S[k]-d))/d);return Q_SIDE,Vector((0.0,lerp(front,RM+0.25,e),Z[k]))
    if k==0: return Q_SIDE,Vector((0.0,front,Z[0]))
    e=ss((t-tp)/max(1e-6,(S[k]-d)-tp));return Q_SIDE,Vector((0.0,lerp(RM+0.25,front,min(1,e*1.4)),lerp(Z[k-1],Z[k],e)))
  Tl=S[-1];Tc=C[0]
  if t<Tc-2/30:
    if t<Tl+0.2:e=ss((t-Tl)/0.2);return Q_SIDE,Vector((0.0,lerp(RM+0.25,front-0.2,e),lerp(Z[-1],0.03,e)))
    a=Tl+0.2+0.35*(Tc-Tl-0.2);b=Tc-0.25
    if t<a: return Q_SIDE,Vector((0.0,front-0.2,0.03))
    e=ss((t-a)/max(1e-6,b-a));return Q_SIDE.slerp(Q_DICE,e),Vector((0.0,lerp(front-0.2,Y[0],e),lerp(0.03,hover+0.5,e)))
  if t<=C[-1]:
    k=next(i for i,v in enumerate(C) if v>=t);tp=C[k-1] if k>0 else None
    d=2/30 if k==0 else dd(C[k]-tp)
    if t>=C[k]-d:
      e=max(0.0,(t-(C[k]-d))/d);return Q_DICE,Vector((0.0,Y[k],(hover+0.5)*(1-e)))
    if k==0: return Q_DICE,Vector((0.0,Y[0],hover+0.5))
    e=(t-tp)/max(1e-6,(C[k]-d)-tp);return Q_DICE,Vector((0.0,lerp(Y[k-1],Y[k],ss(min(1,e*1.6))),(hover+0.5)*ss(min(1,e*2.2))))
  e=ss((t-C[-1])/0.25);return Q_DICE,Vector((0.0,Y[-1],(hover+0.7)*e))

PILE=LOOK.get('pile') or {1:(0.15,(0.75,0.95,0.35)),2:(0.25,(0.62,0.88,0.28)),3:(0.4,(0.55,0.85,0.22)),4:(0.75,(0.95,1.0,0.42)),5:(0.85,(1.0,1.0,0.5))}
GLOW=LOOK.get('glow') or {1:0.4,2:0.22,3:0.22,4:0.28,5:0.32}
# small pieces read as pale yellow-green in the original, not white
def cube_mat():
  m,n,l=newmat('cube');b=n['Principled BSDF'];at=n.new('ShaderNodeAttribute');at.attribute_name='orig'
  col,out,X,Z=interior_color(n,l,at.outputs['Vector'])
  # per round, matched to the original's measured pile colour (see README)
  fade,tc=PILE.get(RI,(0.5,(1.0,1.0,0.55)))
  mx=n.new('ShaderNodeMix');mx.data_type='RGBA';mx.inputs[0].default_value=fade;l.new(col,mx.inputs[6]);mx.inputs[7].default_value=(*tc,1)
  l.new(mx.outputs[2],b.inputs['Base Color']);b.inputs['Roughness'].default_value=0.6
  l.new(mx.outputs[2],b.inputs['Emission Color']);b.inputs['Emission Strength'].default_value=GLOW.get(RI,0.2)
  return m
# ---------- the pile: one mesh, every cube animated by us ----------
def make_cells(R,G=30):
  X,Z,Y,dx,dz,dy=planes(R);C=R['C']
  gx=min(R['kx']+1,2*G);gy=min(R['kz']+1,G);gz=min(R['ky']+1,G)
  sx=L/gx;sy=2*RM/gy;sz=TOPZ/gz;rng=np.random.default_rng(R['i'])
  xs=-L/2+(np.arange(gx)+0.5)*sx;ys=-RM+(np.arange(gy)+0.5)*sy;zs=(np.arange(gz)+0.5)*sz
  P=np.array([(x,y,z) for x in xs for y in ys for z in zs]);keep=np.array([q_in(*p)<1.0 for p in P]);P=P[keep]
  # released when the dice plane passes the back of the cube
  back=P[:,1]+sy/2;Cy=np.array(Y);Ct=np.array(C)
  idx=np.searchsorted(Cy,back-1e-6)  # first plane at or behind the cube's back
  tr=np.where(idx<len(C),Ct[np.minimum(idx,len(C)-1)],Ct[-1])
  # pile: the avocado slumps forward, pieces mixed so the mound looks pale like the original
  T=np.stack([P[:,0]*1.10,P[:,1]*1.22-0.32,np.maximum(0.5*sz*LOOK.get('pile_floor',1.0),P[:,2]*(0.86 if R['i']<=1 else 0.96))],1)
  T[:,:2]+=rng.uniform(-0.25,0.25,(len(T),2))*np.array([sx,sy])
  # the first pieces off take the front of the mound, so the pile grows in FRONT of the
  # cut face and the face (and the stone) stays in view, like the original
  tgt=np.argsort((T[:,1] if R['i']<=1 else T[:,2]*1.6+0.35*(T[:,1]+RM))+rng.normal(0,0.06,len(T)));cub=np.argsort(tr+rng.uniform(0,1e-3,len(tr)))
  T2=np.empty_like(T);T2[cub]=T[tgt]
  yp=Cy[np.minimum(idx,len(C)-1)];gap=0.12 if R['i']<=1 else 0.4;T2[:,1]=np.minimum(T2[:,1],yp-gap);T=T2
  rot=rng.uniform(1.0,3.2,len(P))*rng.choice([-1,1],len(P));spin=rng.uniform(-0.8,0.8,len(P));dur=rng.uniform(0.32,0.55,len(P)) if R['i']<=1 else (rng.uniform(0.14,0.24,len(P)) if R['i']<=3 else rng.uniform(0.07,0.12,len(P)))
  return dict(P=P,T=T,tr=tr,rot=rot,spin=spin,dur=dur,size=np.array([sx,sy,sz])*(0.94 if R['i']<=1 else 1.18))
def build_pile(cells,rig):
  n=len(cells['P']);cor=np.array([(x,y,z) for x in(-.5,.5) for y in(-.5,.5) for z in(-.5,.5)])*cells['size']
  faces=[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]
  me=bpy.data.meshes.new('pile');verts=np.zeros((n*8,3));F=[]
  for i in range(n): F+= [tuple(i*8+v for v in f) for f in faces]
  me.from_pydata((cells['P'][:,None,:]+cor[None]).reshape(-1,3).tolist(),[],F)
  at=me.attributes.new('orig','FLOAT_VECTOR','POINT');at.data.foreach_set('vector',(cells['P'][:,None,:]+cor[None]).reshape(-1).tolist())
  me.materials.append(cube_mat());ob=bpy.data.objects.new('pile',me);bpy.context.collection.objects.link(ob);ob.parent=rig
  return ob,cor
def pile_at(cells,cor,t):
  P,T=cells['P'],cells['T'];u=np.clip((t-cells['tr'])/cells['dur'],0,1);vis=t>=cells['tr']
  uh=1-(1-u)**1.4;pos=P+(T-P)*uh[:,None];pos[:,2]=P[:,2]+(T[:,2]-P[:,2])*(u*u)
  a=cells['rot']*uh;b=cells['spin']*uh
  ca,sa,cb,sb=np.cos(a),np.sin(a),np.cos(b),np.sin(b)
  # rotate corners: about X (tumble forward) then about Z
  x,y,z=cor[:,0][None],cor[:,1][None],cor[:,2][None]
  y1=y*ca[:,None]-z*sa[:,None];z1=y*sa[:,None]+z*ca[:,None];x1=np.broadcast_to(x,y1.shape)
  x2=x1*cb[:,None]-y1*sb[:,None];y2=x1*sb[:,None]+y1*cb[:,None]
  V=np.stack([x2,y2,z1],2)*vis[:,None,None]+pos[:,None,:]
  return V.reshape(-1,3)

def fast(T,lim=2/30): return len(T)>1 and (T[-1]-T[0])/(len(T)-1) < lim
DICE_FAST=1.5/30   # dice stage: only when cuts come faster than one per 1.5 frames (rounds 5 and 6)
def chop_pose(f,R):
  """per-frame knife pose for fast down/side stages, or None to use knife_pose"""
  X,Z,Y,dx,dz,dy=planes(R);t=f/30;hover=TOPZ+0.12;front=-RM-0.35
  for T,pl in ((R['D'],X),(R['S'],Z)):
    if fast(T) and T[0]-1e-6<=t<=T[-1]+1e-6:
      nd=sum(1 for v in T if v<=t+1e-6);k=max(0,nd-1);nx=min(nd,len(T)-1);down=(f%2==0)
      if T is R['D']: return (Q_DOWN,Vector((pl[k],0,0.0))) if down else (Q_DOWN,Vector((pl[nx],0,hover)))
      return (Q_SIDE,Vector((0.0,RM+0.25,pl[k]))) if down else (Q_SIDE,Vector((0.0,front,pl[nx])))
  C=R['C']
  if fast(C,DICE_FAST) and C[0]-1e-6<=t<=C[-1]+1e-6:
    nd=sum(1 for v in C if v<=t+1e-6);k=max(0,nd-1);nx=min(nd,len(C)-1)
    return (Q_DICE,Vector((0.0,Y[k],0.0))) if f%2==0 else (Q_DICE,Vector((0.0,Y[nx],hover+0.5)))
  return None
def build3(R):
  t0=time.time();build_set();rig,body,clipper=build_body(R);knife=build_knife(rig)
  for ob in EXTRAS(rig):
    fc0=int(round(R['C'][0]*30));ob.hide_render=False;ob.keyframe_insert('hide_render',frame=R['F0']);ob.hide_render=True;ob.keyframe_insert('hide_render',frame=max(R['F0']+1,fc0))
  X,Z,Y,dx,dz,dy=planes(R);F0,F1=R['F0'],R['F1'];scn.frame_start=F0;scn.frame_end=F1-1
  for f in range(F0,F1):
    t=f/30
    body['nxd']=sum(1 for v in R['D'] if v<=t+1e-6);body['nyd']=sum(1 for v in R['S'] if v<=t+1e-6)
    body.keyframe_insert('["nxd"]',frame=f);body.keyframe_insert('["nyd"]',frame=f)
    nd=sum(1 for v in R['C'] if v<=t+1e-6)
    yc=-12+2.0 if nd==0 else (Y[nd-1] if nd<len(Y) else RM+0.5)
    clipper.location=(0,yc-2.0,1);clipper.keyframe_insert('location',frame=f)
    q,p=chop_pose(f,R) or knife_pose(t,R);place_knife(knife,q,p);knife.keyframe_insert('location',frame=f);knife.keyframe_insert('rotation_quaternion',frame=f)
  for ob in (body,clipper):
    for fc in ob.animation_data.action.fcurves:
      for kp in fc.keyframe_points: kp.interpolation='CONSTANT'
  if R['i']==5: set_cam((0.95,-12.6,10.4),(-0.12,-0.3,0.35))
  cells=make_cells(R);pile,cor=build_pile(cells,rig)
  np.savez(OUT+f'cells_r{R["i"]+1}.npz',**cells,cor=cor)
  r=scn.render;r.engine='BLENDER_EEVEE';r.resolution_x=540;r.resolution_y=960
  ee=scn.eevee;ee.taa_render_samples=16;ee.use_gtao=True;ee.gtao_distance=(0.4 if R['i']<=1 else 0.06);ee.use_soft_shadows=True;ee.shadow_cube_size='2048';ee.shadow_cascade_size='4096';ee.use_ssr=False
  ee.use_motion_blur=True;ee.motion_blur_shutter=0.6;ee.motion_blur_steps=1
  scn.view_settings.view_transform='Filmic';scn.view_settings.look='Medium High Contrast';scn.view_settings.exposure=0.25
  bpy.ops.wm.save_as_mainfile(filepath=OUT+f'cuts3_r{R["i"]+1}.blend');print('built round',R['i']+1,'cubes',len(cells['P']),'frames',F0,F1,round(time.time()-t0,1),'s')

def check3(R):
  X,Z,Y,dx,dz,dy=planes(R);fails=[];rows=[]
  for kind,T,pl in (('down',R['D'],X),('side',R['S'],Z),('dice',R['C'],Y)):
    bad=0
    for k,t in enumerate(T):
      q,p=knife_pose(t,R);c=p
      ok=(abs(c.x-pl[k])<1e-3 and c.z<1e-3) if kind=='down' else ((abs(c.z-pl[k])<1e-3 and c.y>RM) if kind=='side' else (abs(c.y-pl[k])<1e-3 and c.z<1e-3))
      if not ok: bad+=1
    rows.append(f'{kind}: {len(T)} cuts, blade on its line at its cut time: {len(T)-bad}/{len(T)}');
    if bad: fails.append(rows[-1])
  for kind,T,pl,lim in (('down',R['D'],X,2/30),('side',R['S'],Z,2/30),('dice',R['C'],Y,DICE_FAST)):
    if not fast(T,lim): continue
    bad=0;n=0
    for f in range(int(T[0]*30),int(T[-1]*30)+1):
      cp=chop_pose(f,R)
      if cp is None or f%2: continue
      n+=1;c=cp[1];t=f/30;recent=[k for k,v in enumerate(T) if t-2/30-1e-6<=v<=t+1e-6]
      if not recent: on=False
      elif kind=='down': on=abs(c.x-pl[recent[-1]])<1e-3 and c.z<1e-3
      elif kind=='side': on=abs(c.z-pl[recent[-1]])<1e-3 and c.y>RM
      else: on=abs(c.y-pl[recent[-1]])<1e-3 and c.z<1e-3
      if not on: bad+=1
    rows.append(f'{kind} fast chop: knife down on a just-cut line: {n-bad}/{n} frames')
    if bad: fails.append(rows[-1])
  # lines and cubes per frame
  cells=np.load(OUT+f'cells_r{R["i"]+1}.npz');early=0
  for f in range(R['F0'],R['F1']):
    t=f/30;vis=t>=cells['tr'];nd=sum(1 for v in R['C'] if v<=t+1e-6)
    if nd==0 and vis.any(): early+=1
  rows.append(f'frames with a cube showing before the first chop: {early}');
  if early: fails.append(rows[-1])
  # the pile stays on the board and below the avocado top
  V=pile_at(dict(cells),cells['cor'],R['t1']);rows.append(f'final pile height {round(V[:,2].max(),2)} (food top {round(TOPZ,2)}), lowest {round(V[:,2].min(),3)}')
  if V[:,2].max()>TOPZ or V[:,2].min()< -0.02: fails.append(rows[-1])
  print('\n'.join(rows));print('CHECK','PASS' if not fails else 'FAIL',len(fails))

R=round_def(RI)
if MODE=='build': build3(R)
elif MODE=='check': check3(R)
else:
  bpy.ops.wm.open_mainfile(filepath=OUT+f'cuts3_r{RI+1}.blend');s=bpy.context.scene;pile=bpy.data.objects['pile']
  cells=dict(np.load(OUT+f'cells_r{RI+1}.npz'));cor=cells['cor']
  frames=[int(x) for x in _args[2:]] if MODE=='still' else range(int(_args[2]),int(_args[3]))
  import os;os.makedirs(OUT+'fr3',exist_ok=True)
  for f in frames:
    s.frame_set(f);V=pile_at(cells,cor,f/30);pile.data.vertices.foreach_set('co',V.reshape(-1).astype(np.float32));pile.data.update()
    s.render.filepath=OUT+(f'v3_{f:05d}.png' if MODE=='still' else f'fr3/f{f:05d}.png');bpy.ops.render.render(write_still=True)
    if MODE=='still': print('frame',f)
  print('DONE',MODE,RI)
