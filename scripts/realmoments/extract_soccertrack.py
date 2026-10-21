"""Fully real moments from SoccerTrack v2 (step 2 of 2) -> adds them to
data/realmoments/tracked.json and data/realmoments/tracks.json.

SoccerTrack v2 (Scott et al. 2025, arXiv 2508.01802; dataset CC BY 4.0, which
"permits commercial use": data/opendata/LICENCES.md) filmed 10 whole
university-level matches in Japan with a panoramic
camera (mostly University of Tsukuba teams): every player and the ball in every frame, in pitch metres, plus
ball-action labels (SHOT, GOAL, ...) and event data. No player names: shirt
numbers only.

A moment is every SHOT (BAS label SHOT or GOAL) and every CORNER (event data
cornerKick) of the filmed halves, with the same fields as the DFL / SkillCorner
moments (scripts/realmoments/extract_tracking.py): the picture at the strike /
kick, everyone's track every 0.2 s (4 s before a shot, 1 s before to 3 s after
a corner), the facts. The ball has no height in this data (z = 0).

Run soccertrack_compact.py on every half first. Then:
  python3 -I scripts/realmoments/extract_soccertrack.py STV2_DIR [REPO_ROOT]
  STV2_DIR/compact/{match}_{1st|2nd}.json.gz, STV2_DIR/bas/{match}/{match}_12_class_events.json,
  STV2_DIR/raw/{match}/{match}_player_nodes.csv
Re-running replaces the SoccerTrack moments and keeps every other source's.
"""
import collections, csv, glob, gzip, json, math, os, statistics, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rm_common import CREDIT, metres_to_pitch, xg_features, xg_of, write  # noqa: E402

STV2 = sys.argv[1]
ROOT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "data", "realmoments")
FPS = 25
STEP = 5                 # the compact files hold every 5th frame (0.2 s)
STEP_S = 0.2
LENGTH = 105.0
SHOT_WIN = (-4.0, 0.0)
CORNER_WIN = (-1.0, 3.0)
AFTER_S = 2.0
HALVES = ("1st", "2nd")
COMP = "University football, Japan (SoccerTrack v2)"

XGW = json.load(open(os.path.join(OUT, "wyscout_shots.json")))["meta"]["xg_model"]["weights"]


NAMES = {
    "筑波大学": "Tsukuba University", "筑波大学 サッカー同好会": "Tsukuba Football Circle",
    "筑波大学 医学サッカー部": "Tsukuba Medical FC", "中央学院大学": "Chuo Gakuin University",
    "作新学院大学": "Sakushin Gakuin University",
}


def team_name(raw):
    """The event data's team name in English: '筑波大学 - B' -> 'Tsukuba University B'."""
    raw = (raw or "").strip()
    if raw in NAMES:
        return NAMES[raw]
    if raw.startswith("筑波大学 - "):
        return "Tsukuba University " + raw.split(" - ", 1)[1]
    return raw or "?"


class Half:
    """Frames at STEP: frame -> (ball (X, Y, 0) | None, {pid: (X, Y)}), metres, centre origin, +Y = left of a team attacking +X."""
    def __init__(self, d):
        self.length = LENGTH
        self.frames = {}
        self.side, self.jersey, self.gk = {}, {}, set()
        fr = d["frames"]
        for pid, p in d["players"].items():
            self.side[pid] = p["team"]
            self.jersey[pid] = p["jersey"]
            if p["role"] == "goalkeeper":
                self.gk.add(pid)
        for i, f in enumerate(fr):
            bx, by = d["ball"][2 * i], d["ball"][2 * i + 1]
            ball = (bx, by, 0.0) if bx is not None else None
            pl = {}
            for pid, p in d["players"].items():
                x, y = p["xy"][2 * i], p["xy"][2 * i + 1]
                if x is not None:
                    pl[pid] = (x, y)
            self.frames[f] = [ball, pl]

    def at(self, f):
        return self.frames.get(f)


def nearest_frame(f):
    return int(round(f / STEP)) * STEP


def to_ours(X, Y, flip):
    if flip:
        X, Y = -X, -Y
    return metres_to_pitch(X, Y, LENGTH)


def picture(h, f, team_of, team, actor, flip):
    fr = h.at(f)
    if not fr or not fr[0]:
        return None
    (bx, by, bz), pl = fr
    ball = to_ours(bx, by, flip)
    people = []
    for pid, (x, y) in pl.items():
        if pid not in team_of:
            continue
        mate = team_of[pid] == team
        side = "you" if pid == actor else "mate" if mate else "keeper" if pid in h.gk else "opp"
        at = to_ours(x, y, flip)
        # A man more than 4 m off the pitch is a substitute warming up or a stray track: not in the picture.
        if pid != actor and not (-4 <= at[0] <= 72 and -4 <= at[1] <= 109):
            continue
        people.append((pid, side, at))
    return ball, 0.0, people


def refine_shot(h, f0, actor, span):
    best, bd = None, 1e9
    k = int(round(0.4 / STEP_S)) * STEP
    for f in range(f0 - span, f0 + span + 1, STEP):
        a, b = h.at(f), h.at(f + k)
        if not a or not a[0] or not b or not b[0] or actor not in a[1]:
            continue
        (bx, by, _), pl = a
        px, py = pl[actor]
        d = math.hypot(bx - px, by - py)
        moved = math.hypot(b[0][0] - bx, b[0][1] - by)
        if moved < 3:
            continue
        score = d + 0.15 * abs(f - f0) / STEP
        if score < bd:
            bd, best = score, f
    return best if best is not None and bd < 4 else None


def refine_corner(h, f0, span):
    k = int(round(0.6 / STEP_S)) * STEP
    cands = []
    for f in range(f0 - span, f0 + span + 1, STEP):
        a, b = h.at(f), h.at(f + k)
        if not a or not a[0] or not b or not b[0]:
            continue
        bx, by, _ = a[0]
        if abs(abs(bx) - LENGTH / 2) > 3 or abs(by) < 30:
            continue
        if math.hypot(b[0][0] - bx, b[0][1] - by) > 4:
            cands.append((math.hypot(abs(bx) - LENGTH / 2, abs(by) - 34), f))
    if not cands:
        return None
    best = min(c[0] for c in cands)
    near = [f for dd, f in cands if dd <= best + 0.3]
    return min(near, key=lambda f: abs(f - f0))


def track(h, f, team_of, team, actor, flip, win, names):
    k0, k1 = int(round(win[0] / STEP_S)), int(round(win[1] / STEP_S))
    pics = [picture(h, f + k * STEP, team_of, team, actor, flip) for k in range(k0, k1 + 1)]
    ev = pics[-k0]
    if not ev:
        return None
    men = collections.OrderedDict((pid, [side, names.get(pid, "")]) for pid, side, _ in ev[2])
    last_ball = list(ev[0]) + [0.0]
    last = {pid: p for pid, _, p in ev[2]}
    ball, rows = [], {pid: [] for pid in men}
    for p in pics:
        if p:
            last_ball = list(p[0]) + [0.0]
            for pid, _, xy in p[2]:
                last[pid] = xy
        ball.append(last_ball)
        for pid in men:
            rows[pid].append(last.get(pid))
    for pid, r in rows.items():
        first = next((v for v in r if v), None)
        rows[pid] = [v or first for v in r]
    return {
        "t0": win[0], "dt": STEP_S,
        "ball": [round(v, 1) for b in ball for v in (b[0], b[1], 0.0)],
        "men": [[men[pid][0], men[pid][1]] + [c for xy in rows[pid] for c in xy] for pid in men],
    }


def shot_end(h, f, team_of, team, actor, flip):
    prev, keep = None, None
    for k in range(1, int(round(AFTER_S / STEP_S)) + 1):
        p = picture(h, f + k * STEP, team_of, team, actor, flip)
        if not p:
            continue
        x, y = p[0]
        if y <= 0 and prev:
            px, py = prev
            g = py / max(1e-6, py - y)
            return [round(px + (x - px) * g, 2), 0]
        prev = (x, y)
        if k == int(round(1.0 / STEP_S)):
            keep = [x, y]
    return keep


def moment(h, f, team_of, team, actor, flip, meta, kind, names):
    pic = picture(h, f, team_of, team, actor, flip)
    if not pic:
        return None, None
    gk = [xy for _, sd, xy in pic[2] if sd == "keeper"]
    if gk and gk[0][1] > 52.5:
        flip = not flip
        pic = picture(h, f, team_of, team, actor, flip)
    ball, _, people = pic
    if not any(s == "you" for _, s, _ in people):
        return None, None
    ff = [[xy[0], xy[1], 1 if s == "mate" else 0, 1 if s == "keeper" else 0] for _, s, xy in people if s != "you"]
    rec = dict(meta, ball=ball, ff=ff, what=kind)
    if kind == "shot":
        rec["end"], rec["endZ"] = shot_end(h, f, team_of, team, actor, flip), None
        rec["xg"] = round(xg_of(XGW, xg_features(ball[0], ball[1], rec["body"] == "Head", rec["type"] == "Free Kick")), 3)
    tr = track(h, f, team_of, team, actor, flip, SHOT_WIN if kind == "shot" else CORNER_WIN, names)
    return rec, tr


def flips_of(h, team_of):
    """team -> attacks -X? (its keeper stands at +X on average)."""
    xs = collections.defaultdict(list)
    for f, (_, pl) in h.frames.items():
        if f % 250:
            continue
        for pid, (x, _) in pl.items():
            if pid in h.gk and pid in team_of:
                xs[team_of[pid]].append(x)
    return {t: sum(v) / len(v) > 0 for t, v in xs.items() if v}


def run_match(mid):
    pn = os.path.join(STV2, "raw", mid, f"{mid}_player_nodes.csv")
    bas = os.path.join(STV2, "bas", mid, f"{mid}_12_class_events.json")
    if not os.path.exists(pn) or not os.path.exists(bas):
        print("skip", mid, "(no events)"); return [], {}
    rows = list(csv.DictReader(open(pn, encoding="utf-8")))
    team_of_pid = {r["player_id"]: r["team_id"] for r in rows if r["player_id"]}
    tname = {r["team_id"]: team_name(r["team_name"]) for r in rows if r["team_id"]}
    actions = json.load(open(bas, encoding="utf-8"))["actions"]
    # Halves in the actions: "1 - mm:ss" / "2 - mm:ss".
    by_half = collections.defaultdict(list)
    for a in actions:
        by_half[a["gameTime"].split(" - ")[0]].append(a)
    goals = collections.Counter()
    for a in actions:
        if a["label"] == "GOAL" and a.get("player_id") in team_of_pid:
            goals[team_of_pid[a["player_id"]]] += 1
    teams = sorted(tname)
    match = f"{tname[teams[0]]} {goals[teams[0]]}-{goals[teams[1]]} {tname[teams[1]]}" if len(teams) == 2 else mid
    out, tracks = [], {}
    for hi, half in enumerate(HALVES, start=1):
        cp = os.path.join(STV2, "compact", f"{mid}_{half}.json.gz")
        if not os.path.exists(cp):
            print("skip", mid, half, "(no compact file)"); continue
        h = Half(json.load(gzip.open(cp, "rt", encoding="utf-8")))
        names = {pid: f"No. {h.jersey.get(pid, '?')}" for pid in h.side}
        team_of = {pid: team_of_pid.get(pid) for pid in h.side if team_of_pid.get(pid)}
        flips = flips_of(h, team_of)
        acts = by_half.get(str(hi), [])
        # Event-data times are the match clock; the half's video starts at `off` ms on it.
        offs = []
        shot_rows = [r for r in rows if ("shot" in r["event_types"].split() or "goal" in r["event_types"].split())]
        for a in acts:
            if a["label"] in ("SHOT", "GOAL"):
                for r in shot_rows:
                    if r["player_id"] == a["player_id"]:
                        offs.append(round((int(r["event_time"]) - int(a["position"])) / 1000))
        off = statistics.mode(offs) * 1000 if offs else (0 if hi == 1 else 45 * 60 * 1000)
        base_min = 0 if hi == 1 else 45
        n_m = 0
        shots_at = []
        heads = [(int(a["frame"]), a.get("player_id")) for a in acts if a["label"] == "HEADER"]
        for a in acts:
            if a["label"] not in ("SHOT", "GOAL"):
                continue
            actor = a.get("player_id")
            team = team_of.get(actor)
            if team is None or team not in flips:
                continue
            f = refine_shot(h, nearest_frame(int(a["frame"])), actor, 30)
            if f is None:
                continue
            t_ms = int(a["position"]) + off
            near = [r for r in shot_rows if r["player_id"] == actor and abs(int(r["event_time"]) - t_ms) < 2500]
            ev = set(near[0]["event_types"].split()) if near else set()
            typ = "Penalty" if "penaltyKick" in ev else "Free Kick" if "freeKick" in ev else "Open Play"
            if typ == "Open Play":
                # A shot within 12 s of a corner by its team is a corner's shot (as DFL marks them).
                for r in rows:
                    if "cornerKick" in r["event_types"].split() and r["team_id"] == team and 0 <= t_ms - int(r["event_time"]) <= 12000:
                        typ = "Corner"; break
            outcome = "Goal" if a["label"] == "GOAL" else "Saved" if "shotOnTarget" in ev else "Blocked" if "shotBlocked" in ev else "Shot"
            head = any(p == actor and abs(fr - int(a["frame"])) <= 12 for fr, p in heads)
            meta = {"id": f"st{mid}_{hi}_{a['frame']}", "src": "soccertrack", "comp": COMP, "match": match,
                    "minute": base_min + int(a["frame"]) // FPS // 60 + 1, "player": names.get(actor, "?"),
                    "team": tname.get(team, "?"), "opp": next((v for k, v in tname.items() if k != team), "?"),
                    "outcome": outcome, "xg": None, "body": "Head" if head else "Foot", "type": typ}
            rec, tr = moment(h, f, team_of, team, actor, flips[team], meta, "shot", names)
            if rec and tr:
                out.append(rec); tracks[rec["id"]] = tr; n_m += 1
                shots_at.append((f, team, outcome))
        # Corners: the event data's cornerKick, its time put on this half's video.
        frames_n = max(h.frames)
        for r in rows:
            if "cornerKick" not in r["event_types"].split():
                continue
            f0 = nearest_frame((int(r["event_time"]) - off) / 1000 * FPS)
            if f0 < 0 or f0 > frames_n:
                continue
            team = r["team_id"]
            if team not in flips:
                continue
            f = refine_corner(h, f0, 100)
            if f is None:
                continue
            fr = h.at(f)
            bx, by, _ = fr[0]
            mates = [(pid, xy) for pid, xy in fr[1].items() if team_of.get(pid) == team]
            if not mates:
                continue
            taker = min(mates, key=lambda q: math.hypot(q[1][0] - bx, q[1][1] - by))[0]
            hits = [o for g, t, o in shots_at if t == team and 0 <= g - f <= 12 * FPS]
            meta = {"id": f"stc{mid}_{hi}_{f}", "src": "soccertrack", "comp": COMP, "match": match,
                    "minute": base_min + f // FPS // 60 + 1, "player": names.get(taker, "?"),
                    "team": tname.get(team, "?"), "opp": next((v for k, v in tname.items() if k != team), "?"),
                    "type": "Corner", "led": "goal" if "Goal" in hits else "shot" if hits else "no shot"}
            rec, tr = moment(h, f, team_of, team, taker, flips[team], meta, "corner", names)
            if rec and tr and rec["id"] not in tracks:
                out.append(rec); tracks[rec["id"]] = tr; n_m += 1
        print(mid, half, match, "moments", n_m, f"(video starts {off / 60000:.1f} min into the event clock)", flush=True)
    return out, tracks


def main():
    mids = sorted({os.path.basename(p).split("_")[0] for p in glob.glob(os.path.join(STV2, "compact", "*.json.gz"))})
    moments, tracks, n_match = [], {}, 0
    for mid in mids:
        a, t = run_match(mid)
        if a:
            n_match += 1
        moments += a; tracks.update(t)
    tf = os.path.join(OUT, "tracked.json")
    kf = os.path.join(OUT, "tracks.json")
    tracked = json.load(open(tf, encoding="utf-8"))
    allt = json.load(open(kf, encoding="utf-8"))
    keep = [m for m in tracked["moments"] if m["src"] != "soccertrack"]
    keep_tr = {k: v for k, v in allt["tracks"].items() if not k.startswith("st")}
    meta = tracked["meta"]
    meta["credit"]["soccertrack"] = CREDIT["soccertrack"]
    meta["sources"]["soccertrack"] = (f"SoccerTrack v2 (Scott et al., arXiv 2508.01802, 2025; https://github.com/AtomScott/SoccerTrack-v2), "
                                      f"{n_match} matches, CC BY 4.0. Ball height not known (z = 0).")
    write(tf, {"meta": meta, "moments": keep + moments})
    allt["meta"]["credit"]["soccertrack"] = CREDIT["soccertrack"]
    write(kf, {"meta": allt["meta"], "tracks": {**keep_tr, **tracks}})
    c = collections.Counter((r["what"], r["type"]) for r in moments)
    print(n_match, "matches", dict(c))


if __name__ == "__main__":
    main()
