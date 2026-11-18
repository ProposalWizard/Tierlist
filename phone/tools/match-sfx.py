"""
THE MATCH'S SOUNDS, RENDERED FROM THE WEBSITE'S OWN RECIPES.

The website makes its match sounds in code at play time (lib/star/matchSound.ts,
Web Audio: oscillators, filtered noise, a quick linear attack and an
exponential decay), except your header, which is a file (public/sfx/match-header.mp3).
The phone has no Web Audio, so this renders each recipe once, with the same
numbers, into a small WAV the phone plays with expo-audio
(src/match/sound.ts). Sounds whose recipe depends on how hard (the strike,
the landing thud, the glove, the clang) are rendered at a few strengths;
the phone plays the nearest one at the recipe's loudness.

  python3 -I phone/tools/match-sfx.py     (from the worktree root; needs numpy)

Writes phone/src/match/assets/sfx/*.wav (44.1 kHz, 16-bit mono) and copies
match-header.mp3. Noise is seeded, so the files are the same every run.
"""
import os, shutil, struct, wave
import numpy as np

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "phone", "src", "match", "assets", "sfx")
rng = np.random.default_rng(20261118)


def env_gain(n_total, duration, peak, attack=0.006):
    """envGain: 0 → peak linearly over `attack`, then exponentially to 0.001 at `duration` (holds 0.001 after)."""
    t = np.arange(n_total) / SR
    g = np.empty(n_total)
    a = t < attack
    g[a] = peak * t[a] / attack
    d = (t >= attack) & (t < duration)
    g[d] = peak * (0.001 / peak) ** ((t[d] - attack) / (duration - attack))
    g[t >= duration] = 0.001
    return g


def osc(kind, f):
    """An oscillator of instantaneous frequency f (array, Hz)."""
    ph = np.cumsum(f) / SR
    ph = ph - np.floor(ph)
    if kind == "sine":
        return np.sin(2 * np.pi * ph)
    if kind == "square":
        return np.where(ph < 0.5, 1.0, -1.0)
    if kind == "sawtooth":
        return 2 * ph - 1
    if kind == "triangle":
        return 1 - 4 * np.abs(ph - 0.5)
    raise ValueError(kind)


def tone(freq, duration, kind, peak, glide_to=None):
    """matchSound tone(): stops at duration + 0.05."""
    n = int(SR * (duration + 0.05))
    t = np.arange(n) / SR
    if glide_to is None:
        f = np.full(n, float(freq))
    else:
        f = np.where(t < duration, freq * (glide_to / freq) ** (t / duration), glide_to)
    return osc(kind, f) * env_gain(n, duration, peak)


def biquad(x, kind, f0, q):
    """Web Audio's BiquadFilterNode (RBJ cookbook). Lowpass/highpass Q is in dB, bandpass Q is plain."""
    w0 = 2 * np.pi * f0 / SR
    cw, sw = np.cos(w0), np.sin(w0)
    if kind == "bandpass":
        alpha = sw / (2 * q)
        b = [alpha, 0, -alpha]
    else:
        qlin = 10 ** (q / 20)
        alpha = sw / (2 * qlin)
        if kind == "lowpass":
            b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
        else:
            b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
    a = [1 + alpha, -2 * cw, 1 - alpha]
    b = [v / a[0] for v in b]
    a1, a2 = a[1] / a[0], a[2] / a[0]
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i in range(len(x)):
        xi = x[i]
        yi = b[0] * xi + b[1] * x1 + b[2] * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, xi, y1, yi
        y[i] = yi
    return y


def noise(duration, peak, f, q=1.0, kind="bandpass"):
    """matchSound noiseBurst(): white noise, filtered, attack 2 ms."""
    n = max(1, int(SR * duration))
    x = rng.uniform(-1, 1, n)
    return biquad(x, kind, f, q) * env_gain(n, duration, peak, 0.002)


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: len(p)] += p
    return out


def whistle():
    duration, n = 0.25, int(SR * 0.25)
    t = np.arange(n) / SR
    f = np.interp(t, [0, 0.05, 0.1, 0.15, 0.25], [2200, 2450, 2200, 2450, 2450])
    return osc("square", f) * env_gain(n, 0.22, 0.18, 0.01)


def strike(p, gain=1.0, scuff=False):
    """playStrike(power, gain, bass, scuff) with bass = strikeFeel's (0.3 + 0.7 p, 0.2 for a scuff)."""
    if scuff:
        return mix(tone(150, 0.1, "sine", 0.35 * gain, 80), noise(0.09, 0.3 * gain, 500, 0.8, "lowpass"))
    bass = min(1, 0.3 + 0.7 * p)
    parts = [tone(95 + 45 * (1 - bass), 0.1 + 0.12 * p, "sine", (0.45 + 0.4 * p) * gain, 38 + 14 * (1 - bass))]
    if p > 0.45:
        parts.append(tone(60, 0.16 + 0.08 * p, "sine", 0.35 * p * gain, 32))
    parts.append(noise(0.035 + 0.03 * p, (0.18 + 0.32 * p) * gain, 2600 + 1600 * p, 0.9, "bandpass"))
    parts.append(noise(0.07, 0.12 * gain, 900, 0.7, "lowpass"))
    return mix(*parts)


def thud(k):
    return mix(tone(110, 0.09 + 0.05 * k, "sine", 0.12 + 0.3 * k, 55), noise(0.06, 0.05 + 0.12 * k, 600, 0.8, "lowpass"))


def clang(k):
    return mix(tone(640, 0.7, "triangle", 0.35 * k, 600), tone(1710, 0.5, "sine", 0.18 * k, 1650),
               tone(2930, 0.3, "sine", 0.08 * k, 2900), noise(0.04, 0.3 * k, 3500, 1.2, "bandpass"))


def glove(k, held):
    return mix(tone(140 if held else 190, 0.16 if held else 0.1, "sine", 0.3 + 0.3 * k, 70 if held else 100),
               noise(0.05, 0.22 + 0.25 * k, 900 if held else 1800, 1.1, "bandpass"))


SOUNDS = {
    "kick": lambda: mix(tone(120, 0.12, "sine", 0.55, 55), noise(0.08, 0.22, 1800, 0.7, "bandpass")),
    "touch": lambda: mix(tone(150, 0.07, "sine", 0.3, 90), noise(0.05, 0.1, 1500, 0.8, "bandpass")),
    "net": lambda: mix(noise(0.32, 0.35, 2600, 0.5, "bandpass"), noise(0.22, 0.18, 5200, 0.4, "highpass")),
    "post": lambda: mix(tone(880, 0.5, "triangle", 0.4, 760), tone(1320, 0.45, "sine", 0.22, 1180)),
    "save": lambda: mix(tone(180, 0.14, "sine", 0.4, 90), noise(0.1, 0.25, 700, 1.2, "lowpass")),
    "whistle": whistle,
    "crowd-cheer": lambda: mix(noise(1.6, 0.28, 1400, 0.6, "bandpass"), noise(1.6 * 0.8, 0.28 * 0.6, 1400 * 2.2, 0.4, "highpass")),
    "crowd-groan": lambda: noise(0.9, 0.16, 500, 0.6, "bandpass"),
    "strike-scuff": lambda: strike(0, scuff=True),
}
for p in (0.15, 0.35, 0.55, 0.75, 0.95):
    SOUNDS[f"strike-{int(p * 100)}"] = (lambda p=p: strike(p))
for k in (0.25, 0.6, 1.0):
    SOUNDS[f"thud-{int(k * 100)}"] = (lambda k=k: thud(k))
for k in (0.5, 1.0):
    SOUNDS[f"clang-{int(k * 100)}"] = (lambda k=k: clang(k))
for k in (0.4, 1.0):
    SOUNDS[f"glove-hold-{int(k * 100)}"] = (lambda k=k: glove(k, True))
    SOUNDS[f"glove-parry-{int(k * 100)}"] = (lambda k=k: glove(k, False))


def write(name, x):
    x = np.clip(x, -1, 1)
    with wave.open(os.path.join(OUT, name + ".wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(struct.pack("<%dh" % len(x), *(np.round(x * 32767).astype(int))))


os.makedirs(OUT, exist_ok=True)
total = 0
for name, make in SOUNDS.items():
    write(name, make())
    total += os.path.getsize(os.path.join(OUT, name + ".wav"))
shutil.copy(os.path.join(ROOT, "public", "sfx", "match-header.mp3"), os.path.join(OUT, "match-header.mp3"))
total += os.path.getsize(os.path.join(OUT, "match-header.mp3"))
print(f"{len(SOUNDS) + 1} sounds, {total // 1024} KB in {OUT}")
