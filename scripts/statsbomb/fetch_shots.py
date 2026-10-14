"""Real shots with where everybody stood, from StatsBomb's free open data.

TEST PAGE ONLY (Harry, 13 Oct 2026): /star-statsbomb-dev draws these shots
and plays them in the real match engine. Never used in the real game: the
licence for a paid game is not cleared.

Downloads every match of the FIFA World Cup 2022 (competition 43, season 106)
and UEFA Euro 2024 (55/282). Keeps every Shot event that has a freeze frame
(shot.freeze_frame: every player near the shot) and writes one small file,
data/statsbomb/shots.json, plus data/statsbomb/leadins.json: for each shot,
the 2-3 passes of the same move that led to it (the moving lead-in) and the
360 frame of the first of them. Coordinates stay in StatsBomb's 120 x 80 pitch
(attacking left to right, origin top-left); the page converts them
(lib/star/statsbombShots.ts sbToPitch).

Raw downloads are cached in .cache/statsbomb/ (gitignored), so a second run
needs no network.

Usage: python3 -I scripts/statsbomb/fetch_shots.py [REPO_ROOT]
Data: StatsBomb open data (https://github.com/statsbomb/open-data)
"""
import json, os, ssl, sys, urllib.request

BASE = "https://raw.githubusercontent.com/statsbomb/open-data/master/data/"
CA = "/root/.ccr/ca-bundle.crt"
CTX = ssl.create_default_context(cafile=CA) if os.path.exists(CA) else None
SETS = [(43, 106, "World Cup 2022"), (55, 282, "Euro 2024")]


def get(root, path):
    cache = os.path.join(root, ".cache", "statsbomb", path)
    if os.path.exists(cache):
        with open(cache) as f:
            return json.load(f)
    last = None
    for _ in range(4):
        try:
            with urllib.request.urlopen(BASE + path, context=CTX, timeout=90) as r:
                raw = r.read()
            break
        except Exception as e:  # retry flaky downloads
            last = e
    else:
        raise last
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    with open(cache, "wb") as f:
        f.write(raw)
    return json.loads(raw)


def r1(v):
    return round(v, 1)


def loc(p):
    return [r1(p[0]), r1(p[1])] if p else None


def secs(e):
    return e["minute"] * 60 + e["second"]


def leadin(ev, i, shot, f360):
    """The 2-3 passes that led to this shot: same possession, same team.

    passes: [seconds before the shot, from [x, y], to [x, y], passer, recipient]
    start:  the 360 frame of the first of them, [x, y, teammate, keeper, actor]
    path:   up to 12 earlier touches of the move, [minute (decimal), x, y], for the radar
    """
    team, pos = shot["team"]["id"], shot["possession"]
    t0 = secs(shot)
    passes, path = [], []
    for e in reversed(ev[:i]):
        if e.get("possession") != pos:
            break
        if e.get("team", {}).get("id") != team or not e.get("location"):
            continue
        if len(path) < 12:
            path.append([round(e["minute"] + e["second"] / 60, 2), r1(e["location"][0]), r1(e["location"][1])])
        pa = e.get("pass")
        if e["type"]["name"] == "Pass" and pa and "outcome" not in pa and pa.get("recipient") and len(passes) < 3:
            passes.append((e, pa))
    if not passes:
        return None
    passes.reverse()
    path.reverse()
    out = {
        "passes": [[round(t0 - secs(e), 1), loc(e["location"]), loc(pa["end_location"]),
                    e.get("player", {}).get("name", "?"), pa["recipient"]["name"]] for e, pa in passes],
        "path": path,
    }
    fr = f360.get(passes[0][0]["id"])
    if fr and fr.get("freeze_frame"):
        out["start"] = [[r1(p["location"][0]), r1(p["location"][1]), 1 if p["teammate"] else 0,
                         1 if p["keeper"] else 0, 1 if p["actor"] else 0] for p in fr["freeze_frame"]]
    return out


def main(root):
    shots, matches, leadins = [], 0, {}
    for comp, season, label in SETS:
        for m in get(root, f"matches/{comp}/{season}.json"):
            matches += 1
            home, away = m["home_team"]["home_team_name"], m["away_team"]["away_team_name"]
            score = f"{m.get('home_score', '?')}-{m.get('away_score', '?')}"
            mid = m["match_id"]
            ev = get(root, f"events/{mid}.json")
            try:
                f360 = {x["event_uuid"]: x for x in get(root, f"three-sixty/{mid}.json")}
            except Exception:
                f360 = {}
            vis = {k: v.get("visible_area") for k, v in f360.items()}
            for i, e in enumerate(ev):
                if e["type"]["name"] != "Shot":
                    continue
                s = e.get("shot", {})
                ff = s.get("freeze_frame")
                if not ff or not e.get("location"):
                    continue
                row = {
                    "id": e["id"][:8],
                    "comp": label,
                    "match": f"{home} {score} {away}",
                    "minute": e["minute"],
                    "player": e.get("player", {}).get("name", "?"),
                    "team": e.get("team", {}).get("name", "?"),
                    "outcome": s.get("outcome", {}).get("name", "?"),
                    "xg": round(s.get("statsbomb_xg", 0), 3),
                    "body": s.get("body_part", {}).get("name", "?"),
                    "technique": s.get("technique", {}).get("name", "?"),
                    "type": s.get("type", {}).get("name", "?"),
                    "loc": loc(e["location"]),
                    "end": loc(s.get("end_location")),
                    # [x, y, teammate 0/1, keeper 0/1]
                    "ff": [[r1(p["location"][0]), r1(p["location"][1]), 1 if p["teammate"] else 0,
                            1 if p.get("position", {}).get("name") == "Goalkeeper" else 0] for p in ff],
                }
                va = vis.get(e["id"])
                if va:
                    row["vis"] = [r1(v) for v in va]
                shots.append(row)
                lead = leadin(ev, i, e, f360)
                if lead:
                    leadins[row["id"]] = lead
    out = os.path.join(root, "data", "statsbomb", "shots.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as f:
        json.dump({"credit": "Data: StatsBomb open data (https://github.com/statsbomb/open-data)",
                   "shots": shots}, f, separators=(",", ":"))
    lout = os.path.join(root, "data", "statsbomb", "leadins.json")
    with open(lout, "w") as f:
        json.dump({"credit": "Data: StatsBomb open data (https://github.com/statsbomb/open-data)",
                   "leadins": leadins}, f, separators=(",", ":"))
    two = sum(1 for v in leadins.values() if len(v["passes"]) >= 2)
    print(f"lead-ins: {len(leadins)} ({two} with 2+ passes) -> {lout} ({os.path.getsize(lout) // 1024} KB)")
    print(f"{matches} matches, {len(shots)} shots with freeze frames -> {out} ({os.path.getsize(out) // 1024} KB)")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.getcwd())
