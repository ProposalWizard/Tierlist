"""Real goalkeeper numbers from StatsBomb open data — FOR MEASURING ONLY.

Leo v0.15 (11 Oct 2026), job "1. The goalkeeper": the reference the keeper
is measured against (docs/gameplay15/keeper.md). Reads every Premier League
2015/16 match's events and prints: save % of shots on target by zone,
distance and height; how far off his line the keeper stood; one-on-ones;
what a save turned into (held, parried safe/danger, out); crosses claimed
or punched; chips. Nothing is written into the repo.

Usage: python3 -I tools/statsbomb/keeper.py [CACHE_DIR]
(CACHE_DIR keeps the downloaded event files, outside the repo.)
"""
import json, math, os, ssl, sys, urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

BASE = "https://raw.githubusercontent.com/statsbomb/open-data/master/data/"
CA = "/root/.ccr/ca-bundle.crt"
CTX = ssl.create_default_context(cafile=CA) if os.path.exists(CA) else None
CACHE = sys.argv[1] if len(sys.argv) > 1 else None


def get(path):
    if CACHE:
        fp = os.path.join(CACHE, path.replace("/", "_"))
        if os.path.exists(fp):
            with open(fp) as f:
                return json.load(f)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(BASE + path, context=CTX, timeout=90) as r:
                raw = r.read()
            if CACHE:
                os.makedirs(CACHE, exist_ok=True)
                with open(os.path.join(CACHE, path.replace("/", "_")), "wb") as f:
                    f.write(raw)
            return json.loads(raw)
        except Exception:
            if attempt == 3:
                raise


YD = 0.9144
GOAL_Y = 40.0  # goal centre, yards across


def metres_from_goal(loc):
    return math.hypot((120 - loc[0]) * YD * 105 / 120 / YD, (loc[1] - GOAL_Y) * 68 / 80)


def in_six(loc):
    return loc[0] >= 114 and 30 <= loc[1] <= 50


def in_box(loc):
    return loc[0] >= 102 and 18 <= loc[1] <= 62


def pct(a, b):
    return f"{100 * a / max(1, b):.1f}% (n {b})"


def main():
    matches = get("matches/2/27.json")
    with ThreadPoolExecutor(16) as ex:
        events = list(ex.map(lambda m: get(f"events/{m['match_id']}.json"), matches))
    on = Counter(); onT = Counter()
    saveOut = Counter()
    keeperOff = []; keeperOff1v1 = []
    oneOn = [0, 0]; oneOnOT = [0, 0]
    lob = Counter(); lobAdv = Counter()
    crossesInBox = 0; cornersInBox = 0; gk = Counter(); sweeper = Counter()
    depthBand = {}; depthBand1 = {}
    for ev in events:
        byId = {e["id"]: e for e in ev}
        for e in ev:
            t = e["type"]["name"]
            if t == "Pass":
                p = e["pass"]
                end = p.get("end_location")
                if p.get("cross") and end and in_box(end) and p.get("type", {}).get("name") not in ("Corner",):
                    crossesInBox += 1
                if p.get("type", {}).get("name") == "Corner" and end and in_box(end):
                    cornersInBox += 1
            if t == "Goal Keeper":
                g = e["goalkeeper"]
                gt = g.get("type", {}).get("name"); go = g.get("outcome", {}).get("name")
                gk[(gt, go)] += 1
            if t != "Shot":
                continue
            s = e["shot"]
            if s.get("type", {}).get("name") == "Penalty":
                continue
            outc = s.get("outcome", {}).get("name")
            loc = e["location"]; end = s.get("end_location") or []
            dist = metres_from_goal(loc)
            ontarget = outc in ("Goal", "Saved", "Saved to Post")
            goal = outc == "Goal"
            zone = "six" if in_six(loc) else "box" if in_box(loc) else "out"
            band = "<8" if dist < 8 else "8-12" if dist < 12 else "12-16" if dist < 16 else "16-22" if dist < 22 else "22-28" if dist < 28 else "28+"
            h = (end[2] * YD) if len(end) > 2 else None
            hb = None if h is None else "low<0.6" if h < 0.6 else "mid0.6-1.6" if h < 1.6 else "high1.6+"
            ex_ = abs(end[1] - GOAL_Y) * YD if len(end) > 1 else None
            wide = None if ex_ is None else "central<1.2" if ex_ < 1.2 else "mid1.2-2.4" if ex_ < 2.4 else "corner2.4+"
            # Keeper and defenders from the freeze frame
            ff = s.get("freeze_frame", [])
            kp = next((f["location"] for f in ff if not f["teammate"] and f["position"]["name"] == "Goalkeeper"), None)
            defs = [f["location"] for f in ff if not f["teammate"] and f["position"]["name"] != "Goalkeeper"]
            koff = None if kp is None else (120 - kp[0]) * 105 / 120
            # A one-on-one: nobody but the keeper inside the shooter→posts triangle, none within 2.5 m, open play, foot, in the box.
            def inside(d):
                ax, ay = loc; bx, by = 120, 36; cx, cy = 120, 44
                def side(px, py, qx, qy, rx, ry): return (qx - px) * (ry - py) - (qy - py) * (rx - px)
                s1 = side(ax, ay, bx, by, d[0], d[1]); s2 = side(bx, by, cx, cy, d[0], d[1]); s3 = side(cx, cy, ax, ay, d[0], d[1])
                return (s1 >= 0 and s2 >= 0 and s3 >= 0) or (s1 <= 0 and s2 <= 0 and s3 <= 0)
            near = any(math.hypot((d[0] - loc[0]) * 105 / 120, (d[1] - loc[1]) * 68 / 80) < 2.5 for d in defs)
            oneon = ff and not any(inside(d) for d in defs) and not near and s.get("body_part", {}).get("name") != "Head" and in_box(loc) and s.get("type", {}).get("name") == "Open Play"
            if koff is not None:
                depthBand.setdefault(band, []).append(koff)
                if oneon: depthBand1.setdefault(band, []).append(koff)
                keeperOff.append(koff)
                if oneon: keeperOff1v1.append(koff)
            if oneon:
                oneOn[1] += 1; oneOn[0] += goal
                if ontarget: oneOnOT[1] += 1; oneOnOT[0] += goal
            if s.get("technique", {}).get("name") == "Lob":
                lob["n"] += 1; lob["goal"] += goal; lob["on"] += ontarget
                if koff is not None and koff > 4:
                    lobAdv["n"] += 1; lobAdv["goal"] += goal; lobAdv["on"] += ontarget
            if not ontarget:
                continue
            for key in ("all", f"zone {zone}", f"dist {band}", f"height {hb}", f"across {wide}",
                        f"head {s.get('body_part', {}).get('name') == 'Head'}"):
                on[key] += 1; onT[key] += goal
    print("SHOTS ON TARGET (no penalties): save % = 1 - goals/on target")
    for k in sorted(on):
        print(f"  {k:22s} saved {pct(on[k] - onT[k], on[k])}")
    ko = sorted(keeperOff); k1 = sorted(keeperOff1v1)
    q = lambda xs, p: xs[int(p * (len(xs) - 1))] if xs else float("nan")
    print(f"KEEPER OFF HIS LINE at the shot (m): median {q(ko, .5):.1f}, p25 {q(ko, .25):.1f}, p75 {q(ko, .75):.1f}")
    print(f"  one-on-ones: median {q(k1, .5):.1f}, p25 {q(k1, .25):.1f}, p75 {q(k1, .75):.1f}")
    print(f"ONE-ON-ONES (open play, foot, in the box, nobody in the way or within 2.5 m): scored {pct(oneOn[0], oneOn[1])}; of those on target {pct(oneOnOT[0], oneOnOT[1])}")
    print(f"LOBS: scored {pct(lob['goal'], lob['n'])}, on target {pct(lob['on'], lob['n'])}; keeper > 4 m off his line: scored {pct(lobAdv['goal'], lobAdv['n'])}")
    for b in ("<8", "8-12", "12-16", "16-22", "22-28", "28+"):
        xs = sorted(depthBand.get(b, [])); ys = sorted(depthBand1.get(b, []))
        print(f"  keeper off line, shots from {b:6s} m: median {q(xs, .5):.1f} (n {len(xs)}); one-on-ones {q(ys, .5):.1f} (n {len(ys)})")
    print(f"CROSSES INTO THE BOX (open play, not corners): {crossesInBox}; corners into the box: {cornersInBox}")
    print("GOALKEEPER EVENTS (type, outcome): count")
    for (gt, go), n in sorted(gk.items(), key=lambda x: -x[1]):
        print(f"  {gt} / {go}: {n}")


if __name__ == "__main__":
    main()
