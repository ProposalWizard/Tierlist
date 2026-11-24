#!/usr/bin/env python3
"""Two cut-scene sounds made in code (20 Nov 2026): the signing pen and the press cameras.

    python3 scripts/sfx/cutscene_cues.py      # writes public/sfx/cut-pen-scratch.mp3, cut-camera-shutters.mp3

The cut scenes' beats ask for six sounds (lib/star/cutscene/beats.ts): pen-scratch, camera-shutters,
kick, net, crowd-roar, crowd-murmur. Four already had a file in public/sfx (lib/star/cutscene/sounds.ts
maps them); these two had none. No samples: numpy maths, own work, CC0. The helpers are
scripts/sfx/arcade.py's. public/sfx/manifest.json is updated, so the Sound Board can replace them.
"""
import importlib.util, os, tempfile
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("arcade", os.path.join(HERE, "arcade.py"))
A = importlib.util.module_from_spec(spec)
spec.loader.exec_module(A)
SR = A.SR
rng = np.random.default_rng(20261120)  # fixed: the same file every run


def pen_scratch():
    """A signature: three quick strokes of a ballpoint on paper, then a dot (1.3 s)."""
    out = np.zeros(int(1.3 * SR))
    at = 0.0
    for dur in (0.34, 0.22, 0.42):
        t = A.t_axis(dur)
        n = A.bandpass(rng.standard_normal(len(t)), 2200, 7000, 2)
        # the nib skips along the paper: a fast flutter in the loudness
        flutter = 0.55 + 0.45 * np.abs(np.sin(2 * np.pi * (28 + 10 * rng.random()) * t + rng.random() * 3))
        env = np.sin(np.pi * t / dur) ** 0.6
        s = A.fade(n * flutter * env, 4, 20)
        i = int(at * SR)
        out[i:i + len(s)] += s
        at += dur + 0.06
    dot = A.bandpass(rng.standard_normal(int(0.03 * SR)), 1500, 5000, 2) * np.exp(-A.t_axis(0.03) / 0.006)
    i = int((at + 0.05) * SR)
    out[i:i + len(dot)] += 1.6 * dot
    return A.level(out, -24.0)


def shutter():
    """One camera: the mirror's clack and the shutter's tick (0.12 s)."""
    t = A.t_axis(0.12)
    clack = A.bandpass(rng.standard_normal(len(t)), 900, 6000, 2) * np.exp(-t / 0.006)
    tick = np.zeros(len(t))
    j = int(0.045 * SR)
    tick[j:] = A.bandpass(rng.standard_normal(len(t) - j), 2500, 9000, 2) * np.exp(-A.t_axis((len(t) - j) / SR) / 0.004)
    body = 0.3 * np.sin(2 * np.pi * 320 * t) * np.exp(-t / 0.01)
    return clack + 0.8 * tick + body


def camera_shutters():
    """A press pack: a dozen cameras going off over 1.6 s, some far, some close."""
    out = np.zeros(int(1.8 * SR))
    for k in range(13):
        at = 0.02 + 1.55 * (k / 13) + rng.random() * 0.08
        s = shutter() * (0.35 + 0.65 * rng.random())
        i = int(at * SR)
        out[i:i + len(s)] += s[: len(out) - i]
    return A.level(out, -20.0)


def main():
    rows = []
    for name, make, purpose in (
        ("cut-pen-scratch", pen_scratch, "Cut scenes: the pen on the contract (signing)"),
        ("cut-camera-shutters", camera_shutters, "Cut scenes: the press cameras (press, trophy)"),
    ):
        with tempfile.TemporaryDirectory() as tmp:
            wav = os.path.join(tmp, name + ".wav")
            A.write_wav(wav, make())
            mp3 = os.path.join(A.OUT, name + ".mp3")
            A.to_mp3(wav, mp3, 64)
        rows.append({"name": name, "file": f"/sfx/{name}.mp3", "duration": A.duration(mp3),
                     "kb": round(os.path.getsize(mp3) / 1024, 1), "purpose": purpose,
                     "prompt": "Made in code: scripts/sfx/cutscene_cues.py (own work, CC0)."})
        print(f"{name}.mp3  {rows[-1]['duration']} s  {rows[-1]['kb']} KB")
    A.update_manifest(rows)


if __name__ == "__main__":
    main()
