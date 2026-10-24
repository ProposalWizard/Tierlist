import json,sys,numpy as np,soundfile as sf
from kokoro_onnx import Kokoro
V=sys.argv[1]
k=Kokoro(V+"/kokoro/kokoro-v1.0.onnx",V+"/kokoro/voices-v1.0.bin")
out={}
for id,text in json.load(open(V+"/lines.json")):
    x,sr=k.create(text,voice="bm_george",speed=1.2,lang="en-gb")
    x=np.asarray(x,dtype=np.float32); a=np.abs(x); idx=np.where(a>0.02*a.max())[0]
    x=x[max(0,idx[0]-int(.02*sr)):idx[-1]+int(.08*sr)]; x=x/np.abs(x).max()*0.9
    sf.write(f"{V}/vo/{id}.wav",x,sr); out[id]=round(len(x)/sr,3); print(id,out[id],sr,flush=True)
json.dump(out,open(V+"/vo/durs.json","w"))
print("total",sum(out.values()))
