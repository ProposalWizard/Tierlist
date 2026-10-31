"""Makes a dry voice sound like it came out of a TV commentary box.

    y = broadcast(x, sr, heat=0.6)

1. Low cut at 90 Hz (no rumble, no proximity boom).
2. A small dip at 300 Hz (less "boxy"), a presence lift at 3.5 kHz and a
   little air at 10 kHz: the lip-mic sound of a commentary position.
3. A compressor (3:1, quick attack) and a soft "hot mic" saturation that
   grows with `heat` (0 calm co-commentator .. 1 screaming goal call).
4. A touch of room: a short, dull reflection tail, ~7 % wet.
5. Peak at -1 dBFS.

numpy + scipy only. Pure function: the same input gives the same output.
"""
import numpy as np
from scipy.signal import butter, sosfilt, lfilter


def _peaking(f0, gain_db, q, sr):
    a = 10 ** (gain_db / 40); w = 2 * np.pi * f0 / sr; al = np.sin(w) / (2 * q)
    b = [1 + al * a, -2 * np.cos(w), 1 - al * a]; den = [1 + al / a, -2 * np.cos(w), 1 - al / a]
    return np.array(b) / den[0], np.array(den) / den[0]


def _shelf_high(f0, gain_db, sr):
    a = 10 ** (gain_db / 40); w = 2 * np.pi * f0 / sr; al = np.sin(w) / 2 * np.sqrt(2)
    c = np.cos(w)
    b = [a * ((a + 1) + (a - 1) * c + 2 * np.sqrt(a) * al), -2 * a * ((a - 1) + (a + 1) * c), a * ((a + 1) + (a - 1) * c - 2 * np.sqrt(a) * al)]
    d = [(a + 1) - (a - 1) * c + 2 * np.sqrt(a) * al, 2 * ((a - 1) - (a + 1) * c), (a + 1) - (a - 1) * c - 2 * np.sqrt(a) * al]
    return np.array(b) / d[0], np.array(d) / d[0]


def _compress(x, sr, thr_db=-22.0, ratio=3.0, att=0.004, rel=0.09):
    env = np.abs(x)
    ga, gr = np.exp(-1 / (att * sr)), np.exp(-1 / (rel * sr))
    e = np.zeros_like(env); v = 0.0
    for i, s in enumerate(env):  # peak follower
        v = ga * v + (1 - ga) * s if s > v else gr * v + (1 - gr) * s
        e[i] = v
    db = 20 * np.log10(np.maximum(e, 1e-6))
    over = np.maximum(0, db - thr_db)
    gain = 10 ** (-(over - over / ratio) / 20)
    return x * gain


def _room(x, sr, wet=0.07):
    rng = np.random.default_rng(7)
    n = int(0.22 * sr)
    t = np.arange(n) / sr
    ir = rng.standard_normal(n) * np.exp(-t / 0.05)
    ir = sosfilt(butter(2, 3500, "low", fs=sr, output="sos"), ir)
    ir[: int(0.008 * sr)] = 0  # first reflection after 8 ms
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    wetsig = np.convolve(x, ir)[: len(x)]
    return (1 - wet) * x + wet * wetsig


def broadcast(x: np.ndarray, sr: int, heat: float = 0.5) -> np.ndarray:
    x = np.asarray(x, dtype=np.float64)
    x = x / (np.abs(x).max() + 1e-9) * 0.5
    x = sosfilt(butter(2, 90, "high", fs=sr, output="sos"), x)
    for b, a in (_peaking(300, -2.0, 1.0, sr), _peaking(3500, 3.5, 0.8, sr), _shelf_high(10000, 1.5, sr)):
        x = lfilter(b, a, x)
    x = _compress(x, sr)
    x = x / (np.abs(x).max() + 1e-9)
    drive = 1.0 + 1.6 * heat
    x = np.tanh(drive * x) / np.tanh(drive)
    x = _room(x, sr)
    x = x / (np.abs(x).max() + 1e-9) * 0.89  # -1 dBFS
    return x.astype(np.float32)
