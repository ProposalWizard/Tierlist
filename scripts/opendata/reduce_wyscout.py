"""Reduce the Wyscout public dataset (Pappalardo et al. 2019, CC BY 4.0) to
small pattern files in data/opendata/wyscout_*.json.

Input (downloaded by hand, never committed): a folder holding the figshare
files events_*.json, matches_*.json, players.json, teams.json
(https://doi.org/10.6084/m9.figshare.c.4415000.v5).

Usage: python3 -I scripts/opendata/reduce_wyscout.py RAW_DIR [REPO_ROOT]

The game only ever reads AVERAGES and PATTERNS from these files - never a
single real match, team or player.
"""
import collections, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (GRID_DOC, N_COARSE, N_FINE, coarse, fine, metres, norm,  # noqa: E402
                    quantiles, hist, write, clamp)

RAW = sys.argv[1]
ROOT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "data", "opendata")

CREDIT = ("Wyscout event data via Pappalardo, L., Cintia, P., Rossi, A. et al. A public data set "
          "of spatio-temporal match events in soccer competitions. Sci Data 6, 236 (2019). "
          "https://doi.org/10.1038/s41597-019-0247-7 - data: https://doi.org/10.6084/m9.figshare.c.4415000.v5 "
          "- licensed CC BY 4.0. Reduced to aggregate patterns by Knowitball (changes made).")

COMPS = os.environ.get("WY_COMPS", "").split(",") if os.environ.get("WY_COMPS") else ["England", "France", "Germany", "Italy", "Spain", "European_Championship", "World_Cup"]
LEAGUES = {"England", "France", "Germany", "Italy", "Spain"}
TIERS = ["top", "mid", "bottom", "intl"]
PERIOD_BASE = {"1H": 0, "2H": 45, "E1": 90, "E2": 105}

ONBALL = {8, 10, 3, 7}          # Pass, Shot, Free Kick, Others on the ball
PASS_TYPES = {80: "cross", 81: "hand", 82: "head", 83: "high", 84: "launch", 85: "simple", 86: "smart"}
FK_TYPES = {30: "corner", 31: "free_kick", 32: "fk_cross", 33: "fk_shot", 34: "goal_kick", 35: "penalty", 36: "throw_in"}
PLACEMENT = {1201: "low_centre", 1202: "low_right", 1203: "centre", 1204: "centre_left", 1205: "low_left",
             1206: "centre_right", 1207: "high_centre", 1208: "high_left", 1209: "high_right"}
ROLE = {}


def tags(e):
    return {t["id"] for t in e.get("tags", [])}


def pos(e, i=0):
    p = e.get("positions") or []
    if len(p) > i:
        return float(p[i]["x"]), float(p[i]["y"])
    if p:
        return float(p[0]["x"]), float(p[0]["y"])
    return None


def minute(e):
    return PERIOD_BASE.get(e["matchPeriod"], 0) + e["eventSec"] / 60.0


def is_shot(e):
    return e["eventId"] == 10 or e["subEventId"] in (33, 35)


def in_box(x, y):
    return x >= 84 and 19 <= y <= 81


# --------------------------------------------------------------------------- accumulators
def zeros(n):
    return [0] * n


class Acc:
    def __init__(self):
        D = collections.defaultdict
        self.matches = D(int)
        self.starts = D(lambda: zeros(N_FINE))                 # (tier, start_type) -> fine counts
        self.start_shot = D(lambda: [zeros(N_COARSE), zeros(N_COARSE)])  # (tier,type)->[n, shot]
        self.att = D(lambda: D(list))                          # (tier, outcome) -> metric -> vals
        self.pass_hist = D(lambda: zeros(16))
        self.counter = D(lambda: [0, 0, 0])                    # tier -> [poss, shots, goals]
        self.act = D(lambda: [collections.Counter() for _ in range(N_COARSE)])
        self.pass_to = D(lambda: [zeros(N_COARSE) for _ in range(N_COARSE)])
        self.carry_to = D(lambda: [zeros(N_COARSE) for _ in range(N_COARSE)])
        self.pass_len = D(lambda: [[] for _ in range(N_COARSE)])
        self.shot_grid = D(lambda: [zeros(100), zeros(100)])   # tier -> [shots, goals] 10x10 over x50-100
        self.shot_sit = D(lambda: collections.Counter())       # tier -> situation -> shots
        self.goal_sit = D(lambda: collections.Counter())
        self.shot_body = collections.Counter(); self.goal_body = collections.Counter()
        self.assist = collections.Counter(); self.assist_goal = collections.Counter()
        self.assist_zone = D(lambda: zeros(N_COARSE))          # assist type -> origin zone
        self.placement = [collections.Counter(), collections.Counter()]  # on target, goals
        self.dist_bins = [zeros(12), zeros(12)]                 # shot distance m (0..60 by 5) [shots, goals]
        self.corner_end = [zeros(N_FINE), zeros(N_FINE)]        # [deliveries, led to shot]
        self.corner = collections.Counter()
        self.fk = [collections.Counter() for _ in range(N_COARSE)]
        self.fk_direct = [zeros(8), zeros(8)]                   # distance bins 15..55 by 5m [shots, goals]
        self.throw_len = []; self.throw = collections.Counter()
        self.gk_end = zeros(10); self.gk = collections.Counter()
        self.pen = [0, 0]
        self.def_grid = D(lambda: zeros(N_FINE))               # tier -> defensive action fine grid (own frame)
        self.def_height = D(list); self.ppda = D(list)
        self.regain_x = D(list)
        self.high_regain = D(lambda: [0, 0])                   # tier -> [regains x>=60, shot]
        self.flow = [collections.Counter() for _ in range(19)]  # 5-min bins, 90+ last
        self.state = D(lambda: collections.Counter())          # state -> shots, goals, passes, minutes
        self.home = collections.Counter()
        self.per_match = D(list)
        self.tier_team = D(lambda: D(list))                    # tier -> metric -> per team-match vals
        self.matchup = D(lambda: D(list))                      # "tierA_v_tierB" -> metric -> vals
        self.role_on = D(lambda: zeros(N_FINE)); self.role_def = D(lambda: zeros(N_FINE))


A = Acc()


# --------------------------------------------------------------------------- tiers
def league_tiers(matches):
    pts = collections.Counter(); games = collections.Counter()
    for m in matches:
        sides = list(m["teamsData"].values())
        if len(sides) != 2:
            continue
        a, b = sides
        ga, gb = a["score"], b["score"]
        for t, g1, g2 in ((a, ga, gb), (b, gb, ga)):
            games[t["teamId"]] += 1
            pts[t["teamId"]] += 3 if g1 > g2 else 1 if g1 == g2 else 0
    order = sorted(games, key=lambda t: -pts[t] / games[t])
    n = len(order)
    return {t: ("top" if i < n * 0.3 else "mid" if i < n * 0.7 else "bottom") for i, t in enumerate(order)}


# --------------------------------------------------------------------------- one match
def segment(evs):
    """Split a match into possessions: list of dicts with team, events, start type, end reason."""
    poss = []; cur = None; pending = "kick_off"
    for i, e in enumerate(evs):
        eid = e["eventId"]
        if eid in (5, 6) or eid == 2:  # interruption, offside, foul -> possession ends
            if cur:
                cur["end"] = {5: "out", 6: "offside", 2: "foul"}[eid]
                if eid == 2 and e["teamId"] != cur["team"]:
                    cur["end"] = "foul_won"
                poss.append(cur); cur = None
            pending = "restart"
            continue
        if eid not in ONBALL:
            continue
        if cur is None or e["teamId"] != cur["team"]:
            if cur:
                cur["end"] = "lost"; poss.append(cur)
            if eid == 3:
                st = FK_TYPES.get(e["subEventId"], "free_kick")
            elif pending == "kick_off" or (pos(e) and abs(pos(e)[0] - 50) < 2 and abs(pos(e)[1] - 50) < 3 and pending == "restart"):
                st = "kick_off" if pending in ("kick_off", "restart") and pos(e) and abs(pos(e)[0] - 50) < 2 else "open_play"
            else:
                st = "open_play"
            cur = {"team": e["teamId"], "ev": [], "start": st, "period": e["matchPeriod"]}
            pending = None
        cur["ev"].append(e)
        if is_shot(e):
            cur["end"] = "shot"; poss.append(cur); cur = None
            pending = "kick_off" if 101 in tags(e) else "restart"
    if cur:
        cur["end"] = "lost"; poss.append(cur)
    return poss


def do_match(m, evs, tier_of, comp):
    sides = list(m["teamsData"].values())
    if len(sides) != 2:
        return
    tid = [s["teamId"] for s in sides]
    home = [s["teamId"] for s in sides if s["side"] == "home"]
    home = home[0] if home else tid[0]
    tier = {t: tier_of.get(t, "intl") for t in tid}
    opp = {tid[0]: tid[1], tid[1]: tid[0]}
    evs = [e for e in evs if e["matchPeriod"] in PERIOD_BASE]
    evs.sort(key=lambda e: (list(PERIOD_BASE).index(e["matchPeriod"]), e["eventSec"]))
    if not evs:
        return
    for t in tid:
        A.matches[tier[t]] += 0.5
    poss = segment(evs)

    # ---- per-team match counters
    tm = {t: collections.Counter() for t in tid}
    # ---- possessions
    for p in poss:
        t = p["team"]; T = tier[t]; ev = p["ev"]
        if not ev:
            continue
        sx, sy = pos(ev[0])
        tags_all = set().union(*[tags(e) for e in ev])
        shot = any(is_shot(e) for e in ev)
        goal = any(is_shot(e) and 101 in tags(e) for e in ev)
        out = "goal" if goal else "shot" if shot else p["end"]
        st = p["start"]
        A.starts[(T, st)][fine(sx, sy)] += 1
        A.starts[("all", st)][fine(sx, sy)] += 1
        z = coarse(sx, sy)
        for key in ((T, st), ("all", st)):
            A.start_shot[key][0][z] += 1
            A.start_shot[key][1][z] += 1 if shot else 0
        passes = [e for e in ev if e["eventId"] == 8 or e["subEventId"] in (30, 31, 32, 34, 36)]
        dur = max(0.0, ev[-1]["eventSec"] - ev[0]["eventSec"]) if ev[-1]["matchPeriod"] == ev[0]["matchPeriod"] else 0
        xs = [pos(e, i)[0] for e in ev for i in (0, 1) if pos(e, i)]
        maxx = max(xs)
        endx = pos(ev[-1], 1)[0] if ev[-1]["eventId"] == 8 and 1801 in tags(ev[-1]) else pos(ev[-1])[0]
        fwd = max(0.0, (maxx - sx) * 1.05)
        rec = {"passes": len(passes), "seconds": dur, "forward_m": fwd, "start_x": sx, "max_x": maxx}
        if dur >= 2 and fwd > 0:
            rec["speed_mps"] = fwd / dur
        keys = (out, "all", "sustained") if len(ev) >= 3 else (out, "all")
        for k in keys:
            for kk, vv in rec.items():
                A.att[(T, k)][kk].append(vv); A.att[("all", k)][kk].append(vv)
        A.pass_hist[(T, out)][min(15, len(passes))] += 1
        A.pass_hist[("all", out)][min(15, len(passes))] += 1
        tm[t]["possessions"] += 1
        tm[t]["final_third"] += 1 if maxx >= 66.7 else 0
        tm[t]["box_entries"] += 1 if any(in_box(*pos(e, 1)) for e in ev if pos(e, 1) and e["eventId"] == 8 and 1801 in tags(e)) else 0
        if 1901 in tags_all:
            A.counter[T][0] += 1; A.counter[T][1] += shot; A.counter[T][2] += goal
        if st == "open_play":
            A.regain_x[T].append(sx)
            if sx >= 60:
                A.high_regain[T][0] += 1; A.high_regain[T][1] += shot
        # ---- transitions
        for i, e in enumerate(ev):
            s = pos(e)
            if not s:
                continue
            fz = coarse(*s)
            et = e["eventId"]
            if is_shot(e):
                A.act[T][fz]["shot"] += 1; A.act["all"][fz]["shot"] += 1
            elif et == 8 or e["subEventId"] in (30, 31, 32, 34, 36):
                ok = 1801 in tags(e)
                kind = PASS_TYPES.get(e["subEventId"], FK_TYPES.get(e["subEventId"], "pass"))
                lab = ("pass_ok" if ok else "pass_lost")
                for k in (T, "all"):
                    A.act[k][fz][lab] += 1; A.act[k][fz]["type_" + kind] += 1
                d = pos(e, 1)
                if ok and d:
                    for k in (T, "all"):
                        A.pass_to[k][fz][coarse(*d)] += 1
                        A.pass_len[k][fz].append(metres(d[0] - s[0], d[1] - s[1]))
            elif et == 7 and e["subEventId"] == 70:  # acceleration = a run with the ball
                d = pos(e, 1)
                if d:
                    for k in (T, "all"):
                        A.act[k][fz]["carry"] += 1; A.carry_to[k][fz][coarse(*d)] += 1
            # an implied carry between this action's end and the next one's start
            if i + 1 < len(ev):
                a = pos(e, 1) if et == 8 else pos(e, 1) if et == 7 else None
                b = pos(ev[i + 1])
                if a and b and ev[i + 1]["eventId"] != 7 and metres(b[0] - a[0], b[1] - a[1]) > 5:
                    za = coarse(*a)
                    for k in (T, "all"):
                        A.act[k][za]["carry"] += 1; A.carry_to[k][za][coarse(*b)] += 1
        last = ev[-1]
        if not is_shot(last) and pos(last):
            lab = {"lost": "lost", "out": "out", "foul_won": "fouled", "offside": "offside", "foul": "lost"}.get(p["end"], "lost")
            if last["eventId"] == 8 and 1801 not in tags(last):
                lab = None  # already counted as pass_lost
            if lab:
                z0 = coarse(*(pos(last, 1) or pos(last)))
                A.act[T][z0]["end_" + lab] += 1; A.act["all"][z0]["end_" + lab] += 1
        # ---- shots / chances
        for i, e in enumerate(ev):
            if not is_shot(e):
                continue
            x, y = pos(e); g = 101 in tags(e); tg = tags(e)
            sit = ("penalty" if e["subEventId"] == 35 else "direct_free_kick" if e["subEventId"] == 33
                   else "from_corner" if st == "corner" else "from_free_kick" if st in ("free_kick", "fk_cross")
                   else "from_throw_in" if st == "throw_in" else "counter" if 1901 in tags_all else "open_play")
            for k in (T, "all"):
                A.shot_sit[k][sit] += 1; A.goal_sit[k][sit] += g
            if sit == "penalty":
                A.pen[0] += 1; A.pen[1] += g
                continue
            ix = min(9, max(0, int((x - 50) / 5))); iy = min(9, int(clamp(y) / 10))
            for k in (T, "all"):
                A.shot_grid[k][0][ix * 10 + iy] += 1; A.shot_grid[k][1][ix * 10 + iy] += g
            dist = metres(100 - x, 50 - y)
            b = min(11, int(dist / 5))
            A.dist_bins[0][b] += 1; A.dist_bins[1][b] += g
            body = "head" if 403 in tg else "left" if 401 in tg else "right" if 402 in tg else "other"
            A.shot_body[body] += 1; A.goal_body[body] += g
            pl = [PLACEMENT[t] for t in tg if t in PLACEMENT]
            if pl:
                A.placement[0][pl[0]] += 1; A.placement[1][pl[0]] += g
            if sit == "direct_free_kick":
                fb = min(7, max(0, int((dist - 15) / 5))); A.fk_direct[0][fb] += 1; A.fk_direct[1][fb] += g
                continue
            prev = ev[i - 1] if i > 0 else None
            if prev is None:
                at = "first_touch_of_possession"
            elif prev["eventId"] == 8 or prev["subEventId"] in (30, 31, 32, 36):
                at = PASS_TYPES.get(prev["subEventId"], FK_TYPES.get(prev["subEventId"], "pass"))
                if at == "simple" and 901 in tags(prev):
                    at = "through"
                if at == "smart":
                    at = "through"
            elif prev["eventId"] == 7:
                at = "dribble_or_touch"
            else:
                at = "other"
            if prev is not None and prev["eventId"] == 8:
                a = pos(prev, 1)
                if a and metres(x - a[0], y - a[1]) > 5:
                    at += "+carry"
            A.assist[at] += 1; A.assist_goal[at] += g
            if prev is not None and pos(prev):
                A.assist_zone[at][coarse(*pos(prev))] += 1
        # ---- set pieces
        e0 = ev[0]
        if st == "corner":
            d = pos(e0, 1)
            if d:
                A.corner_end[0][fine(*d)] += 1; A.corner_end[1][fine(*d)] += shot
                A.corner["short" if not in_box(*d) else "into_box"] += 1
            A.corner["total"] += 1; A.corner["shot_in_possession"] += shot; A.corner["goal_in_possession"] += goal
            if len(ev) > 1 and is_shot(ev[1]):
                A.corner["first_contact_shot"] += 1
                A.corner["first_contact_header"] += 403 in tags(ev[1])
        elif st in ("free_kick", "fk_cross", "fk_shot"):
            fz = coarse(*pos(e0))
            A.fk[fz][{"fk_shot": "shot", "fk_cross": "cross"}.get(st, "pass")] += 1
            A.fk[fz]["shot_in_possession"] += shot; A.fk[fz]["goal_in_possession"] += goal
        elif st == "throw_in":
            d = pos(e0, 1); s0 = pos(e0)
            if d:
                A.throw_len.append(metres(d[0] - s0[0], d[1] - s0[1]))
                A.throw["forward"] += d[0] > s0[0] + 2
            A.throw["total"] += 1; A.throw["kept"] += len(ev) > 1 or shot; A.throw["shot"] += shot
        elif st == "goal_kick":
            d = pos(e0, 1)
            if d:
                A.gk_end[min(9, int(d[0] / 10))] += 1
                A.gk["short"] += d[0] < 33
            A.gk["total"] += 1; A.gk["kept_3plus"] += len(ev) >= 3; A.gk["shot"] += shot
    # ---- defending / pressing (positions are in the acting team's own frame)
    dacts = collections.Counter(); dx = collections.defaultdict(list); opp_build = collections.Counter()
    for e in evs:
        t = e["teamId"]; s = pos(e)
        if not s or t not in tier:
            continue
        tg = tags(e); sub = e["subEventId"]
        defensive = (sub in (12, 10) and 703 in tg) or sub == 71 or 1401 in tg or e["eventId"] == 2
        if e["eventId"] == 8 and s[0] < 60:
            opp_build[t] += 1
        if defensive:
            A.def_grid[tier[t]][fine(*s)] += 1; A.def_grid["all"][fine(*s)] += 1
            dx[t].append(s[0])
            if s[0] >= 40:
                dacts[t] += 1
        role = ROLE.get(e.get("playerId"))
        if role:
            if defensive:
                A.role_def[role][fine(*s)] += 1
            elif e["eventId"] in (8, 10, 7):
                A.role_on[role][fine(*s)] += 1
    for t in tid:
        if dx[t]:
            A.def_height[tier[t]].append(sum(dx[t]) / len(dx[t]))
        if dacts[t]:
            A.ppda[tier[t]].append(opp_build[opp[t]] / dacts[t])
    # ---- per-team match stats, flow and game state
    goals_t = []
    for e in evs:
        tg = tags(e)
        if is_shot(e) and 101 in tg:
            goals_t.append((minute(e), e["teamId"]))
        elif 102 in tg:  # own goal
            goals_t.append((minute(e), opp.get(e["teamId"], e["teamId"])))
    goals_t.sort()
    gi = 0; score = {t: 0 for t in tid}; last_min = 0.0
    for e in evs:
        mn = minute(e)
        while gi < len(goals_t) and goals_t[gi][0] < mn:
            score[goals_t[gi][1]] += 1; gi += 1
        t = e["teamId"]
        if t not in score:
            continue
        stt = "drawing" if score[t] == score[opp[t]] else "leading" if score[t] > score[opp[t]] else "trailing"
        if e["matchPeriod"] in ("1H", "2H"):
            b = min(18, int(mn // 5))
            if is_shot(e):
                A.flow[b]["shots"] += 1; A.flow[b]["goals"] += 101 in tags(e)
            if e["eventId"] == 8:
                A.flow[b]["passes"] += 1
            if e["eventId"] == 2:
                A.flow[b]["fouls"] += 1
        if is_shot(e):
            A.state[stt]["shots"] += 1; A.state[stt]["goals"] += 101 in tags(e)
            tm[t]["shots"] += 1; tm[t]["goals"] += 101 in tags(e)
            tm[t]["shots_in_box"] += in_box(*pos(e)) if pos(e) else 0
        if e["eventId"] == 8:
            A.state[stt]["passes"] += 1; tm[t]["passes"] += 1
            tm[t]["passes_ok"] += 1801 in tags(e)
        if e["subEventId"] == 30:
            tm[t]["corners"] += 1
        if e["eventId"] == 2:
            tm[t]["fouls"] += 1
        # minutes in each state, credited once per event gap to the team of this event and its opponent
        if mn > last_min and mn - last_min < 5:
            gap = mn - last_min
            for side in tid:
                s2 = "drawing" if score[side] == score[opp[side]] else "leading" if score[side] > score[opp[side]] else "trailing"
                A.state[s2]["team_minutes"] += gap
        last_min = mn
    tot_pass = sum(tm[t]["passes"] for t in tid) or 1
    for t in tid:
        c = tm[t]; T = tier[t]; c["pass_share"] = c["passes"] / tot_pass
        c["pass_accuracy"] = c["passes_ok"] / c["passes"] if c["passes"] else 0
        for k in ("shots", "goals", "passes", "pass_share", "pass_accuracy", "corners", "fouls",
                  "possessions", "final_third", "box_entries", "shots_in_box"):
            A.tier_team[T][k].append(c[k]); A.tier_team["all"][k].append(c[k])
            if comp in LEAGUES:
                A.matchup[f"{T}_v_{tier[opp[t]]}"][k].append(c[k])
        side = "home" if t == home else "away"
        A.home[side + "_shots"] += c["shots"]; A.home[side + "_goals"] += c["goals"]; A.home[side + "_n"] += 1
    A.per_match["goals"].append(sum(tm[t]["goals"] for t in tid))
    A.per_match["shots"].append(sum(tm[t]["shots"] for t in tid))
    A.per_match["passes"].append(sum(tm[t]["passes"] for t in tid))
    A.per_match["corners"].append(sum(tm[t]["corners"] for t in tid))
    A.per_match["fouls"].append(sum(tm[t]["fouls"] for t in tid))
    A.per_match["possessions"].append(sum(tm[t]["possessions"] for t in tid))


# --------------------------------------------------------------------------- run
def main():
    for p in json.load(open(os.path.join(RAW, "players.json"))):
        ROLE[p["wyId"]] = p.get("role", {}).get("code2")
    n_matches = 0; n_events = 0; per_comp = {}
    for comp in COMPS:
        mf = os.path.join(RAW, f"matches_{comp}.json")
        ef = os.path.join(RAW, f"events_{comp}.json")
        matches = json.load(open(mf))
        tier_of = league_tiers(matches) if comp in LEAGUES else {}
        evs = json.load(open(ef))
        by = collections.defaultdict(list)
        for e in evs:
            by[e["matchId"]].append(e)
        n_events += len(evs); del evs
        k = 0
        for m in matches:
            if m["wyId"] in by:
                do_match(m, by[m["wyId"]], tier_of, comp); k += 1
        per_comp[comp] = k; n_matches += k
        print(comp, k, "matches", flush=True)
        del by
    meta = {"source": "Wyscout public dataset (Pappalardo et al. 2019)", "credit": CREDIT,
            "licence": "CC BY 4.0", "matches": n_matches, "events": n_events, "per_competition": per_comp,
            "tiers": "league teams split by points per game inside their own league season: top = best 30%, "
                     "mid = next 40%, bottom = last 30%; intl = World Cup 2018 and Euro 2016 teams",
            "grid": GRID_DOC}
    save(meta)


def matrix(rows):
    return [norm(r, 3) for r in rows]


def save(meta):
    tiers = ["all"] + TIERS
    # possessions / starts
    starts = {}
    for (T, st), v in A.starts.items():
        starts.setdefault(T, {})[st] = {"n": sum(v), "fine": norm(v)}
    shotp = {}
    for (T, st), (n, s) in A.start_shot.items():
        shotp.setdefault(T, {})[st] = {"n": n, "shot_rate": [round(b / a, 3) if a >= 30 else None for a, b in zip(n, s)]}
    write(os.path.join(OUT, "wyscout_possession_starts.json"), {
        "meta": meta, "what": "Where possessions start (fine grid share) and how often a possession starting in "
        "each coarse zone ends in a shot, by start type and team tier",
        "start_counts": starts, "shot_rate_by_start_zone": shotp})
    # attacks
    att = {}
    for (T, out), d in A.att.items():
        att.setdefault(T, {})[out] = {k: quantiles(v) for k, v in d.items()}
    ph = {}
    for (T, out), v in A.pass_hist.items():
        ph.setdefault(T, {})[out] = v
    ctr = {T: {"possessions": v[0], "shots": v[1], "goals": v[2],
               "per_team_match": round(v[0] / max(1, A.matches[T] * 2), 2)} for T, v in A.counter.items()}
    write(os.path.join(OUT, "wyscout_attacks.json"), {
        "meta": meta, "what": "Possession (attack) length, duration, forward metres, speed and how far up the "
        "pitch they get, by tier and outcome (goal / shot / lost / out / foul_won / foul / offside / all; sustained = every possession of 3+ on-ball actions). A possession changes whenever the other team makes an on-ball action (pass, shot, free kick, touch/clearance), so many are one-touch scraps. "
        "passes_hist: count of possessions by number of passes 0..15+",
        "attacks": att, "passes_hist": ph, "counter_attacks": ctr})
    # transitions
    tr = {}
    for T in tiers:
        if T not in A.act:
            continue
        zones = []
        for z in range(N_COARSE):
            c = A.act[T][z]; tot = sum(v for k, v in c.items() if not k.startswith("type_"))
            zones.append({"n": tot,
                          "action": {k: round(v / tot, 4) for k, v in sorted(c.items()) if not k.startswith("type_") and tot},
                          "pass_types": {k[5:]: v for k, v in sorted(c.items()) if k.startswith("type_")},
                          "pass_len_m": quantiles(A.pass_len[T][z], (0.25, 0.5, 0.75))})
        tr[T] = {"zones": zones, "pass_to": matrix(A.pass_to[T]), "carry_to": matrix(A.carry_to[T])}
    write(os.path.join(OUT, "wyscout_transitions.json"), {
        "meta": meta, "what": "For a team in possession, per COARSE zone (30): what the next on-ball action is "
        "(pass_ok, pass_lost, carry, shot, end_* = possession ended there) as shares, pass types, pass length; "
        "pass_to / carry_to = row-normalised 30x30 destination matrices (row = from zone). A carry is a Wyscout "
        "'acceleration' or a gap of more than 5 m between a reception and the receiver's next action.",
        "by_tier": tr})
    # chances
    sg = {}
    for T, (s, g) in A.shot_grid.items():
        sg[T] = {"shots": s, "goals": g}
    sit = {T: {k: {"shots": v, "goals": A.goal_sit[T][k]} for k, v in c.items()} for T, c in A.shot_sit.items()}
    tt = {T: {k: quantiles(v, (0.25, 0.5, 0.75)) for k, v in d.items()} for T, d in A.tier_team.items()}
    write(os.path.join(OUT, "wyscout_chances.json"), {
        "meta": meta, "what": "Shots: situation, grid (x 50..100 in 10 bands of 5, y in 10 bands of 10; id = ix*10+iy; "
        "penalties left out), distance (m, 5 m bins), body part, the action before the shot and its zone, "
        "goal-mouth placement (from the shooter's view)",
        "situations": sit, "grid": sg,
        "distance_m_bins": {"edges": list(range(0, 65, 5)), "shots": A.dist_bins[0], "goals": A.dist_bins[1]},
        "body": {k: {"shots": v, "goals": A.goal_body[k]} for k, v in A.shot_body.items()},
        "before_shot": {k: {"shots": v, "goals": A.assist_goal[k], "from_zone": A.assist_zone[k]} for k, v in A.assist.items()},
        "placement": {k: {"on_target_or_post": v, "goals": A.placement[1][k]} for k, v in A.placement[0].items()},
        "penalties": {"taken": A.pen[0], "scored": A.pen[1]}})
    write(os.path.join(OUT, "wyscout_set_pieces.json"), {
        "meta": meta, "what": "Corners (where the delivery lands on the fine grid, and whether that possession got a "
        "shot), free kicks by coarse zone (shot / cross / pass and outcome), direct free-kick goal rate by "
        "distance (15..55 m, 5 m bins), throw-ins and goal kicks",
        "corners": dict(A.corner, landing=A.corner_end[0], landing_led_to_shot=A.corner_end[1]),
        "free_kicks_by_zone": [dict(c) for c in A.fk],
        "direct_free_kicks_by_distance": {"edges_m": list(range(15, 60, 5)), "shots": A.fk_direct[0], "goals": A.fk_direct[1]},
        "throw_ins": dict(A.throw, length_m=quantiles(A.throw_len)),
        "goal_kicks": dict(A.gk, end_x_hist_10=A.gk_end)})
    write(os.path.join(OUT, "wyscout_defending.json"), {
        "meta": meta, "what": "Where teams win the ball and defend, in the DEFENDING team's own frame (x 100 = the "
        "goal it attacks, so a high x is a high press). Defensive actions = won defending/air duels, clearances, "
        "interceptions, fouls. def_height = mean x of a team's defensive actions in one match. PPDA = opponent "
        "passes in their own 60% / our defensive actions in their 60% (lower = more pressing). regain_x = x where "
        "open-play possessions start. high_regains = regains at x>=60 and how many became a shot",
        "defensive_actions_fine": dict(A.def_grid),
        "def_height": {T: quantiles(v) for T, v in A.def_height.items()},
        "ppda": {T: quantiles(v) for T, v in A.ppda.items()},
        "regain_x": {T: quantiles(v) for T, v in A.regain_x.items()},
        "high_regains": {T: {"n": v[0], "shot": v[1]} for T, v in A.high_regain.items()}})
    nm = sum(A.matches.values())
    write(os.path.join(OUT, "wyscout_match_flow.json"), {
        "meta": meta, "what": "Per 5-minute bin (bin 18 = 90+ incl. stoppage), totals over all matches: shots, goals, "
        "passes, fouls; divide by matches for per-match rates. game_state = shots/goals/passes made while the acting "
        "team was leading/drawing/trailing and team-minutes spent in that state. per_match = whole-match totals; "
        "team_match = one team's numbers in one match, by tier; matchup = same, by own tier v opponent tier "
        "(leagues only)",
        "matches": round(nm), "bins_5min": [dict(c) for c in A.flow],
        "game_state": {k: {kk: round(vv, 1) for kk, vv in v.items()} for k, v in A.state.items()},
        "home_away": dict(A.home),
        "per_match": {k: quantiles(v) for k, v in A.per_match.items()},
        "team_match": tt,
        "matchup": {k: {kk: quantiles(vv, (0.25, 0.5, 0.75)) for kk, vv in d.items()} for k, d in A.matchup.items()}})
    write(os.path.join(OUT, "wyscout_roles.json"), {
        "meta": meta, "what": "Where each role (GK / DF / MD / FW, from the Wyscout player list) makes its on-ball "
        "actions (pass/shot/others) and its defensive actions, fine grid counts, own frame",
        "on_ball": dict(A.role_on), "defensive": dict(A.role_def)})


if __name__ == "__main__":
    main()
