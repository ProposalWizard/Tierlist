# "Who replaces him?" episodes (Mikey, 9 Nov 2026): a player is leaving; find his replacement with the
# Twin Finder method (model/finder_model.py), then a young-players-only filter, like the replacement-finder
# TikTok format. Ages, market values and current clubs come from each player's FotMob page.
#   TWIN_DATA=<dir with twin_data.json> python3 make_replace.py episodes/<x>.json OUT
#   then: python3 tts.py OUT -  ;  python3 timeline.py OUT  ;  node render.cjs OUT
# Episode file: player, season, from (club now), to (club he joins), positions (FotMob ids, e.g. [38, 68] = left-back
# and left wing-back), posWord ("left-back"), maxAge (23 = "23 and under"), seasons, plus optional "say" overrides.
import json, os, sys, re, random, collections, urllib.request, time, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, "model"))
from finder_model import Data, W as FW
EP = json.load(open(sys.argv[1])); OUT = os.path.abspath(sys.argv[2]); os.makedirs(OUT, exist_ok=True)
DATA = os.environ.get("TWIN_DATA", "fm"); IMG = os.path.abspath(EP.get("imgDir", os.path.join(DATA, "..", "img"))); os.makedirs(IMG, exist_ok=True)
CACHE = os.path.join(DATA, "..", "fmplayers.json")

ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()
def words(n):
    n = int(round(n))
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ("" if n % 10 == 0 else "-" + ONES[n % 10])
    return str(n)
ORD = {"one": "first", "two": "second", "three": "third", "five": "fifth", "eight": "eighth", "nine": "ninth", "twelve": "twelfth"}
def ordinal(n):
    w = words(n); last = re.split(r"[- ]", w)[-1]
    return w[: len(w) - len(last)] + ORD.get(last, last[:-1] + "ieth" if last.endswith("y") else last + "th")
def osuf(n): return "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
def get(u): return urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=40).read()

# ---------- FotMob player pages: age, value, club now, country ----------
C = json.load(open(CACHE)) if os.path.exists(CACHE) else {}
def info(pid):
    if pid in C and 'cc' in C[pid]: return C[pid]
    h = get(f'https://www.fotmob.com/players/{pid}/x').decode()
    d = json.loads(re.search(r'__NEXT_DATA__" type="application/json">(.*?)</script>', h).group(1))['props']['pageProps']['data']
    pi = {x.get('title'): (x.get('value') or {}) for x in d.get('playerInformation', [])}
    m = re.search(r'"countryCode":\s*"([A-Z]{3})"', json.dumps(d))
    pt = d.get('primaryTeam') or {}
    C[pid] = {'age': pi.get('Age', {}).get('numberValue'), 'value': pi.get('Market value', {}).get('numberValue'), 'team': pt.get('teamName'),
              'teamId': pt.get('teamId'), 'onLoan': pt.get('onLoan'), 'contract': pi.get('Contract end', {}).get('dateValue'), 'cc': m.group(1) if m else None}
    json.dump(C, open(CACHE, 'w')); time.sleep(0.3); return C[pid]
def pics(pid, team_id):
    i = info(pid); cc = i['cc'] or 'ENG'
    for url, fn in [(f'https://images.fotmob.com/image_resources/playerimages/{pid}.png', f'p{pid}.png'),
                    (f'https://images.fotmob.com/image_resources/logo/teamlogo/{team_id}.png', f't{team_id}.png'),
                    (f'https://images.fotmob.com/image_resources/logo/teamlogo/{cc.lower()}.png', f'c{cc}.png')]:
        if not os.path.exists(os.path.join(IMG, fn)):
            try: open(os.path.join(IMG, fn), 'wb').write(get(url))
            except Exception: pass
    return {'face': 'p' + pid, 'club': 't' + str(team_id), 'flag': 'c' + cc}
def club_colours():
    from PIL import Image
    cols = {}
    for fn in os.listdir(IMG):
        if not (fn.startswith('t') and fn.endswith('.png')): continue
        im = Image.open(os.path.join(IMG, fn)).convert('RGBA').resize((24, 24)); bins = {}
        for r, g, b, a in im.getdata():
            if a < 200: continue
            mx, mn = max(r, g, b), min(r, g, b)
            if mx < 60 or (mx - mn) / mx < 0.35: continue
            e = bins.setdefault((r >> 5, g >> 5, b >> 5), [0, 0, 0, 0]); e[0] += 1; e[1] += r; e[2] += g; e[3] += b
        if bins: n, r, g, b = max(bins.values()); cols[fn[:-4]] = f'rgb({r // n},{g // n},{b // n})'
    cols.update({'t8634': 'rgb(165,0,68)', 't9823': 'rgb(220,5,45)', 't10260': 'rgb(218,41,28)', 't10261': 'rgb(30,30,30)'})  # Barcelona, Bayern, Man United, Newcastle
    cols.update(EP.get('clubColors', {}))
    return cols
def money(v):  # 62981262 -> ('sixty-three million euros', '€63M')
    m = round(v / 1e6); return f"{words(m)} million euros", f"€{m}M"

# ---------- the search ----------
D = Data(os.path.join(DATA, 'twin_data.json'))
NAME, SHORT = EP['player'], EP.get('short', EP['player'].split()[-1])
trows = D.find(NAME, EP['season']); assert trows, 'player/season not found'
LGS = {int(k) for k in D.D['leagues']}
order, _, tp, tf, GRP, cand = D.rank(trows, EP.get('seasons', ['2025/26', '2026/27']), LGS, include_own=False, n=1)
POS = set(EP.get('positions', [38, 68]))
best = {}
for d, o in order:
    if o['pos'] in POS and o['name'] not in best: best[o['name']] = (d, o)
allpos = sorted(best.values(), key=lambda x: x[0]); NPOS = len(allpos); top = allpos[:EP.get('mapN', 60)]
w = FW[GRP]
def tests(group, n=2000, seed=7):
    rnd = random.Random(seed); wins = collections.Counter()
    for _ in range(n):
        wr = {k: x * (0.5 + rnd.random()) for k, x in w.items()}
        b = min(group, key=lambda x: D.dist(tp, x[1]['_pct'], wr)); wins[b[1]['name']] += 1
    return wins
winsAll = tests(top)
rows = []
for d, o in top:
    i = info(o['id']); rows.append({'name': o['name'], 'd': d, 'match': round(Data.match(d), 1), 'o': o, **i})
young = [r for r in rows if r['age'] is not None and r['age'] <= EP.get('maxAge', 23)]
winsY = tests([(r['d'], r['o']) for r in young[:30]])
TG = trows[0]; ti = info(TG['id']); tgp = pics(TG['id'], EP.get('fromId', ti['teamId']))
for r in rows: r.update(pics(r['o']['id'], r['teamId'] or r['o']['teamId']))
c1, c2 = rows[0], rows[1]; pick = young[0]
print('compared', NPOS, 'players;', 'closest', [(r['name'], r['match'], r['age'], r['team']) for r in rows[:5]])
print('young', [(r['name'], r['match'], r['age'], r['team'], r['value']) for r in young[:5]], 'pick first in', winsY[pick['name']], 'tests')

# ---------- the map: 2-D picture of the many-stat space (direction = the two stat-mixes that spread the crowd most) ----------
keys = [k for k in w if tp.get(k) is not None]
vec = lambda o: [((o['_pct'].get(k) if o['_pct'].get(k) is not None else tp[k]) - tp[k]) * math.sqrt(w[k]) for k in keys]
V = [vec(r['o']) for r in rows]; mean = [sum(v[i] for v in V) / len(V) for i in range(len(keys))]; CV = [[v[i] - mean[i] for i in range(len(keys))] for v in V]
def pc(excl):
    v = [math.sin(i * 1.7 + (2 if excl else .3)) for i in range(len(keys))]
    for _ in range(60):
        nv = [0] * len(keys)
        for c in CV:
            dt = sum(a * b for a, b in zip(c, v)); nv = [n + dt * a for n, a in zip(nv, c)]
        if excl: dd = sum(a * b for a, b in zip(nv, excl)); nv = [a - dd * b for a, b in zip(nv, excl)]
        n = math.sqrt(sum(a * a for a in nv)) or 1; v = [a / n for a in nv]
    return v
a1 = pc(None); a2 = pc(a1)
for r, cv in zip(rows, CV):
    X, Y = sum(a * b for a, b in zip(cv, a1)), sum(a * b for a, b in zip(cv, a2)); n = math.hypot(X, Y) or 1
    r['mx'], r['my'] = X / n, Y / n

# ---------- Hall's profile: his best ranks among his own league's players in his position, and his weakest ----------
LAB = {'drib': ('dribbles', 'Dribbles'), 'rec': ('ball recoveries', 'Ball recoveries'), 'block': ('blocked shots', 'Blocked shots'), 'passes': ('passes', 'Passes'),
       'chances': ('chances created', 'Chances created'), 'A': ('assists', 'Assists'), 'tkl': ('tackles', 'Tackles'), 'int': ('interceptions', 'Interceptions'),
       'xA': ('expected assists', 'Expected assists'), 'pass%': ('pass accuracy', 'Pass accuracy'), 'long': ('long balls', 'Long balls'), 'wonHigh': ('high regains', 'High regains'),
       'clear': ('clearances', 'Clearances'), 'npG': ('goals', 'Goals'), 'def': ('defensive actions', 'Defensive actions'), 'bigCC': ('big chances made', 'Big chances made')}
POOL = D.pool(TG['league'], TG['s'], GRP)[0]
def rank_of(k):
    vals = sorted([o['f'][k] for o in POOL if o['f'].get(k) is not None], reverse=True); v = TG['f'].get(k)
    return (vals.index(v) + 1, len(vals)) if v in vals else (None, len(vals))
ranked = sorted([k for k in LAB if TG['f'].get(k) is not None and k in w and k != 'wonHigh'], key=lambda k: -(tp.get(k) or -9))
strong = ranked[:3]; weak = ranked[-1]
LEAGUE = TG['leagueName']; POSW = EP.get('posWord', 'full-back'); GROUPW = {'FB': 'full-backs', 'CB': 'centre-backs', 'MID': 'midfielders', 'AMW': 'attackers', 'ST': 'strikers'}[GRP]
fmt = lambda k, v: (f"{v:.0f}%" if k == 'pass%' else f"{v:.1f}" if v >= 1 or k in ('rec', 'drib', 'tkl', 'int', 'clear', 'long') else f"{v:.2f}")

# ---------- lines + scenes ----------
L, S = [], {}
def line(id, say, cap=None, **kw): L.append(dict(id=id, say=say, cap=cap or say.upper(), **kw))
FROM, TO = EP['from'], EP['to']
line('hook', f"{NAME} is off to {TO}. So who replaces him at {FROM}?", sfx=[["hit", 0.0, 0.7], ["whoosh", TO.upper().split()[0], 0.6], ["hit", "WHO", 0.7]], voiceSettings={"speed": 1.1}, tempo=1.05)
S['hook'] = {'type': 'hook', 'face': tgp['face'], 'flag': tgp['flag'], 'from': tgp['club'], 'to': 't' + str(EP['toId']), 'name': NAME.upper(), 'swapAt': TO.upper().split()[0], 'qAt': 'WHO',
             'kicker': 'WHO REPLACES HIM?'}
rk = [rank_of(k) for k in strong]; same = len({r[0] for r in rk}) == 1
nth = ordinal(rk[0][0]) if same else None
st_say = ", ".join(LAB[k][0] for k in strong[:-1]) + " and " + LAB[strong[-1]][0]
line('profile', (f"He's {nth} of every {LEAGUE} {GROUPW[:-1]} for {st_say}." if same else f"He's top {words(max(r[0] for r in rk))} of every {LEAGUE} {GROUPW[:-1]} for {st_say}.")
     + f" But {'he gets' if True else ''} very few {LAB[weak][0]}.".replace("he gets very few", "not many"), hold=0.2)
wr_ = rank_of(weak)
S['profile'] = {'type': 'profile', 'face': tgp['face'], 'club': tgp['club'], 'name': NAME.upper(), 'season': EP['season'],
                'chips': [{'label': LAB[k][1], 'v': fmt(k, TG['f'][k]), 'rank': f"{r[0]}{osuf(r[0])} of {r[1]} {LEAGUE} {GROUPW}", 'at': LAB[k][0].upper().split()[0], 'good': True} for k, r in zip(strong, rk)]
                         + [{'label': LAB[weak][1], 'v': fmt(weak, TG['f'][weak]), 'rank': f"{wr_[0]}{osuf(wr_[0])} of {wr_[1]}", 'at': 'BUT', 'good': False}]}
lg_counts = collections.Counter(o['leagueName'] for d, o in allpos)
line('method', f"So we compared him with all {NPOS} {POSW}s in Europe's top five leagues. Every stat per ninety, two thousand tests.",
     f"SO WE COMPARED HIM WITH ALL {NPOS}|{words(NPOS)} {POSW.upper()}S IN EUROPE'S TOP FIVE LEAGUES. EVERY STAT PER 90|ninety, 2,000|two-thousand TESTS.", hold=0.1,
     sfx=[["tick", "ALL", 0.4], ["pop", "2,000", 0.6]])
S['method'] = {'type': 'method', 'n': NPOS, 'leagues': [[k, lg_counts[k]] for k in ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1']], 'posWord': POSW, 'at': 'ALL', 'testsAt': '2,000'}
dots = [{'k': i, 'x': round(r['mx'], 4), 'y': round(r['my'], 4), 'm': r['match'], 'age': r['age'], 'face': r['face'], 'club': r['club'], 'name': r['name']} for i, r in enumerate(rows)]
first = lambda r: r['name'].split()[0].upper()
line('map', f"The two closest: {c1['name']} and {c2['name']}.", hold=0.15, sfx=[["pop", first(c1), 0.5], ["pop", first(c2), 0.5]])
S['map'] = {'type': 'map', 'dots': dots, 'hi': [[0, first(c1)], [1, first(c2)]], 'fly': True}
v2s, v2c = money(c2['value'])
line('judge', f"But {c1['name'].split()[-1]} is {words(c1['age'])}. And {c2['name'].split()[-1]} is {words(c2['age'])}, worth {v2s}.",
     f"BUT {c1['name'].split()[-1].upper()} IS {c1['age']}|{words(c1['age'])}. AND {c2['name'].split()[-1].upper()} IS {c2['age']}|{words(c2['age'])}, WORTH {v2c}|{v2s.replace(' ', '-')}.",
     sfx=[["hit", str(c1['age']), 0.6], ["hit", v2c, 0.5]])
S['judge'] = {'type': 'judge', 'cards': [{**{k: c1[k] for k in ('name', 'face', 'club', 'match', 'age', 'team')}, 'stamp': f"{c1['age']}", 'at': str(c1['age'])},
                                         {**{k: c2[k] for k in ('name', 'face', 'club', 'match', 'age', 'team')}, 'stamp': f"{c2['age']} · {v2c}", 'at': v2c}]}
MA = EP.get('maxAge', 23)
line('filter', f"{SHORT} is only {words(ti['age'])}. So: {words(MA)} and under only.", f"{SHORT.upper()} IS ONLY {ti['age']}|{words(ti['age'])}. SO: {MA}|{words(MA)} AND UNDER ONLY.", sfx=[["whoosh", "SO:", 0.6]])
S['filter'] = {'type': 'map', 'dots': dots, 'maxAge': MA, 'fadeAt': 'SO:', 'title': f"{MA} AND UNDER"}
ys = young[:5]; vps, vpc = money(pick['value']); hvs, hvc = money(ti['value'])
line('young', f"And number one is {pick['name']}, from {pick['team']}.", hold=0.1, sfx=[["hit", first(pick), 0.7]])
S['young'] = {'type': 'table', 'rows': [{'name': r['name'], 'face': r['face'], 'club': r['club'], 'age': r['age'], 'value': money(r['value'])[1] if r['value'] else '—', 'm': r['match']} for r in ys],
              'title': f"{MA} and under", 'pickAt': first(pick)}
frac = {2: 'half', 3: 'a third', 4: 'a quarter', 5: 'a fifth'}.get(round(ti['value'] / pick['value']))
line('pick', f"He's {words(pick['age'])}, and worth {vps}." + (f" {frac[0].upper() + frac[1:]} of {SHORT}'s price." if frac else ""),
     f"HE'S {pick['age']}|{words(pick['age'])}, AND WORTH {vpc}|{vps.replace(' ', '-')}." + (f" {frac.upper()} OF {SHORT.upper()}'S PRICE." if frac else ""), sfx=[["pop", vpc, 0.5]])
S['pick'] = {'type': 'pick', 'face': pick['face'], 'club': pick['club'], 'flag': pick['flag'], 'name': pick['name'].upper(), 'team': pick['team'], 'age': pick['age'], 'value': vpc, 'm': pick['match'],
             'tests': round(100 * winsY[pick['name']] / 2000), 'hall': {'value': hvc, 'v': ti['value'], 'face': tgp['face']}, 'pv': pick['value'], 'fracAt': (frac.upper().split()[-1] if frac else None)}
# Hall v the pick, on what makes Hall special (RUL-KIB-008: keep the "him v his replacement" framing, most important stats)
pf = pick['o']['f']; cmp4 = [k for k in ranked if pf.get(k) is not None][:4]
say4 = ", ".join(LAB[k][0] for k in cmp4[:-1]) + " and " + LAB[cmp4[-1]][0]
line('compare', f"{SHORT} against {pick['name'].split()[-1]}, on what makes {SHORT} special: {say4}.", hold=0.2)
row = lambda k: {'label': LAB[k][1], 'a': round(TG['f'][k], 2), 'b': round(pf[k], 2), 'sub': 'per 90 minutes' if k != 'pass%' else 'per cent'}
S['compare'] = {'type': 'compare', 'kicker': f"{SHORT} v {pick['name'].split()[-1]}", 'title': 'What makes him special.', 'a': {'name': NAME, 'season': EP['season'], 'face': tgp['face'], 'club': tgp['club']},
                'b': {'name': pick['name'], 'season': pick['o']['season'], 'face': pick['face'], 'club': pick['club']}, 'rows': [row(k) for k in cmp4], 'at': [LAB[k][0].upper().split()[0] for k in cmp4]}
# where the pick is better (his own edge) + the honest caveat on a small sample
edge = sorted([k for k in ('chances', 'drib', 'pass%', 'tkl', 'int') if pf.get(k) is not None and TG['f'].get(k) is not None and pf[k] > TG['f'][k]],
              key=lambda k: -(pf[k] - TG['f'][k]) / max(TG['f'][k], 1e-9))[:2]
VERB = {'chances': 'creates more chances', 'drib': 'dribbles even more', 'xA': 'sets up better chances', 'pass%': 'passes more accurately', 'tkl': 'tackles more', 'int': 'reads the game more', 'A': 'assists more'}
mins = pick['o']['mins_played']; games = round(mins / 90)
cav = f" Early days though: only {words(games)} games' worth this season." if mins < 900 else ""
line('edge', f"And {pick['name'].split()[-1]} {VERB[edge[0]]}" + (f", and {VERB[edge[1]]}." if len(edge) > 1 else ".") + cav, hold=0.2)
S['edge'] = {'type': 'compare', 'kicker': 'And', 'title': f"Where {pick['name'].split()[-1]} is better.", 'a': S['compare']['a'], 'b': S['compare']['b'], 'rows': [row(k) for k in edge],
             'at': [VERB[k].split()[0].upper() for k in edge], 'caveat': (f"ONLY {mins} MINUTES THIS SEASON" if cav else None), 'caveatAt': 'EARLY'}
line('end', f"So {FROM}'s next {NAME}? {pick['name']}. Would you sign him? Follow for more.", hold=0.0)
S['end'] = {'type': 'end', 'a': {'face': tgp['face'], 'club': tgp['club'], 'name': SHORT.upper()}, 'b': {'face': pick['face'], 'club': pick['club'], 'name': pick['name'].split()[-1].upper()},
            'title': f"{FROM.upper()}'S NEXT {SHORT.upper()}", 'at': first(pick)}
meta = {'series': EP.get('series', 'WHO REPLACES HIM?'), 'targetShort': SHORT, 'engine': 'video_replace.html', 'imgDir': IMG, 'clubColors': club_colours(),
        'source': 'Data: Opta via FotMob · top 5 leagues · ages and values: FotMob'}
for l in L: l.setdefault('voiceSettings', {"speed": 1.08})
json.dump(L, open(os.path.join(OUT, 'lines.json'), 'w'), indent=0, ensure_ascii=False)
json.dump({'meta': meta, 'scenes': S}, open(os.path.join(OUT, 'scenes.json'), 'w'), indent=0, ensure_ascii=False)
json.dump({'provider': 'elevenlabs', 'voiceId': 'WAppqUXeqDqXjNTaQxG9'}, open(os.path.join(OUT, 'voice.json'), 'w'))
for l in L: print(f"  [{l['id']}] {l['say']}")
