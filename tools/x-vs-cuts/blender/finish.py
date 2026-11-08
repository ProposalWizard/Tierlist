# counters + sound for the whole 72 s, all from the cut events
import json,os,sys,numpy as np,wave
from PIL import Image,ImageDraw,ImageFont,ImageFilter
HERE=os.path.dirname(os.path.abspath(__file__));os.chdir(os.path.join(HERE,'out'))
P=json.load(open(os.path.join(HERE,'plan_avocado.json')));R1=json.load(open('events_r1.json'))['R']
ev=[];  # (seconds, kind)
ev+= [(f/30,'chop') for f in R1['down']]+[(f/30,'side') for f in R1['side']]+[(f/30,'dice') for f in R1['dice']]
for r in P['rounds'][1:]:
  for k,(s,e,n) in {'chop':(r['a0'],r['a1'],r['kx']),'side':(r['b0'],r['b1'],r['ky']),'dice':(r['c0'],r['c1'],r['kz'])}.items():
    ev+=[(s+(i+1)/n*(e-s),k) for i in range(n)]
ev.sort()
starts=[0]+[int(round(r['t0']*30)) for r in P['rounds'][1:]];starts[1]=166
def cuts_at(f):
  rs=max(i for i,s in enumerate(starts) if s<=f);a=starts[rs]/30;b=starts[rs+1]/30 if rs+1<len(starts) else 99
  return sum(1 for t,k in ev if a-1e-6<=t<=f/30+1e-6 and t<b)
CUBES1={124:4,139:18,154:36}
def cubes_at(f):
  if f<166: return f"{max([v for k,v in CUBES1.items() if k<=f],default=0):,}"
  return P['cubes'][min(f,len(P['cubes'])-1)]
if 'video' in sys.argv:
  F='/usr/share/fonts/opentype/inter/InterDisplay-Black.otf';FB='/usr/share/fonts/opentype/inter/InterDisplay-ExtraBold.otf'
  W,H=1080,1920;big=ImageFont.truetype(F,184);lab=ImageFont.truetype(FB,54);mid=ImageFont.truetype(F,104);lab2=ImageFont.truetype(FB,46)
  def ct(d,y,s,f,c):w=d.textlength(s,font=f);d.text(((W-w)/2,y),s,font=f,fill=c)
  g=Image.new('L',(1,H));[g.putpixel((0,y),int(max(0,(y-1400)/520)*140)) for y in range(H)];g=g.resize((W,H))
  os.makedirs('final',exist_ok=True)
  for f in range(166 if 'test' in sys.argv else 2160):
    src=f'fr2/f{f:05d}.png' if f<166 else f'fr3/f{f:05d}.png'
    if not os.path.exists(src): print('MISSING',src);continue
    im=Image.open(src).convert('RGB').resize((W,H),Image.LANCZOS);im=Image.composite(Image.new('RGB',(W,H),(12,10,8)),im,g)
    c=f'{cuts_at(f):,}';cb=cubes_at(f)
    sh=Image.new('RGBA',(W,H),(0,0,0,0));d=ImageDraw.Draw(sh);ct(d,128,c,big,(0,0,0,140));ct(d,1540,cb,mid,(0,0,0,140));sh=sh.filter(ImageFilter.GaussianBlur(8));im.paste(sh,(0,4),sh)
    d=ImageDraw.Draw(im);ct(d,128,c,big,(244,239,230));ct(d,330,'CUTS',lab,(229,164,60));ct(d,1540,cb,mid,(244,239,230));ct(d,1660,'CUBES',lab2,(229,164,60))
    im.save(f'final/f{f:05d}.jpg',quality=92)
  print('frames done')
if 'sound' in sys.argv:
  src=open(os.path.join(HERE,'..','audio.py')).read().split("cnt={'chop'")[0].replace("E=json.load(open(f'events{n}.json'))","E={'T':{'end':72.0}}").replace("n=sys.argv[1];","n='all';")
  exec(src)
  # per 1/30 s, at most a few audible hits; dense runs become a fast rattle at lower volume
  from collections import Counter
  per=Counter((int(t*30),k) for t,k in ev)
  for (fr,k),cnt in per.items():
    t=fr/30;g=0.9/ (1+0.35*(cnt-1))
    for j in range(min(cnt,3)):
      tt=t+j/90
      if k=='chop': add(chop(g),tt-0.01,rng.uniform(-.2,.2))
      elif k=='side': add(swish(g*0.8),tt-0.06,rng.uniform(-.2,.2))
      else:
        add(crunch(g),tt,0)
        for q in range(4): add(tink(0.6*g),tt+0.1+rng.random()*0.4,rng.uniform(-.5,.5))
  pk=np.max(np.abs(out));out=out/pk*.8
  w=wave.open('audio_all.wav','wb');w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((out*32767).astype('<i2').tobytes());w.close()
  print('sound done')
print('cuts check', cuts_at(165), cuts_at(498), cuts_at(2159), cubes_at(2159))
