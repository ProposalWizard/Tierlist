# Beat timings from the voice lengths -> V/timeline.json, and the sound mix -> V/mix.wav
# lines.json: [{"id","say","cap", "sfx":[["hit"|"tick"|"whoosh"|"pop", "WORD-PREFIX" or seconds-into-line, gain]] }]
# "cap" = the caption words shown (UPPERCASE), tokens "SHOWN|spoken" when they differ. Defaults to "say".
import json,sys,re,numpy as np,soundfile as sf
V=sys.argv[1]; L=json.load(open(V+"/lines.json")); durs=json.load(open(V+"/vo/durs.json"))
GAP=0.16; t=0.15; segs=[]
# Real word times (10 Nov 2026): listen to each finished line (faster-whisper, offline) and pin every caption word that
# was heard to the moment it is said; words not recognised (names, numbers) sit between their neighbours by letter count.
# Before this every word time was a guess from letter counts. No whisper on the machine = the old guess, with a note.
import unicodedata,difflib,os
NRM=lambda w:re.sub(r"[^A-Z0-9]","","".join(c for c in unicodedata.normalize("NFD",w.upper()) if unicodedata.category(c)!="Mn"))
ALN=V+"/vo/align.json"; ALIGN=json.load(open(ALN)) if os.path.exists(ALN) else {}; _W=[None]
def listen(id):
    wav=f"{V}/vo/{id}.wav"; key=f"{os.path.getsize(wav)}"
    if ALIGN.get(id,{}).get("key")==key: return ALIGN[id]["words"]
    if _W[0] is None:
        try:
            from faster_whisper import WhisperModel; _W[0]=WhisperModel(os.environ.get("TWIN_WHISPER","small.en"),device="cpu",compute_type="int8")
        except Exception as e: _W[0]=False; print("NOTE: no faster-whisper here, word times are estimated:",str(e)[:80])
    if not _W[0]: return None
    try:   # hand whisper the samples themselves (16 kHz), so it does not need its own audio reader
        x,sr=sf.read(wav,dtype="float32"); x=x if x.ndim==1 else x.mean(1); x16=np.interp(np.arange(int(len(x)*16000/sr))*sr/16000,np.arange(len(x)),x).astype(np.float32)
        seg,_=_W[0].transcribe(x16,word_timestamps=True,language="en",beam_size=3)
        ws=[[NRM(w.word),round(w.start,3)] for sg in seg for w in sg.words if NRM(w.word)]
    except Exception as e: print("NOTE: could not listen to",id,"- its word times are estimated:",str(e)[:80]); return None
    ALIGN[id]={"key":key,"words":ws}; json.dump(ALIGN,open(ALN,"w")); return ws
def heard(id,d,spoken,est):
    ws=listen(id)
    if not ws: return est
    A=[NRM(sp.split("-")[0]) for sp in spoken]; B=[w for w,_ in ws]
    anc=[(0,0.0,0.0)]   # (token, guessed time, real time)
    for m in difflib.SequenceMatcher(None,A,B,autojunk=False).get_matching_blocks():
        for k in range(m.size):
            i=m.a+k; tt=ws[m.b+k][1]
            if A[i] and tt>=anc[-1][2] and tt<=d and i>anc[-1][0]: anc.append((i,est[i],tt))
            elif A[i] and i==0: anc[0]=(0,est[0],min(tt,d))
    anc.append((len(est),d*0.96 if d*0.96>anc[-1][1] else anc[-1][1]+1e-6,max(d*0.96,anc[-1][2])))
    out=[]; j=0
    for i,e in enumerate(est):
        while j+1<len(anc)-1 and anc[j+1][0]<=i: j+=1
        i0,e0,t0=anc[j]; i1,e1,t1=anc[j+1]
        out.append(t0 if i==i0 else t0+(t1-t0)*(e-e0)/max(e1-e0,1e-6))
    return out
for l in L:
    d=durs[l["id"]]; toks=[]
    for tk in (l.get("cap") or l["say"].upper()).split(" "):
        shown,_,spoken=tk.partition("|"); spoken=spoken or shown
        w=len(re.sub(r"[^A-Za-z0-9]","",spoken))+1.5+(2.5 if re.search(r"[.,?!:]$",shown) else 0)
        toks.append([shown,w])
    tot=sum(w for _,w in toks); a=0; words=[]
    est=[]
    for shown,w in toks: est.append(d*0.96*a/tot); a+=w
    real=heard(l["id"],d,[tk.partition("|")[2] or tk for tk in (l.get("cap") or l["say"].upper()).split(" ")],est)
    for (shown,w),e in zip(toks,real): words.append({"w":shown,"t":round(t+e,3)})
    segs.append({"id":l["id"],"start":round(t,3),"vo":d,"words":words}); t+=d+GAP+l.get("hold",0)
END=t+1.6
for i,s in enumerate(segs): s["end"]=round(segs[i+1]["start"] if i+1<len(segs) else END,3)
json.dump({"total":round(END,3),"segs":segs},open(V+"/timeline.json","w"),indent=1); print("total",round(END,2))
SR=48000; N=int((END+0.3)*SR); mix=np.zeros(N,np.float32); rng=np.random.default_rng(7)
def load_wav(p):
    x,sr=sf.read(p,dtype="float32"); x=x if x.ndim==1 else x.mean(1)
    return np.interp(np.arange(int(len(x)*SR/sr))*sr/SR,np.arange(len(x)),x).astype(np.float32)
def put(x,at,g=1.0):
    i=int(max(0,at)*SR); x=x[:max(0,N-i)]; mix[i:i+len(x)]+=x*g
def whoosh(Ln=0.34):
    n=int(Ln*SR); x=rng.standard_normal(n).astype(np.float32); env=np.sin(np.linspace(0,np.pi,n))**2; cut=0.02+0.3*np.sin(np.linspace(0,np.pi,n))
    y=np.zeros(n,np.float32); s=0.0
    for i in range(n): s+=cut[i]*(x[i]-s); y[i]=s
    return y*env/np.abs(y).max()
def hit(Ln=0.45,f0=110):
    n=int(Ln*SR); tt=np.arange(n)/SR; f=f0*np.exp(-tt*6)+40; ph=2*np.pi*np.cumsum(f)/SR
    y=(np.sin(ph)*np.exp(-tt*8)+rng.standard_normal(n)*np.exp(-tt*90)*0.4).astype(np.float32); return y/np.abs(y).max()
def tick():
    n=int(0.05*SR); tt=np.arange(n)/SR; return (np.sin(2*np.pi*1900*tt)*np.exp(-tt*110)).astype(np.float32)
def pop():
    n=int(0.12*SR); tt=np.arange(n)/SR; return (np.sin(2*np.pi*(600+900*tt*8)*tt)*np.exp(-tt*35)).astype(np.float32)
def roll(Ln=1.1):  # snare-style drumroll that speeds up and swells, made from noise bursts
    n=int(Ln*SR); y=np.zeros(n,np.float32); tt=0.0
    while tt<Ln:
        i=int(tt*SR); m=int(0.03*SR); b=rng.standard_normal(m).astype(np.float32)*np.exp(-np.arange(m)/SR*90)
        y[i:i+m]+=b[:max(0,min(m,n-i))]*(0.35+0.65*tt/Ln); tt+=0.075-0.05*tt/Ln
    return y/np.abs(y).max()
def riser(Ln=1.6):  # rising filtered noise into a reveal
    n=int(Ln*SR); x=rng.standard_normal(n).astype(np.float32); cut=np.linspace(0.01,0.45,n); y=np.zeros(n,np.float32); s=0.0
    for i in range(n): s+=cut[i]*(x[i]-s); y[i]=s
    return y*np.linspace(0,1,n)**2/np.abs(y).max()
FX={"whoosh":whoosh(),"hit":hit(),"tick":tick(),"pop":pop(),"roll":roll(),"riser":riser()}
# quiet music bed: soft pulsing low chord (made here, no samples)
tt=np.arange(N)/SR; bed=np.zeros(N,np.float32)
for f in (55,82.4,110,164.8): bed+=np.sin(2*np.pi*f*tt).astype(np.float32)*0.25
pulse=(0.55+0.45*np.sin(2*np.pi*tt*2.0)**8).astype(np.float32)   # 120 bpm feel
mix+=bed*pulse*0.035
st={s["id"]:s for s in segs}
for l,s in zip(L,segs):
    put(load_wav(f"{V}/vo/{l['id']}.wav"),s["start"],1.0)
    if s is not segs[0]: put(FX["whoosh"],s["start"]-0.2,0.3)
    for kind,at,g in l.get("sfx",[]):
        if at=="END": at=s["start"]+s["vo"]
        elif isinstance(at,str):
            hit_=next((w["t"] for w in s["words"] if NRM(w["w"]).startswith(NRM(at.split()[0]))),None)
            if hit_ is None: print(f'CUE NOT FOUND in line "{l["id"]}" (sound {kind}): {at}')
            at=s["start"] if hit_ is None else hit_
        else: at=s["start"]+at
        put(FX[kind],at,g)
mix=np.tanh(mix*1.1)*0.9; fade=int(0.4*SR); mix[-fade:]*=np.linspace(1,0,fade)
sf.write(V+"/mix.wav",np.stack([mix,mix],1),SR); print("audio ok")
