# Small sampler: plays notes through the VSCO 2 CE recordings (CC0).
# Each sample's real pitch is measured (pyin), not read from its name.
import os, glob, json, re, numpy as np, soundfile as sf, librosa
SR=44100
LIB=os.environ.get('VSCO_DIR', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'vsco'))
CACHE=os.path.join(os.path.dirname(__file__),'pitch_cache.json')
_cache=json.load(open(CACHE)) if os.path.exists(CACHE) else {}
_audio={}
def load(path):
    if path not in _audio:
        y,sr=sf.read(path,always_2d=True); y=y.T.astype(np.float32)
        if y.shape[0]==1: y=np.vstack([y,y])
        y=y[:2]
        if sr!=SR: y=np.vstack([librosa.resample(c,orig_sr=sr,target_sr=SR) for c in y])
        # trim leading silence
        env=np.abs(y).max(0); thr=env.max()*0.02; start=int(np.argmax(env>thr)); y=y[:,max(0,start-64):]
        _audio[path]=y
    return _audio[path]
def pitch_of(path):
    if path in _cache: return _cache[path]
    y=load(path).mean(0)[:int(SR*1.2)]
    f0,vf,_=librosa.pyin(y,fmin=25,fmax=2500,sr=SR,frame_length=4096)
    f=f0[vf] if np.any(vf) else f0[~np.isnan(f0)]
    p=float(np.round(librosa.hz_to_midi(np.median(f)),2)) if len(f) else None
    _cache[path]=p; json.dump(_cache,open(CACHE,'w')); return p
class Inst:
    def __init__(s,pattern,pan=0.0,gain=1.0,release=0.35,pitched=True,maxlen=None):
        s.files=sorted(glob.glob(os.path.join(LIB,pattern)))
        assert s.files, pattern
        s.pan,s.gain,s.release,s.pitched,s.maxlen=pan,gain,release,pitched,maxlen
        s.rms={f:float(np.sqrt(np.mean(load(f)[:, :SR]**2))) for f in s.files}
        if pitched:
            s.pitch={f:pitch_of(f) for f in s.files}; s.files=[f for f in s.files if s.pitch[f]]
        s.rr=0
    def pick(s,midi,vel):
        if s.pitched:
            near=min(abs(s.pitch[f]-midi) for f in s.files)
            cands=[f for f in s.files if abs(s.pitch[f]-midi)<=near+0.6]
        else: cands=list(s.files)
        cands.sort(key=lambda f:s.rms[f])
        # quieter recording for soft notes, louder take for strong ones
        i=min(len(cands)-1,int(vel/128*len(cands)))
        same=[f for f in cands if abs(s.rms[f]-s.rms[cands[i]])<s.rms[cands[i]]*0.25]
        s.rr+=1; return same[s.rr%len(same)]
    def render(s,midi,dur,vel):
        f=s.pick(midi,vel); y=load(f)
        if s.pitched:
            ratio=2**((midi-s.pitch[f])/12)
            if abs(ratio-1)>1e-3:
                idx=np.arange(0,y.shape[1]-1,ratio); y=np.vstack([np.interp(idx,np.arange(y.shape[1]),c) for c in y])
        n=int((dur+s.release)*SR)
        if s.maxlen: n=min(n,int(s.maxlen*SR))
        y=y[:,:n].copy()
        r=int(s.release*SR); k=max(0,min(r,y.shape[1]))
        if y.shape[1]>int(dur*SR) and k: y[:,-k:]*=np.linspace(1,0,k)
        # level follows velocity, on top of picking a louder take
        g=s.gain*(vel/127)**1.3
        L=np.cos((s.pan+1)*np.pi/4); R=np.sin((s.pan+1)*np.pi/4)
        return np.vstack([y[0]*g*L*1.41,y[1]*g*R*1.41])
class Mix:
    def __init__(s,seconds): s.buf=np.zeros((2,int(seconds*SR)),np.float32); s.groups={}
    def add(s,inst,midi,start,dur,vel,group='dry'):
        a=inst.render(midi,dur,vel); i=int(start*SR); j=min(s.buf.shape[1],i+a.shape[1])
        g=s.groups.setdefault(group,np.zeros_like(s.buf)); g[:,i:j]+=a[:,:j-i]
    def hall(s,x,seconds=2.6,wet=0.28,seed=1):
        rng=np.random.default_rng(seed); n=int(seconds*SR); t=np.arange(n)/SR
        ir=np.vstack([rng.standard_normal(n)*np.exp(-6.9*t/seconds) for _ in (0,1)])
        ir[:,:int(0.02*SR)]=0  # pre-delay
        from scipy.signal import fftconvolve
        w=np.vstack([fftconvolve(x[c],ir[c])[:x.shape[1]] for c in (0,1)])
        w*=np.sqrt(np.mean(x**2))/(np.sqrt(np.mean(w**2))+1e-9)
        return x*(1-wet)+w*wet
    def out(s,path,wet=None):
        wet=wet or {}
        tot=np.zeros_like(s.buf)
        for k,g in s.groups.items(): tot+=s.hall(g,wet=wet.get(k,0.28)) if wet.get(k,0.28)>0 else g
        tot/=np.abs(tot).max()+1e-9; tot*=0.89
        sf.write(path,tot.T,SR); return tot
