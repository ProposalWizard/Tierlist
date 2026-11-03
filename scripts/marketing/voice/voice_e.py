"""Voice E, the base voice for Knowitball videos (Mikey, 3 Nov 2026).

Chatterbox TTS's own built-in voice (no reference clip), then humanise.sh
for a mic-in-a-room finish. Usage:
  python voice_e.py lines.json out_dir      # lines.json = [["key", "text"], ...]
Makes two takes per line (seeds 3 and 11): check each with a transcriber and
keep the cleaner one. Needs `pip install chatterbox-tts` (CPU is fine, about
a minute per line).
"""
import json, os, sys, subprocess, torch, torchaudio
from chatterbox.tts import ChatterboxTTS

lines = json.load(open(sys.argv[1])); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
here = os.path.dirname(os.path.abspath(__file__))
m = ChatterboxTTS.from_pretrained(device="cpu")
for key, text in lines:
    for take, seed in enumerate([3, 11]):
        raw = os.path.join(out, f"{key}-{take}.raw.wav"); fin = os.path.join(out, f"{key}-{take}.wav")
        if os.path.exists(fin): continue
        torch.manual_seed(seed)
        wav = m.generate(text, exaggeration=0.55, cfg_weight=0.4, temperature=0.8)
        torchaudio.save(raw, wav, m.sr)
        subprocess.run([os.path.join(here, "humanise.sh"), raw, fin], check=True)
        print("done", fin, flush=True)
