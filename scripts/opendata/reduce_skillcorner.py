"""Reduce SkillCorner Open Data (20 A-League 2024/25 matches, MIT licence) to
data/opendata/skillcorner_tracking.json and data/opendata/skillcorner_phases.json.

Input (downloaded by hand, never committed): a folder with, per match id,
{id}_match.json, {id}_dynamic_events.csv, {id}_phases_of_play.csv and
{id}.jsonl (= {id}_tracking_extrapolated.jsonl, ~90 MB, Git LFS) from
https://github.com/SkillCorner/opendata

Usage: python3 -I scripts/opendata/reduce_skillcorner.py META_DIR TRACKING_DIR [REPO_ROOT]
"""
import collections, csv, glob, json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import GRID_DOC, quantiles, write  # noqa: E402
from tracking_common import TrackAcc  # noqa: E402

META, TRK = sys.argv[1], sys.argv[2]
ROOT = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "data", "opendata")
HZ = 10
SAMPLE = 2  # 5 Hz

CREDIT = ("Data: SkillCorner Open Data (https://github.com/SkillCorner/opendata), Copyright (c) 2020 SkillCorner, "
          "MIT licence. Broadcast tracking, dynamic events and phases of play for 20 A-League 2024/25 matches. "
          "Reduced to aggregate patterns by Knowitball.")
MIT = ("Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated "
       "documentation files (the \"Software\"), to deal in the Software without restriction ... The above copyright "
       "notice and this permission notice shall be included in all copies or substantial portions of the Software.")

ROLE = {"GK": "GK", "LCB": "CB", "RCB": "CB", "CB": "CB", "LB": "LB", "LWB": "LB", "RB": "RB", "RWB": "RB",
        "DM": "DM", "LDM": "DM", "RDM": "DM", "LM": "LW", "RM": "RW", "AM": "AM", "LW": "LW", "LF": "LW",
        "RW": "RW", "RF": "RW", "CF": "ST"}


def f(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def tracking(mid, acc, sub_roles):
    m = json.load(open(os.path.join(META, f"{mid}_match.json")))
    home, away = m["home_team"]["id"], m["away_team"]["id"]
    team_of = {}; role_of = {}
    for p in m["players"]:
        team_of[p["id"]] = p["team_id"]
        r = ROLE.get(p["player_role"]["acronym"]) or sub_roles.get(p["id"])
        role_of[p["id"]] = r or "?"
    sides = m.get("home_team_side") or ["left_to_right", "right_to_left"]
    path = os.path.join(TRK, f"{mid}.jsonl")
    xy = collections.defaultdict(dict)  # pid -> frame -> (x, y)
    n = 0
    with open(path) as fh:
        for line in fh:
            d = json.loads(line)
            per = d.get("period")
            if per not in (1, 2):
                continue
            fr = d["frame"]
            for p in d["player_data"]:
                xy[p["player_id"]][fr] = (p["x"], p["y"])
            if fr % SAMPLE:
                continue
            b = d["ball_data"]
            if b.get("x") is None:
                continue
            g = (d.get("possession") or {}).get("group")
            poss = home if g == "home team" else away if g == "away team" else None
            home_ltr = sides[per - 1] == "left_to_right"
            flip = {home: not home_ltr, away: home_ltr}
            players = [(team_of.get(p["player_id"]), role_of.get(p["player_id"], "?"), p["x"], p["y"])
                       for p in d["player_data"] if p["player_id"] in team_of]
            acc.frame(players, (b["x"], b["y"]), poss, flip)
            n += 1
    for pid, frames in xy.items():
        if pid not in team_of:
            continue
        ks = sorted(frames)
        sp = []
        for a, b in zip(ks, ks[5:]):  # speed over 0.5 s
            if b - a == 5:
                (x1, y1), (x2, y2) = frames[a], frames[b]
                sp.append(math.hypot(x2 - x1, y2 - y1) / 0.5)
        acc.player_speeds(role_of.get(pid, "?"), sp, HZ)
    return n


def main():
    ids = sorted(int(os.path.basename(p).split("_")[0]) for p in glob.glob(os.path.join(META, "*_match.json")))
    acc = TrackAcc()
    D = collections.defaultdict
    ph_in = D(lambda: D(list)); ph_out = D(lambda: D(list)); pair = D(float); nxt = D(collections.Counter)
    runs = D(collections.Counter); run_stats = D(lambda: D(list))
    eng = D(collections.Counter); eng_out = D(collections.Counter); chains = []
    poss_end = D(collections.Counter); poss_start = collections.Counter(); poss_stats = D(lambda: D(list))
    line_height = D(list); pressure = D(collections.Counter)
    n_tracked = 0; frames = 0
    for mid in ids:
        # ---- phases of play
        rows = list(csv.DictReader(open(os.path.join(META, f"{mid}_phases_of_play.csv"))))
        for i, r in enumerate(rows):
            ti, to = r["team_in_possession_phase_type"], r["team_out_of_possession_phase_type"]
            dur = f(r["duration"]) or 0
            a = ph_in[ti]
            a["seconds"].append(dur); a["shot"].append(r["team_possession_lead_to_shot"] == "True")
            a["goal"].append(r["team_possession_lead_to_goal"] == "True"); a["loss"].append(r["team_possession_loss_in_phase"] == "True")
            a["player_possessions"].append(f(r["n_player_possessions_in_phase"]) or 0)
            a["width_m"].append(f(r["team_in_possession_width_start"]) or 0); a["length_m"].append(f(r["team_in_possession_length_start"]) or 0)
            a["start_third"].append(r["third_start"])
            o = ph_out[to]
            o["seconds"].append(dur); o["width_m"].append(f(r["team_out_of_possession_width_start"]) or 0)
            o["length_m"].append(f(r["team_out_of_possession_length_start"]) or 0)
            pair[(ti, to)] += dur
            if i + 1 < len(rows):
                r2 = rows[i + 1]
                same = r2["team_in_possession_id"] == r["team_in_possession_id"]
                nxt[ti][(r2["team_in_possession_phase_type"] if same else "TURNOVER->" + r2["team_in_possession_phase_type"])] += 1
        # ---- dynamic events
        ev = list(csv.DictReader(open(os.path.join(META, f"{mid}_dynamic_events.csv"))))
        sub_roles = {}
        cnt = D(collections.Counter)
        for e in ev:
            pid = e["player_id"]; r = ROLE.get(e["player_position"])
            if pid and r:
                cnt[int(pid)][r] += 1
        for pid, c in cnt.items():
            sub_roles[pid] = c.most_common(1)[0][0]
        for e in ev:
            t = e["event_type"]; role = ROLE.get(e["player_position"], "?"); third = e["third_start"]
            if t == "off_ball_run":
                st = e["event_subtype"]
                runs[role][st] += 1
                s = run_stats[st]
                s["distance_m"].append(f(e["distance_covered"]) or 0); s["speed_kmh"].append(f(e["speed_avg"]) or 0)
                s["seconds"].append(f(e["duration"]) or 0)
                s["targeted"].append(e["targeted"] == "True"); s["received"].append(e["received"] == "True")
                s["lead_to_shot"].append(e["lead_to_shot"] == "True"); s["third"].append(third)
                s["phase"].append(e["team_in_possession_phase_type"])
            elif t == "on_ball_engagement":
                st = e["event_subtype"]
                eng[third][st] += 1
                for k in ("force_backward", "stop_possession_danger", "reduce_possession_danger", "beaten_by_possession",
                          "beaten_by_movement"):
                    eng_out[st][k] += e[k] == "True"
                eng_out[st]["n"] += 1
                if e["index_in_pressing_chain"] in ("1", "1.0") and f(e["pressing_chain_length"]):
                    chains.append((f(e["pressing_chain_length"]), e["pressing_chain_end_type"]))
            elif t == "player_possession":
                poss_end[third][e["end_type"]] += 1
                poss_start[e["start_type"]] += 1
                s = poss_stats[third]
                s["seconds"].append(f(e["duration"]) or 0)
                s["one_touch"].append(e["one_touch"] == "True"); s["carry"].append(e["carry"] == "True")
                s["passing_options"].append(f(e["n_passing_options"]) or 0)
                s["pass_distance_m"].append(f(e["pass_distance"])) if f(e["pass_distance"]) is not None else None
                s["pass_forward"].append(e["pass_direction"] == "forward") if e["pass_direction"] else None
                s["pass_ok"].append(e["pass_outcome"] == "successful") if e["pass_outcome"] else None
                pressure[third][e["overall_pressure_start"] or "?"] += 1
                lh = f(e["last_defensive_line_height_start"])
                if lh is not None:
                    line_height[e["team_out_of_possession_phase_type"]].append(lh)
        # ---- tracking
        if os.path.exists(os.path.join(TRK, f"{mid}.jsonl")):
            frames += tracking(mid, acc, sub_roles); n_tracked += 1
            print(mid, "tracked", flush=True)

    def share(v):
        return round(sum(1 for x in v if x) / len(v), 3) if v else None

    def summ(d):
        out = {}
        for k, v in d.items():
            if not v:
                continue
            if isinstance(v[0], bool):
                out[k + "_rate"] = share(v)
            elif isinstance(v[0], str):
                c = collections.Counter(v); out[k] = {kk: round(vv / len(v), 3) for kk, vv in c.most_common()}
            else:
                out[k] = quantiles(v, (0.25, 0.5, 0.75))
        out["n"] = len(next(iter(d.values()))) if d else 0
        return out
    total = sum(pair.values()) or 1
    meta = {"source": "SkillCorner Open Data, A-League 2024/25", "credit": CREDIT, "licence": "MIT", "licence_text": MIT,
            "matches": len(ids), "grid": GRID_DOC}
    write(os.path.join(OUT, "skillcorner_phases.json"), {
        "meta": meta,
        "what": "SkillCorner's own match-phase labels and dynamic events. in_possession / out_of_possession: per phase "
                "type, how long it lasts, how often it gives a shot / goal / loss, team width and length. time_share: "
                "share of ball-in-play time spent in each (attacking phase, defending phase) pair. next_phase: what "
                "follows each attacking phase (TURNOVER-> = the other team now has the ball). off_ball_runs: run types "
                "per role and how often a run is picked out. on_ball_engagements: pressing actions by third (third of "
                "the ball, attacking team's view) and what they achieve. player_possessions: one player's time on the "
                "ball by third. back_line_height_m: SkillCorner's last-defensive-line height by defending phase",
        "in_possession": {k: summ(v) for k, v in ph_in.items()},
        "out_of_possession": {k: summ(v) for k, v in ph_out.items()},
        "time_share": {f"{a}|{b}": round(v / total, 4) for (a, b), v in sorted(pair.items(), key=lambda kv: -kv[1])},
        "next_phase": {k: dict(v.most_common()) for k, v in nxt.items()},
        "off_ball_runs": {"by_role": {k: dict(v.most_common()) for k, v in runs.items()},
                          "by_type": {k: summ(v) for k, v in run_stats.items()}},
        "on_ball_engagements": {"by_third": {k: dict(v.most_common()) for k, v in eng.items()},
                                "outcomes": {k: {kk: (round(vv / v["n"], 3) if kk != "n" else vv) for kk, vv in v.items()} for k, v in eng_out.items()},
                                "pressing_chain_length": quantiles([c[0] for c in chains]),
                                "pressing_chain_end": dict(collections.Counter(c[1] for c in chains).most_common())},
        "player_possessions": {"start_type": dict(poss_start.most_common()),
                               "end_type_by_third": {k: dict(v.most_common()) for k, v in poss_end.items()},
                               "by_third": {k: summ(v) for k, v in poss_stats.items()},
                               "pressure_at_start_by_third": {k: dict(v.most_common()) for k, v in pressure.items()}},
        "back_line_height_m": {k: quantiles(v) for k, v in line_height.items()}})
    out = acc.dump()
    meta2 = dict(meta, matches_tracked=n_tracked, sampled_hz=HZ / SAMPLE)
    out.update({"meta": meta2,
                "what": "Same layout as idsse_tracking.json (see there), from broadcast tracking (players off camera are "
                        "extrapolated by SkillCorner). Speeds are measured over 0.5 s from 10 Hz positions."})
    write(os.path.join(OUT, "skillcorner_tracking.json"), out)


if __name__ == "__main__":
    main()
