"""Shrink one SoccerTrack v2 half to the positions we use (step 1 of 2).

SoccerTrack v2 (Scott et al. 2025; CC BY 4.0, commercial use allowed: see
data/opendata/LICENCES.md) has, per half, a 2.7 GB Game State Reconstruction
file: every player in every frame at 25 fps, in pitch metres. This reads it
as a stream (it never fits in memory) and writes a small file:

  STV2_DIR/compact/{match}_{half}.json.gz
    { match, half, fps: 5, frames: [frame, ...],
      players: { player_id: { team: "left"|"right", role: "player"|"goalkeeper",
                              jersey, xy: [x, y, x, y, ...] } },
      ball: [x, y, ...] }

Every value is the average over the 9 frames (0.36 s) around it: the source
rounds positions to 1 % of the pitch (1.05 m x 0.68 m), so a man standing
still jumps by a metre from frame to frame; the average takes that out.
Positions: metres, centre origin, x along the pitch (as the camera sees it,
left to right), y ACROSS with +y on the left of a team attacking +x (the
source's y points the other way; flipped here). null = not seen.

Usage: python3 -I scripts/realmoments/soccertrack_compact.py STV2_DIR MATCH HALF
  needs: pip install ijson numpy
  STV2_DIR/gsr/{match}_{half}.json and STV2_DIR/ball/{match}_{half}_ball.npz
  (from https://huggingface.co/datasets/atomscott/soccertrack-v2 or its
  Google Drive mirror). HALF is 1st or 2nd.
"""
import gzip, json, os, sys

import ijson
import numpy as np

STV2, MATCH, HALF = sys.argv[1], sys.argv[2], sys.argv[3]
STEP = 5            # 25 fps -> 5 per second
WIN = 4             # +-4 frames averaged
BALL_WIN = 1        # the ball moves fast: +-1 frame only


def main():
    gsr = os.path.join(STV2, "gsr", f"{MATCH}_{HALF}.json")
    npz = os.path.join(STV2, "ball", f"{MATCH}_{HALF}_ball.npz")
    out = os.path.join(STV2, "compact", f"{MATCH}_{HALF}.json.gz")
    os.makedirs(os.path.dirname(out), exist_ok=True)

    seq = None
    info = {}
    rows = {}           # pid -> list of (frame, x, y)
    with open(gsr, "rb") as fh:
        for prefix, ev, val in ijson.parse(fh):
            if prefix == "info.seq_length":
                seq = int(val)
            if prefix == "images":
                break
    with open(gsr, "rb") as fh:
        for a in ijson.items(fh, "annotations.item", use_float=True):
            if a.get("supercategory") != "object" or a.get("category_id") not in (1, 2):
                continue
            at = a.get("attributes") or {}
            pid = at.get("player_id")
            bp = a.get("bbox_pitch") or {}
            x, y = bp.get("x_bottom_middle"), bp.get("y_bottom_middle")
            if pid is None or x is None or y is None:
                continue
            fr = int(str(a["image_id"])[-6:])   # "3" + video id + 6-digit frame
            if pid not in info:
                info[pid] = {"team": at.get("team"), "role": at.get("role"), "jersey": str(at.get("jersey") or "")}
                rows[pid] = []
            rows[pid].append((fr, x, -y))
    n = seq or max(max(f for f, _, _ in r) for r in rows.values())
    keep = list(range(STEP, n + 1, STEP))

    def smooth(arr, win):
        # arr: (n+1, 2) with nan; centred mean over +-win, ignoring nan
        ok = ~np.isnan(arr[:, 0])
        v = np.where(ok[:, None], arr, 0.0)
        c = np.concatenate([[0], np.cumsum(ok.astype(np.int64))])
        s = np.concatenate([np.zeros((1, 2)), np.cumsum(v, axis=0)])
        idx = np.array(keep)
        lo = np.clip(idx - win, 0, len(arr)); hi = np.clip(idx + win + 1, 0, len(arr))
        cnt = c[hi] - c[lo]
        tot = s[hi] - s[lo]
        res = np.full((len(idx), 2), np.nan)
        m = cnt > 0
        res[m] = tot[m] / cnt[m][:, None]
        return res

    players = {}
    for pid, r in rows.items():
        arr = np.full((n + 1, 2), np.nan)
        for fr, x, y in r:
            if 0 <= fr <= n:
                arr[fr] = (x, y)
        sm = smooth(arr, WIN)
        xy = []
        for x, y in sm:
            xy += [None, None] if np.isnan(x) else [round(float(x), 2), round(float(y), 2)]
        players[str(pid)] = dict(info[pid], xy=xy)

    z = np.load(npz, allow_pickle=False)
    bf, bx, by = z["frame"], z["x"], z["y"]
    st = z["status"] if "status" in z.files else np.zeros(len(bf))
    barr = np.full((n + 1, 2), np.nan)
    for f, x, y, s in zip(bf, bx, by, st):
        if 0 <= f <= n and s >= 0 and not np.isnan(x):
            barr[f] = (x, -y)
    bs = smooth(barr, BALL_WIN)
    ball = []
    for x, y in bs:
        ball += [None, None] if np.isnan(x) else [round(float(x), 2), round(float(y), 2)]

    with gzip.open(out, "wt", encoding="utf-8") as f:
        json.dump({"match": MATCH, "half": HALF, "fps": 25 // STEP, "frames": keep, "players": players, "ball": ball}, f, separators=(",", ":"))
    print(f"wrote {out} {os.path.getsize(out) / 1e6:.1f} MB, {len(players)} players, {len(keep)} frames", flush=True)


if __name__ == "__main__":
    main()
