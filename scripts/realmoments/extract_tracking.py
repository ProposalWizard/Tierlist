"""Fully real moments from tracking data -> data/realmoments/tracked.json and
data/realmoments/tracks.json.

Sources (both cleared for commercial use, credit lines in data/opendata/LICENCES.md):
  IDSSE / DFL (Bassek et al. 2025, CC BY 4.0): 7 Bundesliga / 2. Bundesliga
    2022/23 matches, 25 Hz tracking of all 22 and the ball, plus DFL events.
  SkillCorner Open Data (MIT): 20 A-League 2024/25 matches, 10 Hz broadcast
    tracking (players off camera extrapolated by SkillCorner), dynamic events.

A moment is every SHOT and every CORNER the events list, with:
  - the picture at that instant: the ball and all 22 men (our pitch metres,
    the acting team attacking the goal at y = 0, its left at x = 0);
  - the track: the ball (x, y, z) and every man, every 0.2 s, for the 4 s
    before a shot / from 1 s before to 3 s after a corner kick
    (tracks.json, keyed by moment id);
  - the facts: competition, match, minute, who, what happened.

Usage: python3 -I scripts/realmoments/extract_tracking.py IDSSE_DIR SC_META_DIR SC_TRACK_DIR [REPO_ROOT]
  IDSSE_DIR: DFL_02_01_matchinformation_*.xml, DFL_03_02_events_raw_*.xml, DFL_04_03_positions_raw_observed_*.xml
  SC_META_DIR: {id}_match.json, {id}_dynamic_events.csv;  SC_TRACK_DIR: {id}.jsonl
"""
import collections, csv, datetime as dt, glob, json, math, os, sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rm_common import CREDIT, CX, POST_L, POST_R, metres_to_pitch, xg_features, xg_of, write  # noqa: E402

IDSSE, SCM, SCT = sys.argv[1], sys.argv[2], sys.argv[3]
ROOT = sys.argv[4] if len(sys.argv) > 4 else os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "data", "realmoments")
STEP_S = 0.2
SHOT_WIN = (-4.0, 0.0)
CORNER_WIN = (-1.0, 3.0)
AFTER_S = 2.0   # read past a shot to find where it went

XGW = json.load(open(os.path.join(OUT, "wyscout_shots.json")))["meta"]["xg_model"]["weights"]


def ts(s):
    return dt.datetime.fromisoformat(s).timestamp()


def known(first, last, short):
    first, last, short = (first or "").strip(), (last or "").strip(), (short or "").strip()
    if short and "." not in short:
        return short
    return f"{first} {last}".strip() or short


# ---------------------------------------------------------------- shared
class Match:
    """Frames at STEP_S: frame -> (ball (X, Y, Z) | None, {pid: (X, Y)}), in the source's metres."""
    def __init__(self, length, hz):
        self.length, self.hz = length, hz
        self.frames = {}
        self.team, self.name, self.gk = {}, {}, set()

    def at(self, f):
        return self.frames.get(f)


def to_ours(X, Y, flip, length):
    if flip:
        X, Y = -X, -Y
    return metres_to_pitch(X, Y, length)


def picture(m, f, team, actor, flip):
    """Ball and everyone at frame f in the acting team's frame (ours)."""
    fr = m.at(f)
    if not fr or not fr[0]:
        return None
    (bx, by, bz), pl = fr
    ball = to_ours(bx, by, flip, m.length)
    people = []
    for pid, (x, y) in pl.items():
        if pid not in m.team:
            continue
        mate = m.team[pid] == team
        side = "you" if pid == actor else "mate" if mate else "keeper" if pid in m.gk else "opp"
        people.append((pid, side, to_ours(x, y, flip, m.length)))
    return ball, round(bz, 2), people


def nearest_frame(f, step):
    return int(round(f / step)) * step


def refine_shot(m, f0, actor, step, span):
    """The frame the ball leaves the shooter: near his feet, then gone 3+ m within 0.4 s."""
    best, bd = None, 1e9
    k = int(round(0.4 / STEP_S)) * step
    for f in range(f0 - span, f0 + span + 1, step):
        a, b = m.at(f), m.at(f + k)
        if not a or not a[0] or not b or not b[0] or actor not in a[1]:
            continue
        (bx, by, _), pl = a
        px, py = pl[actor]
        d = math.hypot(bx - px, by - py)
        moved = math.hypot(b[0][0] - bx, b[0][1] - by)
        if moved < 3:
            continue
        score = d + 0.15 * abs(f - f0) / step
        if score < bd:
            bd, best = score, f
    return best if best is not None and bd < 4 else None


def refine_corner(m, f0, step, span, after=None, latest=False):
    """The kick: of the frames the ball sits by a corner flag and then flies
    off, the one it is nearest the flag (the latest of those within 0.3 m of
    that). `after`: how far past f0 to look (default span)."""
    k = int(round(0.6 / STEP_S)) * step
    cands = []
    for f in range(f0 - span, f0 + (span if after is None else after) + 1, step):
        a, b = m.at(f), m.at(f + k)
        if not a or not a[0] or not b or not b[0]:
            continue
        bx, by, _ = a[0]
        if abs(abs(bx) - m.length / 2) > 3 or abs(by) < 26:
            continue
        if math.hypot(b[0][0] - bx, b[0][1] - by) > 4:
            cands.append((math.hypot(abs(bx) - m.length / 2, abs(by) - 34), f))
    if not cands:
        return None
    best = min(c[0] for c in cands)
    near = [f for dd, f in cands if dd <= best + 0.3]
    return max(near) if latest else min(near, key=lambda f: abs(f - f0))


def taker(m, f, team):
    fr = m.at(f)
    bx, by, _ = fr[0]
    mates = [(pid, xy) for pid, xy in fr[1].items() if m.team.get(pid) == team]
    return min(mates, key=lambda q: math.hypot(q[1][0] - bx, q[1][1] - by))[0] if mates else None


def track(m, f, team, actor, flip, win, step):
    k0, k1 = int(round(win[0] / STEP_S)), int(round(win[1] / STEP_S))
    ball, men = [], collections.OrderedDict()
    pics = []
    for k in range(k0, k1 + 1):
        pics.append(picture(m, f + k * step, team, actor, flip))
    # Who is in it: everyone seen at the event frame (index -k0).
    ev = pics[-k0]
    if not ev:
        return None
    for pid, side, _ in ev[2]:
        men[pid] = [side, m.name.get(pid, "")]
    last_ball = list(ev[0]) + [ev[1]]
    last = {pid: p for pid, _, p in ev[2]}
    rows = {pid: [] for pid in men}
    for p in pics:
        if p:
            last_ball = list(p[0]) + [p[1]]
            for pid, _, xy in p[2]:
                last[pid] = xy
        ball.append(last_ball)
        for pid in men:
            rows[pid].append(last.get(pid))
    # A man missing early in the window: his first seen spot.
    for pid, r in rows.items():
        first = next((v for v in r if v), None)
        rows[pid] = [v or first for v in r]
    return {
        "t0": win[0], "dt": STEP_S,
        "ball": [round(v, 1) for b in ball for v in (b[0], b[1], max(0.0, b[2]))],
        "men": [[men[pid][0], men[pid][1]] + [c for xy in rows[pid] for c in xy] for pid in men],
    }


def shot_end(m, f, team, actor, flip, step):
    """Where the shot went: where the ball crossed the goal line (x across, z up), else where it was 1 s on."""
    prev, keep = None, None
    for k in range(1, int(round(AFTER_S / STEP_S)) + 1):
        p = picture(m, f + k * step, team, actor, flip)
        if not p:
            continue
        (x, y), z = p[0], p[1]
        if y <= 0 and prev:
            (px, py), pz = prev
            g = py / max(1e-6, py - y)
            return [round(px + (x - px) * g, 2), 0], round(max(0.0, pz + (z - pz) * g), 2)
        prev = ((x, y), z)
        if k == int(round(1.0 / STEP_S)):
            keep = [x, y]
    return keep, None


def moment(m, f, team, actor, flip, meta, kind, step):
    pic = picture(m, f, team, actor, flip)
    if not pic:
        return None, None
    # The attacked goal is the one THEIR keeper stands in: a wrong period
    # direction (a keeper change, a mislabelled half) is caught here.
    gk = [xy for _, sd, xy in pic[2] if sd == "keeper"]
    if gk and gk[0][1] > 52.5:
        flip = not flip
        pic = picture(m, f, team, actor, flip)
    ball, bz, people = pic
    if not any(s == "you" for _, s, _ in people):
        return None, None
    ff = [[xy[0], xy[1], 1 if s == "mate" else 0, 1 if s == "keeper" else 0] for _, s, xy in people if s != "you"]
    rec = dict(meta, ball=ball, ff=ff, what=kind)
    if kind == "shot":
        end, endz = shot_end(m, f, team, actor, flip, step)
        rec["end"], rec["endZ"] = end, endz
        if rec.get("xg") is None:
            rec["xg"] = round(xg_of(XGW, xg_features(ball[0], ball[1], rec["body"] == "Head", rec["type"] == "Free Kick")), 3)
    tr = track(m, f, team, actor, flip, SHOT_WIN if kind == "shot" else CORNER_WIN, step)
    return rec, tr


# ---------------------------------------------------------------- IDSSE / DFL
ROLE_GK = "TW"


def dfl_info(path):
    r = ET.parse(path).getroot()
    g = r.find(".//General")
    env = r.find(".//Environment")
    m = Match(float(env.get("PitchX") or 105), 25)
    for t in r.iter("Team"):
        for p in t.iter("Player"):
            pid = p.get("PersonId")
            m.team[pid] = t.get("TeamId")
            m.name[pid] = known(p.get("FirstName"), p.get("LastName"), p.get("Shortname"))
            if p.get("PlayingPosition") == ROLE_GK:
                m.gk.add(pid)
    comp = "Bundesliga 2022/23" if g.get("CompetitionId") == "DFL-COM-000001" else "2. Bundesliga 2022/23"
    res = (g.get("Result") or "0:0").split(":")
    match = f"{g.get('HomeTeamName')} {res[0]}-{res[1]} {g.get('GuestTeamName')}"
    teams = {t.get("TeamId"): t.get("TeamName") for t in r.iter("Team")}
    return g.get("MatchId"), m, comp, match, teams


def dfl_positions(path, m):
    step = 5
    t0 = {}
    cur = None
    for ev, el in ET.iterparse(path, events=("start", "end")):
        if ev == "start" and el.tag == "FrameSet":
            cur = (el.get("GameSection"), el.get("TeamId"), el.get("PersonId"))
        elif ev == "end" and el.tag == "Frame":
            sec, team, pid = cur
            n = int(el.get("N"))
            if sec not in t0:
                t0[sec] = (n, ts(el.get("T")))
            if n % step == 0:
                slot = m.frames.get(n)
                if slot is None:
                    slot = m.frames[n] = [None, {}]
                if team == "BALL":
                    slot[0] = (float(el.get("X")), float(el.get("Y")), float(el.get("Z") or 0))
                elif team != "referee":
                    slot[1][pid] = (float(el.get("X")), float(el.get("Y")))
            el.clear()
        elif ev == "end" and el.tag == "FrameSet":
            el.clear()
    return t0


def dfl_flip(m, t0):
    """Section -> team -> attacks -X? (its keeper stands at +X)."""
    flips = {}
    secs = sorted(t0.items(), key=lambda kv: kv[1][0])
    for i, (sec, (n0, _)) in enumerate(secs):
        n1 = secs[i + 1][1][0] if i + 1 < len(secs) else 10 ** 9
        xs = collections.defaultdict(list)
        for n, (_, pl) in m.frames.items():
            if n0 <= n < n1 and n % 250 == 0:
                for pid, (x, _) in pl.items():
                    if pid in m.gk:
                        xs[m.team[pid]].append(x)
        flips[sec] = {t: sum(v) / len(v) > 0 for t, v in xs.items()}
    return flips


def dfl_section(t0, n):
    best = None
    for sec, (n0, _) in t0.items():
        if n >= n0 and (best is None or n0 > t0[best][0]):
            best = sec
    return best


SEC_BASE = {"firstHalf": 0, "secondHalf": 45, "firstHalfExtra": 90, "secondHalfExtra": 105}


def run_dfl():
    out, tracks, n_match = [], {}, 0
    for info in sorted(glob.glob(os.path.join(IDSSE, "DFL_02_01_matchinformation_*.xml"))):
        mid, m, comp, match, teams = dfl_info(info)
        pos = glob.glob(os.path.join(IDSSE, f"DFL_04_03_positions_raw_observed_*_{mid}.xml"))
        evf = glob.glob(os.path.join(IDSSE, f"DFL_03_02_events_raw_*_{mid}.xml"))
        if not pos or not evf:
            print("skip", mid); continue
        t0 = dfl_positions(pos[0], m)
        flips = dfl_flip(m, t0)
        root = ET.parse(evf[0]).getroot()
        evs = []
        for e in root.iter("Event"):
            for ch in e:
                if ch.tag in ("ShotAtGoal", "CornerKick", "Penalty"):
                    evs.append((e, ch))
        shots_at = []
        n_m = 0
        for e, ch in evs:
            sh = ch if ch.tag == "ShotAtGoal" else ch.find("ShotAtGoal") if ch.tag == "Penalty" else None
            t = ts(e.get("EventTime"))
            # frame from the event time (the tracking's clock), or the event's own frame
            cand = [(sec, n0 + round((t - tt) * 25)) for sec, (n0, tt) in t0.items() if t >= tt - 1]
            if not cand:
                continue
            sec, n = max(cand, key=lambda c: t0[c[0]][0])
            if e.get("CalculatedFrame"):
                n = int(e.get("CalculatedFrame")); sec = dfl_section(t0, n) or sec
            n = nearest_frame(n, 5)
            minute = SEC_BASE.get(sec, 0) + int((n - t0[sec][0]) / 25 // 60) + 1
            if sh is not None:
                team, actor = sh.get("Team"), sh.get("Player")
                if team not in flips.get(sec, {}):
                    continue
                f = refine_shot(m, n, actor, 5, 30)
                if f is None:
                    continue
                res = next((c.tag for c in sh.iter() if c is not sh), "")
                outcome = {"SuccessfulShot": "Goal", "SavedShot": "Saved", "BlockedShot": "Blocked", "ShotWide": "Off T", "ShotWoodWork": "Post"}.get(res, "Other")
                pen = ch.tag == "Penalty" or sh.get("BuildUp") == "penaltyKick"
                typ = "Penalty" if pen else "Free Kick" if sh.get("TakerSetup") == "ownSetPiece" and sh.get("BuildUp") == "freeKick" else "Corner" if sh.get("BuildUp") == "cornerKick" else "Open Play"
                body = {"head": "Head", "leftLeg": "Left Foot", "rightLeg": "Right Foot"}.get(sh.get("TypeOfShot"), "Other")
                meta = {"id": f"dfl{e.get('EventId')}", "src": "dfl", "comp": comp, "match": match, "minute": minute,
                        "player": m.name.get(actor, "?"), "team": teams.get(team, "?"),
                        "opp": next((v for k, v in teams.items() if k != team), "?"),
                        "outcome": outcome, "xg": float(sh.get("xG")) if sh.get("xG") else None, "body": body, "type": typ}
                if sh.get("CounterAttack") == "true":
                    meta["counter"] = 1
                rec, tr = moment(m, f, team, actor, flips[sec][team], meta, "shot", 5)
                if rec:
                    out.append(rec); tracks[rec["id"]] = tr; n_m += 1
                    shots_at.append((f, team, outcome))
            elif ch.tag == "CornerKick":
                team = ch.get("Team")
                if team not in flips.get(sec, {}):
                    continue
                f = refine_corner(m, n, 5, 100)
                if f is None:
                    continue
                fr = m.at(f)
                bx, by, _ = fr[0]
                mates = [(pid, xy) for pid, xy in fr[1].items() if m.team.get(pid) == team]
                if not mates:
                    continue
                actor = min(mates, key=lambda q: math.hypot(q[1][0] - bx, q[1][1] - by))[0]
                meta = {"id": f"dfl{e.get('EventId')}", "src": "dfl", "comp": comp, "match": match, "minute": minute,
                        "player": m.name.get(actor, "?"), "team": teams.get(team, "?"),
                        "opp": next((v for k, v in teams.items() if k != team), "?"), "type": "Corner",
                        "delivery": ch.get("Placing") or ""}
                rec, tr = moment(m, f, team, actor, flips[sec][team], meta, "corner", 5)
                if rec:
                    rec["_f"], rec["_team"] = f, team
                    out.append(rec); tracks[rec["id"]] = tr; n_m += 1
        # Did a corner lead to a shot (same team, within 12 s)?
        for rec in out:
            if rec.get("_f") is not None and rec["match"] == match:
                f, team = rec.pop("_f"), rec.pop("_team")
                hits = [o for g, t, o in shots_at if t == team and 0 <= g - f <= 12 * 25]
                rec["led"] = "goal" if "Goal" in hits else "shot" if hits else "no shot"
        n_match += 1
        print(mid, match, "moments", n_m, flush=True)
        del m
    return out, tracks, n_match


# ---------------------------------------------------------------- SkillCorner
SC_GK = {"GK"}


def run_sc():
    out, tracks, n_match = [], {}, 0
    for mp in sorted(glob.glob(os.path.join(SCM, "*_match.json"))):
        mid = os.path.basename(mp).split("_")[0]
        tp = os.path.join(SCT, f"{mid}.jsonl")
        ep = os.path.join(SCM, f"{mid}_dynamic_events.csv")
        if not os.path.exists(tp) or not os.path.exists(ep):
            print("skip", mid); continue
        mj = json.load(open(mp))
        m = Match(float(mj.get("pitch_length") or 105), 10)
        home, away = mj["home_team"]["id"], mj["away_team"]["id"]
        tname = {home: mj["home_team"]["short_name"] or mj["home_team"]["name"], away: mj["away_team"]["short_name"] or mj["away_team"]["name"]}
        for p in mj["players"]:
            m.team[p["id"]] = p["team_id"]
            m.name[p["id"]] = known(p.get("first_name"), p.get("last_name"), p.get("short_name"))
            if (p.get("player_role") or {}).get("acronym") in SC_GK:
                m.gk.add(p["id"])
        sides = mj.get("home_team_side") or ["left_to_right", "right_to_left"]
        period_of = {}
        with open(tp) as fh:
            for line in fh:
                d = json.loads(line)
                per = d.get("period")
                if per not in (1, 2, 3, 4):
                    continue
                fr = d["frame"]
                period_of[fr] = per
                if fr % 2:
                    continue
                b = d["ball_data"]
                ball = (b["x"], b["y"], b.get("z") or 0) if b.get("x") is not None else None
                m.frames[fr] = [ball, {p["player_id"]: (p["x"], p["y"]) for p in d["player_data"]}]
        match = f"{tname[home]} {mj['home_team_score']}-{mj['away_team_score']} {tname[away]}"
        comp = "A-League 2024/25"
        rows = list(csv.DictReader(open(ep)))
        n_m = 0
        for r in rows:
            if r["event_type"] != "player_possession":
                continue
            is_shot = r["end_type"] == "shot"
            is_corner = r["game_interruption_before"] == "corner_for"
            if not (is_shot or is_corner):
                continue
            team = int(r["team_id"]); actor = int(r["player_id"])
            per = int(r["period"]) if r["period"] else period_of.get(int(r["frame_end"]), 1)
            home_ltr = sides[min(per, 2) - 1] == "left_to_right"
            flip = (not home_ltr) if team == home else home_ltr
            minute = int(float(r["minute_start"] or 0)) + 1
            base = {"src": "skillcorner", "comp": comp, "match": match, "minute": minute,
                    "player": m.name.get(actor, r["player_name"]), "team": tname.get(team, r["team_shortname"]),
                    "opp": tname[away if team == home else home]}
            got = []
            if is_shot:
                f = refine_shot(m, nearest_frame(int(r["frame_end"]), 2), actor, 2, 6)
                if f is not None:
                    goal = r["game_interruption_after"] == "goal_for"
                    meta = dict(base, id=f"sc{mid}_{r['event_id']}", outcome="Goal" if goal else "Shot", xg=None, body="Foot",
                                type="Corner" if is_corner else "Open Play")
                    got.append(moment(m, f, team, actor, flip, meta, "shot", 2))
            if is_corner:
                # The possession after a corner is the man who RECEIVES it: the kick is up to 6 s before.
                f = refine_corner(m, nearest_frame(int(r["frame_start"]), 2), 2, 60, after=4, latest=True)
                taker_id = taker(m, f, team) if f is not None else None
                if taker_id is not None:
                    led = "goal" if r["game_interruption_after"] == "goal_for" else "shot" if is_shot else "no shot"
                    meta = dict(base, id=f"scc{mid}_{r['event_id']}", type="Corner", player=m.name.get(taker_id, "?"), led=led)
                    got.append(moment(m, f, team, taker_id, flip, meta, "corner", 2))
            for rec, tr in got:
                if rec:
                    out.append(rec); tracks[rec["id"]] = tr; n_m += 1
        n_match += 1
        print(mid, match, "moments", n_m, flush=True)
        del m
    return out, tracks, n_match


def main():
    a, ta, na = run_dfl()
    b, tb, nb = run_sc()
    moments = a + b
    meta = {
        "credit": {"dfl": CREDIT["dfl"], "skillcorner": CREDIT["skillcorner"]},
        "sources": {"dfl": f"IDSSE (Bassek et al., Sci Data 12, 195, 2025; https://doi.org/10.6084/m9.figshare.28196177), {na} matches, CC BY 4.0",
                    "skillcorner": f"SkillCorner Open Data (https://github.com/SkillCorner/opendata), {nb} matches, MIT, Copyright (c) 2020 SkillCorner"},
        "frame": "our pitch metres: x 0..68 from the attacker's left touchline, y from the attacked goal line (0) up the pitch",
        "what": "Every shot and corner with the ball and all 22 men at that instant (ff: [x, y, team-mate, opposing keeper]; the actor is not in it). "
                "tracks.json: per id, t0 (s from the event), dt (s), ball [x, y, z, ...], men [[side, name, x, y, x, y, ...]].",
    }
    write(os.path.join(OUT, "tracked.json"), {"meta": meta, "moments": moments})
    write(os.path.join(OUT, "tracks.json"), {"meta": {"credit": meta["credit"]}, "tracks": {**ta, **tb}})
    c = collections.Counter((r["src"], r["what"]) for r in moments)
    print(dict(c))


if __name__ == "__main__":
    main()
