"""Blur a small mark (a logo the picture model slipped onto the kit) that moves with the body.

  python3 -I tools/motionref/blur_mark.py <in.mp4> <poses.npz> <person> <out.mp4> [--check=frame.jpg]

The mark sits on his left shorts hem in ref-home-idle (20 Oct 2026); its place
each frame is worked out from the hips and the left knee MediaPipe found, and
a soft-edged box there is blurred hard. Output is 540 wide like the other
repo copies.
"""
import sys

import cv2
import numpy as np

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opt = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--"))
src, npz, pid, dst = args
z = np.load(npz, allow_pickle=True)
I = z[f"img_{pid}"]
cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS)
W, H = int(cap.get(3)), int(cap.get(4))
s = 540 / W
out = cv2.VideoWriter(dst + ".tmp.mp4", cv2.VideoWriter_fourcc(*"mp4v"), fps, (540, int(H * s) // 2 * 2))
f = 0
while True:
    ok, img = cap.read()
    if not ok:
        break
    p = I[min(f, len(I) - 1)]
    lh, rh, lk = p[23, :2] * [W, H], p[24, :2] * [W, H], p[25, :2] * [W, H]
    hipw = np.linalg.norm(lh - rh)
    c = lh + (lk - lh) * 0.53 + (lh - rh) * 0.22
    r = int(max(36, hipw * 0.4))
    x0, y0 = int(max(0, c[0] - r)), int(max(0, c[1] - r))
    x1, y1 = int(min(W, c[0] + r)), int(min(H, c[1] + r))
    if x1 > x0 and y1 > y0:
        roi = img[y0:y1, x0:x1]
        bl = cv2.GaussianBlur(roi, (0, 0), 14)
        m = np.zeros(roi.shape[:2], np.float32)
        cv2.circle(m, (int(c[0]) - x0, int(c[1]) - y0), int(r * 0.8), 1.0, -1)
        m = cv2.GaussianBlur(m, (0, 0), r * 0.2)[..., None]
        img[y0:y1, x0:x1] = (roi * (1 - m) + bl * m).astype(np.uint8)
    if "check" in opt and f == 150:
        cv2.imwrite(opt["check"], img[max(0, y0 - 150):y1 + 150, max(0, x0 - 150):x1 + 150])
    out.write(cv2.resize(img, (540, int(H * s) // 2 * 2)))
    f += 1
out.release()
import subprocess  # noqa: E402
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", dst + ".tmp.mp4", "-c:v", "libx264", "-crf", "27", "-preset", "slow",
                "-an", "-movflags", "+faststart", dst], check=True)
import os  # noqa: E402
os.remove(dst + ".tmp.mp4")
print("ok", dst)
