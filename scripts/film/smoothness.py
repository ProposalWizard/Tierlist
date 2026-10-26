#!/usr/bin/env python3
"""HOW SMOOTH IS A CLIP? Repeated frames and uneven motion, measured.

    python3 scripts/film/smoothness.py clip.mp4 [--from S] [--to S] [--box x,y,w,h] [--rate 30]

Decodes the clip at a steady --rate (the rate it is watched at), shrinks each frame
to grey 390 px wide, and for each frame counts the pixels that changed from the one
before inside --box (fractions of the frame; default the whole picture).
  repeated   frames that are an exact copy of the one before while the picture moves on
             both sides: a stall, then a jump. A smooth clip has none.
  jumps      frames that move more than twice the clip's median motion: a stall's catch-up.
  evenness   spread of the frame-to-frame motion while moving (std / mean; lower = steadier).
Prints one JSON line. Used by scripts/film/vclock-proof.md to compare the old and new way.
"""
import json, subprocess, sys
import numpy as np

def frames(path, rate, t0, t1, w=390):
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip().split(",")
    W, H = int(probe[0]), int(probe[1])
    h = int(round(w * H / W / 2) * 2)
    cmd = ["ffmpeg", "-v", "error"]
    if t0: cmd += ["-ss", str(t0)]
    cmd += ["-i", path]
    if t1: cmd += ["-t", str(t1 - (t0 or 0))]
    cmd += ["-vf", f"fps={rate},scale={w}:{h},format=gray", "-f", "rawvideo", "-"]
    raw = subprocess.run(cmd, capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)

def main():
    a = sys.argv[1:]
    path = a[0]
    opt = lambda k, d=None: a[a.index(k) + 1] if k in a else d
    rate = float(opt("--rate", 30)); t0 = float(opt("--from", 0)); t1 = opt("--to"); t1 = float(t1) if t1 else None
    f = frames(path, rate, t0, t1)
    box = opt("--box")
    if box:
        x, y, w, h = map(float, box.split(","))
        H, W = f.shape[1:]
        f = f[:, int(y * H):int((y + h) * H), int(x * W):int((x + w) * W)]
    # Changed pixels between each frame and the one before (more than 18 grey levels:
    # encoder noise stays under it). Counted at 390 px wide, where the ball is ~4 px, so a
    # moving ball alone changes dozens of pixels and a stall changes almost none.
    diff = np.abs(np.diff(f, axis=0))
    d = (diff > 18).sum(axis=(1, 2)).astype(np.float64)
    # A stall: almost nothing changed (< 6 px) while the picture changes on both sides of it.
    mov = d >= 25
    stall = np.zeros_like(mov)
    for i in range(1, len(d) - 1):
        stall[i] = d[i] < 6 and mov[i - 1] and mov[i + 1]
    rep = int(stall.sum())
    moving = mov | stall
    mv = d[mov]
    med = float(np.median(mv)) if len(mv) else 0.0
    jumps = int((mv > 2 * med).sum()) if med else 0
    print(json.dumps({
        "clip": path, "frames": int(len(f)), "moving_frames": int(moving.sum()),
        "repeated": rep, "repeated_pct": round(100 * rep / max(1, int(moving.sum())), 1),
        "jumps": jumps, "evenness_cv": round(float(mv.std() / mv.mean()), 3) if len(mv) else None,
        "median_motion": round(med, 2),
    }))

if __name__ == "__main__":
    main()
