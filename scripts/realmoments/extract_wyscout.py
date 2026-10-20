"""Real shots and real goals from the Wyscout public dataset (Pappalardo et al.
2019, CC BY 4.0) -> data/realmoments/wyscout_shots.json and wyscout_goals.json.

Every shot of the 2018 World Cup and Euro 2016 (2,905):
where it was struck (our pitch metres), who, when, body part, situation, what
happened, where it went in the goal mouth (Wyscout's 3 x 3 placement tags),
a chance-of-a-goal number from our own model (fitted here on all 1,941
matches' shots), and the last real passes of the same move with their timing.
Wyscout has no positions for anyone off the ball: those are placed by the
game's own scenario rules (lib/star/realMoments, "placed").

wyscout_goals.json: the World Cup and Euro goals (not penalties, not own
goals) with the match facts the Real Goals page shows (stage, date, the score
before, the final score, the conceding keeper's name, the whole move).

Input (never committed): the figshare files events.zip, matches.zip,
players.json, teams.json in one folder (https://doi.org/10.6084/m9.figshare.c.4415000.v5).

Usage: python3 -I scripts/realmoments/extract_wyscout.py RAW_DIR [REPO_ROOT]
"""
import collections, json, math, os, sys, zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rm_common import (CREDIT, CX, POST_L, POST_R, unesc, wy_to_pitch, xg_features, xg_of, write)  # noqa: E402

RAW = sys.argv[1]
ROOT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "data", "realmoments")

KEEP = {"World_Cup": "World Cup 2018", "European_Championship": "Euro 2016"}
ALL = ["England", "European_Championship", "France", "Germany", "Italy", "Spain", "World_Cup"]
PERIOD = {"1H": 0, "2H": 45, "E1": 90, "E2": 105}
PORDER = {"1H": 0, "2H": 1, "E1": 2, "E2": 3, "P": 4}
PLACE = {  # tag -> (across: -1 left .. 1 right as the shooter sees it, height: 0 low 1 middle 2 high, in/out/post)
    1201: (0, 0, "in"), 1202: (1, 0, "in"), 1203: (0, 1, "in"), 1204: (-1, 1, "in"), 1205: (-1, 0, "in"),
    1206: (1, 1, "in"), 1207: (0, 2, "in"), 1208: (-1, 2, "in"), 1209: (1, 2, "in"),
    1210: (1, 0, "out"), 1211: (-1, 1, "out"), 1212: (-1, 0, "out"), 1213: (1, 1, "out"), 1214: (0, 2, "out"),
    1215: (-1, 2, "out"), 1216: (1, 2, "out"),
    1217: (1, 0, "post"), 1218: (-1, 1, "post"), 1219: (-1, 0, "post"), 1220: (1, 1, "post"), 1221: (0, 2, "post"),
    1222: (-1, 2, "post"), 1223: (1, 2, "post"),
}
HIGH_PASS = {80, 83, 84}   # cross, high pass, launch
SET_PASS = {30, 31, 32, 34, 36}
WINDOW_S = 30


def tags(e):
    return {t["id"] for t in e.get("tags", [])}


def pos(e, i=0):
    p = e.get("positions") or []
    if len(p) > i:
        return float(p[i]["x"]), float(p[i]["y"])
    return (float(p[0]["x"]), float(p[0]["y"])) if p else None


def is_shot(e):
    return e["eventId"] == 10 or e["subEventId"] in (33, 35)


def clock(e):
    return PERIOD.get(e["matchPeriod"], 0) * 60 + e["eventSec"]


def load_events(name):
    with zipfile.ZipFile(os.path.join(RAW, "events.zip")) as z:
        with z.open(f"events_{name}.json") as f:
            return json.load(f)


def load_matches(name):
    with zipfile.ZipFile(os.path.join(RAW, "matches.zip")) as z:
        with z.open(f"matches_{name}.json") as f:
            return json.load(f)


def by_match(evs):
    out = collections.defaultdict(list)
    for e in evs:
        out[e["matchId"]].append(e)
    for v in out.values():
        v.sort(key=lambda e: (PORDER.get(e["matchPeriod"], 9), e["eventSec"]))
    return out


# ------------------------------------------------------------------ the xG model
def fit_xg():
    """Logistic regression on every non-penalty shot of all 7 competitions."""
    import numpy as np
    X, y, pens = [], [], [0, 0]
    for name in ALL:
        for e in load_events(name):
            if not is_shot(e):
                continue
            g = 101 in tags(e)
            if e["subEventId"] == 35:
                pens[0] += 1; pens[1] += g; continue
            p = pos(e)
            if not p:
                continue
            x, yy = wy_to_pitch(*p)
            X.append(xg_features(x, yy, 403 in tags(e), e["subEventId"] == 33)); y.append(1.0 if g else 0.0)
    X = np.array(X); y = np.array(y); w = np.zeros(X.shape[1])
    for _ in range(25):  # Newton's method
        p = 1 / (1 + np.exp(-X @ w))
        H = X.T @ (X * (p * (1 - p))[:, None]) + 1e-6 * np.eye(len(w))
        w -= np.linalg.solve(H, X.T @ (p - y))
    p = 1 / (1 + np.exp(-X @ w))
    print(f"xG model on {len(y)} shots: weights {np.round(w, 3).tolist()}, mean xG {p.mean():.3f} v goal rate {y.mean():.3f}; "
          f"penalties {pens[1]}/{pens[0]}", flush=True)
    return [float(v) for v in w], pens[1] / max(1, pens[0])


# ------------------------------------------------------------------ names
def player_names():
    out = {}
    for p in json.load(open(os.path.join(RAW, "players.json"), encoding="utf-8")):
        short = unesc(p.get("shortName", "")); first = unesc(p.get("firstName", "")); last = unesc(p.get("lastName", ""))
        known = short
        if ". " in short:  # "K. Mbappé" -> "Kylian Mbappé"
            sur = short.split(". ", 1)[1]
            known = f"{first.split()[0]} {sur}".strip() if first.split() else sur
        out[p["wyId"]] = {"known": known or f"{first} {last}".strip(), "gk": (p.get("role") or {}).get("code2") == "GK"}
    return out


def team_names():
    return {t["wyId"]: unesc(t["name"]) for t in json.load(open(os.path.join(RAW, "teams.json"), encoding="utf-8"))}


# ------------------------------------------------------------------ one shot
def shot_end(tg, outcome):
    hit = next((PLACE[t] for t in tg if t in PLACE), None)
    if not hit:
        return None, None
    a, h, where = hit
    if where == "in" or outcome == "Goal":
        x = CX + a * (POST_R - POST_L) / 2 * 0.62
        z = (0.35, 1.2, 2.0)[h]
    elif where == "post":
        x = POST_L if a < 0 else POST_R if a > 0 else CX
        z = (0.35, 1.2, 2.44)[h]
    else:
        x = POST_L - 1.6 if a < 0 else POST_R + 1.6 if a > 0 else CX
        z = (0.35, 1.2, 3.2)[h]
    return [round(x, 2), 0], z


def outcome_of(tg):
    if 101 in tg:
        return "Goal"
    if any(1217 <= t <= 1223 for t in tg):
        return "Post"
    if 2101 in tg:
        return "Blocked"
    if 1801 in tg:
        return "Saved"
    return "Off T"


def move_before(evs, i, names):
    """The shooting team's touches in the same move, oldest first, and where the move started."""
    s = evs[i]; team = s["teamId"]; seq = []
    for j in range(i - 1, -1, -1):
        e = evs[j]
        if e["matchPeriod"] != s["matchPeriod"] or s["eventSec"] - e["eventSec"] > WINDOW_S:
            break
        if e["teamId"] != team:
            if e["eventId"] == 1:  # a duel: both sides log one, the ball stays
                continue
            break
        if e["eventId"] in (5, 6, 2) or is_shot(e):  # stoppage, offside, foul, an earlier shot
            break
        if e["eventId"] in (8, 3, 7) and pos(e):
            seq.append(e)
            if e["eventId"] == 3:  # the move starts with this set piece
                break
    seq.reverse()
    return seq


def lead_of(evs, i, seq, names):
    s = evs[i]
    passes, move, path = [], [], []
    # A few Wyscout events carry the other team's frame (a pass "ending" 80 m
    # from where the next touch starts): the move is cut after the last such
    # break, so the build-up never flies the ball across the pitch.
    chain = seq + [s]
    for k in range(len(chain) - 2, -1, -1):
        a, b = chain[k], chain[k + 1]
        end = pos(a, 1) if (a["eventId"] == 8 or a["subEventId"] in SET_PASS or a["subEventId"] == 70) and pos(a, 1) else pos(a)
        p, q = wy_to_pitch(*end), wy_to_pitch(*pos(b))
        if math.hypot(p[0] - q[0], p[1] - q[1]) > 20:
            seq = seq[k + 1:]
            chain = seq + [s]
            break
    for k, e in enumerate(seq):
        back = round(s["eventSec"] - e["eventSec"], 2)
        a = wy_to_pitch(*pos(e))
        who = names.get(e["playerId"], {}).get("known", "")
        path.append([round(clock(e) / 60, 3), a[0], a[1]])
        is_pass = e["eventId"] == 8 or e["subEventId"] in SET_PASS
        if is_pass and pos(e, 1):
            b = wy_to_pitch(*pos(e, 1))
            nxt = chain[k + 1]
            rec = names.get(nxt["playerId"], {}).get("known", "")
            h = 2 if e["subEventId"] in HIGH_PASS or e["subEventId"] in (30, 32) else 1 if e["subEventId"] == 82 else 0
            move.append([back, "P", a, b, who, rec, h])
            if rec and nxt["playerId"] != e["playerId"]:
                passes.append([back, a, b, who, rec])
        elif e["eventId"] == 7 and e["subEventId"] == 70 and pos(e, 1):
            move.append([back, "C", a, wy_to_pitch(*pos(e, 1)), who, None, 0])
    return passes[-3:], path[-12:], move


def stage_names(matches):
    """roundId -> stage, from the group rounds (gameweek > 0) and the knockout rounds in date order."""
    ko = sorted({m["roundId"] for m in matches if m["gameweek"] == 0}, key=lambda r: min(x["dateutc"] for x in matches if x["roundId"] == r))
    names = ["Round of 16", "Quarter-finals", "Semi-finals", "Third place", "The final"] if len(ko) == 5 else ["Round of 16", "Quarter-finals", "Semi-finals", "The final"]
    out = {r: n for r, n in zip(ko, names)}
    for m in matches:
        if m["gameweek"] > 0:
            out[m["roundId"]] = "Group stage"
    return out


def main():
    w, pen_rate = fit_xg()
    names = player_names(); teams = team_names()
    shots, goals, counts = [], [], collections.Counter()
    for key, comp in KEEP.items():
        matches = {m["wyId"]: m for m in load_matches(key)}
        stages = stage_names(list(matches.values())) if key != "England" else {}
        for mid, evs in by_match(load_events(key)).items():
            m = matches.get(mid)
            if not m:
                continue
            side = {int(t): d["side"] for t, d in m["teamsData"].items()}
            home = next(int(t) for t, s in side.items() if s == "home"); away = next(int(t) for t, s in side.items() if s == "away")
            td = m["teamsData"]
            fin = [max(td[str(t)]["score"], td[str(t)].get("scoreET") or 0) for t in (home, away)]  # after extra time
            hn, an = teams.get(home, "?"), teams.get(away, "?")
            gks = {}
            for t, d in m["teamsData"].items():
                for p in (d.get("formation") or {}).get("lineup", []):
                    if names.get(p["playerId"], {}).get("gk"):
                        gks[int(t)] = names[p["playerId"]]["known"]
            score = [0, 0]
            for i, e in enumerate(evs):
                tg = tags(e)
                if 102 in tg and not is_shot(e):  # own goal: it counts for the other side
                    score[0 if e["teamId"] == away else 1] += 1
                    continue
                if not is_shot(e) or e["teamId"] not in (home, away) or not pos(e):
                    continue
                team = e["teamId"]; opp = away if team == home else home
                ball = wy_to_pitch(*pos(e))
                if ball[1] > 52.5:  # a "shot" from his own half: Wyscout's frame flipped on this event
                    counts["dropped (own half)"] += 1
                    if 101 in tg:
                        score[0 if team == home else 1] += 1
                    continue
                outcome = outcome_of(tg)
                end, endz = shot_end(tg, outcome)
                seq = move_before(evs, i, names)
                typ = ("Penalty" if e["subEventId"] == 35 else "Free Kick" if e["subEventId"] == 33
                       else "Corner" if seq and seq[0]["subEventId"] == 30 else "Open Play")
                head = 403 in tg
                xg = round(pen_rate, 3) if typ == "Penalty" else round(xg_of(w, xg_features(ball[0], ball[1], head, typ == "Free Kick")), 3)
                passes, path, move = lead_of(evs, i, seq, names)
                minute = int(clock(e) // 60) + 1
                sid = f"wy{e['id']}"
                rec = {
                    "id": sid, "src": "wyscout", "comp": comp, "match": f"{hn} {fin[0]}-{fin[1]} {an}", "minute": minute,
                    "player": names.get(e["playerId"], {}).get("known", "?"), "team": teams.get(team, "?"), "opp": teams.get(opp, "?"),
                    "outcome": outcome, "xg": xg, "body": "Head" if head else "Left Foot" if 401 in tg else "Right Foot" if 402 in tg else "Other",
                    "type": typ, "ball": ball, "end": end, "endZ": endz,
                }
                if 1901 in tg or any(1901 in tags(x) for x in seq):
                    rec["counter"] = 1
                if passes:
                    rec["lead"] = {"passes": passes, "path": path}
                shots.append(rec); counts[comp] += 1
                if outcome == "Goal":
                    before = list(score)
                    score[0 if team == home else 1] += 1
                    if key != "England" and typ != "Penalty":
                        goals.append({
                            "id": sid, "comp": comp, "home": hn, "away": an, "stage": stages.get(m["roundId"], ""),
                            "date": m["dateutc"][:10], "final": fin, "score": before, "keeper": gks.get(opp, ""),
                            "period": e["matchPeriod"], "move": move,
                        })
    shots.sort(key=lambda s: (s["comp"], s["match"], s["minute"]))
    meta = {"credit": CREDIT["wyscout"], "licence": "CC BY 4.0",
            "source": "Wyscout public dataset, Pappalardo et al., Scientific Data 6, 236 (2019), https://doi.org/10.6084/m9.figshare.c.4415000.v5",
            "xg_model": {"weights": [round(v, 4) for v in w], "features": "1, ln(distance m), goal-mouth angle (rad), header, direct free kick",
                         "penalty": round(pen_rate, 3)},
            "frame": "our pitch metres: x 0..68 from the attacker's left touchline, y from the attacked goal line"}
    write(os.path.join(OUT, "wyscout_shots.json"), {"meta": meta, "shots": shots})
    write(os.path.join(OUT, "wyscout_goals.json"), {"meta": meta, "goals": goals})
    print(dict(counts), "goals for Real Goals:", len(goals))


if __name__ == "__main__":
    main()
