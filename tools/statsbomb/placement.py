"""Where a shot on target is placed, and how often the keeper saves it.
FOR MEASURING ONLY (Leo, round 16, "Keeper realism": top corners, near-post
top corner from close, the Henry far-post finish).

Reads every Premier League 2015/16 match in StatsBomb's free data (penalties
and headers left out) and prints the save % of shots on target by where they
went in the goal (end_location: across and height) and where they were struck
from. Nothing is written into the repo.

Usage: python3 -I tools/statsbomb/placement.py [CACHE_DIR]
"""
import json, math, os, ssl, sys, urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

BASE = "https://raw.githubusercontent.com/statsbomb/open-data/master/data/"
CA = "/root/.ccr/ca-bundle.crt"
CTX = ssl.create_default_context(cafile=CA) if os.path.exists(CA) else None
CACHE = sys.argv[1] if len(sys.argv) > 1 else None
YD = 0.9144


def shots_of(match_id):
    fp = CACHE and os.path.join(CACHE, f"shots_{match_id}.json")
    if fp and os.path.exists(fp):
        with open(fp) as f:
            return json.load(f)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(BASE + f"events/{match_id}.json", context=CTX, timeout=90) as r:
                ev = json.loads(r.read())
            break
        except Exception:
            if attempt == 3:
                raise
    out = []
    for e in ev:
        if e["type"]["name"] != "Shot":
            continue
        s = e["shot"]
        out.append({
            "loc": e["location"], "end": s.get("end_location") or [],
            "outcome": s.get("outcome", {}).get("name"), "type": s.get("type", {}).get("name"),
            "body": s.get("body_part", {}).get("name"), "tech": s.get("technique", {}).get("name"),
            "foot": e.get("play_pattern", {}).get("name"),
        })
    if fp:
        os.makedirs(CACHE, exist_ok=True)
        with open(fp, "w") as f:
            json.dump(out, f)
    return out


def main():
    with urllib.request.urlopen(BASE + "matches/2/27.json", context=CTX, timeout=90) as r:
        matches = json.loads(r.read())
    with ThreadPoolExecutor(16) as ex:
        allshots = [s for ms in ex.map(lambda m: shots_of(m["match_id"]), matches) for s in ms]
    tab = defaultdict(lambda: [0, 0])  # key -> [saved, on target]

    def add(key, saved):
        tab[key][0] += saved
        tab[key][1] += 1

    for s in allshots:
        if s["type"] == "Penalty" or s["body"] == "Head":
            continue
        if s["outcome"] not in ("Goal", "Saved", "Saved to Post", "Saved Twice"):
            continue
        end, loc = s["end"], s["loc"]
        if len(end) < 3:
            continue
        saved = 0 if s["outcome"] == "Goal" else 1
        # A saved shot's end_location is where the KEEPER stopped it (median
        # 2.4 yd off the line), not where it would have crossed: carry the
        # straight line from the strike through it on to the goal line.
        dx = end[0] - loc[0]
        t = (120 - loc[0]) / dx if dx > 0.5 else 1.0
        t = min(t, 3.0)
        ey = loc[1] + (end[1] - loc[1]) * t
        across = (ey - 40) * YD               # + = StatsBomb's right of goal centre (m)
        if abs(across) > 3.66:
            continue                           # projects outside the posts: no placement to read
        h = min(end[2] * t, 2.67) * YD         # m
        side = 1 if loc[1] > 40 else -1        # which side of goal centre it was struck from
        nearFar = "near" if across * side > 0 else "far"
        off = abs(across)
        col = "central" if off < 1.2 else "mid" if off < 2.4 else "corner"
        row = "low" if h < 0.6 else "mid" if h < 1.6 else "high"
        dist = math.hypot((120 - loc[0]) * 105 / 120, (loc[1] - 40) * 68 / 80)
        db = "<12" if dist < 12 else "12-18" if dist < 18 else "18+"
        lat = abs(loc[1] - 40) * 68 / 80     # metres across from goal centre at the strike
        add(("all",), saved)
        add(("cell", row, col), saved)
        add(("cell-dist", db, row, col), saved)
        if col == "corner":
            add(("corner", row, nearFar, db), saved)
        # The Henry: struck from a channel (5-11 m across, 5-16 m out), placed low far side.
        if 5 <= lat <= 11 and (120 - loc[0]) * 105 / 120 <= 16:
            add(("channel", row, nearFar, col), saved)
        # Near post top corner from close (under 12 m).
        if dist < 12:
            add(("close", row, nearFar, col), saved)

    def show(k):
        sv, n = tab[k]
        return f"saved {100 * sv / max(1, n):5.1f}%  (n {n})"

    for k in sorted(tab, key=str):
        print(" ".join(map(str, k)).ljust(36), show(k))


if __name__ == "__main__":
    main()
