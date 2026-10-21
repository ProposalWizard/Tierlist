"""Reduce SoccerTrack v2 (10 university matches in Japan, CC BY 4.0) to
data/opendata/soccertrack_tracking.json — team shapes, pressure on the ball and
back-line height from whole-pitch tracking of all 22 and the ball.

Input: the compact files made by scripts/realmoments/soccertrack_compact.py
(STV2_DIR/compact/{match}_{1st|2nd}.json.gz: every player and the ball every
0.2 s, smoothed) and the event data's team list (STV2_DIR/raw/{match}/{match}_player_nodes.csv).

SoccerTrack names no positions (only "player" / "goalkeeper"), so the
role-by-role spots and running speeds are left out; everything else has the
same layout as idsse_tracking.json. Who has the ball: the team of the nearest
man within 1.5 m of it, kept until someone else is that close.

Usage: python3 -I scripts/opendata/reduce_soccertrack.py STV2_DIR [REPO_ROOT]
"""
import csv, glob, gzip, json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import GRID_DOC, write  # noqa: E402
from tracking_common import TrackAcc  # noqa: E402

STV2 = sys.argv[1]
ROOT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "data", "opendata")

CREDIT = ("Data: SoccerTrack v2 (Scott, Uchida, Kuroda, Kim, Fujii; arXiv 2508.01802, 2025; "
          "https://github.com/AtomScott/SoccerTrack-v2), CC BY 4.0. Whole-pitch tracking of 10 university matches "
          "in Japan. Reduced to aggregate patterns by Knowitball.")
LICENCE_LINE = ("for any purpose, even commercially (LICENSE-DATA: \"released under the Creative Commons Attribution 4.0 "
                "International licence (CC BY 4.0)\")")


def half(acc, path, team_of_pid):
    d = json.load(gzip.open(path, "rt", encoding="utf-8"))
    players = d["players"]
    team_of = {pid: team_of_pid.get(pid) for pid in players if team_of_pid.get(pid)}
    gk = {pid for pid, p in players.items() if p["role"] == "goalkeeper"}
    n = len(d["frames"])
    # Which way each team attacks: its keeper's average x.
    xs = {}
    for pid in gk:
        t = team_of.get(pid)
        v = [x for x in players[pid]["xy"][0::2] if x is not None]
        if t and v:
            xs.setdefault(t, []).extend(v)
    flip = {t: sum(v) / len(v) > 0 for t, v in xs.items()}
    if len(flip) != 2:
        return 0
    poss = None
    used = 0
    for i in range(n):
        bx, by = d["ball"][2 * i], d["ball"][2 * i + 1]
        if bx is None:
            continue
        row = []
        best, bd = None, 1.5
        for pid, p in players.items():
            x, y = p["xy"][2 * i], p["xy"][2 * i + 1]
            t = team_of.get(pid)
            if x is None or t is None:
                continue
            row.append((t, "GK" if pid in gk else "?", x, y))
            dd = math.hypot(x - bx, y - by)
            if dd < bd:
                bd, best = dd, t
        if best is not None:
            poss = best
        acc.frame(row, (bx, by), poss, flip)
        used += 1
    return used


def main():
    acc = TrackAcc()
    files = sorted(glob.glob(os.path.join(STV2, "compact", "*.json.gz")))
    mids = sorted({os.path.basename(f).split("_")[0] for f in files})
    frames = 0
    for mid in mids:
        pn = os.path.join(STV2, "raw", mid, f"{mid}_player_nodes.csv")
        if not os.path.exists(pn):
            print("skip", mid); continue
        team_of_pid = {r["player_id"]: r["team_id"] for r in csv.DictReader(open(pn, encoding="utf-8")) if r["player_id"]}
        for f in files:
            if os.path.basename(f).startswith(mid + "_"):
                frames += half(acc, f, team_of_pid)
        print(mid, "tracked", flush=True)
    out = acc.dump()
    out.pop("speed_by_role", None)
    out.update({
        "meta": {"source": "SoccerTrack v2: 10 university matches in Japan (University of Tsukuba teams), whole-pitch panoramic tracking",
                 "credit": CREDIT, "licence": "CC BY 4.0", "licence_text": LICENCE_LINE,
                 "matches": len(mids), "sampled_hz": 5, "grid": GRID_DOC,
                 "level": "University (amateur) football: a lower level than the Bundesliga and A-League files."},
        "what": "Same layout as idsse_tracking.json (see there), without role spots or running speeds (SoccerTrack names "
                "no positions: only GK is a role here). Positions are the source's, which rounds to 1 % of the pitch, "
                "averaged over 0.36 s; who has the ball is the team of the nearest man within 1.5 m.",
    })
    write(os.path.join(OUT, "soccertrack_tracking.json"), out)
    print(frames, "frames")


if __name__ == "__main__":
    main()
