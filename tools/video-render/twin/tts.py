# Voice every line in V/lines.json with Kokoro (offline): V/vo/<id>.wav + V/vo/durs.json
# usage: python3 tts.py V KOKORO_DIR   (KOKORO_DIR holds kokoro-v1.0.onnx + voices-v1.0.bin, never in git)
import json,sys,os,numpy as np,soundfile as sf
V,KD=sys.argv[1],sys.argv[2]; os.makedirs(V+"/vo",exist_ok=True)
VOICE=json.load(open(V+"/voice.json")) if os.path.exists(V+"/voice.json") else {}
out={}
if VOICE.get("provider")=="elevenlabs":
    # Hugo on ElevenLabs (FACT-KIB-012), same call and settings as tools/video-factory/make.py.
    # The key is a network secret: the proxy adds it to requests to api.elevenlabs.io.
    import urllib.request,subprocess
    vid=VOICE["voiceId"]; vs=VOICE.get("settings",{"stability":0.45,"similarity_boost":0.8,"style":0.3,"use_speaker_boost":True}); gap=VOICE.get("maxGap",0.16)
    for L in json.load(open(V+"/lines.json")):
        id,text=L["id"],L.get("sayEleven") or L["say"]; mp3=f"{V}/vo/{id}.mp3"
        if not os.path.exists(mp3) or os.path.getsize(mp3)<1000:
            body=json.dumps({"text":text,"model_id":VOICE.get("model","eleven_multilingual_v2"),"voice_settings":vs,"seed":VOICE.get("seed",7)}).encode()
            req=urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_128",data=body,method="POST",headers={"Content-Type":"application/json","xi-api-key":"proxy-injected"})
            open(mp3,"wb").write(urllib.request.urlopen(req,timeout=120).read())
        af=f"silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_duration={gap}:stop_threshold=-42dB:stop_silence={gap},areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.08"
        subprocess.run(["ffmpeg","-v","error","-y","-i",mp3,"-af",af,"-ac","1","-ar","24000",f"{V}/vo/{id}.wav"],check=True)
        x,sr=sf.read(f"{V}/vo/{id}.wav"); out[id]=round(len(x)/sr,3); print(id,out[id],flush=True)
    json.dump(out,open(V+"/vo/durs.json","w")); print("total",round(sum(out.values()),2)); sys.exit(0)
from kokoro_onnx import Kokoro
k=Kokoro(KD+"/kokoro-v1.0.onnx",KD+"/voices-v1.0.bin")
for L in json.load(open(V+"/lines.json")):
    id,text=L["id"],L["say"]
    x,sr=k.create(text,voice=L.get("voice","bm_george"),speed=L.get("speed",1.15),lang="en-gb")
    x=np.asarray(x,dtype=np.float32); a=np.abs(x); idx=np.where(a>0.02*a.max())[0]
    x=x[max(0,idx[0]-int(.02*sr)):idx[-1]+int(.08*sr)]; x=x/np.abs(x).max()*0.9
    sf.write(f"{V}/vo/{id}.wav",x,sr); out[id]=round(len(x)/sr,3); print(id,out[id],flush=True)
json.dump(out,open(V+"/vo/durs.json","w")); print("total",round(sum(out.values()),2))
