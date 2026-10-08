#!/usr/bin/env python3
"""Records the goal-video commentary lines (lib/star/goalClip/commentary.ts).

Free, offline neural voice: Kokoro (Apache-2.0), model files from
https://github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0).

    pip install kokoro-onnx soundfile av numpy
    python3 scripts/commentary/generate.py <dir with kokoro-v1.0.onnx + voices-v1.0.bin> [ids...]

Writes public/sfx/<id>.mp3, adds/updates them in public/sfx/manifest.json and
writes lib/star/goalClip/commentaryDurations.ts (seconds per line, used to
keep lines from talking over each other). The lead is "bm_george" (a British
male, a touch quicker for the calls); the co-commentator is "bm_fable".
"""
import json, os, subprocess, sys
import numpy as np, av
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
model_dir = sys.argv[1]
only = set(sys.argv[2:])
VOICE = {"lead": ("bm_george", 1.12), "co": ("bm_fable", 1.0)}

lines = json.loads(subprocess.check_output(["npx", "tsx", "scripts/commentary/dump-lines.mts"], cwd=ROOT))
k = Kokoro(os.path.join(model_dir, "kokoro-v1.0.onnx"), os.path.join(model_dir, "voices-v1.0.bin"))

def trim(x, sr):
    a = np.abs(x)
    idx = np.where(a > 0.02 * a.max())[0]
    if len(idx) == 0: return x
    return x[max(0, idx[0] - int(0.02 * sr)): idx[-1] + int(0.12 * sr)]

def write_mp3(path, x, sr):
    o = av.open(path, "w")
    s = o.add_stream("libmp3lame", rate=sr); s.bit_rate = 64000; s.layout = "mono"
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    for i in range(0, len(pcm), 4096):
        fr = av.AudioFrame.from_ndarray(pcm[i:i+4096].reshape(1, -1), format="s16", layout="mono"); fr.sample_rate = sr; fr.pts = i
        for p in s.encode(fr): o.mux(p)
    for p in s.encode(None): o.mux(p)
    o.close()

man_path = os.path.join(ROOT, "public/sfx/manifest.json")
man = json.load(open(man_path))
by = {s["name"]: s for s in man["sounds"]}
dur_path = os.path.join(ROOT, "lib/star/goalClip/commentaryDurations.ts")
durs = {}
if os.path.exists(dur_path):
    for ln in open(dur_path):
        ln = ln.strip()
        if ln.startswith('"'):
            key, val = ln.rstrip(",").split(":")
            durs[key.strip('"')] = float(val)

for ln in lines:
    if only and ln["id"] not in only: continue
    voice, speed = VOICE[ln["voice"]]
    x, sr = k.create(ln["text"], voice=voice, speed=speed, lang="en-gb")
    x = trim(np.asarray(x, dtype=np.float32), sr)
    x = x / max(1e-6, np.abs(x).max()) * 0.92
    path = os.path.join(ROOT, "public/sfx", ln["id"] + ".mp3")
    write_mp3(path, x, sr)
    d = round(len(x) / sr, 2)
    durs[ln["id"]] = d
    by[ln["id"]] = {"name": ln["id"], "file": f"/sfx/{ln['id']}.mp3", "duration": d, "kb": round(os.path.getsize(path) / 1024, 1),
                    "purpose": ("Commentator: " if ln["voice"] == "lead" else "Co-commentator: ") + ln["text"],
                    "prompt": f"(Kokoro {voice}, speed {speed}) {ln['text']}"}
    print(ln["id"], d)

man["sounds"] = [s for s in man["sounds"] if not s["name"].startswith("comm-")]
names = [s["name"] for s in man["sounds"]]
for n, s in by.items():
    if n.startswith("comm-"): continue
    if n in names: man["sounds"][names.index(n)] = s
    else: man["sounds"].append(s)
json.dump(man, open(man_path, "w"), indent=2); open(man_path, "a").write("\n")
with open(dur_path, "w") as f:
    f.write("// Made by scripts/commentary/generate.py. Seconds each commentary line lasts.\n")
    f.write("export const COMMENTARY_SECONDS: Record<string, number> = {\n")
    for kk in sorted(durs): f.write(f'  "{kk}": {durs[kk]},\n')
    f.write("};\n")
