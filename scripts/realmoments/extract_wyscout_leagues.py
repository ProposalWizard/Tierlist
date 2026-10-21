"""Real Goals from the five big leagues of 2017/18 (Wyscout public dataset,
Pappalardo et al. 2019, CC BY 4.0) -> data/realmoments/wyscout_league_<league>.json.

Leo, 20 Oct 2026: load the rest of the free goals for Real Goals. The World Cup
2018 / Euro 2016 goals come from extract_wyscout.py; this adds every league goal
of the Premier League, La Liga, Serie A, Bundesliga and Ligue 1 2017/18, made
the same way (same rules, same pitch, same xG model) but only the goals, not
every shot (the leagues have 43,000 shots; Real Goals needs only the goals).

Input: the per-match files of the GitHub copy of the same dataset
(github.com/koenvo/wyscout-soccer-match-event-dataset, processed/files/<id>.json,
each with events + teams + players) and its processed/README.md index (date and
final score per match). figshare (the original home) is not reachable from the
cloud sessions; the events are the same.

Each file: {meta, shots: [goal shot rows, as wyscout_shots.json], goals: [match
facts, as wyscout_goals.json]}. Penalties and own goals are left out, as for the
tournaments.

Usage: python3 -I scripts/realmoments/extract_wyscout_leagues.py RAW_DIR [REPO_ROOT]
  RAW_DIR holds index.md (processed/README.md) and files/<id>.json.
"""
import collections, datetime, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from rm_common import (CREDIT, unesc, wy_to_pitch, xg_features, xg_of, write)  # noqa: E402
import extract_wyscout as W  # noqa: E402  (its helpers; its RAW is unused here)

RAW = sys.argv[1]
ROOT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "..", "..")
OUT = os.path.join(ROOT, "data", "realmoments")

LEAGUES = {  # source file -> (file key, name shown)
    "matches_England.json": ("england", "Premier League 2017/18"),
    "matches_Spain.json": ("spain", "La Liga 2017/18"),
    "matches_Italy.json": ("italy", "Serie A 2017/18"),
    "matches_Germany.json": ("germany", "Bundesliga 2017/18"),
    "matches_France.json": ("france", "Ligue 1 2017/18"),
}
ROW = re.compile(r"^\|\[(\d+)\]\([^)]*\)\|(.*) - (.*), (\d+) - (\d+)\|(.+?)\|(matches_\w+\.json)\|")


def index():
    out = {}
    for line in open(os.path.join(RAW, "index.md"), encoding="utf-8"):
        m = ROW.match(line.strip())
        if not m or m.group(7) not in LEAGUES:
            continue
        mid, home, away, hs, as_, when, src = m.groups()
        day = datetime.datetime.strptime(when.split(" at ")[0], "%B %d, %Y").date().isoformat()
        out[int(mid)] = {"home": unesc(home), "away": unesc(away), "final": [int(hs), int(as_)], "date": day, "src": src}
    return out


def known_name(p):
    short = unesc(p.get("shortName", "")); first = unesc(p.get("firstName", "")); last = unesc(p.get("lastName", ""))
    known = short
    if ". " in short:
        sur = short.split(". ", 1)[1]
        known = f"{first.split()[0]} {sur}".strip() if first.split() else sur
    return known or f"{first} {last}".strip()


def main():
    meta_t = json.load(open(os.path.join(OUT, "wyscout_shots.json"), encoding="utf-8"))["meta"]
    w = meta_t["xg_model"]["weights"]
    idx = index()
    by_league = collections.defaultdict(lambda: {"shots": [], "goals": []})
    counts = collections.Counter()
    for mid, info in sorted(idx.items(), key=lambda kv: (kv[1]["date"], kv[0])):
        path = os.path.join(RAW, "files", f"{mid}.json")
        if not os.path.exists(path):
            counts["missing file"] += 1
            continue
        d = json.load(open(path, encoding="utf-8"))
        teams = {int(t): unesc(v["name"]) for t, v in d["teams"].items()}
        names, gk_of = {}, {}
        for t, plist in d["players"].items():
            for row in plist or []:
                if not row or not row.get("player"):
                    continue
                p = row["player"]
                names[row["playerId"]] = {"known": known_name(p), "gk": (p.get("role") or {}).get("code2") == "GK", "team": int(t)}
        evs = sorted(d["events"], key=lambda e: (W.PORDER.get(e["matchPeriod"], 9), e["eventSec"]))
        # The keeper who played: a GK of that side with an event in this match.
        for e in evs:
            n = names.get(e.get("playerId"))
            if n and n["gk"] and n["team"] not in gk_of:
                gk_of[n["team"]] = n["known"]
        by_name = {v: k for k, v in teams.items()}
        home = by_name.get(info["home"]); away = by_name.get(info["away"])
        if (home is None) != (away is None) and len(teams) == 2:
            # One name spelled differently in the index ("Angers SCO" v "Angers"): the other side is the known one's opponent.
            other = next(t for t in teams if t != (home if home is not None else away))
            home, away = (home, other) if home is not None else (other, away)
            counts["one team name matched by its opponent"] += 1
        if home is None or away is None:
            counts["teams unknown"] += 1
            continue
        hn, an = teams[home], teams[away]
        key, comp = LEAGUES[info["src"]]
        score = [0, 0]
        for i, e in enumerate(evs):
            tg = W.tags(e)
            if 102 in tg and not W.is_shot(e):
                score[0 if e["teamId"] == away else 1] += 1
                continue
            if not W.is_shot(e) or e["teamId"] not in (home, away) or not W.pos(e):
                continue
            if 101 not in tg:
                continue
            team = e["teamId"]; opp = away if team == home else home
            ball = wy_to_pitch(*W.pos(e))
            if ball[1] > 52.5:
                counts["dropped (own half)"] += 1
                score[0 if team == home else 1] += 1
                continue
            seq = W.move_before(evs, i, names)
            typ = ("Penalty" if e["subEventId"] == 35 else "Free Kick" if e["subEventId"] == 33
                   else "Corner" if seq and seq[0]["subEventId"] == 30 else "Open Play")
            before = list(score)
            score[0 if team == home else 1] += 1
            if typ == "Penalty":
                counts["penalties left out"] += 1
                continue
            end, endz = W.shot_end(tg, "Goal")
            head = 403 in tg
            xg = round(xg_of(w, xg_features(ball[0], ball[1], head, typ == "Free Kick")), 3)
            passes, path, move = W.lead_of(evs, i, seq, names)
            sid = f"wy{e['id']}"
            rec = {
                "id": sid, "src": "wyscout", "comp": comp, "match": f"{hn} {info['final'][0]}-{info['final'][1]} {an}",
                "minute": int(W.clock(e) // 60) + 1,
                "player": names.get(e["playerId"], {}).get("known", "?"), "team": teams.get(team, "?"), "opp": teams.get(opp, "?"),
                "outcome": "Goal", "xg": xg, "body": "Head" if head else "Left Foot" if 401 in tg else "Right Foot" if 402 in tg else "Other",
                "type": typ, "ball": ball, "end": end, "endZ": endz,
            }
            if 1901 in tg or any(1901 in W.tags(x) for x in seq):
                rec["counter"] = 1
            if passes:
                rec["lead"] = {"passes": passes, "path": path}
            by_league[key]["shots"].append(rec)
            by_league[key]["goals"].append({
                "id": sid, "comp": comp, "home": hn, "away": an, "stage": "", "date": info["date"],
                "final": info["final"], "score": before, "keeper": gk_of.get(opp, ""), "period": e["matchPeriod"], "move": move,
            })
            counts[comp] += 1
        if score != info["final"]:
            counts["score check off (index v events)"] += 1
    meta = dict(meta_t)
    meta["source"] = meta_t["source"] + "; per-match copy: github.com/koenvo/wyscout-soccer-match-event-dataset"
    meta["what"] = "Real Goals from one league season: goal shot rows (as wyscout_shots.json) and match facts (as wyscout_goals.json)"
    for key, comp in LEAGUES.values():
        write(os.path.join(OUT, f"wyscout_league_{key}.json"), {"meta": {**meta, "comp": comp}, **by_league[key]})
    print(dict(counts))


if __name__ == "__main__":
    main()
