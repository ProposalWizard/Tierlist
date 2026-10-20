"""Reference videos -> the arm paths the cut scenes copy (lib/star/cutscene/refMotion.json).

  python3 tools/motionref/ref_paths.py <poses dir> lib/star/cutscene/refMotion.json

For each clip in CLIPS, from pose_video.py's landmarks (one real person):
  - each wrist and elbow, in his chest's own frame (x his left, y up, z his
    front), from the same side's shoulder, in units of that arm's length
    (shoulder->elbow->wrist), so any body can copy it;
  - his trunk's lean against its first frame (pitch forward +, roll to his
    left +), radians.
All filtered at 5 Hz both ways (no lag), 24 frames a second, 3 decimals.
The game (lib/star/cutscene/refMotion.ts) puts each wrist where the real
man's was, the elbow pointing where his did, at his timing.
"""
import json
import sys

import numpy as np

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from arm_metrics import chest_frame, lowpass  # noqa: E402

# name: (pose file, person, from s, to s, what it is)
CLIPS = {
    "talk-hands": ("press-answer", "p0", 0.0, 6.0, "answers a question at the press table, talking with his hands"),
    "trophy-lift": ("trophy-lift", "p0", 0.0, 6.0, "looks at the cup at his chest, lifts it overhead, shakes it"),
    "roar": ("goal-celebration", "p0", 0.0, 6.0, "on his knees: arms wide, fists in for the roar, arms up"),
    "wave-clap": ("farewell", "p0", 0.0, 6.0, "walks through the guard of honour, waves up, claps over his head"),
    "shirt-up": ("shirt-photo", "p0", 0.0, 6.0, "holds the new shirt up for the cameras"),
}


def build(path, pid, t0, t1):
    z = np.load(path, allow_pickle=True)
    fps = float(z["fps"])
    X = z[f"world_{pid}"].copy()
    ok = z[f"ok_{pid}"]
    # hold the last good frame over gaps
    for f in range(1, len(X)):
        if not ok[f]:
            X[f] = X[f - 1]
    a, b = int(round(t0 * fps)), min(len(X), int(round(t1 * fps)) + 1)
    X = X[a:b]
    # a running median first (7 frames): MediaPipe now and then throws a hidden wrist (behind a cup)
    # half a metre for a frame or two; the low-pass alone would smear that into a fake swing
    pad = np.concatenate([X[:1].repeat(3, 0), X, X[-1:].repeat(3, 0)])
    X = np.median(np.stack([pad[i:i + len(X)] for i in range(7)]), axis=0)
    X = lowpass(X.reshape(len(X), -1), fps, 5.0).reshape(len(X), 33, 3)
    Ls, Rs = X[:, 11], X[:, 12]
    chest = (X[:, 23] + X[:, 24]) / 2 * 0.45 + (Ls + Rs) / 2 * 0.55
    F = chest_frame(Ls, Rs, chest)
    out = {"fps": round(fps, 3), "n": len(X)}
    for s, S, E, W in (("L", 11, 13, 15), ("R", 12, 14, 16)):
        arm = np.median(np.linalg.norm(X[:, E] - X[:, S], axis=1) + np.linalg.norm(X[:, W] - X[:, E], axis=1))
        rel = lambda p: np.einsum("nij,nj->ni", F, p - X[:, S]) / arm
        w = rel(X[:, W])
        # no arm reaches past its own length: a longer one is the tracker guessing (shorten it)
        ln = np.linalg.norm(w, axis=1, keepdims=True)
        w = w * np.minimum(1.0, 0.98 / np.maximum(ln, 1e-6))
        e = rel(X[:, E])
        le = np.linalg.norm(e, axis=1, keepdims=True)
        e = e * np.minimum(1.0, 0.55 / np.maximum(le, 1e-6))
        out[s] = np.round(w, 3).reshape(-1).tolist()
        out[s + "e"] = np.round(e, 3).reshape(-1).tolist()
    # trunk lean against the first frame, in its own frame
    hip = (X[:, 23] + X[:, 24]) / 2
    up = (Ls + Rs) / 2 - hip
    up /= np.linalg.norm(up, axis=1, keepdims=True)
    F0 = F[0]
    u = np.einsum("ij,nj->ni", F0, up)
    pitch = np.arctan2(u[:, 2], u[:, 1])
    roll = np.arctan2(u[:, 0], u[:, 1])
    out["lean"] = np.round(np.stack([pitch - pitch[0], roll - roll[0]], axis=1), 3).reshape(-1).tolist()
    return out


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    data = {"_about": "Arm paths copied from Higgsfield reference videos by MediaPipe (tools/motionref/ref_paths.py). "
                      "Per clip: fps, n frames, L/R wrist and Le/Re elbow from the shoulder in arm lengths "
                      "(x his left, y up, z front, flattened xyz), lean = [pitch, roll] per frame.", "clips": {}}
    for name, (f, pid, t0, t1, what) in CLIPS.items():
        c = build(f"{src}/{f}.npz", pid, t0, t1)
        c["what"] = what
        c["video"] = f"docs/handoffs/2026-10-20-builds/b5c/ref-{f}.mp4"
        data["clips"][name] = c
        L = np.array(c["L"]).reshape(-1, 3)
        print(f"{name:12s} {c['n']} frames  left wrist x {L[:,0].min():+.2f}..{L[:,0].max():+.2f}  y {L[:,1].min():+.2f}..{L[:,1].max():+.2f}  z {L[:,2].min():+.2f}..{L[:,2].max():+.2f}")
    json.dump(data, open(dst, "w"), separators=(",", ":"))
    print(dst)
