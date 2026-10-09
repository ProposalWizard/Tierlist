"""Harry Kane's recent on-the-ball moments, with everyone's positions.

Mikey, 9 Oct 2026: "use Kane's data from more recent times ... just do the
21 matches ... build it for kane only." StatsBomb's free data with 360
frames (where every player in the camera's view stood):
  Euro 2020 (England), World Cup 2022 (England), Euro 2024 (England),
  Bundesliga 2023/24 (the two Bayern v Leverkusen games).

Keeps Kane's passes (assists included), shots and ball receipts, each with
its 360 frame. Writes OUT_DIR/kane-recent.jsonl.

Usage: python3 -I tools/statsbomb/fetch_kane.py OUT_DIR
"""
import json, os, ssl, sys, urllib.request

BASE = "https://raw.githubusercontent.com/statsbomb/open-data/master/data/"
CA = "/root/.ccr/ca-bundle.crt"
CTX = ssl.create_default_context(cafile=CA) if os.path.exists(CA) else None
SETS = [(55, 43, "Euro 2020", "England"), (43, 106, "World Cup 2022", "England"),
        (55, 282, "Euro 2024", "England"), (9, 281, "Bundesliga 2023/24", "Bayern Munich")]


def get(path):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(BASE + path, context=CTX, timeout=60) as r:
                return json.load(r)
        except Exception:
            if attempt == 3:
                raise


def main(out):
    os.makedirs(out, exist_ok=True)
    rows, matches = [], 0
    for comp, season, label, team in SETS:
        for m in get(f"matches/{comp}/{season}.json"):
            home, away = m["home_team"]["home_team_name"], m["away_team"]["away_team_name"]
            if team not in (home, away):
                continue
            ev = get(f"events/{m['match_id']}.json")
            try:
                f360 = {x["event_uuid"]: x for x in get(f"three-sixty/{m['match_id']}.json")}
            except Exception:
                f360 = {}
            kane = [e for e in ev if "Kane" in e.get("player", {}).get("name", "")]
            if not kane:
                continue
            matches += 1
            for e in kane:
                t = e["type"]["name"]
                if t not in ("Pass", "Shot", "Ball Receipt*") or not e.get("location"):
                    continue
                x = f360.get(e["id"])
                if not x:
                    continue
                r = {"id": e["id"], "comp": label, "match": f"{home} v {away}", "minute": e["minute"],
                     "kind": {"Pass": "pass", "Shot": "shot"}.get(t, "touch"), "loc": e["location"],
                     "people": [{"loc": p["location"], "mate": p["teammate"], "keeper": p["keeper"], "actor": p["actor"]}
                                for p in x["freeze_frame"]]}
                if t == "Pass":
                    p = e["pass"]
                    r.update({"end": p.get("end_location"), "outcome": p.get("outcome", {}).get("name", "Complete"),
                              "assist": bool(p.get("goal_assist") or p.get("shot_assist")),
                              "through": bool(p.get("through_ball")), "cross": bool(p.get("cross")),
                              "cutback": bool(p.get("cut_back")), "height": p.get("height", {}).get("name")})
                elif t == "Shot":
                    s = e["shot"]
                    r.update({"end": s.get("end_location"), "xg": s.get("statsbomb_xg"),
                              "outcome": s.get("outcome", {}).get("name"), "type": s.get("type", {}).get("name"),
                              "body": s.get("body_part", {}).get("name"), "technique": s.get("technique", {}).get("name")})
                rows.append(r)
    with open(os.path.join(out, "kane-recent.jsonl"), "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    by = {}
    for r in rows:
        by[r["kind"]] = by.get(r["kind"], 0) + 1
    print(f"Kane: {matches} matches, {len(rows)} moments with positions: {by}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "sb-data")
