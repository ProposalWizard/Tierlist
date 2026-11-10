# Voice every line in V/lines.json with Kokoro (offline): V/vo/<id>.wav + V/vo/durs.json
# usage: python3 tts.py V KOKORO_DIR   (KOKORO_DIR holds kokoro-v1.0.onnx + voices-v1.0.bin, never in git)
import json,sys,os,numpy as np,soundfile as sf
V,KD=sys.argv[1],sys.argv[2]; os.makedirs(V+"/vo",exist_ok=True)
VOICE=json.load(open(V+"/voice.json")) if os.path.exists(V+"/voice.json") else {}
out={}
if VOICE.get("provider")=="elevenlabs":
    # Hugo on ElevenLabs (FACT-KIB-012), same call and settings as tools/video-factory/make.py.
    # The key is a network secret: the proxy adds it to requests to api.elevenlabs.io.
    import urllib.request,subprocess,hashlib
    vid=VOICE["voiceId"]; vs=VOICE.get("settings",{"stability":0.45,"similarity_boost":0.8,"style":0.3,"use_speaker_boost":True}); gap=VOICE.get("maxGap",0.09); tempo=VOICE.get("tempo",1.13)
    for L in json.load(open(V+"/lines.json")):
        id,text=L["id"],L.get("sayEleven") or L["say"]; mp3=f"{V}/vo/{id}.mp3"
        g=L.get("maxGap",gap)  # a line can keep a longer pause, e.g. a <break> after "prime" so it is not heard as "primer"
        body=json.dumps({"text":text,"model_id":VOICE.get("model","eleven_multilingual_v2"),"voice_settings":{**vs,**L.get("voiceSettings",{})},"seed":L.get("seed",VOICE.get("seed",7))}).encode()
        # the saved take is reused only when the words, voice and settings are the same (10 Nov 2026: a changed line used to keep its old audio)
        key=hashlib.sha1(vid.encode()+body).hexdigest(); kf=f"{V}/vo/{id}.key"; same=os.path.exists(kf) and open(kf).read()==key
        if not same or not os.path.exists(mp3) or os.path.getsize(mp3)<1000:
            req=urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_128",data=body,method="POST",headers={"Content-Type":"application/json","xi-api-key":"proxy-injected"})
            open(mp3,"wb").write(urllib.request.urlopen(req,timeout=120).read()); open(kf,"w").write(key)
        # FACT-KIB-012 pace fix (same as video-factory/make.py): breath counts as silence (-39 dB), pauses ~0.09 s, pitch-safe 1.13x
        af=f"silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_duration={g+0.02}:stop_threshold={L.get("gapDb",-39)}dB:stop_silence={g},areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,atempo={L.get("tempo",tempo)},apad=pad_dur=0.06"
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
