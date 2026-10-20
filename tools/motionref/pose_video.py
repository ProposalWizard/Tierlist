"""A reference video -> each person's body, frame by frame (MediaPipe Pose, CPU).

  python3 -I tools/motionref/pose_video.py <video.mp4> <out.npz> [--people=2] [--model=PATH] [--overlay=out.mp4]

Writes, for each person (tracked across frames by where his hips are in the
picture, "p0" = leftmost at the start):
  world_<p>  (n, 33, 3)  MediaPipe's world landmarks in metres, centred on the
                          hips, turned to y up, z towards the camera, x to the
                          picture's right (= his left when he faces us)
  img_<p>    (n, 33, 3)  picture landmarks (x, y in 0..1, visibility)
  ok_<p>     (n,)        found in this frame
plus fps and people.

The model: pose_landmarker_heavy.task from
https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task
(Apache 2.0). Not committed (30 MB): pass --model or set MP_POSE_MODEL.
"""
import os
import sys

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import PoseLandmarker, PoseLandmarkerOptions, RunningMode

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opt = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--"))
src, out = args
npeople = int(opt.get("people", 1))
model = opt.get("model", os.environ.get("MP_POSE_MODEL", "pose_landmarker_heavy.task"))

cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
lm = PoseLandmarker.create_from_options(PoseLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=model), running_mode=RunningMode.VIDEO, num_poses=npeople,
    min_pose_detection_confidence=0.4, min_pose_presence_confidence=0.4, min_tracking_confidence=0.4))

frames = []
i = 0
while True:
    ok, bgr = cap.read()
    if not ok:
        break
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    res = lm.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int(i * 1000 / fps))
    people = []
    for w, im in zip(res.pose_world_landmarks, res.pose_landmarks):
        W = np.array([[p.x, -p.y, -p.z] for p in w], float)
        I = np.array([[p.x, p.y, p.visibility] for p in im], float)
        people.append((W, I))
    frames.append(people)
    i += 1
n = len(frames)
lm.close()

# track people by hip centre in the picture
tracks = []  # list of dict(last=xy, W=[], I=[], ok=[])
first = next((f for f in frames if len(f) >= min(npeople, 1)), [])
for W, I in sorted(first, key=lambda p: (p[1][23, 0] + p[1][24, 0]) / 2):
    tracks.append({"last": (I[23, :2] + I[24, :2]) / 2})
while len(tracks) < npeople:
    tracks.append({"last": np.array([0.5, 0.5])})
for t in tracks:
    t["W"] = np.zeros((n, 33, 3))
    t["I"] = np.zeros((n, 33, 3))
    t["ok"] = np.zeros(n, bool)
for f, people in enumerate(frames):
    used = set()
    for t in tracks:
        best, bd = None, 0.25
        for j, (W, I) in enumerate(people):
            if j in used:
                continue
            c = (I[23, :2] + I[24, :2]) / 2
            d = np.linalg.norm(c - t["last"])
            if d < bd:
                best, bd = j, d
        if best is not None:
            used.add(best)
            W, I = people[best]
            t["W"][f], t["I"][f], t["ok"][f] = W, I, True
            t["last"] = (I[23, :2] + I[24, :2]) / 2
# fill short gaps by holding the last good frame
for t in tracks:
    for f in range(1, n):
        if not t["ok"][f] and t["ok"][f - 1] and t["ok"][f:].any():
            t["W"][f], t["I"][f] = t["W"][f - 1], t["I"][f - 1]

save = {"fps": fps, "people": np.array([f"p{k}" for k in range(len(tracks))])}
for k, t in enumerate(tracks):
    save[f"world_p{k}"] = t["W"]
    save[f"img_p{k}"] = t["I"]
    save[f"ok_p{k}"] = t["ok"]
np.savez_compressed(out, **save)
print(out, "frames", n, "fps", round(fps, 2), "found", [round(float(t["ok"].mean()), 2) for t in tracks])

if "overlay" in opt:
    cap = cv2.VideoCapture(src)
    Wd, Ht = int(cap.get(3)), int(cap.get(4))
    s = 540 / Wd
    vw = cv2.VideoWriter(opt["overlay"] + ".tmp.mp4", cv2.VideoWriter_fourcc(*"mp4v"), fps, (540, int(Ht * s)))
    bones = [(11, 13), (13, 15), (12, 14), (14, 16), (11, 12), (11, 23), (12, 24), (23, 24), (23, 25), (25, 27), (24, 26), (26, 28),
             (15, 19), (15, 17), (16, 20), (16, 18)]
    cols = [(0, 230, 255), (255, 120, 0)]
    for f in range(n):
        ok, bgr = cap.read()
        if not ok:
            break
        img = cv2.resize(bgr, (540, int(Ht * s)))
        for k, t in enumerate(tracks):
            if not t["ok"][f]:
                continue
            P = (t["I"][f, :, :2] * [540, int(Ht * s)]).astype(int)
            for a, b in bones:
                cv2.line(img, tuple(P[a]), tuple(P[b]), cols[k % 2], 2)
        vw.write(img)
    vw.release()
    os.system(f"ffmpeg -v error -y -i '{opt['overlay']}.tmp.mp4' -c:v libx264 -crf 28 -an '{opt['overlay']}' && rm '{opt['overlay']}.tmp.mp4'")
