#!/usr/bin/env python3
"""Voice samples for cut-scene people (review, 20 Nov 2026): the same offline Kokoro voice the
commentary uses (scripts/commentary/generate.py, Apache-2.0), one line per role in different voices.

    pip install kokoro-onnx soundfile
    python3 tools/review-people/voice_samples.py <dir with kokoro-v1.0(.int8).onnx + voices-v1.0.bin> <out dir>

Prints every voice the file holds. All voices are Kokoro's own bundled ones: no real person is copied.
"""
import os, sys, json
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

md, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
model = next(os.path.join(md, f) for f in ("kokoro-v1.0.onnx", "kokoro-v1.0.int8.onnx") if os.path.exists(os.path.join(md, f)))
k = Kokoro(model, os.path.join(md, "voices-v1.0.bin"))
voices = sorted(k.get_voices())
print("VOICES", len(voices), json.dumps(voices))

MANAGER = "Sit down, son. I watched every kick of that trial. You'll get your chance."
SAMPLES = [
    # (file, voice, speed, lang, line)
    ("manager-1-old-hand-bm_george", "bm_george", 0.92, "en-gb", MANAGER),
    ("manager-2-young-coach-bm_daniel", "bm_daniel", 1.0, "en-gb", MANAGER),
    ("manager-3-tactician-bm_lewis", "bm_lewis", 0.96, "en-gb", MANAGER),
    ("manager-4-american-am_michael", "am_michael", 1.0, "en-us", MANAGER),
    ("manager-5-woman-bf_emma", "bf_emma", 1.0, "en-gb", MANAGER),
    ("agent-am_puck", "am_puck", 1.08, "en-us", "Three clubs rang me this morning. Don't sign anything until we talk."),
    ("journalist-bf_isabella", "bf_isabella", 1.05, "en-gb", "Two goals on your debut. Did you expect it to go that well?"),
    ("team-mate-bm_fable", "bm_fable", 1.05, "en-gb", "Great ball, mate. Do that again on Saturday."),
]
for name, voice, speed, lang, text in SAMPLES:
    x, sr = k.create(text, voice=voice, speed=speed, lang=lang)
    x = x / max(1e-6, float(np.abs(x).max())) * 0.9
    sf.write(os.path.join(out, name + ".wav"), x, sr)
    print("wrote", name, round(len(x) / sr, 2), "s")
