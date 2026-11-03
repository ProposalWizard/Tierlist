#!/usr/bin/env python3
"""
EDIT BEATS — four short original loops for the "Cold edits" goal videos
(Leo's switch part "coldEdits", lib/star/goalClip/editCold.ts).

Every sound is made here from sine waves, noise and envelopes (numpy only):
no samples, no recordings, no copied songs. Each loop has a BUILD, then a
DROP on a known beat, so the edit can put the goal exactly on the drop and
every cut on a beat. The numbers the game needs (bpm, drop beat, length) are
copied into lib/star/goalClip/editMusic.ts; keep the two in step.

  python3 tools/edit-music/make_loops.py public/star/edits

Writes <id>.wav then <id>.mp3 (ffmpeg), and deletes the wav.
"""
import os
import subprocess
import sys

import numpy as np

SR = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else "public/star/edits"
rng = np.random.default_rng(20261031)


def t_of(n):
    return np.arange(n) / SR


def env(n, a=0.002, d=0.2, curve=1.0):
    """Attack then exponential decay, n samples."""
    t = t_of(n)
    e = np.minimum(1.0, t / max(a, 1e-4)) * np.exp(-t / max(d, 1e-4) * curve)
    return e


def kick(dur=0.45, f0=150, f1=42, punch=0.9):
    n = int(dur * SR)
    t = t_of(n)
    f = f1 + (f0 - f1) * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * env(n, 0.001, 0.22)
    click = rng.standard_normal(n) * np.exp(-t * 400) * 0.3 * punch
    return np.tanh((s + click) * 1.6)


def snare(dur=0.3, tone=190, noise=0.8):
    n = int(dur * SR)
    t = t_of(n)
    body = np.sin(2 * np.pi * tone * t) * np.exp(-t * 30)
    nz = rng.standard_normal(n)
    nz = np.diff(np.concatenate([[0], nz]))  # brighter
    return (body * 0.6 + nz * noise * np.exp(-t * 18) * 0.5)


def clap(dur=0.35):
    n = int(dur * SR)
    t = t_of(n)
    nz = np.diff(np.concatenate([[0], rng.standard_normal(n)]))
    e = np.zeros(n)
    for k, off in enumerate([0, 0.011, 0.022]):
        i = int(off * SR)
        e[i:] += np.exp(-(t[: n - i]) * (60 if k < 2 else 14))
    return nz * e * 0.45


def hat(dur=0.06, open_=False):
    n = int((0.25 if open_ else dur) * SR)
    t = t_of(n)
    nz = rng.standard_normal(n)
    nz = np.diff(np.concatenate([[0], np.diff(np.concatenate([[0], nz]))]))
    return nz * np.exp(-t * (14 if open_ else 70)) * 0.12


def cowbell(freq, dur=0.32):
    """The phonk bell: two square-ish partials, a band of ring, fast decay."""
    n = int(dur * SR)
    t = t_of(n)
    sq = lambda f: np.tanh(np.sin(2 * np.pi * f * t) * 3)
    s = sq(freq) * 0.6 + sq(freq * 1.48) * 0.4
    return s * env(n, 0.001, 0.09) * 0.32


def bass808(freq, dur, glide_from=None, drive=2.2):
    n = int(dur * SR)
    t = t_of(n)
    f = np.full(n, float(freq))
    if glide_from:
        f = freq + (glide_from - freq) * np.exp(-t * 18)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * env(n, 0.003, dur * 0.9, 1.0)
    return np.tanh(s * drive) * 0.55


def pad(freqs, dur, bright=0.35):
    n = int(dur * SR)
    t = t_of(n)
    s = np.zeros(n)
    for f in freqs:
        for det in (-0.004, 0, 0.005):
            ff = f * (1 + det)
            # a soft saw: a few harmonics only
            for h in range(1, 6):
                s += np.sin(2 * np.pi * ff * h * t + h) / h * (bright ** (h - 1))
    a = np.minimum(1, t / 0.6) * np.minimum(1, (dur - t) / 0.5).clip(0, 1)
    return s / (len(freqs) * 3) * a * 0.5


def bell(freq, dur=1.2):
    n = int(dur * SR)
    t = t_of(n)
    s = np.sin(2 * np.pi * freq * t) + 0.4 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 4)
    return s * env(n, 0.002, 0.45) * 0.22


def rhodes(freqs, dur):
    n = int(dur * SR)
    t = t_of(n)
    s = np.zeros(n)
    for f in freqs:
        mod = np.sin(2 * np.pi * f * 1.0 * t) * 1.2 * np.exp(-t * 3)
        s += np.sin(2 * np.pi * f * t + mod)
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.5 * t)
    return s / len(freqs) * env(n, 0.004, 0.9) * trem * 0.32


def riser(dur):
    n = int(dur * SR)
    t = t_of(n)
    nz = rng.standard_normal(n)
    # a sweeping one-pole high-pass: brighter as it rises
    out = np.zeros(n)
    y = 0.0
    prev = 0.0
    for i in range(n):
        k = 0.02 + 0.9 * (i / n) ** 2
        y = (1 - k) * (y + nz[i] - prev)
        prev = nz[i]
        out[i] = y
    return out * (t / dur) ** 2 * 0.25


def reverb(x, secs=1.6, wet=0.3):
    n = int(secs * SR)
    t = t_of(n)
    ir = rng.standard_normal(n) * np.exp(-t * 4.0 / secs)
    ir[0] = 0
    # FFT convolution
    m = len(x) + n
    nfft = 1 << (m - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[: len(x)]
    y /= np.max(np.abs(y)) + 1e-9
    return x * (1 - wet) + y * wet * np.max(np.abs(x))


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


class Track:
    def __init__(self, bpm, beats):
        self.bpm = bpm
        self.beat = 60.0 / bpm
        self.n = int((beats * self.beat + 1.5) * SR)
        self.buf = np.zeros(self.n)

    def at(self, beat):
        return int(round(beat * self.beat * SR))

    def put(self, beat, sig, gain=1.0):
        i = self.at(beat)
        if i >= self.n:
            return
        j = min(self.n, i + len(sig))
        self.buf[i:j] += sig[: j - i] * gain

    def put_region(self, b0, b1, sig, gain=1.0):
        i, j = self.at(b0), min(self.n, self.at(b1))
        seg = np.zeros(j - i)
        seg[: min(len(sig), j - i)] = sig[: j - i]
        self.buf[i:j] += seg * gain


def note(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def finish(buf, name):
    buf = buf / (np.max(np.abs(buf)) + 1e-9) * 0.89
    # gentle fade at the end
    f = int(0.6 * SR)
    buf[-f:] *= np.linspace(1, 0, f)
    st = np.stack([buf, np.roll(buf, 9)], axis=1)  # a touch of width
    pcm = (st * 32767).astype(np.int16)
    wav = os.path.join(OUT, f"{name}.wav")
    import wave
    with wave.open(wav, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    mp3 = os.path.join(OUT, f"{name}.mp3")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-codec:a", "libmp3lame", "-b:a", "128k", mp3], check=True)
    os.remove(wav)
    print(name, f"{len(buf) / SR:.2f}s")


# ── 1. ICE (cold edit): 140 bpm, half-time phonk feel; build 16 beats, drop on 16, 32 after.
def ice():
    tr = Track(140, 48)
    D = 16
    # Build: filtered cowbell riff, kicks every 2 beats from beat 8, a riser into the drop.
    riff = [63, 66, 70, 68, 66, 63, 61, 63]  # Eb minor-ish
    for b in range(0, D):
        if b % 2 == 0:
            tr.put(b, lowpass(cowbell(note(riff[(b // 2) % 8] + 12)), 1800), 2.4)
        if b >= 8 and b % 2 == 0:
            tr.put(b, kick(punch=0.4), 0.5)
        if b >= 12:
            tr.put(b + 0.5, hat(), 0.8)
    tr.put_region(D - 4, D, riser(4 * tr.beat), 1.0)
    tr.put(D - 0.5, snare(), 0.6)  # pickup
    tr.put(D - 0.25, snare(), 0.7)
    # Drop: kick + 808 on 1, clap on 3 of each bar (half time), 16th hats, the bell riff on 8ths.
    bass = [39, 39, 42, 37]
    for bar in range(8):
        b0 = D + bar * 4
        tr.put(b0, kick(), 1.0)
        tr.put(b0 + 2.5, kick(punch=0.6), 0.7)
        tr.put(b0, bass808(note(bass[bar % 4]), 3.5 * tr.beat, glide_from=note(bass[bar % 4] + 12)), 1.0)
        tr.put(b0 + 2, clap(), 1.0)
        tr.put(b0 + 2, snare(noise=0.5), 0.5)
        for s in range(16):
            tr.put(b0 + s * 0.25, hat(), 0.8 if s % 2 == 0 else 0.45)
        for e in range(8):
            tr.put(b0 + e * 0.5, cowbell(note(riff[(e + bar) % 8] + 12)), 0.9 if e % 2 == 0 else 0.6)
    finish(tr.buf, "ice-140")


# ── 2. DRIFT (montage / angles): 150 bpm funk-style groove, build 16, drop 16, 32 after.
def drift():
    tr = Track(150, 48)
    D = 16
    for b in range(0, D):
        tr.put(b, hat(), 0.7)
        if b % 4 == 0:
            tr.put(b, lowpass(bass808(note(41), 0.5), 600), 0.6)
    tr.put_region(D - 4, D, riser(4 * tr.beat), 1.2)
    for k in range(4):
        tr.put(D - 1 + k * 0.25, snare(), 0.4 + k * 0.12)
    # The groove: kick on 1, the "and" of 2, 3 and the a of 4 (tamborzao-like), snare rolls.
    pat_k = [0, 1.5, 2.0, 3.25]
    pat_s = [1.0, 2.75, 3.5]
    bass = [41, 41, 44, 39]
    for bar in range(8):
        b0 = D + bar * 4
        for p in pat_k:
            tr.put(b0 + p, kick(dur=0.3, f0=180, f1=50), 0.95)
        for p in pat_s:
            tr.put(b0 + p, snare(tone=230, noise=0.9), 0.7)
        tr.put(b0, bass808(note(bass[bar % 4]), 1.6 * tr.beat, drive=3.5), 0.9)
        tr.put(b0 + 2, bass808(note(bass[bar % 4] + 7), 1.4 * tr.beat, drive=3.5), 0.7)
        for s in range(8):
            tr.put(b0 + s * 0.5, hat(), 0.6)
        # a stab on 1 and 3 (a bright fifth chord)
        for p in (0, 2.5):
            st = cowbell(note(bass[bar % 4] + 24), 0.2) + cowbell(note(bass[bar % 4] + 31), 0.2)
            tr.put(b0 + p, st, 0.6)
    finish(tr.buf, "drift-150")


# ── 3. HALO (aura edit): 80 bpm, pads and bells, swell into the drop on beat 16, 24 after.
def halo():
    tr = Track(80, 40)
    D = 16
    chords = [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62]]
    for i in range(10):
        c = chords[i % 4]
        b0 = i * 4
        tr.put(b0, pad([note(m) for m in c], 4 * tr.beat + 0.5, 0.3 if b0 < D else 0.5), 0.9 if b0 >= D else 0.55)
    tr.put_region(D - 4, D, riser(4 * tr.beat), 0.6)
    arp = [69, 72, 76, 79, 76, 72]
    for b in range(D, 40):
        tr.put(b, kick(dur=0.5, f0=110, f1=38, punch=0.2), 0.55 if b % 2 == 0 else 0.0)
        if b % 2 == 1:
            tr.put(b, snare(tone=160, noise=0.4), 0.35)
        for h in range(2):
            tr.put(b + h * 0.5, bell(note(arp[(b * 2 + h) % len(arp)])), 0.5)
    for b in range(0, D, 2):
        tr.put(b, bell(note(arp[b % len(arp)])), 0.35)
    tr.buf = reverb(tr.buf, 2.2, 0.35)
    finish(tr.buf, "halo-80")


# ── 4. TAPE (rewind / stat card): 96 bpm lo-fi boom-bap, crackle, keys; drop on 16, 24 after.
def tape():
    tr = Track(96, 40)
    D = 16
    chords = [[50, 53, 57, 60], [55, 58, 62, 65], [48, 52, 55, 58], [53, 57, 60, 64]]
    for i in range(10):
        tr.put(i * 4, rhodes([note(m) for m in chords[i % 4]], 3.8 * tr.beat), 0.8)
    for b in range(D, 40):
        bb = b % 4
        if b < D:
            continue
        if bb in (0,):
            tr.put(b, kick(dur=0.4, f0=120, f1=45, punch=0.5), 1.0)
        if bb == 2:
            tr.put(b + 0.5, kick(dur=0.4, f0=120, f1=45, punch=0.5), 0.7)
        if bb in (1, 3):
            tr.put(b, snare(tone=200, noise=0.7), 0.8)
        for h in range(2):
            tr.put(b + h * 0.5 + (0.04 if h else 0), hat(), 0.5)
    for b in range(8, D, 2):
        tr.put(b, kick(dur=0.4, f0=110, f1=45, punch=0.2), 0.45)
    # crackle all the way through
    n = tr.n
    cr = np.zeros(n)
    idx = rng.integers(0, n, size=int(n / SR * 30))
    cr[idx] = rng.standard_normal(len(idx)) * 0.5
    tr.buf += cr * 0.15 + lowpass(rng.standard_normal(n), 900) * 0.012
    tr.buf = lowpass(tr.buf, 7000)
    finish(tr.buf, "tape-96")


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    ice()
    drift()
    halo()
    tape()
