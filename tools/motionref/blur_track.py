"""Blur marks (logos the video model put on the kit) by tracking them through the clip.

  python3 -I tools/motionref/blur_track.py <in.mp4> <out.mp4> <frame> <x,y,w,h> [<x,y,w,h> ...] [--sheet=check.jpg]

Each box (original-video pixels) is picked by eye on <frame>; an OpenCV CSRT
tracker follows it forwards and backwards from there, and a soft-edged blur
covers it in every frame. Output is 540 wide like the other repo copies.
Used for ref-handshake.mp4 (20 Oct 2026: a real brand's swoosh on the shirt and shorts).
"""
import subprocess
import sys

import cv2
import numpy as np

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opt = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--"))
src, dst, f0 = args[0], args[1], int(args[2])
cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS)
W, H = int(cap.get(3)), int(cap.get(4))
s = 540 / W
size = (540, int(H * s) // 2 * 2)
frames = []
while True:
    ok, img = cap.read()
    if not ok:
        break
    frames.append(cv2.resize(img, size))
n = len(frames)
boxes = [tuple(int(float(v) * s) for v in b.split(",")) for b in args[3:]]


def follow(order, box):
    tr = cv2.TrackerCSRT_create()
    tr.init(frames[order[0]], box)
    got = {order[0]: box}
    last = box
    for i in order[1:]:
        ok, b = tr.update(frames[i])
        if ok:
            last = tuple(int(v) for v in b)
        got[i] = last
    return got


where = [dict() for _ in boxes]
for k, b in enumerate(boxes):
    where[k].update(follow(list(range(f0, n)), b))
    where[k].update(follow(list(range(f0, -1, -1)), b))

out = cv2.VideoWriter(dst + ".tmp.mp4", cv2.VideoWriter_fourcc(*"mp4v"), fps, size)
for i, img in enumerate(frames):
    for k in range(len(boxes)):
        x, y, w, h = where[k][i]
        pad = int(max(w, h) * 0.5)
        x0, y0, x1, y1 = max(0, x - pad), max(0, y - pad), min(size[0], x + w + pad), min(size[1], y + h + pad)
        if x1 <= x0 or y1 <= y0:
            continue
        roi = img[y0:y1, x0:x1]
        bl = cv2.GaussianBlur(roi, (0, 0), max(4, w * 0.6))
        m = np.zeros(roi.shape[:2], np.float32)
        cv2.ellipse(m, ((x + w / 2 - x0, y + h / 2 - y0), (w + pad, h + pad), 0), 1.0, -1)
        m = cv2.GaussianBlur(m, (0, 0), max(2, pad * 0.4))[..., None]
        img[y0:y1, x0:x1] = (roi * (1 - m) + bl * m).astype(np.uint8)
    out.write(img)
out.release()
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", dst + ".tmp.mp4", "-c:v", "libx264", "-crf", "27", "-preset", "slow",
                "-an", "-movflags", "+faststart", dst], check=True)
subprocess.run(["rm", dst + ".tmp.mp4"], check=True)
if "sheet" in opt:
    pick = [frames[i] for i in np.linspace(0, n - 1, 8).astype(int)]
    cv2.imwrite(opt["sheet"], cv2.hconcat([cv2.resize(p, (180, int(180 * size[1] / size[0]))) for p in pick]))
print("ok", dst, n, "frames")
