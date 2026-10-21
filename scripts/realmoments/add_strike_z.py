"""Fill in each tracked shot's strike height ("z", metres) in
data/realmoments/tracked.json from data/realmoments/tracks.json (the ball's
frame at the shot: index -t0 / dt).

Headers and volleys (21 Oct 2026, Harry: "play the ~170 real headers/volleys
as true ones"): lib/star/realMoments/shots.ts airKindOf reads this height to
serve a real header as a header and a real volley as a volley.

extract_tracking.py now writes "z" itself; this is for the file made before
that. SoccerTrack has no ball height (z is always 0), so its shots get none.

Run from the repo root:  python3 scripts/realmoments/add_strike_z.py
Safe to run again (it only sets "z").
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from rm_common import write  # noqa: E402

DATA = os.path.join(HERE, "..", "..", "data", "realmoments")


def main():
    tracked_path = os.path.join(DATA, "tracked.json")
    with open(tracked_path, encoding="utf-8") as f:
        tracked = json.load(f)
    with open(os.path.join(DATA, "tracks.json"), encoding="utf-8") as f:
        tracks = json.load(f)["tracks"]
    n = 0
    for m in tracked["moments"]:
        if m.get("what") != "shot" or m.get("src") not in ("dfl", "skillcorner"):
            continue
        tr = tracks.get(m["id"])
        if not tr:
            continue
        frames = len(tr["ball"]) // 3
        i = min(frames - 1, int(round(-tr["t0"] / tr["dt"])))
        m["z"] = round(max(0.0, tr["ball"][i * 3 + 2]), 2)
        n += 1
    write(tracked_path, tracked)
    print(f"strike height set on {n} shots")


if __name__ == "__main__":
    main()
