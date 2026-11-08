"""Video factory: storyboard JSON -> finished 1080x1920 MP4 (Mikey, 3 Nov 2026).
  python3 make.py stories/<id>.json [--out DIR] [--workers 3]
Steps: voice E per line (best of up to 3 seeds, checked with a transcriber) ->
mic-in-a-room finish -> captions from the SCRIPT words timed by the transcriber
-> render frames in a headless browser -> music + voice mix -> MP4.
Needs: ffmpeg, node + playwright chromium, faster_whisper, and a Chatterbox venv
(env CHATTERBOX_PY, default the session's cbx venv)."""
import argparse, difflib, json, os, re, shutil, subprocess, sys
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
CBX = os.environ.get("CHATTERBOX_PY", "/tmp/claude-0/-home-user/f9db4640-b55f-52a1-be6c-75264610aefd/scratchpad/cbx/bin/python")
HUMANISE = os.path.join(ROOT, "scripts/marketing/voice/humanise.sh")
MUSIC = os.path.join(ROOT, "public/star/music")
SR, FPS = 44100, 30
CTA = "Follow for more."  # Mikey, 7 Nov 2026: the end card stays, the voice only says this

def log(*a): print(*a, flush=True)
def load(p, sr=SR):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()

NUM = {"zero":0,"one":1,"two":2,"three":3,"four":4,"five":5,"six":6,"seven":7,"eight":8,"nine":9,"ten":10}
def toks(s):
    s = s.lower().replace("-", " ").replace("’", "'")
    return [w for w in re.sub(r"[^a-z0-9' ]", " ", s).split() if w]
def sim(a, b):
    # names (capitalised words in the script) are skipped: the transcriber spells them its own way
    names = {w.lower().strip(".,?!'\"") for w in a.split()[1:] if w[:1].isupper()}
    A = [w for w in toks(a) if not w.isdigit() and w not in NUM and w not in names]; B = [w for w in toks(b) if not w.isdigit() and w not in NUM and w not in names]
    return difflib.SequenceMatcher(None, A, B).ratio()

_whisper = None
def transcribe(path):
    global _whisper
    from faster_whisper import WhisperModel
    if _whisper is None: _whisper = WhisperModel("small.en", device="cpu", compute_type="int8")
    segs, _ = _whisper.transcribe(load(path, 16000), word_timestamps=True, language="en")
    words = [{"w": w.word.strip(), "t0": w.start, "t1": w.end} for s in segs for w in s.words]
    return " ".join(w["w"] for w in words), words

def align(script, words):
    """Script words, each timed from the transcriber's words (unmatched ones interpolated)."""
    sw = script.split(); sn = [re.sub(r"[^a-z0-9]", "", w.lower()) for w in sw]
    wn = [re.sub(r"[^a-z0-9]", "", w["w"].lower()) for w in words]
    t0 = [None] * len(sw)
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, sn, wn, autojunk=False).get_opcodes():
        if tag == "equal":
            for k in range(i2 - i1): t0[i1 + k] = words[j1 + k]["t0"]
        elif tag == "replace" and j2 > j1:
            for k in range(i2 - i1): t0[i1 + k] = words[j1 + min(j2 - j1 - 1, int(k * (j2 - j1) / (i2 - i1)))]["t0"]
    end = words[-1]["t1"] if words else 1.0
    known = [i for i, v in enumerate(t0) if v is not None]
    if not known: return [{"w": w, "t0": end * i / len(sw)} for i, w in enumerate(sw)]
    for i in range(len(sw)):
        if t0[i] is None:
            prev = max([k for k in known if k < i], default=None); nxt = min([k for k in known if k > i], default=None)
            a = t0[prev] if prev is not None else 0.0; b = t0[nxt] if nxt is not None else end
            pa = prev if prev is not None else -1; nb = nxt if nxt is not None else len(sw)
            t0[i] = a + (b - a) * (i - pa) / (nb - pa)
    for i in range(1, len(t0)): t0[i] = max(t0[i], t0[i - 1] + 0.05)
    return [{"w": w, "t0": t} for w, t in zip(sw, t0)]

# ElevenLabs voice (Mikey, 8 Nov 2026: Hugo, a young London voice; Starter plan). The key is not in
# the code: the session's network proxy adds it to requests to api.elevenlabs.io.
def eleven_voice(cfg, lines, work, best):
    import urllib.request
    vid = cfg["voiceId"]; model = cfg.get("model", "eleven_multilingual_v2")
    vs = cfg.get("settings", {"stability": 0.45, "similarity_boost": 0.8, "style": 0.3, "use_speaker_boost": True})
    gap = cfg.get("maxGap", 0.09)  # Mikey: shorter gaps between sentences, same speaking speed
    for i, ln in enumerate(lines):
        text = ln.get("sayEleven") or ln.get("say") or ln["text"]
        for take, seed in enumerate(cfg.get("seeds", [7, 19])):
            mp3 = os.path.join(work, f"l{i:02d}-e{seed}.mp3"); wav = os.path.join(work, f"l{i:02d}-e{seed}.wav")
            if not os.path.exists(mp3) and take > 0 and cfg.get("noNewTakes"): continue  # reuse what was already paid for
            if not os.path.exists(mp3):
                body = json.dumps({"text": text, "model_id": model, "voice_settings": vs, "seed": seed}).encode()
                req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_128", data=body, method="POST", headers={"Content-Type": "application/json", "xi-api-key": "proxy-injected"})
                open(mp3, "wb").write(urllib.request.urlopen(req, timeout=120).read())
            # Hugo's pauses hold breath and room sound, so -42 dB left 0.3 s gaps; -39 dB with 0.09 s kept
            # trims them without clipping soft word edges ("handball"). Then an even, pitch-safe speed-up
            # (cfg "tempo") brings the read to voice E's pace (Mikey, 8 Nov 2026).
            af = f"silenceremove=start_periods=1:start_threshold=-45dB:stop_periods=-1:stop_duration={gap + 0.02}:stop_threshold=-39dB:stop_silence={gap},areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,atempo={cfg.get('tempo', 1.0)},apad=pad_dur=0.06"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp3, "-af", af, "-ac", "1", "-ar", str(SR), wav], check=True)
            heard, words = transcribe(wav); sc = sim(text, heard)
            if sc > best.get(i, (-1,))[0]: best[i] = (sc, wav, words)
            if sc >= cfg.get("pass", 0.8): break
        log(f"eleven line {i}: {best[i][0]:.2f}")

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("story"); ap.add_argument("--out", default=os.path.join(HERE, "out")); ap.add_argument("--workers", type=int, default=3)
    a = ap.parse_args()
    story = json.load(open(a.story)); vid = story["id"]
    lines = story["lines"]
    if not lines or lines[-1].get("scene", {}).get("type") != "cta": lines.append({"text": CTA, "scene": {"type": "cta"}})
    work = os.path.join(HERE, "work", vid); os.makedirs(work, exist_ok=True); os.makedirs(a.out, exist_ok=True)
    final = os.path.join(a.out, f"{vid}.mp4")
    if os.path.exists(final): log("exists", final); return

    # 1. voice: up to three seeds a line, keep the best match
    best = {}
    eleven = (story.get("voice") or {}).get("provider") == "elevenlabs"
    if eleven: eleven_voice(story["voice"], lines, work, best)
    for round_, seed in enumerate([] if eleven else [3, 11, 21]):
        todo = [i for i in range(len(lines)) if best.get(i, (0,))[0] < 0.86]
        if not todo: break
        reqs = [[os.path.join(work, f"l{i:02d}-s{seed}.wav"), lines[i].get("say", lines[i]["text"]), seed] for i in todo]
        json.dump(reqs, open(os.path.join(work, "req.json"), "w"))
        subprocess.run([CBX, "-I", os.path.join(HERE, "voice_gen.py"), os.path.join(work, "req.json")], check=True)
        for i in todo:
            p = os.path.join(work, f"l{i:02d}-s{seed}.wav"); heard, words = transcribe(p); s = sim(lines[i].get("say", lines[i]["text"]), heard)
            if s > best.get(i, (-1,))[0]: best[i] = (s, p, words)
        log(f"voice round {round_ + 1}: " + ", ".join(f"{i}:{best[i][0]:.2f}" for i in sorted(best)))
    # 2. finish, place, caption
    at, scenes, chunks, plan = 0.35, [], [], []
    for i, ln in enumerate(lines):
        s, raw, words = best[i]
        fin = os.path.join(work, f"l{i:02d}.wav")
        if eleven: shutil.copy(raw, fin)  # a studio voice: no mic-in-a-room finish
        else: subprocess.run([HUMANISE, raw, fin], check=True)
        d = len(load(fin)) / SR
        lead = float(ln.get("lead", 0))  # seconds of the real moment before the voice starts
        scene_t0 = round(at - (0.14 if i else at), 3)
        at += lead
        plan.append({"file": fin, "t": at})
        timed = align(ln["text"], words)
        cur = []
        for j, w in enumerate(timed):
            cur.append({"w": re.sub(r"[\"“”]", "", w["w"]).upper(), "t0": round(at + w["t0"], 3)})
            nxt = timed[j + 1] if j + 1 < len(timed) else None
            if len(cur) >= 3 or re.search(r"[.,?!:;]$", w["w"]) or not nxt:
                t1 = at + (nxt["t0"] if nxt else d - 0.1)
                chunks.append({"t0": round(cur[0]["t0"] - 0.03, 3), "t1": round(t1, 3), "words": cur}); cur = []
        scenes.append({"t0": scene_t0, "scene": {**ln["scene"], "lead": lead}, "words": [{"w": w["w"], "t0": round(at + w["t0"], 3)} for w in timed], "vo1": round(at + d, 3)})
        at += d + 0.28
    vo_end = at - 0.28
    for i, s in enumerate(scenes): s["t1"] = scenes[i + 1]["t0"] if i + 1 < len(scenes) else round(vo_end + 0.4, 3)
    end_card = round(vo_end + 0.4, 3); total = end_card + 2.4
    # voice track + mouth envelope
    N = int(total * SR) + SR; voice = np.zeros(N)
    for p in plan:
        x = load(p["file"]); i = int(p["t"] * SR); voice[i:i + len(x)] += x[:N - i]
    hop = SR // FPS; env = np.array([float(np.sqrt((voice[f * hop:(f + 1) * hop] ** 2).mean())) for f in range(int(total * FPS) + 1)])
    ref = np.percentile(env[env > 0.005], 90) if (env > 0.005).any() else 1
    env = np.round(np.convolve(np.clip(env / ref, 0, 1), [0.25, 0.5, 0.25], "same"), 3)
    tl = {"total": round(total, 3), "end": round(vo_end, 3), "endCard": end_card, "scenes": scenes, "chunks": chunks, "env": env.tolist()}
    with open(os.path.join(work, "timeline.js"), "w") as f:
        f.write("window.STORY = " + json.dumps({k: story.get(k, {}) for k in ("clubs", "people", "players", "shapes", "images", "evalPct", "possLabels")}) + ";\n")
        f.write("window.TL = " + json.dumps(tl) + ";\n")
    eng = os.path.join(HERE, "engine")
    html = open(os.path.join(eng, "chess.html" if story.get("layout") == "chess" else "edit.html")).read().replace('src="avatars.js"', f'src="{eng}/avatars.js"').replace('src="scenes.js"', f'src="{eng}/scenes.js"').replace('src="chess.js"', f'src="{eng}/chess.js"').replace("url(../assets/", f"url({HERE}/assets/")
    open(os.path.join(work, "edit.html"), "w").write(html)
    # 2b. real footage (optional, private drafts only): a scene with "clip": [[file, start, seconds, xcentre?], ...]
    #     gets its frames cut to the pitch window; files are read from story["clipsDir"]
    cd = story.get("clipsDir"); fx = np.zeros(len(voice)); clip_t = {}
    if cd:
        for i, s in enumerate(scenes):
            segs = s["scene"].get("clip")
            if not segs: continue
            need = int((s["t1"] - s["t0"]) * FPS) + 4; outd = os.path.join(work, "clipframes", f"l{i:02d}"); shutil.rmtree(outd, ignore_errors=True); os.makedirs(outd)
            got = 0
            for j, seg in enumerate(segs):
                if got >= need: break
                src, st, ln = seg[0], float(seg[1]), float(seg[2]); xc = float(seg[3]) if len(seg) > 3 else 0.5
                if j == len(segs) - 1: ln = max(ln, (need - got) / FPS)
                vf = f"fps={FPS},scale=-2:820,crop=834:820:(in_w-834)*{xc}:0"
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(st), "-i", os.path.join(cd, src), "-t", str(ln), "-vf", vf, "-q:v", "3", "-start_number", str(got + 1), os.path.join(outd, "c%05d.jpg")], check=True)
                got = len(os.listdir(outd))
                # the clip's own sound (crowd, commentary), same cut
                aud = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(st), "-i", os.path.join(cd, src), "-t", str(ln), "-vn", "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True).stdout
                aud = np.frombuffer(aud, dtype=np.float32).copy(); i0 = int((s["t0"] + (got_before := clip_t.get(i, 0.0))) * SR)
                fx[i0:i0 + len(aud)] += aud[:max(0, len(fx) - i0)]; clip_t[i] = got_before + len(aud) / SR
            s["clipDir"] = outd; s["clipFrames"] = got
        with open(os.path.join(work, "timeline.js"), "w") as f:
            f.write("window.STORY = " + json.dumps({k: story.get(k, {}) for k in ("clubs", "people", "players", "shapes", "images", "evalPct", "possLabels")}) + ";\n")
            f.write("window.TL = " + json.dumps(tl) + ";\n")
    # 3. render
    frames = os.path.join(work, "eframes"); shutil.rmtree(frames, ignore_errors=True)
    n = int(total * FPS); k = max(1, a.workers); parts = [(i * n // k, (i + 1) * n // k - 1) for i in range(k)]
    procs = [subprocess.Popen(["node", os.path.join(HERE, "render.mjs"), work, str(s0), str(s1)]) for s0, s1 in parts]
    for p in procs:
        if p.wait() != 0: raise SystemExit("render failed")
    # 4. mix: a quiet bed under the voice, a lift on the end card
    out = voice[:int(total * SR)].copy()
    if fx.any():  # clip sound: full while the moment plays, ducked under the voice
        e = np.abs(voice); k = SR // 10; e = np.convolve(e, np.ones(k) / k, "same"); act = np.convolve((e > 0.01).astype(float), np.ones(SR // 2) / (SR // 2), "same")
        gain = 0.85 - 0.65 * np.clip(act * 3, 0, 1); f = fx * gain; f /= max(1, np.abs(f).max() / 0.6)
        out += f[:len(out)]
    if story.get("music", "02-working-it-out.mp3") != "none":
        bed = load(os.path.join(MUSIC, story.get("music", "02-working-it-out.mp3"))); nb = int((end_card + 0.3) * SR)
        bed = np.concatenate([bed] * (nb // len(bed) + 1))[:nb]; f1 = int(1.0 * SR); bed[:f1] *= np.linspace(0, 1, f1); bed[-f1:] *= np.linspace(1, 0, f1)
        out[:nb] += bed * 0.16
    lift = load(os.path.join(MUSIC, "03-winning.mp3"))[: len(out) - int(end_card * SR)]; i = int(end_card * SR); f2 = int(0.4 * SR)
    if len(lift) > f2: lift[:f2] *= np.linspace(0, 1, f2); lift[-f2:] *= np.linspace(1, 0, f2)
    out[i:i + len(lift)] += lift * 0.3
    out /= max(1, np.abs(out).max() / 0.95)
    sf.write(os.path.join(work, "mix.wav"), np.stack([out, out], 1), SR)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS), "-i", os.path.join(frames, "f%05d.jpg"), "-i", os.path.join(work, "mix.wav"),
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22", "-preset", "medium", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest", final], check=True)
    shutil.rmtree(frames, ignore_errors=True)
    json.dump({"id": vid, "seconds": round(total, 2), "voice_match": {i: round(best[i][0], 2) for i in best}}, open(os.path.join(work, "result.json"), "w"))
    log("done", final, f"{total:.1f}s")

if __name__ == "__main__": main()
