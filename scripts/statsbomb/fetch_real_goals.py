"""Real Goals: every real goal the free StatsBomb data can give, made playable.

TEST PAGE ONLY (Leo, 18-19 Oct 2026: "I want ALL the goals from wc22 and
euros24 ... wc18 goals, euros21 goals ... the 100 best most iconic goals").
Read by /star-real-goals-dev only, never by the real game (the licence for a
paid game is not cleared).

Writes data/statsbomb/realgoals/<collection>.json and index.json:

  Tournaments, every goal (penalties included; own goals and shoot-out kicks
  are not shots by the scoring side, so they are left out):
    wc2022, euro2024, wc2018, euro2020, copa2024, afcon2023
  legends   hand-picked famous goals that are in the free data (LEGENDS below)
  worldies  the best club goals in the free data, picked by the numbers
            (lowest xG from range, volleys, overheads, free kicks) per season

One goal:
  id         first 8 characters of the shot's event id (the page keys stars on it)
  shot       the Real shots shape: comp, match, minute, player, team, outcome,
             xg, body, technique, type, loc, end, ff [[x, y, mate, keeper]]
  home, away, stage, date, final [h, a], score (before the goal), period, second
  endZ       height it crossed the line (StatsBomb yards) or null
  names, pos the freeze frame's names and positions, ff order
  shooterPos, dur (the shot's flight seconds)
  move       the move, oldest first:
             [seconds before the shot, kind, from, to | null, player, recipient | null, height]
             kind: P pass, C carry, D dribble, R ball received. height 0 ground, 1 low, 2 high.
  frames     StatsBomb 360 frames during the move (when the competition has 360):
             [[seconds before the shot, [[x, y, mate, keeper, actor], ...]], ...]
             turned to the scoring side's direction (mate = the scorer's team-mate).
  known      {full name: [name he is known by, shirt number]}
  label      a one-line description (legends; famous tournament goals get one on the page)

Coordinates stay in StatsBomb's 120 x 80 (attacking left to right, origin
top-left); lib/star/statsbombShots.ts sbToPitch converts them.

Raw downloads are NOT cached whole (a few GB); each match's own result is
cached in .cache/statsbomb/rg/ so a second run needs no network.

Usage: python3 -I scripts/statsbomb/fetch_real_goals.py [REPO_ROOT] [collection ...]
Data: StatsBomb open data (https://github.com/statsbomb/open-data)
"""
import json, math, os, ssl, sys, unicodedata, urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = "https://raw.githubusercontent.com/statsbomb/open-data/master/data/"
CA = "/root/.ccr/ca-bundle.crt"
CTX = ssl.create_default_context(cafile=CA) if os.path.exists(CA) else None
CREDIT = "Data: StatsBomb open data (https://github.com/statsbomb/open-data)"
HEIGHT = {"Ground Pass": 0, "Low Pass": 1, "High Pass": 2}
WINDOW_S = 20.0      # how much of the move to keep (seconds before the shot)
VERSION = 5          # bump to re-make every cached match
SKIPPED = []         # goals left out, and why (printed per collection)

TOURNAMENTS = [
    ("wc2022", "World Cup 2022", "WC", [(43, 106)]),
    ("euro2024", "Euro 2024", "EURO", [(55, 282)]),
    ("wc2018", "World Cup 2018", "WC", [(43, 3)]),
    ("euro2020", "Euro 2020", "EURO", [(55, 43)]),
    ("copa2024", "Copa América 2024", "COPA", [(223, 282)]),
    ("afcon2023", "AFCON 2023", "AFCON", [(1267, 107)]),
]

# Club seasons the "worldies" are picked from: (comp, season, label, how many)
WORLDIES = [
    (2, 27, "Premier League 2015/16", 14), (2, 44, "Premier League 2003/04", 4),
    (12, 27, "Serie A 2015/16", 10), (7, 27, "Ligue 1 2015/16", 8),
    (9, 27, "Bundesliga 2015/16", 3), (9, 281, "Bundesliga 2023/24", 6),
    (7, 108, "Ligue 1 2021/22", 4), (7, 235, "Ligue 1 2022/23", 4),
    (11, 37, "La Liga 2004/05", 2), (11, 38, "La Liga 2005/06", 3), (11, 39, "La Liga 2006/07", 3),
    (11, 40, "La Liga 2007/08", 2), (11, 41, "La Liga 2008/09", 2), (11, 21, "La Liga 2009/10", 3),
    (11, 22, "La Liga 2010/11", 3), (11, 23, "La Liga 2011/12", 3), (11, 24, "La Liga 2012/13", 3),
    (11, 25, "La Liga 2013/14", 2), (11, 26, "La Liga 2014/15", 3), (11, 27, "La Liga 2015/16", 3),
    (11, 2, "La Liga 2016/17", 3), (11, 1, "La Liga 2017/18", 3), (11, 4, "La Liga 2018/19", 3),
    (11, 42, "La Liga 2019/20", 3), (11, 90, "La Liga 2020/21", 3),
]

# Famous goals that are in the free data: (comp, season, comp label, scorer word, opponent word, minute as shown, label)
LEGENDS = [
    (43, 54, "World Cup 1986", "maradona", "england", 55, "Maradona v England — the Goal of the Century"),
    (43, 54, "World Cup 1986", "maradona", "belgium", 63, "Maradona v Belgium — through four of them"),
    (43, 54, "World Cup 1986", "burruchaga", "germany", 84, "Burruchaga — the World Cup final winner"),
    (43, 272, "World Cup 1970", "carlos alberto", "italy", 87, "Carlos Alberto — the 1970 final team goal"),
    (43, 272, "World Cup 1970", "edson", "italy", 18, "Pelé's header — 1970 final"),
    (43, 272, "World Cup 1970", "jair", "england", 60, "Jairzinho v England — 1970"),
    (43, 269, "World Cup 1958", "edson", "sweden", 55, "Pelé's flick and volley — 1958 final"),
    (43, 55, "World Cup 1990", "caniggia", "brazil", 81, "Caniggia v Brazil — after Maradona's run"),
    (43, 51, "World Cup 1974", "neeskens", "brazil", 50, "Neeskens v Brazil — 1974"),
    (43, 51, "World Cup 1974", "cruyff", "argentina", 11, "Cruyff v Argentina — 1974"),
    (43, 51, "World Cup 1974", "cruyff", "brazil", 65, "Cruyff's volley v Brazil — 1974"),
    (43, 51, "World Cup 1974", "muller", "netherlands", 43, "Gerd Müller — the 1974 final winner"),
    (16, 1, "Champions League final 2018", "bale", "liverpool", 64, "Bale's overhead kick — 2018 final"),
    (16, 1, "Champions League final 2018", "bale", "liverpool", 83, "Bale from 35 m — 2018 final"),
    (16, 2, "Champions League final 2017", "mandzukic", "real madrid", 27, "Mandžukić's overhead volley — 2017 final"),
    (16, 2, "Champions League final 2017", "cristiano", "juventus", 20, "Ronaldo — 2017 final opener"),
    (16, 4, "Champions League final 2019", "origi", "tottenham", 87, "Origi — the 2019 final"),
    (16, 26, "Champions League final 2015", "rakitic", "juventus", 4, "Rakitić — the 2015 final's 4th-minute goal"),
    (16, 26, "Champions League final 2015", "suarez", "juventus", 68, "Suárez — 2015 final winner"),
    (16, 25, "Champions League final 2014", "ramos", "atletico", 93, "Ramos, 92:48 — 2014 final"),
    (16, 25, "Champions League final 2014", "bale", "atletico", 110, "Bale's header — 2014 final"),
    (16, 24, "Champions League final 2013", "robben", "dortmund", 89, "Robben — 2013 final winner"),
    (16, 23, "Champions League final 2012", "drogba", "bayern", 88, "Drogba's header — 2012 final"),
    (16, 22, "Champions League final 2011", "messi", "manchester united", 54, "Messi from 25 m — 2011 final"),
    (16, 22, "Champions League final 2011", "villa", "manchester united", 69, "Villa's curler — 2011 final"),
    (16, 22, "Champions League final 2011", "rooney", "barcelona", 34, "Rooney v Barça — 2011 final"),
    (16, 21, "Champions League final 2010", "milito", "bayern", 70, "Milito's second — 2010 final"),
    (16, 41, "Champions League final 2009", "messi", "manchester united", 70, "Messi's header — 2009 final"),
    (16, 41, "Champions League final 2009", "eto", "manchester united", 10, "Eto'o — 2009 final"),
    (16, 39, "Champions League final 2007", "inzaghi", "liverpool", 82, "Inzaghi — 2007 final"),
    (16, 37, "Champions League final 2005", "crespo", "liverpool", 44, "Crespo's chip — Istanbul 2005"),
    (16, 37, "Champions League final 2005", "gerrard", "milan", 54, "Gerrard's header — Istanbul 2005"),
    (16, 37, "Champions League final 2005", "smicer", "milan", 56, "Šmicer from range — Istanbul 2005"),
    (16, 37, "Champions League final 2005", "maldini", "liverpool", 1, "Maldini after 50 seconds — Istanbul 2005"),
    (16, 44, "Champions League final 2004", "anderson luis", "monaco", 71, "Deco — 2004 final"),
    (16, 44, "Champions League final 2004", "carlos alberto", "monaco", 39, "Carlos Alberto — Mourinho's Porto, 2004 final"),
    (16, 71, "European Cup final 1972", "cruyff", "inter", 77, "Cruyff — 1972 European Cup final"),
    (2, 27, "Premier League 2015/16", "alli", "crystal palace", 84, "Dele Alli's flick and volley v Palace"),
    (2, 27, "Premier League 2015/16", "vardy", "liverpool", 60, "Vardy's volley v Liverpool"),
    (2, 27, "Premier League 2015/16", "mahrez", "manchester city", 48, "Mahrez beats them all at the Etihad"),
    (2, 27, "Premier League 2015/16", "martial", "liverpool", 86, "Martial's debut goal v Liverpool"),
    (2, 27, "Premier League 2015/16", "okazaki", "newcastle", 25, "Okazaki's overhead kick v Newcastle"),
    (2, 44, "Premier League 2003/04", "henry", "liverpool", 50, "Henry slaloms through Liverpool"),
    (2, 44, "Premier League 2003/04", "henry", "leeds", 6, "Henry v Leeds — the Invincibles"),
    (12, 27, "Serie A 2015/16", "higuain", "frosinone", 71, "Higuaín's overhead kick — the record 36th"),
    (12, 27, "Serie A 2015/16", "zaza", "napoli", 88, "Zaza wins it v Napoli"),
    (11, 38, "La Liga 2005/06", "moreira", "real madrid", 58, "Ronaldinho at the Bernabéu — the first"),
    (11, 38, "La Liga 2005/06", "moreira", "real madrid", 77, "Ronaldinho at the Bernabéu — applauded"),
    (11, 2, "La Liga 2016/17", "messi", "real madrid", 92, "Messi at the Bernabéu — the shirt"),
    (11, 4, "La Liga 2018/19", "messi", "betis", 85, "Messi's chip v Betis — applauded by Betis"),
    (11, 42, "La Liga 2019/20", "suarez", "mallorca", 43, "Suárez's back-heel v Mallorca"),
    (11, 24, "La Liga 2012/13", "cristiano", "barcelona", 70, "Ronaldo at the Camp Nou — 'calma'"),
    (11, 21, "La Liga 2009/10", "messi", "real madrid", 34, "Messi v Real Madrid — 2010"),
    (11, 25, "La Liga 2013/14", "messi", "real madrid", 42, "Messi v Real Madrid — the 4-3"),
    (9, 281, "Bundesliga 2023/24", "xhaka", "werder", 60, "Xhaka's rocket — the title day"),
    (9, 281, "Bundesliga 2023/24", "grimaldo", "bayern", 50, "Grimaldo v Bayern"),
    (9, 281, "Bundesliga 2023/24", "wirtz", "werder", 90, "Wirtz seals the title"),
    (7, 235, "Ligue 1 2022/23", "messi", "lille", 95, "Messi's free kick v Lille, 95'"),
    (7, 235, "Ligue 1 2022/23", "mbappe", "lille", 1, "Mbappé after 8 seconds v Lille"),
    (7, 108, "Ligue 1 2021/22", "messi", "nantes", 87, "Messi v Nantes"),
]
LEGEND_COMP = {(c, s): lab for c, s, lab, *_ in LEGENDS}


def fetch(path):
    last = None
    for _ in range(5):
        try:
            with urllib.request.urlopen(BASE + path, context=CTX, timeout=120) as r:
                return json.loads(r.read())
        except Exception as e:  # flaky downloads
            last = e
    raise last


def get_small(root, path):
    """Small files (match lists, line-ups) are cached as they are."""
    cache = os.path.join(root, ".cache", "statsbomb", path)
    if os.path.exists(cache):
        with open(cache) as f:
            return json.load(f)
    d = fetch(path)
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    with open(cache, "w") as f:
        json.dump(d, f)
    return d


def r1(v):
    return round(v, 1)


def loc(p):
    return [r1(p[0]), r1(p[1])] if p else None


def flat(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s.lower()) if not unicodedata.combining(c))


def ts(e):
    h, m, s = e["timestamp"].split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


def flip(p):
    return [r1(120 - p[0]), r1(80 - p[1])]


def move_of(ev, i, shot):
    """The move before the shot (same possession, same period), oldest first, both sides' frames."""
    team, pos, period = shot["team"]["id"], shot["possession"], shot["period"]
    t0 = ts(shot)
    out = []
    for e in reversed(ev[:i]):
        if e.get("period") != period:
            break
        back = round(t0 - ts(e), 2)
        if back > WINDOW_S + 6 and e.get("possession") != pos:
            break
        if e.get("possession") != pos:
            continue
        if e.get("team", {}).get("id") != team or not e.get("location"):
            continue
        name = e["type"]["name"]
        who = e.get("player", {}).get("name", "?")
        if name == "Pass":
            pa = e.get("pass", {})
            if "outcome" in pa:
                continue
            out.append([back, "P", loc(e["location"]), loc(pa.get("end_location")), who,
                        pa.get("recipient", {}).get("name"), HEIGHT.get(pa.get("height", {}).get("name"), 0)])
        elif name == "Carry":
            out.append([back, "C", loc(e["location"]), loc(e.get("carry", {}).get("end_location")), who, None, 0])
        elif name == "Dribble":
            out.append([back, "D", loc(e["location"]), None, who, None, 0])
        elif name == "Ball Receipt*" and "ball_receipt" not in e:
            out.append([back, "R", loc(e["location"]), None, who, None, 0])
        if back > WINDOW_S + 6 or len(out) >= 60:
            break
    out.reverse()
    return out


def frames_of(ev, i, shot, f360):
    """Every 360 frame in the last WINDOW_S seconds before the shot (and the shot's own), turned to the scorer's direction."""
    if not f360:
        return []
    team, period = shot["team"]["id"], shot["period"]
    t0 = ts(shot)
    out, last_back = [], None
    for e in reversed(ev[:i + 1]):
        if e.get("period") != period:
            break
        back = round(t0 - ts(e), 2)
        if back > WINDOW_S:
            break
        fr = f360.get(e["id"])
        if not fr or not fr.get("freeze_frame"):
            continue
        if last_back is not None and abs(back - last_back) < 0.25:
            continue  # two events at the same moment: one frame is enough
        last_back = back
        ours = e.get("team", {}).get("id") == team
        ppl = []
        for p in fr["freeze_frame"]:
            xy = loc(p["location"]) if ours else flip(p["location"])
            mate = p["teammate"] if ours else not p["teammate"]
            ppl.append([xy[0], xy[1], 1 if mate else 0, 1 if p.get("keeper") else 0, 1 if p.get("actor") else 0])
        out.append([back, ppl])
    out.reverse()
    return out


def goal_rec(ev, i, e, m, f360, known, score):
    s = e.get("shot", {})
    home, away = m["home_team"]["home_team_name"], m["away_team"]["away_team_name"]
    pen = s.get("type", {}).get("name") == "Penalty"
    ff = s.get("freeze_frame") or []
    if not ff and pen:
        # A penalty has no freeze frame: the keeper on his line (the 360 frame's keeper when there is one).
        kp = [119.5, 40.0]
        fr = f360.get(e["id"]) if f360 else None
        for p in (fr or {}).get("freeze_frame", []):
            if p.get("keeper") and not p["teammate"]:
                kp = loc(p["location"])
        ffr = [[kp[0], kp[1], 0, 1]]
        names, poss = ["", ], ["Goalkeeper"]
    else:
        ffr = [[r1(p["location"][0]), r1(p["location"][1]), 1 if p["teammate"] else 0,
                1 if p.get("position", {}).get("name") == "Goalkeeper" else 0] for p in ff]
        names = [p.get("player", {}).get("name", "?") for p in ff]
        poss = [p.get("position", {}).get("name", "") for p in ff]
    end = s.get("end_location") or []
    rec = {
        "id": e["id"][:8],
        "shot": {
            "id": e["id"][:8], "comp": "", "match": f"{home} {m.get('home_score', '?')}-{m.get('away_score', '?')} {away}",
            "minute": e["minute"], "player": e.get("player", {}).get("name", "?"), "team": e.get("team", {}).get("name", "?"),
            "outcome": "Goal", "xg": round(s.get("statsbomb_xg", 0), 3),
            "body": s.get("body_part", {}).get("name", "?"), "technique": s.get("technique", {}).get("name", "?"),
            "type": s.get("type", {}).get("name", "?"), "loc": loc(e["location"]), "end": loc(end[:2]) if end else None,
            "ff": ffr,
        },
        "matchId": m["match_id"], "home": home, "away": away,
        "stage": m.get("competition_stage", {}).get("name", ""), "date": m.get("match_date", ""),
        "final": [m.get("home_score"), m.get("away_score")], "score": list(score),
        "endZ": round(end[2], 2) if len(end) > 2 else None,
        "names": names, "pos": poss, "shooterPos": e.get("position", {}).get("name", ""),
        "period": e["period"], "second": e["second"],
        "dur": round(e["duration"], 2) if e.get("duration") else None,
        "move": move_of(ev, i, e),
        "frames": frames_of(ev, i, e, f360),
    }
    who = set(n for n in names if n) | {rec["shot"]["player"]}
    for mv in rec["move"]:
        who.add(mv[4])
        if mv[5]:
            who.add(mv[5])
    rec["known"] = {n: known[n] for n in sorted(who) if n in known}
    return rec


def match_goals(root, m, has360):
    """Every goal of one match (cached per match)."""
    mid = m["match_id"]
    cache = os.path.join(root, ".cache", "statsbomb", "rg", f"{mid}.json")
    if os.path.exists(cache):
        with open(cache) as f:
            c = json.load(f)
        if c.get("v") == VERSION:
            SKIPPED.extend(c.get("skipped", []))
            return c["goals"]
    ev = fetch(f"events/{mid}.json")
    f360 = {}
    if has360:
        try:
            f360 = {x["event_uuid"]: x for x in fetch(f"three-sixty/{mid}.json")}
        except Exception:
            f360 = {}
    known = {}
    try:
        for team in get_small(root, f"lineups/{mid}.json"):
            for pl in team.get("lineup", []):
                known[pl["player_name"]] = [pl.get("player_nickname") or pl["player_name"], pl.get("jersey_number")]
    except Exception:
        pass
    home = m["home_team"]["home_team_name"]
    score, goals, skipped = [0, 0], [], []
    for i, e in enumerate(ev):
        t = e["type"]["name"]
        if t == "Own Goal For":
            score[0 if e["team"]["name"] == home else 1] += 1
            skipped.append(["own goal", e["minute"]])
            continue
        if t != "Shot" or e.get("shot", {}).get("outcome", {}).get("name") != "Goal" or e["period"] == 5:
            continue
        s = e["shot"]
        ok = e.get("location") and (s.get("freeze_frame") or s.get("type", {}).get("name") == "Penalty")
        hand = s.get("body_part", {}).get("name") == "Other" and "Maradona" in e.get("player", {}).get("name", "") and e["minute"] == 50
        if ok and not hand:   # "Other" is a knee or a thigh; only the Hand of God is left out
            goals.append(goal_rec(ev, i, e, m, f360, known, score))
        else:
            skipped.append(["handball" if ok else "no freeze frame", e["minute"], e.get("player", {}).get("name", "?")])
        score[0 if e["team"]["name"] == home else 1] += 1
    SKIPPED.extend(skipped)
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    with open(cache, "w") as f:
        json.dump({"v": VERSION, "goals": goals, "skipped": skipped}, f, separators=(",", ":"))
    return goals


def comps360(root):
    return {(c["competition_id"], c["season_id"]) for c in get_small(root, "competitions.json") if c.get("match_available_360")}


def all_goals(root, sets, has360, workers=8):
    ms = []
    for comp, season in sets:
        for m in get_small(root, f"matches/{comp}/{season}.json"):
            ms.append((m, (comp, season) in has360))
    with ThreadPoolExecutor(workers) as ex:
        res = list(ex.map(lambda a: match_goals(root, *a), ms))
    return ms, res


def worldie_score(g):
    """How much of a worldie a goal is: an unlikely chance, from range, or a special technique."""
    s = g["shot"]
    if s["type"] == "Penalty":
        return -1
    x, y = s["loc"]
    dist = math.hypot(120 - x, 40 - y) * 0.9144
    sc = -math.log(max(0.004, s["xg"]))
    sc += 0.06 * max(0, dist - 16)
    if s["technique"] in ("Overhead Kick", "Volley", "Half Volley", "Lob", "Backheel", "Diving Header"):
        sc += 0.7 if s["technique"] in ("Overhead Kick", "Backheel", "Lob") else 0.35
    if s["type"] == "Free Kick":
        sc += 0.4
    carries = sum(1 for mv in g["move"] if mv[1] == "D")
    sc += 0.25 * min(4, carries)
    return sc


def describe(g):
    s = g["shot"]
    t = s["technique"]
    what = {"Overhead Kick": "overhead kick", "Volley": "volley", "Half Volley": "half-volley", "Lob": "chip",
            "Backheel": "back-heel", "Diving Header": "diving header"}.get(t)
    if s["type"] == "Free Kick":
        what = "free kick"
    elif s["type"] == "Penalty":
        what = "penalty"
    if not what:
        x, y = s["loc"]
        what = "from range" if math.hypot(120 - x, 40 - y) * 0.9144 > 22 else ("header" if s["body"] == "Head" else "finish")
    return what


def write(root, key, name, badge, goals):
    out = os.path.join(root, "data", "statsbomb", "realgoals", f"{key}.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as f:
        json.dump({"credit": CREDIT, "key": key, "name": name, "badge": badge, "goals": goals}, f, separators=(",", ":"))
    print(f"{key}: {len(goals)} goals, {sum(1 for g in goals if g['frames'])} with 360 frames -> {os.path.getsize(out) // 1024} KB", flush=True)
    return {"key": key, "name": name, "badge": badge, "count": len(goals), "kb": os.path.getsize(out) // 1024,
            "tracked": sum(1 for g in goals if g["frames"])}


def main(root, only):
    has360 = comps360(root)
    index_path = os.path.join(root, "data", "statsbomb", "realgoals", "index.json")
    index = {}
    if os.path.exists(index_path):
        with open(index_path) as f:
            index = {c["key"]: c for c in json.load(f)["collections"]}
    for key, name, badge, sets in TOURNAMENTS:
        if only and key not in only:
            continue
        ms, res = all_goals(root, sets, has360)
        goals = []
        for (m, _), gs in zip(ms, res):
            for g in gs:
                g["shot"]["comp"] = name
                goals.append(g)
        goals.sort(key=lambda g: (g["date"], g["matchId"], g["period"], g["shot"]["minute"], g["second"]))
        from collections import Counter
        print(f"  {key} left out:", dict(Counter(x[0] for x in SKIPPED)), [x for x in SKIPPED if x[0] != "own goal"][:8], flush=True)
        SKIPPED.clear()
        index[key] = write(root, key, name, badge, goals)

    if not only or "legends" in only:
        legends, missing = [], []
        sets = sorted({(c, s) for c, s, *_ in LEGENDS})
        ms, res = all_goals(root, sets, has360)
        for comp, season, clab, who, opp, minute, label in LEGENDS:
            best, bd = None, 99
            for (m, _), gs in zip(ms, res):
                if (m["competition"]["competition_id"], m["season"]["season_id"]) != (comp, season):
                    continue
                for g in gs:
                    other = g["away"] if g["home"] == g["shot"]["team"] else g["home"]
                    if who not in flat(g["shot"]["player"]) or opp not in flat(other):
                        continue
                    d = abs(g["shot"]["minute"] + 1 - minute)
                    if d < bd:
                        best, bd = g, d
            if best and bd <= 4:
                g = json.loads(json.dumps(best))
                g["shot"]["comp"] = clab
                g["label"] = label
                if all(x["id"] != g["id"] for x in legends):
                    legends.append(g)
            else:
                missing.append(f"{label} ({clab})")
        index["legends"] = write(root, "legends", "Legends", "LEGEND", legends)
        if missing:
            print("legends not found:", *missing, sep="\n  ")

    if not only or "worldies" in only:
        taken = set()
        lp = os.path.join(root, "data", "statsbomb", "realgoals", "legends.json")
        if os.path.exists(lp):
            with open(lp) as f:
                taken = {g["id"] for g in json.load(f)["goals"]}
        picks = []
        for comp, season, lab, n in WORLDIES:
            ms, res = all_goals(root, [(comp, season)], has360)
            pool = [g for gs in res for g in gs if g["id"] not in taken and g["shot"]["type"] != "Penalty"]
            pool.sort(key=lambda g: -worldie_score(g))
            for g in pool[:n]:
                g["shot"]["comp"] = lab
                g["what"] = describe(g)
                picks.append(g)
            print(f"  worldies {lab}: {len(pool)} goals, took {min(n, len(pool))}", flush=True)
        index["worldies"] = write(root, "worldies", "Club worldies", "CLUB", picks)

    order = [t[0] for t in TOURNAMENTS] + ["legends", "worldies"]
    cols = [index[k] for k in order if k in index]
    with open(index_path, "w") as f:
        json.dump({"credit": CREDIT, "collections": cols}, f, indent=1)
    print("index:", ", ".join(f"{c['key']} {c['count']}" for c in cols))


if __name__ == "__main__":
    args = sys.argv[1:]
    root = args[0] if args and os.path.isdir(args[0]) else os.getcwd()
    only = [a for a in args if not os.path.isdir(a)]
    main(root, only)
