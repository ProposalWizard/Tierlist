#!/usr/bin/env python3
"""The "Arcade" sound set, made in code (Harry, 14 Oct 2026).

    python3 scripts/sfx/arcade.py            # writes the set into public/sfx/
    python3 scripts/sfx/arcade.py --wav DIR  # also keeps the raw WAVs in DIR

Harry picked set A ("Arcade") on the Banners & sounds page, with fixes:
  "menu is still not deep and satisfying enough, plus goal and pass thud sound
   the same - crowd swell is a bit too loud too - ah use confirm from stadium"

So this makes:
  ui-tap.mp3      a deeper, rounder menu "thock" (A's was a wooden click)
  ui-confirm.mp3  the Stadium set's warm chord, as Harry heard it
                  (copied from scripts/sfx/sources/stadium-confirm.mp3)
  match-pass.mp3  a short, low, dry thud: no pitch, no tail
  match-goal.mp3  a bright, rising brass stab: tonal, high, about 0.75 s
  match-crowd.mp3 the crowd swell, 5 dB quieter than set A's

No samples: every sound is numpy maths (CC0, free to use). Only python3,
numpy and ffmpeg (with libmp3lame) are needed. The original page's script was
lost, so this is a new one; the set A measurements it aims at are in the
notes at the bottom. public/sfx/manifest.json is updated for these files.

The Sound Board (/admin/sound-board) can still replace any of them.
"""
import json, os, shutil, subprocess, sys, tempfile
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public", "sfx")
SRC = os.path.join(ROOT, "scripts", "sfx", "sources")
SR = 44100
rng = np.random.default_rng(20261014)  # fixed: the same files every run


# ── small tools ──────────────────────────────────────────────────────────
def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def sweep_sine(f0, f1, dur, tau_f):
    """A sine whose pitch glides f0 -> f1 (exponentially, time constant tau_f)."""
    t = t_axis(dur)
    f = f1 + (f0 - f1) * np.exp(-t / tau_f)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def spectral(x, gain_fn):
    """Filter by shaping the spectrum (zero phase). gain_fn(freqs) -> gain."""
    n = len(x)
    X = np.fft.rfft(x, n * 2)
    f = np.fft.rfftfreq(n * 2, 1 / SR)
    return np.fft.irfft(X * gain_fn(f), n * 2)[:n]


def lowpass(x, fc, order=2):
    return spectral(x, lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order)))


def bandpass(x, lo, hi, order=2):
    return spectral(x, lambda f: 1 / np.sqrt(1 + (lo / np.maximum(f, 1)) ** (2 * order)) / np.sqrt(1 + (f / hi) ** (2 * order)))


def formants(x, peaks):
    """Vowel-like colour: a sum of resonant bumps (centre Hz, width Hz, gain)."""
    def g(f):
        out = np.full_like(f, 0.04)
        for c, w, a in peaks:
            out += a * np.exp(-0.5 * ((f - c) / w) ** 2)
        return out
    return spectral(x, g)


def saw(freq_curve, harmonics=24):
    """A band-limited sawtooth following a pitch curve (Hz per sample)."""
    ph = 2 * np.pi * np.cumsum(freq_curve) / SR
    out = np.zeros_like(ph)
    for k in range(1, harmonics + 1):
        # drop harmonics above 16 kHz so nothing folds back
        mask = (freq_curve * k) < 16000
        out += mask * np.sin(k * ph) / k
    return out


def fade(x, ms_in=1.0, ms_out=6.0):
    n_in, n_out = int(SR * ms_in / 1000), int(SR * ms_out / 1000)
    y = x.copy()
    if n_in:
        y[:n_in] *= np.linspace(0, 1, n_in)
    if n_out:
        y[-n_out:] *= np.linspace(1, 0, n_out) ** 2
    return y


def active_rms_db(x):
    w = int(0.05 * SR)
    win = np.array([np.sqrt(np.mean(x[i:i + w] ** 2)) for i in range(0, max(1, len(x) - w), w)]) if len(x) > w else np.array([np.sqrt(np.mean(x ** 2))])
    act = win[win > 10 ** (-50 / 20) * max(1e-9, np.abs(x).max())]
    return 20 * np.log10(np.sqrt(np.mean(act ** 2)) + 1e-12)


def level(x, target_db, peak_max_db=-1.0):
    """Set the loudness of the sounding part; never let a peak pass peak_max_db."""
    x = x / (np.abs(x).max() + 1e-12)
    x = x * 10 ** ((target_db - active_rms_db(x)) / 20)
    pk = np.abs(x).max()
    lim = 10 ** (peak_max_db / 20)
    if pk > lim:
        # soft knee: everything under 70 % of the limit is untouched
        knee = 0.7 * lim
        a = np.abs(x)
        over = a > knee
        a[over] = knee + (lim - knee) * np.tanh((a[over] - knee) / (lim - knee))
        x = np.sign(x) * a
    return x


# ── the sounds ───────────────────────────────────────────────────────────
def menu_tap():
    """A deeper, rounder "thock": low-mid body, a soft knock, short (0.07 s)."""
    dur = 0.07
    t = t_axis(dur)
    body_env = np.exp(-t / 0.016)
    f = 250 + 110 * np.exp(-t / 0.006)            # 360 -> 250 Hz: the "pop" drop
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = (np.sin(ph) + 0.42 * np.sin(2 * ph) + 0.16 * np.sin(3 * ph)) * body_env  # harmonics so a phone speaker hears it
    hollow = 0.22 * np.sin(2 * np.pi * 780 * t) * np.exp(-t / 0.007)               # the wooden hollow, small
    knock = lowpass(rng.standard_normal(len(t)), 1800, 3) * np.exp(-t / 0.0025) * 0.5
    x = fade(body + hollow + knock, 0.8, 12)
    return level(x, -15.0)


def match_pass():
    """A short, low, dry thud: boot on ball. No pitch to it and no tail (0.14 s)."""
    dur = 0.14
    t = t_axis(dur)
    thump = sweep_sine(150, 62, dur, 0.03) * np.exp(-t / 0.032)
    thump += 0.35 * sweep_sine(300, 124, dur, 0.03) * np.exp(-t / 0.022)   # the harmonic a phone can play
    leather = lowpass(rng.standard_normal(len(t)), 900, 2) * np.exp(-t / 0.006) * 0.9
    turf = bandpass(rng.standard_normal(len(t)), 120, 500, 2) * np.exp(-t / 0.02) * 0.5
    x = fade(thump + leather + turf, 0.5, 20)
    return level(x, -14.5)


def match_goal():
    """A bright, rising brass stab: a quick lift into a held C major chord (0.75 s)."""
    dur = 0.75
    t = t_axis(dur)
    n = len(t)
    lift = 0.07  # the "doit" up into the chord

    def voice(target, detune_cents):
        start = target * 2 ** (-5 / 12)              # starts a fourth below, slides up
        f = np.where(t < lift, start * (target / start) ** (t / lift), target)
        vib = 1 + 0.004 * np.sin(2 * np.pi * 5.6 * t) * np.clip((t - 0.25) / 0.15, 0, 1)
        return saw(f * vib * 2 ** (detune_cents / 1200))

    chord = [523.25, 659.25, 783.99, 1046.5]          # C5 E5 G5 C6
    x = np.zeros(n)
    for i, fz in enumerate(chord):
        amp = [1.0, 0.75, 0.8, 0.45][i]
        x += amp * (voice(fz, -6) + voice(fz, +6)) * 0.5
    # brass: the filter opens with the blow then settles; applied in short slices
    cutoff = 3400 + 5200 * np.clip(t / 0.06, 0, 1) * np.exp(-np.maximum(t - 0.06, 0) / 0.35)
    out = np.zeros(n)
    hop = 512
    win = np.hanning(hop * 2)
    for s in range(0, n, hop):
        seg = x[s:s + hop * 2]
        if len(seg) < hop * 2:
            seg = np.pad(seg, (0, hop * 2 - len(seg)))
        fc = cutoff[min(s + hop, n - 1)]
        y = lowpass(seg * win, fc, 2)
        e = min(n, s + hop * 2)
        out[s:e] += y[:e - s]
    amp = np.minimum(1, t / 0.012) * (0.62 + 0.38 * np.exp(-t / 0.09)) * np.clip((dur - t) / 0.28, 0, 1) ** 1.5
    shine = 0.08 * np.sin(2 * np.pi * 2093 * t) * np.exp(-np.maximum(t - lift, 0) / 0.25) * (t > lift)   # a little sparkle on top
    x = fade(out * amp + shine, 1.0, 30)
    return level(x, -16.0)


def match_crowd():
    """The crowd swell: many voices rising into a roar, 5 dB under set A's (3.2 s)."""
    dur = 3.2
    t = t_axis(dur)
    n = len(t)
    env = np.minimum(1, (t / 0.45) ** 1.6) * np.exp(-np.maximum(t - 0.7, 0) / 1.25)
    vowels = [[(700, 90, 1.0), (1150, 120, 0.6), (2600, 200, 0.18)],    # "ah"
              [(400, 70, 1.0), (850, 110, 0.7), (2400, 200, 0.15)],     # "oh"
              [(550, 80, 1.0), (1750, 150, 0.5), (2600, 220, 0.2)],     # "eh"
              [(330, 60, 1.0), (2100, 180, 0.45), (2900, 220, 0.15)]]   # "ee"
    voices = np.zeros(n)
    for _ in range(70):
        base = rng.uniform(170, 420)
        onset = rng.uniform(0.0, 0.35)
        rise = 1 + rng.uniform(0.06, 0.22) * np.clip((t - onset) / 0.5, 0, 1)   # excited voices go up
        wob = 1 + 0.012 * np.sin(2 * np.pi * rng.uniform(4, 7) * t + rng.uniform(0, 6.28))
        drift = 1 + 0.02 * np.cumsum(rng.standard_normal(n)) / np.sqrt(n) * 6
        v = saw(base * rise * wob * drift, harmonics=14)
        v = formants(v, vowels[rng.integers(len(vowels))])
        gate = np.clip((t - onset) / 0.12, 0, 1) * np.clip((dur - rng.uniform(0, 1.4) - t) / 0.6, 0.15, 1)
        voices += v * gate * rng.uniform(0.4, 1.0)
    bed = bandpass(rng.standard_normal(n), 400, 4000, 2) * 0.6       # the mass of the crowd
    claps = np.zeros(n)
    for _ in range(140):
        at = int(rng.uniform(0.15, 2.8) * SR)
        ln = int(0.012 * SR)
        if at + ln < n:
            claps[at:at + ln] += rng.standard_normal(ln) * np.exp(-np.arange(ln) / (0.003 * SR)) * rng.uniform(0.2, 0.6)
    claps = bandpass(claps, 800, 4500, 2)
    voices /= np.abs(voices).max() + 1e-9
    bed /= np.abs(bed).max() + 1e-9
    claps /= np.abs(claps).max() + 1e-9
    x = (0.7 * voices + 0.6 * bed + 0.2 * claps) * env
    x = lowpass(x, 5000, 2)                       # a stadium heard from the pitch: no hiss on top
    x = fade(x, 5, 250)
    # Set A's crowd measured -17.0 dB (sounding part); Harry: "a bit too loud" -> -5 dB.
    return level(x, -22.0)


# ── writing ──────────────────────────────────────────────────────────────
def write_wav(path, x):
    import wave
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2").tobytes()
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm)


def to_mp3(wav, mp3, kbps):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-ac", "1", "-ar", str(SR),
                    "-c:a", "libmp3lame", "-b:a", f"{kbps}k", mp3], check=True)


def duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                       capture_output=True, text=True)
    try:
        return round(float(r.stdout.strip()), 2)
    except ValueError:
        return 0.0


SET = [
    # name, maker, kbps, purpose
    ("ui-tap", menu_tap, 96, "Any button tap"),
    ("match-pass", match_pass, 96, "A pass or a team-mate's kick in the live match"),
    ("match-goal", match_goal, 96, "Goal sting in the live match"),
    ("match-crowd", match_crowd, 64, "Crowd swell in the live match"),
]


def update_manifest(rows):
    path = os.path.join(OUT, "manifest.json")
    try:
        with open(path) as f:
            man = json.load(f)
    except (OSError, ValueError):
        man = {"sounds": []}
    sounds = man.setdefault("sounds", [])
    for row in rows:
        for s in sounds:
            if s.get("name") == row["name"]:
                s.update(row)
                break
        else:
            sounds.append(row)
    with open(path, "w") as f:
        json.dump(man, f, indent=2)
        f.write("\n")


def main():
    keep = None
    if "--wav" in sys.argv:
        keep = sys.argv[sys.argv.index("--wav") + 1]
        os.makedirs(keep, exist_ok=True)
    rows = []
    with tempfile.TemporaryDirectory() as tmp:
        for name, maker, kbps, purpose in SET:
            x = maker()
            wav = os.path.join(tmp, name + ".wav")
            write_wav(wav, x)
            if keep:
                shutil.copy(wav, os.path.join(keep, name + ".wav"))
            mp3 = os.path.join(OUT, name + ".mp3")
            to_mp3(wav, mp3, kbps)
            rows.append({"name": name, "file": f"/sfx/{name}.mp3", "duration": duration(mp3),
                         "kb": round(os.path.getsize(mp3) / 1024, 1), "purpose": purpose,
                         "prompt": "Made in code: scripts/sfx/arcade.py (Arcade set, CC0)."})
            print(f"{name}.mp3  {rows[-1]['duration']} s  {rows[-1]['kb']} KB")
    # The confirm is the Stadium set's warm chord, kept exactly as Harry heard it.
    src = os.path.join(SRC, "stadium-confirm.mp3")
    dst = os.path.join(OUT, "ui-confirm.mp3")
    shutil.copy(src, dst)
    rows.append({"name": "ui-confirm", "file": "/sfx/ui-confirm.mp3", "duration": duration(dst),
                 "kb": round(os.path.getsize(dst) / 1024, 1), "purpose": "Confirm / continue",
                 "prompt": "Stadium set's warm chord (scripts/sfx/sources/stadium-confirm.mp3, made in code, CC0)."})
    print(f"ui-confirm.mp3  {rows[-1]['duration']} s  {rows[-1]['kb']} KB (Stadium confirm)")
    update_manifest(rows)


if __name__ == "__main__":
    main()

# Notes — set A as measured on the options page (sounding-part loudness, centre
# of brightness, main pitch): tap -19 dB, 2.3 kHz, 1.4 kHz; pass -14.6 dB,
# 188 Hz, 118 Hz; goal -17 dB, 2.0 kHz, 1.05 kHz; crowd -17 dB, 1.4 kHz.
