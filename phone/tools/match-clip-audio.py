"""
THE GOAL VIDEOS' SOUNDS, FROM THE WEBSITE'S OWN FILES.

lib/star/goalClip/audio.ts mixes a goal video's sound from public/sfx: the
kick, the gloves, the net, the crowd's roar and the commentary box's lines
(the first recordings, "v1": what plays while Leo's update switch is off, the
website's default), over a crowd murmur it makes in code (pink noise, a slow
swell, through a band-pass at 900 Hz, Q 0.45).

This copies only the files a goal video can use on the phone:
  - the five effects (audio.ts EFFECT_SOUNDS);
  - every commentary line in the default bank EXCEPT the late lines (they play
    only with Leo's "bigMoments" part) and the season reel's lines (reels are
    not on the phone);
renders the murmur once with the same recipe and numbers (seeded, so the file
is the same every run), and writes src/match/goalClip/clipSounds.ts, the
phone's list of them.

  python3 -I phone/tools/match-clip-audio.py     (from the worktree root; needs numpy)
"""
import json, os, shutil, subprocess, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SFX = os.path.join(ROOT, "public", "sfx")
OUT = os.path.join(ROOT, "phone", "src", "match", "assets", "clip")
LIST = os.path.join(ROOT, "phone", "src", "match", "goalClip", "clipSounds.ts")
EFFECTS = ["kick-hard", "kick-soft", "goal-net", "keeper-save", "crowd-cheer-stadium"]


def commentary_ids():
    # The lib's own list (allCommentaryLines), read through the phone's tsx.
    code = 'import { allCommentaryLines } from "@/lib/star/goalClip/commentary"; console.log(JSON.stringify(allCommentaryLines().map(l => l.id)));'
    out = subprocess.check_output(["npx", "tsx", "-e", code], cwd=os.path.join(ROOT, "phone"), text=True)
    ids = json.loads(out.strip().splitlines()[-1])
    return [i for i in ids if "-late-" not in i and "reel" not in i]


def crowd_bed(sr=24000, seconds=4.0):
    """audio.ts crowdNoise (one channel), then its band-pass (900 Hz, Q 0.45): the murmur at gain 1."""
    n = int(sr * seconds)
    seed = 12345
    b0 = b1 = b2 = 0.0
    d = np.empty(n)
    for i in range(n):
        seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF
        w = seed / 0x3FFFFFFF - 1
        b0 = 0.99765 * b0 + w * 0.099046
        b1 = 0.963 * b1 + w * 0.2965164
        b2 = 0.57 * b2 + w * 1.0526913
        t = i / sr
        swell = 0.75 + 0.25 * np.sin(2 * np.pi * (0.5 * t)) * np.sin(2 * np.pi * 0.25 * t)
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11 * swell
    f = int(sr * 0.05)
    k = np.arange(f) / f
    d[:f] *= k
    d[n - f:] *= k[::-1]
    # Web Audio's bandpass biquad (RBJ cookbook, constant 0 dB peak gain).
    f0, q = 900.0, 0.45
    w0 = 2 * np.pi * f0 / sr
    alpha = np.sin(w0) / (2 * q)
    b = np.array([alpha, 0.0, -alpha]) / (1 + alpha)
    a = np.array([1.0, -2 * np.cos(w0) / (1 + alpha), (1 - alpha) / (1 + alpha)])
    y = np.zeros(n)
    x1 = x2 = y1 = y2 = 0.0
    for i in range(n):
        x0 = d[i]
        y0 = b[0] * x0 + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2
        y[i] = y0
        x2, x1, y2, y1 = x1, x0, y1, y0
    return sr, y


def write_wav(path, sr, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def main():
    os.makedirs(OUT, exist_ok=True)
    names = EFFECTS + commentary_ids()
    for name in names:
        shutil.copyfile(os.path.join(SFX, name + ".mp3"), os.path.join(OUT, name + ".mp3"))
    sr, bed = crowd_bed()
    # Stored loud (peak 0.95) so 16 bits keep it clean; the phone scales it back by BED_SCALE.
    peak = float(np.max(np.abs(bed))) or 1.0
    write_wav(os.path.join(OUT, "crowd-bed.wav"), sr, bed * (0.95 / peak))
    lines = [
        "// Made by phone/tools/match-clip-audio.py: the goal videos' sound files (public/sfx), bundled.",
        "/* eslint-disable @typescript-eslint/no-require-imports */",
        "export const CLIP_SOUND_FILES: Record<string, number> = {",
    ]
    for name in names:
        lines.append(f'  "{name}": require("../assets/clip/{name}.mp3"),')
    lines += ["};", 'export const CROWD_BED: number = require("../assets/clip/crowd-bed.wav");',
              "/** The murmur file is stored at peak 0.95: times this, it is the website's murmur at gain 1. */",
              f"export const BED_SCALE = {peak / 0.95:.5f};", ""]
    with open(LIST, "w") as fh:
        fh.write("\n".join(lines))
    print(f"{len(names)} files copied, the crowd bed rendered; {LIST} written")


main()
