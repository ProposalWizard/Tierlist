# Shared kit for the Knowitball cues. Notes are written here; sound comes from
# the VSCO 2 CE recordings (CC0) through sampler.py.
import sys, os, json, numpy as np, soundfile as sf, pyloudnorm as pl
sys.path.insert(0, os.path.dirname(__file__))
from sampler import Inst, Mix, SR
OUT=os.environ.get('CUES_OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cues')); os.makedirs(OUT,exist_ok=True)
NOTE={'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11,'Cb':11}
def P(s):
    o=int(s[-1]); return 12*(o+1)+NOTE[s[:-1]]
SPECS=dict(
 vln=('Strings/Violin Section/susVib/*.wav',-0.35,0.5,1.0,True),
 vlnSpic=('Strings/Violin Section/Spic/*.wav',-0.35,0.08,0.9,True),
 vlnPizz=('Strings/Violin Section/Pizz/*.wav',-0.4,0.3,1.0,True),
 vlnTrem=('Strings/Violin Section/Trem/*.wav',-0.3,0.4,1.0,True),
 vla=('Strings/Viola Section/susvib/*.wav',0.1,0.5,1.0,True),
 vlaSpic=('Strings/Viola Section/spic/*.wav',0.15,0.08,0.9,True),
 vlaTrem=('Strings/Viola Section/trem/*.wav',0.1,0.4,1.0,True),
 vc=('Strings/Cello Section/susvib/*.wav',0.35,0.5,1.0,True),
 vcSpic=('Strings/Cello Section/spic/*.wav',0.35,0.08,0.9,True),
 vcPizz=('Strings/Cello Section/pizzT/*.wav',0.35,0.4,1.0,True),
 vcTrem=('Strings/Cello Section/trem/*.wav',0.35,0.4,1.0,True),
 cb=('Strings/Solo Contrabass/SusVib/*.wav',0.45,0.4,1.3,True),
 horn=('Brass/F Horn/sus/*.wav',-0.15,0.4,0.7,True),
 tbn=('Brass/Tenor Trombone/sus/*.wav',0.1,0.35,0.55,True),
 tuba=('Brass/Tuba/sus/*.wav',0.2,0.35,0.7,True),
 flute=('Woodwinds/Flute/susvib/*.wav',-0.2,0.35,0.8,True),
 oboe=('Woodwinds/Oboe/Vib/*.wav',-0.1,0.3,0.7,True),
 clar=('Woodwinds/Clarinet/susLong/*.wav',0.0,0.35,0.8,True),
 bsn=('Woodwinds/Bassoon/sus/*.wav',0.25,0.3,0.8,True),
 bsnStac=('Woodwinds/Bassoon/stac/*.wav',0.25,0.15,0.8,True),
 piano=('Keys/Upright Piano/*.wav',0.0,0.6,0.9,True),
 harp=('Strings/Harp/*.wav',-0.5,1.5,1.0,True),
 glock=('Percussion/Glock/*.wav',0.3,1.2,0.5,True),
 timp=('Percussion/Timpani/Timpani*_Hit*.wav',0.05,1.2,1.0,True),
 timpRoll=('Percussion/Timpani/Rolls/*.wav',0.05,0.6,1.0,False),
 bd=('Percussion/BDrumNewhit*.wav',0.0,1.0,1.2,False),
 snare=('Percussion/Snare2-HitNS*.wav',-0.1,0.3,0.6,False),
 snareRoll=('Percussion/Snare2-rollNS*.wav',-0.1,0.3,0.6,False),
 crash=('Percussion/cymbal-crash1_*.wav',0.25,2.5,0.8,False),
 swell=('Percussion/susCymb1-cresc-Short*.wav',0.0,0.2,0.7,False),
 gong=('Percussion/gongHit_f*.wav',0.0,4,0.9,False),
)
_I={}
def I(name):
    if name not in _I:
        pat,pan,rel,gain,pitched=SPECS[name]
        _I[name]=Inst(pat,pan=pan,release=rel,gain=gain,pitched=pitched)
    return _I[name]
CHORD={'':[0,4,7],'m':[0,3,7],'7':[0,4,7,10],'dim':[0,3,6],'sus':[0,5,7]}
def chord(name):
    r=name[:2] if len(name)>1 and name[1] in '#b' else name[:1]; q=name[len(r):]
    return NOTE[r],CHORD[q]
class Cue:
    def __init__(s,cid,bpm,bars,loop=True,tail=4.0):
        s.id,s.bpm,s.B=cid,bpm,60/bpm; s.BAR=4*s.B; s.bars=bars; s.loop=loop
        s.len=bars*s.BAR; s.tail=tail; s.mix=Mix(s.len+tail+2)
    def n(s,inst,p,t,d,v):
        if t<0: return
        s.mix.add(I(inst),p,t,d,max(1,min(127,v)),'o')
    def hit(s,inst,t,d,v): s.n(inst,60,t,d,v)
    def chord_at(s,name,octave): r,iv=chord(name); base=12*(octave+1)+r; return [base+i for i in iv]
    def pad(s,inst,name,t,d,v,octave=3,top=None):
        for p in s.chord_at(name,octave): s.n(inst,p,t,d,v)
    def theme(s,insts,notes,t,v,shift=0):
        for p,d in notes:
            if p:
                for inst,off,dv in insts: s.n(inst,P(p)+off+shift,t,d*s.B,v+dv)
            t+=d*s.B
        return t
    def render(s,lufs=-20.0,wet=0.3):
        w=s.mix.groups['o']
        w=s.mix.hall(w,wet=wet)
        L=int(s.len*SR)
        if s.loop:
            body=w[:,:L].copy(); tail=w[:,L:]
            k=min(tail.shape[1],L); body[:,:k]+=tail[:,:k]   # wrap the ring-out onto the start
            pre=int(0.5*SR); y=np.concatenate([body[:,-pre:],body,body[:,:pre]],axis=1)  # periodic padding
            meta=dict(loop=True,pre=0.5,len=round(L/SR,6))
        else:
            y=w[:,:int((s.len+s.tail)*SR)]
            f=int(1.5*SR); y[:,-f:]*=np.linspace(1,0,f)
            meta=dict(loop=False,len=round(y.shape[1]/SR,3))
        m=pl.Meter(SR); Lm=m.integrated_loudness(y.T); y=y*10**((lufs-Lm)/20)
        lim=10**(-2/20); a=np.abs(y); y=np.where(a>lim*0.8,np.sign(y)*(lim*0.8+lim*0.2*np.tanh((a-lim*0.8)/(lim*0.2))),y)
        path=os.path.join(OUT,s.id+'.wav'); sf.write(path,y.T,SR)
        meta.update(id=s.id,bpm=s.bpm,lufs=lufs); json.dump(meta,open(path[:-4]+'.json','w'))
        print(s.id,meta,flush=True); return path
