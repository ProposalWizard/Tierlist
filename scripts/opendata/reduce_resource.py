"""Re-source every number the game used to take from a licensed data set
(sim rebuild piece 1, 21 Oct 2026). Writes two small aggregate files:

  data/opendata/wyscout_shot_outcomes.json   Wyscout events (CC BY 4.0) + the
      PlayeRank role file (CC BY 4.0): shot outcomes by kind, distance and
      body part; keeper save % by distance and goal-mouth zone; headers and
      volleys; a forward's touches by area.
  data/opendata/tracked_shot_shapes.json     DFL + SkillCorner tracking (the
      shots in data/realmoments/tracked.json; PRO matches only, Harry's D7):
      back line, its width and slide, the keeper's depth and shade, defenders
      in the box, men in the shot's lane, who attacks the posts at corners.

Raw input (downloaded by hand, never committed):
  RAW/events.zip      figshare 7770599 (Wyscout events, 1,941 matches)
  RAW/playerank.json  figshare 9361148 (PlayeRank roles, 46,897 player-matches)

Usage: python3 -I scripts/opendata/reduce_resource.py RAW [REPO_ROOT]
Only averages, shares and counts are written: no single match or player.
"""
import json, math, os, statistics as st, sys, zipfile
from collections import Counter, defaultdict

RAW = sys.argv[1]
ROOT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "data", "opendata")

WY_CREDIT = ("Wyscout event data via Pappalardo, L., Cintia, P., Rossi, A. et al. A public data set of spatio-temporal "
             "match events in soccer competitions. Sci Data 6, 236 (2019). https://doi.org/10.1038/s41597-019-0247-7 - "
             "data: https://doi.org/10.6084/m9.figshare.c.4415000.v5 - licensed CC BY 4.0. Player roles from its PlayeRank "
             "file (Pappalardo et al., ACM TIST 2019; figshare 9361148), CC BY 4.0. Reduced to aggregates by Knowitball (changes made).")


def pct(a, b):
    return round(100.0 * a / b, 1) if b else None


def q(xs, p):
    xs = sorted(xs)
    k = (len(xs) - 1) * p
    f, c = math.floor(k), math.ceil(k)
    return xs[f] + (xs[c] - xs[f]) * (k - f)


# ───────────────────────── Wyscout ─────────────────────────
def geo(x, y):
    dx, dy = (100 - x) * 1.05, (50 - y) * 0.68
    return math.hypot(dx, dy), dy


def inbox(x, y):
    return x >= 84.3 and 20.35 <= y <= 79.65


def wyscout():
    roles, mins = {}, defaultdict(float)
    for r in json.load(open(os.path.join(RAW, "playerank.json"))):
        roles[(r["matchId"], r["playerId"])] = r["roleCluster"]
        mins[r["roleCluster"]] += r["minutesPlayed"]
    Z = zipfile.ZipFile(os.path.join(RAW, "events.zip"))
    touch = defaultdict(Counter)
    shots, matches = [], set()
    for name in Z.namelist():
        ev = json.load(Z.open(name))
        last, lastsp = None, {}
        for e in ev:
            matches.add(e["matchId"])
            tg = {t["id"] for t in e["tags"]}
            x, y = e["positions"][0]["x"], e["positions"][0]["y"]
            eid, sid = e["eventId"], e["subEventId"]
            if eid == 3 and sid in (30, 31, 32, 34):
                lastsp[e["teamId"]] = (e["matchPeriod"], e["eventSec"])
            role = roles.get((e["matchId"], e["playerId"]))
            if role and (eid in (8, 10, 7) or sid in (10, 11)) and eid != 3:
                D, _ = geo(x, y)
                touch[role]["box" if inbox(x, y) else ("deep" if D >= 35 else "middle")] += 1
            if eid == 10 or sid in (33, 35):
                D, lat = geo(x, y)
                hi = False
                if (last and last["teamId"] == e["teamId"] and last["matchPeriod"] == e["matchPeriod"]
                        and e["eventSec"] - last["eventSec"] < 4 and last["eventId"] == 8):
                    hi = 801 in {t["id"] for t in last["tags"]} or last["subEventId"] == 82
                sp = lastsp.get(e["teamId"])
                shots.append(dict(k="pen" if sid == 35 else ("dfk" if sid == 33 else "shot"),
                                  head=403 in tg, d=D, lat=lat, goal=101 in tg, on=1801 in tg, blk=2101 in tg,
                                  z=next((t for t in tg if 1201 <= t <= 1209), None), hi=hi, box=inbox(x, y),
                                  open=not (sp and sp[0] == e["matchPeriod"] and e["eventSec"] - sp[1] < 10)))
            if eid not in (5, 9):
                last = e
        del ev
    M = len(matches)
    op = [s for s in shots if s["k"] == "shot"]
    foot = [s for s in op if not s["head"]]

    def outcome(rows):
        n = len(rows)
        return {"n": n, "scored": pct(sum(s["goal"] for s in rows), n), "on_target": pct(sum(s["on"] for s in rows), n),
                "blocked": pct(sum(s["blk"] for s in rows), n)}

    def saved(rows):
        r = [s for s in rows if s["on"]]
        return {"n": len(r), "saved": pct(sum(not s["goal"] for s in r), len(r))}

    def band(rows, edges):
        return {f"{lo}-{hi if hi < 99 else ''}".rstrip("-") + ("+" if hi >= 99 else ""): saved([s for s in rows if lo <= s["d"] < hi])
                for lo, hi in edges}

    # goal-mouth zones: Wyscout's left/right are the shooter's; far low corner = the low corner on the other side.
    def far_low(s): return 1202 if s["lat"] > 0 else 1205
    def near_low(s): return 1205 if s["lat"] > 0 else 1202
    chan = [s for s in foot if s["box"] and abs(s["lat"]) > 5.5]
    zones = {
        "far_low_corner_from_box_channel": saved([s for s in chan if s["z"] == far_low(s)]),
        "far_low_corner_from_box_channel_under_12m": saved([s for s in chan if s["d"] < 12 and s["z"] == far_low(s)]),
        "near_low_corner_from_box_channel": saved([s for s in chan if s["z"] == near_low(s)]),
        "top_corners_12_18m": saved([s for s in foot if 12 <= s["d"] < 18 and s["z"] in (1208, 1209)]),
        "central_12_18m": saved([s for s in foot if 12 <= s["d"] < 18 and s["z"] in (1201, 1203, 1207)]),
        "dead_centre_12_18m": saved([s for s in foot if 12 <= s["d"] < 18 and s["z"] == 1203]),
        "central_column_all": saved([s for s in op if s["z"] in (1201, 1203, 1207)]),
        "side_columns_all": saved([s for s in op if s["z"] in (1202, 1204, 1205, 1206, 1208, 1209)]),
    }

    def tight(s):
        return s["box"] and abs(s["lat"]) > 9.16 and math.sqrt(max(0.0, s["d"] ** 2 - s["lat"] ** 2)) < 11

    kinds = {
        "penalty": outcome([s for s in shots if s["k"] == "pen"]),
        "direct_free_kick": outcome([s for s in shots if s["k"] == "dfk"]),
        "long_range_foot_20_28m": outcome([s for s in foot if 20 <= s["d"] < 28]),
        "tight_angle_foot": outcome([s for s in foot if tight(s)]),
        "header_all": outcome([s for s in op if s["head"]]),
        "header_open_play": outcome([s for s in op if s["head"] and s["open"]]),
        "foot_off_a_high_ball_open_play": outcome([s for s in foot if s["hi"] and s["open"]]),
        "all_open_play_shots": outcome(op),
    }
    pure = [s for s in op if s["open"]]
    gp = sum(s["goal"] for s in pure)
    by_dist = {}
    for lo, hi in [(0, 6), (6, 11), (11, 16), (16, 25)]:
        r = [s for s in pure if lo <= s["d"] < hi]
        by_dist[f"{lo}-{hi}"] = {"foot_ground": outcome([s for s in r if not s["head"] and not s["hi"]]),
                                 "header": outcome([s for s in r if s["head"]]),
                                 "foot_off_a_high_ball": outcome([s for s in r if not s["head"] and s["hi"]])}
    near = {}
    for lim in (60, 20, 16):
        r = [s for s in pure if s["d"] <= lim]
        g = [s for s in r if s["goal"]]
        near[f"within_{lim}m"] = {"shots": len(r), "header_share_shots": pct(sum(s["head"] for s in r), len(r)),
                                  "header_share_goals": pct(sum(s["head"] for s in g), len(g)),
                                  "high_ball_foot_share_shots": pct(sum((not s["head"]) and s["hi"] for s in r), len(r))}
    allnp = [s for s in shots if s["k"] != "pen"]
    G = sum(s["goal"] for s in allnp)
    heads = [s for s in allnp if s["head"]]
    fw = {}
    for role in ("central FW", "left FW", "right FW"):
        c, m90 = touch[role], mins[role] / 90
        n = sum(c.values())
        fw[role] = {"per_90": round(n / m90, 1), "deep_35m_plus": pct(c["deep"], n), "middle_18_35m": pct(c["middle"], n),
                    "box": pct(c["box"], n), "deep_per_90": round(c["deep"] / m90, 1)}
    return M, {
        "meta": {"source": "Wyscout public dataset (Pappalardo et al. 2019) + PlayeRank roles", "credit": WY_CREDIT,
                 "credit_ids": ["wyscout-patterns", "wyscout-roles"], "licence": "CC BY 4.0", "matches": M,
                 "made": "scripts/opendata/reduce_resource.py, 21 Oct 2026",
                 "definitions": {
                     "shot": "event 10 (run of play); direct free kick 3/33; penalty 3/35",
                     "distance": "metres from the goal's middle, x * 1.05, y * 0.68",
                     "on_target": "tag 1801 (a ball cleared off the line counts as on target)",
                     "saved": "1 - goals / on target (approximate: Wyscout has no 'saved' outcome on the shot)",
                     "header": "tag 403 (head/body)",
                     "off_a_high_ball": "the side's previous action, under 4 s before, was a pass tagged high (801) or a high pass (8/82): the free stand-in for a volley",
                     "open_play": "no corner or free kick by the shooting side in the 10 s before the shot",
                     "touches": "pass, shot, other touch, ground attacking duel or air duel; set pieces left out; box = the penalty area, deep = 35 m+ from goal",
                 }},
        "keeper_save_pct_by_distance": {
            "all_shots_test_bands": band(op, [(0, 12), (12, 22), (22, 99)]),
            "foot_test_bands": band(foot, [(0, 12), (12, 22), (22, 99)]),
            "all_shots_plan_bands": band(op, [(0, 11), (11, 20), (20, 99)]),
            "all_shots_fine": band(op, [(0, 8), (8, 12), (12, 16), (16, 22), (22, 28), (28, 99)]),
            "overall": saved(op),
            "on_target_from_22m_plus_scored": pct(sum(s["goal"] for s in op if s["on"] and s["d"] >= 22), sum(1 for s in op if s["on"] and s["d"] >= 22)),
        },
        "keeper_save_pct_by_goal_mouth_zone_foot": zones,
        "by_kind": kinds,
        "open_play_by_distance": by_dist,
        "open_play_near_goal": near,
        "headers": {"share_of_shots": pct(len(heads), len(allnp)), "share_of_goals": pct(sum(s["goal"] for s in heads), G),
                    "per_match": round(len(heads) / M, 2), "open_play_per_match": round(sum(1 for s in heads if s["k"] == "shot" and s["open"]) / M, 2),
                    "set_piece_phase_share_of_all_shots": pct(sum(not s["open"] for s in op), len(op))},
        "forward_touches_by_area": fw,
    }


# ───────────────────────── tracking ─────────────────────────
def tracking():
    CX, BL, BR = 34.0, 34.0 - 20.16, 34.0 + 20.16
    d = json.load(open(os.path.join(ROOT, "data", "realmoments", "tracked.json")))
    PRO = {"dfl", "skillcorner"}
    ms = [m for m in d["moments"] if m["what"] == "shot" and m["src"] in PRO and m.get("type") in ("Open Play", None)]
    opp = lambda m: [(x, y) for x, y, mate, kp in m["ff"] if not mate and not kp]
    kpr = lambda m: next(((x, y) for x, y, mate, kp in m["ff"] if kp), None)
    dist = lambda m: math.hypot(m["ball"][0] - CX, m["ball"][1])
    inb = lambda m: sum(1 for x, y in opp(m) if BL <= x <= BR and 0 <= y <= 16.5)

    def back4(m):
        o = sorted(opp(m), key=lambda p: p[1])[:4]
        return o if len(o) == 4 else None

    r4, r1, shifts = [], [], []
    for m in ms:
        by = m["ball"][1]
        if 16 <= by <= 35 and back4(m):
            o = back4(m)
            r4.append(st.mean(p[1] for p in o) / by)
            r1.append(o[0][1] / by)
            shifts.append((st.mean(p[0] for p in o) - CX, m["ball"][0] - CX))
    spans = {}
    for lo, hi in [(8, 16), (16, 22), (22, 28), (28, 40)]:
        s = [max(p[0] for p in back4(m)) - min(p[0] for p in back4(m)) for m in ms if lo <= m["ball"][1] < hi and back4(m)]
        spans[f"{lo}-{hi}"] = {"n": len(s), "median": round(st.median(s), 1), "p25": round(q(s, .25), 1), "p75": round(q(s, .75), 1)}
    depth = {}
    for lo, hi in [(0, 8), (8, 12), (12, 22), (22, 99), (20, 30)]:
        k = [kpr(m)[1] for m in ms if kpr(m) and lo <= dist(m) < hi]
        depth[f"{lo}-{hi if hi < 99 else ''}".rstrip("-") + ("+" if hi >= 99 else "")] = {
            "n": len(k), "median": round(st.median(k), 2), "p10": round(q(k, .1), 2), "p90": round(q(k, .9), 2)}
    sh = [(kpr(m)[0] - CX, m["ball"][0] - CX) for m in ms if kpr(m) and dist(m) >= 12]
    bands = {"six": (1, 5.5), "golden": (5.5, 11), "spot": (11, 16.5), "edge": (16.5, 22), "range": (22, 30), "deep": (30, 38)}
    box = {}
    for b, (lo, hi) in bands.items():
        c = [inb(m) for m in ms if lo <= m["ball"][1] < hi]
        box[b] = {"n": len(c), "median": st.median(c), "p10": round(q(c, .1)), "p90": round(q(c, .9))}

    def intri(p, a, b, c):
        def sg(p1, p2, p3): return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
        d1, d2, d3 = sg(p, a, b), sg(p, b, c), sg(p, c, a)
        return not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0))
    lane, mates = [], []
    for m in ms:
        if 16 <= dist(m) <= 25:
            b, a1, a2 = tuple(m["ball"]), (CX - 3.66, 0), (CX + 3.66, 0)
            lane.append(sum(1 for p in opp(m) if intri(p, b, a1, a2)))
            mates.append(sum(1 for x, y, mt, kp in m["ff"] if mt and intri((x, y), b, a1, a2)))
    counters = [m for m in ms if m.get("counter")]
    cor = [m for m in d["moments"] if m["what"] == "corner" and m["src"] in PRO]
    near = far = 0
    for m in cor:
        side = -1 if m["ball"][0] < CX else 1
        at = [(x, y) for x, y, mt, kp in m["ff"] if mt]
        near += any(y <= 6 and 0 <= side * (x - CX) <= 9.16 for x, y in at)
        far += any(y <= 6 and 0 < -side * (x - CX) <= 9.16 for x, y in at)
    return {
        "meta": {"source": "DFL (IDSSE, Bassek et al. 2025, 7 matches) and SkillCorner Open Data (20 A-League matches), "
                           "the shots in data/realmoments/tracked.json; pro matches only (SoccerTrack's university matches left out, Harry D7)",
                 "credit_ids": ["dfl-moments", "skillcorner-moments"], "licence": "CC BY 4.0 (DFL) / MIT (SkillCorner)",
                 "shots": len(ms), "made": "scripts/opendata/reduce_resource.py, 21 Oct 2026",
                 "frame": "our pitch metres: y from the attacked goal line, x 0..68; back four = the four deepest outfield defenders"},
        "back_line_over_ball_y_16_35m": {"n": len(r4), "median": round(st.median(r4), 3), "mean": round(st.mean(r4), 3),
                                          "p25": round(q(r4, .25), 3), "deepest_man_mean": round(st.mean(r1), 3)},
        "back_four_span_m_by_ball_y": spans,
        "block_shift_x_ball_lateral": round(sum(a * b for a, b in shifts) / sum(b * b for a, b in shifts), 2),
        "keeper_off_line_m_by_shot_distance": depth,
        "keeper_shade_x_ball_lateral_12m_plus": round(sum(a * b for a, b in sh) / sum(b * b for a, b in sh), 2),
        "defenders_in_box_by_ball_y_band": box,
        "shot_lane_16_25m": {"n": len(lane), "opponents_median": st.median(lane), "opponents_p75": q(lane, .75),
                             "opponents_at_most_3_pct": pct(sum(v <= 3 for v in lane), len(lane)),
                             "team_mate_in_lane_pct": pct(sum(v >= 1 for v in mates), len(mates)),
                             "more_than_one_team_mate_pct": pct(sum(v > 1 for v in mates), len(mates))},
        "counter_shots": {"n": len(counters), "share_pct": pct(len(counters), len(ms)),
                          "defenders_in_box_median": st.median([inb(m) for m in counters]) if counters else None},
        "corners_attacker_at_post_pct": {"n": len(cor), "near_post_six_yard_half": pct(near, len(cor)), "far_post_six_yard_half": pct(far, len(cor))},
    }


if __name__ == "__main__":
    M, wy = wyscout()
    tr = tracking()
    for name, obj in (("wyscout_shot_outcomes.json", wy), ("tracked_shot_shapes.json", tr)):
        with open(os.path.join(OUT, name), "w") as f:
            json.dump(obj, f, indent=1, ensure_ascii=False)
            f.write("\n")
        print("wrote", name, os.path.getsize(os.path.join(OUT, name)), "bytes")
