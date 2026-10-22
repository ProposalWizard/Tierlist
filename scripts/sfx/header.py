#!/usr/bin/env python3
"""The header sound, made in code (headers piece 5, 22 Oct 2026).

    python3 scripts/sfx/header.py            # writes public/sfx/match-header.mp3
    python3 scripts/sfx/header.py --wav DIR  # also keeps the raw WAV in DIR

Research (docs/research/2026-10-21-headers-volleys-acrobatics.md §7.2):
"A new head-on-ball thump. public/sfx has no header sound today."

match-header.mp3 is two layers:
  - the thump: a forehead on a leather ball. Rounder and higher than a boot
    (no boot-on-turf, no sharp crack), with the hollow "pock" of the ball;
  - a short crowd "ooh" rising under it, quiet (about 12 dB under the thump).

No samples: every sound is numpy maths, own work, CC0. Only python3, numpy
and ffmpeg (libmp3lame) are needed. The helpers are scripts/sfx/arcade.py's.
public/sfx/manifest.json is updated. The Sound Board can replace it.
"""
import importlib.util, os, shutil, sys, tempfile
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("arcade", os.path.join(HERE, "arcade.py"))
A = importlib.util.module_from_spec(spec)
spec.loader.exec_module(A)
SR = A.SR
rng = np.random.default_rng(20261022)  # fixed: the same file every run


def thump():
    """Forehead on ball: a round, quick 'dok' (0.2 s)."""
    dur = 0.2
    t = A.t_axis(dur)
    body = A.sweep_sine(220, 92, dur, 0.022) * np.exp(-t / 0.045)
    body += 0.4 * A.sweep_sine(440, 184, dur, 0.022) * np.exp(-t / 0.03)   # the harmonic a phone can play
    pock = 0.3 * np.sin(2 * np.pi * 540 * t) * np.exp(-t / 0.012)             # the ball's hollow ring
    slap = A.lowpass(rng.standard_normal(len(t)), 1500, 2) * np.exp(-t / 0.004) * 0.7
    return A.fade(body + pock + slap, 0.4, 25)


def ooh():
    """A small crowd 'ooh' rising, many voices on the 'oh' vowel (0.9 s)."""
    dur = 0.9
    t = A.t_axis(dur)
    n = len(t)
    env = np.minimum(1, (t / 0.35) ** 1.4) * np.clip((dur - t) / 0.35, 0, 1)
    voices = np.zeros(n)
    for _ in range(40):
        base = rng.uniform(160, 360)
        onset = rng.uniform(0.0, 0.2)
        rise = 1 + rng.uniform(0.04, 0.14) * np.clip((t - onset) / 0.4, 0, 1)
        v = A.saw(base * rise, harmonics=12)
        v = A.formants(v, [(400, 70, 1.0), (850, 110, 0.7), (2400, 200, 0.12)])
        voices += v * np.clip((t - onset) / 0.1, 0, 1) * rng.uniform(0.4, 1.0)
    bed = A.bandpass(rng.standard_normal(n), 300, 2500, 2)
    voices /= np.abs(voices).max() + 1e-9
    bed /= np.abs(bed).max() + 1e-9
    x = (0.8 * voices + 0.35 * bed) * env
    return A.fade(A.lowpass(x, 4000, 2), 5, 120)


def header():
    a = A.level(thump(), -13.0)
    b = A.level(ooh(), -25.0)
    out = np.zeros(int(0.06 * SR) + len(b))
    out[:len(a)] += a
    out[int(0.06 * SR):] += b          # the crowd reacts a beat after the contact
    return A.level(out, -14.0)


def main():
    keep = None
    if "--wav" in sys.argv:
        keep = sys.argv[sys.argv.index("--wav") + 1]
        os.makedirs(keep, exist_ok=True)
    name = "match-header"
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, name + ".wav")
        A.write_wav(wav, header())
        if keep:
            shutil.copy(wav, os.path.join(keep, name + ".wav"))
        mp3 = os.path.join(A.OUT, name + ".mp3")
        A.to_mp3(wav, mp3, 96)
    row = {"name": name, "file": f"/sfx/{name}.mp3", "duration": A.duration(mp3),
           "kb": round(os.path.getsize(mp3) / 1024, 1), "purpose": "Your header in the live match (Match feel: New)",
           "prompt": "Made in code: scripts/sfx/header.py (own work, CC0)."}
    A.update_manifest([row])
    print(f"{name}.mp3  {row['duration']} s  {row['kb']} KB")


if __name__ == "__main__":
    main()
