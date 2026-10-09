#!/usr/bin/env python3
"""scripts/look-tuner/curve.py — the tuner's score curve as a picture: every try (grey) and the best so far (line).
    python3 curve.py log.jsonl curve.png"""
import json, sys
from PIL import Image, ImageDraw

rows = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
W, H, P = 900, 420, 50
img = Image.new("RGB", (W, H), "#0f141b")
d = ImageDraw.Draw(img)
s = [r["score"] for r in rows]
lo, hi = min(s) * 0.95, max(s) * 1.02
X = lambda i: P + (W - 2 * P) * i / max(1, len(rows) - 1)
Y = lambda v: H - P - (H - 2 * P) * (v - lo) / max(1e-9, hi - lo)
for k in range(5):
    v = lo + (hi - lo) * k / 4
    d.line([(P, Y(v)), (W - P, Y(v))], fill="#243040")
    d.text((6, Y(v) - 6), f"{v:.2f}", fill="#8fa3b8")
for i, v in enumerate(s):
    d.ellipse([X(i) - 2, Y(v) - 2, X(i) + 2, Y(v) + 2], fill="#5b6b7d")
bests, b = [], float("inf")
for v in s:
    b = min(b, v); bests.append(b)
d.line([(X(i), Y(v)) for i, v in enumerate(bests)], fill="#f5c542", width=3)
d.text((P, 12), f"Look-tuner: distance from the benchmark look (lower = closer)   start {s[0]:.2f}  ->  best {bests[-1]:.2f}   {len(s)} tries", fill="#e8eef5")
d.text((W - P - 120, H - P + 14), "tries ->", fill="#8fa3b8")
img.save(sys.argv[2])
print("wrote", sys.argv[2])
