"""Voice E takes for the video factory (run with the Chatterbox venv's python).
  python voice_gen.py requests.json
requests.json = [[out_wav_path, text, seed], ...]; skips files that exist."""
import json, os, sys, torch, torchaudio
from chatterbox.tts import ChatterboxTTS
reqs = [r for r in json.load(open(sys.argv[1])) if not os.path.exists(r[0])]
if reqs:
    m = ChatterboxTTS.from_pretrained(device="cpu")
    for out, text, seed in reqs:
        torch.manual_seed(int(seed))
        wav = m.generate(text, exaggeration=0.55, cfg_weight=0.4, temperature=0.8)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        torchaudio.save(out, wav, m.sr)
        print("voice", out, flush=True)
