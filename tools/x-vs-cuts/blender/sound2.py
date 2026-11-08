import json,numpy as np,wave
src=open('/tmp/claude-0/-home-user-Tierlist/c1503037-5087-50d1-9ca4-718cbb45521d/scratchpad/cuts/audio.py').read().split("cnt={'chop'")[0].replace("E=json.load(open(f'events{n}.json'))","E={'T':{'end':5.6}}").replace("n=sys.argv[1];","n='r1';")
import sys;exec(src)
R=json.load(open('events_r1.json'))['R']
for f in R['down']: add(chop(1.0),f/30-0.02,rng.uniform(-.2,.2))
for f in R['side']: add(swish(1.0),f/30-0.08,rng.uniform(-.2,.2))
for f in R['dice']:
  add(crunch(1.0),f/30,0)
  for k in range(10): add(tink(1.0),f/30+0.12+rng.random()*0.35,rng.uniform(-.5,.5))
pk=np.max(np.abs(out));out=out/pk*.8
w=wave.open('audio_r1v2.wav','wb');w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((out*32767).astype('<i2').tobytes());w.close();print('sound ok')
