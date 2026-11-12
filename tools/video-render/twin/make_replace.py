# "Who replaces him?" episodes (Mikey, 9 Nov 2026): a player is leaving; find his replacement with the
# Twin Finder method (model/finder_model.py), then a young-players-only filter, like the replacement-finder
# TikTok format. Ages, market values and current clubs come from each player's FotMob page.
#   TWIN_DATA=<dir with twin_data.json> python3 make_replace.py episodes/<x>.json OUT
#   then: python3 tts.py OUT -  ;  python3 timeline.py OUT  ;  node render.cjs OUT
# Episode file: player, season, from (club now), to (club he joins), positions (FotMob ids, e.g. [38, 68] = left-back
# and left wing-back), posWord ("left-back"), maxAge (23 = "23 and under"), seasons, plus optional "say" overrides.
import json, os, sys, re, random, collections, urllib.request, time, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, "model"))
from finder_model import Data, W as FW, feats
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
    n = int(n)
    if n >= 100: return f"{n}{osuf(n)}"   # Hugo reads "101st" correctly; the old code said "101th"
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
    cols.update({'t8634': 'rgb(165,0,68)', 't9823': 'rgb(220,5,45)', 't10260': 'rgb(218,41,28)', 't10261': 'rgb(30,30,30)', 't8543': 'rgb(70,140,200)'})  # Barcelona, Bayern, Man United, Newcastle, Lazio
    cols.update(EP.get('clubColors', {}))
    return cols
def money(v):  # 62981262 -> ('sixty-three million euros', '€63M')
    m = int(v / 1e6 + 0.5); return f"{words(m)} million euros", f"€{m}M"

# ---------- the search ----------
D = Data(os.path.join(DATA, 'twin_data.json'))
NAME, SHORT = EP['player'], EP.get('short', EP['player'].split()[-1])
# Mikey, 10 Nov 2026: this season + last season together (this season alone is ~10 games). Every player = his rows in those
# seasons, each measured against its own league + season + position pool, then averaged by minutes.
SEAS = EP.get('seasons', ['2025/26', '2026/27'])
TGr = [o for o in D.rows if o['name'] == NAME and o['season'] in SEAS]; assert TGr, 'player not found'
TG = max(TGr, key=lambda o: o['mins_played']); GRP = TG['group']; w = FW[GRP]
ZC = {}
def zrow(o):
    if o['i'] not in ZC: ZC[o['i']] = D.pct_of(o['f'], D.pool(o['league'], o['s'], GRP), GRP)
    return ZC[o['i']]
def zmix(rs):
    out = {}
    for k in w:
        s_ = t_ = 0
        for o in rs:
            z = zrow(o).get(k)
            if z is not None: s_ += z * o['mins_played']; t_ += o['mins_played']
        out[k] = s_ / t_ if t_ else None
    return out
tp = zmix(TGr); tf = feats(D.combine(TGr)); TMINS = sum(o['mins_played'] for o in TGr)
POS = set(EP.get('positions', [38, 68]))
byp = collections.defaultdict(list)
for o in D.rows:
    if o['season'] in SEAS and D.in_group(o, GRP) and D.min_ok(o) and o['name'] != NAME: byp[o['id']].append(o)
allpos = []
for pid, rs in byp.items():
    main = max(rs, key=lambda o: o['mins_played'])
    if main['pos'] not in POS: continue
    z = zmix(rs); d = D.dist(tp, z, w)
    if d >= 99: continue
    allpos.append((d, {**main, '_pct': z, 'fc': feats(D.combine(rs)), 'mins': sum(o['mins_played'] for o in rs), 'seasons': sorted(o['season'] for o in rs)}))
if EP.get('minMins'): allpos = [x for x in allpos if x[1]['mins'] >= EP['minMins']]   # e.g. 1800 = 20 games' worth over the two seasons
allpos.sort(key=lambda x: x[0]); NPOS = len(allpos); top = allpos[:EP.get('mapN', 60)]
def tests(group, n=2000, seed=7):
    rnd = random.Random(seed); wins = collections.Counter()
    for _ in range(n):
        wr = {k: x * (0.5 + rnd.random()) for k, x in w.items()}
        b = min(group, key=lambda x: D.dist(tp, x[1]['_pct'], wr)); wins[b[1]['name']] += 1
    return wins
rows = []
for d, o in top:
    i = info(o['id']); rows.append({'name': o['name'], 'd': d, 'match': round(Data.match(d), 1), 'o': o, **i})
young = [r for r in rows if r['age'] is not None and r['age'] <= EP.get('maxAge', 23)]
winsY = tests([(r['d'], r['o']) for r in young[:30]])
ti = info(TG['id']); tgp = pics(TG['id'], EP.get('fromId', ti['teamId']))
for r in rows: r.update(pics(r['o']['id'], r['teamId'] or r['o']['teamId']))
pick = young[0]
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
lp = collections.defaultdict(list)
for o in D.rows:
    if o['season'] in SEAS and o['league'] == TG['league'] and D.in_group(o, GRP): lp[o['id']].append(o)
POOL = [{'id': pid, 'name': rs[0]['name'], 'teamId': max(rs, key=lambda o: o['mins_played'])['teamId'], 'f': feats(D.combine(rs))}
        for pid, rs in lp.items() if sum(o['mins_played'] for o in rs) >= 900]
def ladder(k):
    L_ = sorted([o for o in POOL if o['f'].get(k) is not None], key=lambda o: -o['f'][k]); i = next(j for j, o in enumerate(L_) if o['id'] == TG['id'])
    lo = max(0, min(i - 1, len(L_) - 3)); return i + 1, len(L_), [(j + 1, L_[j]) for j in range(lo, lo + 3)]
ranked = sorted([k for k in LAB if tf.get(k) is not None and k in w and k != 'wonHigh'], key=lambda k: -(tp.get(k) or -9))
strong = ranked[:3]; weak = ranked[-1]
LEAGUE = TG['leagueName']; POSW = EP.get('posWord', 'full-back'); GROUPW = {'FB': 'full-backs', 'CB': 'centre-backs', 'MID': 'midfielders', 'AMW': 'attackers', 'ST': 'strikers'}[GRP]
fmt = lambda k, v: (f"{v:.0f}%" if k == 'pass%' else f"{v:.1f}" if v >= 1 or k in ('rec', 'drib', 'tkl', 'int', 'clear', 'long') else f"{v:.2f}")

# ---------- lines + scenes ----------
L, S = [], {}
def line(id, say, cap=None, **kw): L.append(dict(id=id, say=say, cap=cap or say.upper(), **kw))
FROM, TO = EP['from'], EP['to']
line('hook', f"{NAME} is likely off to {TO}. So how do you replace him?", sfx=[["hit", 0.0, 0.7], ["whoosh", TO.upper().split()[0], 0.6], ["hit", "HOW", 0.7]], voiceSettings={"speed": 1.1}, tempo=1.05)
S['hook'] = {'type': 'hook', 'face': tgp['face'], 'flag': tgp['flag'], 'from': tgp['club'], 'to': 't' + str(EP['toId']), 'name': NAME.upper(), 'swapAt': TO.upper().split()[0], 'qAt': 'HOW',
             'kicker': 'HOW DO YOU REPLACE HIM?', 'likely': 'LIKELY'}
# what makes him him: his three best stats and his worst (against the league's players in his position), each as a ladder:
# the player above him, him, the player below (top three if he is first, bottom three if he is last) (Mikey, 10 Nov 2026)
def lv(k, vals):  # enough decimals that the three ladder values don't look tied
    if k == 'pass%': return [f"{v:.1f}%" for v in vals]
    for dp in (1, 2, 3):
        out = [f"{v:.{dp}f}" for v in vals]
        if len(set(out)) == len(out): return out
    return out
LAD = []
for k in strong + [weak]:
    rk_, n_, three = ladder(k)
    LAD.append({'k': k, 'label': LAB[k][1], 'rank': rk_, 'n': n_, 'good': k != weak, 'at': LAB[k][0].upper().split()[0] if k != weak else 'BUT',
                'rows': [{'rank': j, 'name': o['name'], 'v': lv(k, [x['f'][k] for _, x in three])[n], 'me': o['id'] == TG['id'], **pics(o['id'], o['teamId'])} for n, (j, o) in enumerate(three)]})
LAD[-1]['at'] = LAD[-1]['label'].upper().split()[0]
byr = collections.OrderedDict()
for l in sorted(LAD[:3], key=lambda l: l['rank']): byr.setdefault(l['rank'], []).append(LAB[l['k']][0])
parts = [f"{ordinal(r)} for " + " and ".join(ks) for r, ks in byr.items()]
said = (", ".join(parts[:-1]) + ", and " + parts[-1]) if len(parts) > 1 else parts[0]
line('profile', f"Over the last two seasons, among {LEAGUE} {GROUPW}, he's {said}. But only {ordinal(LAD[3]['rank'])} for {LAB[weak][0]}.", hold=0.3)
LAD[:3] = sorted(LAD[:3], key=lambda l: l['rank'])
S['profile'] = {'type': 'ladder', 'stats': LAD, 'group': f"{LEAGUE} {GROUPW}".upper(), 'seasons': ' + '.join(SEAS)}
lg_counts = collections.Counter(o['leagueName'] for d, o in allpos)
faces = {lg: [pics(o['id'], o['teamId'])['face'] for d, o in allpos if o['leagueName'] == lg] for lg in lg_counts}
line('method', f"So we compared him with all {NPOS} {POSW}s in Europe's top five leagues.", f"SO WE COMPARED HIM WITH ALL {NPOS}|{words(NPOS)} {POSW.upper()}S IN EUROPE'S TOP FIVE LEAGUES.", hold=0.2,
     sfx=[["tick", "ALL", 0.4]])
S['method'] = {'type': 'method', 'n': NPOS, 'leagues': [[k, lg_counts[k], faces.get(k, [])] for k in ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1']], 'posWord': POSW, 'at': 'ALL'}
dots = [{'k': i, 'x': round(r['mx'], 4), 'y': round(r['my'], 4), 'm': r['match'], 'age': r['age'], 'face': r['face'], 'club': r['club'], 'name': r['name']} for i, r in enumerate(rows)]
first = lambda r: r['name'].split()[0].upper()
# Mikey, 10 Nov 2026: two options, not one verdict. Option 1 = the closest player of all (ready now);
# option 2 = the closest aged maxAge and under (one for the future). Age is a choice for the viewer, not a reason to rule a man out.
MA = EP.get('maxAge', 23); o1 = rows[0]; o2 = pick if pick['name'] != o1['name'] else young[1]
# Mikey can name the two options ("option1": "Nuno Tavares", "option2": "Wesley"); the data still decides every number said about them
byname = lambda nm: next(r for r in rows if r['name'] == nm)
if EP.get('option1'): o1 = byname(EP['option1'])
if EP.get('option2'): o2 = byname(EP['option2'])
last = lambda r: r['name'].split()[-1]
hvs, hvc = money(ti['value'])
R0 = lambda v: int(v + 0.5)   # round half up, the same as the page's Math.round
def option(id, r, n, tagline, say_tag, extra=''):
    vs, vc = money(r['value']); ps = f"{words(R0(r['match']))} percent"
    line(id, f"He's {words(r['age'])}, a{'n' if ps[0] in 'ae' else ''} {ps} match, and worth {vs}. {say_tag}{extra}",
         f"HE'S {r['age']}|{words(r['age'])}, A{'N' if ps[0] in 'ae' else ''} {R0(r['match'])}%|{ps.replace(' ', '-')} MATCH, AND WORTH {vc}|{vs.replace(' ', '-')}. {say_tag.upper()}{extra.upper()}",
         hold=0.25, sfx=[["pop", "WORTH", 0.5], ["hit", say_tag.upper().split()[0], 0.6]])
    S[id] = {'type': 'pick', 'face': r['face'], 'club': r['club'], 'flag': r['flag'], 'name': r['name'].upper(), 'team': r['team'], 'age': r['age'], 'value': vc, 'm': r['match'],
             'hall': {'value': hvc, 'v': ti['value'], 'face': tgp['face']}, 'pv': r['value'], 'pill': f"OPTION {n} · {tagline}", 'pillAt': say_tag.upper().split()[0],
             'caveat': (f"ONLY {r['o']['mins']} MINUTES SO FAR" if r['o']['mins'] < 900 else None), 'caveatAt': 'BUT'}
line('map', (f"The closest of them all: {o1['name']}, at {o1['team']}." if o1 is rows[0] else f"Our ready-made pick: {o1['name']}, at {o1['team']}."), hold=0.15, sfx=[["hit", first(o1), 0.7]])
S['map'] = {'type': 'map', 'dots': dots, 'hi': [[0, first(o1)]], 'fly': True}
option('opt1', o1, 1, EP.get('opt1Tag', 'READY NOW'), EP.get('opt1Say', 'The ready-made option.'))
# Hall v option 1, on what makes Hall special (RUL-KIB-008: keep the "him v his replacement" framing, most important stats)
pf = o1['o']['fc']; cmp4 = [k for k in ranked if pf.get(k) is not None][:4]
say4 = ", ".join(LAB[k][0] for k in cmp4[:-1]) + " and " + LAB[cmp4[-1]][0]
line('compare', f"{SHORT} against {last(o1)}, on what makes {SHORT} special: {say4}.", hold=0.2)
row = lambda k, f: {'label': LAB[k][1], 'a': round(tf[k], 2), 'b': round(f[k], 2), 'sub': 'per 90 minutes' if k != 'pass%' else 'per cent'}
side = lambda r: {'name': r['name'], 'season': ' + '.join(x[2:] for x in r['o']['seasons']), 'face': r['face'], 'club': r['club']}
S['compare'] = {'type': 'compare', 'kicker': f"{SHORT} v {last(o1)}", 'title': f"What makes {SHORT} special.", 'a': {'name': NAME, 'season': ' + '.join(x[2:] for x in SEAS), 'face': tgp['face'], 'club': tgp['club']},
                'b': side(o1), 'rows': [row(k, pf) for k in cmp4], 'at': [LAB[k][0].upper().split()[0] for k in cmp4]}
line('filter', f"But {SHORT} is only {words(ti['age'])}. So what about {words(MA)} and under?", f"BUT {SHORT.upper()} IS ONLY {ti['age']}|{words(ti['age'])}. SO WHAT ABOUT {MA}|{words(MA)} AND UNDER?", sfx=[["whoosh", "SO", 0.6]])
S['filter'] = {'type': 'map', 'dots': dots, 'maxAge': MA, 'fadeAt': 'SO', 'title': f"{MA} AND UNDER"}
ys = young[:5] if o2 in young[:5] else young[:4] + [o2]   # in match order; the chosen one is lit up where he sits
line('young', EP.get('youngSay') or (f"The closest is {o2['name']}, at {o2['team']}." if o2 is young[0] else f"Our pick for the future: {o2['name']}, at {o2['team']}."), hold=0.1, sfx=[["hit", first(o2), 0.7]])
S['young'] = {'type': 'table', 'rows': [{'name': r['name'], 'face': r['face'], 'club': r['club'], 'age': r['age'], 'value': money(r['value'])[1] if r['value'] else '—', 'm': r['match'], 'pick': r is o2} for r in ys],
              'title': f"{MA} and under", 'pickAt': first(o2)}
games = round(o2['o']['mins'] / 90)
option('opt2', o2, 2, EP.get('opt2Tag', 'FOR THE FUTURE'), EP.get('opt2Say', 'One for the future.'), f" But he's only played {words(games)} games' worth of minutes." if o2['o']['mins'] < 900 else '')
line('end', f"So: {last(o1)} to do it now, or {last(o2)} for the future. Who would you sign? Follow for more.", hold=0.0)
S['end'] = {'type': 'end2', 'a': {'face': tgp['face'], 'club': tgp['club'], 'name': SHORT.upper()}, 'title': f"HOW DO YOU REPLACE {SHORT.upper()}?",
            'opts': [{'face': r['face'], 'club': r['club'], 'name': last(r).upper(), 'sub': f"{r['age']} · {money(r['value'])[1]} · {R0(r['match'])}%", 'tag': t_, 'at': last(r).upper()}
                     for r, t_ in ((o1, 'READY NOW'), (o2, 'FOR THE FUTURE'))]}
meta = {'series': EP.get('series', 'WHO REPLACES HIM?'), 'targetShort': SHORT, 'engine': 'video_replace.html', 'imgDir': IMG, 'clubColors': club_colours(),
        'source': 'Data: Opta via FotMob · top 5 leagues · ages and values: FotMob'}
for l in L: l.setdefault('voiceSettings', {"speed": 1.08})
json.dump(L, open(os.path.join(OUT, 'lines.json'), 'w'), indent=0, ensure_ascii=False)
json.dump({'meta': meta, 'scenes': S}, open(os.path.join(OUT, 'scenes.json'), 'w'), indent=0, ensure_ascii=False)
json.dump({'provider': 'elevenlabs', 'voiceId': 'WAppqUXeqDqXjNTaQxG9'}, open(os.path.join(OUT, 'voice.json'), 'w'))
for l in L: print(f"  [{l['id']}] {l['say']}")
if os.environ.get('DEBUG_LIST'):
    for r in rows[:12]: print('ALL', r['name'], r['match'], r['age'], r['team'], (r['value'] or 0) // 10**6, r['o']['mins'], r['o']['seasons'])
    for r in young[:10]: print('YOUNG', r['name'], r['match'], r['age'], r['team'], (r['value'] or 0) // 10**6, r['o']['mins'], r['o']['seasons'], winsY[r['name']])
