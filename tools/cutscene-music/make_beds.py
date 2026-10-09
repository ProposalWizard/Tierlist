"""Cut-scene music beds, made from code (no samples, no other people's music).

Harry, 9 Oct 2026: "do a pass of camera angles in the cut scenes ... music".
Five short instrumental beds, one per kind of scene, written as notes here and
played by a tiny synthesiser (numpy): piano, warm strings, soft brass,
timpani, toms, a low drone. Every file loops: the tail is folded back onto the
start, so the end runs straight into the beginning.

    python3 tools/cutscene-music/make_beds.py            # all five
    python3 tools/cutscene-music/make_beds.py trophy     # one

Writes public/sfx/cut-music-<name>.mp3 (MP3, 96 kbit/s stereo, about 20-24 s,
250-300 KB). They are on the Sound Board (lib/star/sfxCatalog.ts), so an admin
can swap any of them for a better take without a deploy. Licence: written for
Knowitball from scratch; see public/sfx/CUTSCENE-MUSIC-LICENSE.txt.

Needs: python3, numpy, scipy, av (PyAV, with libmp3lame).
"""
import os, sys
import numpy as np
from scipy.signal import lfilter
import av

SR = 44100
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
rng = np.random.default_rng(9)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env(n, a, d, s, r, sr=SR):
    """Attack / decay / sustain level / release (seconds), n samples long."""
    t = np.arange(n) / sr
    e = np.ones(n) * s
    A, D, R = max(1, int(a * sr)), max(1, int(d * sr)), max(1, int(r * sr))
    e[:A] = np.linspace(0, 1, A)[: len(e[:A])]
    dd = e[A : A + D]
    e[A : A + D] = np.linspace(1, s, D)[: len(dd)]
    if R < n:
        e[-R:] *= np.linspace(1, 0, R)
    return e


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    return lfilter([1 - a], [1, -a], x)


def saw(f, n, phase=0.0):
    t = np.arange(n) / SR
    return 2 * ((f * t + phase) % 1.0) - 1


def piano(m, dur, vel=0.6):
    n = int((dur + 1.5) * SR)
    t = np.arange(n) / SR
    f = hz(m)
    x = np.zeros(n)
    for k in range(1, 8):
        fk = f * k * (1 + 0.0004 * k * k)
        x += np.sin(2 * np.pi * fk * t) * (1 / k ** 1.4) * np.exp(-t * (1.2 + 0.9 * k) * (0.5 + f / 900))
    x += rng.standard_normal(n) * np.exp(-t * 90) * 0.04  # the hammer
    rel = np.ones(n)
    off = int(dur * SR)
    if off < n:
        rel[off:] = np.exp(-np.arange(n - off) / SR * 6)
    return x * rel * vel * 0.35


def strings(m, dur, vel=0.5, bright=2600):
    n = int((dur + 1.2) * SR)
    t = np.arange(n) / SR
    f = hz(m)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t + m)
    x = np.zeros(n)
    for det in (-0.006, 0.0, 0.007):
        ph = np.cumsum(f * (1 + det) * vib) / SR
        x += 2 * (ph % 1.0) - 1
    x = lowpass(lowpass(x, bright), bright * 1.4)
    return x * env(n, 0.45, 0.3, 0.85, 1.1) * vel * 0.12


def brass(m, dur, vel=0.6):
    n = int((dur + 0.6) * SR)
    t = np.arange(n) / SR
    f = hz(m)
    x = saw(f, n) + 0.6 * saw(f * 1.003, n, 0.3)
    # the filter opens on the attack (the "blat"), then settles
    cut = 900 + 2600 * np.exp(-t * 6)
    y = np.zeros(n)
    y_prev = 0.0
    a = np.exp(-2 * np.pi * cut / SR)
    for i in range(0, n, 256):  # block-wise one-pole with a moving cutoff
        j = min(n, i + 256)
        aa = a[i]
        seg, _ = lfilter([1 - aa], [1, -aa], x[i:j], zi=[aa * y_prev])
        y[i:j] = seg
        y_prev = seg[-1]
    return lowpass(y, 3200) * env(n, 0.06, 0.25, 0.75, 0.5) * vel * 0.16


def bass(m, dur, vel=0.6):
    n = int((dur + 0.4) * SR)
    t = np.arange(n) / SR
    f = hz(m)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    return x * env(n, 0.02, 0.3, 0.7, 0.35) * vel * 0.33


def timpani(m, vel=0.8):
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    f = hz(m) * (1 + 0.08 * np.exp(-t * 20))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.4 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * np.exp(-t * 4)
    x += lowpass(rng.standard_normal(n), 900) * np.exp(-t * 25) * 0.8
    return x * np.exp(-t * 2.4) * vel * 0.4


def tom(m, vel=0.6):
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    f = hz(m) * (1 + 0.6 * np.exp(-t * 30))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) + lowpass(rng.standard_normal(n), 2000) * np.exp(-t * 60) * 0.5
    return x * np.exp(-t * 7) * vel * 0.4


def swell(dur, vel=0.4):
    """A cymbal swell (filtered noise rising, then a soft crash)."""
    n = int((dur + 2.0) * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    hi = noise - lowpass(noise, 5000)
    rise = np.clip(t / dur, 0, 1) ** 2
    rise[int(dur * SR):] = np.exp(-(t[int(dur * SR):] - dur) * 2.2)
    return hi * rise * vel * 0.18


def pulse(m, vel=0.4):
    """A short muted pluck (the ticking clock)."""
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    x = lowpass(saw(hz(m), n), 1200) * np.exp(-t * 18)
    return x * vel * 0.3


def comb(x, d, g):
    """y[n] = x[n-d] + g*y[n-d], a block of d samples at a time."""
    y = np.zeros(len(x) + d)
    for i in range(d, len(x) + d, d):
        j = min(len(y), i + d)
        y[i:j] = x[i - d : j - d] + g * y[i - d : j - d]
    return y[: len(x)]


def allpass(x, d, g):
    """y[n] = -g*x[n] + x[n-d] + g*y[n-d]."""
    y = np.zeros(len(x))
    xp = np.concatenate([np.zeros(d), x])
    for i in range(0, len(x), d):
        j = min(len(x), i + d)
        prev = y[i - d : j - d] if i >= d else np.zeros(j - i)
        y[i:j] = -g * x[i:j] + xp[i:j] + g * prev
    return y


def reverb(x, mix=0.25, size=1.0):
    out = np.zeros_like(x)
    for d, g in ((1557, 0.84), (1617, 0.83), (1491, 0.85), (1422, 0.86), (1277, 0.84), (1356, 0.83)):
        out += comb(x, int(d * size), g)
    out /= 6
    for d, g in ((225, 0.5), (556, 0.5), (441, 0.5)):
        out = allpass(out, d, g)
    return x * (1 - mix) + lowpass(out, 6500) * mix * 1.6


class Track:
    def __init__(self, seconds, tail=4.0):
        self.L = int(seconds * SR)
        self.n = self.L + int(tail * SR)
        self.l = np.zeros(self.n)
        self.r = np.zeros(self.n)

    def add(self, sig, at, pan=0.0, gain=1.0):
        i = int(at * SR)
        if i >= self.n:
            return
        j = min(self.n, i + len(sig))
        s = sig[: j - i] * gain
        self.l[i:j] += s * np.sqrt(0.5 * (1 - pan))
        self.r[i:j] += s * np.sqrt(0.5 * (1 + pan))

    def render(self, rev=0.25, size=1.0):
        l, r = reverb(self.l, rev, size), reverb(self.r, rev, size * 1.03)
        # loop: fold the tail onto the start, so the end runs into the beginning
        T = self.n - self.L
        l[:T] += l[self.L :]
        r[:T] += r[self.L :]
        st = np.stack([l[: self.L], r[: self.L]])
        st /= max(1e-6, np.max(np.abs(st))) / 0.89
        return st


def chord_tones(root, kind):
    iv = {"maj": [0, 4, 7], "min": [0, 3, 7], "sus": [0, 5, 7], "maj7": [0, 4, 7, 11], "add9": [0, 4, 7, 14]}[kind]
    return [root + i for i in iv]


# ── the five beds ─────────────────────────────────────────────────────────

def signing():
    """Warm and hopeful: C major, 80 bpm, piano arpeggios over soft strings."""
    bar = 3.0
    prog = [(48, "add9"), (43, "maj"), (45, "min"), (41, "maj7"), (48, "maj"), (43, "sus"), (41, "maj"), (43, "maj")]
    tr = Track(bar * len(prog))
    melody = [(76, 0, 1.5), (74, 1.5, 0.75), (72, 2.25, 0.75), (71, 3, 1.5), (74, 4.5, 1.5), (72, 6, 3), (69, 9, 1.5), (71, 10.5, 1.5)]
    for b, (root, kind) in enumerate(prog):
        t0 = b * bar
        tones = chord_tones(root + 12, kind)
        for m in tones:
            tr.add(strings(m + 12, bar, 0.35), t0, pan=(m % 5 - 2) * 0.15)
        tr.add(bass(root - 12, bar * 0.95, 0.55), t0)
        arp = [tones[0], tones[1], tones[2], tones[0] + 12, tones[2], tones[1]]
        for k in range(8):
            tr.add(piano(arp[k % len(arp)] + 12, 0.45, 0.45 + 0.1 * (k == 0)), t0 + k * bar / 8, pan=0.25 if k % 2 else -0.2)
        if b >= 4:
            for (m, s, d) in melody:
                if (b - 4) * 4 <= s < (b - 3) * 4:
                    tr.add(piano(m + 12, d * bar / 4 * 0.9, 0.55), (4 * bar) + s * bar / 4, pan=0.05)
    return tr.render(0.3)


def trophy():
    """Triumphant: D major, 100 bpm, brass chords, strings and timpani."""
    bar = 2.4
    prog = [(50, "maj"), (55, "maj"), (57, "maj"), (50, "maj"), (59, "min"), (55, "maj"), (57, "sus"), (57, "maj"), (50, "maj")]
    tr = Track(bar * len(prog))
    for b, (root, kind) in enumerate(prog):
        t0 = b * bar
        tones = chord_tones(root, kind)
        for m in tones:
            tr.add(brass(m, bar * 0.48, 0.65), t0, pan=(m % 3 - 1) * 0.3)
            tr.add(brass(m, bar * 0.22, 0.5), t0 + bar * 0.5)
            tr.add(brass(m, bar * 0.22, 0.55), t0 + bar * 0.75)
            tr.add(strings(m + 12, bar, 0.4, 3600), t0, pan=-(m % 3 - 1) * 0.3)
        tr.add(bass(root - 24, bar * 0.9, 0.7), t0)
        tr.add(timpani(root - 12, 0.9), t0)
        tr.add(timpani(root - 17, 0.6), t0 + bar * 0.5)
        for k in range(8):  # a bright string run on top
            tr.add(piano(tones[k % 3] + 24, 0.2, 0.25), t0 + k * bar / 8, pan=0.4 if k % 2 else -0.4)
        if b % 4 == 3:
            tr.add(swell(bar * 0.9, 0.5), t0 + bar * 0.1)
    return tr.render(0.32, 1.2)


def walkout():
    """Building tension into an anthem: D minor, 110 bpm, ostinato, toms, brass."""
    bar = 60 / 110 * 4
    prog = [(50, "min"), (50, "min"), (46, "maj"), (46, "maj"), (53, "maj"), (48, "maj"), (50, "min"), (46, "maj"), (53, "maj"), (48, "maj")]
    tr = Track(bar * len(prog))
    for b, (root, kind) in enumerate(prog):
        t0 = b * bar
        build = b / (len(prog) - 1)
        tones = chord_tones(root, kind)
        for k in range(8):  # the low ostinato
            tr.add(pulse(38 + (7 if k % 4 == 3 else 0), 0.55 + 0.25 * build), t0 + k * bar / 8, pan=-0.1)
        for k in range(4):  # the toms get louder
            tr.add(tom(38 if k % 2 == 0 else 43, 0.3 + 0.55 * build), t0 + k * bar / 4)
        for m in tones:
            tr.add(strings(m, bar, 0.25 + 0.35 * build, 1600 + 2600 * build), t0, pan=(m % 3 - 1) * 0.35)
        tr.add(bass(root - 12, bar * 0.95, 0.5 + 0.3 * build), t0)
        if b >= 6:  # the anthem: brass on top
            for m in tones:
                tr.add(brass(m + 12, bar * 0.9, 0.6), t0, pan=(m % 3 - 1) * 0.3)
            tr.add(timpani(38, 0.8), t0)
        if b == len(prog) - 2:
            tr.add(swell(bar * 1.6, 0.55), t0 + bar * 0.4)
    return tr.render(0.24)


def press():
    """Low tension: A minor, 70 bpm, a drone, a ticking pulse, a few cold notes."""
    beat = 60 / 70
    bar = beat * 4
    bars = 6
    tr = Track(bar * bars)
    for b in range(bars):
        t0 = b * bar
        root = 45 if b % 3 != 2 else 41
        for m in (root, root + 7, root + 12):
            tr.add(strings(m, bar, 0.32, 900), t0, pan=(m % 3 - 1) * 0.3)
        for k in range(4):
            tr.add(pulse(57, 0.32 if k else 0.45), t0 + k * beat, pan=0.3)
            tr.add(pulse(57, 0.16), t0 + k * beat + beat * 0.5, pan=0.3)
        tr.add(bass(root - 12, bar * 0.95, 0.45), t0)
    for (m, at) in ((76, 1.3), (77, 4.6), (72, 8.5), (71, 12.0), (76, 15.4), (74, 18.4)):
        tr.add(piano(m, 1.2, 0.3), at, pan=-0.3)
    return tr.render(0.33, 1.1)


def farewell():
    """Emotional: F major, 66 bpm, slow piano and warm strings, a simple tune."""
    bar = 60 / 66 * 4
    prog = [(50, "min"), (46, "maj"), (53, "maj"), (48, "sus"), (50, "min"), (46, "maj7")]
    tr = Track(bar * len(prog))
    tune = [(69, 0, 2), (67, 2, 1), (65, 3, 1), (65, 4, 3), (62, 7, 1), (64, 8, 2), (65, 10, 2), (67, 12, 4), (69, 16, 2), (72, 18, 2), (70, 20, 4)]
    for b, (root, kind) in enumerate(prog):
        t0 = b * bar
        tones = chord_tones(root, kind)
        for m in tones:
            tr.add(strings(m + 12, bar, 0.42, 2000), t0, pan=(m % 3 - 1) * 0.35)
        tr.add(bass(root - 12, bar, 0.5), t0)
        arp = [tones[0] - 12, tones[2] - 12, tones[0], tones[1], tones[2], tones[1]]
        for k in range(6):
            tr.add(piano(arp[k], 0.9, 0.35), t0 + k * bar / 6, pan=-0.25)
    beat = bar / 4
    for (m, s, d) in tune:
        tr.add(piano(m + 12, d * beat * 0.95, 0.6), s * beat, pan=0.15)
        tr.add(strings(m + 12, d * beat, 0.25, 2600), s * beat + 0.05, pan=0.15)
    return tr.render(0.36, 1.25)


BEDS = {"signing": signing, "trophy": trophy, "walkout": walkout, "press": press, "farewell": farewell}


def write_mp3(path, st):
    o = av.open(path, "w")
    s = o.add_stream("libmp3lame", rate=SR)
    s.bit_rate = 96000
    s.layout = "stereo"
    pcm = (np.clip(st, -1, 1)).astype(np.float32)
    for i in range(0, pcm.shape[1], 1152):
        fr = av.AudioFrame.from_ndarray(np.ascontiguousarray(pcm[:, i : i + 1152]), format="fltp", layout="stereo")
        fr.sample_rate = SR
        for p in s.encode(fr):
            o.mux(p)
    for p in s.encode(None):
        o.mux(p)
    o.close()


if __name__ == "__main__":
    names = sys.argv[1:] or list(BEDS)
    for name in names:
        st = BEDS[name]()
        path = os.path.join(ROOT, "public", "sfx", f"cut-music-{name}.mp3")
        write_mp3(path, st)
        print(f"{name}: {st.shape[1] / SR:.1f} s, {os.path.getsize(path) / 1024:.0f} KB -> {os.path.relpath(path, ROOT)}")
