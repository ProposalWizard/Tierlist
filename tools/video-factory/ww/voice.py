"""Voice D takes for Who would win? (tools/video-factory/ww). Run with the Qwen venv's python:
  $QWEN_PY -I voice.py requests.json
requests.json = [[out_wav_path, text, seed], ...]; files that already exist are skipped.
Voice D = Qwen3-TTS 0.6B Base cloning Tadhg Hynes (../voice/hynes.wav + ../voice/hynes.txt).
The model loads once per call (about 7 GB of RAM; the weights, about 2.4 GB, download on first use)."""
import json, os, sys, time
import torch, soundfile as sf
from qwen_tts import Qwen3TTSModel

HERE = os.path.dirname(os.path.abspath(__file__))
REF_WAV = os.path.join(HERE, "..", "voice", "hynes.wav")
REF_TXT = open(os.path.join(HERE, "..", "voice", "hynes.txt")).read().strip()
MODEL = os.environ.get("QWEN_MODEL", "Qwen/Qwen3-TTS-12Hz-0.6B-Base")

reqs = [r for r in json.load(open(sys.argv[1])) if not os.path.exists(r[0])]
if reqs:
    torch.set_num_threads(int(os.environ.get("QWEN_THREADS", "4")))
    m = Qwen3TTSModel.from_pretrained(MODEL, device_map="cpu", dtype=torch.float32)
    prompt = m.create_voice_clone_prompt(ref_audio=REF_WAV, ref_text=REF_TXT)
    for out, text, seed in reqs:
        torch.manual_seed(int(seed)); t = time.time()
        wavs, sr = m.generate_voice_clone(text=text, language="English", voice_clone_prompt=prompt)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        sf.write(out, wavs[0], sr)
        print(f"voice {os.path.basename(out)} {time.time() - t:.1f}s ({len(wavs[0]) / sr:.1f}s audio)", flush=True)
