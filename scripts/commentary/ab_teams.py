#!/usr/bin/env python3
"""The A/B listening page for the commentator teams (Leo, 31 Oct 2026).

    python3 scripts/commentary/ab_teams.py docs/handoffs/2026-10-31-leo/commentators

1. Every team (and today's v2 voice, for comparison) on the same three goals:
   a normal goal, a screamer from distance, a late winner. The plans are
   planAudio's own (ab-team-plans.mts); the mix copies mixAudio in
   lib/star/goalClip/audio.ts: the pink-noise crowd through a 900 Hz band
   with its loudness line, the kicks/net/roar from public/sfx, the pitch
   ducked to 0.55 while someone talks, the commentary box (90 Hz low cut,
   x1.2), a limiter. Mono, 48 kHz, 96 kbps.
2. Each commentator's 5 best lines (best scores in teams-takes.json),
   copied as they are.
Writes audio/*.mp3 and data.json next to index.html (index.html reads data.json
inlined at build time: it is written by this script too).
"""
import json, os, shutil, subprocess, sys
import numpy as np, librosa
from scipy.signal import butter, sosfilt, lfilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from generate_v2 import write_mp3  # noqa: E402

SR = 48000
SFX = os.path.join(ROOT, "public", "sfx")


def load(path):
    x, _ = librosa.load(path, sr=SR, mono=True)
    return x.astype(np.float32)


def crowd_noise(n):
    """audio.ts crowdNoise, channel 0: the same LCG, the same three filters, the same swell."""
    seed, w = 12345, np.empty(SR * 4)
    for i in range(len(w)):
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        w[i] = seed / 0x3fffffff - 1
    b0 = lfilter([0.099046], [1, -0.99765], w)
    b1 = lfilter([0.2965164], [1, -0.963], w)
    b2 = lfilter([1.0526913], [1, -0.57], w)
    t = np.arange(len(w)) / SR
    swell = 0.75 + 0.25 * np.sin(2 * np.pi * 0.5 * t) * np.sin(2 * np.pi * 0.25 * t)
    d = (b0 + b1 + b2 + w * 0.1848) * 0.11 * swell
    f = int(SR * 0.05); k = np.arange(f) / f
    d[:f] *= k; d[-f:] *= k[::-1]
    return np.tile(d, n // len(d) + 1)[:n]


def bandpass900(x):
    return sosfilt(butter(1, [900 / 2.2, 900 * 2.2], "band", fs=SR, output="sos"), x)


def place(mix, x, at, gain, rate=1.0):
    if rate != 1.0:  # playbackRate < 1: slower and deeper
        idx = np.arange(0, len(x) - 1, rate)
        x = np.interp(idx, np.arange(len(x)), x)
    i = int(max(0, at) * SR); j = min(len(mix), i + len(x))
    if j > i:
        mix[i:j] += x[: j - i] * gain


def limiter(x, thr_db=-10, ratio=6, att=0.005, rel=0.2):
    env = np.abs(x); ga, gr = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    e = np.empty_like(env); v = 0.0
    for i, s in enumerate(env):
        v = ga * v + (1 - ga) * s if s > v else gr * v + (1 - gr) * s
        e[i] = v
    db = 20 * np.log10(np.maximum(e, 1e-6)); over = np.maximum(0, db - thr_db)
    return x * 10 ** (-(over - over / ratio) / 20)


def mix_plan(plan):
    voice = plan.get("voice", "v1")
    folder = {"teams": "teams", "v2": "v2"}.get(voice, "")
    n = int(plan["duration"] * SR)
    t = np.arange(n) / SR
    bed = plan["bed"]
    lvl = np.interp(t, [b["at"] for b in bed], [b["gain"] for b in bed]) if bed else np.zeros(n)
    pitch = bandpass900(crowd_noise(n)) * lvl
    box = np.zeros(n)
    duck = np.ones(n)
    for c in plan["cues"]:
        s = c["sound"]
        comm = s.startswith("cl-") or s.startswith("cc-")
        x = load(os.path.join(SFX, folder, s + ".mp3") if comm else os.path.join(SFX, s + ".mp3"))
        if comm:
            place(box, x, c["at"], c["gain"])
            duck[int(c["at"] * SR): int((c["at"] + len(x) / SR) * SR)] = 0.55
        else:
            place(pitch, x, c["at"], c["gain"], c["rate"])
    k = int(0.15 * SR)
    duck = np.convolve(duck, np.ones(k) / k, mode="same")
    box = sosfilt(butter(2, 90 if voice != "v1" else 140, "high", fs=SR, output="sos"), box) * 1.2
    y = limiter(pitch * duck + box)
    return (y / max(1.0, np.abs(y).max() / 0.97)).astype(np.float32)


def best_lines(report, who, k=5):
    rows = [(lid, r) for lid, r in report.items() if not lid.startswith("_") and r["who"] == who]
    def score(r):
        b = next(t for t in r["takes"] if t["seed"] == r["seed"])
        return (b["wer"] > 0, b.get("squeal", False), b.get("miss", 0) > 3, -b["mos"])
    rows.sort(key=lambda kv: score(kv[1]))
    return [lid for lid, _ in rows[:k]]


def main():
    out = sys.argv[1]
    aud = os.path.join(out, "audio"); os.makedirs(aud, exist_ok=True)
    plans = json.loads(subprocess.check_output(["npx", "tsx", "scripts/commentary/ab-team-plans.mts"], cwd=ROOT))
    lines = {l["id"]: l for l in json.loads(subprocess.check_output(["npx", "tsx", "scripts/commentary/dump-team-lines.mts"], cwd=ROOT))}
    report = json.load(open(os.path.join(HERE, "teams-takes.json")))
    data = {"goals": {}, "best": {}}
    for key, plan in plans.items():
        name = key.replace("/", "-")
        write_mp3_rate(os.path.join(aud, f"goal-{name}.mp3"), mix_plan(plan))
        said = [c["sound"] for c in plan["cues"] if c["sound"][:3] in ("cl-", "cc-")]
        data["goals"][key] = {"file": f"audio/goal-{name}.mp3", "lines": said, "finish": plan["finish"]}
        print(key, flush=True)
    for who in ("anchor", "poet", "deadpan", "wire", "pro", "analyst", "mate"):
        ids = best_lines(report, who)
        for lid in ids:
            shutil.copy(os.path.join(SFX, "teams", lid + ".mp3"), os.path.join(aud, lid + ".mp3"))
        data["best"][who] = [{"id": lid, "text": lines[lid]["text"], "file": f"audio/{lid}.mp3"} for lid in ids]
    texts = {**{l: lines[l]["text"] for l in lines}}
    v2 = {l["id"]: l["text"] for l in json.loads(subprocess.check_output(["npx", "tsx", "scripts/commentary/dump-lines.mts"], cwd=ROOT))}
    data["text"] = {**v2, **texts}
    json.dump(data, open(os.path.join(out, "data.json"), "w"), indent=1)


def write_mp3_rate(path, x):
    import av
    o = av.open(path, "w")
    s = o.add_stream("libmp3lame", rate=SR); s.bit_rate = 96000; s.layout = "mono"
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    for i in range(0, len(pcm), 4096):
        fr = av.AudioFrame.from_ndarray(pcm[i:i + 4096].reshape(1, -1), format="s16", layout="mono"); fr.sample_rate = SR; fr.pts = i
        for p in s.encode(fr):
            o.mux(p)
    for p in s.encode(None):
        o.mux(p)
    o.close()


if __name__ == "__main__":
    main()
