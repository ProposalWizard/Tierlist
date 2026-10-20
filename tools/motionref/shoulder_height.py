"""How high the shoulders sit, measured the same way on our people and on real people.

  python3 -I tools/motionref/shoulder_height.py --model=pose_landmarker_heavy.task <image or video> [...]

MediaPipe Pose finds the ears and the shoulders in the picture (it works on our
Style A people too), and for a man facing the camera the number is

  neck = (shoulders' middle height - ears' middle height) / shoulder width

in picture pixels. A high, shrugged shoulder line makes it SMALLER (the
shoulders creep up towards the ears). A video gives the median over frames.
Same detector, same sum, on both: no guess about which of our bones is "the ear".
Also prints the shoulders' slope (degrees, + = the outer end lower than the
neck end is not visible to MediaPipe, so this is the left-right tilt only).
"""
import os
import sys

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import PoseLandmarker, PoseLandmarkerOptions, RunningMode

opt = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--"))
files = [a for a in sys.argv[1:] if not a.startswith("--")]
model = opt.get("model", os.environ.get("MP_POSE_MODEL", "pose_landmarker_heavy.task"))
lm = PoseLandmarker.create_from_options(PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=model),
                                                              running_mode=RunningMode.IMAGE, num_poses=1))


def measure(rgb):
    res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
    if not res.pose_landmarks:
        return None
    h, w = rgb.shape[:2]
    P = np.array([[p.x * w, p.y * h, p.visibility] for p in res.pose_landmarks[0]])
    ear = (P[7, :2] + P[8, :2]) / 2
    sh = (P[11, :2] + P[12, :2]) / 2
    width = np.linalg.norm(P[11, :2] - P[12, :2])
    if width < 10 or min(P[7, 2], P[8, 2], P[11, 2], P[12, 2]) < 0.5:
        return None
    return (sh[1] - ear[1]) / width


for f in files:
    vals = []
    if f.lower().endswith((".mp4", ".mov", ".webm")):
        cap = cv2.VideoCapture(f)
        i = 0
        while True:
            ok, bgr = cap.read()
            if not ok:
                break
            if i % 4 == 0:
                v = measure(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
                if v is not None:
                    vals.append(v)
            i += 1
    else:
        bgr = cv2.imread(f)
        v = measure(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)) if bgr is not None else None
        if v is not None:
            vals.append(v)
    if vals:
        print(f"{os.path.basename(f):44s} neck/shoulder-width {np.median(vals):.3f}  (n={len(vals)}, spread {np.percentile(vals, 10):.3f}..{np.percentile(vals, 90):.3f})")
    else:
        print(f"{os.path.basename(f):44s} not found")
lm.close()
