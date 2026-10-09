#!/usr/bin/env python3
"""Records cut-scene spoken lines with the offline Kokoro voice (as scripts/commentary/generate.py does)
and measures each line's loudness 30 times a second, so a speaker's jaw and head can move with it.

    pip install kokoro-onnx soundfile av numpy
    python3 scripts/cutscene/voice.py <dir with kokoro-v1.0.onnx + voices-v1.0.bin>

Writes public/sfx/cut-<id>.mp3 and lib/star/cutscene/voiceLines.ts (duration + envelope per line).
"The Icon" is bm_george, slowed a touch (deep, calm); invented character, no real person's voice.
"""
import json, os, sys
import numpy as np, av
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LINES = {
    "mentor-line": ("bm_george", 0.88, "Talent gets you here. Hunger keeps you here."),
}
k = Kokoro(os.path.join(sys.argv[1], "kokoro-v1.0.onnx"), os.path.join(sys.argv[1], "voices-v1.0.bin"))

def write_mp3(path, x, sr):
    o = av.open(path, "w")
    s = o.add_stream("libmp3lame", rate=sr); s.bit_rate = 64000; s.layout = "mono"
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    for i in range(0, len(pcm), 4096):
        fr = av.AudioFrame.from_ndarray(pcm[i:i + 4096].reshape(1, -1), format="s16", layout="mono"); fr.sample_rate = sr; fr.pts = i
        for p in s.encode(fr): o.mux(p)
    for p in s.encode(None): o.mux(p)
    o.close()

out = {}
for lid, (voice, speed, text) in LINES.items():
    x, sr = k.create(text, voice=voice, speed=speed, lang="en-gb")
    a = np.abs(x); idx = np.where(a > 0.02 * a.max())[0]
    x = x[max(0, idx[0] - int(0.02 * sr)): idx[-1] + int(0.15 * sr)]
    x = x / max(1e-6, np.abs(x).max()) * 0.9
    write_mp3(os.path.join(ROOT, "public", "sfx", f"cut-{lid}.mp3"), x, sr)
    hop = sr // 30
    env = [float(np.sqrt(np.mean(x[i:i + hop] ** 2))) for i in range(0, len(x), hop)]
    m = max(env) or 1
    out[lid] = {"text": text, "duration": round(len(x) / sr, 3), "env": [round(e / m, 2) for e in env]}
    print(lid, out[lid]["duration"], "s")

with open(os.path.join(ROOT, "lib", "star", "cutscene", "voiceLines.ts"), "w") as f:
    f.write("/** Spoken cut-scene lines (scripts/cutscene/voice.py): file, length, loudness 30 times a second (0..1). Generated. */\n")
    f.write("export const VOICE_LINES: Record<string, { text: string; duration: number; env: number[] }> = ")
    f.write(json.dumps(out))
    f.write(";\n")
