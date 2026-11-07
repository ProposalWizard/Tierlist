# Voice every line in V/lines.json with Kokoro (offline): V/vo/<id>.wav + V/vo/durs.json
# usage: python3 tts.py V KOKORO_DIR   (KOKORO_DIR holds kokoro-v1.0.onnx + voices-v1.0.bin, never in git)
import json,sys,os,numpy as np,soundfile as sf
from kokoro_onnx import Kokoro
V,KD=sys.argv[1],sys.argv[2]; os.makedirs(V+"/vo",exist_ok=True)
k=Kokoro(KD+"/kokoro-v1.0.onnx",KD+"/voices-v1.0.bin")
out={}
for L in json.load(open(V+"/lines.json")):
    id,text=L["id"],L["say"]
    x,sr=k.create(text,voice=L.get("voice","bm_george"),speed=L.get("speed",1.15),lang="en-gb")
    x=np.asarray(x,dtype=np.float32); a=np.abs(x); idx=np.where(a>0.02*a.max())[0]
    x=x[max(0,idx[0]-int(.02*sr)):idx[-1]+int(.08*sr)]; x=x/np.abs(x).max()*0.9
    sf.write(f"{V}/vo/{id}.wav",x,sr); out[id]=round(len(x)/sr,3); print(id,out[id],flush=True)
json.dump(out,open(V+"/vo/durs.json","w")); print("total",round(sum(out.values()),2))
