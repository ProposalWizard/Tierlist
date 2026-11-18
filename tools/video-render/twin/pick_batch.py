# Pick the best Stat Twins episodes from a long list of famous player-seasons (Mikey, 10 Nov 2026).
#   TWIN_DATA=<dir with twin_data.json> python3 pick_batch.py OUT.json [how many]
# Rules (Mikey): a player who was in the Premier League that season is compared with Premier League players only;
# anyone else with all five leagues. Always the same kind of position. One video per player.
# The score (higher = a better video):
#   fame of the player 1-3 · award season +1 · strong twin (80%+) +2, decent (75%+) +1 · clear winner (first in 60%+ of tests) +1
#   · the twin is a famous name +2, or an unknown at a different club +1 (the "who?" moment) · different club +1 · different league +1
#   · different era (4+ seasons apart) +1 · his own seasons are in the top list (the "they don't count" moment) +1
#   · a famous name far down the list for "You'd think...?" +2 · twin on a small sample (under 1,500 minutes) -2
import json, os, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, "model"))
from finder_model import Data
OUT = sys.argv[1]; HOW = int(sys.argv[2]) if len(sys.argv) > 2 else 25
D = Data(os.path.join(os.environ.get("TWIN_DATA", "fm"), "twin_data.json"))
FIVE = D.D['seasons'][-5:]; ALLL = {int(k) for k in D.D['leagues']}; PL = {int(k) for k, v in D.D['leagues'].items() if v == 'Premier League'}
BDO = "Ballon d'Or winner"
# (name, season, group, fame 1-3, extra)   extra: short = the name Hugo says; award = hook prefix + trophy
C = [
 # strikers
 ("Harry Kane", "2017/18", "ST", 3, {}), ("Harry Kane", "2020/21", "ST", 3, {}), ("Harry Kane", "2023/24", "ST", 3, {}),
 ("Erling Haaland", "2023/24", "ST", 3, {}), ("Robert Lewandowski", "2020/21", "ST", 3, {}), ("Robert Lewandowski", "2019/20", "ST", 3, {}),
 ("Karim Benzema", "2021/22", "ST", 3, {"award": BDO}), ("Sergio Agüero", "2018/19", "ST", 3, {}), ("Pierre-Emerick Aubameyang", "2018/19", "ST", 2, {}),
 ("Jamie Vardy", "2019/20", "ST", 2, {}), ("Romelu Lukaku", "2020/21", "ST", 2, {}), ("Cristiano Ronaldo", "2017/18", "ST", 3, {}),
 ("Cristiano Ronaldo", "2020/21", "ST", 3, {}), ("Kylian Mbappé", "2023/24", "ST", 3, {}), ("Kylian Mbappé", "2021/22", "ST", 3, {}),
 ("Victor Osimhen", "2022/23", "ST", 2, {}), ("Lautaro Martínez", "2023/24", "ST", 2, {}), ("Alexander Isak", "2024/25", "ST", 2, {}),
 ("Viktor Gyökeres", "2025/26", "ST", 2, {}), ("Ollie Watkins", "2023/24", "ST", 2, {}), ("Diego Costa", "2016/17", "ST", 2, {}),
 ("Édinson Cavani", "2016/17", "ST", 2, {}), ("Ciro Immobile", "2019/20", "ST", 2, {}), ("Luis Suárez", "2020/21", "ST", 3, {}),
 ("Zlatan Ibrahimovic", "2016/17", "ST", 3, {"short": "Zlatan"}), ("Roberto Firmino", "2017/18", "ST", 2, {}), ("Darwin Núñez", "2022/23", "ST", 1, {}),
 ("Olivier Giroud", "2016/17", "ST", 2, {}), ("Dušan Vlahović", "2021/22", "ST", 1, {}),
 # wingers and number 10s
 ("Lionel Messi", "2018/19", "AMW", 3, {"award": BDO}), ("Lionel Messi", "2020/21", "AMW", 3, {"award": BDO}), ("Lionel Messi", "2022/23", "AMW", 3, {"award": BDO}),
 ("Mohamed Salah", "2017/18", "AMW", 3, {}), ("Sadio Mané", "2018/19", "AMW", 3, {}), ("Sadio Mané", "2020/21", "AMW", 3, {}), ("Eden Hazard", "2018/19", "AMW", 3, {}),
 ("Kevin De Bruyne", "2019/20", "AMW", 3, {}), ("Kevin De Bruyne", "2022/23", "AMW", 3, {}), ("Raheem Sterling", "2018/19", "AMW", 2, {}),
 ("Heung-Min Son", "2021/22", "AMW", 3, {"short": "Son"}), ("Bukayo Saka", "2023/24", "AMW", 3, {}), ("Phil Foden", "2023/24", "AMW", 3, {}),
 ("Cole Palmer", "2023/24", "AMW", 3, {}), ("Vinícius Júnior", "2023/24", "AMW", 3, {}), ("Jude Bellingham", "2023/24", "AMW", 3, {}),
 ("Ousmane Dembélé", "2024/25", "AMW", 3, {"award": BDO}), ("Lamine Yamal", "2024/25", "AMW", 3, {"short": "Yamal"}), ("Raphinha", "2024/25", "AMW", 2, {}),
 ("Khvicha Kvaratskhelia", "2022/23", "AMW", 2, {}), ("Rafael Leão", "2021/22", "AMW", 2, {}), ("Antoine Griezmann", "2022/23", "AMW", 2, {}),
 ("Bruno Fernandes", "2020/21", "AMW", 3, {}), ("Martin Ødegaard", "2022/23", "AMW", 2, {}), ("Jack Grealish", "2020/21", "AMW", 2, {}),
 ("Riyad Mahrez", "2020/21", "AMW", 2, {}), ("Florian Wirtz", "2023/24", "AMW", 2, {}), ("Jamal Musiala", "2023/24", "AMW", 2, {}),
 ("Michael Olise", "2024/25", "AMW", 2, {}), ("Paulo Dybala", "2017/18", "AMW", 2, {}), ("Marcus Rashford", "2022/23", "AMW", 3, {}),
 ("Alexis Sánchez", "2016/17", "AMW", 2, {}), ("Dele Alli", "2016/17", "AMW", 2, {}), ("Christian Eriksen", "2017/18", "AMW", 2, {}),
 ("David Silva", "2017/18", "AMW", 2, {}), ("Jadon Sancho", "2019/20", "AMW", 2, {}), ("Thomas Müller", "2019/20", "AMW", 2, {}),
 ("Philippe Coutinho", "2016/17", "AMW", 2, {}), ("Neymar", "2019/20", "AMW", 3, {}), ("Luis Díaz", "2024/25", "AMW", 2, {}),
 ("Wilfried Zaha", "2018/19", "AMW", 2, {}), ("Gareth Bale", "2017/18", "AMW", 3, {}), ("James Maddison", "2022/23", "AMW", 2, {}),
 # midfielders
 ("Rodri", "2023/24", "MID", 3, {"award": BDO}), ("Luka Modrić", "2017/18", "MID", 3, {"award": BDO}), ("N'Golo Kanté", "2016/17", "MID", 3, {}),
 ("Declan Rice", "2023/24", "MID", 3, {}), ("Vítinha", "2024/25", "MID", 2, {}), ("Pedri", "2024/25", "MID", 2, {}), ("Toni Kroos", "2023/24", "MID", 3, {}),
 ("Paul Pogba", "2018/19", "MID", 3, {}), ("Fabinho", "2019/20", "MID", 2, {}), ("Moisés Caicedo", "2024/25", "MID", 2, {}),
 ("Bruno Guimarães", "2023/24", "MID", 2, {}), ("Joshua Kimmich", "2019/20", "MID", 2, {}), ("Granit Xhaka", "2023/24", "MID", 2, {}),
 ("Alexis Mac Allister", "2024/25", "MID", 2, {}), ("Jordan Henderson", "2019/20", "MID", 2, {}), ("Fernandinho", "2017/18", "MID", 2, {}),
 ("Thiago Alcántara", "2019/20", "MID", 2, {"short": "Thiago"}), ("Sergio Busquets", "2018/19", "MID", 2, {}), ("Casemiro", "2021/22", "MID", 2, {}),
 ("Frenkie de Jong", "2022/23", "MID", 2, {}), ("Yaya Touré", "2016/17", "MID", 2, {}), ("Ilkay Gündogan", "2020/21", "MID", 2, {}),
 # full-backs
 ("Trent Alexander-Arnold", "2019/20", "FB", 3, {"short": "Trent"}), ("Andrew Robertson", "2018/19", "FB", 2, {}), ("Achraf Hakimi", "2024/25", "FB", 2, {}),
 ("João Cancelo", "2021/22", "FB", 2, {}), ("Alphonso Davies", "2019/20", "FB", 2, {}), ("Theo Hernández", "2021/22", "FB", 2, {}),
 ("Reece James", "2021/22", "FB", 2, {}), ("Kyle Walker", "2017/18", "FB", 2, {}), ("Marcelo", "2016/17", "FB", 3, {}), ("Nuno Mendes", "2024/25", "FB", 2, {}),
 ("Daniel Carvajal", "2023/24", "FB", 2, {}),
 # centre-backs
 ("Virgil van Dijk", "2018/19", "CB", 3, {}), ("Rúben Dias", "2020/21", "CB", 2, {}), ("William Saliba", "2023/24", "CB", 2, {}),
 ("Sergio Ramos", "2016/17", "CB", 3, {}), ("Antonio Rüdiger", "2021/22", "CB", 2, {}), ("Kalidou Koulibaly", "2018/19", "CB", 2, {}),
 ("Thiago Silva", "2020/21", "CB", 2, {}), ("Gabriel", "2024/25", "CB", 2, {}), ("Harry Maguire", "2018/19", "CB", 2, {}),
 # goalkeepers
 ("Alisson Becker", "2018/19", "GK", 3, {"short": "Alisson"}), ("Ederson", "2017/18", "GK", 2, {}), ("Thibaut Courtois", "2021/22", "GK", 2, {}),
 ("David de Gea", "2017/18", "GK", 3, {}), ("Jan Oblak", "2020/21", "GK", 2, {}), ("Gianluigi Donnarumma", "2024/25", "GK", 2, {}),
 ("Emiliano Martínez", "2022/23", "GK", 2, {}), ("Manuel Neuer", "2019/20", "GK", 2, {}),
]
DONE = {"Mohamed Salah|2024/25", "Erling Haaland|2022/23", "Neymar|2017/18", "Harry Kane|2025/26"}   # already made
FAME = {c[0] for c in C} | {"Erling Haaland", "Neymar", "Bernardo Silva", "Kai Havertz", "Gabriel Jesus", "Julián Álvarez", "Mason Mount", "Declan Rice", "Jarrod Bowen",
        "Anthony Gordon", "Morgan Rogers", "Eberechi Eze", "Morgan Gibbs-White", "Dominik Szoboszlai", "Enzo Fernández", "Martin Zubimendi", "Federico Valverde", "Nicolò Barella",
        "Hakan Çalhanoğlu", "Aurélien Tchouaméni", "Jude Bellingham", "Rodrygo", "Désiré Doué", "Bradley Barcola", "João Neves", "Marquinhos", "Josko Gvardiol", "Joško Gvardiol",
        "Cristian Romero", "Micky van de Ven", "Ibrahima Konaté", "John Stones", "Lisandro Martínez", "Pau Cubarsí", "Dean Huijsen", "Jules Koundé", "Kieran Trippier", "Pedro Porro",
        "Ben White", "Jurriën Timber", "Federico Dimarco", "Alejandro Grimaldo", "Jeremie Frimpong", "David Raya", "Jordan Pickford", "André Onana", "Mike Maignan", "Marc-André ter Stegen",
        "Unai Simón", "Yann Sommer", "Nick Pope", "Bryan Mbeumo", "Matheus Cunha", "Antoine Semenyo", "Hugo Ekitike", "Benjamin Sesko", "Nicolas Jackson", "Dominic Solanke", "João Pedro",
        "Jean-Philippe Mateta", "Chris Wood", "Serhou Guirassy", "Marcus Thuram", "Jonathan David", "Randal Kolo Muani", "Gonçalo Ramos", "Ademola Lookman", "Nico Williams", "Rayan Cherki",
        "Xavi Simons", "Dani Olmo", "Leroy Sané", "Serge Gnabry", "Kingsley Coman", "Christian Pulisic", "Federico Chiesa", "Mohammed Kudus", "Luis Díaz", "Cody Gakpo",
        "Darwin Núñez", "Callum Wilson", "Dominic Calvert-Lewin", "Ivan Toney", "Aleksandar Mitrović", "Richarlison", "Heung-Min Son", "Dejan Kulusevski", "Brennan Johnson"}
names = collections.Counter(o['name'] for o in D.rows)
res = []
for name, season, g, fame, extra in C:
    if f"{name}|{season}" in DONE: continue
    t = D.find(name, season)
    if not t: print("NOT IN DATA:", name, season, "| close:", [n for n in names if name.split()[-1] in n][:4]); continue
    ref = t[0]; lgs = PL if ref['league'] in PL else ALLL
    try: order, wins, tp, tf, G, cand = D.rank(t, FIVE, lgs, g=g)
    except Exception as e: print("FAILED:", name, season, repr(e)[:80]); continue
    if not order: print("NO CANDIDATES:", name, season); continue
    others = [(d, o) for d, o in order if o['name'] != name]
    if len(others) < 12: print("TOO FEW:", name, season); continue
    d1, tw = others[0]; m = D.match(d1); sure = round(100 * wins[(tw['name'], tw['season'])] / 2000)
    own_top = sum(1 for d, o in order[:10] if o['name'] == name)
    topnames = {o['name'] for d, o in others[:7]}
    far = [(i + 1, o['name']) for i, (d, o) in enumerate(others) if i >= 9 and o['name'] in FAME and o['name'] not in topnames and o['name'] != tw['name']]
    seenf = set(); far = [x for x in far if not (x[1] in seenf or seenf.add(x[1]))]
    pts = fame + (1 if extra.get('award') else 0) + (2 if m >= 80 else 1 if m >= 75 else 0) + (1 if sure >= 60 else 0)
    famous_twin = tw['name'] in FAME; pts += 2 if famous_twin else (1 if tw['teamId'] != ref['teamId'] else 0)
    pts += (tw['teamId'] != ref['teamId']) + (tw['league'] != ref['league']) + (abs(tw['s'] - ref['s']) >= 4) + (own_top > 0) + (2 if far else 0)
    if tw['mins_played'] < 1500: pts -= 2
    res.append({'player': name, 'season': season, 'group': G, 'declared': g, 'pos': ref['pos'], 'league': ref['leagueName'], 'pl': ref['league'] in PL, 'fame': fame, **extra,
                'twin': tw['name'], 'twinSeason': tw['season'], 'twinClub': tw['teamId'], 'match': round(m, 1), 'sure': sure, 'famousTwin': famous_twin, 'ownTop': own_top,
                'surprise': [n for _, n in far[:6]], 'surpriseRank': far[:3], 'top7': [f"{o['name']} {o['season'][2:]}" for d, o in others[:7]], 'score': pts, 'twinMins': tw['mins_played']})
    print(f"{pts:>2} {name} {season} [{G}{'' if ref['league'] in PL else ' all'}] -> {tw['name']} {tw['season'][2:]} {m:.0f}% sure {sure}% {'FAMOUS' if famous_twin else ''} far:{far[:2]}", flush=True)
res.sort(key=lambda r: -r['score'])
CAP = {'ST': 7, 'AMW': 9, 'MID': 4, 'FB': 3, 'CB': 2, 'GK': 2}; used = collections.Counter(); seen = set(); twins = collections.Counter(); pick = []
for r in res:   # one video per player, a spread of positions, and no twin used more than twice
    if r['player'] in seen or used[r['group']] >= CAP.get(r['group'], 3) or twins[r['twin']] >= 2 or r['match'] < 72: continue
    seen.add(r['player']); used[r['group']] += 1; twins[r['twin']] += 1; pick.append(r)
    if len(pick) >= HOW: break
if os.environ.get('TWIN_FORCE'):   # a hand-made final list: a JSON file of "Name|season" in the order wanted (the score still chose from)
    want = json.load(open(os.environ['TWIN_FORCE'])); by = {f"{r['player']}|{r['season']}": r for r in res}
    print("NOT SCORED:", [k for k in want if k not in by]); pick = [by[k] for k in want if k in by]
json.dump({'picked': pick, 'all': res}, open(OUT, 'w'), indent=1, ensure_ascii=False)
print("\nPICKED", len(pick)); [print(f"{i + 1:>2}. {r['score']:>2} {r['player']} {r['season']} [{r['group']}] -> {r['twin']} {r['twinSeason'][2:]} {r['match']:.0f}%") for i, r in enumerate(pick)]
