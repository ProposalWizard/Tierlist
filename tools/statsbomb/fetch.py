"""Fetch real shot moments from StatsBomb open data — FOR TESTING ONLY.

The data never goes into the repo or the website (Mikey, 9 Oct 2026: "we
can just test with it to see if it works, and then we can do our own thing").

Writes, into OUT_DIR (default: ./sb-data, keep it in a scratch folder):
  pl1516-shots.jsonl  every Premier League 2015/16 shot with its freeze frame
  kane-moments.jsonl  Kane's shots and ball receipts (World Cup 2022, Euro
                      2024) with the 360 frame of everyone visible

Usage: python3 -I tools/statsbomb/fetch.py OUT_DIR
"""
import json, os, ssl, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = "https://raw.githubusercontent.com/statsbomb/open-data/master/data/"
CA = "/root/.ccr/ca-bundle.crt"
CTX = ssl.create_default_context(cafile=CA) if os.path.exists(CA) else None


def get(path):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(BASE + path, context=CTX, timeout=60) as r:
                return json.load(r)
        except Exception:
            if attempt == 3:
                raise


def shot_row(e, match, frame360=None):
    s = e.get("shot", {})
    return {
        "match": match["match_id"],
        "home": match["home_team"]["home_team_name"],
        "away": match["away_team"]["away_team_name"],
        "id": e["id"], "minute": e["minute"],
        "team": e["team"]["name"], "player": e["player"]["name"],
        "loc": e["location"],
        "end": s.get("end_location"),
        "xg": s.get("statsbomb_xg"),
        "outcome": s.get("outcome", {}).get("name"),
        "type": s.get("type", {}).get("name"),
        "body": s.get("body_part", {}).get("name"),
        "technique": s.get("technique", {}).get("name"),
        "firstTime": bool(s.get("first_time")),
        "keyPass": s.get("key_pass_id"),
        "frame": [{"loc": f["location"], "mate": f["teammate"],
                   "pos": f["position"]["name"], "name": f["player"]["name"]}
                  for f in s.get("freeze_frame", [])],
        "frame360": frame360,
    }


def pl_shots(out):
    matches = get("matches/2/27.json")
    def one(m):
        ev = get(f"events/{m['match_id']}.json")
        passes = {e["id"]: e for e in ev if e["type"]["name"] == "Pass"}
        rows = []
        for e in ev:
            if e["type"]["name"] != "Shot":
                continue
            r = shot_row(e, m)
            kp = passes.get(r["keyPass"])
            if kp:
                p = kp["pass"]
                r["pass"] = {"from": kp["location"], "cross": bool(p.get("cross")),
                             "through": bool(p.get("through_ball")),
                             "cutback": bool(p.get("cut_back")),
                             "height": p.get("height", {}).get("name")}
            rows.append(r)
        return rows
    n = 0
    with ThreadPoolExecutor(16) as ex, open(os.path.join(out, "pl1516-shots.jsonl"), "w") as f:
        for rows in ex.map(one, matches):
            for r in rows:
                f.write(json.dumps(r) + "\n"); n += 1
    print(f"PL 2015/16: {len(matches)} matches, {n} shots")


def kane(out):
    keep = ("Shot", "Ball Receipt*")
    rows = []
    for comp, season in ((43, 106), (55, 282)):
        ms = [m for m in get(f"matches/{comp}/{season}.json")
              if "England" in (m["home_team"]["home_team_name"], m["away_team"]["away_team_name"])]
        for m in ms:
            ev = get(f"events/{m['match_id']}.json")
            try:
                f360 = {x["event_uuid"]: x for x in get(f"three-sixty/{m['match_id']}.json")}
            except Exception:
                f360 = {}
            for e in ev:
                if e["type"]["name"] not in keep or "Kane" not in e.get("player", {}).get("name", ""):
                    continue
                x = f360.get(e["id"])
                fr = None if not x else {
                    "visible": x.get("visible_area"),
                    "people": [{"loc": p["location"], "mate": p["teammate"],
                                "keeper": p["keeper"], "actor": p["actor"]} for p in x["freeze_frame"]]}
                if e["type"]["name"] == "Shot":
                    r = shot_row(e, m, fr); r["kind"] = "shot"
                else:
                    r = {"match": m["match_id"], "id": e["id"], "minute": e["minute"],
                         "kind": "receipt", "loc": e.get("location"),
                         "outcome": e.get("ball_receipt", {}).get("outcome", {}).get("name", "Complete"),
                         "frame360": fr}
                r["comp"] = "WC2022" if comp == 43 else "Euro2024"
                rows.append(r)
    with open(os.path.join(out, "kane-moments.jsonl"), "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    shots = sum(r["kind"] == "shot" for r in rows)
    print(f"Kane: {len(rows)} moments ({shots} shots), {sum(bool(r['frame360']) for r in rows)} with a 360 frame")


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "sb-data"
    os.makedirs(out, exist_ok=True)
    pl_shots(out)
    kane(out)
