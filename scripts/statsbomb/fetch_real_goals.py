"""Real Goals: the extra facts for every real GOAL in shots.json.

TEST PAGE ONLY (Leo, 18 Oct 2026: "a real shots mode ... u gotta try get 100%
accuracy from real irl goal"). Read by /star-real-goals-dev only, never by the
real game (the licence for a paid game is not cleared).

For every non-penalty goal of the 2022 World Cup and Euro 2024 that has a
freeze frame (the same goals shots.json has), this writes
data/statsbomb/goals.json with:

  id        the shots.json id (first 8 characters of the event id)
  home, away, stage, date, final [h, a]
  score     the score just BEFORE the goal, [home, away]
  endZ      the height the ball crossed the line at (end_location's z), metres-ish
            (StatsBomb gives it in yards; null when they did not record one)
  names     the freeze frame's player names, in shots.json's ff order
  pos       each freeze-frame man's position name, same order
  shooterPos the shooter's position name
  move      the whole move (same possession, same team), oldest first:
            [seconds before the shot, kind P/C/D, from [x, y], to [x, y] | null, player, recipient | null, height]
            P = pass, C = carry, D = dribble. height: 0 ground, 1 low, 2 high.
  dur       the shot's own flight time in seconds (StatsBomb's duration), or null
  known     {full name: [the name he is known by, shirt number]} for every name above
            (lineups/{match}.json's player_nickname; "Kylian Mbappé Lottin" -> "Kylian Mbappé")

Raw downloads come from the same cache as fetch_shots.py (.cache/statsbomb/).
Usage: python3 -I scripts/statsbomb/fetch_real_goals.py [REPO_ROOT]
Data: StatsBomb open data (https://github.com/statsbomb/open-data)
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_shots import get, loc, SETS  # noqa: E402

HEIGHT = {"Ground Pass": 0, "Low Pass": 1, "High Pass": 2}


def ts(e):
    """Seconds into the period, with the milliseconds."""
    h, m, s = e["timestamp"].split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def move_of(ev, i, shot):
    team, pos, period = shot["team"]["id"], shot["possession"], shot["period"]
    t0 = ts(shot)
    out = []
    for e in reversed(ev[:i]):
        if e.get("possession") != pos or e.get("period") != period:
            break
        if e.get("team", {}).get("id") != team or not e.get("location"):
            continue
        name = e["type"]["name"]
        who = e.get("player", {}).get("name", "?")
        back = round(t0 - ts(e), 2)
        if name == "Pass":
            pa = e.get("pass", {})
            if "outcome" in pa:  # an incomplete pass ends the move's thread
                continue
            out.append([back, "P", loc(e["location"]), loc(pa.get("end_location")), who,
                        pa.get("recipient", {}).get("name"), HEIGHT.get(pa.get("height", {}).get("name"), 0)])
        elif name == "Carry":
            out.append([back, "C", loc(e["location"]), loc(e.get("carry", {}).get("end_location")), who, None, 0])
        elif name == "Dribble":
            out.append([back, "D", loc(e["location"]), None, who, None, 0])
        if len(out) >= 24:
            break
    out.reverse()
    return out


def main(root):
    shots = json.load(open(os.path.join(root, "data", "statsbomb", "shots.json")))["shots"]
    want = {s["id"]: s for s in shots if s["outcome"] == "Goal" and s["type"] != "Penalty"}
    goals = []
    for comp, season, label in SETS:
        for m in get(root, f"matches/{comp}/{season}.json"):
            home, away = m["home_team"]["home_team_name"], m["away_team"]["away_team_name"]
            mid = m["match_id"]
            ev = get(root, f"events/{mid}.json")
            known = {}
            if any(e["type"]["name"] == "Shot" and e["id"][:8] in want for e in ev):
                for team in get(root, f"lineups/{mid}.json"):
                    for pl in team.get("lineup", []):
                        known[pl["player_name"]] = [pl.get("player_nickname") or pl["player_name"], pl.get("jersey_number")]
            score = [0, 0]
            for i, e in enumerate(ev):
                t = e["type"]["name"]
                if t == "Own Goal For":
                    side = 0 if e["team"]["name"] == home else 1
                    score[side] += 1
                    continue
                if t != "Shot":
                    continue
                s = e.get("shot", {})
                goal = s.get("outcome", {}).get("name") == "Goal"
                if goal and e["period"] == 5:
                    continue  # shoot-out kicks never counted
                rid = e["id"][:8]
                if rid in want:
                    ff = s.get("freeze_frame") or []
                    end = s.get("end_location") or []
                    goals.append({
                        "id": rid,
                        "matchId": mid,
                        "comp": label,
                        "home": home, "away": away,
                        "stage": m.get("competition_stage", {}).get("name", ""),
                        "date": m.get("match_date", ""),
                        "final": [m.get("home_score"), m.get("away_score")],
                        "score": list(score),
                        "endZ": round(end[2], 2) if len(end) > 2 else None,
                        "names": [p.get("player", {}).get("name", "?") for p in ff],
                        "pos": [p.get("position", {}).get("name", "") for p in ff],
                        "shooterPos": e.get("position", {}).get("name", ""),
                        "period": e["period"],
                        "second": e["second"],
                        "dur": round(e["duration"], 2) if e.get("duration") else None,
                        "move": move_of(ev, i, e),
                    })
                    g = goals[-1]
                    who = set(g["names"]) | {e.get("player", {}).get("name", "?")}
                    for mv in g["move"]:
                        who.add(mv[4])
                        if mv[5]:
                            who.add(mv[5])
                    g["known"] = {n: known[n] for n in sorted(who) if n in known}
                if goal:
                    side = 0 if e["team"]["name"] == home else 1
                    score[side] += 1
    out = os.path.join(root, "data", "statsbomb", "goals.json")
    with open(out, "w") as f:
        json.dump({"credit": "Data: StatsBomb open data (https://github.com/statsbomb/open-data)",
                   "goals": goals}, f, separators=(",", ":"))
    missing = sorted(set(want) - {g["id"] for g in goals})
    print(f"{len(goals)} of {len(want)} goals -> {out} ({os.path.getsize(out) // 1024} KB); missing {missing}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.getcwd())
