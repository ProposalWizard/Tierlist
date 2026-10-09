#!/usr/bin/env python3
"""scripts/look-tuner/score.py — how far a game frame's LOOK is from the benchmark pictures (lower = closer).

Not "is it the same picture" (it never is): does it have the same colours, brightness, contrast, grass and
detail. The parts, each scaled so ~1 means "clearly different":
    hist    the colours overall: distance between the two pictures' colour spreads (Lab, per channel)
    hist3   the colours together: a 6x6x6 colour histogram, chi-squared
    grass   the grass's own colour (mean Lab of the green pixels) and its stripe contrast
    tone    brightness (mean L), contrast (spread of L), colourfulness (mean chroma)
    detail  edge density (mean gradient of L): how crisp/busy the picture reads
Use:
    python3 score.py frame.jpg [frame2.jpg ...]            # one score per frame
    python3 score.py --serve                               # read frame paths on stdin, one JSON line back each
The benchmark set and its crops are in BENCH below (the HUD and menus cut off).
"""
import json, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
# The benchmark pictures are NOT in the repo: they show real brands' boards (colour reference only, never an
# asset). Point LOOK_BENCH at the folder that holds them.
BENCH_DIR = os.environ.get("LOOK_BENCH", os.path.join(HERE, "bench"))
# (file, crop box l,t,r,b in that picture's pixels, weight)
BENCH = {
    "match": [("r2-h-match.jpg", (0, 182, 720, 955), 1.0)],
    "freeroam": [("r2-h-freeroam.jpg", (0, 400, 720, 1165), 1.0)],
}
# the game frame is cut the same way: below the stands and boards, like the benchmark crop (fractions l,t,r,b)
FRAME_CROP = {"match": (0, 0.19, 1, 1), "freeroam": (0, 0, 1, 1)}
W = 240
WEIGHTS = {"hist": 1.0, "hist3": 0.3, "grass": 1.2, "tone": 1.0, "detail": 0.5, "texture": 0.8}
# The 9 Oct review (Harry's side): the reference grass READS neutral-to-cool, deep and contrasty, though its pixels
# measure olive. So the grass is judged on lightness, colourfulness and "never yellower than a 128 degree hue",
# not on its exact hue; contrast only counts against us when it is LOWER than the reference's.
GRASS_HUE_MIN = 128.0
# The second review ("darker and muddier than the reference ... flat, saturated cartoon green"): the reference
# READS brighter in the mids and its grass less colourful than its pixels average out to, so the targets
# carry that: +4 lightness, grass colourfulness x0.8. "texture" = fine light-dark detail inside the grass
# (blades, mowing stripes), counted only when ours has LESS than the reference.
REVIEW = {"meanL": 4.0, "grassChroma": 0.8}


def srgb_to_lab(rgb):
    c = rgb.astype(np.float64) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], -1)


def load(path, box=None, frac=None):
    im = Image.open(path).convert("RGB")
    if frac:
        box = (round(frac[0] * im.width), round(frac[1] * im.height), round(frac[2] * im.width), round(frac[3] * im.height))
    if box:
        im = im.crop(box)
    h = round(im.height * W / im.width)
    return np.asarray(im.resize((W, h), Image.BILINEAR))


def grass_texture(L, grass):
    """The grass's fine detail: how far each pixel's lightness sits from its 5x5 neighbourhood's (blades, stripes)."""
    if grass.mean() < 0.02:
        return 1.0
    p = np.pad(L, 2, mode="edge")
    k = sum(p[i:i + L.shape[0], j:j + L.shape[1]] for i in range(5) for j in range(5)) / 25.0
    return float(np.abs(L - k)[grass].mean())


def feats(rgb):
    lab = srgb_to_lab(rgb)
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    grass = (a < -6) & (L > 12) & (b > -5)
    gy, gx = np.gradient(L)
    chroma = np.hypot(a, b)
    q = np.linspace(0, 100, 41)
    return {
        "lab": lab.reshape(-1, 3),
        "qL": np.percentile(L, q), "qa": np.percentile(a, q), "qb": np.percentile(b, q),
        "grass": lab[grass].mean(0) if grass.mean() > 0.02 else np.array([40.0, -30.0, 25.0]),
        "grassStd": float(L[grass].std()) if grass.mean() > 0.02 else 5.0,
        "grassFrac": float(grass.mean()),
        "meanL": float(L.mean()), "stdL": float(L.std()), "chroma": float(chroma.mean()),
        "edge": float(np.hypot(gx, gy).mean()),
        "texture": grass_texture(L, grass),
    }


def hist3(lab):
    rng = [(0, 100), (-60, 40), (-30, 70)]
    h, _ = np.histogramdd(lab, bins=6, range=rng)
    return h.ravel() / max(1, h.sum())


def compare(f, t):
    parts = {}
    parts["hist"] = float(np.mean(np.abs(f["qL"] - t["qL"])) / 12 + 0.5 * np.mean(np.abs(f["qa"] - t["qa"])) / 8 + 0.5 * np.mean(np.abs(f["qb"] - t["qb"])) / 8) / 2
    hf, ht = hist3(f["lab"]), hist3(t["lab"])
    parts["hist3"] = float(0.5 * np.sum((hf - ht) ** 2 / (hf + ht + 1e-9))) * 2
    dg = f["grass"] - t["grass"]
    hue = np.degrees(np.arctan2(f["grass"][2], f["grass"][1]))
    cf, ct = np.hypot(*f["grass"][1:]), np.hypot(*t["grass"][1:]) * REVIEW["grassChroma"]
    parts["grass"] = float(abs(dg[0]) / 8 + abs(cf - ct) / 8 + max(0.0, GRASS_HUE_MIN - hue) / 6 + max(0.0, np.log((t["grassStd"] + 0.5) / (f["grassStd"] + 0.5))))
    parts["tone"] = float(abs(f["meanL"] - t["meanL"] - REVIEW["meanL"]) / 8 + max(0.0, np.log((t["stdL"] + 1) / (f["stdL"] + 1))) / 0.25 + abs(np.log((f["chroma"] + 1) / (t["chroma"] + 1))) / 0.25) / 3
    parts["detail"] = float(abs(np.log((f["edge"] + 0.05) / (t["edge"] + 0.05))) / 0.4)
    parts["texture"] = float(max(0.0, np.log((t["texture"] + 0.05) / (f["texture"] + 0.05))) / 0.3)
    total = sum(WEIGHTS[k] * v for k, v in parts.items())
    return total, parts


_bench = {}


def bench(kind):
    if kind not in _bench:
        _bench[kind] = [(feats(load(os.path.join(BENCH_DIR, fn), box)), w) for fn, box, w in BENCH[kind]]
    return _bench[kind]


def score(path, kind="match"):
    f = feats(load(path, frac=FRAME_CROP.get(kind)))
    tot, parts, wsum = 0.0, {k: 0.0 for k in WEIGHTS}, 0.0
    for t, w in bench(kind):
        s, p = compare(f, t)
        tot += s * w; wsum += w
        for k in p:
            parts[k] += p[k] * w
    return {"score": round(tot / wsum, 4), "parts": {k: round(v / wsum, 4) for k, v in parts.items()},
            "stats": {"meanL": round(f["meanL"], 1), "stdL": round(f["stdL"], 1), "chroma": round(f["chroma"], 1), "edge": round(f["edge"], 2), "texture": round(f["texture"], 2), "grass": [round(x, 1) for x in f["grass"]]}}


if __name__ == "__main__":
    kind = os.environ.get("LOOK_KIND", "match")
    if "--serve" in sys.argv:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                print(json.dumps(score(line, kind)), flush=True)
            except Exception as e:  # keep serving
                print(json.dumps({"error": str(e)}), flush=True)
    else:
        if "--bench" in sys.argv:
            for fn, box, _ in BENCH[kind]:
                t = feats(load(os.path.join(BENCH_DIR, fn), box))
                print(fn, {k: (round(v, 2) if isinstance(v, float) else None) for k, v in t.items() if isinstance(v, float)}, [round(x, 1) for x in t["grass"]])
        for p in [a for a in sys.argv[1:] if not a.startswith("--")]:
            print(p, json.dumps(score(p, kind)))
