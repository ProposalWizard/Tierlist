"""Builds the data files for the two Ballon d'Or ranking videos from Mikey's list (26 Nov 2026) and FotMob's match logs.
  python3 build_data.py FM_PLAYERS.json ASSETS_DIR      (FM_PLAYERS.json: the output of the FotMob pull, see README)
Writes ASSETS_DIR/ranking.json (video 1: the countdown, 20 to 6, top 5 hidden) and ASSETS_DIR/ranking_top5.json (video 2: 5 to 1 with stats).
Stats = official matches since 1 Aug 2026 (club league, Champions League, cups and Super Cups, national team incl. its friendlies);
pre-season CLUB friendlies and the World Cup (June to July, last season) are left out."""
import json, os, sys, datetime
FM = json.load(open(sys.argv[1])); A = os.path.abspath(sys.argv[2]); F = "file://" + A
# rank, display name, FotMob key, cut-out file, club badge, flag
L = [(1, "Lamine Yamal", "Lamine Yamal", "Lamine_Yamal", "barcelona", "es"), (2, "Michael Olise", "Michael Olise", "Michael_Olise", "bayern", "fr"),
     (3, "Jude Bellingham", "Jude Bellingham", "Jude_Bellingham", "realmadrid", "gb-eng"), (4, "Kylian Mbappé", "Kylian Mbappé", "Kylian_Mbappé", "realmadrid", "fr"),
     (5, "Raphinha", "Raphinha", "Raphinha", "barcelona", "br"), (6, "Erling Haaland", "Erling Haaland", "Erling_Haaland", "mancity", "no"),
     (7, "Donyell Malen", "Donyell Malen", "Donyell_Malen", "roma", "nl"), (8, "Arda Güler", "Arda Güler", "Arda_Güler_hd", "realmadrid", "tr"),
     (9, "Declan Rice", "Declan Rice", "Declan_Rice", "arsenal", "gb-eng"), (10, "Nico Paz", "Nico Paz", "Nico_Paz", "como", "ar"),
     (11, "Rodri", "Rodri", "Rodri", "barcelona", "es"), (12, "Pascal Groß", "Pascal Groß", "Pascal_Groß", "brighton", "de"),
     (13, "Fermín López", "Fermín López", "Fermín_López", "barcelona", "es"), (14, "Gabriel", "Gabriel Magalhães", "Gabriel", "arsenal", "br"),
     (15, "Elliot Anderson", "Elliot Anderson", "Elliot_Anderson", "mancity", "gb-eng"), (16, "Harry Kane", "Harry Kane", "Harry_Kane", "bayern", "gb-eng"),
     (17, "Adrien Rabiot", "Adrien Rabiot", "Adrien_Rabiot", "milan", "fr"), (18, "Maxim De Cuyper", "Maxim De Cuyper", None, "brighton", "be"),
     (19, "Gianluca Prestianni", "Gianluca Prestianni", None, "benfica", "ar"), (20, "Florian Wirtz", "Florian Wirtz", "Florian_Wirtz", "liverpool", "de")]
CLUB = {"Barcelona": "barcelona", "Real Madrid": "realmadrid", "Bayern München": "bayern", "Arsenal": "arsenal", "Manchester City": "mancity", "Liverpool": "liverpool", "Milan": "milan", "Roma": "roma", "Como": "como", "Brighton & Hove Albion": "brighton", "Benfica": "benfica"}
rows = []
for rk, name, key, cut, badge, flag in L:
    p = FM[key]; assert CLUB.get(p["team"]) == badge, (name, p["team"], badge)   # the badge must be the club FotMob says they are at now
    rows.append({"rank": rk, "name": name, "cut": f"{F}/cut/{cut}.png" if cut else None, "badge": f"{F}/badge2/{badge}.png", "flag": f"{F}/flag/{flag}.png"})
for r in rows:
    if r["rank"] <= 5 and r["cut"]: r["endcut"] = r["cut"].replace("/cut/", "/cut_end/")   # the ending's silhouettes keep the cut-outs they were approved with
    if r["name"] == "Lamine Yamal": r["dx"] = -120   # starts too far right otherwise
    if r["name"] == "Rodri": r["dx"] = -45   # nudge his photo a little to the left
    if r["name"] == "Jude Bellingham": r["zoom"] = 2.0   # his photo is a wide arms-out shot: scale up so his face and chest fill the screen (arms run off the edges)
rows.sort(key=lambda r: r["rank"])
def bucket(m):
    c, t = m["comp"], m["team"]
    if c == "Champions League": return "CHAMPIONS LEAGUE"
    if t == FMNAT: return "INTERNATIONAL"
    if c in ("Super Cup", "DFB Pokal", "Copa del Rey", "Supercopa", "FA Cup", "EFL Cup", "Coppa Italia"): return "CUPS"
    return "LEAGUE"
stats, last = {}, "2026-08-01"
for rk, name, key, *_ in L[:5]:
    p = FM[key]; FMNAT = p["country"]; q = {k: {"g": 0, "a": 0, "n": 0} for k in ("LEAGUE", "CHAMPIONS LEAGUE", "CUPS", "INTERNATIONAL")}
    for m in p["matches"]:
        if m["date"] < "2026-08-01" or m["comp"] == "Club Friendlies" or not m["played"]: continue
        FMNAT = p["country"]; b = bucket(m); q[b]["g"] += m["g"]; q[b]["a"] += m["a"]; q[b]["n"] += 1; last = max(last, m["date"])
    G, Aa = sum(v["g"] for v in q.values()), sum(v["a"] for v in q.values())
    stats[rk] = {"g": G, "a": Aa, "rows": [{"label": k, "g": v["g"], "a": v["a"], "n": v["n"]} for k, v in q.items()]}
for p in FM.values():
    for m in p["matches"]:
        if m["date"] >= "2026-08-01" and m["comp"] != "Club Friendlies" and m["played"] is not None: last = max(last, m["date"]) if m["date"] <= "2026-11-30" else last
asof = datetime.date.fromisoformat(max(m["date"] for k in ("Raphinha", "Kylian Mbappé", "Jude Bellingham", "Michael Olise", "Lamine Yamal") for m in FM[k]["matches"] if m["date"] <= "2026-11-30")).strftime("%d %b").upper().lstrip("0")
mad = {"name": "Noni Madueke", "cut": f"{F}/cut/Noni_Madueke.png", "badge": f"{F}/badge2/arsenal.png", "flag": f"{F}/flag/gb-eng.png", "dx": -170, "stats": [{"v": 4, "label": "CAPS FOR GOD"}, {"v": 15, "label": "GAMES"}, {"v": 15, "label": "APPEARANCES"}]}
common = {"title": "BALLON D'OR RANKING", "sub": "NOV 2026", "top": 20, "podium": f"{F}/podium_cut.png", "panel": f"{F}/gold_panel.png", "stadiums": [f"{F}/stadium/s{i}.jpg" for i in (1, 2, 3)],
          "credit": "", "rows": rows}
v1 = dict(common, mode="count", shown=3, step=2.0, t0=-0.3, endHold=5.3, front=f"{F}/cut_end/Noni_Madueke.png", chain="NONZINO")
v2 = dict(common, mode="top5", madueke=mad, stats=stats, foot=f"FOTMOB · OFFICIAL MATCHES TO {asof}", timing={"step": 5.0, "mad": 2.6, "glitch": 0.9, "last": 5.8, "cta": 2.6})
v2["duration"] = 4 * v2["timing"]["step"] + sum(v2["timing"][k] for k in ("mad", "glitch", "last"))
json.dump(v1, open(A + "/ranking.json", "w"), ensure_ascii=False, indent=1); json.dump(v2, open(A + "/ranking_top5.json", "w"), ensure_ascii=False, indent=1)
print("as of", asof, "| video 2 length", v2["duration"], "s")
for rk in range(5, 0, -1): s = stats[rk]; print(rk, L[rk - 1][1], "G", s["g"], "A", s["a"], "G+A", s["g"] + s["a"], [(r["label"][:6], r["g"], r["a"], r["n"]) for r in s["rows"]])
