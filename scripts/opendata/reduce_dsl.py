"""Reduce the Afriskaut Dynasty Scouting League 2024 open data (136 Nigerian
grassroots/academy league matches, event data with x/y, Apache 2.0) to
data/opendata/dsl_patterns.json - a LOWER-LEVEL football reference next to the
elite Wyscout numbers.

Input (downloaded by hand, never committed): the unzipped Datasets.zip from
https://github.com/Afriskaut/dynasty-scouting-league-2024-open-data
(Datasets/<MatchID>/{match.json, events.jsonl}).

The files' stated starting directions do not match the shot locations in about
a third of matches, so each team's direction per half is worked out from its
own forward passes (97% of shots then land in the half it attacks).

Usage: python3 -I scripts/opendata/reduce_dsl.py DATASETS_DIR [REPO_ROOT]
"""
import collections, glob, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import GRID_DOC, N_COARSE, N_FINE, coarse, fine, metres, quantiles, write  # noqa: E402

RAW = sys.argv[1]
ROOT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "data", "opendata")
W, H = 497.0, 328.0
CREDIT = ("Data: Afriskaut, Dynasty Scouting League 2024 Open Data (https://github.com/Afriskaut/dynasty-scouting-league-2024-open-data), "
          "Apache License 2.0. Reduced to aggregate patterns by Knowitball (modified: only averages are kept).")


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def main():
    files = {}
    for p in sorted(glob.glob(os.path.join(RAW, "**", "match.json"), recursive=True), key=len):
        files.setdefault(os.path.basename(os.path.dirname(p)), p)  # the zip holds a second nested copy of every match
    files = sorted(files.values())
    D = collections.defaultdict
    shots = [[0] * 100, [0] * 100]; sit = D(lambda: [0, 0])
    pass_zone = D(lambda: [0, 0]); pass_len = D(list); fwd = [0, 0]
    pass_to = [[0] * N_COARSE for _ in range(N_COARSE)]
    defn = [0] * N_FINE; lost = [0] * N_FINE; regain = [0] * N_FINE
    per_match = D(list); cross = D(lambda: [0, 0]); corners = D(int)
    ok_dir = [0, 0]; n = 0; team_matches = 0
    for f in files:
        m = json.load(open(f))
        evs = [json.loads(l) for l in open(os.path.join(os.path.dirname(f), "events.jsonl"))]
        vote = collections.Counter()
        for e in evs:
            if e["event_name"] == "PASS" and e.get("event_direction") == "forward":
                a, b = num(e["event_start_x"]), num(e["event_end_x"])
                if a is not None and b:
                    vote[(e["team_id"], e["event_half"])] += 1 if b > a else -1

        def frame(e, which="start"):
            x, y = num(e[f"event_{which}_x"]), num(e[f"event_{which}_y"])
            if x is None or y is None or (which == "end" and x == 0 and y == 0):
                return None
            right = vote[(e["team_id"], e["event_half"])] >= 0
            x, y = x / W * 100, y / H * 100
            return (x, y) if right else (100 - x, 100 - y)
        c = collections.Counter()
        for e in evs:
            name, typ, out = e["event_name"], e["event_type"], e["event_outcome"]
            s = frame(e)
            if name in ("SHOT", "GOAL") or (name == "FREE_KICK" and typ in ("ON_TARGET", "OFF_TARGET", "SHOT_BLOCKED")):
                g = name == "GOAL"
                if out == "PENALTY":
                    sit["penalty"][0] += 1; sit["penalty"][1] += g; c["goals"] += g; continue
                c["shots"] += 1; c["goals"] += g
                if s:
                    ok_dir[s[0] > 50] += 1
                    if s[0] >= 50:
                        i = min(9, int((s[0] - 50) / 5)) * 10 + min(9, int(s[1] / 10))
                        shots[0][i] += 1; shots[1][i] += g
                k = "direct_free_kick" if name == "FREE_KICK" else ("header" if out == "HEADER" else typ.lower())
                sit[k][0] += 1; sit[k][1] += g
            elif name in ("PASS", "FREE_KICK", "THROW_IN", "CORNER", "CROSS") and s:
                ok = out in ("SUCCESSFUL", "KEY_PASS", "ASSIST")
                if name == "PASS":
                    c["passes"] += 1
                    z = coarse(*s); pass_zone[z][0] += 1; pass_zone[z][1] += ok
                    d = frame(e, "end")
                    if d:
                        pass_len[typ].append(metres(d[0] - s[0], d[1] - s[1]))
                        fwd[0] += 1; fwd[1] += d[0] > s[0] + 2
                        if ok:
                            pass_to[z][coarse(*d)] += 1
                if name == "CROSS":
                    cross[typ][0] += 1; cross[typ][1] += ok; c["crosses"] += 1
                if name == "CORNER":
                    corners[typ] += 1; c["corners"] += 1
            elif name == "DEF_ACTIONS" and s:
                defn[fine(*s)] += 1
                if typ in ("INTERCEPTION", "TACKLE", "RECOVERY") and out != "UNSUCCESSFUL":
                    regain[fine(*s)] += 1
                if typ == "FOUL":
                    c["fouls"] += 1
            elif name == "POSSESSION" and typ == "POSSESSION_LOST" and s:
                lost[fine(*s)] += 1
        tagged = {e["team_id"] for e in evs}
        if len(tagged) == 2:  # 47 of the 136 matches only have one team tagged
            for k in ("shots", "goals", "passes", "crosses", "corners", "fouls"):
                per_match[k].append(c[k])
        n += 1; team_matches += len(tagged)
    write(os.path.join(OUT, "dsl_patterns.json"), {
        "meta": {"source": "Afriskaut Dynasty Scouting League 2024 (Nigeria, grassroots/academy level)", "credit": CREDIT,
                 "licence": "Apache-2.0", "matches": n, "team_matches_tagged": team_matches, "grid": GRID_DOC,
                 "direction_check": f"{ok_dir[1]} of {sum(ok_dir)} shots in the attacked half after direction repair",
                 "caveat": "Hand-tagged from video at a lower level of football; shots and goals are logged as separate "
                           "events, both are counted as attempts here. Use as the LOW end of a quality scale, not as elite norms."},
        "what": "Lower-level football reference. shot_grid: x 50..100 in 10 bands of 5, y in 10 bands (id ix*10+iy), "
                "shots and goals; situations; per_match totals (both teams, only matches where both teams were tagged); pass success by COARSE zone; pass length by "
                "type (m); forward share; pass_to (row-normalised 30x30); defensive actions, ball regains and possession "
                "losses on the FINE grid (acting team's frame)",
        "shot_grid": {"shots": shots[0], "goals": shots[1]},
        "situations": {k: {"shots": v[0], "goals": v[1]} for k, v in sit.items()},
        "per_match": {k: quantiles(v) for k, v in per_match.items()},
        "pass_success_by_zone": [round(b / a, 3) if a >= 30 else None for a, b in (pass_zone[z] for z in range(N_COARSE))],
        "pass_count_by_zone": [pass_zone[z][0] for z in range(N_COARSE)],
        "pass_length_m": {k: quantiles(v, (0.25, 0.5, 0.75)) for k, v in pass_len.items()},
        "pass_forward_share": round(fwd[1] / max(1, fwd[0]), 3),
        "pass_to": [[round(v / max(1, sum(r)), 3) for v in r] for r in pass_to],
        "crosses": {k: {"n": v[0], "completed": v[1]} for k, v in cross.items()},
        "corners": dict(corners),
        "defensive_actions_fine": defn, "regains_fine": regain, "possession_lost_fine": lost})


if __name__ == "__main__":
    main()
