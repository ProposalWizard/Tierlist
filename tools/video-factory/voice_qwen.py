"""Voice D takes for the video factory (Mikey, 4 Nov 2026).
Voice D = Qwen3-TTS 0.6B Base cloning Tadhg Hynes (voice/hynes.wav + voice/hynes.txt).
Run with the Qwen venv's python (env QWEN_PY, see SETUP.md).

  $QWEN_PY -I voice_qwen.py requests.json     one batch: [[out_wav, text, seed], ...]
  $QWEN_PY -I voice_qwen.py --serve           make.py's mode: one JSON batch per stdin
                                              line, answers "BATCH DONE" after each

The model (about 7 GB of RAM) and the voice prompt are built ONCE per process, so
make.py starts one process per video and sends it every seed round. Files that
already exist are skipped."""
import gc, json, os, sys, time
import torch, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
REF_WAV = os.path.join(HERE, "voice", "hynes.wav")
REF_TXT = open(os.path.join(HERE, "voice", "hynes.txt")).read().strip()
MODEL = os.environ.get("QWEN_MODEL", "Qwen/Qwen3-TTS-12Hz-0.6B-Base")
_m = _prompt = None


def model():
    global _m, _prompt
    if _m is None:
        from qwen_tts import Qwen3TTSModel
        torch.set_num_threads(int(os.environ.get("QWEN_THREADS", str(os.cpu_count() or 4))))
        _m = Qwen3TTSModel.from_pretrained(MODEL, device_map="cpu", dtype=torch.float32)
        _prompt = _m.create_voice_clone_prompt(ref_audio=REF_WAV, ref_text=REF_TXT)
    return _m, _prompt


def rss_gb():
    try:
        for line in open("/proc/self/status"):
            if line.startswith("VmRSS:"): return int(line.split()[1]) / 1e6
    except OSError: pass
    return 0.0


def run(reqs):
    times = []
    for out, text, seed in reqs:
        if os.path.exists(out): continue
        m, prompt = model()
        torch.manual_seed(int(seed)); t = time.time()
        # a cap on length (12 codec frames a second): a take that runs on past the
        # words would otherwise babble for minutes before it stops
        cap = int(13 * (len(text) / 9 + 2.5))
        with torch.inference_mode():
            wavs, sr = m.generate_voice_clone(text=text, language="English", voice_clone_prompt=prompt, max_new_tokens=cap)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        n = len(wavs[0]); sf.write(out, wavs[0], sr)
        dt = time.time() - t; times.append(dt)
        del wavs; gc.collect()
        print(f"voice {os.path.basename(out)} {dt:.1f}s for {n / sr:.1f}s of audio", file=sys.stderr, flush=True)
        # the model's memory creeps up about 0.8 GB a take on CPU; past QWEN_MAX_GB the
        # process quits cleanly and make.py starts a fresh one (finished takes are kept)
        if rss_gb() > float(os.environ.get("QWEN_MAX_GB", "7.5")):
            print(f"voice D: {rss_gb():.1f} GB, restarting", file=sys.stderr, flush=True); sys.exit(3)
    if times: print(f"voice D: {len(times)} takes, {sum(times) / len(times):.1f}s a take", file=sys.stderr, flush=True)


if __name__ == "__main__":
    if sys.argv[1:] == ["--serve"]:
        for line in sys.stdin:
            if line.strip():
                run(json.loads(line)); print("BATCH DONE", flush=True)
    else:
        run(json.load(open(sys.argv[1])))
