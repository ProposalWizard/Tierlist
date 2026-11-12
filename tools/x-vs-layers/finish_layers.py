"""Labels + sound + rewind ending for the layers video. Run after every round is rendered.
   python finish_layers.py          -> out/final/*.jpg and out/audio_layers.wav
"""
import json, os, sys, wave, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,'out')
P=json.load(open(os.path.join(HERE,'plan_layers.json')));FPS=30
M=[json.load(open(os.path.join(OUT,f'meta_r{i:02d}.json'))) for i in range(len(P['rounds']))]
END=int(round(P['end']*FPS)); RW=P['rewind']; RW0=int(round(RW['out_from']*FPS)); SRC0=int(round(RW['src_from']*FPS)); SRC1=int(round(RW['src_to']*FPS))-1
def source(f):
  if f<RW0: return f
  u=(f-RW0)/max(1,END-1-RW0); return int(round(SRC1-u*(SRC1-SRC0)))
def label(f):
  m=next(m for m in M if m['F0']<=f<m['F1']) if f<M[-1]['F1'] else M[-1]
  n=sum(1 for b in m['brk_frames'] if b<=f); txt=f'Layers {n}/20'
  if m['gold'] and n==20 and f>=m['brk_frames'][-1]+3: txt+=' + Gold'
  return m['name'],txt
def frames():
  F=ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-SemiBold.otf',58) if os.path.exists('/usr/share/fonts/opentype/inter/Inter-SemiBold.otf') else ImageFont.load_default()
  F2=ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-SemiBold.otf',38) if os.path.exists('/usr/share/fonts/opentype/inter/Inter-SemiBold.otf') else ImageFont.load_default()
  W,H=1080,1920;os.makedirs(os.path.join(OUT,'final'),exist_ok=True)
  def ct(d,y,t,f,c): w=d.textlength(t,font=f);d.text(((W-w)/2,y),t,font=f,fill=c)
  for f in range(END):
    src=source(f);p=os.path.join(OUT,'fr',f'f{src:05d}.png')
    if not os.path.exists(p): print('MISSING',p);continue
    im=Image.open(p).convert('RGB').resize((W,H),Image.LANCZOS);name,txt=label(src)
    sh=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(sh);ct(d,296,name,F,(0,0,0,120));ct(d,388,txt,F2,(0,0,0,120));sh=sh.filter(ImageFilter.GaussianBlur(6));im.paste(sh,(0,3),sh)
    d=ImageDraw.Draw(im);ct(d,296,name,F,(255,255,255));ct(d,388,txt,F2,(240,244,248))
    im.save(os.path.join(OUT,'final',f'f{f:05d}.jpg'),quality=92)
  print('frames done',END)
def sound():
  src=open(os.path.join(HERE,'audio_lib.py')).read().split("cnt={'chop'")[0].replace("E=json.load(open(f'events{n}.json'))","E={'T':{'end':%f}}"%(P['end']+0.3)).replace("n=sys.argv[1];","n='layers';")
  g={};exec(src,g);add,tink,crunch,chop,out,rng,SR=g['add'],g['tink'],g['crunch'],g['chop'],g['out'],g['rng'],g['SR']
  for m,r in zip(M,P['rounds']):
    imp=r['impact']
    if m['n']==0:
      for k,dt in enumerate([0,0.36,0.56,0.67,0.73]): add(tink(0.7/(k+1),1),imp+dt,0)
    for k,b in enumerate(m['brk_frames']):
      t=b/FPS;add(crunch(0.9/(1+0.15*k)),t,0)
      for q in range(5): add(tink(0.5),t+rng.random()*0.6,rng.uniform(-.6,.6))
  o=g['out'];L=o.shape[0]
  a0,a1=int(RW['src_from']*SR),int(RW['src_to']*SR);b0,b1=int(RW['out_from']*SR),min(L,int(P['end']*SR))
  seg=o[a0:a1][::-1];idx=np.linspace(0,len(seg)-1,b1-b0).astype(int);o[b0:b1]=seg[idx]*0.6
  pk=np.max(np.abs(o));o=o/pk*0.8
  w=wave.open(os.path.join(OUT,'audio_layers.wav'),'wb');w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((o*32767).astype('<i2').tobytes());w.close();print('sound done')
if __name__=='__main__':
  sound();frames()
