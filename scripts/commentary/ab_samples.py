#!/usr/bin/env python3
"""The A/B comparison Leo listens to: the same lines, old voice v new voice,
under the same crowd. Also three whole "goal soundtracks" (crowd, kick, net,
roar, the call, what it means, the co-commentator over the replay), mixed the
way lib/star/goalClip/audio.ts mixes them, to hear the voice in place.

    python3 scripts/commentary/ab_samples.py /home/user/models <out dir>

Needs public/sfx/v2/ made first (generate_v2.py).
"""
import os, sys
import numpy as np, librosa, av

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from broadcast import broadcast  # noqa: E402

SR = 44100
SFX = os.path.join(ROOT, "public", "sfx")

AB = [
    ("cl-g1", "Goal call"),
    ("cl-lr1", "Goal call, from distance"),
    ("cl-late-3", "Late winner"),
    ("cl-s-lv1", "What it means (equaliser)"),
    ("cc-g1", "Co-commentator over the replay"),
    ("cc-g8", "Co-commentator, a dry joke"),
]


def load(path):
    x, _ = librosa.load(path, sr=SR, mono=True)
    return x.astype(np.float32)


def write_mp3(path, x, kbps=96):
    o = av.open(path, "w")
    s = o.add_stream("libmp3lame", rate=SR); s.bit_rate = kbps * 1000; s.layout = "mono"
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    for i in range(0, len(pcm), 4096):
        fr = av.AudioFrame.from_ndarray(pcm[i:i + 4096].reshape(1, -1), format="s16", layout="mono"); fr.sample_rate = SR; fr.pts = i
        for p in s.encode(fr):
            o.mux(p)
    for p in s.encode(None):
        o.mux(p)
    o.close()


def level(x, target=0.22):
    """Same loudness for every voice (speech level, not the single loudest sample), so A v C is fair."""
    if len(x) < 2048:
        return x
    r = librosa.feature.rms(y=x, frame_length=2048, hop_length=512)[0]
    return x * (target / (np.percentile(r, 90) + 1e-9))


def crowd(n):
    bed = load(os.path.join(SFX, "match-crowd.mp3"))
    reps = int(np.ceil(n / len(bed))) + 1
    return np.tile(bed, reps)[:n] / (np.abs(bed).max() + 1e-9)


def place(mix, x, at, gain):
    i = int(at * SR)
    j = min(len(mix), i + len(x))
    if j > i:
        mix[i:j] += x[: j - i] * gain


def duck_env(n, spans, depth=0.5):
    """Crowd level: 1, dipping to `depth` while someone talks (as audio.ts DUCK)."""
    env = np.ones(n, dtype=np.float32)
    for a, b in spans:
        env[int(a * SR): int(b * SR)] = depth
    k = int(0.12 * SR)
    return np.convolve(env, np.ones(k) / k, mode="same").astype(np.float32)


def under_crowd(voice, goal=True, voice_gain=0.9):
    pre, post = 0.7, 0.6
    n = int((pre + len(voice) / SR + post) * SR)
    mix = np.zeros(n, dtype=np.float32)
    bed = crowd(n) * 0.16
    if goal:
        roar = load(os.path.join(SFX, "crowd-cheer-stadium.mp3"))
        place(bed, roar, 0.0, 0.5)
    bed *= duck_env(n, [(pre, pre + len(voice) / SR)])
    mix += bed
    place(mix, level(voice), pre, voice_gain)
    return mix / max(1.0, np.abs(mix).max() / 0.95)


def kokoro_tuned(models, text, co):
    from kokoro_onnx import Kokoro
    k = Kokoro(os.path.join(models, "misc", "kokoro-v1.0.onnx"), os.path.join(models, "misc", "voices-v1.0.bin"))
    style = k.get_voice_style("bm_daniel") if co else k.get_voice_style("bm_george") * 0.55 + k.get_voice_style("bm_lewis") * 0.45
    x, sr = k.create(text, voice=style, speed=0.98 if co else 1.18, lang="en-gb")
    y = broadcast(x, sr, 0.15 if co else 0.7)
    return librosa.resample(y, orig_sr=sr, target_sr=SR)


def goal_track(lines, set_dir, roar_gain=0.85):
    """A goal video's sound: build-up murmur, the strike, the net, the roar,
    the call 0.3 s after the goal, the score line, then the replay (crowd
    drops back) with the co-commentator. Same levels as audio.ts."""
    call, say, co = (load(os.path.join(set_dir, f"{i}.mp3")) if i else np.zeros(1, np.float32) for i in lines)
    goal_t = 2.2
    t_call = goal_t + 0.3
    t_say = t_call + len(call) / SR + 0.15
    t_rep = max(t_say + len(say) / SR + 0.6, goal_t + 4.5)
    t_co = t_rep + 0.35
    n = int((t_co + len(co) / SR + 0.8) * SR)
    t = np.arange(n) / SR
    lvl = np.interp(t, [0, 1.2, 1.6, goal_t, t_rep - 0.3, t_rep, n / SR], [0.16, 0.16, 0.3, 0.42, 0.3, 0.08, 0.08]).astype(np.float32)
    pitch = crowd(n) * lvl
    place(pitch, load(os.path.join(SFX, "kick-soft.mp3")), 0.5, 0.6)
    place(pitch, load(os.path.join(SFX, "kick-hard.mp3")), 1.6, 0.8)
    place(pitch, load(os.path.join(SFX, "goal-net.mp3")), goal_t, 0.75)
    place(pitch, load(os.path.join(SFX, "crowd-cheer-stadium.mp3")), goal_t - 0.05, roar_gain)
    talk = [(t_call, t_call + len(call) / SR), (t_say, t_say + len(say) / SR), (t_co, t_co + len(co) / SR)]
    pitch *= duck_env(n, talk, 0.55)
    box = np.zeros(n, dtype=np.float32)
    for x, at in ((call, t_call), (say, t_say), (co, t_co)):
        place(box, level(x), at, 0.9)
    mix = pitch + box
    return mix / max(1.0, np.abs(mix).max() / 0.95)


def main():
    models, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    sys.path.insert(0, HERE)
    import subprocess, json
    texts = {l["id"]: l["text"] for l in json.loads(subprocess.check_output(["npx", "tsx", "scripts/commentary/dump-lines.mts"], cwd=ROOT))}
    for i, (lid, _) in enumerate(AB, 1):
        write_mp3(os.path.join(out, f"{i}-{lid}-A-old.mp3"), under_crowd(load(os.path.join(SFX, lid + ".mp3")), goal=lid.startswith("cl-")))
        write_mp3(os.path.join(out, f"{i}-{lid}-B-old-voice-tuned.mp3"), under_crowd(kokoro_tuned(models, texts[lid], lid.startswith("cc-")), goal=lid.startswith("cl-")))
        write_mp3(os.path.join(out, f"{i}-{lid}-C-new.mp3"), under_crowd(load(os.path.join(SFX, "v2", lid + ".mp3")), goal=lid.startswith("cl-")))
        print(lid)
    goals = [("goal-1-long-range", ("cl-lr2", "cl-s-ah1", "cc-lr2")),
             ("goal-2-header-equaliser", ("cl-h2", "cl-s-lv2", "cc-h1")),
             ("goal-3-late-winner", ("cl-late-6", None, "cc-late-4"))]
    for name, ids in goals:
        write_mp3(os.path.join(out, f"{name}-old.mp3"), goal_track(ids, SFX))
        write_mp3(os.path.join(out, f"{name}-new.mp3"), goal_track(ids, os.path.join(SFX, "v2")))
        print(name)


if __name__ == "__main__":
    main()
