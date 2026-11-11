import json,sys,wave,numpy as np
n=sys.argv[1];E=json.load(open(f'events{n}.json'));SR=48000;rng=np.random.default_rng(1)
T=E['T'];dur=T['end']+0.3;L=int(dur*SR);out=np.zeros((L,2))
def env(nn,a,d):t=np.arange(nn)/SR;return np.minimum(1,t/a)*np.exp(-t/d)
def bp(x,lo,hi):
  X=np.fft.rfft(x);f=np.fft.rfftfreq(len(x),1/SR);X[(f<lo)|(f>hi)]=0;return np.fft.irfft(X,len(x))
def chop(g=1.0):
  nn=int(.16*SR);t=np.arange(nn)/SR
  thud=np.sin(2*np.pi*(150*np.exp(-t*18)+70)*t)*env(nn,.001,.035)
  tick=bp(rng.standard_normal(nn),2500,9000)*env(nn,.0005,.012)*.6
  ring=np.sin(2*np.pi*3100*t)*env(nn,.001,.05)*.08
  return (thud+tick+ring)*g
def swish(g=1.0):
  nn=int(.22*SR);t=np.arange(nn)/SR;x=rng.standard_normal(nn)
  w=np.sin(np.pi*np.minimum(1,t/.2))**2;return bp(x,1800,7000)*w*.35*g
def crunch(g=1.0):
  nn=int(.12*SR);x=rng.standard_normal(nn);return (bp(x,600,5000)*env(nn,.001,.03)*.7+chop(.6)[:nn])*g
def tink(g=1.0,core=0):
  nn=int(.09*SR);t=np.arange(nn)/SR;f=rng.uniform(2600,5200) if not core else rng.uniform(900,1600)
  return (np.sin(2*np.pi*f*t)+.5*np.sin(2*np.pi*f*2.7*t))*env(nn,.0005,.02)*.12*g
def add(sig,at,pan=0.0):
  i=int(at*SR);
  if i<0 or i>=L:return
  s=sig[:L-i];out[i:i+len(s),0]+=s*(1-pan)*.9;out[i:i+len(s),1]+=s*(1+pan)*.9
cnt={'chop':0,'slice':0,'dice':0}
for e in E['ev']:
  k,t=e[0],e[1]
  if k in cnt:cnt[k]+=1
for e in E['ev']:
  k,t=e[0],e[1];p=rng.uniform(-.25,.25)
  if k=='chop':add(chop(1.0/max(1,cnt['chop']/25)**.5),t,p)
  elif k=='slice':add(swish(1.0/max(1,cnt['slice']/25)**.5),t-.08,p)
  elif k=='dice':add(crunch(1.0/max(1,cnt['dice']/25)**.5),t,p)
  elif k=='land':add(tink(1.0/max(1,len(E['ev'])/400)**.5,e[2]),t,p*2)
# soft room tone, but true silence in the two pauses
room=bp(rng.standard_normal(L),80,400)*.004
tt=np.arange(L)/SR
for a,b in[(T['a1']+.15,T['p1']),(T['b1']+.15,T['p2'])]:room[(tt>a)&(tt<b)]=0
out+=room[:,None]
pk=np.max(np.abs(out));out=out/pk*.8 if pk>0 else out
w=wave.open(f'audio{n}.wav','wb');w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((out*32767).astype('<i2').tobytes());w.close()
print(n,cnt,round(dur,2),'s')
