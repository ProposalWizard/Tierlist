import json,sys,re,numpy as np,soundfile as sf,subprocess
V=sys.argv[1]
durs=json.load(open(V+"/vo/durs.json"))
# caption tokens: "SHOWN|spoken" (spoken defaults to shown); weight by spoken length
CAP={
 "hook":"3|three MATES, BUILDING THE BEST FOOTBALL GAME EVER. DAY|day ONE? THE KEEPER SAVED EVERYTHING.",
 "b1":"ONE-ON-ONES WENT IN 9.8%.|nine-point-eight-percent NOBODY IN THE WAY. HE JUST SAVED IT.",
 "b2":"4|four BUGS LATER? 47.6%|forty-seven-point-six",
 "b3":"69%|sixty-nine-percent OF CHANCES FRAMED|were-framed WRONG. SO WE PINNED THE GOAL.",
 "b5":"14|fourteen CHANCE SITUATIONS BECAME 64.|sixty-four ZERO REPEATS IN A ROW.",
 "b6":"VERSION 0.2.|zero-point-two LEO BUILT GOALIE MODE.",
 "b7":"YOUR AIM WAS HALF A METRE OFF YOUR CURSOR. NOW IT'S EXACT.",
 "b8":"THE PITCH LOOKED LIKE AN ICE RINK. THE GRASS WAS NEVER DRAWN.",
 "b9":"VERSION 0.3.|zero-point-three YOUR OWN TEAM-MATES BLOCKED A THIRD OF YOUR LONG SHOTS. NOW? ZERO.",
 "b10":"YOU DRAW THE CHANCES. THE GAME LEARNS THE RULES.",
 "end":"FOLLOW, AND WATCH IT BECOME THE BEST FOOTBALL GAME EVER.",
}
order=["hook","b1","b2","b3","b5","b6","b7","b8","b9","b10","end"]
GAP=0.14; t=0.12; segs=[]
for id in order:
    d=durs[id]; toks=[]
    for tk in CAP[id].split(" "):
        shown,_,spoken=tk.partition("|"); spoken=spoken or shown
        w=len(re.sub(r"[^A-Za-z0-9]","",spoken))+1.5+(2.5 if re.search(r"[.,?!]$",shown) else 0)
        toks.append([shown,w])
    tot=sum(w for _,w in toks); a=0; words=[]
    usable=d*0.96
    for shown,w in toks:
        words.append({"w":shown,"t":round(t+usable*a/tot,3)}); a+=w
    segs.append({"id":id,"start":round(t,3),"vo":d,"words":words})
    t+=d+GAP
END=t+1.15
for i,s in enumerate(segs): s["end"]=round(segs[i+1]["start"] if i+1<len(segs) else END,3)
json.dump({"total":round(END,3),"segs":segs},open(V+"/timeline.json","w"),indent=1)
print("total",END)
# ---- audio mix 48k stereo
SR=48000; N=int((END+0.3)*SR); mix=np.zeros(N,np.float32)
def load(p):
    out=subprocess.run(["ffmpeg","-v","error","-i",p,"-f","f32le","-ac","1","-ar",str(SR),"-"],capture_output=True).stdout
    return np.frombuffer(out,np.float32).copy()
def put(x,at,g=1.0):
    i=int(at*SR); x=x[:max(0,N-i)]; mix[i:i+len(x)]+=x*g
rng=np.random.default_rng(7)
def whoosh(L=0.38):
    n=int(L*SR); x=rng.standard_normal(n).astype(np.float32)
    # moving one-pole lowpass sweep up then down
    env=np.sin(np.linspace(0,np.pi,n))**2; cut=0.02+0.35*np.sin(np.linspace(0,np.pi,n))
    y=np.zeros(n,np.float32); s=0.0
    for i in range(n): s+=cut[i]*(x[i]-s); y[i]=s
    return y*env/np.abs(y).max()
def hit(L=0.5,f0=95):
    n=int(L*SR); tt=np.arange(n)/SR; f=f0*np.exp(-tt*6)+38
    ph=2*np.pi*np.cumsum(f)/SR; body=np.sin(ph)*np.exp(-tt*7)
    click=rng.standard_normal(n)*np.exp(-tt*90)*0.5
    y=(body+click).astype(np.float32); return y/np.abs(y).max()
def tick():
    n=int(0.05*SR); tt=np.arange(n)/SR; return (np.sin(2*np.pi*2200*tt)*np.exp(-tt*120)).astype(np.float32)
W=whoosh(); H=hit(); Hs=hit(0.35,140)
A=V+"/assets/"
for s in segs:
    put(load(f"{V}/vo/{s['id']}.wav"),s["start"],1.0)
put(load(A+"whistle-start.mp3"),0.0,0.35)
put(H,0.05,0.55)
for s in segs[1:]: put(W,s["start"]-0.22,0.45)
st={x["id"]:x for x in segs}
def wt(id,word): return next(w["t"] for w in st[id]["words"] if w["w"].startswith(word))
put(load(A+"keeper-save.mp3"),wt("hook","SAVED"),0.6)
put(load(A+"keeper-save.mp3"),wt("b1","SAVED"),0.6)
put(H,wt("b1","9.8%"),0.5)
put(load(A+"kick-hard.mp3"),wt("b2","47.6%")-0.25,0.6); put(load(A+"goal-net.mp3"),wt("b2","47.6%"),0.6)
put(load(A+"crowd-cheer-stadium.mp3")[:int(2.4*SR)]*np.linspace(1,0,int(2.4*SR)).astype(np.float32),wt("b2","47.6%"),0.32)
put(H,wt("b3","69%"),0.5); put(Hs,wt("b3","PINNED"),0.5)
for k in range(10): put(tick(),wt("b5","BECAME")+k*0.06,0.25)
put(H,wt("b5","64."),0.5)
put(H,st["b6"]["start"]+0.05,0.6); put(Hs,wt("b7","EXACT"),0.5)
put(Hs,wt("b8","GRASS"),0.4)
put(H,st["b9"]["start"]+0.05,0.6); put(load(A+"kick-hard.mp3"),wt("b9","ZERO"),0.5); put(load(A+"goal-net.mp3"),wt("b9","ZERO")+0.2,0.5)
put(H,st["end"]["start"],0.55)
put(load(A+"crowd-cheer-stadium.mp3")[:int(3.2*SR)]*np.linspace(0,1,int(3.2*SR)).astype(np.float32)**0.5*np.linspace(1,0.0,int(3.2*SR)).astype(np.float32)**0.3,st["end"]["start"],0.25)
mix=np.tanh(mix*1.1)*0.92
fade=int(0.25*SR); mix[-fade:]*=np.linspace(1,0,fade)
sf.write(V+"/mix.wav",np.stack([mix,mix],1),SR)
print("audio ok",np.abs(mix).max())
