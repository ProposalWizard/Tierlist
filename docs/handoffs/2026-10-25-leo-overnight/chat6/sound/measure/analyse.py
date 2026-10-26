"""Loudness, peaks and sync of a reel soundtrack.
python3 -I analyse.py <dir> <goals>   (dir holds mix.wav, crowd.wav, music.wav, the saved video, ../plan.json)
"""
import json, subprocess, sys, glob, os, re
import numpy as np

d, n = sys.argv[1], sys.argv[2]
plan = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "plan.json")))[n]
R = 48000


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(R), "-"], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def ebur(path):
    p = subprocess.run(["ffmpeg", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    tail = p[p.rfind("Summary:"):]
    I = float(re.search(r"I:\s+(-?[\d.]+) LUFS", tail).group(1))
    LRA = float(re.search(r"LRA:\s+(-?[\d.]+) LU", tail).group(1))
    tp = float(re.search(r"Peak:\s+(-?[\d.inf]+) dBFS", tail).group(1))
    return I, LRA, tp


def db(x):
    return 20 * np.log10(max(1e-9, x))


def rms(x, a, b):
    s = x[int(a * R):int(b * R)]
    return db(np.sqrt(np.mean(s.astype(np.float64) ** 2))) if len(s) else float("nan")


def env(x, hop=0.005, win=0.01):
    m = x.mean(axis=1)
    h, w = int(hop * R), int(win * R)
    k = (len(m) - w) // h
    e = np.array([np.sqrt(np.mean(m[i * h:i * h + w] ** 2)) for i in range(k)])
    return e


def onset(e, t, before=0.12, after=0.3, hop=0.005):
    """Time (s) of the biggest rise in level (dB, 20 ms step) near t."""
    i0, i1 = int((t - before) / hop), int((t + after) / hop)
    edb = 20 * np.log10(np.maximum(e, 1e-6))
    rise = edb[i0 + 4:i1 + 4] - edb[i0:i1]
    j = int(np.argmax(rise))
    return (i0 + j + 4) * hop, float(rise[j])


out = {}
files = {k: os.path.join(d, k + ".wav") for k in ("mix", "crowd", "music")}
vids = [f for f in glob.glob(os.path.join(d, "Season-*")) if not f.endswith(".wav")]
if vids:
    files["file"] = vids[0]
A = {k: load(v) for k, v in files.items() if os.path.exists(v)}
segs = plan["segs"]

# Loudness
print("== loudness")
for k in ("mix", "file"):
    if k not in A:
        continue
    I, LRA, tp = ebur(files[k])
    x = A[k]
    clip = int((np.abs(x) >= 0.99).sum())
    print(f"{k}: I {I:.1f} LUFS, LRA {LRA:.1f}, true peak {tp:.1f} dBTP, sample peak {db(np.abs(x).max()):.2f} dBFS, samples>=0.99: {clip}")
    out[k] = dict(I=I, LRA=LRA, tp=tp, clip=clip)

# Per section
print("== RMS per section (dB): mix | crowd | music")
rows = []
for s in segs:
    a, b = s["at"], s["at"] + s["dur"]
    label = s["kind"] + (" q" if s["quick"] else "")
    r = [rms(A[k], a, b) if k in A else float("nan") for k in ("mix", "crowd", "music")]
    rows.append((label, a, *r))
for kind in ("title", "goal", "goal q", "bestIntro", "best", "end"):
    rr = [r for r in rows if r[0] == kind]
    if rr:
        m = np.array([r[2:] for r in rr])
        print(f"{kind:9s} x{len(rr):2d}: mix {m[:,0].mean():6.1f} (min {m[:,0].min():.1f} max {m[:,0].max():.1f}) crowd {m[:,1].mean():6.1f} music {m[:,2].mean():6.1f}")

# Crowd over music at each goal: the second after the ball goes in.
print("== crowd minus music, 0..1 s after each goal (dB)")
gaps = []
for r in plan["rows"]:
    if r["replay"]:
        continue
    t = r["screen"]
    gaps.append(rms(A["crowd"], t, t + 1) - rms(A["music"], t, t + 1))
    r["gap"] = round(gaps[-1], 1)
print("per goal:", " ".join(f"{r['n']}{'q' if r['quick'] else ''}:{r.get('gap')}" for r in plan["rows"] if not r["replay"]))
gaps = np.array(gaps)
print(f"mean {gaps.mean():.1f} min {gaps.min():.1f} max {gaps.max():.1f}")
g35 = np.array([rms(A["crowd"], r["screen"], r["screen"] + 0.35) - rms(A["music"], r["screen"], r["screen"] + 0.35) for r in plan["rows"] if not r["replay"]])
qk = np.array([not r["replay"] and r["quick"] for r in plan["rows"] if not r["replay"]])
print(f"0..0.35 s after each goal (to the quick clip's cut): full goals mean {g35[~qk].mean():.1f} (min {g35[~qk].min():.1f})" + (f", quick-fire mean {g35[qk].mean():.1f} (min {g35[qk].min():.1f})" if qk.any() else ""))
if qk.any():
    print(f"0..1 s: full goals mean {gaps[~qk].mean():.1f} (min {gaps[~qk].min():.1f}), quick-fire mean {gaps[qk].mean():.1f} (min {gaps[qk].min():.1f})")
out["crowdOverMusic"] = dict(mean=float(gaps.mean()), min=float(gaps.min()), max=float(gaps.max()))
# Music on the cards
for kind in ("title", "end"):
    s = [x for x in segs if x["kind"] == kind][0]
    print(f"music on {kind}: {rms(A['music'], s['at'], s['at'] + s['dur']):.1f} dB, mix {rms(A['mix'], s['at'], s['at'] + s['dur']):.1f} dB")

# Sync: onset in the crowd stem and in the mix near each on-screen goal
print("== sync: biggest level rise near each on-screen goal moment (ms, + = sound late)")
E = {k: env(A[k]) for k in ("mix", "crowd") if k in A}
res = []
for r in plan["rows"]:
    t = r["screen"]
    oc, rc = onset(E["crowd"], t)
    om, rm = onset(E["mix"], t)
    res.append(dict(n=r["n"], kind=r["kind"], quick=r["quick"], replay=r["replay"], crowd=round((oc - t) * 1000), mix=round((om - t) * 1000), rise=round(rm, 1)))
for x in res:
    print(x)
# The net sound, found by matching the goal-net sample in the crowd stem
# (and in the full mix) around each on-screen goal moment.
here = os.path.dirname(os.path.abspath(__file__))
net = load(os.path.join("public", "sfx", "goal-net.mp3")).mean(axis=1)[: int(0.25 * R)]


def find(sig, tmpl, t, rate):
    if rate != 1:
        idx = np.arange(0, len(tmpl) - 1, rate)
        tmpl = np.interp(idx, np.arange(len(tmpl)), tmpl)
    a0 = int((t - 0.25) * R)
    w = sig[a0:a0 + int(0.6 * R) + len(tmpl)]
    best, bl = -1, 0
    tn = tmpl / np.linalg.norm(tmpl)
    for lag in range(0, int(0.6 * R), 24):
        y = w[lag:lag + len(tmpl)]
        c = float(np.dot(y, tn)) / (np.linalg.norm(y) + 1e-9)
        if c > best:
            best, bl = c, lag
    return (a0 + bl) / R - t, best


for x, r in zip(res, plan["rows"]):
    rate = 0.6 if r["replay"] else 1
    o, c = find(A["crowd"].mean(axis=1), net, r["screen"], rate)
    om, cm = find(A["mix"].mean(axis=1), net, r["screen"], rate)
    x["net"], x["netCorr"], x["netMix"], x["netMixCorr"] = round(o * 1000), round(c, 2), round(om * 1000), round(cm, 2)
neto = np.array([x["net"] for x in res])
netm = np.array([x["netMix"] for x in res])
print("net sound vs on-screen goal (ms):", " ".join(f"{x['n']}{'q' if x['quick'] else ''}{'r' if x['replay'] else ''}:{x['net']}/{x['netMix']}" for x in res))
print(f"net offsets crowd stem: max |.| {np.abs(neto).max():.0f} ms; in the mix: max |.| {np.abs(netm).max():.0f} ms, over 80 ms: {(np.abs(netm) > 80).sum()}")
mixo = np.array([x["mix"] for x in res])
print(f"mix onset offsets: mean {mixo.mean():.0f} ms, max |.| {np.abs(mixo).max():.0f} ms, over 80 ms: {(np.abs(mixo) > 80).sum()}")
out["sync"] = res

# The saved file against the mix: one global offset (codec delay).
if "file" in A:
    a, b = A["mix"].mean(axis=1), A["file"].mean(axis=1)
    L = min(len(a), len(b))
    seg = slice(int(5 * R), int(25 * R))
    best, bl = -1e9, 0
    for lag in range(-4800, 4801, 24):
        x = a[seg]
        y = b[seg.start + lag:seg.stop + lag]
        c = float(np.dot(x, y))
        if c > best:
            best, bl = c, lag
    # refine
    for lag in range(bl - 24, bl + 25):
        x = a[seg]; y = b[seg.start + lag:seg.stop + lag]
        c = float(np.dot(x, y))
        if c > best:
            best, bl = c, lag
    print(f"== file audio vs mix: file is {bl / R * 1000:+.1f} ms (+ = file late); file len {len(b)/R:.3f}s mix len {len(a)/R:.3f}s")
    out["fileLagMs"] = bl / R * 1000
    vs = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,start_time,duration", "-of", "compact", files["file"]], capture_output=True, text=True).stdout
    print(vs.strip())
    print("size", os.path.getsize(files["file"]))
json.dump(out, open(os.path.join(d, "analysis.json"), "w"), indent=1, default=float)
