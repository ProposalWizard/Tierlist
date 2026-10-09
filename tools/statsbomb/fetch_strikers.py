"""Every striker's passes and shots, with everyone's positions.

Mikey, 9 Oct 2026: "yes do this but only use strikers." Same as fetch_kane.py,
but across every free StatsBomb set with 360 frames, and for every player
whose position that match was a striker (Center/Left/Right Center Forward,
Secondary Striker). Harry Kane is marked so the game can deal him more often.

Writes OUT_DIR/strikers.jsonl. Usage: python3 -I tools/statsbomb/fetch_strikers.py OUT_DIR
"""
import json, os, ssl, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = "https://raw.githubusercontent.com/statsbomb/open-data/master/data/"
CA = "/root/.ccr/ca-bundle.crt"
CTX = ssl.create_default_context(cafile=CA) if os.path.exists(CA) else None
SETS = [(9, 281, "Bundesliga 2023/24"), (1267, 107, "AFCON 2023"), (43, 106, "World Cup 2022"),
        (11, 90, "La Liga 2020/21"), (7, 235, "Ligue 1 2022/23"), (7, 108, "Ligue 1 2021/22"),
        (44, 107, "MLS 2023"), (55, 282, "Euro 2024"), (55, 43, "Euro 2020")]
STRIKER = ("Center Forward", "Secondary Striker")


def get(path):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(BASE + path, context=CTX, timeout=90) as r:
                return json.load(r)
        except Exception:
            if attempt == 3:
                raise


def one(args):
    label, m = args
    home, away = m["home_team"]["home_team_name"], m["away_team"]["away_team_name"]
    try:
        f360 = {x["event_uuid"]: x for x in get(f"three-sixty/{m['match_id']}.json")}
    except Exception:
        return []
    if not f360:
        return []
    ev = get(f"events/{m['match_id']}.json")
    rows = []
    for i, e in enumerate(ev):
        t = e["type"]["name"]
        pos = e.get("position", {}).get("name", "")
        if t not in ("Pass", "Shot") or not any(s in pos for s in STRIKER) or not e.get("location"):
            continue
        x = f360.get(e["id"])
        if not x:
            continue
        name = e.get("player", {}).get("name", "")
        r = {"id": e["id"], "comp": label, "match": f"{home} v {away}", "minute": e["minute"],
             "player": name, "kane": "Kane" in name and "Harry" in name,
             "kind": "pass" if t == "Pass" else "shot", "loc": e["location"],
             "pressure": bool(e.get("under_pressure")),
             "people": [{"loc": p["location"], "mate": p["teammate"], "keeper": p["keeper"], "actor": p["actor"]}
                        for p in x["freeze_frame"]]}
        if t == "Pass":
            p = e["pass"]
            if p.get("type", {}).get("name") in ("Corner", "Free Kick", "Throw-in", "Kick Off", "Goal Kick"):
                continue
            r.update({"end": p.get("end_location"), "outcome": p.get("outcome", {}).get("name", "Complete"),
                      "assist": bool(p.get("goal_assist") or p.get("shot_assist")),
                      "through": bool(p.get("through_ball")), "cross": bool(p.get("cross")),
                      "cutback": bool(p.get("cut_back")), "height": p.get("height", {}).get("name")})
        else:
            s = e["shot"]
            r.update({"end": s.get("end_location"), "xg": s.get("statsbomb_xg"),
                      "outcome": s.get("outcome", {}).get("name"), "type": s.get("type", {}).get("name"),
                      "body": s.get("body_part", {}).get("name"), "technique": s.get("technique", {}).get("name")})
        rows.append(r)
    return rows


def main(out):
    os.makedirs(out, exist_ok=True)
    jobs = [(label, m) for comp, season, label in SETS for m in get(f"matches/{comp}/{season}.json")]
    print(f"{len(jobs)} matches", flush=True)
    rows, done = [], 0
    with ThreadPoolExecutor(8) as pool:
        for got in pool.map(one, jobs):
            rows += got
            done += 1
            if done % 50 == 0:
                print(f"{done}/{len(jobs)} matches, {len(rows)} moments", flush=True)
    with open(os.path.join(out, "strikers.jsonl"), "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    kane = sum(r["kane"] for r in rows)
    print(f"strikers: {len(rows)} moments ({kane} Kane), players {len({r['player'] for r in rows})}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "sb-data")
