"""Posture, measured the same way on real people (the reference videos) and on ours (our renders).

  python3 -I tools/motionref/posture.py --model=pose_landmarker_heavy.task [--every=3] [--upper] [--json=out.json] <video|image|folder of frames> [...]

MediaPipe Pose (the same detector, the same sums, on both) gives 33 body points in
metres around the hips. Each frame is turned into the man's own frame: across =
his hips (left +), up = up, forward = across x up. A frame counts only when he is
standing (both knees straighter than 130 deg) and the points we use are seen.

Per frame (the file prints the median and the middle half of its frames):
  head_fwd     ears' middle ahead of the shoulders' middle, in shoulder widths (+ = poked forward)
  neck_deg     shoulders' middle -> ears' middle, degrees from upright (+ = forward)
  sh_height    ears' middle above the shoulders' middle, in shoulder widths (small = shoulders up at the ears)
  sh_height2d  the same in the picture (shoulder_height.py's number; real people 0.61-0.69 facing the camera)
  sh_fwd       shoulders' middle ahead of the hips-to-ears line, in shoulder widths (+ = rolled forward)
  chest_deg    hips' middle -> shoulders' middle from upright, forward (+ = leaning forward)
  elbow_deg    elbow bend (0 = straight), both arms' mean
  palm_deg     the hand's turn: thumb side to forward = 0 (palm to the thigh), + = turned in (palm back)
  arm_gap      wrist outside the hip, in shoulder widths (both sides' mean; - = in front of / inside the hip)
  arm_abd_deg  upper arm out from the side, frontal plane (degrees)
  pelvis_deg   hip line tilt, frontal plane (degrees, size only)
  shift        hips' middle over the ankles' middle, sideways, in hip widths (size only; weight on one leg)
  knee_deg     knee bend, both legs' mean (0 = locked straight)
  knee_diff    one knee more bent than the other (degrees; the relaxed leg of a weight shift)
A side-on frame (shoulders less than 0.3 of the torso wide in the picture) is read in the picture
instead (MediaPipe's depth is a guess from a single picture; side-on, forward is IN the picture):
  s_head_fwd   ear ahead of the shoulder joint, in torso lengths (shoulder to hip)
  s_neck_deg   shoulder -> ear from upright (+ = forward)
  s_chest_deg  hip -> shoulder from upright (+ = leaning forward)
  s_sh_fwd     shoulder ahead of the hip-to-ear line, in torso lengths (+ = rounded forward)
  s_hip_fwd    hip joint ahead of the ankle, in torso lengths (+ = hips pushed forward)
  s_knee_deg   knee bend seen from the side (+ = soft, - = locked back)
"""
import json
import math
import os
import sys

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import PoseLandmarker, PoseLandmarkerOptions, RunningMode

opt = dict((a[2:] + ("" if "=" in a else "=1")).split("=", 1) for a in sys.argv[1:] if a.startswith("--"))
files = [a for a in sys.argv[1:] if not a.startswith("--")]
model = opt.get("model", os.environ.get("MP_POSE_MODEL", "pose_landmarker_heavy.task"))
every = int(opt.get("every", "3"))
UPPER = "upper" in opt  # close-ups: no legs in the picture, the upper body only
lm = PoseLandmarker.create_from_options(PoseLandmarkerOptions(base_options=BaseOptions(model_asset_path=model),
                                                              running_mode=RunningMode.IMAGE, num_poses=1))
KEYS = ["head_fwd", "neck_deg", "sh_height", "sh_height2d", "sh_fwd", "chest_deg", "elbow_deg", "palm_deg",
        "arm_gap", "arm_abd_deg", "pelvis_deg", "shift", "knee_deg", "knee_diff",
        "s_head_fwd", "s_neck_deg", "s_chest_deg", "s_sh_fwd", "s_hip_fwd", "s_knee_deg"]


def unit(v):
    n = np.linalg.norm(v)
    return v / n if n > 1e-9 else v


def ang(a, b, c):
    u, v = unit(a - b), unit(c - b)
    return math.degrees(math.acos(max(-1.0, min(1.0, float(np.dot(u, v))))))


def side_measure(I, vis):
    """From the side, in the picture itself (no depth guess): only when he is side-on."""
    if min(vis[[0, 11, 12, 23, 24]]) < 0.3:
        return None
    sh, hip = (I[11] + I[12]) / 2, (I[23] + I[24]) / 2
    torso = np.linalg.norm(sh - hip)
    if torso < 30 or np.linalg.norm(I[11] - I[12]) > 0.3 * torso:
        return None
    e = 7 if vis[7] >= vis[8] else 8
    ear = I[e]
    f = 1.0 if I[0, 0] > ear[0] else -1.0  # the way he faces
    out = {"s_head_fwd": f * (ear[0] - sh[0]) / torso,
           "s_neck_deg": math.degrees(math.atan2(f * (ear[0] - sh[0]), sh[1] - ear[1])),
           "s_chest_deg": math.degrees(math.atan2(f * (sh[0] - hip[0]), hip[1] - sh[1]))}
    k = (hip[1] - sh[1]) / max(1e-6, hip[1] - ear[1])
    out["s_sh_fwd"] = f * (sh[0] - (hip[0] + k * (ear[0] - hip[0]))) / torso
    legs = [(23, 25, 27), (24, 26, 28)]
    lg = max(legs, key=lambda t: min(vis[list(t)]))
    if min(vis[list(lg)]) >= 0.4:
        out["s_hip_fwd"] = f * (I[lg[0], 0] - I[lg[2], 0]) / torso
        out["s_knee_deg"] = 180 - ang(np.append(I[lg[0]], 0), np.append(I[lg[1]], 0), np.append(I[lg[2]], 0))
        # + = knee bent forward (soft), - = pushed back past straight
        out["s_knee_deg"] *= 1 if f * (I[lg[1], 0] - (I[lg[0], 0] + I[lg[2], 0]) / 2) >= 0 else -1
    return out


def measure(rgb):
    res = lm.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
    if not res.pose_world_landmarks:
        return None
    h0, w0 = rgb.shape[:2]
    I0 = np.array([[p.x * w0, p.y * h0] for p in res.pose_landmarks[0]])
    sm = side_measure(I0, np.array([p.visibility for p in res.pose_landmarks[0]]))
    if sm:
        return sm
    W = np.array([[p.x, p.y, p.z] for p in res.pose_world_landmarks[0]])
    vis = np.array([p.visibility for p in res.pose_landmarks[0]])
    h, w = rgb.shape[:2]
    I = np.array([[p.x * w, p.y * h] for p in res.pose_landmarks[0]])
    if min(vis[[7, 8, 11, 12, 23, 24]]) < 0.5:
        return None
    up = np.array([0.0, -1.0, 0.0])
    lat = W[23] - W[24]
    lat = unit(lat - np.dot(lat, up) * up)
    fwd = np.cross(lat, up)
    # the nose is ahead of the ears: if not, the across direction is the wrong way round
    if np.dot(W[0] - (W[7] + W[8]) / 2, fwd) < 0:
        lat, fwd = -lat, -fwd
    B = lambda p: np.array([np.dot(p, lat), np.dot(p, up), np.dot(p, fwd)])  # across, up, forward
    P = np.array([B(p) for p in W])
    ear, sh, hip = (P[7] + P[8]) / 2, (P[11] + P[12]) / 2, (P[23] + P[24]) / 2
    shw = abs(P[11, 0] - P[12, 0]) + 1e-6
    hipw = abs(P[23, 0] - P[24, 0]) + 1e-6
    out = {}
    # standing only
    knees = []
    for hp, kn, an in ((23, 25, 27), (24, 26, 28)):
        if min(vis[[hp, kn, an]]) < 0.5:
            if UPPER:
                knees = None
                break
            return None
        knees.append(180 - ang(P[hp], P[kn], P[an]))
    if knees and max(knees) > 50:
        return None
    out["head_fwd"] = (ear[2] - sh[2]) / shw
    out["neck_deg"] = math.degrees(math.atan2(ear[2] - sh[2], ear[1] - sh[1]))
    out["sh_height"] = (ear[1] - sh[1]) / shw
    iw = np.linalg.norm(I[11] - I[12])
    out["sh_height2d"] = (((I[11, 1] + I[12, 1]) / 2) - ((I[7, 1] + I[8, 1]) / 2)) / iw if iw > 10 else float("nan")
    # shoulders against the straight hips-to-ears line, at the shoulders' height
    k = (sh[1] - hip[1]) / max(1e-6, ear[1] - hip[1])
    line = hip[2] + k * (ear[2] - hip[2])
    out["sh_fwd"] = (sh[2] - line) / shw
    out["chest_deg"] = math.degrees(math.atan2(sh[2] - hip[2], sh[1] - hip[1]))
    el, pa, gap, abd = [], [], [], []
    for side, (s, e, wr, pk, ix, hp) in (("L", (11, 13, 15, 17, 19, 23)), ("R", (12, 14, 16, 18, 20, 24))):
        if min(vis[[s, e, wr]]) < 0.5:
            continue
        el.append(180 - ang(P[s], P[e], P[wr]))
        sgn = 1 if side == "L" else -1  # outward across
        gap.append((sgn * (P[wr, 0] - P[hp, 0])) / shw)
        ua = P[e] - P[s]
        abd.append(math.degrees(math.atan2(sgn * ua[0], -ua[1])))
        u = P[ix] - P[pk]  # thumb-side direction across the hand
        u = np.array([u[0], 0.0, u[2]])
        if np.linalg.norm(u) > 1e-4 and min(vis[[pk, ix]]) > 0.3:
            # 0 = thumb side forward; + = turned towards the middle (palm back)
            pa.append(math.degrees(math.atan2(-sgn * u[0], u[2])))
    if not el:
        return None
    out["elbow_deg"] = float(np.mean(el))
    out["palm_deg"] = float(np.mean(pa)) if pa else float("nan")
    out["arm_gap"] = float(np.mean(gap))
    out["arm_abd_deg"] = float(np.mean(abd))
    out["pelvis_deg"] = abs(math.degrees(math.atan2(P[23, 1] - P[24, 1], abs(P[23, 0] - P[24, 0]))))
    if knees:
        ank = (P[27] + P[28]) / 2
        out["shift"] = abs(hip[0] - ank[0]) / hipw
        out["knee_deg"] = float(np.mean(knees))
        out["knee_diff"] = abs(knees[0] - knees[1])
    else:
        out["shift"] = out["knee_deg"] = out["knee_diff"] = float("nan")
    return out


def frames(f):
    if os.path.isdir(f):
        names = sorted(n for n in os.listdir(f) if n.lower().endswith((".jpg", ".png")))
        for i, n in enumerate(names):
            if i % every == 0:
                yield cv2.cvtColor(cv2.imread(os.path.join(f, n)), cv2.COLOR_BGR2RGB)
    elif f.lower().endswith((".mp4", ".mov", ".webm")):
        cap = cv2.VideoCapture(f)
        i = 0
        while True:
            ok, bgr = cap.read()
            if not ok:
                break
            if i % every == 0:
                yield cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            i += 1
    else:
        yield cv2.cvtColor(cv2.imread(f), cv2.COLOR_BGR2RGB)


result = {}
for f in files:
    rows = [m for m in (measure(rgb) for rgb in frames(f)) if m]
    s = {"frames": len(rows)}
    for k in KEYS:
        v = np.array([r[k] for r in rows if k in r and not math.isnan(r[k])])
        if len(v):
            s[k] = [round(float(np.median(v)), 3), round(float(np.percentile(v, 25)), 3), round(float(np.percentile(v, 75)), 3)]
    result[f] = s
    print(os.path.basename(f.rstrip("/")), s["frames"], " ".join(f"{k}={s[k][0]}" for k in KEYS if k in s), flush=True)
if "json" in opt:
    json.dump(result, open(opt["json"], "w"), indent=1)
